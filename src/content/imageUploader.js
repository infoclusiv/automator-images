import {
  IMAGE_UPLOADER_DELAYS,
  IMAGE_UPLOADER_TIMEOUTS,
} from "./constants.js";
import { $, h, re, waitForElement } from "./domUtils.js";
import { stealthClick } from "./clickHelper.js";

let getState = null;

export function init(getStateFn) {
  getState = getStateFn;
}

function isStealthMode() {
  return getState?.().settings?.stealthMode === true;
}

function isProcessingStopped() {
  const state = getState?.() || {};
  return !state.isProcessing && !state.isPausing;
}

function randomizeDelay(delayMs) {
  return Math.round(delayMs * (0.7 + Math.random() * 0.6));
}

async function waitWithStealthFactor(delayMs) {
  const effectiveDelay = isStealthMode() ? randomizeDelay(delayMs) : delayMs;
  await h(effectiveDelay);
}

function clickElement(element) {
  if (isStealthMode()) {
    stealthClick(element);
    return;
  }

  element.click();
}

async function setTextInputValue(inputElement, value) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  ).set;

  if (isStealthMode()) {
    const thinkingPause = 100 + Math.random() * 300;
    console.log(
      `🥷 Stealth: Input think pause ${Math.round(thinkingPause)}ms before setting "${value}"...`,
    );
    await h(thinkingPause);
  }

  inputElement.focus();
  valueSetter.call(inputElement, value);
  inputElement.dispatchEvent(new Event("input", { bubbles: true }));
}

export async function clearExistingReferences() {
  const buttons = document.querySelectorAll("button");
  let clearButton = null;

  for (const button of buttons) {
    const icon = button.querySelector("i.google-symbols");
    if (icon && icon.textContent.trim() === "close" && button.querySelector("span")) {
      clearButton = button;
      break;
    }
  }

  if (!clearButton) {
    console.log("✅ ImageUploader Pre-flight: No attached references found — input area is clean");
    return false;
  }

  clickElement(clearButton);
  console.log(
    "🧹 ImageUploader Pre-flight: Clicked clear-references button — all attached references cleared",
  );
  await waitWithStealthFactor(300);
  return true;
}

export async function uploadAllImages(images) {
  if (!images || images.length === 0) {
    console.warn("⚠️ ImageUploader.uploadAllImages: No images provided");
    return false;
  }

  console.log(
    `📤 ImageUploader Phase 1: Batch-checking ${images.length} file(s) in library (single picker session)...`,
  );

  const names = images.map((image, index) => image.name || `reference_${index + 1}.jpg`);
  const existingFiles = await checkLibraryForFiles(names);
  const totalUploadsNeeded = images.length - existingFiles.size;
  let didUpload = false;
  let uploadedCount = 0;

  for (let index = 0; index < images.length; index += 1) {
    if (isProcessingStopped()) {
      console.log("⏸️ ImageUploader: Processing stopped during file injection");
      return false;
    }

    const image = images[index];
    const name = names[index];
    const mimeType = image.mimeType || "image/jpeg";

    if (existingFiles.has(name)) {
      console.log(
        `⏩ ImageUploader Phase 1 [${index + 1}/${images.length}]: "${name}" already in library — skipping upload`,
      );
      continue;
    }

    console.log(
      `📤 ImageUploader Phase 1 [${index + 1}/${images.length}]: "${name}" not in library — uploading...`,
    );

    const fileInput = document.querySelector('input[type="file"][accept*="image"]');
    if (!fileInput) {
      console.warn(`⚠️ ImageUploader Phase 1: File input not found for "${name}"`);
      return false;
    }

    const file = base64ToFile(image.data, name, mimeType);
    if (!file) {
      console.warn(`⚠️ ImageUploader Phase 1: Failed to convert "${name}" to File object`);
      return false;
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));

    console.log(
      `✅ ImageUploader Phase 1 [${index + 1}/${images.length}]: "${name}" injected (${(file.size / 1024).toFixed(1)} KB)`,
    );

    didUpload = true;
    uploadedCount += 1;

    if (uploadedCount < totalUploadsNeeded) {
      await waitWithStealthFactor(IMAGE_UPLOADER_DELAYS.UPLOAD_BETWEEN_FILES);
    }
  }

  if (didUpload) {
    console.log(
      `⏳ ImageUploader Phase 1 complete — waiting ${IMAGE_UPLOADER_DELAYS.UPLOAD_SETTLE / 1000}s for uploads to settle...`,
    );
    await h(IMAGE_UPLOADER_DELAYS.UPLOAD_SETTLE);
  } else {
    console.log(
      "⏩ ImageUploader Phase 1 complete — all images already in library, no settle wait needed",
    );
  }

  return true;
}

