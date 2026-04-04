import { EVENTS } from "./eventBus.js";
import { h } from "./domUtils.js";
import { attachAllImages, clearExistingReferences, uploadAllImages } from "./imageUploader.js";
import { applyUnifiedSettings } from "./settingsApplicator.js";
import { clickSubmit } from "./submitHandler.js";
import { injectText } from "./textInjector.js";

let getState = null;
let setState = null;
let eventBus = null;
let monitoring = null;
let stateManager = null;

export function init({
  getState: getStateFn,
  setState: setStateFn,
  eventBus: eventBusInstance,
  monitoring: monitoringModule,
  stateManager: stateManagerModule,
}) {
  getState = getStateFn;
  setState = setStateFn;
  eventBus = eventBusInstance;
  monitoring = monitoringModule;
  stateManager = stateManagerModule;

  eventBus.on(EVENTS.DAILY_LIMIT_FALLBACK, ({ task, taskIndex, fallbackModel }) => {
    console.warn(
      `🔄 DAILY_LIMIT_FALLBACK received — switching all tasks to model: ${fallbackModel}`,
    );

    const state = getState?.();
    if (!state) {
      return;
    }

    setState?.({ fallbackModel });

    const patchedTasks = state.taskList.map((item) => {
      if (item.status !== "pending" && item.status !== "current") {
        return item;
      }

      return {
        ...item,
        settings: { ...item.settings, model: fallbackModel },
        processedTileIds: new Set(),
        foundVideos: 0,
        _scanStartedAt: null,
        _lastFoundAt: null,
        status: item.index === task.index ? "pending" : item.status,
      };
    });

    setState?.({ taskList: patchedTasks, lastAppliedSettings: null });

    console.log(
      `✅ Model patched to "${fallbackModel}" on ${patchedTasks.filter((item) => item.status === "pending" || item.status === "current").length} task(s)`,
    );

    setTimeout(() => {
      const currentState = getState?.();
      if (!currentState?.isProcessing && !currentState?.isPausing) {
        return;
      }

      const currentTask = currentState.taskList.find((item) => item.index === task.index);
      if (!currentTask) {
        return;
      }

      console.log(`🔁 Re-running Task ${currentTask.index} with fallback model "${fallbackModel}"...`);
      eventBus?.emit(
        EVENTS.OVERLAY_MESSAGE,
        `🔁 Retrying Task ${currentTask.index} with Imagen 4...`,
      );
      runTask(currentTask, taskIndex);
    }, 2_000);
  });
}

function isProcessingStopped() {
  const state = getState?.() || {};
  return !state.isProcessing && !state.isPausing;
}

