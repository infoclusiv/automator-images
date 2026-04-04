const CONTENT_SESSION_ID = `content-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const CONSOLE_LEVELS = {
  log: "info",
  info: "info",
  warn: "warn",
  error: "error",
};

function sanitizeValue(value, depth = 0, seen = new WeakSet()) {
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

    return value.length > 4000 ? `${value.slice(0, 4000)}...[truncated]` : value;
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
    return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1, seen));
  }

  if (typeof value === "function") {
    return `[function ${value.name || "anonymous"}]`;
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[circular]";
    }

    seen.add(value);

    if (value instanceof HTMLElement) {
      return {
        tagName: value.tagName,
        id: value.id || null,
        className: value.className || null,
        text: (value.textContent || "").trim().slice(0, 300),
      };
    }

    if (value instanceof File) {
      return {
        name: value.name,
        size: value.size,
        type: value.type,
      };
    }

    const output = {};
    for (const [key, nestedValue] of Object.entries(value).slice(0, 100)) {
      if (key === "referenceImages" && nestedValue?.images) {
        output[key] = {
          ...nestedValue,
          images: nestedValue.images.map((image) => ({
            name: image?.name || null,
            size: image?.size || null,
            type: image?.type || null,
            hasData: Boolean(image?.data),
            data: image?.data ? "[base64 omitted]" : null,
          })),
        };
        continue;
      }

      if (key === "data" && typeof nestedValue === "string" && nestedValue.startsWith("data:")) {
        output[key] = "[base64 omitted]";
        continue;
      }

      output[key] = sanitizeValue(nestedValue, depth + 1, seen);
    }

    return output;
  }

  return String(value);
}

function summarizeArgs(args) {
  return args
    .map((arg) => {
      if (typeof arg === "string") {
        return arg;
      }

      if (arg instanceof Error) {
        return arg.stack || `${arg.name}: ${arg.message}`;
      }

      try {
        return JSON.stringify(sanitizeValue(arg));
      } catch {
        return String(arg);
      }
    })
    .join(" ")
    .slice(0, 4000);
}

function normalizeLevel(level) {
  const normalized = String(level || "info").toLowerCase();
  return ["debug", "info", "warn", "error"].includes(normalized) ? normalized : "info";
}

function safeBaseContext(getBaseContext) {
  if (typeof getBaseContext !== "function") {
    return {};
  }

  try {
    return sanitizeValue(getBaseContext() || {});
  } catch {
    return {
      loggerContextError: true,
    };
  }
}

function postLog(entry) {
  try {
    chrome.runtime.sendMessage({ action: "appendLog", entry }).catch(() => {});
  } catch {
    // Ignore logging bridge failures to avoid interfering with automation.
  }
}

function buildEntry({ level = "info", event = "content.event", message = "", context = {} }) {
  return {
    source: "content",
    level: normalizeLevel(level),
    event,
    message,
    sessionId: CONTENT_SESSION_ID,
    url: window.location.href,
    context: sanitizeValue(context),
  };
}

export function logEvent(event, message, context = {}, level = "info") {
  postLog(buildEntry({ level, event, message, context }));
}

export function logError(event, error, context = {}) {
  const errorContext = {
    ...context,
    error: sanitizeValue(error),
  };

  postLog(
    buildEntry({
      level: "error",
      event,
      message:
        (error && typeof error === "object" && "message" in error && error.message) ||
        String(error || "Unknown content error"),
      context: errorContext,
    }),
  );
}

export function installConsoleCapture({ getBaseContext } = {}) {
  for (const [method, level] of Object.entries(CONSOLE_LEVELS)) {
    const currentMethod = console[method];
    if (currentMethod?.__flowLogPatched) {
      continue;
    }

    const originalMethod = currentMethod.bind(console);
    const wrappedMethod = (...args) => {
      originalMethod(...args);
      queueMicrotask(() => {
        postLog(
          buildEntry({
            level,
            event: `console.${method}`,
            message: summarizeArgs(args),
            context: {
              args: sanitizeValue(args),
              ...safeBaseContext(getBaseContext),
            },
          }),
        );
      });
    };

    wrappedMethod.__flowLogPatched = true;
    console[method] = wrappedMethod;
  }
}

export function installGlobalErrorLogging({ getBaseContext } = {}) {
  window.addEventListener("error", (event) => {
    postLog(
      buildEntry({
        level: "error",
        event: "runtime.error",
        message: event?.message || "Unhandled runtime error",
        context: {
          filename: event?.filename || null,
          lineno: event?.lineno || null,
          colno: event?.colno || null,
          error: sanitizeValue(event?.error || null),
          ...safeBaseContext(getBaseContext),
        },
      }),
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    postLog(
      buildEntry({
        level: "error",
        event: "runtime.unhandledrejection",
        message:
          (reason && typeof reason === "object" && "message" in reason && reason.message) ||
          String(reason || "Unhandled promise rejection"),
        context: {
          reason: sanitizeValue(reason),
          ...safeBaseContext(getBaseContext),
        },
      }),
    );
  });
}

export function getContentSessionId() {
  return CONTENT_SESSION_ID;
}