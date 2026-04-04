import { STEALTH_PASTE_THRESHOLD } from "./constants.js";
import { h } from "./domUtils.js";

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

export async function injectText(text) {
  try {
    const editorElement = document.querySelector('[data-slate-editor="true"]');
    if (!editorElement) {
      console.error("🔴 Flow Slate editor [data-slate-editor=\"true\"] not found");
      return false;
    }

    const stealthMode = getState?.().settings?.stealthMode || false;
    if (!stealthMode) {
      return fastInject(editorElement, text);
    }

    if (text.length > STEALTH_PASTE_THRESHOLD) {
      console.log(
        `🥷 Stealth Mode: Long prompt (${text.length} chars) — using human-like paste simulation...`,
      );
      return stealthPaste(editorElement, text);
    }

    console.log(
      `🥷 Stealth Mode: Short prompt (${text.length} chars) — using human-like typing...`,
    );
    return stealthTyping(editorElement, text);
  } catch (error) {
    console.error("❌ Error injecting text into Slate.js editor:", error);
    return false;
  }
}

async function fastInject(editorElement, text) {
  editorElement.focus();
  editorElement.click();
  await h(200);

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(editorElement);
  selection.removeAllRanges();
  selection.addRange(range);

  await h(100);

  editorElement.dispatchEvent(
    new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: text,
    }),
  );

  await h(400);

  const currentText = editorElement.textContent.trim();
  if (currentText === text || currentText.includes(text.substring(0, 20))) {
    console.log("✅ Text injected successfully into Slate.js Flow editor");
    return true;
  }

  console.warn(
    "⚠️ Text injection may have failed. Got:",
    JSON.stringify(currentText.substring(0, 50)),
  );
  return true;
}

async function stealthPaste(editorElement, text) {
  const thinkingPause = 300 + Math.random() * 600;
  console.log(`🥷 Paste simulation: thinking pause ${Math.round(thinkingPause)}ms...`);
  await h(thinkingPause);

  editorElement.focus();
  editorElement.click();
  await h(150 + Math.random() * 100);

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(editorElement);
  selection.removeAllRanges();
  selection.addRange(range);
  await h(80 + Math.random() * 80);

  const dataTransfer = new DataTransfer();
  dataTransfer.setData("text/plain", text);
  dataTransfer.setData("text/html", `<span>${text.replace(/\n/g, "<br>")}</span>`);

  editorElement.dispatchEvent(
    new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: dataTransfer,
    }),
  );

  await h(300 + Math.random() * 200);

  const actual = editorElement.textContent.trim();
  const expected = text.trim();
  if (actual === expected || actual.includes(expected.substring(0, 30))) {
    console.log("✅ Paste simulation: SUCCESS");
    return true;
  }

  console.warn("⚠️ Paste simulation: Slate ignored paste event — falling back to fast inject");
  return fastInject(editorElement, text);
}

const ADJACENT_KEYS = {
  a: ["q", "w", "s", "z"],
  b: ["v", "g", "h", "n"],
  c: ["x", "d", "f", "v"],
  d: ["s", "e", "r", "f", "c"],
  e: ["w", "r", "d"],
  f: ["d", "r", "t", "g", "v"],
  g: ["f", "t", "y", "h", "b"],
  h: ["g", "y", "u", "j", "n"],
  i: ["u", "o", "k"],
  j: ["h", "u", "i", "k", "n"],
  k: ["j", "i", "o", "l"],
  l: ["k", "o", "p"],
  m: ["n", "j", "k"],
  n: ["b", "h", "j", "m"],
  o: ["i", "p", "l", "k"],
  p: ["o", "l"],
  q: ["w", "a"],
  r: ["e", "t", "f"],
  s: ["a", "w", "e", "d", "z"],
  t: ["r", "y", "g"],
  u: ["y", "i", "h", "j"],
  v: ["c", "f", "g", "b"],
  w: ["q", "e", "s"],
  x: ["z", "s", "d", "c"],
  y: ["t", "u", "g", "h"],
  z: ["a", "s"],
};

const COMMON_DIGRAPHS = new Set([
  "th",
  "he",
  "in",
  "er",
  "an",
  "re",
  "on",
  "en",
  "at",
  "es",
  "ti",
  "or",
]);

