const DEFAULT_FILTERS = {
  level: "all",
  source: "all",
  search: "",
  limit: 200,
};

const SHELL_ID = "flow-debug-logs-shell";
const STYLE_ID = "flow-debug-logs-style";
const AUTO_OPEN_HASH = "#logs";
const AUTO_CLEAR_COMPLETED_SHELL_ID = "flow-auto-clear-completed-shell";

let isPanelOpen = false;
let panelElements = null;
let activeFilters = { ...DEFAULT_FILTERS };
let refreshTimer = null;
let autoClearElements = null;

function isTaskManagerPage() {
  return /(?:^|\/)task-manager\.html$/i.test(window.location.pathname);
}

async function getAutoClearCompletedTasksSetting() {
  const response = await sendMessage("getAutoClearCompletedTasksSetting");
  if (!response?.success) {
    throw new Error(response?.error || "Failed to load auto-clear setting");
  }

  return response.enabled === true;
}

async function setAutoClearCompletedTasksSetting(enabled) {
  const response = await sendMessage("setAutoClearCompletedTasksSetting", { enabled });
  if (!response?.success) {
    throw new Error(response?.error || "Failed to save auto-clear setting");
  }

  return response.enabled === true;
}

function sendMessage(action, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, ...payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response || null);
    });
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatTimestamp(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
}

function getLevelClass(level) {
  switch (level) {
    case "error":
      return "flow-debug-logs__pill flow-debug-logs__pill--error";
    case "warn":
      return "flow-debug-logs__pill flow-debug-logs__pill--warn";
    case "debug":
      return "flow-debug-logs__pill flow-debug-logs__pill--debug";
    default:
      return "flow-debug-logs__pill flow-debug-logs__pill--info";
  }
}

function getSourceClass(source) {
  switch (source) {
    case "background":
      return "flow-debug-logs__pill flow-debug-logs__pill--background";
    case "content":
      return "flow-debug-logs__pill flow-debug-logs__pill--content";
    default:
      return "flow-debug-logs__pill flow-debug-logs__pill--default";
  }
}

