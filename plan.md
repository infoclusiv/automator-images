# plan.md — Remover Autenticación y Quota Tracking

## Objetivo
Eliminar toda la lógica de autenticación (Google OAuth, Firebase Auth) y el seguimiento de cuotas (quota tracking via Firestore) de la extensión, manteniendo toda la funcionalidad operativa. La estrategia es modificar **solo los archivos legibles** (`background.js`, `offscreen.js`, `manifest.json`) ya que `main.js`, `flowContentScript.js`, `queueDB.js` y `userData.js` están minificados/bundleados y no se pueden editar directamente. Esos archivos se comunican con `background.js` vía mensajes, así que si `background.js` siempre responde como "autenticado + suscripción activa + sin límites", la app funcionará sin restricciones.

---

## Archivo 1: `background.js`

### 1.1 — Inicializar variables de estado como siempre autenticado

Cambiar las declaraciones iniciales:

```js
// ANTES
let m=!1,l=null,d=null,b=null;

// DESPUÉS
let m=!0,l="active",d="local-user",b=null;
```

### 1.2 — Eliminar función `L()` (creación de offscreen document)

Eliminar completamente la función `L()` que crea el offscreen document para Firebase:

```js
// ELIMINAR TODA ESTA FUNCIÓN:
async function L(){(await chrome.runtime.getContexts({contextTypes:["OFFSCREEN_DOCUMENT"],documentUrls:[chrome.runtime.getURL("src/offscreen.html")]})).length>0||(b?await b:(b=chrome.offscreen.createDocument({url:"src/offscreen.html",reasons:["WORKERS"],justification:"Handle Firebase Firestore operations for quota tracking when sidepanel is closed"}),await b,b=null))}
```

### 1.3 — Eliminar función `P()` (mensajería con offscreen document)

Eliminar completamente la función `P()`:

```js
// ELIMINAR TODA ESTA FUNCIÓN:
async function P(e){return await L(),new Promise((o,t)=>{chrome.runtime.sendMessage(e,s=>{chrome.runtime.lastError?t(chrome.runtime.lastError):o(s)})})}
```

### 1.4 — Eliminar bloque de carga de authState desde storage

Eliminar el bloque que lee `authState` del storage al inicio (ya no es necesario porque siempre estamos "logueados"):

```js
// ELIMINAR ESTE BLOQUE:
chrome.storage.local.get(["authState"],e=>{e.authState&&(m=e.authState.isLoggedIn||!1,l=e.authState.subscriptionStatus||null,d=e.authState.userId||null,setTimeout(()=>{v()},1e3))});
```

### 1.5 — Simplificar función `E()` (guardar authState en storage)

Reemplazar para que siempre guarde estado autenticado:

```js
// ANTES
function E(){const e={isLoggedIn:m,subscriptionStatus:l,userId:d,lastUpdated:Date.now()};chrome.storage.local.set({authState:e},()=>{})}

// DESPUÉS
function E(){const e={isLoggedIn:!0,subscriptionStatus:"active",userId:"local-user",lastUpdated:Date.now()};chrome.storage.local.set({authState:e},()=>{})}
```

### 1.6 — Modificar `onInstalled` listener

Cambiar `authRequired` a `false` y establecer quotaStatus como siempre permitido:

```js
// ANTES
chrome.runtime.onInstalled.addListener(e=>{if(chrome.storage.local.set({autoUpscale:!1,autoDownload:!0,delayBetweenPrompts:5,authRequired:!0,quotaStatus:{isCheckingQuota:!1,canContinue:!0,lastChecked:Date.now()}}), ...

// DESPUÉS
chrome.runtime.onInstalled.addListener(e=>{if(chrome.storage.local.set({autoUpscale:!1,autoDownload:!0,delayBetweenPrompts:5,authRequired:!1,authState:{isLoggedIn:!0,subscriptionStatus:"active",userId:"local-user",lastUpdated:Date.now()},quotaStatus:{isCheckingQuota:!1,canContinue:!0,isPaid:!0,remaining:999999,status:"active",lastChecked:Date.now()}}), ...
```

(Mantener el resto del listener igual — la parte que abre la URL en `install`.)

### 1.7 — Eliminar variable `p` (contador de procesados para quota)

```js
// ELIMINAR:
let p=0;
```

