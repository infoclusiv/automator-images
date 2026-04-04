import { MODEL_DISPLAY_NAMES } from "./constants.js";
import { $, h, re } from "./domUtils.js";
import { pointerClick, toggleTab } from "./clickHelper.js";

let getState = null;
let setState = null;

export function init(getStateFn, setStateFn) {
  getState = getStateFn;
  setState = setStateFn;
}

function isProcessingStopped() {
  const state = getState?.() || {};
  return !state.isProcessing && !state.isPausing;
}

function settingsAreEqual(a, b) {
  if (!a || !b) {
    return false;
  }

  return (
    a.count === b.count &&
    a.model === b.model &&
    a.aspectRatio === b.aspectRatio &&
    a.taskType === b.taskType &&
    a.videoSubMode === b.videoSubMode
  );
}

export async function applyUnifiedSettings(taskType = "createvideo", settings = {}) {
  try {
    const state = getState?.() || {};
    if (!state.isProcessing && !state.isPausing) {
      console.log("⏸️ Settings application cancelled — processing stopped");
      return false;
    }

    const count = settings.count || "1";
    const model = settings.model || "default";
    const aspectRatio = settings.aspectRatio || "landscape";
    const videoSubMode = settings.videoSubMode || "frames";
    const isImageTask = taskType === "createimage";
    const outputIcon = isImageTask ? "image" : "videocam";
    const outputLabel = isImageTask ? "Image" : "Video";
    const nextSettings = { count, model, aspectRatio, taskType, videoSubMode };

    if (state.lastAppliedSettings && settingsAreEqual(nextSettings, state.lastAppliedSettings)) {
      console.log("⏩ Settings unchanged from previous task — SKIPPING (~5s saved)");
      return true;
    }

    console.log(
      `⚙️ Applying settings: type=${taskType}, count=${count}, model=${model}, ratio=${aspectRatio}, subMode=${isImageTask ? "n/a" : videoSubMode}`,
    );

    const panelTrigger = $(
      "//button[@aria-haspopup='menu' and .//div[@data-type='button-overlay'] and text()[normalize-space() != '']]",
    );
    if (!panelTrigger) {
      console.warn("⚠️ Main settings trigger button not found");
      return false;
    }

    pointerClick(panelTrigger);
    console.log("✅ Step 1: Opened main control panel");
    await h(600);

    if (!document.querySelector('[role="menu"][data-state="open"]')) {
      console.warn("⚠️ Control panel menu did not open");
      return false;
    }

    const outputTypeTab = $(
      `//button[@role='tab' and contains(@class,'flow_tab_slider_trigger') and .//i[normalize-space(text())='${outputIcon}']]`,
    );
    if (outputTypeTab) {
      if (toggleTab(outputTypeTab)) {
        console.log(`✅ Step 2: Selected output type: ${outputLabel}`);
        await h(400);
      } else {
        console.log(`⏩ Step 2: Output type already: ${outputLabel}`);
      }
    } else {
      console.warn(`⚠️ Output type tab "${outputLabel}" not found`);
    }

    if (isProcessingStopped()) {
      re();
      return false;
    }

    if (isImageTask) {
      console.log("⏩ Step 3: Skipped (image task — no sub-mode)");
    } else {
      const subModeIcon = videoSubMode === "ingredients" ? "chrome_extension" : "crop_free";
      const subModeLabel = videoSubMode === "ingredients" ? "Ingredients" : "Frames";
      const subModeTab = $(
        `//button[@role='tab' and contains(@class,'flow_tab_slider_trigger') and .//i[normalize-space(text())='${subModeIcon}']]`,
      );

      if (subModeTab) {
        if (toggleTab(subModeTab)) {
          console.log(`✅ Step 3: Selected video sub-mode: ${subModeLabel}`);
          await h(300);
        } else {
          console.log(`⏩ Step 3: Sub-mode already: ${subModeLabel}`);
        }
      } else {
        console.warn(`⚠️ Sub-mode tab "${subModeLabel}" not found`);
      }
    }

    if (isProcessingStopped()) {
      re();
      return false;
    }

    const ratioIcon = aspectRatio === "portrait" ? "crop_9_16" : "crop_16_9";
    const ratioLabel = aspectRatio === "portrait" ? "Portrait" : "Landscape";
    const ratioTab = $(
      `//button[@role='tab' and contains(@class,'flow_tab_slider_trigger') and .//i[normalize-space(text())='${ratioIcon}']]`,
    );

    if (ratioTab) {
      if (toggleTab(ratioTab)) {
        console.log(`✅ Step 4: Selected aspect ratio: ${ratioLabel}`);
        await h(300);
      } else {
        console.log(`⏩ Step 4: Aspect ratio already: ${ratioLabel}`);
      }
    } else {
      console.warn(`⚠️ Aspect ratio tab "${ratioLabel}" not found`);
    }

    if (isProcessingStopped()) {
      re();
      return false;
    }

    const countLabel = `x${count}`;
    const countTab = $(
      `//button[@role='tab' and contains(@class,'flow_tab_slider_trigger') and normalize-space(text())='${countLabel}']`,
    );

    if (countTab) {
      if (toggleTab(countTab)) {
        console.log(`✅ Step 5: Selected count: ${countLabel}`);
        await h(300);
      } else {
        console.log(`⏩ Step 5: Count already: ${countLabel}`);
      }
    } else {
      console.warn(`⚠️ Count tab "${countLabel}" not found`);
    }

    if (isProcessingStopped()) {
      re();
      return false;
    }

    const modelLabel = MODEL_DISPLAY_NAMES[model] || (isImageTask ? "Nano Banana Pro" : "Veo 3.1 - Fast");
    const modelTrigger = $(
      "//div[@role='menu' and @data-state='open']//button[@aria-haspopup='menu' and .//div[@data-type='button-overlay']]",
    );

    if (!modelTrigger) {
      console.warn("⚠️ Model dropdown trigger not found inside control panel");
    } else {
      pointerClick(modelTrigger);
      console.log("✅ Step 6a: Opened model dropdown");
      await h(500);

      const modelOption = $(
        `//div[@role='menuitem']//button[.//span[contains(normalize-space(text()),'${modelLabel}')]]`,
      );

      if (modelOption) {
        modelOption.click();
        console.log(`✅ Step 6b: Selected model: ${modelLabel}`);
        await h(400);
      } else {
        console.warn(`⚠️ Model option "${modelLabel}" not found`);
        re();
        await h(300);
      }
    }

    re();
    await h(600);
    console.log("✅ Step 7: Control panel closed");

    if (setState) {
      setState({ lastAppliedSettings: nextSettings, lastAppliedMode: taskType });
      console.log("💾 Settings cached for next task comparison");
    }

    return true;
  } catch (error) {
    console.error("❌ Error applying unified Flow settings:", error);
    re();
    return false;
  }
}
