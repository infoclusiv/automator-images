import {
  DOWNLOAD_QUALITY_DEFAULTS,
  MONITORING_TIMEOUTS,
} from "./constants.js";
import { $, h } from "./domUtils.js";
import { checkGlobalErrors, scanTileErrors } from "./errorScanner.js";
import { EVENTS } from "./eventBus.js";

let getState = null;
let setState = null;
let getSelectors = null;
let eventBus = null;
let stateManager = null;

let tileScannerInterval = null;
let errorMonitoringInterval = null;
let downloadQueue = [];
let isDownloadRunnerActive = false;

export function init({
  getState: getStateFn,
  setState: setStateFn,
  getSelectors: getSelectorsFn,
  eventBus: eventBusInstance,
  stateManager: stateManagerInstance,
}) {
  getState = getStateFn;
  setState = setStateFn;
  getSelectors = getSelectorsFn;
  eventBus = eventBusInstance;
  stateManager = stateManagerInstance;

  eventBus.on(EVENTS.PROCESSING_TERMINATE, () => {
    stopTileScanner();
    stopErrorMonitoring();
    resetDownloadQueue();
  });
}

export function snapshotExistingTileIds() {
  const tileIds = new Set();
  document.querySelectorAll("[data-tile-id]").forEach((tileElement) => {
    const tileId = tileElement.getAttribute("data-tile-id");
    if (tileId) {
      tileIds.add(tileId);
    }
  });

  console.log(`📸 Tile snapshot: ${tileIds.size} existing tile(s)`);
  return tileIds;
}

export function isTileCompleted(tileElement) {
  return Boolean(
    tileElement.querySelector('video[src*="media.getMediaUrlRedirect"]') ||
      tileElement.querySelector('img[src*="media.getMediaUrlRedirect"]'),
  );
}

export function isTileVideo(tileElement) {
  return Boolean(tileElement.querySelector("video"));
}

export function scanForNewlyCompletedTiles(preSubmitIds) {
  const completedTiles = [];
  const seenTileIds = new Set();

  document.querySelectorAll("[data-tile-id]").forEach((tileElement) => {
    const tileId = tileElement.getAttribute("data-tile-id");
    if (!tileId || seenTileIds.has(tileId)) {
      return;
    }

    seenTileIds.add(tileId);
    if (preSubmitIds?.has(tileId) || !isTileCompleted(tileElement)) {
      return;
    }

    completedTiles.push({
      tileId,
      tileEl: tileElement,
      isVideo: isTileVideo(tileElement),
    });
  });

  return completedTiles;
}

function pickDownloadQualityButton(menuElement, targetQuality) {
  const buttons = [...menuElement.querySelectorAll('button[role="menuitem"], button')];
  if (buttons.length === 0) {
    return null;
  }

  const buttonData = buttons.map((button) => ({
    button,
    label:
      button.querySelectorAll("span")[0]?.textContent.trim() || button.textContent.trim(),
    enabled: button.getAttribute("aria-disabled") !== "true",
  }));

  const enabledButtons = buttonData.filter((entry) => entry.enabled);

  if (targetQuality) {
    const matchingButton = buttonData.find((entry) => entry.label === targetQuality);
    if (matchingButton) {
      if (matchingButton.enabled) {
        console.log(`⬇️ Download quality: "${matchingButton.label}" (selected)`);
        return matchingButton.button;
      }

      console.warn(`⚠️ "${targetQuality}" is locked (aria-disabled). Falling back to best available.`);
    } else {
      console.warn(`⚠️ Quality "${targetQuality}" not found in sub-menu. Falling back.`);
    }
  }

  if (enabledButtons.length > 0) {
    const fallbackButton = enabledButtons[enabledButtons.length - 1];
    console.log(`⬇️ Download quality fallback: "${fallbackButton.label}" (best available)`);
    return fallbackButton.button;
  }

  console.warn("⚠️ All quality options disabled — clicking first button as last resort");
  return buttons[0] || null;
}

