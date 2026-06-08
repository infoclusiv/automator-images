# Phase 1 — Remove the side panel login gate

## Objective
Make the side panel app open directly into the main extension UI without requiring a Firebase/Auth user inside the extension.

## Expected behavior
On a clean install or fresh extension storage state, clicking the extension opens the side panel and shows the normal automation UI instead of the login/register/reset-password screen.

The user should not see:

- “Welcome Back”
- “Create Account”
- “Continue with Google”
- “Sign In” as an extension login action
- Password reset or email verification screens

The user may still need to sign into Google Flow in the browser tab.

## Success criteria
- The side panel renders the main app when Firebase `currentUser` is null.
- The side panel does not crash due to missing `user.email`, `user.uid`, `providerData`, or metadata.
- Existing settings, queue UI, Flow connection status, and dark mode still render.
- No Google OAuth popup is launched by simply opening the side panel.
- The previous login component remains unreachable from the default startup path.

## How to verify
1. Install/load the extension unpacked in a fresh profile or clear extension storage.
2. Ensure there is no Firebase/Auth session in the extension.
3. Click the extension icon to open the side panel.
4. Confirm the main automation UI appears directly.
5. Search the visible UI for “Welcome Back”, “Create Account”, “Continue with Google”, “Forgot Password”, and “Reset Password”. None should appear in the default flow.
6. Open DevTools for the side panel and confirm there are no runtime errors caused by a missing user object.

## Observable failure signals
- The login card still appears.
- A blank panel appears.
- Console errors such as `Cannot read properties of null (reading 'email')` or `Cannot read properties of undefined (reading 'uid')`.
- The side panel immediately opens Google OAuth or asks for extension login.
- Profile/subscription UI assumes a real Firebase user and breaks the page.

## Files/components involved
Primary:

- `main.js`, or the original React source that produces it if present.

Related but not expected to change in this phase:

- `src/index.html`
- `userData.js`
- `background.js`

Known relevant runtime components in `main.js`:

- Root app component currently subscribes to Firebase Auth and stores a user state.
- Login/register component is rendered when the user state is null.
- Main application component is rendered when the user state is truthy.
- Header/profile/subscription components expect a user-like object.

## Implementation notes
Implement the smallest safe change that creates a local, non-authenticated “effective user” for UI rendering when Firebase has no authenticated user.

Recommended behavior:

- Keep Firebase listener code temporarily for backward compatibility, but do not let it gate the UI.
- Create an `effectiveUser` or equivalent fallback object when no real Firebase user exists.
- The fallback object should include at least:
  - `uid`: a stable local ID such as `local-extension-user` or a persisted ID from `chrome.storage.local`.
  - `email`: a harmless display-only value such as `flow-user@local.extension`.
  - `displayName`: `Flow User` or similar.
  - `photoURL`: `null`.
  - `providerData`: empty array.
  - `metadata`: optional empty or safe defaults if the UI reads it.
- Render the main app with `effectiveUser` instead of rendering the login component.
- Do not yet remove Firebase imports, subscription code, or background auth handlers in this phase.

If unbundled source exists, make this change in source and rebuild. If only built artifacts exist, patch the smallest possible section in `main.js` and document the exact patch.

## Preconditions before implementation
- Confirm whether unbundled source files exist. If they do, use source files and rebuild instead of hand-editing bundled output.
- Confirm the app’s main render condition still matches the observed behavior: `user ? mainApp : loginComponent` or equivalent.
- Confirm the main app can render with a minimal user-like object.

## Stop conditions if the plan does not match the real codebase
Stop and report if:

- There is no fallback-safe way to render the main app without a real Firebase user.
- The main app immediately performs Firestore writes that require a real authenticated user before the UI can render.
- The repository contains source files with a different auth architecture than the bundled `main.js`.
- The login gate is enforced server-side before the side panel can render.
