export const EVENTS = {
  QUEUE_NEXT: "queue:next",
  PROCESSING_COMPLETE: "processing:complete",
  PROCESSING_STOP: "processing:stop",
  PROCESSING_TERMINATE: "processing:terminate",
  TASK_START: "task:start",
  TASK_COMPLETED: "task:completed",
  TASK_ERROR: "task:error",
  TASK_SKIPPED: "task:skipped",
  DAILY_LIMIT_FALLBACK: "task:daily_limit_fallback",
  OVERLAY_SHOW: "overlay:show",
  OVERLAY_HIDE: "overlay:hide",
  OVERLAY_MESSAGE: "overlay:message",
  OVERLAY_PAUSING: "overlay:pausing",
  OVERLAY_ERROR_BANNER: "overlay:error_banner",
  OVERLAY_ERROR_BANNER_CLEAR: "overlay:error_banner_clear",
  COUNTDOWN_START: "countdown:start",
  PROGRESS_UPDATE: "progress:update",
};

const listeners = new Map();

export function on(event, handler) {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }

  listeners.get(event).add(handler);
  return () => off(event, handler);
}

export function once(event, handler) {
  const onceHandler = (payload) => {
    off(event, onceHandler);
    handler(payload);
  };

  on(event, onceHandler);
}

export function off(event, handler) {
  const eventListeners = listeners.get(event);
  if (!eventListeners) {
    return;
  }

  eventListeners.delete(handler);
  if (eventListeners.size === 0) {
    listeners.delete(event);
  }
}

export function emit(event, payload) {
  const eventListeners = listeners.get(event);
  if (!eventListeners || eventListeners.size === 0) {
    return;
  }

  for (const handler of eventListeners) {
    try {
      handler(payload);
    } catch (error) {
      console.error(`❌ EventBus: handler error for event "${event}":`, error);
    }
  }
}

export function clear(event) {
  listeners.delete(event);
}

export function clearAll() {
  listeners.clear();
}

export function debugListeners() {
  const counts = {};
  for (const [event, eventListeners] of listeners.entries()) {
    counts[event] = eventListeners.size;
  }
  return counts;
}
