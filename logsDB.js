const LOG_DB_NAME = "FlowAutomationLogs";
const LOG_DB_VERSION = 1;
const LOG_STORE_NAME = "logs";
const MAX_LOG_ENTRIES = 5000;

const LOG_LEVELS = new Set(["debug", "info", "warn", "error"]);
const CONSOLE_LEVELS = {
  log: "info",
  info: "info",
  warn: "warn",
  error: "error",
};

let logsBroadcastTimer = null;

function openLogsDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOG_DB_NAME, LOG_DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(LOG_STORE_NAME)) {
        const store = db.createObjectStore(LOG_STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });

        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("source", "source", { unique: false });
        store.createIndex("level", "level", { unique: false });
        store.createIndex("event", "event", { unique: false });
        store.createIndex("sessionId", "sessionId", { unique: false });
      }
    };
  });
}

function buildConsoleMessage(args) {
  return args
    .map((arg) => {
      if (typeof arg === "string") {
        return arg;
      }

      if (arg instanceof Error) {
        return arg.stack || `${arg.name}: ${arg.message}`;
      }

      try {
        return JSON.stringify(sanitizeLogContext(arg));
      } catch {
        return String(arg);
      }
    })
    .join(" ")
    .slice(0, 4000);
}

function normalizeLevel(level) {
  const normalized = String(level || "info").toLowerCase();
  return LOG_LEVELS.has(normalized) ? normalized : "info";
}

function normalizeEvent(eventName, fallback = "runtime.event") {
  const normalized = String(eventName || fallback).trim();
  return normalized || fallback;
}

function toIsoTimestamp(timestamp) {
  return new Date(timestamp).toISOString();
}

function summarizeReferenceImages(referenceImages) {
  if (!referenceImages || !Array.isArray(referenceImages.images)) {
    return referenceImages;
  }

  return {
    ...referenceImages,
    images: referenceImages.images.map((image) => ({
      name: image?.name || null,
      size: image?.size || null,
      type: image?.type || null,
      hasData: Boolean(image?.data),
      data: image?.data ? "[base64 omitted]" : null,
    })),
  };
}

export function sanitizeLogContext(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined) {
    return value;
  }

  if (depth > 5) {
    return "[max-depth]";
  }

  if (typeof value === "string") {
    if (value.startsWith("data:")) {
      return `${value.slice(0, 48)}...[omitted]`;
    }

    if (value.length > 4000) {
      return `${value.slice(0, 4000)}...[truncated]`;
    }

    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack || null,
    };
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeLogContext(item, depth + 1, seen));
  }

  if (typeof value === "function") {
    return `[function ${value.name || "anonymous"}]`;
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[circular]";
    }

    seen.add(value);

    if (typeof HTMLElement !== "undefined" && value instanceof HTMLElement) {
      return {
        tagName: value.tagName,
        id: value.id || null,
        className: value.className || null,
        text: (value.textContent || "").trim().slice(0, 300),
      };
    }

    if (typeof File !== "undefined" && value instanceof File) {
      return {
        name: value.name,
        size: value.size,
        type: value.type,
      };
    }

    if (value instanceof URL) {
      return value.toString();
    }

    const output = {};
    const entries = Object.entries(value).slice(0, 100);

    for (const [key, nestedValue] of entries) {
      if (key === "referenceImages") {
        output[key] = sanitizeLogContext(summarizeReferenceImages(nestedValue), depth + 1, seen);
        continue;
      }

      if (key === "data" && typeof nestedValue === "string" && nestedValue.startsWith("data:")) {
        output[key] = "[base64 omitted]";
        continue;
      }

      output[key] = sanitizeLogContext(nestedValue, depth + 1, seen);
    }

    return output;
  }

  return String(value);
}

