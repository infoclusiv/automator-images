# Plan de Refactorización: `flowContentScript.js`

> **Objetivo:** Dividir el archivo monolítico `flowContentScript.js` en módulos ES independientes sin alterar el comportamiento funcional de la extensión. Cada módulo debe ser un archivo `.js` separado que se compile/bundle mediante el sistema de build existente (Vite).

---

## Contexto y restricciones

- La extensión usa **Manifest V3** con `content_scripts` declarados en `manifest.json`.
- El archivo actual `flowContentScript.js` es el bundle de salida — no el source.
- El source debe vivir en `src/content/` y el bundler genera el archivo final en la raíz.
- **No romper** el wiring final: todos los módulos deben conectarse en `src/content/index.js`.
- Los módulos se comunican exclusivamente vía **EventBus** — no importar estado directamente entre módulos hermanos.
- Mantener todos los nombres de funciones exportadas idénticos a los actuales para no romper referencias del `background.js`.

---

## Estructura de carpetas objetivo

```
src/
└── content/
    ├── index.js                  ← Punto de entrada y bootstrap
    ├── eventBus.js               ← Sistema pub/sub (EVENTS + on/off/emit/once)
    ├── constants.js              ← SELECTORS, STORAGE_KEY, MODEL_MAP, timeouts
    ├── domUtils.js               ← h(), $xpath(), waitForElement(), re(), centerOf()
    ├── stateManager.js           ← Estado global, getState/setState, persistencia
    ├── textInjector.js           ← injectText(), stealth typing, paste simulation
    ├── submitHandler.js          ← clickSubmit(), stealth submit via fiber
    ├── clickHelper.js            ← ht(), Vn(), Ue(), stealth click con offset
    ├── settingsApplicator.js     ← applyUnifiedSettings(), MODEL_DISPLAY_NAMES
    ├── imageUploader.js          ← uploadAllImages(), attachAllImages(), clearReferences()
    ├── errorScanner.js           ← TILE_ERROR_PATTERNS, scanTileErrors(), checkGlobalErrors()
    ├── monitoring.js             ← startTileScanner(), downloadTileViaUI(), snapshotTiles()
    ├── taskRunner.js             ← runTask(), DAILY_LIMIT_FALLBACK handler
    ├── queueController.js        ← QueueController: QUEUE_NEXT handler, inter-task delay
    ├── overlayManager.js         ← showOverlay(), hideOverlay(), updateMessage(), errorBanner()
    └── contentDownloadManager.js ← CDM: activate/deactivate/toggle, panel UI
```

---

## Módulos: especificación detallada

---

### 1. `src/content/constants.js`

**Responsabilidad:** Centralizar todas las constantes del content script.

**Extraer del código actual:**

```js
// Selectores XPath
export const SELECTORS = {
  PROMPT_POLICY_ERROR_POPUP_XPATH: "//li[@data-sonner-toast and .//i[normalize-space(text())='error'] and not(.//*[contains(., '5')])]",
  QUEUE_FULL_POPUP_XPATH: "//li[@data-sonner-toast and .//i[normalize-space(text())='error'] and .//*[contains(., '5')]]",
};

// Storage key para persistencia
export const STORAGE_KEY = "flowAutomationState";

// Mapa de IDs de modelo a nombres legibles
export const MODEL_DISPLAY_NAMES = {
  default: "Veo 3.1 - Fast",
  veo3_fast: "Veo 3.1 - Fast",
  veo3_quality: "Veo 3.1 - Quality",
  veo2_fast: "Veo 2 - Fast",
  veo2_quality: "Veo 2 - Quality",
  veo3_fast_low: "Veo 3.1 - Fast",
  nano_banana_pro: "Nano Banana Pro",
  nano_banana2: "Nano Banana 2",
  nano_banana: "Nano Banana 2",
  imagen4: "Imagen 4",
};

// Timeouts de monitoreo (ms)
export const MONITORING_TIMEOUTS = {
  IMAGE_STALL: 30_000,
  IMAGE_ZERO_TILES: 60_000,
  VIDEO_STALL: 90_000,
  VIDEO_ZERO_TILES: 180_000,
};

// Límite de caracteres para stealth typing vs paste
export const STEALTH_PASTE_THRESHOLD = 120;

// Configuración por defecto
export const DEFAULT_SETTINGS = {
  autoDownload: true,
  delayBetweenPrompts: 8_000,
  delayMin: 15,
  delayMax: 30,
  flowVideoCount: "1",
  flowModel: "default",
  flowAspectRatio: "landscape",
  imageDownloadQuality: "1K",
  videoDownloadQuality: "720p",
  autoClearCache: false,
  autoClearCacheInterval: 50,
};

// Número máximo de reintentos por tarea
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 5_000;
export const INTER_TASK_DELAY_FALLBACK_MS = 15_000;
```

