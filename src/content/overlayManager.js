import { EVENTS } from "./eventBus.js";

let getState = null;
let setState = null;
let clearCountdownTimer = null;
let stateManager = null;

export function init(stateManagerModule, eventBus) {
  getState = stateManagerModule.getState;
  setState = stateManagerModule.setState;
  clearCountdownTimer = stateManagerModule.clearCountdownTimer;
  stateManager = stateManagerModule;

  eventBus.on(EVENTS.OVERLAY_SHOW, (message) => showOverlay(message));
  eventBus.on(EVENTS.OVERLAY_HIDE, () => hideOverlay());
  eventBus.on(EVENTS.OVERLAY_MESSAGE, (message) => updateMessage(message));
  eventBus.on(EVENTS.OVERLAY_PAUSING, () => showPausingState());
  eventBus.on(EVENTS.OVERLAY_ERROR_BANNER, (payload) => showErrorBanner(payload));
  eventBus.on(EVENTS.OVERLAY_ERROR_BANNER_CLEAR, () => clearErrorBanner());
  eventBus.on(EVENTS.COUNTDOWN_START, ({ ms, label }) => {
    stateManager.startCountdown(ms, label);
  });
  eventBus.on(EVENTS.PROGRESS_UPDATE, ({ currentIndex }) => {
    updateMessage(undefined, currentIndex);
  });
}

