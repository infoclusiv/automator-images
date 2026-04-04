import { h } from "./domUtils.js";

let isActiveFlag = false;
let selectedTileIds = new Set();
let tileObserver = null;
let observerRefreshTimer = null;
let imageQuality = "1K";
let videoQuality = "720p";
let isDownloadRunActive = false;
let isPaused = false;
let shouldStop = false;
let queuedTiles = [];
let themeListener = null;

const CONTROL_PANEL_ID = "cdm-control-panel";
const STYLE_ID = "cdm-styles";
const TILE_OVERLAY_CLASS = "cdm-tile-overlay";
const DRAG_BLOCKER_SELECTOR = [
  "button",
  "select",
  "input",
  "textarea",
  "label",
  "a",
  "#cdm-resize-handle",
  "[data-no-drag]",
].join(", ");

function hasCompletedMedia(tileElement) {
  return Boolean(
    tileElement.querySelector('video[src*="media.getMediaUrlRedirect"]') ||
      tileElement.querySelector('img[src*="media.getMediaUrlRedirect"]'),
  );
}

function isVideoTile(tileElement) {
  return Boolean(tileElement.querySelector("video"));
}

function getCompletedTiles() {
  const tiles = [];
  const seenTileIds = new Set();

  document.querySelectorAll("[data-tile-id]").forEach((tileElement) => {
    const tileId = tileElement.getAttribute("data-tile-id");
    if (!tileId || seenTileIds.has(tileId) || !hasCompletedMedia(tileElement)) {
      return;
    }

    seenTileIds.add(tileId);
    tiles.push({
      tileId,
      tileEl: tileElement,
      isVideo: isVideoTile(tileElement),
    });
  });

  return tiles;
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    [data-tile-id].cdm-isolated {
      isolation: isolate;
    }
    .cdm-tile-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 9999;
      pointer-events: none;
    }
    .cdm-tile-overlay.cdm-active {
      pointer-events: all;
      cursor: pointer;
    }
    .cdm-checkbox-wrap {
      position: absolute;
      top: 8px;
      left: 8px;
      width: 22px;
      height: 22px;
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cdm-checkbox {
      width: 18px;
      height: 18px;
      border-radius: 5px;
      border: 2px solid rgba(255,255,255,0.85);
      background: rgba(15,23,42,0.55);
      backdrop-filter: blur(4px);
      appearance: none;
      -webkit-appearance: none;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, transform 0.1s;
      flex-shrink: 0;
    }
    .cdm-checkbox:checked {
      background: #6366f1;
      border-color: #6366f1;
    }
    .cdm-checkbox:checked::after {
      content: '';
      display: block;
      margin: 2px auto 0 auto;
      width: 5px;
      height: 9px;
      border-right: 2px solid white;
      border-bottom: 2px solid white;
      transform: rotate(45deg);
    }
    .cdm-checkbox:hover {
      transform: scale(1.1);
      border-color: #a5b4fc;
    }
    .cdm-tile-selected-ring {
      position: absolute;
      inset: 0;
      border: 3px solid #6366f1;
      border-radius: 8px;
      pointer-events: none;
      box-shadow: inset 0 0 0 1px #a5b4fc;
    }
    .cdm-tile-badge {
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(15,23,42,0.70);
      backdrop-filter: blur(6px);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 6px;
      padding: 2px 6px;
      font-size: 10px;
      font-weight: 600;
      color: #e2e8f0;
      font-family: 'Google Sans', sans-serif;
      pointer-events: none;
      letter-spacing: 0.3px;
    }
    @keyframes cdmPanelIn {
      0%   { opacity:0; transform: translateY(16px) scale(0.97); }
      100% { opacity:1; transform: translateY(0) scale(1); }
    }
    #cdm-control-panel {
      position: fixed;
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      border-radius: 20px;
      padding: 14px 18px;
      min-width: 360px;
      max-width: 92vw;
      min-height: 120px;
      width: 580px;
      box-sizing: border-box;
      resize: none;
      overflow: hidden;
      font-family: 'Google Sans', 'Roboto', -apple-system, sans-serif;
      animation: cdmPanelIn 0.3s cubic-bezier(0.25,0.8,0.25,1) forwards;
      display: flex;
      flex-direction: column;
      gap: 10px;
      user-select: none;
      transition: background 0.25s, border-color 0.25s, box-shadow 0.25s, color 0.25s;
      cursor: grab;
      scrollbar-width: thin;
      scrollbar-color: rgba(99,102,241,0.45) rgba(255,255,255,0.04);
    }
    #cdm-control-panel button,
    #cdm-control-panel select,
    #cdm-control-panel input,
    #cdm-control-panel label,
    #cdm-control-panel a,
    #cdm-resize-handle {
      cursor: auto;
    }
    #cdm-control-panel button,
    #cdm-control-panel select,
    #cdm-control-panel input[type="checkbox"] {
      cursor: pointer;
    }
    #cdm-control-panel.cdm-dark {
      background: linear-gradient(145deg, rgba(15,23,42,0.97), rgba(30,41,59,0.95));
      backdrop-filter: blur(24px);
      border: 1px solid rgba(99,102,241,0.35);
      color: #e2e8f0;
      box-shadow:
        0 24px 60px rgba(0,0,0,0.55),
        0 8px 20px rgba(99,102,241,0.18),
        inset 0 1px 0 rgba(255,255,255,0.07);
    }
    #cdm-control-panel.cdm-dark .cdm-panel-title { color: #e2e8f0; }
    #cdm-control-panel.cdm-dark .cdm-stats { color: #94a3b8; }
    #cdm-control-panel.cdm-dark .cdm-stat-chip {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.09);
      color: #cbd5e1;
    }
    #cdm-control-panel.cdm-dark .cdm-stat-chip.cdm-selected {
      background: rgba(99,102,241,0.18);
      border-color: rgba(99,102,241,0.35);
      color: #a5b4fc;
    }
    #cdm-control-panel.cdm-dark .cdm-btn-secondary {
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      color: #cbd5e1;
    }
    #cdm-control-panel.cdm-dark .cdm-btn-secondary:hover {
      background: rgba(255,255,255,0.12);
      border-color: rgba(255,255,255,0.22);
      color: #e2e8f0;
    }
    #cdm-control-panel.cdm-dark .cdm-quality-label { color: #64748b; }
    #cdm-control-panel.cdm-dark .cdm-quality-select {
      background-color: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      color: #e2e8f0;
    }
    #cdm-control-panel.cdm-dark .cdm-quality-select:hover {
      border-color: rgba(99,102,241,0.5);
    }
    #cdm-control-panel.cdm-dark #cdm-progress-bar-track { background: rgba(255,255,255,0.08); }
    #cdm-control-panel.cdm-dark #cdm-progress-label { color: #94a3b8; }
    #cdm-control-panel.cdm-light {
      background: linear-gradient(145deg, rgba(239,246,255,0.97), rgba(219,234,254,0.95));
      backdrop-filter: blur(24px);
      border: 1px solid rgba(99,102,241,0.25);
      color: #1e3a5f;
      box-shadow:
        0 24px 60px rgba(59,130,246,0.12),
        0 8px 20px rgba(99,102,241,0.10),
        inset 0 1px 0 rgba(255,255,255,0.80);
    }
    #cdm-control-panel.cdm-light .cdm-panel-title { color: #1e3a5f; }
    #cdm-control-panel.cdm-light .cdm-panel-title-icon {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
    }
    #cdm-control-panel.cdm-light .cdm-stats { color: #475569; }
    #cdm-control-panel.cdm-light .cdm-stat-chip {
      background: rgba(99,102,241,0.08);
      border: 1px solid rgba(99,102,241,0.18);
      color: #334155;
    }
    #cdm-control-panel.cdm-light .cdm-stat-chip.cdm-selected {
      background: rgba(99,102,241,0.15);
      border-color: rgba(99,102,241,0.35);
      color: #4338ca;
    }
    #cdm-control-panel.cdm-light .cdm-btn-secondary {
      background: rgba(255,255,255,0.70);
      border: 1px solid rgba(99,102,241,0.20);
      color: #334155;
    }
    #cdm-control-panel.cdm-light .cdm-btn-secondary:hover {
      background: rgba(255,255,255,0.90);
      border-color: rgba(99,102,241,0.40);
      color: #1e293b;
    }
    #cdm-control-panel.cdm-light .cdm-quality-label { color: #64748b; }
    #cdm-control-panel.cdm-light .cdm-quality-select {
      background-color: rgba(255,255,255,0.75);
      border: 1px solid rgba(99,102,241,0.20);
      color: #1e293b;
    }
    #cdm-control-panel.cdm-light .cdm-quality-select:hover {
      border-color: rgba(99,102,241,0.45);
    }
    #cdm-control-panel.cdm-light #cdm-progress-bar-track { background: rgba(99,102,241,0.12); }
    #cdm-control-panel.cdm-light #cdm-progress-label { color: #475569; }
    #cdm-control-panel.cdm-light #cdm-close-btn {
      background: rgba(239,68,68,0.10);
      border: 1px solid rgba(239,68,68,0.22);
      color: #dc2626;
    }
    #cdm-control-panel.cdm-light #cdm-close-btn:hover {
      background: rgba(239,68,68,0.20);
      color: #b91c1c;
    }
    #cdm-resize-handle {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 32px;
      height: 32px;
      cursor: nwse-resize;
      z-index: 10;
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
      padding: 6px;
      border-bottom-right-radius: 20px;
      background: linear-gradient(135deg, transparent 40%, rgba(99,102,241,0.18) 100%);
      transition: background 0.2s;
    }
    #cdm-resize-handle::before {
      content: '';
      position: absolute;
      bottom: 0;
      right: 0;
      width: 0;
      height: 0;
      border-style: solid;
      border-width: 0 0 12px 12px;
      border-color: transparent transparent rgba(99,102,241,0.5) transparent;
      border-bottom-right-radius: 20px;
      pointer-events: none;
      transition: border-color 0.2s;
    }
    #cdm-resize-handle svg {
      opacity: 0.55;
      transition: opacity 0.15s, transform 0.15s;
      filter: drop-shadow(0 0 3px rgba(99,102,241,0.6));
    }
    #cdm-resize-handle:hover {
      background: linear-gradient(135deg, transparent 30%, rgba(99,102,241,0.32) 100%);
    }
    #cdm-resize-handle:hover::before {
      border-color: transparent transparent rgba(139,92,246,0.85) transparent;
    }
    #cdm-resize-handle:hover svg {
      opacity: 1;
      transform: scale(1.2);
    }
    body.cdm-dragging * { pointer-events: none !important; }
    body.cdm-dragging #cdm-control-panel { pointer-events: all !important; cursor: grabbing !important; }
    body.cdm-resizing { cursor: nwse-resize !important; }
    body.cdm-resizing * { pointer-events: none !important; }
    body.cdm-resizing #cdm-control-panel { pointer-events: all !important; }
    #cdm-control-panel .cdm-panel-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-shrink: 0;
    }
    #cdm-control-panel .cdm-panel-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: -0.2px;
    }
    #cdm-control-panel .cdm-panel-title-icon {
      width: 26px;
      height: 26px;
      border-radius: 8px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(99,102,241,0.4);
    }
    #cdm-close-btn {
      width: 26px;
      height: 26px;
      border-radius: 8px;
      background: rgba(248,113,113,0.15);
      border: 1px solid rgba(248,113,113,0.25);
      color: #fca5a5;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      line-height: 1;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
      flex-shrink: 0;
    }
    #cdm-close-btn:hover {
      background: rgba(248,113,113,0.30);
      color: #fecaca;
    }
    #cdm-control-panel .cdm-stats {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      flex-wrap: wrap;
    }
    #cdm-control-panel .cdm-stat-chip {
      border-radius: 6px;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 600;
    }
    #cdm-control-panel .cdm-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .cdm-btn-secondary {
      border-radius: 10px;
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 600;
      transition: all 0.15s;
      white-space: nowrap;
      font-family: inherit;
    }
    .cdm-quality-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .cdm-quality-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .cdm-quality-select {
      appearance: none;
      -webkit-appearance: none;
      border-radius: 8px;
      padding: 5px 26px 5px 10px;
      font-size: 11px;
      font-weight: 600;
      font-family: inherit;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 8px center;
      transition: border-color 0.15s;
    }
    .cdm-quality-select option {
      background: #1e293b;
      color: #e2e8f0;
    }
    #cdm-download-btn {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border: none;
      border-radius: 10px;
      padding: 7px 16px;
      font-size: 12px;
      font-weight: 700;
      color: white;
      font-family: inherit;
      box-shadow: 0 4px 12px rgba(99,102,241,0.35);
      transition: all 0.2s;
      white-space: nowrap;
    }
    #cdm-download-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(99,102,241,0.45);
    }
    #cdm-download-btn:active:not(:disabled) { transform: scale(0.97); }
    #cdm-download-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    #cdm-progress-wrap {
      display: none;
      flex-direction: column;
      gap: 6px;
    }
    #cdm-progress-wrap.cdm-visible { display: flex; }
    #cdm-progress-label {
      font-size: 11px;
      font-weight: 500;
    }
    #cdm-progress-bar-track {
      width: 100%;
      height: 4px;
      border-radius: 2px;
      overflow: hidden;
    }
    #cdm-progress-bar-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #6366f1, #8b5cf6);
      border-radius: 2px;
      transition: width 0.3s ease;
    }
    #cdm-download-controls {
      display: none;
      align-items: center;
      gap: 8px;
    }
    #cdm-download-controls.cdm-visible { display: flex; }
    #cdm-pause-btn {
      display: flex;
      align-items: center;
      gap: 5px;
      background: rgba(245,158,11,0.15);
      border: 1px solid rgba(245,158,11,0.35);
      color: #fbbf24;
      border-radius: 10px;
      padding: 5px 12px;
      font-size: 11px;
      font-weight: 700;
      font-family: inherit;
      transition: all 0.15s;
      white-space: nowrap;
    }
    #cdm-pause-btn:hover {
      background: rgba(245,158,11,0.28);
      border-color: rgba(245,158,11,0.55);
      color: #fde68a;
    }
    #cdm-pause-btn.cdm-paused {
      background: rgba(99,102,241,0.18);
      border-color: rgba(99,102,241,0.40);
      color: #a5b4fc;
    }
    #cdm-pause-btn.cdm-paused:hover {
      background: rgba(99,102,241,0.30);
      color: #c7d2fe;
    }
    #cdm-stop-btn {
      display: flex;
      align-items: center;
      gap: 5px;
      background: rgba(239,68,68,0.12);
      border: 1px solid rgba(239,68,68,0.30);
      color: #f87171;
      border-radius: 10px;
      padding: 5px 12px;
      font-size: 11px;
      font-weight: 700;
      font-family: inherit;
      transition: all 0.15s;
      white-space: nowrap;
    }
    #cdm-stop-btn:hover {
      background: rgba(239,68,68,0.25);
      border-color: rgba(239,68,68,0.55);
      color: #fca5a5;
    }
    #cdm-paused-badge {
      display: none;
      font-size: 10px;
      font-weight: 700;
      color: #fbbf24;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      animation: cdmPausedPulse 1.2s ease-in-out infinite;
    }
    #cdm-paused-badge.cdm-visible { display: inline; }
    @keyframes cdmPausedPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    #cdm-control-panel::-webkit-scrollbar { width: 5px; height: 5px; }
    #cdm-control-panel::-webkit-scrollbar-track {
      background: rgba(255,255,255,0.04);
      border-radius: 10px;
    }
    #cdm-control-panel::-webkit-scrollbar-thumb {
      background: rgba(99,102,241,0.45);
      border-radius: 10px;
      transition: background 0.2s;
    }
    #cdm-control-panel::-webkit-scrollbar-thumb:hover {
      background: rgba(99,102,241,0.75);
    }
    #cdm-control-panel::-webkit-scrollbar-corner { background: transparent; }
    @keyframes cdmSpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .cdm-spinner {
      width: 12px;
      height: 12px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: cdmSpin 0.7s linear infinite;
      flex-shrink: 0;
    }
  `;

  document.head.appendChild(style);
}

function createControlPanel() {
  if (document.getElementById(CONTROL_PANEL_ID)) {
    return;
  }

  const panel = document.createElement("div");
  panel.id = CONTROL_PANEL_ID;
  panel.innerHTML = `
    <div class="cdm-panel-top">
      <div class="cdm-panel-title">
        <div class="cdm-panel-title-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
          </svg>
        </div>
        <span>Content Download Manager</span>
      </div>
      <button id="cdm-close-btn" title="Close">✕</button>
    </div>
    <div class="cdm-stats" id="cdm-stats">
      <span class="cdm-stat-chip" id="cdm-total-chip">0 tiles</span>
      <span class="cdm-stat-chip cdm-selected" id="cdm-selected-chip">0 selected</span>
    </div>
    <div class="cdm-controls">
      <button class="cdm-btn-secondary" id="cdm-select-all-btn">Select All</button>
      <button class="cdm-btn-secondary" id="cdm-deselect-all-btn">Deselect All</button>
      <button class="cdm-btn-secondary" id="cdm-select-images-btn">Images Only</button>
      <button class="cdm-btn-secondary" id="cdm-select-videos-btn">Videos Only</button>
      <div class="cdm-quality-group">
        <span class="cdm-quality-label">🖼</span>
        <select class="cdm-quality-select" id="cdm-image-quality">
          <option value="1K">1K — Original</option>
          <option value="2K">2K — Upscaled</option>
          <option value="4K">4K — Upscaled</option>
        </select>
      </div>
      <div class="cdm-quality-group">
        <span class="cdm-quality-label">🎬</span>
        <select class="cdm-quality-select" id="cdm-video-quality">
          <option value="270p">270p — GIF</option>
          <option value="720p" selected>720p — Original</option>
          <option value="1080p">1080p — Upscaled</option>
          <option value="4K">4K — Upscaled</option>
        </select>
      </div>
      <button id="cdm-download-btn" disabled>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
        </svg>
        <span id="cdm-download-label">Download (0)</span>
      </button>
    </div>
    <div id="cdm-progress-wrap">
      <div style="display:flex;align-items:center;gap:8px;">
        <span id="cdm-progress-label" style="flex:1;">Downloading 0 / 0…</span>
        <span id="cdm-paused-badge">⏸ Paused</span>
      </div>
      <div id="cdm-progress-bar-track"><div id="cdm-progress-bar-fill"></div></div>
      <div id="cdm-download-controls">
        <button id="cdm-pause-btn">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
          <span id="cdm-pause-label">Pause</span>
        </button>
        <button id="cdm-stop-btn">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
          <span>Stop</span>
        </button>
      </div>
    </div>
    <div id="cdm-resize-handle" title="Drag to resize">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round">
        <line x1="13" y1="1" x2="1" y2="13"/>
        <line x1="13" y1="6" x2="6" y2="13"/>
        <line x1="13" y1="10" x2="10" y2="13"/>
      </svg>
    </div>
  `;

  document.body.appendChild(panel);
  bindPanelEvents();
  makePanelDraggable(panel);
  makePanelResizable(panel);
}

function bindPanelEvents() {
  document.getElementById("cdm-close-btn")?.addEventListener("click", deactivate);
  document.getElementById("cdm-select-all-btn")?.addEventListener("click", () => {
    getCompletedTiles().forEach(({ tileId, tileEl }) => selectTile(tileId, tileEl));
    updateStats();
  });
  document.getElementById("cdm-deselect-all-btn")?.addEventListener("click", () => {
    [...selectedTileIds].forEach((tileId) => {
      const tileElement = document.querySelector(`[data-tile-id="${tileId}"]`);
      if (tileElement) {
        deselectTile(tileId, tileElement);
      }
    });
    selectedTileIds.clear();
    updateStats();
  });
  document.getElementById("cdm-select-images-btn")?.addEventListener("click", () => {
    getCompletedTiles().forEach(({ tileId, tileEl, isVideo }) => {
      if (isVideo) {
        deselectTile(tileId, tileEl);
      } else {
        selectTile(tileId, tileEl);
      }
    });
    updateStats();
  });
  document.getElementById("cdm-select-videos-btn")?.addEventListener("click", () => {
    getCompletedTiles().forEach(({ tileId, tileEl, isVideo }) => {
      if (isVideo) {
        selectTile(tileId, tileEl);
      } else {
        deselectTile(tileId, tileEl);
      }
    });
    updateStats();
  });
  document.getElementById("cdm-image-quality")?.addEventListener("change", (event) => {
    imageQuality = event.target.value;
  });
  document.getElementById("cdm-video-quality")?.addEventListener("change", (event) => {
    videoQuality = event.target.value;
  });
  document.getElementById("cdm-download-btn")?.addEventListener("click", startDownloadRun);
  document.getElementById("cdm-pause-btn")?.addEventListener("click", togglePause);
  document.getElementById("cdm-stop-btn")?.addEventListener("click", stopDownloadRun);
}

function makePanelDraggable(panel) {
  let startX;
  let startY;
  let initialLeft;
  let initialTop;

  function onMouseMove(event) {
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    let left = initialLeft + deltaX;
    let top = initialTop + deltaY;
    left = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, left));
    top = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, top));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.bottom = "auto";
    panel.style.transform = "none";
  }

  function onMouseUp() {
    panel.style.cursor = "grab";
    document.body.classList.remove("cdm-dragging");
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  panel.addEventListener("mousedown", (event) => {
    if (event.target.closest(DRAG_BLOCKER_SELECTOR)) {
      return;
    }

    event.preventDefault();

    const rect = panel.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
    startX = event.clientX;
    startY = event.clientY;
    panel.style.left = `${initialLeft}px`;
    panel.style.top = `${initialTop}px`;
    panel.style.bottom = "auto";
    panel.style.transform = "none";
    panel.style.cursor = "grabbing";
    document.body.classList.add("cdm-dragging");
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });
}

function makePanelResizable(panel) {
  const resizeHandle = panel.querySelector("#cdm-resize-handle");
  if (!resizeHandle) {
    return;
  }

  const minWidth = 360;
  const minHeight = 120;

  let startX;
  let startY;
  let startWidth;
  let startHeight;
  let maxWidth;
  let maxHeight;

  function onMouseMove(event) {
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    const width = Math.max(minWidth, Math.min(window.innerWidth - maxWidth, startWidth + deltaX));
    const height = Math.max(minHeight, Math.min(window.innerHeight - maxHeight, startHeight + deltaY));
    panel.style.width = `${width}px`;
    panel.style.height = `${height}px`;
  }

  function onMouseUp() {
    document.body.classList.remove("cdm-resizing");
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  resizeHandle.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const rect = panel.getBoundingClientRect();
    startX = event.clientX;
    startY = event.clientY;
    startWidth = rect.width;
    startHeight = rect.height;
    maxWidth = rect.left;
    maxHeight = rect.top;
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    panel.style.bottom = "auto";
    panel.style.transform = "none";
    panel.style.width = `${rect.width}px`;
    panel.style.height = `${rect.height}px`;
    panel.style.overflow = "auto";
    document.body.classList.add("cdm-resizing");
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });
}

function updateStats() {
  const totalTiles = getCompletedTiles().length;
  const selectedCount = selectedTileIds.size;
  const totalChip = document.getElementById("cdm-total-chip");
  const selectedChip = document.getElementById("cdm-selected-chip");
  const downloadButton = document.getElementById("cdm-download-btn");
  const downloadLabel = document.getElementById("cdm-download-label");

  if (totalChip) {
    totalChip.textContent = `${totalTiles} tile${totalTiles !== 1 ? "s" : ""}`;
  }
  if (selectedChip) {
    selectedChip.textContent = `${selectedCount} selected`;
  }
  if (downloadButton) {
    downloadButton.disabled = selectedCount === 0 || isDownloadRunActive;
  }
  if (downloadLabel) {
    downloadLabel.textContent = isDownloadRunActive ? "Downloading…" : `Download (${selectedCount})`;
  }
}

function ensureTileOverlay(tileId, tileElement) {
  const existingOverlay = tileElement.querySelector(`.${TILE_OVERLAY_CLASS}`);
  if (existingOverlay) {
    return existingOverlay;
  }

  if (window.getComputedStyle(tileElement).position === "static") {
    tileElement.style.position = "relative";
  }

  tileElement.style.isolation = "isolate";
  tileElement.classList.add("cdm-isolated");

  const overlay = document.createElement("div");
  overlay.className = `${TILE_OVERLAY_CLASS} cdm-active`;
  overlay.setAttribute("data-cdm-tile", tileId);

  const checkboxWrap = document.createElement("div");
  checkboxWrap.className = "cdm-checkbox-wrap";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "cdm-checkbox";
  checkbox.setAttribute("data-tile-cb", tileId);
  checkbox.checked = selectedTileIds.has(tileId);
  checkbox.addEventListener("change", (event) => {
    event.stopPropagation();
    if (checkbox.checked) {
      selectTile(tileId, tileElement);
    } else {
      deselectTile(tileId, tileElement);
    }
    updateStats();
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === checkbox) {
      return;
    }

    checkbox.checked = !checkbox.checked;
    checkbox.dispatchEvent(new Event("change"));
  });

  checkboxWrap.appendChild(checkbox);
  overlay.appendChild(checkboxWrap);

  const badge = document.createElement("div");
  badge.className = "cdm-tile-badge";
  badge.textContent = isVideoTile(tileElement) ? "🎬 VIDEO" : "🖼 IMAGE";
  overlay.appendChild(badge);
  tileElement.appendChild(overlay);

  return overlay;
}

function selectTile(tileId, tileElement) {
  selectedTileIds.add(tileId);

  const checkbox = tileElement.querySelector(`[data-tile-cb="${tileId}"]`);
  if (checkbox) {
    checkbox.checked = true;
  }

  let ring = tileElement.querySelector(".cdm-tile-selected-ring");
  if (!ring) {
    ring = document.createElement("div");
    ring.className = "cdm-tile-selected-ring";
    const overlay = tileElement.querySelector(`.${TILE_OVERLAY_CLASS}`);
    if (overlay) {
      overlay.appendChild(ring);
    }
  }
}

function deselectTile(tileId, tileElement) {
  selectedTileIds.delete(tileId);

  const checkbox = tileElement.querySelector(`[data-tile-cb="${tileId}"]`);
  if (checkbox) {
    checkbox.checked = false;
  }

  const ring = tileElement.querySelector(".cdm-tile-selected-ring");
  if (ring) {
    ring.remove();
  }
}

function injectOverlays() {
  getCompletedTiles().forEach(({ tileId, tileEl }) => ensureTileOverlay(tileId, tileEl));
  updateStats();
}

function removeOverlays() {
  document.querySelectorAll(`.${TILE_OVERLAY_CLASS}`).forEach((overlay) => overlay.remove());
  document.querySelectorAll("[data-tile-id].cdm-isolated").forEach((tileElement) => {
    tileElement.classList.remove("cdm-isolated");
  });
}

function getObserverRoot() {
  return (
    document.querySelector("[data-virtuoso-scroller]") ||
    document.querySelector('[class*="tileGrid"], [class*="tile-grid"], [class*="TileGrid"]') ||
    document.querySelector("main") ||
    document.body
  );
}

function attachObserver() {
  if (tileObserver) {
    return;
  }

  tileObserver = new MutationObserver((mutations) => {
    if (!isActiveFlag) {
      return;
    }

    const hasRelevantNodes = mutations.some((mutation) =>
      [...mutation.addedNodes].some((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) {
          return false;
        }

        return (
          !node.classList?.contains(TILE_OVERLAY_CLASS) &&
          node.id !== CONTROL_PANEL_ID &&
          node.id !== STYLE_ID
        );
      }),
    );

    if (!hasRelevantNodes) {
      return;
    }

    clearTimeout(observerRefreshTimer);
    observerRefreshTimer = setTimeout(() => {
      if (!isActiveFlag) {
        return;
      }

      getCompletedTiles().forEach(({ tileId, tileEl }) => {
        if (!tileEl.querySelector(`.${TILE_OVERLAY_CLASS}`)) {
          ensureTileOverlay(tileId, tileEl);
        }
      });
      updateStats();
    }, 200);
  });

  const root = getObserverRoot();
  tileObserver.observe(root, { childList: true, subtree: true });
  console.log("[CDM] Observer attached to", root.tagName, root.className?.slice(0, 60) || "");
}

function detachObserver() {
  clearTimeout(observerRefreshTimer);
  observerRefreshTimer = null;

  if (tileObserver) {
    tileObserver.disconnect();
    tileObserver = null;
  }
}

function pickQualityButton(menuElement, targetQuality) {
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
    const matching = buttonData.find((entry) => entry.label === targetQuality);
    if (matching && matching.enabled) {
      return matching.button;
    }
  }

  return enabledButtons.length > 0 ? enabledButtons[enabledButtons.length - 1].button : buttons[0] || null;
}

async function downloadTileViaUI(tileElement, targetQuality) {
  try {
    const mediaElement =
      tileElement.querySelector('video[src*="media.getMediaUrlRedirect"]') ||
      tileElement.querySelector('img[src*="media.getMediaUrlRedirect"]');
    if (!mediaElement) {
      console.warn("[CDM] No media element in tile");
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
      console.warn("[CDM] Context menu did not open");
      return false;
    }

    const downloadItem = [...contextMenu.querySelectorAll('[role="menuitem"]')].find(
      (item) => item.querySelector("i")?.textContent.trim() === "download",
    );
    if (!downloadItem) {
      console.warn("[CDM] Download menuitem not found");
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return false;
    }

    downloadItem.click();
    await h(600);

    const menus = [...document.querySelectorAll('[data-radix-menu-content][data-state="open"]')];
    const qualityMenu = menus.find((menu) => menu !== contextMenu) || menus[menus.length - 1];
    if (!qualityMenu || qualityMenu === contextMenu) {
      console.warn("[CDM] Quality sub-menu did not open");
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return false;
    }

    const qualityButton = pickQualityButton(qualityMenu, targetQuality);
    if (!qualityButton) {
      console.warn("[CDM] No quality button in sub-menu");
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return false;
    }

    qualityButton.click();
    await h(300);
    return true;
  } catch (error) {
    console.error("[CDM] downloadTileViaUI error:", error);
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return false;
  }
}

function togglePause() {
  isPaused = !isPaused;

  const pauseButton = document.getElementById("cdm-pause-btn");
  const pauseLabel = document.getElementById("cdm-pause-label");
  const pausedBadge = document.getElementById("cdm-paused-badge");

  pauseButton?.classList.toggle("cdm-paused", isPaused);
  if (pauseLabel) {
    pauseLabel.textContent = isPaused ? "Resume" : "Pause";
  }

  const icon = pauseButton?.querySelector("svg");
  if (icon) {
    icon.innerHTML = isPaused
      ? '<polygon points="5,3 19,12 5,21" fill="currentColor"/>'
      : '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>';
  }

  pausedBadge?.classList.toggle("cdm-visible", isPaused);

  const progressLabel = document.getElementById("cdm-progress-label");
  if (progressLabel) {
    progressLabel.style.opacity = isPaused ? "0.5" : "";
  }
}

function stopDownloadRun() {
  if (!isDownloadRunActive) {
    return;
  }

  shouldStop = true;
  if (isPaused) {
    togglePause();
  }
}

async function startDownloadRun() {
  if (isDownloadRunActive || selectedTileIds.size === 0) {
    return;
  }

  isDownloadRunActive = true;
  isPaused = false;
  shouldStop = false;

  queuedTiles = getCompletedTiles()
    .filter(({ tileId }) => selectedTileIds.has(tileId))
    .map((tile) => ({
      ...tile,
      quality: tile.isVideo ? videoQuality : imageQuality,
    }));

  const total = queuedTiles.length;
  let completed = 0;

  const progressWrap = document.getElementById("cdm-progress-wrap");
  const progressLabel = document.getElementById("cdm-progress-label");
  const progressFill = document.getElementById("cdm-progress-bar-fill");
  const downloadButton = document.getElementById("cdm-download-btn");
  const controls = document.getElementById("cdm-download-controls");
  const pauseButton = document.getElementById("cdm-pause-btn");
  const pauseLabel = document.getElementById("cdm-pause-label");

  progressWrap?.classList.add("cdm-visible");
  if (progressLabel) {
    progressLabel.textContent = `Downloading 0 / ${total}…`;
  }
  if (progressFill) {
    progressFill.style.width = "0%";
  }
  controls?.classList.add("cdm-visible");
  pauseButton?.classList.remove("cdm-paused");
  if (pauseLabel) {
    pauseLabel.textContent = "Pause";
  }

  if (downloadButton) {
    downloadButton.disabled = true;
    downloadButton.innerHTML = `
      <div class="cdm-spinner"></div>
      <span>Downloading…</span>
    `;
  }

  for (const tile of queuedTiles) {
    if (shouldStop) {
      console.log("[CDM] Download stopped by user");
      break;
    }

    while (isPaused && !shouldStop) {
      await h(150);
    }

    if (shouldStop) {
      console.log("[CDM] Download stopped while paused");
      break;
    }

    console.log(`[CDM] Downloading tile ${tile.tileId} (quality: ${tile.quality})`);
    tile.tileEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    await h(350);
    await downloadTileViaUI(tile.tileEl, tile.quality);
    completed += 1;

    if (progressLabel) {
      progressLabel.textContent = `Downloading ${completed} / ${total}…`;
    }
    if (progressFill) {
      progressFill.style.width = `${Math.round((completed / total) * 100)}%`;
    }

    await h(400);
  }

  const wasStopped = shouldStop;
  isDownloadRunActive = false;
  isPaused = false;
  shouldStop = false;
  queuedTiles = [];

  controls?.classList.remove("cdm-visible");
  pauseButton?.classList.remove("cdm-paused");
  if (pauseLabel) {
    pauseLabel.textContent = "Pause";
  }

  const pausedBadge = document.getElementById("cdm-paused-badge");
  pausedBadge?.classList.remove("cdm-visible");

  if (progressLabel) {
    progressLabel.style.opacity = "";
    progressLabel.textContent = wasStopped
      ? `⛔ Stopped after ${completed} / ${total}`
      : `✅ Downloaded ${completed} / ${total} complete`;
  }

  if (progressFill) {
    progressFill.style.width = wasStopped ? `${Math.round((completed / total) * 100)}%` : "100%";
  }

  if (downloadButton) {
    downloadButton.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
      </svg>
      <span id="cdm-download-label">Download (${selectedTileIds.size})</span>
    `;
    downloadButton.disabled = selectedTileIds.size === 0;
  }

  console.log(`[CDM] Download run complete: ${completed}/${total} (stopped=${wasStopped})`);
  setTimeout(() => {
    progressWrap?.classList.remove("cdm-visible");
  }, 3_000);
}