export async function downloadTileViaUI(tileElement, targetQuality = null) {
  try {
    const mediaElement =
      tileElement.querySelector('video[src*="media.getMediaUrlRedirect"]') ||
      tileElement.querySelector('img[src*="media.getMediaUrlRedirect"]');
    if (!mediaElement) {
      console.warn("⚠️ No media element found in tile for download");
      return false;
    }

    const rect = mediaElement.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;

    mediaElement.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true, clientX, clientY }));
    mediaElement.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX, clientY }));
    await h(400);

    mediaElement.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        button: 2,
      }),
    );
    await h(600);

    const contextMenu = document.querySelector('[data-radix-menu-content][data-state="open"]');
    if (!contextMenu) {
      console.warn("⚠️ Context menu did not open for tile download");
      return false;
    }

    const downloadMenuItem = [...contextMenu.querySelectorAll('[role="menuitem"]')].find(
      (item) => item.querySelector("i")?.textContent.trim() === "download",
    );

    if (!downloadMenuItem) {
      console.warn("⚠️ Download menuitem not found in context menu");
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return false;
    }

    downloadMenuItem.click();
    await h(600);

    const menus = [...document.querySelectorAll('[data-radix-menu-content][data-state="open"]')];
    const qualityMenu = menus.find((menu) => menu !== contextMenu) || menus[menus.length - 1];
    if (!qualityMenu || qualityMenu === contextMenu) {
      console.warn("⚠️ Quality sub-menu did not open");
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return false;
    }

    const qualityButton = pickDownloadQualityButton(qualityMenu, targetQuality);
    if (!qualityButton) {
      console.warn("⚠️ No quality button found in sub-menu");
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return false;
    }

    qualityButton.click();
    await h(300);
    console.log("✅ Download triggered via UI");
    return true;
  } catch (error) {
    console.error("❌ Error in downloadTileViaUI:", error);
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return false;
  }
}

async function runDownloadQueue() {
  if (isDownloadRunnerActive) {
    return;
  }

  isDownloadRunnerActive = true;

  while (downloadQueue.length > 0) {
    const { tileEl, targetQuality, label } = downloadQueue.shift();
    console.log(`⬇️ Download runner: processing "${label}" (quality: ${targetQuality ?? "default"})`);
    await downloadTileViaUI(tileEl, targetQuality);
    await h(500);
  }

  resetDownloadQueue();
  console.log("✅ Download runner: queue empty, state reset");
}

