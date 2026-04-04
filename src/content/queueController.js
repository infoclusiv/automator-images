import {
  FLOW_PAGE_ZOOM_FACTOR,
  INTER_TASK_DELAY_FALLBACK_MS,
  MAX_RETRIES,
  RETRY_DELAY_MS,
} from "./constants.js";
import { EVENTS } from "./eventBus.js";
import { runTask } from "./taskRunner.js";

let stateManager = null;
let eventBus = null;
let monitoring = null;
let interTaskTimer = null;

export function init({ stateManager: stateManagerModule, eventBus: eventBusInstance, monitoring: monitoringModule }) {
  stateManager = stateManagerModule;
  eventBus = eventBusInstance;
  monitoring = monitoringModule;

  eventBus.on(EVENTS.QUEUE_NEXT, () => processNextTask());
  eventBus.on(EVENTS.TASK_START, onTaskStart);
  eventBus.on(EVENTS.TASK_COMPLETED, onTaskCompleted);
  eventBus.on(EVENTS.TASK_SKIPPED, onTaskSkipped);
  eventBus.on(EVENTS.TASK_ERROR, onTaskError);
  eventBus.on(EVENTS.PROCESSING_STOP, cancelInterTaskDelay);
  eventBus.on(EVENTS.PROCESSING_TERMINATE, cancelInterTaskDelay);
}

function processNextTask() {
  const state = stateManager.getState();
  stateManager.setState({ isCurrentPromptProcessed: false });

  const totalTasks = state.taskList.length > 0 ? state.taskList.length : state.prompts.length;
  if (!state.isProcessing || state.currentPromptIndex >= totalTasks) {
    stateManager.setState({ isProcessing: false });
    updateProgressBroadcast();
    eventBus.emit(EVENTS.OVERLAY_HIDE);

    if (state.currentPromptIndex >= totalTasks) {
      chrome.runtime.sendMessage({
        action: "updateStatus",
        status: "All flow prompts completed successfully!",
      });
      chrome.runtime.sendMessage({ action: "resetPageZoom" }).catch(() => {});
      stateManager.clearStateFromStorage?.();
      eventBus.emit(EVENTS.PROCESSING_COMPLETE);
    }

    return;
  }

  const prompt = state.prompts[state.currentPromptIndex] || "";
  const shortPrompt = prompt.length > 30 ? `${prompt.substring(0, 30)}...` : prompt;
  eventBus.emit(EVENTS.OVERLAY_SHOW, `Processing Flow: "${shortPrompt}"`);

  if (state.currentPromptIndex === 0) {
    chrome.runtime
      .sendMessage({ action: "setPageZoom", zoomFactor: FLOW_PAGE_ZOOM_FACTOR })
      .catch(() => {});
  }

  chrome.storage.local.get("quotaStatus", (result) => {
    const quotaStatus = result.quotaStatus || { canContinue: true, isPaid: false };
    if (quotaStatus.isPaid) {
      runCurrentTask();
      return;
    }

    if (!quotaStatus.canContinue) {
      stateManager.setState({ isProcessing: false });
      eventBus.emit(EVENTS.OVERLAY_HIDE);

      const currentTask = stateManager.getCurrentTask?.();
      if (currentTask) {
        stateManager.updateTask?.(state.currentPromptIndex, { status: "error" });
        stateManager.sendTaskUpdate?.(currentTask);
      }

      chrome.runtime.sendMessage({
        action: "error",
        error: "Your quota has been depleted. Please upgrade to continue.",
      });
      return;
    }

    runCurrentTask();
  });
}

async function onTaskCompleted({ task, taskIndex }) {
  const state = stateManager.getState();
  if (state.isCurrentPromptProcessed) {
    return;
  }

  console.log(`✅ Queue: Task ${task?.index} completed — moving to next`);

  if (task?.queueTaskId) {
    chrome.runtime
      .sendMessage({ action: "taskStatusUpdate", taskId: task.queueTaskId, status: "processed" })
      .catch(() => {});
  }

  eventBus.emit(EVENTS.OVERLAY_MESSAGE, `✅ All outputs captured for Task ${task?.index}`);
  chrome.runtime.sendMessage({
    action: "updateStatus",
    status: `All outputs captured for prompt: "${state.prompts?.[state.currentPromptIndex]?.substring(0, 30)}..."`,
  });

  stateManager.setState({ isCurrentPromptProcessed: true, currentProcessingPrompt: null });
  monitoring?.stopTileScanner?.();
  monitoring?.stopErrorMonitoring?.();

  setTimeout(() => {
    const nextState = stateManager.getState();
    if (nextState.isProcessing || nextState.isPausing) {
      advanceAfterTaskCompletion();
    }
  }, 1_000);
}

function onTaskSkipped({ task, taskIndex }) {
  if (task?.queueTaskId) {
    chrome.runtime
      .sendMessage({ action: "taskStatusUpdate", taskId: task.queueTaskId, status: "processed" })
      .catch(() => {});
  }

  onTaskCompleted({ task, taskIndex });
}

function onTaskError({ task, taskIndex, reason }) {
  console.warn(`⚠️ Queue: Task ${task?.index} error — reason: ${reason}`);

  if (stateManager.getState().currentRetries >= MAX_RETRIES - 1 && task?.queueTaskId) {
    chrome.runtime
      .sendMessage({ action: "taskStatusUpdate", taskId: task.queueTaskId, status: "error" })
      .catch(() => {});
  }

  retryOrFail();
}

