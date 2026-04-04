import {
  DEFAULT_SCAN_INTERVAL_MS,
  DEFAULT_SETTINGS,
  INTER_TASK_DELAY_FALLBACK_MS,
  MAX_RETRIES,
  STORAGE_KEY,
} from "./constants.js";
import { EVENTS } from "./eventBus.js";

let eventBus = null;
let contentDownloadManager = null;

let isUserLoggedIn = false;
let subscriptionStatus = null;
let userId = null;
let isProcessing = false;
let isPausing = false;
let currentPromptIndex = 0;
let prompts = [];
let settings = { ...DEFAULT_SETTINGS };
let isCurrentPromptProcessed = false;
let lastAppliedSettings = null;
let lastAppliedMode = null;
let fallbackModel = null;
let taskList = [];
let currentTaskIndex = 0;
let tileScanInterval = null;
let scanIntervalMs = DEFAULT_SCAN_INTERVAL_MS;
let currentProcessingPrompt = null;
let currentTaskStartTime = null;
let countdownInterval = null;
let maxRetries = MAX_RETRIES;
let currentRetries = 0;
let preSubmitTileIds = new Set();

export function init(eventBusInstance, contentDownloadManagerInstance = null) {
  eventBus = eventBusInstance;
  contentDownloadManager = contentDownloadManagerInstance;
}

export function getState() {
  return {
    isUserLoggedIn,
    subscriptionStatus,
    userId,
    isProcessing,
    isPausing,
    currentPromptIndex,
    prompts,
    settings,
    isCurrentPromptProcessed,
    lastAppliedSettings,
    lastAppliedMode,
    fallbackModel,
    taskList,
    currentTaskIndex,
    tileScanInterval,
    scanIntervalMs,
    currentProcessingPrompt,
    currentTaskStartTime,
    countdownInterval,
    maxRetries,
    currentRetries,
    preSubmitTileIds,
  };
}

export function setState(partial) {
  if (partial.isUserLoggedIn !== undefined) {
    isUserLoggedIn = partial.isUserLoggedIn;
  }

  if (partial.subscriptionStatus !== undefined) {
    subscriptionStatus = partial.subscriptionStatus;
  }

  if (partial.userId !== undefined) {
    userId = partial.userId;
  }

  if (partial.isProcessing !== undefined) {
    const previousValue = isProcessing;
    isProcessing = partial.isProcessing;

    if (previousValue !== isProcessing) {
      chrome.runtime
        .sendMessage({ action: "automationStateChanged", isRunning: isProcessing })
        .catch(() => {});
    }
  }

  if (partial.isPausing !== undefined) {
    isPausing = partial.isPausing;
  }

  if (partial.currentPromptIndex !== undefined) {
    currentPromptIndex = partial.currentPromptIndex;
  }

  if (partial.prompts !== undefined) {
    prompts = partial.prompts;
  }

  if (partial.settings !== undefined) {
    settings = partial.settings;
  }

  if (partial.isCurrentPromptProcessed !== undefined) {
    isCurrentPromptProcessed = partial.isCurrentPromptProcessed;
  }

  if (partial.lastAppliedSettings !== undefined) {
    lastAppliedSettings = partial.lastAppliedSettings;
  }

  if (partial.lastAppliedMode !== undefined) {
    lastAppliedMode = partial.lastAppliedMode;
  }

  if (partial.fallbackModel !== undefined) {
    fallbackModel = partial.fallbackModel;
  }

  if (partial.taskList !== undefined) {
    taskList = partial.taskList;
  }

  if (partial.currentTaskIndex !== undefined) {
    currentTaskIndex = partial.currentTaskIndex;
  }

  if (partial.tileScanInterval !== undefined) {
    tileScanInterval = partial.tileScanInterval;
  }

  if (partial.scanIntervalMs !== undefined) {
    scanIntervalMs = partial.scanIntervalMs;
  }

  if (partial.currentProcessingPrompt !== undefined) {
    currentProcessingPrompt = partial.currentProcessingPrompt;
  }

  if (partial.currentTaskStartTime !== undefined) {
    currentTaskStartTime = partial.currentTaskStartTime;
  }

  if (partial.countdownInterval !== undefined) {
    countdownInterval = partial.countdownInterval;
  }

  if (partial.maxRetries !== undefined) {
    maxRetries = partial.maxRetries;
  }

  if (partial.currentRetries !== undefined) {
    currentRetries = partial.currentRetries;
  }

  if (partial.preSubmitTileIds !== undefined) {
    preSubmitTileIds = partial.preSubmitTileIds;
  }
}

export function getSettings() {
  return settings;
}

export function updateSettings(partial) {
  settings = { ...settings, ...partial };
}

export function getTaskList() {
  return taskList;
}

export function updateTask(index, partial) {
  if (!taskList[index]) {
    return;
  }

  taskList[index] = { ...taskList[index], ...partial };
}

export function getCurrentTask() {
  return taskList[currentPromptIndex] || null;
}