export async function runTask(task, taskIndex) {
  if (!task) {
    console.error("❌ TaskRunner: No task provided");
    eventBus?.emit(EVENTS.TASK_ERROR, { task: null, reason: "no_task" });
    return;
  }

  let nextTask = task;
  const prompt = nextTask.prompt;
  const isImageTask = nextTask.type === "createimage";
  const taskType = isImageTask ? "createimage" : "createvideo";
  const mediaType = isImageTask ? "image" : "video";

  setState?.({ currentProcessingPrompt: prompt, currentTaskStartTime: Date.now() });

  const overlayMessage = `Processing ${taskType} task ${nextTask.index}: "${prompt?.substring(0, 30)}${prompt?.length > 30 ? "..." : ""}"`;
  console.log(`📌 Task ${nextTask.index} started`);
  eventBus?.emit(EVENTS.OVERLAY_MESSAGE, overlayMessage);

  const fallbackModel = getState?.()?.fallbackModel;
  if (fallbackModel && nextTask.settings?.model !== fallbackModel) {
    console.log(
      `🔄 Applying fallback model override: ${nextTask.settings?.model ?? "default"} → ${fallbackModel}`,
    );
    nextTask = {
      ...nextTask,
      settings: {
        ...nextTask.settings,
        model: fallbackModel,
      },
    };
  }

  console.log(`⚙️ Step 0/4: Applying settings for Task ${nextTask.index} (${taskType})...`);
  eventBus?.emit(EVENTS.OVERLAY_MESSAGE, `Step 0/4: Applying settings for ${taskType}...`);

  if (await applyUnifiedSettings(nextTask.type || "createvideo", nextTask.settings || {})) {
    console.log(
      `✅ Settings applied: ${taskType}, ${nextTask.settings?.count || "1"} ${mediaType}(s), ${nextTask.settings?.model || "default"}, ${nextTask.settings?.aspectRatio || "landscape"}`,
    );
  } else {
    if (isProcessingStopped()) {
      console.log("⏸️ Processing stopped during settings application");
      return;
    }

    console.warn("⚠️ Failed to apply settings, continuing anyway...");
  }

  await h(500);

  if (nextTask.referenceImages?.images?.length > 0) {
    const mode = nextTask.referenceImages.mode || "ingredients";
    const images = nextTask.referenceImages.images.filter(Boolean);

    if (images.length > 0) {
      console.log(
        `🧹 Step 1.5 pre-flight: Clearing any existing attached references for Task ${nextTask.index}...`,
      );
      eventBus?.emit(EVENTS.OVERLAY_MESSAGE, "Step 1.5/4: Clearing previous references...");
      await clearExistingReferences();

      console.log(
        `🖼️ Step 1.5a/4: Checking/uploading ${images.length} file(s) into Flow [${mode}] for Task ${nextTask.index}...`,
      );
      eventBus?.emit(
        EVENTS.OVERLAY_MESSAGE,
        `Step 1.5/4: Uploading ${images.length} reference image(s) to Flow library...`,
      );

      if (!(await uploadAllImages(images))) {
        if (isProcessingStopped()) {
          console.log("⏸️ Processing stopped during file injection");
          return;
        }

        console.error("❌ File injection failed — triggering retry");
        eventBus?.emit(EVENTS.TASK_ERROR, {
          task: nextTask,
          taskIndex,
          reason: "image_upload_failed",
        });
        return;
      }

      console.log(
        `🔗 Step 1.5b/4: Attaching ${images.length} image(s) as references [${mode}]...`,
      );
      eventBus?.emit(
        EVENTS.OVERLAY_MESSAGE,
        `Step 1.5/4: Attaching ${images.length} reference image(s)...`,
      );

      if (!(await attachAllImages(images, mode))) {
        if (isProcessingStopped()) {
          console.log("⏸️ Processing stopped during reference attachment");
          return;
        }

        console.error("❌ Reference attachment failed — triggering retry");
        eventBus?.emit(EVENTS.TASK_ERROR, {
          task: nextTask,
          taskIndex,
          reason: "image_attach_failed",
        });
        return;
      }

      console.log(`✅ All ${images.length} reference image(s) [${mode}] uploaded and attached`);
      await h(500);
    }
  }

  console.log(`📝 Step 2/4: Injecting prompt for Task ${nextTask.index}...`);
  eventBus?.emit(EVENTS.OVERLAY_MESSAGE, "Step 2/4: Adding prompt...");

  if (!(await injectText(prompt))) {
    console.error("❌ Text injection failed — triggering retry");
    eventBus?.emit(EVENTS.TASK_ERROR, {
      task: nextTask,
      taskIndex,
      reason: "inject_failed",
    });
    return;
  }

  await h(1_000);
  stateManager?.updateTask?.(taskIndex, { status: "current" });

  eventBus?.emit(EVENTS.TASK_START, {
    task: stateManager?.getCurrentTask?.() ?? nextTask,
    taskIndex,
  });

  console.log(`📋 Task ${nextTask.index} status: current`);
  console.log(`🚀 Step 3/4: Submitting Task ${nextTask.index}...`);
  eventBus?.emit(EVENTS.OVERLAY_MESSAGE, "Step 3/4: Submitting...");

  if (monitoring?.snapshotExistingTileIds) {
    const preSubmitIds = monitoring.snapshotExistingTileIds();
    setState?.({ preSubmitTileIds: preSubmitIds });
    console.log(`📸 Pre-submit tile snapshot: ${preSubmitIds.size} existing tile(s)`);
  }

  if (!(await clickSubmit())) {
    console.error("❌ Submit failed — triggering retry");
    eventBus?.emit(EVENTS.TASK_ERROR, {
      task: nextTask,
      taskIndex,
      reason: "submit_failed",
    });
    return;
  }

  console.log(`✅ Submitted prompt: "${prompt}"`);
  console.log("🔍 Step 4/4: Monitoring for completion...");
  eventBus?.emit(
    EVENTS.OVERLAY_MESSAGE,
    isImageTask ? "Step 4/4: Monitoring image generation..." : "Step 4/4: Monitoring video generation...",
  );

  const errorAfterSubmit = monitoring?.checkForErrorsAfterSubmit
    ? await monitoring.checkForErrorsAfterSubmit()
    : null;

  if (errorAfterSubmit === "QUEUE_FULL") {
    console.warn("⚠️ Queue full — waiting 30 seconds before retry...");
    eventBus?.emit(EVENTS.OVERLAY_MESSAGE, "Queue is full. Waiting 30 seconds before retry...");
    await h(30_000);
    runTask(nextTask, taskIndex);
    return;
  }

  if (errorAfterSubmit === "POLICY_PROMPT") {
    console.error("❌ Prompt violates policy — skipping");
    eventBus?.emit(EVENTS.OVERLAY_MESSAGE, "⚠️ Policy violation detected. Skipping this prompt...");
    stateManager?.updateTask?.(taskIndex, { status: "error" });
    stateManager?.sendTaskUpdate?.(nextTask);
    eventBus?.emit(EVENTS.TASK_SKIPPED, {
      task: nextTask,
      taskIndex,
      reason: "policy_violation",
    });

    chrome.runtime.sendMessage({
      action: "updateStatus",
      status: `Policy violation on prompt: "${prompt?.substring(0, 30)}..."`,
    });

    await h(3_000);
    setState?.({ isCurrentPromptProcessed: true });
    eventBus?.emit(EVENTS.TASK_COMPLETED, { task: nextTask, taskIndex });
    return;
  }

  console.log("✅ No errors detected, starting tile scanner...");
  monitoring?.startTileScanner?.();
  monitoring?.startErrorMonitoring?.();

  const generationMessage = isImageTask
    ? "Generating images... scanning for images"
    : "Generating flow... scanning for videos";
  console.log(`⏳ ${generationMessage}`);
  eventBus?.emit(EVENTS.OVERLAY_MESSAGE, generationMessage);
  setState?.({ currentRetries: 0 });
}