**Reglas:**
- Solo exportaciones `const` — sin lógica.
- Cualquier valor "mágico" hardcodeado en otros módulos debe moverse aquí.

---

### 2. `src/content/eventBus.js`

**Responsabilidad:** Sistema de eventos pub/sub desacoplado. Sin dependencias de otros módulos internos.

**API a exportar (idéntica a la actual):**

```js
export const EVENTS = { /* objeto con todas las claves de evento */ };

export function on(event, handler) { /* ... */ }
export function once(event, handler) { /* ... */ }
export function off(event, handler) { /* ... */ }
export function emit(event, payload) { /* ... */ }
export function clear(event) { /* ... */ }
export function clearAll() { /* ... */ }
export function debugListeners() { /* ... */ }
```

**Objeto EVENTS — copiar exacto del actual:**

```js
export const EVENTS = {
  QUEUE_NEXT: "queue:next",
  PROCESSING_COMPLETE: "processing:complete",
  PROCESSING_STOP: "processing:stop",
  PROCESSING_TERMINATE: "processing:terminate",
  TASK_START: "task:start",
  TASK_COMPLETED: "task:completed",
  TASK_ERROR: "task:error",
  TASK_SKIPPED: "task:skipped",
  DAILY_LIMIT_FALLBACK: "task:daily_limit_fallback",
  OVERLAY_SHOW: "overlay:show",
  OVERLAY_HIDE: "overlay:hide",
  OVERLAY_MESSAGE: "overlay:message",
  OVERLAY_PAUSING: "overlay:pausing",
  OVERLAY_ERROR_BANNER: "overlay:error_banner",
  OVERLAY_ERROR_BANNER_CLEAR: "overlay:error_banner_clear",
  COUNTDOWN_START: "countdown:start",
  PROGRESS_UPDATE: "progress:update",
};
```

**Reglas:**
- Sin efectos secundarios al importar.
- El `Map` interno de listeners es privado al módulo.

---

### 3. `src/content/domUtils.js`

**Responsabilidad:** Utilidades DOM puras, sin estado, sin efectos secundarios propios.

**API a exportar:**

```js
// Pausa async
export function h(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// Evaluación XPath
export function $(xpath, context = document) { /* ... */ }

// Esperar elemento CSS
export async function waitForElement(selector, timeoutMs = 5000) { /* ... */ }

// Disparar Escape
export function re() { /* dispatchEvent keydown Escape */ }

// Calcular centro de un elemento
export function centerOf(element) { /* getBoundingClientRect + width/2, height/2 */ }
```

**Reglas:**
- Sin imports de otros módulos del proyecto.
- Funciones puras o que solo interactúan con el DOM.

---

### 4. `src/content/stateManager.js`

**Responsabilidad:** Estado centralizado de la automatización. Persistencia en `chrome.storage.local`. Restauración al cargar.

**Dependencias:** `constants.js`, `domUtils.js` (solo `h`)

**API a exportar:**

