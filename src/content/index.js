import * as logger from "./logger.js";
import { FLOW_PAGE_ZOOM_FACTOR, SELECTORS } from "./constants.js";
import { $ } from "./domUtils.js";
import { EVENTS } from "./eventBus.js";
import * as eventBus from "./eventBus.js";
import * as state from "./stateManager.js";
import * as textInjector from "./textInjector.js";
import * as submitHandler from "./submitHandler.js";
import * as settingsApplicator from "./settingsApplicator.js";
import * as imageUploader from "./imageUploader.js";
import * as monitoring from "./monitoring.js";
import * as taskRunner from "./taskRunner.js";
import * as queueController from "./queueController.js";
import * as overlayManager from "./overlayManager.js";
import * as contentDownloadManager from "./contentDownloadManager.js";

function buildContentLogContext() {
  const currentState = state.getState?.() || {};
  const currentTask = currentState.taskList?.[currentState.currentPromptIndex] || null;

  return {
    href: window.location.href,
    isProcessing: currentState.isProcessing,
    isPausing: currentState.isPausing,
    currentPromptIndex: currentState.currentPromptIndex,
    promptCount: currentState.prompts?.length || 0,
    currentTask,
  };
}

function getFlowPageState() {
  const href = window.location.href;
  const isProjectRoute = href.includes("/project/");
  const editorReady = Boolean(document.querySelector('[data-slate-editor="true"]'));
  const newProjectButtonAvailable = Boolean($("//button[.//i[normalize-space()='add_2']]"));

  return {
    href,
    isProjectRoute,
    editorReady,
    newProjectButtonAvailable,
    canStartProcessing: isProjectRoute && editorReady,
  };
}

function sendBridgeHeartbeat(reason) {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return;
  }

  chrome.runtime.sendMessage({
    action: "flowTabHeartbeat",
    reason,
    href: window.location.href,
    timestamp: Date.now(),
    sessionId: logger.getContentSessionId?.() || null,
  }).catch(() => {});
}

logger.installConsoleCapture({ getBaseContext: buildContentLogContext });
logger.installGlobalErrorLogging({ getBaseContext: buildContentLogContext });
logger.logEvent("content.bootstrap", "Flow content script bootstrap started", {
  href: window.location.href,
  sessionId: logger.getContentSessionId(),
});

textInjector.init(state.getState);
submitHandler.init(state.getState);
settingsApplicator.init(state.getState, state.setState);
imageUploader.init(state.getState);

monitoring.init({
  getState: state.getState,
  setState: state.setState,
  getSelectors: () => SELECTORS,
  eventBus,
  stateManager: state,
});

taskRunner.init({
  getState: state.getState,
  setState: state.setState,
  eventBus,
  monitoring,
  stateManager: state,
});

queueController.init({
  stateManager: state,
  eventBus,
  monitoring,
});

overlayManager.init(state, eventBus);
state.init(eventBus, contentDownloadManager);

function buildUnifiedQueueTasks(queueTasks) {
  return queueTasks.map((task) => ({
    queueTaskId: task.id,
    index: task.index,
    prompt: task.prompt,
    type: task.type,
    status: "pending",
    expectedVideos: parseInt(task.settings?.count, 10) || 1,
    foundVideos: 0,
    videoUrls: [],
    settings: task.settings,
    referenceImages: task.referenceImages || null,
  }));
}

function buildLegacyTasks(message, nextSettings) {
  const prompts = message.prompts || [];
  const taskSettings = message.taskSettings || [];
  const processingMode = message.processingMode || "createvideo";
  const imagePairs = message.imagePairs || [];

  if (processingMode === "image" && imagePairs.length > 0) {
    return imagePairs.map((pair, index) => ({
      index: index + 1,
      prompt: pair.prompt,
      image: pair.image,
      type: "image-to-video",
      status: "pending",
      expectedVideos: parseInt(pair.settings?.count, 10) || 1,
      foundVideos: 0,
      videoUrls: [],
      settings: pair.settings,
    }));
  }

  return prompts.map((prompt, index) => {
    const taskSetting = taskSettings[index] || {
      count: nextSettings.flowVideoCount,
      model: nextSettings.flowModel,
      aspectRatio: nextSettings.flowAspectRatio,
    };

    return {
      index: index + 1,
      prompt,
      type: "createvideo",
      status: "pending",
      expectedVideos: parseInt(taskSetting.count || taskSetting.videoCount, 10) || 1,
      foundVideos: 0,
      videoUrls: [],
      settings: taskSetting,
    };
  });
}

