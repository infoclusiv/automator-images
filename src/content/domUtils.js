export function h(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function $(xpath, context = document) {
  try {
    return document.evaluate(
      xpath,
      context,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null,
    ).singleNodeValue;
  } catch (error) {
    console.error("❌ XPath evaluation error:", error, "\nXPath:", xpath);
    return null;
  }
}

export async function waitForElement(selector, timeoutMs = 5_000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }

    await h(100);
  }

  return null;
}

export function re() {
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      keyCode: 27,
      bubbles: true,
      cancelable: true,
      composed: true,
    }),
  );
}

export function centerOf(element) {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}
