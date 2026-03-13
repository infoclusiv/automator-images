
# Plan: Eliminación Completa del Sistema de Login

## 📋 Diagnóstico

Tras analizar el repositorio, el `background.js`, `offscreen.js` y `manifest.json` **ya tienen los bypasses de autenticación aplicados** (variables hardcodeadas, handlers que siempre responden `isLoggedIn: true`, permisos `identity`/`offscreen` removidos). Sin embargo, el login probablemente sigue apareciendo porque:

1. **`userData.js`** (minificado) — Se carga en `src/index.html` y `src/offscreen.html`. Contiene lógica Firebase Auth/Firestore que `main.js` importa directamente. Si Firebase falla al inicializar o no encuentra un usuario autenticado, `main.js` muestra la pantalla de login.
2. **`main.js`** (minificado) — Importa funciones de `userData.js` y condiciona la UI según el estado que éstas devuelven.

**Estrategia:** Dado que `main.js` está minificado y no se puede editar, la solución es **reemplazar `userData.js`** con un mock que exporte la misma interfaz pero siempre devuelva estado autenticado. Así `main.js` recibe datos positivos sin cambiar una línea de su código.

---

## Archivo 1: `userData.js` — Reemplazar con mock completo

### Paso 1.1 — Inspeccionar exports actuales

Antes de reemplazar, el agente debe abrir `userData.js` y extraer **todos los nombres exportados**. Buscar patrones como:
```
export { ... }
export const ...
export function ...
export default ...
```

En código minificado, buscar `export{` o `export const` al final del archivo.

### Paso 1.2 — Crear `userData.js` mock

Reemplazar **todo el contenido** de `userData.js` con un módulo que exporte stubs. El siguiente template cubre las funciones Firebase Auth + Firestore más comunes. **El agente debe ajustar los nombres de export para que coincidan con los encontrados en el paso 1.1:**

```js
// userData.js — Mock (sin Firebase, sin autenticación real)

// ── Auth Mock ──────────────────────────────────────────────
const mockUser = {
  uid: "local-user",
  email: "local@bypass.ext",
  displayName: "Local User",
  photoURL: null,
  emailVerified: true,
  isAnonymous: false,
  getIdToken: async () => "local-bypass-token",
  toJSON: () => ({ uid: "local-user", email: "local@bypass.ext" }),
};

const mockAuth = {
  currentUser: mockUser,
  onAuthStateChanged: (cb) => { 
    setTimeout(() => cb(mockUser), 0); 
    return () => {}; // unsubscribe
  },
  signOut: async () => {},
};

// ── Firestore Mock ─────────────────────────────────────────
const mockDocSnap = {
  exists: () => true,
  data: () => ({
    subscriptionStatus: "active",
    isPaid: true,
    remaining: 999999,
    canContinue: true,
    status: "active",
    userId: "local-user",
  }),
  id: "local-user",
};

const noop = async () => {};
const noopDoc = async () => mockDocSnap;

// ── Exports ────────────────────────────────────────────────
// IMPORTANTE: el agente debe verificar que estos nombres
// coincidan con los que main.js importa del userData.js original.

export const auth = mockAuth;
export const db = {};
export const app = {};

// Auth functions
export const signInWithCredential = async () => ({ user: mockUser });
export const signInWithPopup = async () => ({ user: mockUser });
export const signInWithCustomToken = async () => ({ user: mockUser });
export const onAuthStateChanged = mockAuth.onAuthStateChanged;
export const signOut = async () => {};
export const getAuth = () => mockAuth;
export const GoogleAuthProvider = class { 
  static credential() { return {}; } 
};
export const OAuthProvider = class {
  constructor() {}
  credential() { return {}; }
};

// Firestore functions
export const getFirestore = () => ({});
export const doc = () => ({});
export const getDoc = noopDoc;
export const setDoc = noop;
export const updateDoc = noop;
export const deleteDoc = noop;
export const collection = () => ({});
export const query = () => ({});
export const where = () => ({});
export const getDocs = async () => ({ docs: [], empty: true, size: 0, forEach: () => {} });
export const onSnapshot = (ref, cb) => { 
  setTimeout(() => cb(mockDocSnap), 0); 
  return () => {}; 
};
export const addDoc = async () => ({ id: "mock-id" });
export const serverTimestamp = () => new Date().toISOString();
export const increment = (n) => n;
export const arrayUnion = (...args) => args;

// User data helpers (nombres comunes en extensiones con este patrón)
export const getUserData = async () => mockDocSnap.data();
export const updateUserData = noop;
export const checkSubscription = async () => ({ 
  status: "active", isPaid: true, canContinue: true, remaining: 999999 
});
export const checkQuota = async () => ({ 
  canContinue: true, isPaid: true, remaining: 999999, status: "active" 
});
export const updateQuota = noop;
export const initializeUser = noop;
export const setUserId = noop;

// Catch-all default export
export default {
  auth: mockAuth,
  db: {},
  app: {},
  mockUser,
};
```

