let getState = null;

export function init(getStateFn) {
  getState = getStateFn;
}

function executeInMainWorld(funcBody, args = []) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: "executeInMainWorld", funcBody, args },
      (response) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
          return;
        }

        resolve(response || { success: false, error: "No response" });
      },
    );
  });
}

export async function clickSubmit() {
  try {
    const stealthMode = getState?.().settings?.stealthMode || false;
    if (stealthMode) {
      return stealthSubmit();
    }

    return domClick();
  } catch (error) {
    console.error("❌ Error in clickSubmit:", error);
    return false;
  }
}

async function stealthSubmit() {
  console.log("🥷 Stealth Mode: Triggering submit via React fiber onClick (MAIN world)...");

  const response = await executeInMainWorld(`
    const buttons = Array.from(document.querySelectorAll('button'));
    const submitBtn = buttons.find((btn) => {
      const hasArrowForward = btn.querySelector('i')?.textContent.trim() === 'arrow_forward';
      const hasSpanText = btn.querySelector('span')?.textContent.trim().length > 0;
      return hasArrowForward && hasSpanText;
    });
    if (!submitBtn) return 'error:Submit button not found';

    const fiberKey = Object.keys(submitBtn).find((key) =>
      key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')
    );
    if (!fiberKey) return 'error:React fiber not found on submit button';

    let node = submitBtn[fiberKey];
    let onClick = null;

    for (let index = 0; index < 50; index += 1) {
      if (!node) break;
      const props = node.memoizedProps;
      if (props && typeof props.onClick === 'function') {
        onClick = props.onClick;
        break;
      }
      node = node.return;
    }

    if (!onClick) return 'error:onClick prop not found in fiber tree';

    onClick({ type: 'click', preventDefault: () => {}, stopPropagation: () => {} });
    return 'ok';
  `);

  if (!response.success || response.result?.startsWith("error:")) {
    const error = response.error || response.result?.replace("error:", "") || "Unknown error";
    console.error("❌ Stealth submit failed:", error);
    console.warn("⚠️ Falling back to DOM click for submit...");
    return domClick();
  }

  console.log("✅ Stealth submit triggered via React onClick prop (zero DOM events)");
  return true;
}

function domClick() {
  const submitButton = Array.from(document.querySelectorAll("button")).find((button) => {
    const hasArrowForward = button.querySelector("i")?.textContent.trim() === "arrow_forward";
    const hasSpanText = (button.querySelector("span")?.textContent.trim().length || 0) > 0;
    return hasArrowForward && hasSpanText;
  });

  if (!submitButton) {
    console.warn("⚠️ Submit button not found");
    return false;
  }

  submitButton.click();
  console.log("✅ Submit button clicked (DOM)");
  return true;
}
