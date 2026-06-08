# README_AGENT — Extension login removal implementation plan

## Mission
Remove the extension-level login requirement from `infoclusiv/extension-prueba` so users can use the extension after logging in only where the automation actually needs a session: Google Flow (`labs.google/fx/tools/flow`). The implementation must not require a Firebase/Auth login inside the extension side panel.

## Repository architecture observed
This repository appears to be a built Chrome Manifest V3 extension rather than a normal source project with unbundled React files. The implementation agent must verify this again before coding.

Observed runtime shape:

- `manifest.json`
  - MV3 extension.
  - Background service worker: `background.js`.
  - Side panel UI: `./src/index.html`.
  - Flow content script: `flowContentScript.js` on `https://labs.google/fx/tools/flow/*` and localized Flow URLs.
  - Permissions include `storage`, `sidePanel`, `identity`, `tabs`, `scripting`, `downloads`, and `offscreen`.
- `src/index.html`
  - Mounts the side panel app through `/main.js`.
  - Preloads `/userData.js`, `/queueDB.js`, and `/promptParser.js`.
- `main.js`
  - Bundled React side panel app.
  - Contains the extension login/register/reset-password UI.
  - Uses Firebase auth from `userData.js`.
  - Renders the main application only when a Firebase user exists; otherwise it renders the login component.
  - Sends `authStateChanged` messages to `background.js`.
  - Checks subscription/quota state from Firestore.
- `background.js`
  - Keeps extension auth state in local variables and `chrome.storage.local.authState`.
  - Handles `signInWithGoogle` through `chrome.identity.launchWebAuthFlow`.
  - Handles `getAuthState`, `authStateChanged`, `RUN_BATCH`, quota updates, download actions, Flow connection detection, and Google Flow API calls.
  - Some paths block work when extension auth state is not logged in.
- `flowContentScript.js`
  - Injected into Google Flow pages.
  - Keeps local auth flags from the background auth state.
  - Before `startProcessing`, calls `getAuthState`; if `isLoggedIn` is false, it blocks with “Authentication required. Please sign in first.”
  - Later Flow API calls still correctly depend on the Google Flow page session token and reCAPTCHA token.
- `userData.js`
  - Bundled Firebase Auth + Firestore logic.
  - Creates/tracks Firestore user subscriptions and trial quotas.
  - Exports Firebase auth, Firestore helpers, and Google sign-in helper.
- `offscreen.js` and `src/offscreen.html`
  - Used for Firestore quota updates when the side panel is closed.
- `queueDB.js`
  - IndexedDB queue persistence. This should not be affected by login removal.

## Product decision this plan assumes
“Remove login” means:

- The extension side panel must not require Firebase/Auth login.
- The extension must not show the extension login/register/reset-password screen as the default gate.
- Automation may still require the user to be logged into Google Flow in the browser tab because `flowContentScript.js` and `background.js` use Flow’s own session token from the page.
- Error messages should guide users to open/sign in to Google Flow, not sign in to the extension.
- Extension-specific subscription/quota enforcement must be disabled or replaced with a non-login mechanism. This plan disables it because the current implementation ties subscription/quota to Firebase user identity.

If this assumption conflicts with the business model, stop before implementation and ask the product owner how entitlement should work without an extension login.

## Execution rules
Read this file first, then execute the phase files in order:

1. `phase-1.md`
2. `phase-2.md`
3. `phase-3.md`
4. `phase-4.md`
5. `phase-5.md`

Implement only one phase at a time.

Before coding each phase:

- Read the phase document completely.
- Analyze the repository and fully understand the related architecture and affected components.
- Validate that the proposed implementation matches the real root cause and current codebase behavior.
- Prefer editing real source files if the repository contains unbundled source that was not visible during this analysis.
- If the repository only contains built/minified artifacts, keep changes as small and localized as possible and avoid broad rewrites.

During implementation:

- Follow the phase scope strictly.
- Avoid unrelated refactors, formatting churn, or unnecessary changes.
- Preserve existing automation, queue, download, settings, Flow connection, and retry behavior.
- Keep backward-compatible message handlers unless the phase explicitly says to remove them.

After implementation:

- Verify all success criteria defined in the phase document.
- Confirm expected behavior and observable signals.
- Report any inconsistencies, architectural conflicts, missing information, or signs that the proposed plan may be incorrect before continuing.
- Do not move to the next phase until the current phase is implemented and verified.

## Global stop conditions
Stop immediately and report before coding if any of these are true:

- You find unbundled source files that contradict the observed built artifacts and make the phase instructions inaccurate.
- Login is also enforced by a backend service that cannot be bypassed client-side.
- Subscription/quota enforcement must legally or commercially remain active, but there is no non-login entitlement mechanism.
- Google Flow’s own auth/session requirement is confused with the extension’s Firebase/Auth login requirement.
- The extension cannot be loaded unpacked after a phase.
- A phase requires changing unrelated automation behavior to pass.

## Global verification baseline
Use this baseline repeatedly after each phase:

1. Load the repository as an unpacked extension in Chrome/Edge.
2. Clear extension local storage or test with a fresh browser profile.
3. Open the extension side panel without signing into the extension.
4. Open `https://labs.google/fx/tools/flow/` and sign into Google Flow if needed.
5. Open or create a Flow project.
6. In the side panel, add a small prompt queue.
7. Start a small batch.
8. Confirm no extension login screen, no extension Google OAuth popup, and no “Authentication required. Please sign in first.” message from the extension.
9. Confirm failures related to missing Flow session say to sign in/open/refresh Google Flow, not to sign in to the extension.