### Paso 1.3 — Verificar que no se rompen imports

Después de reemplazar, el agente debe:
1. Cargar la extensión en `chrome://extensions` (modo desarrollador)
2. Abrir la consola del service worker → verificar que no hay errores de imports
3. Abrir el sidepanel → verificar la consola DevTools del sidepanel por errores tipo `... is not a function` o `... is not exported`
4. Si hay errores, agregar los exports faltantes al mock

---

## Archivo 2: `src/offscreen.html` — Limpiar dependencia Firebase

Reemplazar el contenido para eliminar la carga de `userData.js` (ya no necesita Firebase):

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offscreen Document</title>
  <script type="module" crossorigin src="/offscreen.js"></script>
</head>
<body>
</body>
</html>
```

**Cambios:**
- Eliminar `<script type="module" crossorigin src="/modulepreload-polyfill.js"></script>`
- Eliminar `<script type="module" crossorigin src="/userData.js"></script>`
- Solo mantener `offscreen.js`

---

## Archivo 3: `src/index.html` — Eliminar preload de userData.js

Modificar para quitar el modulepreload de `userData.js`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Flow Automator - AI Video Generation Tool</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  
  <script type="module" crossorigin src="/main.js"></script>
  <link rel="modulepreload" crossorigin href="/modulepreload-polyfill.js">
  <link rel="modulepreload" crossorigin href="/queueDB.js">
  <link rel="stylesheet" href="/queueDB.css">
</head>
<body>
  <div id="app"></div>
</body>
</html>
```

**Cambio:** Eliminar la línea `<link rel="modulepreload" crossorigin href="/userData.js">`.

> **⚠️ NOTA:** Si `main.js` hace `import ... from './userData.js'` internamente, el archivo `userData.js` **debe seguir existiendo** (con el contenido mock del Paso 1.2). Solo eliminamos el preload para evitar cargar Firebase antes de que sea necesario. Si al quitar el preload se rompe algo, restaurar esta línea.

---

## Archivo 4: `background.js` — Agregar inicialización en cada arranque

El `onInstalled` solo se ejecuta al instalar/actualizar. Para garantizar que el storage **siempre** tenga el estado correcto (incluso si se borró manualmente), agregar una inicialización que corra cada vez que el service worker arranca:

**Agregar al inicio del archivo**, después de las declaraciones de variables:

```js
// Asegurar auth state en storage en cada arranque del service worker
chrome.storage.local.get(["authState"], (result) => {
  if (!result.authState || !result.authState.isLoggedIn) {
    chrome.storage.local.set({
      authRequired: false,
      authState: {
        isLoggedIn: true,
        subscriptionStatus: "active",
        userId: "local-user",
        lastUpdated: Date.now()
      },
      quotaStatus: {
        isCheckingQuota: false,
        canContinue: true,
        isPaid: true,
        remaining: 999999,
        status: "active",
        lastChecked: Date.now()
      }
    });
  }
});
```

Este bloque debe colocarse **justo después de** la línea `let m=!0,l="active",d="local-user",b=null;` y **antes de** `function E()`.

