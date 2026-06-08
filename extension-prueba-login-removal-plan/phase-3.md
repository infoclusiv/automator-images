# Phase 3 — Remove background and content-script extension-auth gates

## Objective
Remove hidden runtime blocks in `background.js` and `flowContentScript.js` that still require extension login even after the side panel UI no longer requires it.

## Expected behavior
Automation should be allowed to start without Firebase/Auth extension login. Runtime failures should be based on Google Flow readiness/session state, not extension auth state.

## Success criteria
- `flowContentScript.js` no longer blocks `startProcessing` because `getAuthState().isLoggedIn` is false.
- `background.js` no longer rejects `RUN_BATCH` because the internal auth variable is false.
- Existing message handlers remain backward-compatible enough that old calls do not throw.
- If the Google Flow tab is not signed in or session token is unavailable, the user sees a Flow-specific message such as “Open Google Flow and sign in, then refresh the Flow page.”
- Quota updates are skipped safely when there is no user ID.

## How to verify
1. Load the extension with no extension/Firebase login.
2. Open Google Flow and sign in on the website.
3. Open a Flow project.
4. Start a one-prompt batch.
5. Confirm no message appears saying “Authentication required. Please sign in first.”
6. Confirm `background.js` does not return `Not authenticated` for the run path.
7. Sign out of Google Flow or use a Flow tab without a session.
8. Try again and confirm the error refers to the Google Flow page/session, not the extension login.

## Observable failure signals
- `flowContentScript.js` returns an error before starting: “Authentication required. Please sign in first.”
- `background.js` returns `{ ok: false, error: "Not authenticated" }`.
- Batch progress event says “Authentication required. Please sign in first.”
- Quota update calls throw because `userId` is null.
- Existing download, zoom, cache-clear, or connection-check actions stop working.

## Files/components involved
Primary:

- `flowContentScript.js`
- `background.js`

Related:

- `offscreen.js`
- `src/offscreen.html`
- `userData.js`

Known relevant code paths:

- `flowContentScript.js`
  - `ht()` calls `chrome.runtime.sendMessage({ action: "getAuthState" })`.
  - `startProcessing` blocks when `!r.isLoggedIn`.
  - `authStateChanged` updates local auth flags.
- `background.js`
  - Maintains internal auth variables from `authState`.
  - Handles `RUN_BATCH` and currently blocks when not authenticated.
  - Handles `getAuthState`, `authStateChanged`, and broadcasts auth state to Flow tabs.
  - Updates quota through offscreen Firestore when a `userId` exists.
  - Uses Flow page tokens separately via code that reads `/fx/api/auth/session` in the Flow tab.

## Implementation notes
Implement the smallest runtime changes that make extension auth non-blocking.

Recommended changes:

- In `flowContentScript.js`:
  - Remove or bypass the pre-run `!isLoggedIn` block in `startProcessing`.
  - Keep Flow readiness/project checks intact.
  - Preserve `getAuthState` and `authStateChanged` listeners as no-ops/backward-compatible state updates if other paths still call them.
  - Replace extension-login error text with Google Flow-specific guidance.
- In `background.js`:
  - Make `RUN_BATCH` proceed without checking the extension auth variable.
  - Keep subscription-expired checks only if there is a real subscription state and product explicitly wants it; otherwise bypass them in no-extension-auth mode.
  - Make `getAuthState` return a non-blocking state, or keep returning real state but ensure no runtime path treats false as fatal.
  - Skip quota update calls when `userId` is missing.
  - Preserve all Flow token, reCAPTCHA, download, connection, zoom, and cache-clear logic.

Do not remove `chrome.identity` or Firebase files yet. That cleanup belongs to Phase 4.

## Preconditions before implementation
- Phases 1 and 2 are implemented and verified.
- Identify the exact start path used by the side panel after Phase 2.
- Confirm whether `RUN_BATCH` is still reachable. If it is unreachable, document that but still leave it non-blocking for safety if easy and localized.
- Confirm that Google Flow session token retrieval remains the actual auth check for Flow API calls.

## Stop conditions if the plan does not match the real codebase
Stop and report if:

- The code path cannot run without a user ID because task persistence, downloads, or Flow API calls depend on Firebase user identity.
- The background service worker uses Firebase user ID for anything other than subscription/quota/session-limit tracking.
- Any API call outside Google Flow requires an extension-auth token.
- Bypassing background auth causes unrelated runtime exceptions.