```js
// Inicialización — conecta eventBus y contentDownloadManager
export function init(eventBus, contentDownloadManager) { /* ... */ }

// Lectura/escritura de estado
export function getState() { /* devuelve snapshot inmutable */ }
export function setState(partial) { /* merge + side effects (chrome.runtime.sendMessage automationStateChanged) */ }

// Accesos de conveniencia
export function getSettings() { /* state.settings */ }
export function updateSettings(partial) { /* merge settings */ }
export function getTaskList() { /* state.taskList */ }
export function updateTask(index, partial) { /* state.taskList[index] merge */ }
export function getCurrentTask() { /* taskList[currentTaskIndex] */ }
export function getTaskByIndex(index) { /* taskList.find(t => t.index === index) */ }
export function getCurrentTaskByStatus() { /* taskList.find(t => t.status === "current") */ }

// Persistencia
export async function saveStateToStorage() { /* chrome.storage.local.set */ }
export async function loadStateFromStorage() { /* chrome.storage.local.get */ }
export async function clearStateFromStorage() { /* chrome.storage.local.remove */ }

// Timers
export function startCountdown(ms, label) { /* setInterval con emit OVERLAY_MESSAGE */ }
export function clearCountdownTimer() { /* clearInterval */ }
export function formatTime(ms) { /* "Xm Ys" o "Ys" */ }

// Delay aleatorio
export function getRandomDelay(task, settings) { /* lógica delayMin/delayMax */ }

// Envío de actualización de tarea al background
export function sendTaskUpdate(task) { /* chrome.runtime.sendMessage queueTaskUpdate */ }

// Verificación de autenticación
export async function verifyAuthenticationState() { /* chrome.runtime.sendMessage getAuthState */ }
```

**Reglas:**
- El estado es un objeto plano — no clases.
- `setState` es el único punto de mutación.
- La restauración automática desde storage ocurre en un IIFE al final del módulo.

---

### 5. `src/content/textInjector.js`

**Responsabilidad:** Inyección de texto en el editor Slate.js de Flow, con soporte para modo stealth.

**Dependencias:** `domUtils.js`, `constants.js`

**Inicialización:**

```js
// Recibe getState para leer stealthMode y isProcessing sin importar stateManager directamente
export function init(getStateFn) { /* guarda referencia */ }
```

**API a exportar:**

```js
export async function injectText(text) {
  // Decide entre fastInject / stealthPaste / stealthTyping según stealthMode y longitud
}

// Privadas (no exportar):
async function fastInject(editorEl, text) { /* InputEvent beforeinput */ }
async function stealthPaste(editorEl, text) { /* ClipboardEvent paste simulation */ }
async function stealthTyping(editorEl, text) { /* por carácter via MAIN world fiber */ }
```

**Reglas:**
- `executeInMainWorld` se llama vía `chrome.runtime.sendMessage` — no asumir acceso directo.
- `stealthTyping` debe verificar `getState().isProcessing` en cada carácter y abortar si es `false`.

---

### 6. `src/content/submitHandler.js`

**Responsabilidad:** Click del botón de envío, con fallback DOM si el modo stealth falla.

**Dependencias:** `domUtils.js`

**Inicialización:**

```js
export function init(getStateFn) { /* stealthMode */ }
```

**API a exportar:**

```js
export async function clickSubmit() {
  // Si stealthMode → stealthSubmit() (fiber onClick)
  // Fallback → domClick()
}

// Privadas:
async function stealthSubmit() { /* executeInMainWorld fiber onClick */ }
function domClick() { /* querySelector button arrow_forward + click */ }
```

---

### 7. `src/content/clickHelper.js`

**Responsabilidad:** Helpers de bajo nivel para simular clicks con PointerEvent/MouseEvent.

**Dependencias:** `domUtils.js` (centerOf)

**API a exportar:**

```js
export function pointerClick(element) { /* PointerEvent pointerdown/up */ }
export function mouseClick(element) { /* MouseEvent mousedown/up/click */ }
export function toggleTab(element) { /* data-state="active" check + mouseClick */ }
export function stealthClick(element) { /* click con offset aleatorio + todos los eventos */ }
```

**Reglas:**
- Sin estado propio.
- Sin imports de otros módulos del proyecto.

---

### 8. `src/content/settingsApplicator.js`

**Responsabilidad:** Abrir el panel de control de Flow y aplicar configuración (tipo, ratio, count, modelo).

**Dependencias:** `domUtils.js`, `constants.js`, `clickHelper.js`

**Inicialización:**

```js
export function init(getStateFn, setStateFn) { /* referencias a estado */ }
```

**API a exportar:**