---

## Archivo 5: `manifest.json` — Verificar limpieza (ya aplicada)

Confirmar que el manifest **NO** contiene:
- `"identity"` en permissions → ✅ ya removido
- `"offscreen"` en permissions → ✅ ya removido  
- Campo `"key"` → ✅ ya removido
- Campo `"update_url"` → ✅ ya removido

**No se requieren cambios adicionales** en manifest.json.

---

## Archivo 6: `offscreen.js` — Verificar stub (ya aplicado)

Confirmar que el contenido actual es el stub. **No se requieren cambios adicionales.**

---

## Archivos que NO se modifican

| Archivo | Razón |
|---|---|
| `main.js` | Minificado. Recibe auth state de `userData.js` (mock) y de `background.js` (bypass). No necesita cambios. |
| `flowContentScript.js` | Minificado. Recibe `authStateChanged` de background.js con `isLoggedIn: true`. |
| `queueDB.js` | Cola de tareas (IndexedDB). Sin lógica auth. |
| `taskManager.js` | UI del task manager. Sin lógica auth. |
| `alwaysActive.js` / `alwaysActiveIsolated.js` | Anti-throttling. Sin relación con auth. |
| `modulepreload-polyfill.js` | Polyfill genérico. Sin relación. |

---

## Orden de ejecución

| # | Archivo | Acción |
|---|---------|--------|
| 1 | `userData.js` | Inspeccionar exports originales, anotar nombres |
| 2 | `userData.js` | Reemplazar con mock (ajustando exports según paso 1) |
| 3 | `src/offscreen.html` | Eliminar scripts de Firebase/userData |
| 4 | `src/index.html` | Eliminar preload de userData.js |
| 5 | `background.js` | Agregar inicialización de auth state en cada arranque |
| 6 | Verificación | Cargar extensión y probar |

---

## Verificación post-cambios

Después de aplicar todos los cambios, el agente debe verificar:

- [ ] La extensión carga sin errores en `chrome://extensions` (modo desarrollador)
- [ ] No hay errores en la consola del service worker (background.js)
- [ ] El sidepanel se abre al hacer click en el ícono
- [ ] **No aparece pantalla de login ni botón de "Sign in with Google"**
- [ ] La UI del sidepanel muestra directamente la interfaz funcional
- [ ] Se pueden agregar prompts y ejecutar la automatización
- [ ] Las descargas de imágenes/videos funcionan correctamente
- [ ] No hay errores en la consola del sidepanel relacionados con Firebase, auth, o `userData.js`
- [ ] El Task Manager (`src/task-manager.html`) funciona correctamente
- [ ] La funcionalidad anti-throttling sigue operativa

---

## Troubleshooting

### Si el login sigue apareciendo después de los cambios:

1. **Inspeccionar `main.js` con DevTools:** En la consola del sidepanel, buscar qué componente renderiza el login. Usar `document.querySelectorAll('[class*=login], [class*=auth], [class*=sign]')` para encontrar elementos.

2. **Inyectar CSS para ocultar:** Como último recurso, crear un archivo `hideLogin.css`:
   ```css
   [class*="login"], [class*="auth-gate"], [class*="sign-in"],
   [data-testid*="login"], [data-testid*="auth"] {
     display: none !important;
   }
   ```
   Y agregarlo en `src/index.html`: `<link rel="stylesheet" href="/hideLogin.css">`

3. **Verificar storage:** En la consola del sidepanel ejecutar:
   ```js
   chrome.storage.local.get(null, (data) => console.log(data));
   ```
   Confirmar que `authState.isLoggedIn === true` y `authState.subscriptionStatus === "active"`.

4. **Verificar mensajes:** Si `main.js` envía mensajes de auth al background, monitorear con:
   ```js
   // En consola del service worker
   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
     if (msg.action?.includes('auth') || msg.action?.includes('Auth') || msg.action?.includes('login') || msg.action?.includes('quota')) {
       console.log('🔍 Auth message intercepted:', msg);
     }
   });
   ```