async function restorePausedState(sendResponse, ack) {
  const storedState = await state.loadStateFromStorage();
  if (!storedState || storedState.status !== "paused") {
    logger.logEvent("processing.resume_failed", "Resume requested without paused state", {
      storedStateStatus: storedState?.status || null,
    }, "warn");
    sendResponse({ ...ack, error: "No paused state to resume" });
    return;
  }

  state.setState({
    prompts: storedState.prompts || [],
    currentPromptIndex: storedState.currentIndex || 0,
    settings: storedState.settings || state.getSettings(),
    taskList: storedState.taskList || [],
    currentTaskIndex: storedState.currentTaskIndex || 0,
    isProcessing: true,
  });
  state.setState({ isPausing: false });

  chrome.runtime.sendMessage({ action: "setPageZoom", zoomFactor: FLOW_PAGE_ZOOM_FACTOR }).catch(() => {});

  console.log(
    `▶️ Resuming Flow from prompt ${state.getState().currentPromptIndex + 1}/${state.getState().prompts.length}`,
  );
  console.log(`📋 Restored ${state.getState().taskList.length} tasks`);
  logger.logEvent("processing.resumed", "Flow processing resumed from paused state", {
    taskCount: state.getState().taskList.length,
    currentPromptIndex: state.getState().currentPromptIndex,
  });

  state.saveStateToStorage();
  state.getState().taskList.forEach((task) => state.sendTaskUpdate(task));
  eventBus.emit(EVENTS.QUEUE_NEXT);
  sendResponse({ ...ack, resumed: true });
}

async function restoreAfterCacheClean(sendResponse, ack) {
  const storedState = await state.loadStateFromStorage();
  if (!storedState || !["running", "paused"].includes(storedState.status) || !storedState.prompts?.length) {
    console.warn("⚠️ resumeAfterCacheClean: no valid saved state found — cannot auto-resume");
    logger.logEvent("processing.resume_after_cache_clean_failed", "Resume after cache clean failed because state was unavailable", {
      storedStateStatus: storedState?.status || null,
    }, "warn");
    sendResponse({ ...ack, error: "No valid saved state" });
    return;
  }

  state.setState({
    prompts: storedState.prompts || [],
    currentPromptIndex: storedState.currentIndex || 0,
    settings: storedState.settings || state.getSettings(),
    taskList: storedState.taskList || [],
    currentTaskIndex: storedState.currentTaskIndex || 0,
    isProcessing: true,
    isPausing: false,
    lastAppliedSettings: null,
    lastAppliedMode: null,
  });

  chrome.runtime.sendMessage({ action: "setPageZoom", zoomFactor: FLOW_PAGE_ZOOM_FACTOR }).catch(() => {});
  state.saveStateToStorage();
  state.getState().taskList.forEach((task) => state.sendTaskUpdate(task));

  console.log(
    `🔄 resumeAfterCacheClean: restored ${state.getState().taskList.length} tasks, resuming from index ${state.getState().currentPromptIndex}`,
  );
  logger.logEvent("processing.resumed_after_cache_clean", "Flow processing resumed after cache clean", {
    taskCount: state.getState().taskList.length,
    currentPromptIndex: state.getState().currentPromptIndex,
  });

  eventBus.emit(EVENTS.QUEUE_NEXT);
  sendResponse({ ...ack, resumed: true });
}