```js
export async function applyUnifiedSettings(taskType, settings) {
  // Pasos 1-7: abrir panel, seleccionar tipo, sub-mode, ratio, count, modelo, cerrar
  // Retorna boolean (éxito/fallo)
}

// Privada:
function settingsAreEqual(a, b) { /* comparación de objetos de settings */ }
```

**Reglas:**
- Debe verificar `getState().isProcessing` entre cada paso (`$e()` en el original).
- Cachea `lastAppliedSettings` vía `setState` para evitar re-aplicar si no cambia nada.

---

### 9. `src/content/imageUploader.js`

**Responsabilidad:** Subir imágenes a la librería de Flow y adjuntarlas como referencias.

**Dependencias:** `domUtils.js`, `constants.js`, `clickHelper.js`

**Inicialización:**

```js
export function init(getStateFn) { /* stealthMode y isProcessing */ }
```

**API a exportar:**

```js
export async function clearExistingReferences() { /* busca botón close + click */ }
export async function uploadAllImages(images) { /* Phase 1: batch check + inject files */ }
export async function attachAllImages(images, mode) { /* Phase 2: abrir picker + seleccionar */ }

// Privadas:
async function checkLibraryForFiles(names) { /* devuelve Set de nombres ya en librería */ }
async function attachSingleImage(name, mode, slotIndex) { /* abre picker, busca, click */ }
async function waitForSearchResult(name, timeoutMs) { /* polling querySelector img[alt] */ }
async function waitForPickerClose(timeoutMs) { /* polling dialog data-state */ }
function closePickerWithEscape() { /* KeyboardEvent Escape */ }
function base64ToFile(data, name, mimeType) { /* Uint8Array → File */ }
function getTriggerElement(mode, slotIndex) { /* XPath para add_2 o frames Start/End */ }
```

**Reglas:**
- Verifica `getState().isProcessing` antes de cada operación larga.
- Stealth mode altera delays con factor aleatorio (0.7–1.3x).

---

### 10. `src/content/errorScanner.js`

**Responsabilidad:** Detectar errores en tiles generados (policy violation, queue full, daily limit, generation failed).

**Dependencias:** `domUtils.js`, `constants.js`

**API a exportar (sin estado, sin init):**

```js
// Patrones de error de tile
export const TILE_ERROR_PATTERNS = [ /* array de { type, label, detect(tileEl) } */ ];

// Escanea tiles nuevos en busca de errores
export function scanTileErrors(preSubmitIds, processedTileIds) {
  // Retorna { errorCount, errors: [{ tileId, type, label }] }
}

// Verifica errores globales (no de tile específico)
export function checkGlobalErrors() {
  // Retorna { found, type, label, severity }
}

// Utilidad: ¿tiene elemento un icono con texto?
export function hasIcon(element, iconText) { /* querySelectorAll i */ }
```

**Reglas:**
- Sin efectos secundarios.
- `GLOBAL_ERROR_PATTERNS` es un array vacío en la versión actual — mantener la estructura para extensibilidad futura.

---

### 11. `src/content/monitoring.js`

**Responsabilidad:** Escaneo periódico de tiles completados, descarga automática, monitoreo de errores.

**Dependencias:** `domUtils.js`, `constants.js`, `errorScanner.js`, `eventBus.js`

**Inicialización:**

```js
export function init({ getState, setState, getSelectors, eventBus, stateManager }) {
  // Registra listener PROCESSING_TERMINATE para limpiar
}
```

**API a exportar:**

```js
export function snapshotExistingTileIds() { /* Set de data-tile-id actuales */ }
export function scanForNewlyCompletedTiles(preSubmitIds) { /* retorna array de {tileId, tileEl, isVideo} */ }
export function isTileCompleted(tileEl) { /* video o img con media.getMediaUrlRedirect */ }
export function isTileVideo(tileEl) { /* contiene video */ }
export function startTileScanner() { /* setInterval → periodicTileScanner() */ }
export function stopTileScanner() { /* clearInterval */ }
export function startErrorMonitoring() { /* setInterval → checkPolicyErrors */ }
export function stopErrorMonitoring() { /* clearInterval */ }
export async function downloadTileViaUI(tileEl, targetQuality) { /* context menu → download */ }
export async function checkForErrorsAfterSubmit() { /* 2s wait + 10 polling → "QUEUE_FULL" | "POLICY_PROMPT" | null */ }
export function checkForQueueFull() { /* XPath QUEUE_FULL_POPUP */ }
export function checkForPromptPolicyError() { /* XPath PROMPT_POLICY_ERROR_POPUP */ }
export function resetDownloadQueue() { /* vacía cola interna de descarga */ }
export async function periodicTileScanner() { /* lógica principal de escaneo + stall timeouts */ }
```