export async function attachAllImages(images, mode = "ingredients") {
  if (!images || images.length === 0) {
    console.warn("⚠️ ImageUploader.attachAllImages: No images provided");
    return false;
  }

  console.log(
    `🔗 ImageUploader Phase 2: Attaching ${images.length} image(s) as references [${mode}]...`,
  );

  for (let index = 0; index < images.length; index += 1) {
    if (isProcessingStopped()) {
      console.log("⏸️ ImageUploader: Processing stopped during reference attachment");
      return false;
    }

    const name = images[index].name || `reference_${index + 1}.jpg`;
    console.log(
      `🔗 ImageUploader Phase 2 [${index + 1}/${images.length}]: Attaching "${name}" [${mode}${mode === "frames" ? `/${index === 0 ? "Start" : "End"}` : ""}]...`,
    );

    if (!(await attachSingleImage(name, mode, index))) {
      console.error(`❌ ImageUploader Phase 2: Failed to attach "${name}"`);
      return false;
    }

    console.log(
      `✅ ImageUploader Phase 2 [${index + 1}/${images.length}]: "${name}" attached successfully`,
    );
  }

  console.log(`✅ ImageUploader Phase 2 complete — all ${images.length} image(s) attached`);
  return true;
}

async function attachSingleImage(name, mode, slotIndex) {
  const triggerElement = getTriggerElement(mode, slotIndex);
  if (!triggerElement) {
    console.warn(
      `⚠️ ImageUploader: ${mode === "frames" ? `Frames ${slotIndex === 0 ? "Start" : "End"} frame div` : "add_2 button"} trigger not found`,
    );
    return false;
  }

  clickElement(triggerElement);
  console.log(
    `✅ ImageUploader: Clicked trigger (${mode}${mode === "frames" ? `/${slotIndex === 0 ? "Start" : "End"}` : ""})`,
  );

  const dialog = await waitForElement(
    '[role="dialog"][data-state="open"]',
    IMAGE_UPLOADER_TIMEOUTS.PICKER_OPEN,
  );
  if (!dialog) {
    console.warn("⚠️ ImageUploader: Asset picker popover did not open");
    return false;
  }

  console.log("✅ ImageUploader: Asset picker popover opened");
  await waitWithStealthFactor(IMAGE_UPLOADER_DELAYS.SEARCH_SETTLE);

  const searchInput = dialog.querySelector('input[type="text"]');
  if (!searchInput) {
    console.warn("⚠️ ImageUploader: Search input not found in popover");
    closePickerWithEscape();
    return false;
  }

  await setTextInputValue(searchInput, name);
  console.log(`🔍 ImageUploader: Searching for "${name}"${isStealthMode() ? " (stealth paste)" : ""}...`);

  const searchResult = await waitForSearchResult(name, IMAGE_UPLOADER_TIMEOUTS.SEARCH_RESULT);
  if (!searchResult) {
    console.warn(
      `⚠️ ImageUploader: Search result for "${name}" not found (upload may not have completed yet)`,
    );
    closePickerWithEscape();
    return false;
  }

  console.log(`✅ ImageUploader: Found search result for "${name}"`);

  const resultRow = searchResult.parentElement;
  if (!resultRow) {
    console.warn("⚠️ ImageUploader: Result row parent not found");
    closePickerWithEscape();
    return false;
  }

  if (isStealthMode()) {
    await h(150 + Math.random() * 200);
  }

  clickElement(resultRow);
  console.log(`✅ ImageUploader: Clicked result row for "${name}"`);

  if (await waitForPickerClose(IMAGE_UPLOADER_TIMEOUTS.PICKER_CLOSE)) {
    console.log("✅ ImageUploader: Popover closed — image attached as reference");
  } else {
    console.warn("⚠️ ImageUploader: Popover did not close after clicking result — forcing close");
    closePickerWithEscape();
    await waitWithStealthFactor(300);
  }

  await waitWithStealthFactor(IMAGE_UPLOADER_DELAYS.AFTER_ATTACH);
  return true;
}