function injectOverlayStyles() {
  if (document.getElementById("labs-flow-overlay-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "labs-flow-overlay-styles";
  style.textContent = `
    @keyframes materialFadeIn {
      0% {
        opacity: 0;
        transform: scale(0.9) translateY(20px);
      }
      100% {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    @keyframes iconShimmer {
      0%   { transform: translateX(-100%); }
      100% { transform: translateX(200%); }
    }

    @keyframes progressPulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.7; }
    }
  `;

  document.head.appendChild(style);
}

function injectPausingSpinnerStyles() {
  if (document.getElementById("pausing-spinner-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "pausing-spinner-style";
  style.textContent = `
    @keyframes pausingSpinner {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }

    .pausing-spinner {
      animation: pausingSpinner 1s linear infinite;
    }
  `;

  document.head.appendChild(style);
}

export function showOverlay(message) {
  if (document.getElementById("labs-flow-overlay")) {
    updateMessage(message);
    return;
  }

  injectOverlayStyles();

  const state = getState();
  const overlay = document.createElement("div");
  overlay.id = "labs-flow-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, rgba(186, 230, 253, 0.15), rgba(251, 191, 36, 0.07));
    backdrop-filter: blur(3px);
    z-index: 999999999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: 'Google Sans', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
  `;

  const card = document.createElement("div");
  card.id = "labs-flow-message";
  card.style.cssText = `
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.85));
    backdrop-filter: blur(20px);
    padding: 32px;
    border-radius: 24px;
    max-width: 480px;
    min-width: 360px;
    text-align: center;
    box-shadow:
      0 24px 48px rgba(186, 230, 253, 0.25),
      0 8px 16px rgba(251, 191, 36, 0.10),
      inset 0 1px 0 rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(186, 230, 253, 0.2);
    transform: scale(0.95);
    animation: materialFadeIn 0.4s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
  `;

  const iconBox = document.createElement("div");
  iconBox.style.cssText = `
    width: 80px;
    height: 80px;
    margin: 0 auto 24px auto;
    background: linear-gradient(135deg, #bae6fd, #38bdf8);
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 24px rgba(56, 189, 248, 0.35);
    position: relative;
    overflow: hidden;
  `;

  const icon = document.createElement("div");
  icon.innerHTML = `
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0
           01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0
           00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  `;
  iconBox.appendChild(icon);

  const shimmer = document.createElement("div");
  shimmer.style.cssText = `
    position: absolute;
    inset: 0;
    background: linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.2) 50%, transparent 70%);
    animation: iconShimmer 2s infinite;
  `;
  iconBox.appendChild(shimmer);

  const title = document.createElement("h2");
  title.textContent = "Flow Image Automation";
  title.style.cssText = `
    font-size: 24px;
    font-weight: 600;
    margin: 0 0 8px 0;
    color: #1a1a1a;
    letter-spacing: -0.5px;
  `;

  const messageText = document.createElement("p");
  messageText.id = "labs-flow-message-text";
  messageText.textContent = message || "Processing...";
  messageText.style.cssText = `
    font-size: 16px;
    margin: 0 0 20px 0;
    color: #5f6368;
    line-height: 1.5;
    font-weight: 400;
    white-space: pre-line;
  `;

  const progress = document.createElement("div");
  progress.id = "labs-flow-progress";
  progress.style.cssText = `
    background: rgba(241, 245, 249, 0.8);
    border-radius: 12px;
    padding: 16px;
    margin: 20px 0;
    border: 1px solid rgba(148, 163, 184, 0.35);
  `;

  const progressText = document.createElement("p");
  progressText.id = "labs-flow-progress-text";
  progressText.textContent = `Image Prompt: ${state.currentPromptIndex + 1}/${state.prompts.length}`;
  progressText.style.cssText = `
    font-size: 14px;
    margin: 0 0 12px 0;
    color: #0c4a6e;
    font-weight: 600;
  `;

  const progressTrack = document.createElement("div");
  progressTrack.style.cssText = `
    width: 100%;
    height: 6px;
    background: rgba(148, 163, 184, 0.3);
    border-radius: 3px;
    overflow: hidden;
    position: relative;
  `;

  const progressFill = document.createElement("div");
  progressFill.id = "labs-flow-progress-fill";
  progressFill.style.cssText = `
    height: 100%;
    background: linear-gradient(90deg, #38bdf8, #fbbf24);
    border-radius: 3px;
    width: 0%;
    animation: progressPulse 2s ease-in-out infinite;
    transition: width 0.3s ease;
  `;

  progressTrack.appendChild(progressFill);
  progress.appendChild(progressText);
  progress.appendChild(progressTrack);

  const buttonContainer = document.createElement("div");
  buttonContainer.id = "labs-flow-button-container";
  buttonContainer.style.cssText = `
    display: flex;
    gap: 12px;
    margin-top: 24px;
    justify-content: center;
  `;

  const pauseButton = document.createElement("button");
  pauseButton.id = "labs-flow-pause-button";
  pauseButton.textContent = "Pause";
  pauseButton.style.cssText = `
    background: linear-gradient(135deg, #ea580c, #f97316);
    border: none;
    color: white;
    padding: 12px 24px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
    box-shadow: 0 4px 12px rgba(234, 88, 12, 0.25);
    font-family: inherit;
    position: relative;
    overflow: hidden;
  `;

  pauseButton.addEventListener("mouseenter", () => {
    pauseButton.style.transform = "translateY(-2px)";
    pauseButton.style.boxShadow = "0 6px 20px rgba(234, 88, 12, 0.35)";
  });
  pauseButton.addEventListener("mouseleave", () => {
    pauseButton.style.transform = "translateY(0)";
    pauseButton.style.boxShadow = "0 4px 12px rgba(234, 88, 12, 0.25)";
  });
  pauseButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "stopProcessingFromOverlay" });
  });

  buttonContainer.appendChild(pauseButton);
  card.appendChild(iconBox);
  card.appendChild(title);
  card.appendChild(messageText);
  card.appendChild(progress);
  card.appendChild(buttonContainer);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const progressPercent = ((state.currentPromptIndex + 1) / state.prompts.length) * 100;
  setTimeout(() => {
    progressFill.style.width = `${Math.min(progressPercent, 100)}%`;
  }, 100);
}

export function updateMessage(text, progressIndex) {
  const messageText = document.getElementById("labs-flow-message-text");
  const progressText = document.getElementById("labs-flow-progress-text");
  const progressFill = document.getElementById("labs-flow-progress-fill");

  if (messageText && text) {
    messageText.innerText = text;
  }

  if (progressIndex !== undefined) {
    const total = getState().prompts.length || 1;
    const progressPercent = Math.min(((progressIndex + 1) / total) * 100, 100);

    if (progressText) {
      progressText.textContent = `Image Prompt: ${progressIndex + 1}/${total}`;
    }

    if (progressFill) {
      progressFill.style.width = `${progressPercent}%`;
    }
  }
}

export function hideOverlay() {
  clearCountdownTimer?.();
  const overlay = document.getElementById("labs-flow-overlay");
  if (overlay) {
    document.body.removeChild(overlay);
  }
}

export function showPausingState() {
  if (!document.getElementById("labs-flow-overlay")) {
    return;
  }

  updateMessage("Pausing after current task completes...");

  const buttonContainer = document.getElementById("labs-flow-button-container");
  if (!buttonContainer || document.getElementById("labs-flow-pausing-button")) {
    return;
  }

  const pauseButton = document.getElementById("labs-flow-pause-button");
  if (pauseButton) {
    pauseButton.remove();
  }

  injectPausingSpinnerStyles();

  const pausingButton = document.createElement("button");
  pausingButton.id = "labs-flow-pausing-button";
  pausingButton.style.cssText = `
    background: linear-gradient(135deg, #ea580c, #f97316);
    border: none;
    color: white;
    padding: 12px 24px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    box-shadow: 0 4px 12px rgba(234, 88, 12, 0.25);
    font-family: inherit;
    position: relative;
    overflow: hidden;
  `;

  const pausingContent = document.createElement("div");
  pausingContent.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: opacity 0.2s;
  `;
  pausingContent.innerHTML = `
    <svg class="pausing-spinner" width="16" height="16" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2.5">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9
           m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
    <span>Pausing...</span>
  `;

  const terminateContent = document.createElement("div");
  terminateContent.style.cssText = `
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    opacity: 0;
    transition: opacity 0.2s;
  `;
  terminateContent.innerHTML = `
    <svg class="terminate-icon" width="16" height="16" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2.5"
         style="transition: transform 0.3s;">
      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
    <span>Terminate Now</span>
  `;

  pausingButton.appendChild(pausingContent);
  pausingButton.appendChild(terminateContent);

  pausingButton.addEventListener("mouseenter", () => {
    pausingButton.style.background = "linear-gradient(135deg, #b91c1c, #dc2626)";
    pausingButton.style.transform = "translateY(-2px)";
    pausingButton.style.boxShadow = "0 6px 20px rgba(220, 38, 38, 0.35)";
    pausingContent.style.opacity = "0";
    terminateContent.style.opacity = "1";

    const terminateIcon = terminateContent.querySelector(".terminate-icon");
    if (terminateIcon) {
      terminateIcon.style.transform = "rotate(90deg)";
    }
  });

  pausingButton.addEventListener("mouseleave", () => {
    pausingButton.style.background = "linear-gradient(135deg, #ea580c, #f97316)";
    pausingButton.style.transform = "translateY(0)";
    pausingButton.style.boxShadow = "0 4px 12px rgba(234, 88, 12, 0.25)";
    pausingContent.style.opacity = "1";
    terminateContent.style.opacity = "0";

    const terminateIcon = terminateContent.querySelector(".terminate-icon");
    if (terminateIcon) {
      terminateIcon.style.transform = "rotate(0deg)";
    }
  });

  pausingButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "terminateProcessingFromOverlay" });
    setState({ isPausing: false, isProcessing: false });
    hideOverlay();
  });

  buttonContainer.appendChild(pausingButton);
}