### 1.8 — Modificar handler `updateProgress`

Eliminar toda la lógica de quota tracking. Solo responder con éxito:

```js
// ANTES
if(e.action==="updateProgress"){const r=p,a=e.processed-r;return a>0&&d&&(p=e.processed,P({action:"updateQuota",userId:d,newlyProcessed:a}).then(n=>{n.success&&chrome.runtime.sendMessage({action:"quotaUpdated",quotaData:n.quotaData}).catch(()=>{})}).catch(n=>{})),t({received:!0}),!0}

// DESPUÉS
if(e.action==="updateProgress"){return t({received:!0}),!0}
```

### 1.9 — Modificar handler `signInWithGoogle`

Reemplazar toda la lógica de OAuth por una respuesta exitosa inmediata con un token falso:

```js
// ANTES (todo el bloque de signInWithGoogle con chrome.identity.launchWebAuthFlow)

// DESPUÉS
if(e.action==="signInWithGoogle"){return t({success:!0,token:"local-bypass-token"}),!0}
```

### 1.10 — Modificar handler `getAuthState`

Siempre devolver estado autenticado con suscripción activa:

```js
// ANTES
else if(e.action==="getAuthState"){const r={isLoggedIn:m,subscriptionStatus:l,userId:d,timestamp:Date.now()};return t(r),!0}

// DESPUÉS
else if(e.action==="getAuthState"){const r={isLoggedIn:!0,subscriptionStatus:"active",userId:"local-user",timestamp:Date.now()};return t(r),!0}
```

### 1.11 — Modificar handler `authStateChanged`

Simplificar para que solo responda con éxito sin modificar estado (ya es siempre activo):

```js
// ANTES (bloque completo de authStateChanged con lógica de userId, subscriptionStatus, etc.)

// DESPUÉS
else if(e.action==="authStateChanged"){return E(),t({success:!0}),!0}
```

### 1.12 — Mantener handler `authStateRefreshed` sin cambios

```js
// Este se queda igual:
if(e.action==="authStateRefreshed")return t({received:!0}),!0;
```

### 1.13 — Modificar handler `getQuotaStatus`

Siempre devolver cuota ilimitada:

```js
// ANTES
if(e.action==="getQuotaStatus")return chrome.storage.local.get("quotaStatus",r=>{const a={canContinue:!0,isPaid:l==="active",status:"unknown"},n=r.quotaStatus||a;l==="active"&&(n.isPaid=!0,n.canContinue=!0),t(n)}),!0;

// DESPUÉS
if(e.action==="getQuotaStatus")return t({canContinue:!0,isPaid:!0,remaining:999999,status:"active",lastChecked:Date.now()}),!0;
```

### 1.14 — Modificar handler `updateQuotaStatus`

Simplificar a solo confirmar sin guardar nada:

```js
// ANTES
if(e.action==="updateQuotaStatus"){const r={...e.quotaStatus,lastChecked:Date.now(),isPaid:l==="active"||e.quotaStatus.isPaid};return chrome.storage.local.set({quotaStatus:r},()=>{t({success:!0})}),!0}

// DESPUÉS
if(e.action==="updateQuotaStatus"){return t({success:!0}),!0}
```

### 1.15 — Modificar función `v()` (broadcast de authState a tabs)

Siempre emitir estado autenticado:

```js
// ANTES
function v(){const e={action:"authStateChanged",isLoggedIn:m,subscriptionStatus:l,userId:d,timestamp:Date.now()};...}

// DESPUÉS
function v(){const e={action:"authStateChanged",isLoggedIn:!0,subscriptionStatus:"active",userId:"local-user",timestamp:Date.now()};chrome.tabs.query({},o=>{o.forEach(t=>{t.url&&t.url.includes("labs.google")&&chrome.tabs.sendMessage(t.id,e).catch(s=>{})})})}
```

### 1.16 — Modificar listeners de `tabs.onActivated` y `windows.onFocusChanged`

Actualizar los mensajes de authState que envían para que siempre digan autenticado:

```js
// En tabs.onActivated, cambiar el mensaje enviado:
// isLoggedIn:m,subscriptionStatus:l,userId:d
// POR:
// isLoggedIn:!0,subscriptionStatus:"active",userId:"local-user"

// Lo mismo en windows.onFocusChanged
```