**Reglas:**
- La cola interna de descarga (`downloadQueue`) es privada al módulo.
- Emite eventos vía `eventBus` — no llama directamente a otros módulos.
- `periodicTileScanner` es la función más compleja — mantener toda la lógica de stall/timeout/error intacta.

---

### 12. `src/content/taskRunner.js`

**Responsabilidad:** Ejecutar una tarea individual completa (settings → upload → text → submit → monitor).

**Dependencias:** `eventBus.js`, `constants.js`, `settingsApplicator.js`, `imageUploader.js`, `textInjector.js`, `submitHandler.js`, `monitoring.js`

**Inicialización:**

```js
export function init({ getState, setState, eventBus, monitoring, stateManager }) {
  // Registra listener DAILY_LIMIT_FALLBACK
}
```

**API a exportar:**

```js
export async function runTask(task, taskIndex) {
  // Paso 0: applyUnifiedSettings
  // Paso 1.5 (si tiene referenceImages): clearReferences + uploadAllImages + attachAllImages
  // Paso 2: injectText
  // Paso 3: clickSubmit
  // Paso 4: checkForErrorsAfterSubmit + startTileScanner + startErrorMonitoring
}
```

**Reglas:**
- Cada paso verifica `getState().isProcessing` antes de continuar.
- Si un paso falla, emite `EVENTS.TASK_ERROR` con la razón y retorna.
- El handler de `DAILY_LIMIT_FALLBACK` modifica el modelo de tareas pendientes y reencola la tarea actual.

---

### 13. `src/content/queueController.js`

**Responsabilidad:** Controlar el flujo de la cola: avanzar al siguiente prompt, manejar pausas, delays inter-tarea, reintentos.

**Dependencias:** `eventBus.js`, `constants.js`, `taskRunner.js`, `monitoring.js`

**Inicialización:**

```js
export function init({ stateManager, eventBus, monitoring }) {
  // Registra listeners:
  // QUEUE_NEXT → processNextTask()
  // TASK_START → onTaskStart()
  // TASK_COMPLETED → onTaskCompleted()
  // TASK_SKIPPED → onTaskSkipped()
  // TASK_ERROR → onTaskError()
  // PROCESSING_STOP → cancelInterTaskDelay()
  // PROCESSING_TERMINATE → cancelInterTaskDelay()
}
```

**Funciones privadas (no exportar):**

```js
function processNextTask() { /* verifica isProcessing, quota, llama runTask */ }
async function onTaskCompleted({ task, taskIndex }) { /* stopScanners, updateProgress, startInterTaskDelay */ }
function onTaskSkipped({ task, taskIndex }) { /* igual que completed */ }
function onTaskError({ task, taskIndex, reason }) { /* reintento o marcar error */ }
function onTaskStart({ task }) { /* envía taskStatusUpdate:current al background */ }
function retryOrFail() { /* currentRetries < MAX_RETRIES → retry, sino → fail */ }
function cancelInterTaskDelay() { /* clearTimeout interTaskTimer */ }
function updateProgressBroadcast() { /* chrome.runtime.sendMessage updateProgress */ }
function runCurrentTask() { /* llama taskRunner.runTask con tarea actual */ }
```

**Reglas:**
- El timer de delay inter-tarea es privado al módulo.
- Verifica `autoClearCache` milestone y envía `clearFlowCache` si corresponde.
- Cuando `currentPromptIndex >= total` emite `PROCESSING_COMPLETE` y limpia storage.

---

### 14. `src/content/overlayManager.js`

**Responsabilidad:** Gestión completa del overlay visual (HTML/CSS inyectado en la página).

