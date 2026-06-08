# Phase 5 — End-to-end regression verification and handoff notes

## Objective
Verify the login removal across the full extension workflow and document any remaining intentional auth-related code or product decisions.

## Expected behavior
The extension operates without extension login from a clean install. Users only need to be signed into Google Flow on the Google Flow website for automation that depends on Flow session tokens.

## Success criteria
- Fresh extension install opens the side panel main UI without extension login.
- User can configure prompts/settings without extension login.
- User can run a one-prompt Flow image batch while signed into Google Flow.
- User receives a Flow-specific error when not signed into Google Flow.
- No extension-login OAuth popup appears in normal usage.
- No extension login/register/reset-password UI appears in normal usage.
- No quota/subscription/auth-related runtime exception appears in side panel, background, or content script consoles.
- Any remaining Firebase/Auth code is documented as dormant, intentionally retained, or scheduled for future removal.

## How to verify
Run this matrix manually:

### Scenario A — Fresh extension, Google Flow signed in
1. Clear extension storage or use a new browser profile.
2. Load the unpacked extension.
3. Sign into Google Flow in a browser tab.
4. Open a Flow project.
5. Open the side panel.
6. Add one image prompt.
7. Start batch.
8. Verify the batch starts and completes or reaches a Flow-specific external limit/error.

### Scenario B — Fresh extension, Google Flow not signed in
1. Clear extension storage or use a new browser profile.
2. Ensure Google Flow is signed out or use an incognito-like clean profile.
3. Open the side panel.
4. Add one image prompt.
5. Try to start.
6. Verify the error tells the user to open/sign into Google Flow and refresh, not to sign into the extension.

### Scenario C — Existing user with old auth state in storage
1. Use a profile that previously had `chrome.storage.local.authState`.
2. Load the updated extension.
3. Open the side panel.
4. Confirm old auth state does not re-enable login gates or break UI.
5. Start a small run with Google Flow signed in.

### Scenario D — Queue persistence regression
1. Add multiple prompts.
2. Refresh or close/reopen side panel.
3. Confirm `queueDB.js` queue behavior still works.
4. Start/stop/resume if those controls exist.

### Scenario E — Permissions/regression check
1. Confirm extension loads without manifest errors.
2. Confirm content script injects into Google Flow.
3. Confirm downloads still work.
4. Confirm cache-clear/zoom/retry functionality still works if available.

## Observable failure signals
- Login UI appears in any normal path.
- Any normal path launches extension OAuth.
- Batch fails before touching Google Flow with extension-auth messaging.
- Flow content script does not inject after manifest cleanup.
- Downloads fail due to removed permissions.
- Side panel blank screen or React runtime errors.
- Background service worker errors after removing/neutralizing auth code.

## Files/components involved
All modified files from previous phases, especially:

- `manifest.json`
- `main.js` or source equivalent
- `background.js`
- `flowContentScript.js`
- `offscreen.js` / `src/offscreen.html` if changed
- `userData.js` if changed

## Handoff notes to produce after verification
After completing this phase, report:

- Exact files changed.
- Whether changes were made in source files or built artifacts.
- Whether a rebuild was performed.
- Which auth surfaces were removed versus left dormant.
- Whether `identity` and/or `offscreen` permissions remain and why.
- Final verification results for Scenarios A through E.
- Any product risk, especially disabled subscription/quota enforcement.

## Preconditions before implementation
- Phases 1 through 4 are implemented and individually verified.
- The extension can be loaded unpacked.
- A test Google Flow account/session is available.

## Stop conditions if the plan does not match the real codebase
Stop and report if:

- End-to-end automation cannot be verified due to missing Google Flow access.
- External Google Flow UI/API changes prevent reliable automation testing.
- Any failing scenario indicates the implementation changed automation behavior unrelated to login removal.
- There is unresolved ambiguity around whether subscription/quota enforcement must remain.