function applyTheme(isDarkMode) {
  const panel = document.getElementById(CONTROL_PANEL_ID);
  if (!panel) {
    return;
  }

  panel.classList.toggle("cdm-dark", Boolean(isDarkMode));
  panel.classList.toggle("cdm-light", !isDarkMode);
}

function syncThemeFromStorage() {
  try {
    chrome.storage.local.get(["darkMode"], (result) => {
      applyTheme(result.darkMode !== false);
    });
  } catch {
    applyTheme(true);
  }
}

function attachThemeListener() {
  if (themeListener) {
    return;
  }

  themeListener = (changes, areaName) => {
    if (areaName !== "local" || !("darkMode" in changes)) {
      return;
    }

    applyTheme(changes.darkMode.newValue !== false);
  };

  try {
    chrome.storage.onChanged.addListener(themeListener);
  } catch {
  }
}

function detachThemeListener() {
  if (!themeListener) {
    return;
  }

  try {
    chrome.storage.onChanged.removeListener(themeListener);
  } catch {
  }

  themeListener = null;
}

export function activate() {
  if (isActiveFlag) {
    return;
  }

  isActiveFlag = true;
  console.log("[CDM] Activating Content Download Manager");
  injectStyles();
  createControlPanel();
  syncThemeFromStorage();
  attachThemeListener();
  injectOverlays();
  attachObserver();
  updateStats();
}

export function deactivate() {
  if (!isActiveFlag) {
    return;
  }

  isActiveFlag = false;
  console.log("[CDM] Deactivating Content Download Manager");
  detachObserver();
  detachThemeListener();
  removeOverlays();

  const panel = document.getElementById(CONTROL_PANEL_ID);
  if (panel) {
    panel.remove();
  }

  selectedTileIds.clear();
  isDownloadRunActive = false;
  queuedTiles = [];
}

export function toggle() {
  if (isActiveFlag) {
    deactivate();
    return;
  }

  activate();
}

export function isActive() {
  return isActiveFlag;
}