**Dependencias:** `eventBus.js`

**Inicialización:**

```js
export function init(stateManager, eventBus) {
  // Registra listeners: OVERLAY_SHOW, OVERLAY_HIDE, OVERLAY_MESSAGE,
  // OVERLAY_PAUSING, OVERLAY_ERROR_BANNER, OVERLAY_ERROR_BANNER_CLEAR,
  // COUNTDOWN_START, PROGRESS_UPDATE
}
```

**API a exportar:**

```js
export function showOverlay(message) { /* crea DOM del overlay */ }
export function hideOverlay() { /* limpia timer + remueve DOM */ }
export function updateMessage(text, progressIndex) { /* actualiza texto y barra */ }
export function showPausingState() { /* reemplaza botón Pause por Pausing... */ }
export function showErrorBanner({ lines, taskIndex }) { /* banner naranja con lista de errores */ }
export function clearErrorBanner() { /* remueve banner */ }
```

**Reglas:**
- Todo el CSS del overlay se inyecta en un `<style>` con id `labs-flow-overlay-styles` (solo una vez).
- Los botones del overlay (`Pause`, `Terminate`) envían mensajes al background, no a funciones directas.
- Sin dependencias de otros módulos salvo `eventBus`.

---

### 15. `src/content/contentDownloadManager.js`

**Responsabilidad:** Panel de descarga manual de tiles (Content Download Manager).

**Dependencias:** `domUtils.js`, `eventBus.js`

**API a exportar:**

```js
export function activate() { /* crea UI, observer, etc. */ }
export function deactivate() { /* limpia todo */ }
export function toggle() { /* activa o desactiva según estado */ }
export function isActive() { /* boolean */ }
```

**Reglas:**
- Todo el CSS del panel se inyecta una sola vez con id `cdm-styles`.
- El panel es arrastrable y redimensionable — mantener la lógica de drag/resize.
- La descarga es secuencial — mantener la cola interna.
- Dark mode se sincroniza con `chrome.storage.onChanged`.

---

### 16. `src/content/index.js`

**Responsabilidad:** Punto de entrada del content script. Importa todos los módulos, los inicializa en orden correcto, registra el listener principal de mensajes Chrome.

**Dependencias:** Todos los módulos anteriores.

```js
import { EVENTS, on as busOn, emit as busEmit } from "./eventBus.js";
import * as state from "./stateManager.js";
import * as textInjector from "./textInjector.js";
import * as submitHandler from "./submitHandler.js";
import * as settingsApplicator from "./settingsApplicator.js";
import * as imageUploader from "./imageUploader.js";
import * as monitoring from "./monitoring.js";
import * as taskRunner from "./taskRunner.js";
import * as queueController from "./queueController.js";
import * as overlayManager from "./overlayManager.js";
import * as cdm from "./contentDownloadManager.js";
import { SELECTORS } from "./constants.js";
import { createEventBus } from "./eventBus.js";

// 1. Crear instancia del bus
const eventBus = createEventBus(); // o importar el singleton

// 2. Inicializar módulos en orden de dependencia (de menor a mayor)
textInjector.init(state.getState);
submitHandler.init(state.getState);
settingsApplicator.init(state.getState, state.setState);
imageUploader.init(state.getState);

monitoring.init({
  getState: state.getState,
  setState: state.setState,
  getSelectors: () => SELECTORS,
  eventBus,
  stateManager: state,
});

taskRunner.init({
  getState: state.getState,
  setState: state.setState,
  eventBus,
  monitoring,
  stateManager: state,
});

queueController.init({
  stateManager: state,
  eventBus,
  monitoring,
});

overlayManager.init(state, eventBus);
state.init(eventBus, cdm);

// 3. Registrar listener de mensajes Chrome (ÚNICO punto de entrada de mensajes)
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  const ack = { received: true };

  switch (message.action) {
    case "startProcessing":
      // lógica de startProcessing (verificar auth, inicializar taskList, emit QUEUE_NEXT)
      return true;

    case "resumeProcessing":
      // restaurar estado pausado
      return true;

    case "resumeAfterCacheClean":
      // restaurar estado y continuar
      return true;

    case "stopProcessing":
      // emitir PROCESSING_STOP
      sendResponse(ack);
      break;

    case "terminateProcessing":
      // limpiar todo, emitir PROCESSING_TERMINATE
      sendResponse({ ...ack, terminated: true });
      break;

    case "getStoredState":
      state.loadStateFromStorage().then(s => sendResponse({ ...ack, state: s }));
      return true;

    case "authStateChanged":
      // actualizar auth en state
      sendResponse({ success: true });
      break;

    case "activateContentDownloader":
      cdm.toggle();
      sendResponse({ ...ack, toggled: true });
      break;

    case "clickNewProjectButton":
      // buscar botón add_2 y hacer click
      return true;

    case "pingFlowContent":
      sendResponse({ pong: true });
      break;

    default:
      sendResponse(ack);
  }
});

// 4. Listeners de visibilidad y foco para re-verificar auth
document.addEventListener("visibilitychange", () => { /* ... */ });
window.addEventListener("focus", () => { /* ... */ });

// 5. Notificar al background que el content script está listo
chrome.runtime.sendMessage({ action: "getAuthState" }, (res) => {
  if (res) {
    state.setState({ isUserLoggedIn: res.isLoggedIn, subscriptionStatus: res.subscriptionStatus });
  }
});

console.log("✅ Flow Automation bootstrap complete — all modules wired");
```