export async function periodicTileScanner() {
  const state = getState?.() || {};
  if (!state.isProcessing && !state.isPausing) {
    return;
  }

  try {
    const currentTask = state.taskList?.find((task) => task.status === "current");
    if (!currentTask) {
      return;
    }

    currentTask.foundVideos ||= 0;
    currentTask.processedTileIds ||= new Set();

    if (!currentTask._scanStartedAt) {
      currentTask._scanStartedAt = Date.now();
      eventBus?.emit(EVENTS.OVERLAY_ERROR_BANNER_CLEAR);
    }

    const isImageTask = currentTask.type === "createimage";
    const stallTimeoutMs = isImageTask
      ? MONITORING_TIMEOUTS.IMAGE_STALL
      : MONITORING_TIMEOUTS.VIDEO_STALL;
    const zeroTilesTimeoutMs = isImageTask
      ? MONITORING_TIMEOUTS.IMAGE_ZERO_TILES
      : MONITORING_TIMEOUTS.VIDEO_ZERO_TILES;

    const preSubmitIds = state.preSubmitTileIds || new Set();
    const completedTiles = scanForNewlyCompletedTiles(preSubmitIds);
    let foundNewItems = false;

    for (const { tileId, tileEl, isVideo } of completedTiles) {
      if (currentTask.processedTileIds.has(tileId)) {
        continue;
      }

      currentTask.processedTileIds.add(tileId);
      currentTask.foundVideos += 1;
      currentTask._lastFoundAt = Date.now();
      foundNewItems = true;

      const mediaLabel = isVideo ? "Video" : "Image";
      console.log(`✅ New ${mediaLabel} detected: tile ${tileId} (${currentTask.foundVideos}/${currentTask.expectedVideos})`);
      eventBus?.emit(
        EVENTS.OVERLAY_MESSAGE,
        `✅ ${mediaLabel} ${currentTask.foundVideos}/${currentTask.expectedVideos} for Task ${currentTask.index}`,
      );
      chrome.runtime.sendMessage({
        action: "updateStatus",
        status: `${mediaLabel} ${currentTask.foundVideos}/${currentTask.expectedVideos} captured for Task ${currentTask.index}`,
      });

      if (state.settings?.autoDownload !== false) {
        const qualityKey = isVideo ? "videoDownloadQuality" : "imageDownloadQuality";
        const targetQuality =
          currentTask.settings?.[qualityKey] ||
          state.settings?.[qualityKey] ||
          (isVideo ? DOWNLOAD_QUALITY_DEFAULTS.video : DOWNLOAD_QUALITY_DEFAULTS.image);

        downloadQueue.push({ tileEl, targetQuality, label: `${mediaLabel} ${tileId}` });
        runDownloadQueue();
      }

      stateManager?.sendTaskUpdate?.(currentTask);
    }

    const { errorCount, errors } = scanTileErrors(preSubmitIds, currentTask.processedTileIds);
    if (errorCount > 0) {
      if (errors.every((error) => error.type === "DAILY_LIMIT_MODEL_FALLBACK")) {
        console.warn(
          `🍌 Task ${currentTask.index}: ALL tile errors are DAILY_LIMIT_MODEL_FALLBACK — triggering Imagen 4 fallback`,
        );
        stopTileScanner();
        stopErrorMonitoring();
        eventBus?.emit(
          EVENTS.OVERLAY_MESSAGE,
          `⚠️ Nano Banana Pro daily limit reached — switching to Imagen 4 and retrying Task ${currentTask.index}...`,
        );
        chrome.runtime.sendMessage({
          action: "updateStatus",
          status: `Task ${currentTask.index}: Nano Banana Pro limit hit — switching to Imagen 4`,
        });
        eventBus?.emit(EVENTS.DAILY_LIMIT_FALLBACK, {
          task: currentTask,
          taskIndex: state.currentPromptIndex,
          fallbackModel: "imagen4",
        });
        return;
      }

      currentTask.foundVideos += errorCount;
      currentTask._lastFoundAt = Date.now();
      foundNewItems = true;

      for (const error of errors) {
        console.warn(
          `⚠️ Tile error counted for task ${currentTask.index}: [${error.type}] ${error.label} (tile ${error.tileId})`,
        );
      }

      const errorSummary = errors.reduce((summary, error) => {
        summary[error.label] = (summary[error.label] || 0) + 1;
        return summary;
      }, {});

      const lines = Object.entries(errorSummary).map(
        ([label, count]) => `• ${count}× ${label}`,
      );

      eventBus?.emit(EVENTS.OVERLAY_ERROR_BANNER, {
        lines,
        taskIndex: currentTask.index,
      });
      eventBus?.emit(
        EVENTS.OVERLAY_MESSAGE,
        `⚠️ ${errorCount} tile error(s) — ${currentTask.foundVideos}/${currentTask.expectedVideos} resolved`,
      );

      chrome.runtime.sendMessage({
        action: "updateStatus",
        status: `Task ${currentTask.index}: ${errorCount} error tile(s) — ${JSON.stringify(errorSummary)} — ${currentTask.foundVideos}/${currentTask.expectedVideos} resolved`,
      });

      stateManager?.sendTaskUpdate?.(currentTask);
    }

    const globalError = checkGlobalErrors();
    if (globalError.found) {
      console.error(
        `❌ Global error: [${globalError.type}] ${globalError.label} (severity: ${globalError.severity})`,
      );
      eventBus?.emit(EVENTS.OVERLAY_MESSAGE, `❌ ${globalError.label}`);

      if (globalError.severity === "skip_task" && currentTask.status === "current") {
        currentTask.status = "error";
        stateManager?.sendTaskUpdate?.(currentTask);
        emitTaskCompleted(currentTask, state.currentPromptIndex);
        return;
      }

      if (globalError.severity === "pause_processing") {
        eventBus?.emit(EVENTS.PROCESSING_STOP);
        return;
      }

      if (globalError.severity === "terminate") {
        eventBus?.emit(EVENTS.PROCESSING_TERMINATE);
        return;
      }
    }

    const now = Date.now();
    const remainingCount = currentTask.expectedVideos - currentTask.foundVideos;
    const mediaType = isImageTask ? "image" : "video";

    if (currentTask.foundVideos >= currentTask.expectedVideos && currentTask.status === "current") {
      currentTask.status = "processed";
      const outputLabel = currentTask.type === "createimage" ? "image(s)" : "video(s)";
      console.log(
        `✅ Task ${currentTask.index} COMPLETE (${currentTask.foundVideos}/${currentTask.expectedVideos} ${outputLabel})`,
      );
      stateManager?.sendTaskUpdate?.(currentTask);
      emitTaskCompleted(currentTask, state.currentPromptIndex);
      return;
    }

    if (
      currentTask.foundVideos > 0 &&
      currentTask._lastFoundAt &&
      now - currentTask._lastFoundAt > stallTimeoutMs &&
      currentTask.status === "current"
    ) {
      currentTask.status = "processed";
      console.warn(
        `⚠️ Task ${currentTask.index}: stall timeout — ${currentTask.foundVideos}/${currentTask.expectedVideos} ${mediaType}(s) (${remainingCount} failed)`,
      );
      eventBus?.emit(
        EVENTS.OVERLAY_MESSAGE,
        `⚠️ Task ${currentTask.index}: ${currentTask.foundVideos}/${currentTask.expectedVideos} ${mediaType}s — ${remainingCount} failed. Continuing...`,
      );
      chrome.runtime.sendMessage({
        action: "updateStatus",
        status: `Task ${currentTask.index}: partial (${currentTask.foundVideos}/${currentTask.expectedVideos} ${mediaType}s). Moving on.`,
      });
      stateManager?.sendTaskUpdate?.(currentTask);
      emitTaskCompleted(currentTask, state.currentPromptIndex);
      return;
    }

    if (
      currentTask.foundVideos === 0 &&
      currentTask._scanStartedAt &&
      now - currentTask._scanStartedAt > zeroTilesTimeoutMs &&
      currentTask.status === "current"
    ) {
      currentTask.status = "error";
      const minutes = (zeroTilesTimeoutMs / 60_000).toFixed(1);
      console.error(
        `❌ Task ${currentTask.index}: zero ${mediaType}s after ${minutes} min. All ${currentTask.expectedVideos} generations failed.`,
      );
      eventBus?.emit(
        EVENTS.OVERLAY_MESSAGE,
        `❌ Task ${currentTask.index}: no ${mediaType}s generated after ${minutes} min. Skipping...`,
      );
      chrome.runtime.sendMessage({
        action: "updateStatus",
        status: `Task ${currentTask.index}: all ${currentTask.expectedVideos} ${mediaType}(s) failed (${minutes}min). Skipping.`,
      });
      stateManager?.sendTaskUpdate?.(currentTask);
      emitTaskCompleted(currentTask, state.currentPromptIndex);
      return;
    }

    if (currentTask.foundVideos > 0 && currentTask._lastFoundAt && !foundNewItems) {
      const stalledSeconds = Math.round((now - currentTask._lastFoundAt) / 1000);
      const timeoutSeconds = Math.round((stallTimeoutMs - (now - currentTask._lastFoundAt)) / 1000);

      if (stalledSeconds > 0 && stalledSeconds % 30 < 5) {
        console.log(
          `⏳ Task ${currentTask.index} [${mediaType}]: waiting for ${remainingCount} more — stalled ${stalledSeconds}s, timeout in ${timeoutSeconds}s`,
        );
      }
    }
  } catch (error) {
    console.error("❌ Error in periodicTileScanner:", error);
  }
}