function createStatChip(label, value, modifier = "") {
  return `
    <div class="flow-debug-logs__stat ${modifier}">
      <div class="flow-debug-logs__stat-label">${escapeHtml(label)}</div>
      <div class="flow-debug-logs__stat-value">${escapeHtml(value)}</div>
    </div>
  `;
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${SHELL_ID} {
      position: relative;
      z-index: 2147483000;
      font-family: "Segoe UI", "Google Sans", sans-serif;
    }

    #${AUTO_CLEAR_COMPLETED_SHELL_ID} {
      position: fixed;
      top: 18px;
      right: 150px;
      z-index: 2147482990;
      font-family: "Segoe UI", "Google Sans", sans-serif;
    }

    .flow-auto-clear-completed__panel {
      min-width: 280px;
      max-width: min(42vw, 360px);
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 18px;
      border: 1px solid rgba(148, 163, 184, 0.28);
      background: rgba(255, 255, 255, 0.88);
      backdrop-filter: blur(14px);
      box-shadow: 0 18px 34px rgba(15, 23, 42, 0.14);
    }

    .flow-auto-clear-completed__content {
      min-width: 0;
      flex: 1;
    }

    .flow-auto-clear-completed__title {
      margin: 0;
      font-size: 12px;
      font-weight: 800;
      line-height: 1.2;
      color: #0f172a;
    }

    .flow-auto-clear-completed__description {
      margin-top: 4px;
      font-size: 11px;
      line-height: 1.35;
      color: #64748b;
    }

    .flow-auto-clear-completed__note {
      margin-top: 4px;
      min-height: 15px;
      font-size: 10px;
      line-height: 1.3;
      color: #0f766e;
    }

    .flow-auto-clear-completed__note.is-error {
      color: #b91c1c;
    }

    .flow-auto-clear-completed__switch {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 30px;
      flex-shrink: 0;
      cursor: pointer;
    }

    .flow-auto-clear-completed__switch input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
      margin: 0;
    }

    .flow-auto-clear-completed__track {
      width: 52px;
      height: 30px;
      border-radius: 999px;
      background: linear-gradient(135deg, #cbd5e1, #94a3b8);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
      transition: background 0.18s ease, opacity 0.18s ease;
    }

    .flow-auto-clear-completed__thumb {
      position: absolute;
      left: 4px;
      top: 4px;
      width: 22px;
      height: 22px;
      border-radius: 999px;
      background: #ffffff;
      box-shadow: 0 6px 12px rgba(15, 23, 42, 0.18);
      transition: transform 0.18s ease;
    }

    .flow-auto-clear-completed__switch input:checked + .flow-auto-clear-completed__track {
      background: linear-gradient(135deg, #10b981, #06b6d4);
    }

    .flow-auto-clear-completed__switch input:checked ~ .flow-auto-clear-completed__thumb {
      transform: translateX(22px);
    }

    .flow-auto-clear-completed__switch input:disabled + .flow-auto-clear-completed__track,
    .flow-auto-clear-completed__switch input:disabled ~ .flow-auto-clear-completed__thumb {
      opacity: 0.6;
    }

    .flow-debug-logs__button {
      position: fixed;
      right: 16px;
      bottom: 84px;
      z-index: 2147483001;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-radius: 999px;
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.94));
      color: #ffffff;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.01em;
      box-shadow: 0 18px 34px rgba(15, 23, 42, 0.28);
      cursor: pointer;
      transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
    }

    .flow-debug-logs__button:hover {
      transform: translateY(-1px);
      box-shadow: 0 22px 38px rgba(15, 23, 42, 0.33);
    }

    .flow-debug-logs__button:disabled,
    .flow-debug-logs__action:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .flow-debug-logs__badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      height: 22px;
      padding: 0 7px;
      border-radius: 999px;
      background: linear-gradient(135deg, #06b6d4, #0ea5e9);
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
    }

    .flow-debug-logs__overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.42);
      backdrop-filter: blur(3px);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
      z-index: 2147483002;
    }

    .flow-debug-logs__drawer {
      position: fixed;
      top: 0;
      right: 0;
      width: min(100vw, 560px);
      height: 100vh;
      display: flex;
      flex-direction: column;
      background: linear-gradient(180deg, #f8fbff 0%, #edf7ff 100%);
      border-left: 1px solid rgba(148, 163, 184, 0.28);
      box-shadow: -22px 0 48px rgba(15, 23, 42, 0.22);
      transform: translateX(100%);
      transition: transform 0.2s ease;
      z-index: 2147483003;
      color: #0f172a;
    }

    .flow-debug-logs__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 20px 20px 14px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.22);
      background: rgba(255, 255, 255, 0.84);
      backdrop-filter: blur(10px);
    }

    .flow-debug-logs__title {
      margin: 0;
      font-size: 20px;
      line-height: 1.1;
      font-weight: 800;
      color: #0f172a;
    }

    .flow-debug-logs__summary {
      margin-top: 6px;
      font-size: 12px;
      color: #64748b;
      line-height: 1.45;
    }

    .flow-debug-logs__close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border: 0;
      border-radius: 12px;
      background: rgba(226, 232, 240, 0.7);
      color: #475569;
      cursor: pointer;
      transition: background 0.16s ease, color 0.16s ease;
    }

    .flow-debug-logs__close:hover {
      background: rgba(203, 213, 225, 0.92);
      color: #0f172a;
    }

    .flow-debug-logs__section {
      padding: 16px 20px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.14);
      background: rgba(255, 255, 255, 0.38);
    }

    .flow-debug-logs__stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .flow-debug-logs__stat {
      padding: 12px;
      border-radius: 16px;
      border: 1px solid rgba(203, 213, 225, 0.85);
      background: rgba(255, 255, 255, 0.82);
      box-shadow: 0 8px 16px rgba(148, 163, 184, 0.08);
    }

    .flow-debug-logs__stat-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #94a3b8;
      margin-bottom: 4px;
    }

    .flow-debug-logs__stat-value {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
    }

    .flow-debug-logs__stat--accent .flow-debug-logs__stat-value {
      color: #2563eb;
    }

    .flow-debug-logs__stat--danger .flow-debug-logs__stat-value {
      color: #dc2626;
    }

    .flow-debug-logs__stat--warn .flow-debug-logs__stat-value {
      color: #d97706;
    }

    .flow-debug-logs__filters {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-top: 14px;
    }

    .flow-debug-logs__label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #64748b;
    }

    .flow-debug-logs__field,
    .flow-debug-logs__search {
      width: 100%;
      margin-top: 6px;
      padding: 10px 12px;
      border-radius: 14px;
      border: 1px solid rgba(203, 213, 225, 0.9);
      background: rgba(255, 255, 255, 0.96);
      color: #0f172a;
      font-size: 13px;
      outline: none;
      box-sizing: border-box;
    }

    .flow-debug-logs__field:focus,
    .flow-debug-logs__search:focus {
      border-color: #38bdf8;
      box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.14);
    }

    .flow-debug-logs__search-wrap {
      margin-top: 12px;
    }

    .flow-debug-logs__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 14px;
    }

    .flow-debug-logs__action {
      border: 0;
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
    }

    .flow-debug-logs__action:hover {
      transform: translateY(-1px);
    }

    .flow-debug-logs__action--secondary {
      background: #ffffff;
      color: #334155;
      border: 1px solid rgba(203, 213, 225, 0.95);
      box-shadow: 0 10px 18px rgba(148, 163, 184, 0.08);
    }

    .flow-debug-logs__action--primary {
      background: linear-gradient(135deg, #2563eb, #06b6d4);
      color: #ffffff;
      box-shadow: 0 14px 24px rgba(14, 165, 233, 0.22);
    }

    .flow-debug-logs__action--danger {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: #ffffff;
      box-shadow: 0 14px 24px rgba(220, 38, 38, 0.2);
    }

    .flow-debug-logs__list {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px 28px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .flow-debug-logs__card,
    .flow-debug-logs__empty,
    .flow-debug-logs__notice {
      border-radius: 18px;
      border: 1px solid rgba(203, 213, 225, 0.86);
      background: rgba(255, 255, 255, 0.88);
      box-shadow: 0 14px 24px rgba(148, 163, 184, 0.08);
    }

    .flow-debug-logs__card {
      padding: 15px;
    }

    .flow-debug-logs__card-top {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: flex-start;
    }

    .flow-debug-logs__meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      min-width: 0;
    }

    .flow-debug-logs__event {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      word-break: break-word;
    }

    .flow-debug-logs__time {
      flex-shrink: 0;
      font-size: 11px;
      color: #94a3b8;
      text-align: right;
    }

    .flow-debug-logs__message {
      margin-top: 12px;
      white-space: pre-wrap;
      word-break: break-word;
      color: #0f172a;
      font-size: 13px;
      line-height: 1.55;
    }

    .flow-debug-logs__submeta {
      margin-top: 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 11px;
      color: #64748b;
      word-break: break-word;
    }

    .flow-debug-logs__details {
      margin-top: 12px;
      border-radius: 14px;
      border: 1px solid rgba(226, 232, 240, 0.95);
      background: rgba(248, 250, 252, 0.96);
      overflow: hidden;
    }

    .flow-debug-logs__details summary {
      padding: 10px 12px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 700;
      color: #475569;
      user-select: none;
    }

    .flow-debug-logs__details pre {
      margin: 0;
      padding: 0 12px 12px;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 11px;
      line-height: 1.55;
      color: #334155;
      font-family: Consolas, "Courier New", monospace;
    }

    .flow-debug-logs__empty,
    .flow-debug-logs__notice {
      padding: 18px;
      text-align: center;
      color: #475569;
      font-size: 13px;
      line-height: 1.5;
    }

    .flow-debug-logs__notice--error {
      border-color: rgba(248, 113, 113, 0.45);
      background: rgba(254, 242, 242, 0.95);
      color: #b91c1c;
    }

    .flow-debug-logs__pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      border: 1px solid transparent;
    }

    .flow-debug-logs__pill--info {
      background: rgba(219, 234, 254, 1);
      color: #1d4ed8;
    }

    .flow-debug-logs__pill--warn {
      background: rgba(254, 243, 199, 1);
      color: #b45309;
    }

    .flow-debug-logs__pill--error {
      background: rgba(254, 226, 226, 1);
      color: #b91c1c;
    }

    .flow-debug-logs__pill--debug,
    .flow-debug-logs__pill--default {
      background: rgba(226, 232, 240, 1);
      color: #475569;
    }

    .flow-debug-logs__pill--background {
      background: rgba(207, 250, 254, 1);
      color: #0f766e;
    }

    .flow-debug-logs__pill--content {
      background: rgba(237, 233, 254, 1);
      color: #6d28d9;
    }

    #${SHELL_ID}.is-open .flow-debug-logs__overlay {
      opacity: 1;
      pointer-events: auto;
    }

    #${SHELL_ID}.is-open .flow-debug-logs__drawer {
      transform: translateX(0);
    }

    @media (max-width: 640px) {
      #${AUTO_CLEAR_COMPLETED_SHELL_ID} {
        top: 72px;
        right: 12px;
        left: 12px;
      }

      .flow-auto-clear-completed__panel {
        min-width: 0;
        max-width: none;
      }

      .flow-debug-logs__button {
        right: 12px;
        bottom: 76px;
        padding: 10px 12px;
      }

      .flow-debug-logs__drawer {
        width: 100vw;
      }

      .flow-debug-logs__header,
      .flow-debug-logs__section,
      .flow-debug-logs__list {
        padding-left: 14px;
        padding-right: 14px;
      }

      .flow-debug-logs__filters,
      .flow-debug-logs__stats {
        grid-template-columns: 1fr;
      }
    }

    @media (prefers-color-scheme: dark) {
      .flow-debug-logs__button {
        background: linear-gradient(135deg, rgba(248, 250, 252, 0.96), rgba(226, 232, 240, 0.96));
        color: #0f172a;
        border-color: rgba(255, 255, 255, 0.08);
        box-shadow: 0 18px 34px rgba(2, 6, 23, 0.34);
      }

      .flow-debug-logs__badge {
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14);
      }

      .flow-debug-logs__overlay {
        background: rgba(2, 6, 23, 0.6);
      }

      .flow-debug-logs__drawer {
        background: linear-gradient(180deg, #020617 0%, #0f172a 100%);
        border-left-color: rgba(71, 85, 105, 0.55);
        color: #e2e8f0;
      }

      .flow-auto-clear-completed__panel {
        background: rgba(15, 23, 42, 0.92);
        border-color: rgba(71, 85, 105, 0.72);
        box-shadow: 0 16px 28px rgba(2, 6, 23, 0.3);
      }

      .flow-auto-clear-completed__title {
        color: #f8fafc;
      }

      .flow-auto-clear-completed__description {
        color: #94a3b8;
      }

      .flow-auto-clear-completed__note {
        color: #5eead4;
      }

      .flow-auto-clear-completed__note.is-error {
        color: #fca5a5;
      }

      .flow-debug-logs__header {
        background: rgba(15, 23, 42, 0.9);
        border-bottom-color: rgba(51, 65, 85, 0.55);
      }

      .flow-debug-logs__title {
        color: #f8fafc;
      }

      .flow-debug-logs__summary,
      .flow-debug-logs__time,
      .flow-debug-logs__event,
      .flow-debug-logs__submeta,
      .flow-debug-logs__label {
        color: #94a3b8;
      }

      .flow-debug-logs__close {
        background: rgba(51, 65, 85, 0.9);
        color: #cbd5e1;
      }

      .flow-debug-logs__close:hover {
        background: rgba(71, 85, 105, 0.96);
        color: #ffffff;
      }

      .flow-debug-logs__section {
        background: rgba(15, 23, 42, 0.55);
        border-bottom-color: rgba(51, 65, 85, 0.42);
      }

      .flow-debug-logs__stat,
      .flow-debug-logs__card,
      .flow-debug-logs__empty,
      .flow-debug-logs__notice {
        background: rgba(15, 23, 42, 0.85);
        border-color: rgba(51, 65, 85, 0.78);
        box-shadow: 0 16px 28px rgba(2, 6, 23, 0.25);
      }

      .flow-debug-logs__stat-label {
        color: #64748b;
      }

      .flow-debug-logs__stat-value,
      .flow-debug-logs__message {
        color: #f8fafc;
      }

      .flow-debug-logs__field,
      .flow-debug-logs__search {
        background: rgba(15, 23, 42, 0.96);
        color: #f8fafc;
        border-color: rgba(71, 85, 105, 0.85);
      }

      .flow-debug-logs__action--secondary {
        background: rgba(15, 23, 42, 0.94);
        color: #e2e8f0;
        border-color: rgba(71, 85, 105, 0.9);
      }

      .flow-debug-logs__details {
        background: rgba(2, 6, 23, 0.6);
        border-color: rgba(51, 65, 85, 0.86);
      }

      .flow-debug-logs__details summary,
      .flow-debug-logs__details pre {
        color: #cbd5e1;
      }

      .flow-debug-logs__notice--error {
        background: rgba(69, 10, 10, 0.45);
        color: #fecaca;
      }

      .flow-debug-logs__pill--info {
        background: rgba(30, 64, 175, 0.28);
        color: #bfdbfe;
      }

      .flow-debug-logs__pill--warn {
        background: rgba(146, 64, 14, 0.34);
        color: #fde68a;
      }

      .flow-debug-logs__pill--error {
        background: rgba(127, 29, 29, 0.42);
        color: #fecaca;
      }

      .flow-debug-logs__pill--debug,
      .flow-debug-logs__pill--default {
        background: rgba(51, 65, 85, 0.9);
        color: #cbd5e1;
      }

      .flow-debug-logs__pill--background {
        background: rgba(21, 94, 117, 0.42);
        color: #a5f3fc;
      }

      .flow-debug-logs__pill--content {
        background: rgba(76, 29, 149, 0.44);
        color: #ddd6fe;
      }
    }
  `;

  document.head.appendChild(style);
}

function renderStats(stats) {
  if (!panelElements) {
    return;
  }

  const byLevel = stats?.byLevel || {};
  panelElements.stats.innerHTML = [
    createStatChip("Stored", stats?.stored ?? 0),
    createStatChip("Matching", stats?.matching ?? 0, "flow-debug-logs__stat--accent"),
    createStatChip("Errors", byLevel.error || 0, "flow-debug-logs__stat--danger"),
    createStatChip("Warnings", byLevel.warn || 0, "flow-debug-logs__stat--warn"),
  ].join("");

  panelElements.badge.textContent = String(stats?.stored ?? 0);
  panelElements.summary.textContent = stats?.latest
    ? `Showing latest ${activeFilters.limit} matching logs. Last event: ${formatTimestamp(stats.latest)}`
    : "No logs captured yet.";
}

function renderLogItem(logEntry) {
  const contextText = JSON.stringify(logEntry.context || {}, null, 2);
  const hasContext = contextText && contextText !== "{}";

  return `
    <article class="flow-debug-logs__card">
      <div class="flow-debug-logs__card-top">
        <div class="flow-debug-logs__meta">
          <span class="${getLevelClass(logEntry.level)}">${escapeHtml(logEntry.level)}</span>
          <span class="${getSourceClass(logEntry.source)}">${escapeHtml(logEntry.source)}</span>
          <span class="flow-debug-logs__event">${escapeHtml(logEntry.event)}</span>
        </div>
        <span class="flow-debug-logs__time">${escapeHtml(formatTimestamp(logEntry.createdAtIso))}</span>
      </div>
      <div class="flow-debug-logs__message">${escapeHtml(logEntry.message || "(no message)")}</div>
      <div class="flow-debug-logs__submeta">
        <span>Session: ${escapeHtml(logEntry.sessionId || "unknown")}</span>
        ${logEntry.tabId !== null && logEntry.tabId !== undefined ? `<span>Tab: ${escapeHtml(logEntry.tabId)}</span>` : ""}
        ${logEntry.url ? `<span>URL: ${escapeHtml(logEntry.url)}</span>` : ""}
      </div>
      ${hasContext ? `
        <details class="flow-debug-logs__details">
          <summary>Context</summary>
          <pre>${escapeHtml(contextText)}</pre>
        </details>
      ` : ""}
    </article>
  `;
}

function renderLogs(logs) {
  if (!panelElements) {
    return;
  }

  if (!Array.isArray(logs) || logs.length === 0) {
    panelElements.list.innerHTML = `
      <div class="flow-debug-logs__empty">
        <div><strong>No logs match the current filters.</strong></div>
        <div>Start a Flow run, trigger an error, or clear your filters.</div>
      </div>
    `;
    return;
  }

  panelElements.list.innerHTML = logs.map(renderLogItem).join("");
}

function readFiltersFromUi() {
  if (!panelElements) {
    return { ...DEFAULT_FILTERS };
  }

  return {
    level: panelElements.level.value,
    source: panelElements.source.value,
    search: panelElements.search.value.trim(),
    limit: DEFAULT_FILTERS.limit,
  };
}

async function refreshLogs() {
  if (!panelElements) {
    return;
  }

  activeFilters = readFiltersFromUi();
  panelElements.list.innerHTML = `
    <div class="flow-debug-logs__notice">Loading logs...</div>
  `;

  try {
    const response = await sendMessage("getLogs", { filters: activeFilters });
    renderStats(response?.stats || {});
    renderLogs(response?.logs || []);
  } catch (error) {
    panelElements.list.innerHTML = `
      <div class="flow-debug-logs__notice flow-debug-logs__notice--error">
        Failed to load logs: ${escapeHtml(error.message || "Unknown error")}
      </div>
    `;
  }
}

function scheduleRefresh() {
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer);
  }

  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void refreshLogs();
  }, 250);
}

async function refreshBadgeOnly() {
  if (!panelElements) {
    return;
  }

  try {
    const stats = await sendMessage("getLogStats", { filters: {} });
    panelElements.badge.textContent = String(stats?.stored ?? 0);
  } catch {
    panelElements.badge.textContent = "!";
  }
}

async function downloadCurrentLogs() {
  if (!panelElements) {
    return;
  }

  panelElements.download.disabled = true;

  try {
    await sendMessage("downloadLogs", { filters: activeFilters });
    await refreshBadgeOnly();
  } catch (error) {
    window.alert(`Failed to download logs: ${error.message || "Unknown error"}`);
  } finally {
    panelElements.download.disabled = false;
  }
}

async function clearCurrentLogs() {
  if (!window.confirm("Delete all stored extension logs? This cannot be undone.")) {
    return;
  }

  panelElements.clear.disabled = true;

  try {
    await sendMessage("clearLogs");
    await refreshLogs();
  } catch (error) {
    window.alert(`Failed to clear logs: ${error.message || "Unknown error"}`);
  } finally {
    panelElements.clear.disabled = false;
  }
}

function syncShellState() {
  if (!panelElements?.shell) {
    return;
  }

  panelElements.shell.classList.toggle("is-open", isPanelOpen);
}

function togglePanel(nextState) {
  isPanelOpen = typeof nextState === "boolean" ? nextState : !isPanelOpen;
  syncShellState();

  if (isPanelOpen) {
    scheduleRefresh();
  }
}

function onEscapeKey(event) {
  if (event.key === "Escape" && isPanelOpen) {
    togglePanel(false);
  }
}

function renderAutoClearCompletedState({ enabled, note = "", isError = false }) {
  if (!autoClearElements) {
    return;
  }

  autoClearElements.toggle.checked = enabled === true;
  autoClearElements.note.textContent = note;
  autoClearElements.note.classList.toggle("is-error", isError);
}

function setAutoClearCompletedPending(isPending) {
  if (!autoClearElements) {
    return;
  }

  autoClearElements.toggle.disabled = isPending;
  autoClearElements.panel.dataset.pending = isPending ? "true" : "false";
}

async function refreshAutoClearCompletedUi() {
  if (!autoClearElements) {
    return;
  }

  try {
    const enabled = await getAutoClearCompletedTasksSetting();
    renderAutoClearCompletedState({
      enabled,
      note: enabled ? "Se borran solo las tareas processed al terminar el flujo." : "Conserva la cola completa hasta que la limpies manualmente.",
    });
  } catch (error) {
    renderAutoClearCompletedState({
      enabled: autoClearElements.toggle.checked,
      note: error.message || "No se pudo cargar el ajuste.",
      isError: true,
    });
  }
}

function createAutoClearCompletedUi() {
  if (!isTaskManagerPage() || document.getElementById(AUTO_CLEAR_COMPLETED_SHELL_ID)) {
    return;
  }

  const container = document.createElement("div");
  container.id = AUTO_CLEAR_COMPLETED_SHELL_ID;
  container.innerHTML = `
    <div class="flow-auto-clear-completed__panel">
      <div class="flow-auto-clear-completed__content">
        <div class="flow-auto-clear-completed__title">Auto-clear completed tasks</div>
        <div class="flow-auto-clear-completed__description">Limpia automaticamente las tareas processed cuando Flow termina el lote actual.</div>
        <div class="flow-auto-clear-completed__note"></div>
      </div>
      <label class="flow-auto-clear-completed__switch" aria-label="Toggle auto-clear completed tasks">
        <input id="flow-auto-clear-completed-toggle" type="checkbox" />
        <span class="flow-auto-clear-completed__track"></span>
        <span class="flow-auto-clear-completed__thumb"></span>
      </label>
    </div>
  `;

  document.body.appendChild(container);

  autoClearElements = {
    panel: container.querySelector(".flow-auto-clear-completed__panel"),
    toggle: container.querySelector("#flow-auto-clear-completed-toggle"),
    note: container.querySelector(".flow-auto-clear-completed__note"),
  };

  autoClearElements.toggle.addEventListener("change", async () => {
    const nextEnabled = autoClearElements.toggle.checked;
    setAutoClearCompletedPending(true);

    try {
      const savedEnabled = await setAutoClearCompletedTasksSetting(nextEnabled);
      renderAutoClearCompletedState({
        enabled: savedEnabled,
        note: savedEnabled
          ? "Activo. Solo las tareas processed se eliminaran al finalizar el flujo."
          : "Desactivado. La cola no se limpiara automaticamente.",
      });
    } catch (error) {
      autoClearElements.toggle.checked = !nextEnabled;
      renderAutoClearCompletedState({
        enabled: !nextEnabled,
        note: error.message || "No se pudo guardar el ajuste.",
        isError: true,
      });
    } finally {
      setAutoClearCompletedPending(false);
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.autoClearCompletedTasks) {
      return;
    }

    renderAutoClearCompletedState({
      enabled: changes.autoClearCompletedTasks.newValue === true,
      note: changes.autoClearCompletedTasks.newValue === true
        ? "Activo. Solo las tareas processed se eliminaran al finalizar el flujo."
        : "Desactivado. La cola no se limpiara automaticamente.",
    });
  });

  void refreshAutoClearCompletedUi();
}

function createUi() {
  if (document.getElementById(SHELL_ID)) {
    return;
  }

  ensureStyles();

  const container = document.createElement("div");
  container.id = SHELL_ID;
  container.innerHTML = `
    <button id="flow-debug-logs-button" type="button" class="flow-debug-logs__button" aria-label="Open extension logs">
      <span>Logs</span>
      <span id="flow-debug-logs-badge" class="flow-debug-logs__badge">0</span>
    </button>
    <div id="flow-debug-logs-overlay" class="flow-debug-logs__overlay"></div>
    <aside id="flow-debug-logs-drawer" class="flow-debug-logs__drawer" aria-label="Extension logs panel">
      <div class="flow-debug-logs__header">
        <div>
          <h2 class="flow-debug-logs__title">Extension Logs</h2>
          <div id="flow-debug-logs-summary" class="flow-debug-logs__summary">Loading log summary...</div>
        </div>
        <button id="flow-debug-logs-close" type="button" class="flow-debug-logs__close" aria-label="Close logs panel">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="flow-debug-logs__section">
        <div id="flow-debug-logs-stats" class="flow-debug-logs__stats"></div>
        <div class="flow-debug-logs__filters">
          <label class="flow-debug-logs__label">
            Level
            <select id="flow-debug-logs-level" class="flow-debug-logs__field">
              <option value="all">All levels</option>
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warnings</option>
              <option value="error">Errors</option>
            </select>
          </label>
          <label class="flow-debug-logs__label">
            Source
            <select id="flow-debug-logs-source" class="flow-debug-logs__field">
              <option value="all">All sources</option>
              <option value="background">Background</option>
              <option value="content">Content</option>
            </select>
          </label>
        </div>
        <label class="flow-debug-logs__label flow-debug-logs__search-wrap">
          Search
          <input id="flow-debug-logs-search" type="search" class="flow-debug-logs__search" placeholder="prompt, event, reason, session..." />
        </label>
        <div class="flow-debug-logs__actions">
          <button id="flow-debug-logs-refresh" type="button" class="flow-debug-logs__action flow-debug-logs__action--secondary">Refresh</button>
          <button id="flow-debug-logs-download" type="button" class="flow-debug-logs__action flow-debug-logs__action--primary">Download JSON</button>
          <button id="flow-debug-logs-clear" type="button" class="flow-debug-logs__action flow-debug-logs__action--danger">Clear Logs</button>
        </div>
      </div>
      <div id="flow-debug-logs-list" class="flow-debug-logs__list"></div>
    </aside>
  `;

  document.body.appendChild(container);

  panelElements = {
    shell: container,
    button: container.querySelector("#flow-debug-logs-button"),
    badge: container.querySelector("#flow-debug-logs-badge"),
    overlay: container.querySelector("#flow-debug-logs-overlay"),
    drawer: container.querySelector("#flow-debug-logs-drawer"),
    close: container.querySelector("#flow-debug-logs-close"),
    summary: container.querySelector("#flow-debug-logs-summary"),
    stats: container.querySelector("#flow-debug-logs-stats"),
    level: container.querySelector("#flow-debug-logs-level"),
    source: container.querySelector("#flow-debug-logs-source"),
    search: container.querySelector("#flow-debug-logs-search"),
    refresh: container.querySelector("#flow-debug-logs-refresh"),
    download: container.querySelector("#flow-debug-logs-download"),
    clear: container.querySelector("#flow-debug-logs-clear"),
    list: container.querySelector("#flow-debug-logs-list"),
  };

  panelElements.button.addEventListener("click", () => togglePanel());
  panelElements.overlay.addEventListener("click", () => togglePanel(false));
  panelElements.close.addEventListener("click", () => togglePanel(false));
  panelElements.refresh.addEventListener("click", () => scheduleRefresh());
  panelElements.download.addEventListener("click", () => void downloadCurrentLogs());
  panelElements.clear.addEventListener("click", () => void clearCurrentLogs());

  panelElements.level.value = DEFAULT_FILTERS.level;
  panelElements.source.value = DEFAULT_FILTERS.source;
  panelElements.search.value = DEFAULT_FILTERS.search;

  panelElements.level.addEventListener("change", () => scheduleRefresh());
  panelElements.source.addEventListener("change", () => scheduleRefresh());
  panelElements.search.addEventListener("input", () => scheduleRefresh());

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.action !== "logsUpdated") {
      return;
    }

    if (isPanelOpen) {
      scheduleRefresh();
      return;
    }

    void refreshBadgeOnly();
  });

  window.addEventListener("keydown", onEscapeKey);
  syncShellState();
}

async function init() {
  createUi();
  createAutoClearCompletedUi();
  await refreshBadgeOnly();

  if (window.location.hash === AUTO_OPEN_HASH) {
    togglePanel(true);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void init();
  });
} else {
  void init();
}