function clickNewProjectButton(sendResponse) {
  try {
    const button = $("//button[.//i[normalize-space()='add_2']]");
    if (!button) {
      console.warn("⚠️ New project button not found");
      sendResponse({ success: false, error: "Button not found", state: getFlowPageState() });
      return;
    }

    console.log("✅ New project button found. Clicking...");
    button.click();
    sendResponse({ success: true, state: getFlowPageState() });
  } catch (error) {
    console.error("❌ Error clicking new project button:", error);
    sendResponse({ success: false, error: error.message, state: getFlowPageState() });
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const ack = { received: true };

  if (message.action === "startProcessing") {
    logger.logEvent("processing.start_requested", "Start processing request received", {
      useUnifiedQueue: Boolean(message.useUnifiedQueue),
      queueTaskCount: message.queueTasks?.length || 0,
      promptCount: message.prompts?.length || 0,
      settings: message.settings || {},
    });
    state
      .verifyAuthenticationState()
      .then((authState) => {
        if (!authState.isLoggedIn) {
          const error = authState.error || "Authentication required. Please sign in first.";
          logger.logEvent("processing.start_rejected", error, { authState }, "warn");
          chrome.runtime.sendMessage({ action: "error", error });
          sendResponse({ ...ack, error });
          return;
        }

        if (state.getState().isProcessing) {
          logger.logEvent("processing.start_ignored", "Start request ignored because processing is already active", {
            currentPromptIndex: state.getState().currentPromptIndex,
          }, "warn");
          sendResponse({ ...ack, error: "Already processing" });
          return;
        }

        const incomingSettings = message.settings || {};
        const currentSettings = state.getSettings();
        const nextSettings = {
          ...currentSettings,
          ...incomingSettings,
          flowVideoCount: incomingSettings.flowVideoCount || currentSettings.flowVideoCount,
          flowModel: incomingSettings.flowModel || currentSettings.flowModel,
          flowAspectRatio:
            incomingSettings.flowAspectRatio || currentSettings.flowAspectRatio,
        };

        state.setState({
          settings: nextSettings,
          isProcessing: true,
          currentPromptIndex: 0,
          currentTaskIndex: 0,
          lastAppliedSettings: null,
          lastAppliedMode: null,
          fallbackModel: null,
        });

        let taskList;
        let prompts;

        if (message.useUnifiedQueue && Array.isArray(message.queueTasks) && message.queueTasks.length > 0) {
          console.log("🎯 Using UNIFIED QUEUE system");
          taskList = buildUnifiedQueueTasks(message.queueTasks);
          prompts = taskList.map((task) => task.prompt);
          console.log(
            `✅ Created ${taskList.length} tasks from unified queue (${taskList.filter((task) => task.type === "createvideo").length} video, ${taskList.filter((task) => task.type === "createimage").length} image)`,
          );
        } else {
          console.log("⚠️ Using LEGACY task system");
          taskList = buildLegacyTasks(message, nextSettings);
          prompts = taskList.map((task) => task.prompt);
          console.log(`✅ Created ${taskList.length} tasks from legacy flow`);
        }

        state.setState({ taskList, prompts });
        state.saveStateToStorage();
        logger.logEvent("processing.started", "Flow processing started", {
          mode: message.useUnifiedQueue ? "unified" : "legacy",
          taskCount: taskList.length,
          prompts,
          taskList,
        });
        eventBus.emit(EVENTS.QUEUE_NEXT);
        sendResponse({ ...ack, started: true });
      })
      .catch((error) => {
        const messageText = error?.message || "Could not start processing. Please try again.";
        logger.logError("processing.start_exception", error, {
          requestedMode: message.useUnifiedQueue ? "unified" : "legacy",
        });
        chrome.runtime.sendMessage({ action: "error", error: messageText });
        sendResponse({ ...ack, error: messageText });
      });

    return true;
  }

  if (message.action === "resumeProcessing") {
    logger.logEvent("processing.resume_requested", "Resume processing requested");
    restorePausedState(sendResponse, ack);
    return true;
  }

  if (message.action === "resumeAfterCacheClean") {
    logger.logEvent("processing.resume_after_cache_clean_requested", "Resume after cache clean requested");
    restoreAfterCacheClean(sendResponse, ack);
    return true;
  }

  if (message.action === "stopProcessing") {
    logger.logEvent("processing.pause_requested", "Pause processing requested", {
      currentPromptIndex: state.getState().currentPromptIndex,
    });
    eventBus.emit(EVENTS.PROCESSING_STOP);
    state.clearCountdownTimer();
    state.setState({ isProcessing: false, isPausing: true });
    chrome.runtime.sendMessage({ action: "resetPageZoom" }).catch(() => {});
    state.saveStateToStorage();

    if (state.getState().isCurrentPromptProcessed) {
      state.setState({ isPausing: false });
      eventBus.emit(EVENTS.OVERLAY_HIDE);
      chrome.runtime.sendMessage({
        action: "updateStatus",
        status: "Processing paused. Click Resume to continue.",
      });
    } else {
      eventBus.emit(EVENTS.OVERLAY_PAUSING);
      chrome.runtime.sendMessage({
        action: "updateStatus",
        status: "Flow will pause after current prompt completes...",
      });
    }

    sendResponse(ack);
    return false;
  }

  if (message.action === "terminateProcessing") {
    logger.logEvent("processing.terminate_requested", "Terminate processing requested", {
      currentPromptIndex: state.getState().currentPromptIndex,
      pendingTasks: state.getState().taskList?.length || 0,
    }, "warn");
    chrome.runtime.sendMessage({ action: "resetPageZoom" }).catch(() => {});
    state.setState({
      isProcessing: false,
      isPausing: false,
      prompts: [],
      currentPromptIndex: 0,
      taskList: [],
      currentTaskIndex: 0,
      lastAppliedSettings: null,
      lastAppliedMode: null,
      fallbackModel: null,
    });
    state.clearStateFromStorage();
    eventBus.emit(EVENTS.PROCESSING_TERMINATE);
    eventBus.emit(EVENTS.OVERLAY_HIDE);
    sendResponse({ ...ack, terminated: true });
    return false;
  }

  if (message.action === "getStoredState") {
    state.loadStateFromStorage().then((storedState) => {
      sendResponse({ ...ack, state: storedState });
    });
    return true;
  }

  if (message.action === "authStateChanged") {
    state.setState({
      isUserLoggedIn: message.isLoggedIn,
      subscriptionStatus: message.subscriptionStatus,
      userId: message.userId,
    });
    sendResponse({ success: true });
    return false;
  }

  if (message.action === "activateContentDownloader") {
    contentDownloadManager.toggle();
    sendResponse({ ...ack, toggled: true });
    return false;
  }

  if (message.action === "getFlowPageState") {
    sendResponse({ ...ack, state: getFlowPageState() });
    return false;
  }

  if (message.action === "clickNewProjectButton") {
    clickNewProjectButton(sendResponse);
    return true;
  }

  if (message.action === "pingFlowContent") {
    sendResponse({ pong: true });
    return false;
  }

  sendResponse(ack);
  return false;
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    return;
  }

  sendBridgeHeartbeat("visibilitychange");

  setTimeout(() => {
    state.verifyAuthenticationState().then((authState) => {
      chrome.runtime.sendMessage({ action: "authStateRefreshed", authState }).catch(() => {});
    });
  }, 500);
});

window.addEventListener("focus", () => {
  sendBridgeHeartbeat("window-focus");

  setTimeout(() => {
    state.verifyAuthenticationState().then((authState) => {
      chrome.runtime.sendMessage({ action: "authStateRefreshed", authState }).catch(() => {});
    });
  }, 500);
});

chrome.runtime.sendMessage({ action: "getAuthState" }, (response) => {
  if (!response) {
    return;
  }

  state.setState({
    isUserLoggedIn: response.isLoggedIn,
    subscriptionStatus: response.subscriptionStatus,
  });
});

console.log("✅ Flow Automation bootstrap complete — all modules wired");
console.log("📦 Layers: core | interactions (+ imageUploader) | workflow | ui (+ contentDownloadManager)");
logger.logEvent("content.bootstrap_complete", "Flow automation bootstrap complete", {
  href: window.location.href,
});
sendBridgeHeartbeat("bootstrap-complete");