function normalizeLogEntry(entry = {}) {
  const createdAt = Number.isFinite(entry.createdAt) ? entry.createdAt : Date.now();
  const source = String(entry.source || "unknown").trim() || "unknown";
  const sessionId = String(entry.sessionId || "unknown").trim() || "unknown";
  const level = normalizeLevel(entry.level);
  const event = normalizeEvent(entry.event);
  const context = sanitizeLogContext(entry.context || {});
  const message = typeof entry.message === "string" && entry.message.trim().length > 0
    ? entry.message.trim().slice(0, 4000)
    : buildConsoleMessage(Array.isArray(entry.args) ? entry.args : []);

  return {
    createdAt,
    createdAtIso: toIsoTimestamp(createdAt),
    source,
    level,
    event,
    message,
    context,
    sessionId,
    url: entry.url ? String(entry.url) : null,
    tabId: typeof entry.tabId === "number" ? entry.tabId : null,
    extensionVersion: entry.extensionVersion ? String(entry.extensionVersion) : null,
  };
}

async function countLogs(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([LOG_STORE_NAME], "readonly");
    const request = transaction.objectStore(LOG_STORE_NAME).count();

    request.onsuccess = () => resolve(request.result || 0);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

async function trimLogs(db) {
  const totalLogs = await countLogs(db);
  const overflow = totalLogs - MAX_LOG_ENTRIES;
  if (overflow <= 0) {
    return totalLogs;
  }

  await new Promise((resolve, reject) => {
    const transaction = db.transaction([LOG_STORE_NAME], "readwrite");
    const store = transaction.objectStore(LOG_STORE_NAME);
    const index = store.index("createdAt");
    let remaining = overflow;

    index.openCursor().onsuccess = (event) => {
      const cursor = event.target.result;
      if (!cursor || remaining <= 0) {
        return;
      }

      cursor.delete();
      remaining -= 1;
      cursor.continue();
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  return totalLogs - overflow;
}

function scheduleLogsUpdatedBroadcast() {
  if (logsBroadcastTimer !== null) {
    return;
  }

  logsBroadcastTimer = setTimeout(() => {
    logsBroadcastTimer = null;
    chrome.runtime.sendMessage({ action: "logsUpdated" }).catch(() => {});
  }, 250);
}

export async function appendLog(entry) {
  const normalizedEntry = normalizeLogEntry(entry);
  const db = await openLogsDb();

  await new Promise((resolve, reject) => {
    const transaction = db.transaction([LOG_STORE_NAME], "readwrite");
    const request = transaction.objectStore(LOG_STORE_NAME).add(normalizedEntry);

    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });

  await trimLogs(db);
  scheduleLogsUpdatedBroadcast();
  return normalizedEntry;
}

async function readAllLogs(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([LOG_STORE_NAME], "readonly");
    const store = transaction.objectStore(LOG_STORE_NAME);
    const index = store.index("createdAt");
    const logs = [];

    index.openCursor(null, "prev").onsuccess = (event) => {
      const cursor = event.target.result;
      if (!cursor) {
        resolve(logs);
        return;
      }

      logs.push(cursor.value);
      cursor.continue();
    };

    transaction.onerror = () => reject(transaction.error);
  });
}

function matchesFilters(logEntry, filters) {
  if (filters.level && filters.level !== "all" && logEntry.level !== filters.level) {
    return false;
  }

  if (filters.source && filters.source !== "all" && logEntry.source !== filters.source) {
    return false;
  }

  if (filters.sessionId && filters.sessionId !== "all" && logEntry.sessionId !== filters.sessionId) {
    return false;
  }

  if (filters.search) {
    const haystack = [
      logEntry.message,
      logEntry.event,
      logEntry.source,
      logEntry.level,
      logEntry.sessionId,
      logEntry.url,
      JSON.stringify(logEntry.context || {}),
    ]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();

    if (!haystack.includes(String(filters.search).toLowerCase())) {
      return false;
    }
  }

  return true;
}

function buildCounts(logs, field) {
  return logs.reduce((counts, logEntry) => {
    const key = logEntry[field] || "unknown";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function buildLogStats(allLogs, filteredLogs) {
  return {
    stored: allLogs.length,
    matching: filteredLogs.length,
    latest: filteredLogs[0]?.createdAtIso || allLogs[0]?.createdAtIso || null,
    byLevel: buildCounts(filteredLogs, "level"),
    bySource: buildCounts(filteredLogs, "source"),
    sessions: [...new Set(filteredLogs.map((logEntry) => logEntry.sessionId).filter(Boolean))],
  };
}

export async function getLogs(filters = {}) {
  const db = await openLogsDb();
  const allLogs = await readAllLogs(db);
  const filteredLogs = allLogs.filter((logEntry) => matchesFilters(logEntry, filters));
  const limit = Number.isFinite(filters.limit) && filters.limit > 0 ? filters.limit : null;

  return {
    logs: limit ? filteredLogs.slice(0, limit) : filteredLogs,
    stats: buildLogStats(allLogs, filteredLogs),
  };
}

export async function getLogStats(filters = {}) {
  const { stats } = await getLogs({ ...filters, limit: null });
  return stats;
}

export async function clearLogs() {
  const db = await openLogsDb();

  await new Promise((resolve, reject) => {
    const transaction = db.transaction([LOG_STORE_NAME], "readwrite");
    const request = transaction.objectStore(LOG_STORE_NAME).clear();

    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });

  scheduleLogsUpdatedBroadcast();
}

export async function downloadLogs(filters = {}) {
  const { logs, stats } = await getLogs({ ...filters, limit: null });
  const exportedAt = Date.now();
  const payload = {
    exportedAt,
    exportedAtIso: toIsoTimestamp(exportedAt),
    filters,
    stats,
    logs,
  };

  const fileContents = JSON.stringify(payload, null, 2);
  const filename = `AutoLabs_flow/logs/flow-debug-logs-${toIsoTimestamp(exportedAt).replace(/[.:]/g, "-")}.json`;
  const url = `data:application/json;charset=utf-8,${encodeURIComponent(fileContents)}`;

  const downloadId = await new Promise((resolve, reject) => {
    chrome.downloads.download(
      {
        url,
        filename,
        saveAs: false,
        conflictAction: "uniquify",
      },
      (resolvedDownloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(resolvedDownloadId);
      },
    );
  });

  return {
    downloadId,
    filename,
    count: logs.length,
  };
}

function safeGetBaseContext(getBaseContext) {
  if (typeof getBaseContext !== "function") {
    return {};
  }

  try {
    return sanitizeLogContext(getBaseContext() || {});
  } catch {
    return {
      loggerContextError: true,
    };
  }
}

export function installConsoleCapture({ source = "background", sessionId = "unknown", getBaseContext } = {}) {
  for (const [method, level] of Object.entries(CONSOLE_LEVELS)) {
    const currentMethod = console[method];
    if (currentMethod?.__flowLogPatched) {
      continue;
    }

    const originalMethod = currentMethod.bind(console);
    const wrappedMethod = (...args) => {
      originalMethod(...args);

      queueMicrotask(() => {
        void appendLog({
          source,
          sessionId,
          level,
          event: `console.${method}`,
          message: buildConsoleMessage(args),
          context: {
            args: sanitizeLogContext(args),
            ...safeGetBaseContext(getBaseContext),
          },
        }).catch(() => {});
      });
    };

    wrappedMethod.__flowLogPatched = true;
    wrappedMethod.__flowOriginal = originalMethod;
    console[method] = wrappedMethod;
  }
}

export function installGlobalErrorLogging({ source = "background", sessionId = "unknown", getBaseContext } = {}) {
  const target = typeof self !== "undefined" ? self : globalThis;

  if (!target?.addEventListener) {
    return;
  }

  target.addEventListener("error", (event) => {
    void appendLog({
      source,
      sessionId,
      level: "error",
      event: "runtime.error",
      message: event?.message || "Unhandled runtime error",
      context: {
        filename: event?.filename || null,
        lineno: event?.lineno || null,
        colno: event?.colno || null,
        error: sanitizeLogContext(event?.error || null),
        ...safeGetBaseContext(getBaseContext),
      },
    }).catch(() => {});
  });

  target.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    void appendLog({
      source,
      sessionId,
      level: "error",
      event: "runtime.unhandledrejection",
      message:
        (reason && typeof reason === "object" && "message" in reason && reason.message) ||
        String(reason || "Unhandled promise rejection"),
      context: {
        reason: sanitizeLogContext(reason),
        ...safeGetBaseContext(getBaseContext),
      },
    }).catch(() => {});
  });
}