function onTaskStart({ task }) {
  if (!task?.queueTaskId) {
    return;
  }

  chrome.runtime
    .sendMessage({ action: "taskStatusUpdate", taskId: task.queueTaskId, status: "current" })
    .catch(() => {});
}

function retryOrFail() {
  const state = stateManager.getState();
  if (state.currentRetries < MAX_RETRIES) {
    stateManager.setState({ currentRetries: state.currentRetries + 1 });
    const message = `Retry ${stateManager.getState().currentRetries}/${MAX_RETRIES}: Waiting for Flow Labs interface...`;

    eventBus.emit(EVENTS.OVERLAY_MESSAGE, message);
    chrome.runtime.sendMessage({ action: "updateStatus", status: message });
    setTimeout(processNextTask, RETRY_DELAY_MS);
    return;
  }

  eventBus.emit(EVENTS.OVERLAY_HIDE);

  const currentTask = stateManager.getCurrentTask?.();
  if (currentTask) {
    stateManager.updateTask?.(state.currentPromptIndex, { status: "error" });
    stateManager.sendTaskUpdate?.(currentTask);
  }

  chrome.runtime.sendMessage({
    action: "error",
    error: "Unable to find Flow Labs interface elements after multiple attempts. Make sure you are on the correct page.",
  });

  stateManager.setState({ isProcessing: false });
}

function cancelInterTaskDelay() {
  if (interTaskTimer !== null) {
    clearTimeout(interTaskTimer);
    interTaskTimer = null;
    console.log("⏹️ QueueController: inter-task delay cancelled");
  }

  stateManager.clearCountdownTimer?.();
}

function updateProgressBroadcast() {
  const state = stateManager.getState();
  const processed = Math.min(state.currentPromptIndex, state.prompts.length);

  if (state.isProcessing || state.isPausing) {
    eventBus.emit(EVENTS.PROGRESS_UPDATE, { currentIndex: processed });
  }

  chrome.runtime.sendMessage({
    action: "updateProgress",
    currentPrompt: processed < state.prompts.length ? state.prompts[processed] : "",
    processed,
    total: state.prompts.length,
  });
}

function runCurrentTask() {
  const state = stateManager.getState();
  const currentTask = stateManager.getCurrentTask?.();
  if (!currentTask) {
    console.error("❌ QueueController: No task at current index");
    retryOrFail();
    return;
  }

  runTask(currentTask, state.currentPromptIndex);
}

async function advanceAfterTaskCompletion() {
  const state = stateManager.getState();
  if (!state.isCurrentPromptProcessed) {
    return;
  }

  monitoring?.stopTileScanner?.();

  const nextIndex = state.currentPromptIndex + 1;
  const totalTasks = state.taskList.length > 0 ? state.taskList.length : state.prompts.length;

  stateManager.setState({ currentPromptIndex: nextIndex });
  updateProgressBroadcast();
  stateManager.saveStateToStorage?.();

  if (!stateManager.getState().isProcessing) {
    monitoring?.stopTileScanner?.();
    monitoring?.stopErrorMonitoring?.();
    stateManager.setState({ isPausing: false });
    eventBus.emit(EVENTS.OVERLAY_HIDE);
    chrome.runtime.sendMessage({
      action: "updateStatus",
      status: "Processing paused. Click Resume to continue.",
    });
    return;
  }

  const autoClearCache = state.settings?.autoClearCache ?? false;
  const autoClearCacheInterval = state.settings?.autoClearCacheInterval ?? 50;

  if (autoClearCache && nextIndex > 0 && nextIndex % autoClearCacheInterval === 0 && nextIndex < totalTasks) {
    console.log(
      `🗑️ Auto-clear cache milestone: task ${nextIndex}/${totalTasks} — sending clearFlowCache (fire-and-forget)`,
    );
    eventBus.emit(
      EVENTS.OVERLAY_MESSAGE,
      `🧹 Clearing Flow cache (milestone: task ${nextIndex}/${totalTasks})...`,
    );
    chrome.runtime.sendMessage({
      action: "updateStatus",
      status: `Task ${nextIndex} complete — clearing Flow cache for performance...`,
    });
    chrome.runtime.sendMessage({ action: "clearFlowCache" }, () => {
      if (chrome.runtime.lastError) {
      }
    });
    return;
  }

  if (nextIndex >= totalTasks) {
    console.log("✅ All tasks done — skipping inter-task countdown");
    processNextTask();
    return;
  }

  const nextState = stateManager.getState();
  const nextTask =
    nextState.taskList.length > 0 && nextState.currentPromptIndex < nextState.taskList.length
      ? nextState.taskList[nextState.currentPromptIndex]
      : null;

  const delayMs = stateManager.getRandomDelay
    ? stateManager.getRandomDelay(nextTask, nextState.settings)
    : INTER_TASK_DELAY_FALLBACK_MS;

  eventBus.emit(EVENTS.COUNTDOWN_START, { ms: delayMs, label: "next prompt" });
  interTaskTimer = setTimeout(() => {
    interTaskTimer = null;
    if (stateManager.getState().isProcessing) {
      processNextTask();
    }
  }, delayMs);
}