export function getTaskByIndex(index) {
  return taskList.find((task) => task.index === index) || null;
}

export function getCurrentTaskByStatus() {
  return taskList.find((task) => task.status === "current") || null;
}

export function getEffectiveSetting(task, key, fallbackSettings) {
  if (task && task.settings && task.settings[key] !== undefined) {
    return task.settings[key];
  }

  return fallbackSettings[key];
}

export async function saveStateToStorage() {
  const snapshot = {
    status: isProcessing ? "running" : "paused",
    isProcessing,
    prompts: prompts.map((prompt) => prompt),
    currentIndex: currentPromptIndex,
    totalPrompts: prompts.length,
    processedCount: currentPromptIndex,
    currentPrompt: prompts[currentPromptIndex] || "",
    settings,
    startTime: Date.now(),
    lastUpdate: Date.now(),
    taskList,
    currentTaskIndex,
  };

  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: snapshot }, () => resolve(snapshot));
  });
}

export async function loadStateFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      resolve(result[STORAGE_KEY] || null);
    });
  });
}

export async function clearStateFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(STORAGE_KEY, () => resolve());
  });
}

export function clearCountdownTimer() {
  if (!countdownInterval) {
    return;
  }

  clearInterval(countdownInterval);
  countdownInterval = null;
}

export function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function startCountdown(ms, label) {
  clearCountdownTimer();

  let remainingMs = ms;
  const startedAt = Date.now();
  const seconds = (ms / 1000).toFixed(1);

  eventBus?.emit(EVENTS.OVERLAY_MESSAGE, `⏱️ Waiting ${seconds}s before ${label}...`);

  countdownInterval = setInterval(() => {
    const elapsedMs = Date.now() - startedAt;
    remainingMs = ms - elapsedMs;

    if (remainingMs <= 0) {
      clearCountdownTimer();
      eventBus?.emit(EVENTS.OVERLAY_MESSAGE, `▶️ Starting ${label}...`);
      return;
    }

    const nextSeconds = (remainingMs / 1000).toFixed(1);
    eventBus?.emit(EVENTS.OVERLAY_MESSAGE, `⏱️ Waiting ${nextSeconds}s before ${label}...`);
  }, 100);
}

export function getRandomDelay(task, fallbackSettings) {
  let minSeconds = getEffectiveSetting(task, "delayMin", fallbackSettings);
  let maxSeconds = getEffectiveSetting(task, "delayMax", fallbackSettings);

  if (minSeconds === undefined || maxSeconds === undefined) {
    const delayBetweenPrompts =
      getEffectiveSetting(task, "delayBetweenPrompts", fallbackSettings) ||
      INTER_TASK_DELAY_FALLBACK_MS / 1000;
    minSeconds = delayBetweenPrompts / 1000;
    maxSeconds = delayBetweenPrompts / 1000;
  }

  if (minSeconds > maxSeconds) {
    [minSeconds, maxSeconds] = [maxSeconds, minSeconds];
  }

  const delaySeconds = minSeconds + Math.random() * (maxSeconds - minSeconds);
  return Math.round(delaySeconds * 1000);
}

export function sendTaskUpdate(task) {
  if (!task.queueTaskId) {
    return;
  }

  chrome.runtime
    .sendMessage({
      action: "queueTaskUpdate",
      taskId: task.queueTaskId,
      updates: { status: task.status },
    })
    .catch(() => {});
}

export async function verifyAuthenticationState() {
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 3;
    const retryDelayMs = 1_000;

    const attempt = () => {
      chrome.runtime.sendMessage({ action: "getAuthState" }, (response) => {
        if (chrome.runtime.lastError) {
          if (attempts < maxAttempts) {
            attempts += 1;
            setTimeout(attempt, retryDelayMs);
            return;
          }

          resolve({
            isLoggedIn: false,
            subscriptionStatus: null,
            error: "Could not verify authentication state",
          });
          return;
        }

        if (response) {
          isUserLoggedIn = response.isLoggedIn;
          subscriptionStatus = response.subscriptionStatus;
          resolve(response);
          return;
        }

        if (attempts < maxAttempts) {
          attempts += 1;
          setTimeout(attempt, retryDelayMs);
          return;
        }

        resolve({
          isLoggedIn: false,
          subscriptionStatus: null,
          error: "No response from background script",
        });
      });
    };

    attempt();
  });
}

(async () => {
  const storedState = await loadStateFromStorage();
  if (!storedState || storedState.status !== "paused") {
    return;
  }

  prompts = storedState.prompts || [];
  currentPromptIndex = storedState.currentIndex || 0;
  settings = storedState.settings || settings;
  taskList = storedState.taskList || [];
  currentTaskIndex = storedState.currentTaskIndex || 0;
  isProcessing = false;

  console.log(`📋 Restored ${taskList.length} tasks from storage`);

  chrome.runtime.sendMessage({ action: "stateRestored", state: storedState }).catch(() => {});

  if (taskList.length > 0) {
    taskList.forEach((task) => sendTaskUpdate(task));
  }
})();