### 1.17 — Eliminar el `setInterval` de refresco de authState

Eliminar completamente el bloque:

```js
// ELIMINAR:
setInterval(()=>{chrome.storage.local.get(["authState"],e=>{if(e.authState){const o=e.authState;Date.now()-o.lastUpdated>10*60*1e3}})},5*60*1e3);
```

---

## Archivo 2: `offscreen.js`

Reemplazar todo el contenido con un stub mínimo que responde a cualquier mensaje con éxito. Esto es necesario por si algún código residual en `main.js` o `userData.js` intenta comunicarse:

```js
// REEMPLAZAR TODO EL CONTENIDO DE offscreen.js CON:
chrome.runtime.onMessage.addListener((e, i, s) => {
  if (e.action === "updateQuota") {
    s({ success: true, isPaid: true, quotaData: { canContinue: true, isPaid: true, status: "active", remaining: 999999 } });
    return true;
  }
  if (e.action === "setUserId") {
    s({ success: true });
    return true;
  }
  s({ success: true });
  return true;
});
```

---

## Archivo 3: `manifest.json`

### 3.1 — Eliminar permisos innecesarios

Eliminar `"identity"` y `"offscreen"` del array de permissions:

```json
// ANTES
"permissions": [ "activeTab", "storage", "sidePanel", "identity", "tabs", "scripting", "downloads", "offscreen" ]

// DESPUÉS
"permissions": [ "activeTab", "storage", "sidePanel", "tabs", "scripting", "downloads" ]
```

### 3.2 — Eliminar la key de firma

Eliminar el campo `"key"` del manifest (es la clave pública de la extensión en Chrome Web Store, no es necesaria para uso local):

```json
// ELIMINAR ESTA LÍNEA:
"key": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApy2ZmS4BzSNQ..."
```

### 3.3 — Eliminar `update_url`

Eliminar para evitar actualizaciones automáticas que revertirían los cambios:

```json
// ELIMINAR ESTA LÍNEA:
"update_url": "https://clients2.google.com/service/update2/crx"
```

---

## Archivos que NO se modifican

| Archivo | Razón |
|---|---|
| `main.js` | Minificado. Se comunica con background.js vía mensajes; al recibir siempre "autenticado + activo", no mostrará gates de login ni límites de cuota. |
| `flowContentScript.js` | Minificado. Recibe `authStateChanged` de background.js; siempre recibirá `isLoggedIn: true, subscriptionStatus: "active"`. |
| `queueDB.js` | Minificado. Maneja la cola de tareas (IndexedDB), no tiene lógica de auth/quota. |
| `userData.js` | Minificado. Módulo Firebase. Se cargará pero no será invocado para operaciones de auth/quota porque background.js ya no llama al offscreen document. Puede fallar silenciosamente sin afectar la app. |
| `taskManager.js` | Solo UI de gestión de tareas. No tiene lógica de auth/quota. |
| `alwaysActive.js` / `alwaysActiveIsolated.js` | Anti-throttling. Sin relación con auth. |
| `modulepreload-polyfill.js` | Polyfill genérico. Sin relación. |
| `src/index.html` | Carga main.js. El preload de userData.js es inofensivo. |
| `src/offscreen.html` | Mantener porque el código residual podría intentar crearlo. Con el offscreen.js stub, no hará nada dañino. |
| `src/task-manager.html` | Sin relación con auth. |

---

## Orden de ejecución

1. **`manifest.json`** — Remover permisos, key, y update_url
2. **`offscreen.js`** — Reemplazar con stub
3. **`background.js`** — Aplicar todos los cambios (1.1 a 1.17)

## Verificación post-cambios

Después de aplicar los cambios, verificar que:
- [ ] La extensión carga sin errores en `chrome://extensions` (modo desarrollador)
- [ ] El sidepanel se abre al hacer click en el ícono
- [ ] No aparece pantalla de login ni botón de "Sign in with Google"
- [ ] Se pueden agregar prompts y ejecutar la automatización
- [ ] No hay errores en la consola del service worker relacionados con `chrome.identity` o `chrome.offscreen`
- [ ] Las descargas de imágenes/videos funcionan correctamente
- [ ] El Task Manager (`src/task-manager.html`) funciona correctamente
```