async function stealthTyping(_editorElement, text) {
  const initResult = await executeInMainWorld(`
    const el = document.querySelector('[data-slate-editor="true"]');
    if (!el) return 'error:Editor not found';

    const fiberKey = Object.keys(el).find((key) =>
      key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')
    );
    if (!fiberKey) return 'error:React fiber not found on editor element';

    let node = el[fiberKey];
    let editor = null;

    for (let index = 0; index < 100; index += 1) {
      if (!node) break;
      const props = node.memoizedProps;
      if (props && props.editor && typeof props.editor.apply === 'function' && props.editor.children) {
        editor = props.editor;
        break;
      }
      node = node.return;
    }

    if (!editor) return 'error:Slate editor not found in fiber tree';

    window.__flowSlateEditor = editor;

    const existing = editor.children[0]?.children[0]?.text || '';
    if (existing.length > 0) {
      editor.apply({ type: 'remove_text', path: [0, 0], offset: 0, text: existing });
    }

    return 'ok';
  `);

  if (!initResult.success || initResult.result?.startsWith("error:")) {
    const error =
      initResult.error || initResult.result?.replace("error:", "") || "Unknown error";
    console.error("❌ Stealth Typing init failed:", error);
    return false;
  }

  console.log("✅ Stealth Typing: Slate editor initialized via MAIN world fiber");
  await h(200);

  let previousChar = "";
  console.log(`🥷 Stealth Typing: "${text.substring(0, 40)}${text.length > 40 ? "..." : ""}"`);

  for (let index = 0; index < text.length; index += 1) {
    const state = getState?.() || {};
    if (!state.isProcessing && !state.isPausing) {
      console.log("⏸️ Stealth Typing: interrupted — processing stopped");
      return false;
    }

    const character = text[index];
    const lower = character.toLowerCase();

    if (/[a-z]/.test(lower) && Math.random() < 0.03) {
      const nearbyKeys = ADJACENT_KEYS[lower] || [lower];
      const typo = nearbyKeys[Math.floor(Math.random() * nearbyKeys.length)];

      await executeInMainWorld(
        `
          const editor = window.__flowSlateEditor;
          if (editor) {
            const offset = editor.children[0]?.children[0]?.text?.length || 0;
            editor.apply({ type: 'insert_text', path: [0, 0], offset, text: args[0] });
          }
        `,
        [typo],
      );

      await h(80 + Math.random() * 60);
      await h(150 + Math.random() * 250);

      await executeInMainWorld(`
        const editor = window.__flowSlateEditor;
        if (editor) {
          const currentText = editor.children[0]?.children[0]?.text || '';
          if (currentText.length > 0) {
            editor.apply({
              type: 'remove_text',
              path: [0, 0],
              offset: currentText.length - 1,
              text: currentText[currentText.length - 1],
            });
          }
        }
      `);

      await h(60 + Math.random() * 50);
    }

    await executeInMainWorld(
      `
        const editor = window.__flowSlateEditor;
        if (editor) {
          const offset = editor.children[0]?.children[0]?.text?.length || 0;
          editor.apply({ type: 'insert_text', path: [0, 0], offset, text: args[0] });
        }
      `,
      [character],
    );

    const digraph = previousChar + lower;
    let delay;

    if (COMMON_DIGRAPHS.has(digraph)) {
      delay = 50 + Math.random() * 40;
    } else if (character === " ") {
      delay = 120 + Math.random() * 150;
    } else if (character === "," || character === ".") {
      delay = 150 + Math.random() * 200;
    } else {
      delay = 80 + Math.random() * 120;
    }

    const charactersSinceSpace = index - text.lastIndexOf(" ", index);
    if (charactersSinceSpace > 5) {
      delay += charactersSinceSpace * 2;
    }

    if (Math.random() < 0.03) {
      delay += 400 + Math.random() * 800;
    }

    previousChar = lower;
    await h(delay);
  }

  await h(400);

  const validationResult = await executeInMainWorld(`
    const editor = window.__flowSlateEditor;
    return editor ? (editor.children[0]?.children[0]?.text || '') : '';
  `);

  if (validationResult.success) {
    const actual = validationResult.result || "";
    if (actual === text) {
      console.log("✅ Stealth Typing: SUCCESS — text matches exactly");
    } else {
      console.warn("⚠️ Stealth Typing: mismatch. Got:     ", JSON.stringify(actual.substring(0, 60)));
      console.warn("⚠️ Stealth Typing: Expected:", JSON.stringify(text.substring(0, 60)));
    }
  }

  return true;
}