export function startTileScanner() {
  stopTileScanner();

  const state = getState?.() || {};
  if (!state.isProcessing && !state.isPausing) {
    return;
  }

  const intervalMs = state.scanIntervalMs || 5_000;
  console.log(`🔍 Starting tile scanner (every ${intervalMs / 1000}s)`);
  tileScannerInterval = setInterval(periodicTileScanner, intervalMs);
}

export function stopTileScanner() {
  if (!tileScannerInterval) {
    return;
  }

  clearInterval(tileScannerInterval);
  tileScannerInterval = null;
  console.log("🛑 Tile scanner stopped");
}

export function checkForQueueFull() {
  try {
    const selectors = getSelectors?.() || {};
    return Boolean($(selectors.QUEUE_FULL_POPUP_XPATH));
  } catch (error) {
    console.warn("⚠️ Error checking for queue full:", error);
    return false;
  }
}

export function checkForPromptPolicyError() {
  try {
    const selectors = getSelectors?.() || {};
    return Boolean($(selectors.PROMPT_POLICY_ERROR_POPUP_XPATH));
  } catch (error) {
    console.warn("⚠️ Error checking for policy error:", error);
    return false;
  }
}

export async function checkForErrorsAfterSubmit() {
  await h(2_000);

  for (let index = 0; index < 10; index += 1) {
    if (checkForQueueFull()) {
      console.warn("⚠️ Queue is full!");
      return "QUEUE_FULL";
    }

    if (checkForPromptPolicyError()) {
      console.warn("⚠️ Prompt violates policy!");
      return "POLICY_PROMPT";
    }

    await h(1_000);
  }

  return null;
}