---

## Configuración de Vite

Actualizar `vite.config.js` (o equivalente) para incluir el nuevo entry point:

```js
// vite.config.js
export default {
  build: {
    rollupOptions: {
      input: {
        main: "src/index.html",
        taskManager: "src/task-manager.html",
        background: "background.js",         // si ya existe como entry
        flowContent: "src/content/index.js", // NUEVO
      },
      output: {
        // El bundle del content script debe ir a la raíz
        entryFileNames: (chunk) => {
          if (chunk.name === "flowContent") return "flowContentScript.js";
          return "[name].js";
        },
        // Sin chunks dinámicos para el content script
        manualChunks: undefined,
      },
    },
  },
};
```

**Importante:** El content script debe ser un **bundle IIFE o ESM sin dynamic imports** porque no puede cargar chunks separados desde `chrome-extension://` URLs sin declararlo en `web_accessible_resources`.

---

## `manifest.json` — sin cambios necesarios

```json
"content_scripts": [{
  "js": ["flowContentScript.js"],
  "matches": ["https://labs.google/fx/tools/flow/*", "https://labs.google/fx/*/tools/flow/*"],
  "run_at": "document_idle"
}]
```

El nombre del archivo de salida se mantiene igual gracias a la configuración de Vite.

---

## Plan de ejecución paso a paso

### Fase 1 — Preparación (sin romper nada)
1. Crear la carpeta `src/content/`.
2. Actualizar `vite.config.js` con el nuevo entry point.
3. Crear `src/content/index.js` vacío que solo importa y re-exporta el bundle actual compilado. Verificar que el build funcione.

### Fase 2 — Extraer módulos sin estado (en orden)
4. Crear `src/content/constants.js` — copiar todas las constantes.
5. Crear `src/content/domUtils.js` — copiar `h`, `$`, `waitForElement`, `re`, `centerOf`.
6. Crear `src/content/eventBus.js` — copiar el EventBus actual completo + `EVENTS`.
7. Crear `src/content/clickHelper.js` — copiar `ht`, `Vn`, `Ue`, `qn` (stealth click).
8. Crear `src/content/errorScanner.js` — copiar `TILE_ERROR_PATTERNS`, `scanTileErrors`, `checkGlobalErrors`, `hasIcon`.
9. **Verificar build** — el bundle resultante debe ser funcionalmente idéntico al original.

### Fase 3 — Extraer módulos con estado simple
10. Crear `src/content/textInjector.js`.
11. Crear `src/content/submitHandler.js`.
12. Crear `src/content/settingsApplicator.js`.
13. Crear `src/content/imageUploader.js`.
14. **Verificar build + test manual** en Flow.