async function checkLibraryForFiles(names) {
  const existingFiles = new Set();
  if (!names || names.length === 0) {
    return existingFiles;
  }

  const libraryTrigger = $("//button[.//i[normalize-space(text())='add_2']]");
  if (!libraryTrigger) {
    console.warn(
      "⚠️ ImageUploader library check: add_2 trigger not found — assuming all images need upload",
    );
    return existingFiles;
  }

  clickElement(libraryTrigger);

  const dialog = await waitForElement(
    '[role="dialog"][data-state="open"]',
    IMAGE_UPLOADER_TIMEOUTS.PICKER_OPEN,
  );
  if (!dialog) {
    console.warn(
      "⚠️ ImageUploader library check: Popover did not open — assuming all images need upload",
    );
    return existingFiles;
  }

  await waitWithStealthFactor(300);

  const searchInput = dialog.querySelector('input[type="text"]');
  if (!searchInput) {
    console.warn("⚠️ ImageUploader library check: Search input not found — closing picker");
    closePickerWithEscape();
    return existingFiles;
  }

  for (let index = 0; index < names.length; index += 1) {
    const name = names[index];
    await setTextInputValue(searchInput, name);
    console.log(`🔍 ImageUploader library check [${index + 1}/${names.length}]: Searching for "${name}"...`);
    await waitWithStealthFactor(300);

    if (await waitForSearchResult(name, IMAGE_UPLOADER_TIMEOUTS.LIBRARY_SEARCH)) {
      console.log(
        `✅ ImageUploader library check [${index + 1}/${names.length}]: "${name}" found in library`,
      );
      existingFiles.add(name);
    } else {
      console.log(
        `📭 ImageUploader library check [${index + 1}/${names.length}]: "${name}" not in library — will upload`,
      );
    }

    if (index < names.length - 1) {
      await waitWithStealthFactor(200);
    }
  }

  closePickerWithEscape();
  await waitWithStealthFactor(400);
  console.log(
    `📊 ImageUploader library check complete: ${existingFiles.size}/${names.length} already in library`,
  );
  return existingFiles;
}

async function waitForSearchResult(name, timeoutMs) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const result = [...document.querySelectorAll('[data-testid="virtuoso-item-list"] img')].find(
      (image) => image.getAttribute("alt") === name,
    );

    if (result) {
      return result;
    }

    await h(IMAGE_UPLOADER_DELAYS.SEARCH_POLL);
  }

  return null;
}

async function waitForPickerClose(timeoutMs) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (!document.querySelector('[role="dialog"][data-state="open"]')) {
      return true;
    }

    await h(200);
  }

  return false;
}

function closePickerWithEscape() {
  re();
}

function base64ToFile(data, name, mimeType) {
  try {
    let content = data;
    let effectiveMimeType = mimeType;

    if (data.startsWith("data:")) {
      const [prefix, payload] = data.split(",");
      content = payload;

      const mimeMatch = prefix.match(/:(.*?);/);
      if (mimeMatch) {
        effectiveMimeType = mimeMatch[1];
      }
    }

    const binary = atob(content);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new File([bytes], name, { type: effectiveMimeType });
  } catch (error) {
    console.error("❌ ImageUploader: base64ToFile conversion failed:", error);
    return null;
  }
}

function getTriggerElement(mode, slotIndex) {
  if (mode === "frames") {
    return $(
      `//div[@aria-haspopup='dialog' and normalize-space(text())='${slotIndex === 0 ? "Start" : "End"}']`,
    );
  }

  return $("//button[.//i[normalize-space(text())='add_2']]");
}