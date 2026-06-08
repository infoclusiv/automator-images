# Phase 2 — Decouple side panel actions from Firebase subscription/quota state

## Objective
Allow side panel automation actions to be started without a Firebase user, Firebase subscription, or extension quota state.

## Expected behavior
After Phase 1, users can interact with the side panel and prepare prompts. In this phase, starting automation from the side panel should not be blocked by extension-specific subscription, trial, quota, or Firebase user checks.

The extension should still require a valid Google Flow page/session because the actual automation uses Flow.

## Success criteria
- The “Start Batch” or equivalent run action can be clicked without a Firebase user.
- The run action does not show extension-auth messages such as:
  - “Your subscription has expired. Please upgrade to continue.”
  - “Not enough free quota.”
  - “Free quota depleted.”
  - “Authentication required. Please sign in first.”
- Prompt queue, settings, reference image selection, history, and download options still behave as before.
- If the active Google Flow tab is missing or not ready, the UI shows Flow-specific setup guidance rather than extension login guidance.
- Paid/subscription UI is hidden, neutralized, or non-blocking while no extension login exists.

## How to verify
1. Start from a clean extension state with no Firebase/Auth session.
2. Open the side panel and confirm main UI is visible.
3. Add one simple image prompt.
4. Keep Google Flow open in a project and signed in.
5. Click Start Batch.
6. Confirm the side panel sends the start request instead of blocking due to subscription/quota/login.
7. Repeat with Google Flow closed; confirm the error tells the user to open or sign into Google Flow, not to sign into the extension.

## Observable failure signals
- Start button is disabled because `subscriptionStatus` is null/expired/trial-exhausted.
- A subscription modal blocks access before any run can start.
- Console errors caused by missing `user.uid` during quota checks.
- Any forced call to checkout/portal before automation can run.
- Batch starts only after signing into Firebase/Auth inside the extension.

## Files/components involved
Primary:

- `main.js`, or original side panel source if available.

Related:

- `userData.js` for existing Firestore subscription helpers.
- `offscreen.js` for quota updates, but do not remove it yet.
- `background.js` for later runtime gating; do not change background gates in this phase unless a side panel action calls them directly and cannot be tested otherwise.

Known relevant side panel concepts:

- Subscription status retrieval from Firestore.
- Quota checks before processing.
- Subscription modal/profile controls.
- Start batch handler that sends messages to Flow content script or background.

## Implementation notes
Implement a non-login entitlement mode for the side panel.

Recommended approach:

- Introduce a clear boolean or equivalent concept such as `extensionAuthDisabled = true` or `requiresExtensionLogin = false`.
- When this mode is active:
  - Treat extension subscription/quota as non-blocking.
  - Avoid Firestore writes that require a real user.
  - Do not call checkout/portal flows automatically.
  - Hide or neutralize subscription upgrade nags that only exist because extension auth is missing.
  - Keep Flow connection checks intact.
- Preserve the existing paid/trial code path behind a guarded branch if the team may restore it later.
- Do not remove Firebase imports or manifest permissions in this phase.

## Preconditions before implementation
- Phase 1 is implemented and verified.
- Confirm which side panel handler actually starts processing in the current codebase.
- Confirm whether the side panel sends `startProcessing` to `flowContentScript.js`, `RUN_BATCH` to `background.js`, or both depending on mode.
- Confirm quota checks are client-side and not required by a backend API.

## Stop conditions if the plan does not match the real codebase
Stop and report if:

- Starting automation requires a server-issued entitlement token that only Firebase login can provide.
- There is a non-login entitlement mechanism the product owner wants to use instead of disabling quota checks.
- The side panel cannot distinguish extension login from Google Flow login.
- Removing quota gating would violate an explicit product/business requirement not covered by this task.