### Fase 4 — Extraer módulos orquestadores
15. Crear `src/content/stateManager.js` — el módulo más crítico.
16. Crear `src/content/monitoring.js`.
17. Crear `src/content/taskRunner.js`.
18. Crear `src/content/queueController.js`.
19. **Verificar build + test manual** completo (start → process → download).

### Fase 5 — Extraer UI
20. Crear `src/content/overlayManager.js`.
21. Crear `src/content/contentDownloadManager.js`.
22. **Verificar build + test manual** del overlay y CDM.

### Fase 6 — Conectar todo
23. Escribir `src/content/index.js` completo.
24. Eliminar el `flowContentScript.js` fuente original (el de src, no el de salida).
25. Build final + verificación completa.

---

## Tests de verificación por módulo

Después de cada fase, verificar manualmente en `https://labs.google/fx/tools/flow/`:

| Test | Qué verificar |
|------|---------------|
| Content script carga | `✅ Flow Automation bootstrap complete` en consola |
| Estado se persiste | Pausar → recargar → botón Resume disponible |
| Stealth mode OFF | El texto aparece instantáneamente en el editor |
| Stealth mode ON | El texto aparece letra por letra con delays |
| Settings apply | Panel de control abre y selecciona modelo/ratio/count correcto |
| Image upload | Imágenes se adjuntan correctamente en modo frames/ingredients/paired |
| Tile detection | Videos/imágenes generados son detectados y descargados |
| Error handling | Policy violation y queue full son detectados y gestionados |
| Overlay | Aparece con progreso correcto, Pause funciona |
| CDM | Panel aparece, selección y descarga masiva funcionan |
| Daily limit fallback | Detecta límite Nano Banana y cambia a Imagen 4 |

---

## Consideraciones de compatibilidad

### Variable `executeInMainWorld`
Varios módulos usan `chrome.runtime.sendMessage({ action: "executeInMainWorld" })` para ejecutar código en el mundo principal. Esta función debe estar disponible antes de que cualquier módulo la use. Se inicializa en `index.js` y se pasa a los módulos que la necesitan, **o** cada módulo la llama directamente al runtime (lo más simple).

### Función `$e()` — "is processing stopped?"
En el código original hay una función inline `$e()` que verifica si el procesamiento se detuvo. En los módulos refactorizados esto debe ser:

```js
function isProcessingStopped() {
  const s = getState();
  return !s.isProcessing && !s.isPausing;
}
```

Cada módulo que necesite esta verificación debe implementarla localmente o recibirla como parámetro.

### Singleton vs instancia
El `eventBus` debe ser un **singleton compartido**. La forma más simple es:

```js
// src/content/eventBus.js
const _listeners = new Map();
export function on(...) { /* usa _listeners */ }
// etc.
```

Sin necesidad de `createEventBus()` — el módulo es el singleton.

---

## Errores comunes a evitar

1. **Importaciones circulares** — `stateManager` no debe importar `taskRunner`. El flujo de dependencias es estrictamente unidireccional: `constants → domUtils → eventBus → clickHelper/errorScanner → textInjector/submitHandler/settingsApplicator/imageUploader → monitoring → taskRunner → queueController → overlayManager/CDM → index`.

2. **Dynamic imports** — No usar `import()` dinámicos. El content script debe ser un bundle estático.

3. **`window` globals** — El código original usa `window.__flowSlateEditor` para comunicar entre llamadas. Mantener este patrón solo en código que se ejecuta en MAIN world vía `executeInMainWorld`.

4. **Múltiples listeners de mensajes** — Solo `index.js` debe llamar a `chrome.runtime.onMessage.addListener`. Los módulos internos nunca deben registrar sus propios listeners de mensajes Chrome.

5. **CSS de overlay duplicado** — Verificar que los `<style>` del overlay y del CDM solo se inyecten una vez (guardar flag booleano en el módulo).

---

## Resultado esperado

- **Antes:** 1 archivo de ~4,500 líneas imposible de mantener.
- **Después:** 16 archivos de 50–300 líneas cada uno, con responsabilidades claras.
- **Comportamiento:** 100% idéntico al original.
- **Bundle de salida:** Un único `flowContentScript.js` generado por Vite, igual que antes.
- **DX:** Cada módulo se puede leer, testear y modificar de forma independiente.