export function startErrorMonitoring() {
  stopErrorMonitoring();
  console.log("🔍 Starting error monitoring...");

  errorMonitoringInterval = setInterval(async () => {
    const state = getState?.() || {};
    if (!state.isProcessing && !state.isPausing) {
      stopErrorMonitoring();
      return;
    }

    if (!checkForPromptPolicyError()) {
      return;
    }

    console.error("❌ Policy error detected during generation!");
    stopErrorMonitoring();
    stopTileScanner();

    const currentTask = state.taskList?.[state.currentPromptIndex];
    if (currentTask) {
      currentTask.status = "error";
      stateManager?.sendTaskUpdate?.(currentTask);
    }

    eventBus?.emit(
      EVENTS.OVERLAY_MESSAGE,
      "⚠️ Policy violation detected. Skipping this prompt...",
    );
    chrome.runtime.sendMessage({
      action: "updateStatus",
      status: `Policy violation on prompt: "${state.prompts?.[state.currentPromptIndex]?.substring(0, 30)}..."`,
    });

    setTimeout(() => {
      if (!(getState?.() || {}).isProcessing) {
        return;
      }

      setState?.({ isCurrentPromptProcessed: true });
      if (currentTask) {
        eventBus?.emit(EVENTS.TASK_COMPLETED, {
          task: currentTask,
          taskIndex: state.currentPromptIndex,
        });
      }
    }, 3_000);
  }, 2_000);
}

export function stopErrorMonitoring() {
  if (!errorMonitoringInterval) {
    return;
  }

  clearInterval(errorMonitoringInterval);
  errorMonitoringInterval = null;
  console.log("🛑 Error monitoring stopped");
}

export function resetDownloadQueue() {
  downloadQueue = [];
  isDownloadRunnerActive = false;
}

function emitTaskCompleted(task, taskIndex) {
  if (getState?.().isCurrentPromptProcessed) {
    return;
  }

  stopTileScanner();
  stopErrorMonitoring();

  setTimeout(() => {
    const state = getState?.() || {};
    if (state.isProcessing || state.isPausing) {
      eventBus?.emit(EVENTS.TASK_COMPLETED, { task, taskIndex });
    }
  }, 500);
}