function injectBannerStyles() {
  if (document.getElementById("labs-flow-banner-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "labs-flow-banner-styles";
  style.textContent = `
    @keyframes bannerSlideIn {
      0%   { opacity: 0; transform: translateY(-8px) scale(0.98); }
      100% { opacity: 1; transform: translateY(0)    scale(1);    }
    }
  `;

  document.head.appendChild(style);
}

export function showErrorBanner({ lines = [], taskIndex = "?" } = {}) {
  const messageCard = document.getElementById("labs-flow-message");
  if (!messageCard) {
    return;
  }

  injectBannerStyles();
  clearErrorBanner();

  const banner = document.createElement("div");
  banner.id = "labs-flow-error-banner";
  banner.style.cssText = `
    background: linear-gradient(145deg, rgba(255, 237, 213, 0.92), rgba(254, 215, 170, 0.80));
    backdrop-filter: blur(12px);
    border: 1px solid rgba(234, 88, 12, 0.20);
    border-radius: 16px;
    padding: 14px 16px 12px 16px;
    margin: 4px 0 16px 0;
    text-align: left;
    box-shadow:
      0 4px 12px rgba(234, 88, 12, 0.10),
      0 1px 3px rgba(234, 88, 12, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.60);
    animation: bannerSlideIn 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
    font-family: 'Google Sans', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
  `;

  const header = document.createElement("div");
  header.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  `;

  const iconBox = document.createElement("div");
  iconBox.style.cssText = `
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: linear-gradient(135deg, #ea580c, #f97316);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 2px 6px rgba(234, 88, 12, 0.30);
  `;
  iconBox.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  `;

  const titleContainer = document.createElement("div");
  const title = document.createElement("div");
  title.style.cssText = `
    font-size: 13px;
    font-weight: 600;
    color: #9a3412;
    letter-spacing: -0.1px;
    line-height: 1.3;
  `;
  title.textContent = "Some generations couldn't complete";

  const subtitle = document.createElement("div");
  subtitle.style.cssText = `
    font-size: 11px;
    font-weight: 400;
    color: #c2410c;
    margin-top: 1px;
    line-height: 1.3;
  `;
  subtitle.textContent = `Task ${taskIndex} • Skipping failed items automatically`;

  titleContainer.appendChild(title);
  titleContainer.appendChild(subtitle);
  header.appendChild(iconBox);
  header.appendChild(titleContainer);
  banner.appendChild(header);

  if (lines.length > 0) {
    const lineList = document.createElement("div");
    lineList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 5px;
    `;

    for (const line of lines) {
      const row = document.createElement("div");
      row.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.50);
        border: 1px solid rgba(234, 88, 12, 0.15);
        border-radius: 8px;
        padding: 5px 10px;
        font-size: 12px;
        color: #7c2d12;
        font-weight: 500;
        line-height: 1.4;
      `;

      const bullet = document.createElement("span");
      bullet.style.cssText = `
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #ea580c;
        flex-shrink: 0;
      `;

      const text = document.createElement("span");
      text.textContent = line;

      row.appendChild(bullet);
      row.appendChild(text);
      lineList.appendChild(row);
    }

    banner.appendChild(lineList);
  }

  const footer = document.createElement("div");
  footer.style.cssText = `
    font-size: 11px;
    color: #c2410c;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid rgba(234, 88, 12, 0.12);
    line-height: 1.4;
  `;
  footer.textContent = "Your other prompts will continue processing normally.";
  banner.appendChild(footer);

  const progress = document.getElementById("labs-flow-progress");
  if (progress) {
    messageCard.insertBefore(banner, progress);
  } else {
    messageCard.appendChild(banner);
  }
}

export function clearErrorBanner() {
  const banner = document.getElementById("labs-flow-error-banner");
  if (banner) {
    banner.remove();
  }
}
