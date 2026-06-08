# Phase 4 — Remove or neutralize extension login surfaces and dead auth permissions

## Objective
Clean up visible and callable extension-login surfaces after the functional login gate has been removed.

## Expected behavior
The extension should no longer expose extension-auth UI or launch extension-auth OAuth flows. Permissions and files used only for extension login/quota should be removed or left inert only when removal would be risky.

## Success criteria
- There is no reachable extension login/register/reset-password UI.
- `chrome.identity.launchWebAuthFlow` is not used by active extension login behavior.
- The extension does not ask for the `identity` permission unless another non-login feature genuinely requires it.
- Offscreen quota updates do not run when no extension user exists.
- Removing or neutralizing auth cleanup does not break the side panel, content script, downloads, or Flow automation.

## How to verify
1. Search the repository for these strings and verify they are removed or unreachable:
   - `signInWithGoogle`
   - `launchWebAuthFlow`
   - `Continue with Google`
   - `Create Account`
   - `Forgot Password`
   - `Reset Password`
   - `auth/email-already-in-use`
   - `Authentication required. Please sign in first.`
2. Load the extension and inspect Chrome/Edge extension details.
3. Confirm `identity` permission is absent unless explicitly justified.
4. Open the side panel and run a one-prompt Flow batch.
5. Confirm no auth-related console errors are introduced.

## Observable failure signals
- Browser still asks for identity-related permissions.
- Clicking a profile or account button still opens a login/sign-out flow.
- Background logs errors from `signInWithGoogle` or Firebase auth when no one requested auth.
- Removing `offscreen` or `identity` breaks quota, downloads, or Flow automation unexpectedly.
- Manifest validation fails because permissions or offscreen usage are inconsistent.

## Files/components involved
Primary:

- `manifest.json`
- `background.js`
- `main.js`, or original source if available

Related:

- `userData.js`
- `src/offscreen.html`
- `offscreen.js`

Known current auth-only surfaces:

- `manifest.json` includes `identity` and `offscreen` permissions.
- `background.js` has a `signInWithGoogle` handler using `chrome.identity.launchWebAuthFlow`.
- `main.js` includes login/register/reset-password UI and profile sign-out behavior.
- `userData.js` exports Firebase Auth helpers and the extension Google sign-in helper.
- `offscreen.js` updates Firestore subscription quota.

## Implementation notes
Proceed conservatively:

- Remove `identity` from `manifest.json` only after confirming no non-login feature uses `chrome.identity`.
- Remove or disable `signInWithGoogle` handler in `background.js` after ensuring nothing active calls it.
- Keep `getAuthState` if needed for backward compatibility, but make it non-blocking and non-login-specific.
- Remove visible login strings from bundled/source UI if still present in shipped assets, or ensure they are unreachable and documented.
- Remove `offscreen` permission and offscreen document creation only if Firestore quota updates are fully disabled and no other feature uses offscreen documents.
- If removing `userData.js` imports would require risky rebundling, leave Firebase code dormant and document remaining dead code for future cleanup.

## Preconditions before implementation
- Phases 1 through 3 are implemented and verified.
- Confirm the extension still works when no Firebase user exists.
- Confirm quota/subscription tracking has been intentionally disabled or replaced.
- Confirm no required feature uses Chrome Identity outside extension login.

## Stop conditions if the plan does not match the real codebase
Stop and report if:

- `chrome.identity` is used for a non-login feature that remains required.
- `offscreen` is used for required non-quota functionality.
- Removing login strings from minified bundles would require unsafe broad edits and source is unavailable.
- The extension fails to load after manifest permission changes.
