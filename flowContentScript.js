(function() {
	//#region \0rolldown/runtime.js
	var __defProp = Object.defineProperty;
	var __exportAll = (all, no_symbols) => {
		let target = {};
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
		if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
		return target;
	};
	//#endregion
	//#region src/content/logger.js
	var CONTENT_SESSION_ID = `content-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	var CONSOLE_LEVELS = {
		log: "info",
		info: "info",
		warn: "warn",
		error: "error"
	};
	function sanitizeValue(value, depth = 0, seen = /* @__PURE__ */ new WeakSet()) {
		if (value === null || value === void 0) return value;
		if (depth > 5) return "[max-depth]";
		if (typeof value === "string") {
			if (value.startsWith("data:")) return `${value.slice(0, 48)}...[omitted]`;
			return value.length > 4e3 ? `${value.slice(0, 4e3)}...[truncated]` : value;
		}
		if (typeof value === "number" || typeof value === "boolean") return value;
		if (typeof value === "bigint") return value.toString();
		if (value instanceof Error) return {
			name: value.name,
			message: value.message,
			stack: value.stack || null
		};
		if (value instanceof Date) return value.toISOString();
		if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1, seen));
		if (typeof value === "function") return `[function ${value.name || "anonymous"}]`;
		if (typeof value === "object") {
			if (seen.has(value)) return "[circular]";
			seen.add(value);
			if (value instanceof HTMLElement) return {
				tagName: value.tagName,
				id: value.id || null,
				className: value.className || null,
				text: (value.textContent || "").trim().slice(0, 300)
			};
			if (value instanceof File) return {
				name: value.name,
				size: value.size,
				type: value.type
			};
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
							data: image?.data ? "[base64 omitted]" : null
						}))
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
		return args.map((arg) => {
			if (typeof arg === "string") return arg;
			if (arg instanceof Error) return arg.stack || `${arg.name}: ${arg.message}`;
			try {
				return JSON.stringify(sanitizeValue(arg));
			} catch {
				return String(arg);
			}
		}).join(" ").slice(0, 4e3);
	}
	function normalizeLevel(level) {
		const normalized = String(level || "info").toLowerCase();
		return [
			"debug",
			"info",
			"warn",
			"error"
		].includes(normalized) ? normalized : "info";
	}
	function safeBaseContext(getBaseContext) {
		if (typeof getBaseContext !== "function") return {};
		try {
			return sanitizeValue(getBaseContext() || {});
		} catch {
			return { loggerContextError: true };
		}
	}
	function postLog(entry) {
		try {
			chrome.runtime.sendMessage({
				action: "appendLog",
				entry
			}).catch(() => {});
		} catch {}
	}
	function buildEntry({ level = "info", event = "content.event", message = "", context = {} }) {
		return {
			source: "content",
			level: normalizeLevel(level),
			event,
			message,
			sessionId: CONTENT_SESSION_ID,
			url: window.location.href,
			context: sanitizeValue(context)
		};
	}
	function logEvent(event, message, context = {}, level = "info") {
		postLog(buildEntry({
			level,
			event,
			message,
			context
		}));
	}
	function logError(event, error, context = {}) {
		const errorContext = {
			...context,
			error: sanitizeValue(error)
		};
		postLog(buildEntry({
			level: "error",
			event,
			message: error && typeof error === "object" && "message" in error && error.message || String(error || "Unknown content error"),
			context: errorContext
		}));
	}
	function installConsoleCapture({ getBaseContext } = {}) {
		for (const [method, level] of Object.entries(CONSOLE_LEVELS)) {
			const currentMethod = console[method];
			if (currentMethod?.__flowLogPatched) continue;
			const originalMethod = currentMethod.bind(console);
			const wrappedMethod = (...args) => {
				originalMethod(...args);
				queueMicrotask(() => {
					postLog(buildEntry({
						level,
						event: `console.${method}`,
						message: summarizeArgs(args),
						context: {
							args: sanitizeValue(args),
							...safeBaseContext(getBaseContext)
						}
					}));
				});
			};
			wrappedMethod.__flowLogPatched = true;
			console[method] = wrappedMethod;
		}
	}
	function installGlobalErrorLogging({ getBaseContext } = {}) {
		window.addEventListener("error", (event) => {
			postLog(buildEntry({
				level: "error",
				event: "runtime.error",
				message: event?.message || "Unhandled runtime error",
				context: {
					filename: event?.filename || null,
					lineno: event?.lineno || null,
					colno: event?.colno || null,
					error: sanitizeValue(event?.error || null),
					...safeBaseContext(getBaseContext)
				}
			}));
		});
		window.addEventListener("unhandledrejection", (event) => {
			const reason = event?.reason;
			postLog(buildEntry({
				level: "error",
				event: "runtime.unhandledrejection",
				message: reason && typeof reason === "object" && "message" in reason && reason.message || String(reason || "Unhandled promise rejection"),
				context: {
					reason: sanitizeValue(reason),
					...safeBaseContext(getBaseContext)
				}
			}));
		});
	}
	function getContentSessionId() {
		return CONTENT_SESSION_ID;
	}
	//#endregion
	//#region src/content/constants.js
	var SELECTORS = {
		PROMPT_POLICY_ERROR_POPUP_XPATH: "//li[@data-sonner-toast and .//i[normalize-space(text())='error'] and not(.//*[contains(., '5')])]",
		QUEUE_FULL_POPUP_XPATH: "//li[@data-sonner-toast and .//i[normalize-space(text())='error'] and .//*[contains(., '5')]]"
	};
	var STORAGE_KEY = "flowAutomationState";
	var MODEL_DISPLAY_NAMES = {
		default: "Veo 3.1 - Fast",
		veo3_fast: "Veo 3.1 - Fast",
		veo3_quality: "Veo 3.1 - Quality",
		veo2_fast: "Veo 2 - Fast",
		veo2_quality: "Veo 2 - Quality",
		veo3_fast_low: "Veo 3.1 - Fast",
		nano_banana_pro: "Nano Banana Pro",
		nano_banana2: "Nano Banana 2",
		nano_banana: "Nano Banana 2",
		imagen4: "Imagen 4"
	};
	var MONITORING_TIMEOUTS = {
		IMAGE_STALL: 3e4,
		IMAGE_ZERO_TILES: 6e4,
		VIDEO_STALL: 9e4,
		VIDEO_ZERO_TILES: 18e4
	};
	var DEFAULT_SETTINGS = {
		autoDownload: true,
		delayBetweenPrompts: 8e3,
		delayMin: 15,
		delayMax: 30,
		flowVideoCount: "1",
		flowModel: "default",
		flowAspectRatio: "landscape",
		imageDownloadQuality: "1K",
		videoDownloadQuality: "720p",
		autoClearCache: false,
		autoClearCacheInterval: 50
	};
	var RETRY_DELAY_MS = 5e3;
	var INTER_TASK_DELAY_FALLBACK_MS = 15e3;
	var DEFAULT_SCAN_INTERVAL_MS = 5e3;
	var FLOW_PAGE_ZOOM_FACTOR = .75;
	var IMAGE_UPLOADER_DELAYS = {
		UPLOAD_BETWEEN_FILES: 500,
		UPLOAD_SETTLE: 3e3,
		SEARCH_POLL: 300,
		SEARCH_SETTLE: 400,
		AFTER_ATTACH: 500
	};
	var IMAGE_UPLOADER_TIMEOUTS = {
		PICKER_OPEN: 8e3,
		SEARCH_RESULT: 15e3,
		PICKER_CLOSE: 8e3,
		LIBRARY_SEARCH: 5e3
	};
	var DOWNLOAD_QUALITY_DEFAULTS = {
		image: "1K",
		video: "720p"
	};
	//#endregion
	//#region src/content/domUtils.js
	function h(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
	function $(xpath, context = document) {
		try {
			return document.evaluate(xpath, context, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
		} catch (error) {
			console.error("❌ XPath evaluation error:", error, "\nXPath:", xpath);
			return null;
		}
	}
	async function waitForElement(selector, timeoutMs = 5e3) {
		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			const element = document.querySelector(selector);
			if (element) return element;
			await h(100);
		}
		return null;
	}
	function re() {
		document.body.dispatchEvent(new KeyboardEvent("keydown", {
			key: "Escape",
			keyCode: 27,
			bubbles: true,
			cancelable: true,
			composed: true
		}));
	}
	function centerOf(element) {
		const rect = element.getBoundingClientRect();
		return {
			x: rect.left + rect.width / 2,
			y: rect.top + rect.height / 2
		};
	}
	//#endregion
	//#region src/content/eventBus.js
	var eventBus_exports = /* @__PURE__ */ __exportAll({
		EVENTS: () => EVENTS,
		clear: () => clear,
		clearAll: () => clearAll,
		debugListeners: () => debugListeners,
		emit: () => emit,
		off: () => off,
		on: () => on,
		once: () => once
	});
	var EVENTS = {
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
		PROGRESS_UPDATE: "progress:update"
	};
	var listeners = /* @__PURE__ */ new Map();
	function on(event, handler) {
		if (!listeners.has(event)) listeners.set(event, /* @__PURE__ */ new Set());
		listeners.get(event).add(handler);
		return () => off(event, handler);
	}
	function once(event, handler) {
		const onceHandler = (payload) => {
			off(event, onceHandler);
			handler(payload);
		};
		on(event, onceHandler);
	}
	function off(event, handler) {
		const eventListeners = listeners.get(event);
		if (!eventListeners) return;
		eventListeners.delete(handler);
		if (eventListeners.size === 0) listeners.delete(event);
	}
	function emit(event, payload) {
		const eventListeners = listeners.get(event);
		if (!eventListeners || eventListeners.size === 0) return;
		for (const handler of eventListeners) try {
			handler(payload);
		} catch (error) {
			console.error(`❌ EventBus: handler error for event "${event}":`, error);
		}
	}
	function clear(event) {
		listeners.delete(event);
	}
	function clearAll() {
		listeners.clear();
	}
	function debugListeners() {
		const counts = {};
		for (const [event, eventListeners] of listeners.entries()) counts[event] = eventListeners.size;
		return counts;
	}
	//#endregion
	//#region src/content/stateManager.js
	var stateManager_exports = /* @__PURE__ */ __exportAll({
		clearCountdownTimer: () => clearCountdownTimer$1,
		clearStateFromStorage: () => clearStateFromStorage,
		formatTime: () => formatTime,
		getCurrentTask: () => getCurrentTask,
		getCurrentTaskByStatus: () => getCurrentTaskByStatus,
		getEffectiveSetting: () => getEffectiveSetting,
		getRandomDelay: () => getRandomDelay,
		getSettings: () => getSettings,
		getState: () => getState$7,
		getTaskByIndex: () => getTaskByIndex,
		getTaskList: () => getTaskList,
		init: () => init$8,
		loadStateFromStorage: () => loadStateFromStorage,
		saveStateToStorage: () => saveStateToStorage,
		sendTaskUpdate: () => sendTaskUpdate,
		setState: () => setState$4,
		startCountdown: () => startCountdown,
		updateSettings: () => updateSettings,
		updateTask: () => updateTask,
		verifyAuthenticationState: () => verifyAuthenticationState
	});
	var eventBus$3 = null;
	var isUserLoggedIn = false;
	var subscriptionStatus = null;
	var userId = null;
	var isProcessing = false;
	var isPausing = false;
	var currentPromptIndex = 0;
	var prompts = [];
	var settings = { ...DEFAULT_SETTINGS };
	var isCurrentPromptProcessed = false;
	var lastAppliedSettings = null;
	var lastAppliedMode = null;
	var fallbackModel = null;
	var taskList = [];
	var currentTaskIndex = 0;
	var tileScanInterval = null;
	var scanIntervalMs = DEFAULT_SCAN_INTERVAL_MS;
	var currentProcessingPrompt = null;
	var currentTaskStartTime = null;
	var countdownInterval = null;
	var maxRetries = 3;
	var currentRetries = 0;
	var preSubmitTileIds = /* @__PURE__ */ new Set();
	function init$8(eventBusInstance, contentDownloadManagerInstance = null) {
		eventBus$3 = eventBusInstance;
	}
	function getState$7() {
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
			preSubmitTileIds
		};
	}
	function setState$4(partial) {
		if (partial.isUserLoggedIn !== void 0) isUserLoggedIn = partial.isUserLoggedIn;
		if (partial.subscriptionStatus !== void 0) subscriptionStatus = partial.subscriptionStatus;
		if (partial.userId !== void 0) userId = partial.userId;
		if (partial.isProcessing !== void 0) {
			const previousValue = isProcessing;
			isProcessing = partial.isProcessing;
			if (previousValue !== isProcessing) chrome.runtime.sendMessage({
				action: "automationStateChanged",
				isRunning: isProcessing
			}).catch(() => {});
		}
		if (partial.isPausing !== void 0) isPausing = partial.isPausing;
		if (partial.currentPromptIndex !== void 0) currentPromptIndex = partial.currentPromptIndex;
		if (partial.prompts !== void 0) prompts = partial.prompts;
		if (partial.settings !== void 0) settings = partial.settings;
		if (partial.isCurrentPromptProcessed !== void 0) isCurrentPromptProcessed = partial.isCurrentPromptProcessed;
		if (partial.lastAppliedSettings !== void 0) lastAppliedSettings = partial.lastAppliedSettings;
		if (partial.lastAppliedMode !== void 0) lastAppliedMode = partial.lastAppliedMode;
		if (partial.fallbackModel !== void 0) fallbackModel = partial.fallbackModel;
		if (partial.taskList !== void 0) taskList = partial.taskList;
		if (partial.currentTaskIndex !== void 0) currentTaskIndex = partial.currentTaskIndex;
		if (partial.tileScanInterval !== void 0) tileScanInterval = partial.tileScanInterval;
		if (partial.scanIntervalMs !== void 0) scanIntervalMs = partial.scanIntervalMs;
		if (partial.currentProcessingPrompt !== void 0) currentProcessingPrompt = partial.currentProcessingPrompt;
		if (partial.currentTaskStartTime !== void 0) currentTaskStartTime = partial.currentTaskStartTime;
		if (partial.countdownInterval !== void 0) countdownInterval = partial.countdownInterval;
		if (partial.maxRetries !== void 0) maxRetries = partial.maxRetries;
		if (partial.currentRetries !== void 0) currentRetries = partial.currentRetries;
		if (partial.preSubmitTileIds !== void 0) preSubmitTileIds = partial.preSubmitTileIds;
	}
	function getSettings() {
		return settings;
	}
	function updateSettings(partial) {
		settings = {
			...settings,
			...partial
		};
	}
	function getTaskList() {
		return taskList;
	}
	function updateTask(index, partial) {
		if (!taskList[index]) return;
		taskList[index] = {
			...taskList[index],
			...partial
		};
	}
	function getCurrentTask() {
		return taskList[currentPromptIndex] || null;
	}
	function getTaskByIndex(index) {
		return taskList.find((task) => task.index === index) || null;
	}
	function getCurrentTaskByStatus() {
		return taskList.find((task) => task.status === "current") || null;
	}
	function getEffectiveSetting(task, key, fallbackSettings) {
		if (task && task.settings && task.settings[key] !== void 0) return task.settings[key];
		return fallbackSettings[key];
	}
	async function saveStateToStorage() {
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
			currentTaskIndex
		};
		return new Promise((resolve) => {
			chrome.storage.local.set({ [STORAGE_KEY]: snapshot }, () => resolve(snapshot));
		});
	}
	async function loadStateFromStorage() {
		return new Promise((resolve) => {
			chrome.storage.local.get(STORAGE_KEY, (result) => {
				resolve(result["flowAutomationState"] || null);
			});
		});
	}
	async function clearStateFromStorage() {
		return new Promise((resolve) => {
			chrome.storage.local.remove(STORAGE_KEY, () => resolve());
		});
	}
	function clearCountdownTimer$1() {
		if (!countdownInterval) return;
		clearInterval(countdownInterval);
		countdownInterval = null;
	}
	function formatTime(ms) {
		const totalSeconds = Math.floor(ms / 1e3);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
	}
	function startCountdown(ms, label) {
		clearCountdownTimer$1();
		let remainingMs = ms;
		const startedAt = Date.now();
		const seconds = (ms / 1e3).toFixed(1);
		eventBus$3?.emit(EVENTS.OVERLAY_MESSAGE, `⏱️ Waiting ${seconds}s before ${label}...`);
		countdownInterval = setInterval(() => {
			remainingMs = ms - (Date.now() - startedAt);
			if (remainingMs <= 0) {
				clearCountdownTimer$1();
				eventBus$3?.emit(EVENTS.OVERLAY_MESSAGE, `▶️ Starting ${label}...`);
				return;
			}
			const nextSeconds = (remainingMs / 1e3).toFixed(1);
			eventBus$3?.emit(EVENTS.OVERLAY_MESSAGE, `⏱️ Waiting ${nextSeconds}s before ${label}...`);
		}, 100);
	}
	function getRandomDelay(task, fallbackSettings) {
		let minSeconds = getEffectiveSetting(task, "delayMin", fallbackSettings);
		let maxSeconds = getEffectiveSetting(task, "delayMax", fallbackSettings);
		if (minSeconds === void 0 || maxSeconds === void 0) {
			const delayBetweenPrompts = getEffectiveSetting(task, "delayBetweenPrompts", fallbackSettings) || 15e3 / 1e3;
			minSeconds = delayBetweenPrompts / 1e3;
			maxSeconds = delayBetweenPrompts / 1e3;
		}
		if (minSeconds > maxSeconds) [minSeconds, maxSeconds] = [maxSeconds, minSeconds];
		const delaySeconds = minSeconds + Math.random() * (maxSeconds - minSeconds);
		return Math.round(delaySeconds * 1e3);
	}
	function sendTaskUpdate(task) {
		if (!task.queueTaskId) return;
		chrome.runtime.sendMessage({
			action: "queueTaskUpdate",
			taskId: task.queueTaskId,
			updates: { status: task.status }
		}).catch(() => {});
	}
	async function verifyAuthenticationState() {
		return new Promise((resolve) => {
			let attempts = 0;
			const maxAttempts = 3;
			const retryDelayMs = 1e3;
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
							error: "Could not verify authentication state"
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
						error: "No response from background script"
					});
				});
			};
			attempt();
		});
	}
	(async () => {
		const storedState = await loadStateFromStorage();
		if (!storedState || storedState.status !== "paused") return;
		prompts = storedState.prompts || [];
		currentPromptIndex = storedState.currentIndex || 0;
		settings = storedState.settings || settings;
		taskList = storedState.taskList || [];
		currentTaskIndex = storedState.currentTaskIndex || 0;
		isProcessing = false;
		console.log(`📋 Restored ${taskList.length} tasks from storage`);
		chrome.runtime.sendMessage({
			action: "stateRestored",
			state: storedState
		}).catch(() => {});
		if (taskList.length > 0) taskList.forEach((task) => sendTaskUpdate(task));
	})();
	//#endregion
	//#region src/content/textInjector.js
	var getState$6 = null;
	function init$7(getStateFn) {
		getState$6 = getStateFn;
	}
	function executeInMainWorld$1(funcBody, args = []) {
		return new Promise((resolve) => {
			chrome.runtime.sendMessage({
				action: "executeInMainWorld",
				funcBody,
				args
			}, (response) => {
				if (chrome.runtime.lastError) {
					resolve({
						success: false,
						error: chrome.runtime.lastError.message
					});
					return;
				}
				resolve(response || {
					success: false,
					error: "No response"
				});
			});
		});
	}
	async function injectText(text) {
		try {
			const editorElement = document.querySelector("[data-slate-editor=\"true\"]");
			if (!editorElement) {
				console.error("🔴 Flow Slate editor [data-slate-editor=\"true\"] not found");
				return false;
			}
			if (!(getState$6?.().settings?.stealthMode || false)) return fastInject(editorElement, text);
			if (text.length > 120) {
				console.log(`🥷 Stealth Mode: Long prompt (${text.length} chars) — using human-like paste simulation...`);
				return stealthPaste(editorElement, text);
			}
			console.log(`🥷 Stealth Mode: Short prompt (${text.length} chars) — using human-like typing...`);
			return stealthTyping(editorElement, text);
		} catch (error) {
			console.error("❌ Error injecting text into Slate.js editor:", error);
			return false;
		}
	}
	async function fastInject(editorElement, text) {
		editorElement.focus();
		editorElement.click();
		await h(200);
		const selection = window.getSelection();
		const range = document.createRange();
		range.selectNodeContents(editorElement);
		selection.removeAllRanges();
		selection.addRange(range);
		await h(100);
		editorElement.dispatchEvent(new InputEvent("beforeinput", {
			bubbles: true,
			cancelable: true,
			inputType: "insertText",
			data: text
		}));
		await h(400);
		const currentText = editorElement.textContent.trim();
		if (currentText === text || currentText.includes(text.substring(0, 20))) {
			console.log("✅ Text injected successfully into Slate.js Flow editor");
			return true;
		}
		console.warn("⚠️ Text injection may have failed. Got:", JSON.stringify(currentText.substring(0, 50)));
		return true;
	}
	async function stealthPaste(editorElement, text) {
		const thinkingPause = 300 + Math.random() * 600;
		console.log(`🥷 Paste simulation: thinking pause ${Math.round(thinkingPause)}ms...`);
		await h(thinkingPause);
		editorElement.focus();
		editorElement.click();
		await h(150 + Math.random() * 100);
		const selection = window.getSelection();
		const range = document.createRange();
		range.selectNodeContents(editorElement);
		selection.removeAllRanges();
		selection.addRange(range);
		await h(80 + Math.random() * 80);
		const dataTransfer = new DataTransfer();
		dataTransfer.setData("text/plain", text);
		dataTransfer.setData("text/html", `<span>${text.replace(/\n/g, "<br>")}</span>`);
		editorElement.dispatchEvent(new ClipboardEvent("paste", {
			bubbles: true,
			cancelable: true,
			clipboardData: dataTransfer
		}));
		await h(300 + Math.random() * 200);
		const actual = editorElement.textContent.trim();
		const expected = text.trim();
		if (actual === expected || actual.includes(expected.substring(0, 30))) {
			console.log("✅ Paste simulation: SUCCESS");
			return true;
		}
		console.warn("⚠️ Paste simulation: Slate ignored paste event — falling back to fast inject");
		return fastInject(editorElement, text);
	}
	var ADJACENT_KEYS = {
		a: [
			"q",
			"w",
			"s",
			"z"
		],
		b: [
			"v",
			"g",
			"h",
			"n"
		],
		c: [
			"x",
			"d",
			"f",
			"v"
		],
		d: [
			"s",
			"e",
			"r",
			"f",
			"c"
		],
		e: [
			"w",
			"r",
			"d"
		],
		f: [
			"d",
			"r",
			"t",
			"g",
			"v"
		],
		g: [
			"f",
			"t",
			"y",
			"h",
			"b"
		],
		h: [
			"g",
			"y",
			"u",
			"j",
			"n"
		],
		i: [
			"u",
			"o",
			"k"
		],
		j: [
			"h",
			"u",
			"i",
			"k",
			"n"
		],
		k: [
			"j",
			"i",
			"o",
			"l"
		],
		l: [
			"k",
			"o",
			"p"
		],
		m: [
			"n",
			"j",
			"k"
		],
		n: [
			"b",
			"h",
			"j",
			"m"
		],
		o: [
			"i",
			"p",
			"l",
			"k"
		],
		p: ["o", "l"],
		q: ["w", "a"],
		r: [
			"e",
			"t",
			"f"
		],
		s: [
			"a",
			"w",
			"e",
			"d",
			"z"
		],
		t: [
			"r",
			"y",
			"g"
		],
		u: [
			"y",
			"i",
			"h",
			"j"
		],
		v: [
			"c",
			"f",
			"g",
			"b"
		],
		w: [
			"q",
			"e",
			"s"
		],
		x: [
			"z",
			"s",
			"d",
			"c"
		],
		y: [
			"t",
			"u",
			"g",
			"h"
		],
		z: ["a", "s"]
	};
	var COMMON_DIGRAPHS = new Set([
		"th",
		"he",
		"in",
		"er",
		"an",
		"re",
		"on",
		"en",
		"at",
		"es",
		"ti",
		"or"
	]);
	async function stealthTyping(_editorElement, text) {
		const initResult = await executeInMainWorld$1(`
    const el = document.querySelector('[data-slate-editor="true"]');
    if (!el) return 'error:Editor not found';

    const fiberKey = Object.keys(el).find((key) =>
      key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')
    );
    if (!fiberKey) return 'error:React fiber not found on editor element';

    let node = el[fiberKey];
    let editor = null;

    for (let index = 0; index < 100; index += 1) {
      if (!node) break;
      const props = node.memoizedProps;
      if (props && props.editor && typeof props.editor.apply === 'function' && props.editor.children) {
        editor = props.editor;
        break;
      }
      node = node.return;
    }

    if (!editor) return 'error:Slate editor not found in fiber tree';

    window.__flowSlateEditor = editor;

    const existing = editor.children[0]?.children[0]?.text || '';
    if (existing.length > 0) {
      editor.apply({ type: 'remove_text', path: [0, 0], offset: 0, text: existing });
    }

    return 'ok';
  `);
		if (!initResult.success || initResult.result?.startsWith("error:")) {
			const error = initResult.error || initResult.result?.replace("error:", "") || "Unknown error";
			console.error("❌ Stealth Typing init failed:", error);
			return false;
		}
		console.log("✅ Stealth Typing: Slate editor initialized via MAIN world fiber");
		await h(200);
		let previousChar = "";
		console.log(`🥷 Stealth Typing: "${text.substring(0, 40)}${text.length > 40 ? "..." : ""}"`);
		for (let index = 0; index < text.length; index += 1) {
			const state = getState$6?.() || {};
			if (!state.isProcessing && !state.isPausing) {
				console.log("⏸️ Stealth Typing: interrupted — processing stopped");
				return false;
			}
			const character = text[index];
			const lower = character.toLowerCase();
			if (/[a-z]/.test(lower) && Math.random() < .03) {
				const nearbyKeys = ADJACENT_KEYS[lower] || [lower];
				const typo = nearbyKeys[Math.floor(Math.random() * nearbyKeys.length)];
				await executeInMainWorld$1(`
          const editor = window.__flowSlateEditor;
          if (editor) {
            const offset = editor.children[0]?.children[0]?.text?.length || 0;
            editor.apply({ type: 'insert_text', path: [0, 0], offset, text: args[0] });
          }
        `, [typo]);
				await h(80 + Math.random() * 60);
				await h(150 + Math.random() * 250);
				await executeInMainWorld$1(`
        const editor = window.__flowSlateEditor;
        if (editor) {
          const currentText = editor.children[0]?.children[0]?.text || '';
          if (currentText.length > 0) {
            editor.apply({
              type: 'remove_text',
              path: [0, 0],
              offset: currentText.length - 1,
              text: currentText[currentText.length - 1],
            });
          }
        }
      `);
				await h(60 + Math.random() * 50);
			}
			await executeInMainWorld$1(`
        const editor = window.__flowSlateEditor;
        if (editor) {
          const offset = editor.children[0]?.children[0]?.text?.length || 0;
          editor.apply({ type: 'insert_text', path: [0, 0], offset, text: args[0] });
        }
      `, [character]);
			const digraph = previousChar + lower;
			let delay;
			if (COMMON_DIGRAPHS.has(digraph)) delay = 50 + Math.random() * 40;
			else if (character === " ") delay = 120 + Math.random() * 150;
			else if (character === "," || character === ".") delay = 150 + Math.random() * 200;
			else delay = 80 + Math.random() * 120;
			const charactersSinceSpace = index - text.lastIndexOf(" ", index);
			if (charactersSinceSpace > 5) delay += charactersSinceSpace * 2;
			if (Math.random() < .03) delay += 400 + Math.random() * 800;
			previousChar = lower;
			await h(delay);
		}
		await h(400);
		const validationResult = await executeInMainWorld$1(`
    const editor = window.__flowSlateEditor;
    return editor ? (editor.children[0]?.children[0]?.text || '') : '';
  `);
		if (validationResult.success) {
			const actual = validationResult.result || "";
			if (actual === text) console.log("✅ Stealth Typing: SUCCESS — text matches exactly");
			else {
				console.warn("⚠️ Stealth Typing: mismatch. Got:     ", JSON.stringify(actual.substring(0, 60)));
				console.warn("⚠️ Stealth Typing: Expected:", JSON.stringify(text.substring(0, 60)));
			}
		}
		return true;
	}
	//#endregion
	//#region src/content/submitHandler.js
	var getState$5 = null;
	function init$6(getStateFn) {
		getState$5 = getStateFn;
	}
	function executeInMainWorld(funcBody, args = []) {
		return new Promise((resolve) => {
			chrome.runtime.sendMessage({
				action: "executeInMainWorld",
				funcBody,
				args
			}, (response) => {
				if (chrome.runtime.lastError) {
					resolve({
						success: false,
						error: chrome.runtime.lastError.message
					});
					return;
				}
				resolve(response || {
					success: false,
					error: "No response"
				});
			});
		});
	}
	async function clickSubmit() {
		try {
			if (getState$5?.().settings?.stealthMode || false) return stealthSubmit();
			return domClick();
		} catch (error) {
			console.error("❌ Error in clickSubmit:", error);
			return false;
		}
	}
	async function stealthSubmit() {
		console.log("🥷 Stealth Mode: Triggering submit via React fiber onClick (MAIN world)...");
		const response = await executeInMainWorld(`
    const buttons = Array.from(document.querySelectorAll('button'));
    const submitBtn = buttons.find((btn) => {
      const hasArrowForward = btn.querySelector('i')?.textContent.trim() === 'arrow_forward';
      const hasSpanText = btn.querySelector('span')?.textContent.trim().length > 0;
      return hasArrowForward && hasSpanText;
    });
    if (!submitBtn) return 'error:Submit button not found';

    const fiberKey = Object.keys(submitBtn).find((key) =>
      key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')
    );
    if (!fiberKey) return 'error:React fiber not found on submit button';

    let node = submitBtn[fiberKey];
    let onClick = null;

    for (let index = 0; index < 50; index += 1) {
      if (!node) break;
      const props = node.memoizedProps;
      if (props && typeof props.onClick === 'function') {
        onClick = props.onClick;
        break;
      }
      node = node.return;
    }

    if (!onClick) return 'error:onClick prop not found in fiber tree';

    onClick({ type: 'click', preventDefault: () => {}, stopPropagation: () => {} });
    return 'ok';
  `);
		if (!response.success || response.result?.startsWith("error:")) {
			const error = response.error || response.result?.replace("error:", "") || "Unknown error";
			console.error("❌ Stealth submit failed:", error);
			console.warn("⚠️ Falling back to DOM click for submit...");
			return domClick();
		}
		console.log("✅ Stealth submit triggered via React onClick prop (zero DOM events)");
		return true;
	}
	function domClick() {
		const submitButton = Array.from(document.querySelectorAll("button")).find((button) => {
			const hasArrowForward = button.querySelector("i")?.textContent.trim() === "arrow_forward";
			const hasSpanText = (button.querySelector("span")?.textContent.trim().length || 0) > 0;
			return hasArrowForward && hasSpanText;
		});
		if (!submitButton) {
			console.warn("⚠️ Submit button not found");
			return false;
		}
		submitButton.click();
		console.log("✅ Submit button clicked (DOM)");
		return true;
	}
	//#endregion
	//#region src/content/clickHelper.js
	function pointerClick(element) {
		const { x, y } = centerOf(element);
		const eventInit = {
			bubbles: true,
			cancelable: true,
			pointerId: 1,
			pointerType: "mouse",
			isPrimary: true,
			clientX: x,
			clientY: y
		};
		element.dispatchEvent(new PointerEvent("pointerdown", eventInit));
		element.dispatchEvent(new PointerEvent("pointerup", eventInit));
	}
	function mouseClick(element) {
		const { x, y } = centerOf(element);
		const eventInit = {
			bubbles: true,
			cancelable: true,
			clientX: x,
			clientY: y,
			button: 0
		};
		element.dispatchEvent(new MouseEvent("mousedown", eventInit));
		element.dispatchEvent(new MouseEvent("mouseup", eventInit));
		element.dispatchEvent(new MouseEvent("click", eventInit));
	}
	function toggleTab(element) {
		if (element.getAttribute("data-state") === "active") return false;
		mouseClick(element);
		return true;
	}
	function stealthClick(element) {
		const rect = element.getBoundingClientRect();
		const offsetX = (Math.random() - .5) * rect.width * .6;
		const offsetY = (Math.random() - .5) * rect.height * .6;
		const clientX = rect.left + rect.width / 2 + offsetX;
		const clientY = rect.top + rect.height / 2 + offsetY;
		console.log(`🎯 Stealth click at (${Math.round(clientX)}, ${Math.round(clientY)}) — offset (${Math.round(offsetX)}px, ${Math.round(offsetY)}px)`);
		const eventInit = {
			bubbles: true,
			cancelable: true,
			view: window,
			clientX,
			clientY,
			screenX: window.screenX + clientX,
			screenY: window.screenY + clientY,
			button: 0
		};
		element.dispatchEvent(new PointerEvent("pointerdown", {
			...eventInit,
			isPrimary: true,
			buttons: 1
		}));
		element.dispatchEvent(new MouseEvent("mousedown", {
			...eventInit,
			buttons: 1
		}));
		element.dispatchEvent(new PointerEvent("pointerup", {
			...eventInit,
			isPrimary: true,
			buttons: 0
		}));
		element.dispatchEvent(new MouseEvent("mouseup", {
			...eventInit,
			buttons: 0
		}));
		element.dispatchEvent(new PointerEvent("click", {
			...eventInit,
			isPrimary: true
		}));
		element.dispatchEvent(new MouseEvent("click", eventInit));
	}
	//#endregion
	//#region src/content/settingsApplicator.js
	var getState$4 = null;
	var setState$3 = null;
	function init$5(getStateFn, setStateFn) {
		getState$4 = getStateFn;
		setState$3 = setStateFn;
	}
	function isProcessingStopped$2() {
		const state = getState$4?.() || {};
		return !state.isProcessing && !state.isPausing;
	}
	function settingsAreEqual(a, b) {
		if (!a || !b) return false;
		return a.count === b.count && a.model === b.model && a.aspectRatio === b.aspectRatio && a.taskType === b.taskType && a.videoSubMode === b.videoSubMode;
	}
	async function applyUnifiedSettings(taskType = "createvideo", settings = {}) {
		try {
			const state = getState$4?.() || {};
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
			const nextSettings = {
				count,
				model,
				aspectRatio,
				taskType,
				videoSubMode
			};
			if (state.lastAppliedSettings && settingsAreEqual(nextSettings, state.lastAppliedSettings)) {
				console.log("⏩ Settings unchanged from previous task — SKIPPING (~5s saved)");
				return true;
			}
			console.log(`⚙️ Applying settings: type=${taskType}, count=${count}, model=${model}, ratio=${aspectRatio}, subMode=${isImageTask ? "n/a" : videoSubMode}`);
			const panelTrigger = $("//button[@aria-haspopup='menu' and .//div[@data-type='button-overlay'] and text()[normalize-space() != '']]");
			if (!panelTrigger) {
				console.warn("⚠️ Main settings trigger button not found");
				return false;
			}
			pointerClick(panelTrigger);
			console.log("✅ Step 1: Opened main control panel");
			await h(600);
			if (!document.querySelector("[role=\"menu\"][data-state=\"open\"]")) {
				console.warn("⚠️ Control panel menu did not open");
				return false;
			}
			const outputTypeTab = $(`//button[@role='tab' and contains(@class,'flow_tab_slider_trigger') and .//i[normalize-space(text())='${outputIcon}']]`);
			if (outputTypeTab) if (toggleTab(outputTypeTab)) {
				console.log(`✅ Step 2: Selected output type: ${outputLabel}`);
				await h(400);
			} else console.log(`⏩ Step 2: Output type already: ${outputLabel}`);
			else console.warn(`⚠️ Output type tab "${outputLabel}" not found`);
			if (isProcessingStopped$2()) {
				re();
				return false;
			}
			if (isImageTask) console.log("⏩ Step 3: Skipped (image task — no sub-mode)");
			else {
				const subModeIcon = videoSubMode === "ingredients" ? "chrome_extension" : "crop_free";
				const subModeLabel = videoSubMode === "ingredients" ? "Ingredients" : "Frames";
				const subModeTab = $(`//button[@role='tab' and contains(@class,'flow_tab_slider_trigger') and .//i[normalize-space(text())='${subModeIcon}']]`);
				if (subModeTab) if (toggleTab(subModeTab)) {
					console.log(`✅ Step 3: Selected video sub-mode: ${subModeLabel}`);
					await h(300);
				} else console.log(`⏩ Step 3: Sub-mode already: ${subModeLabel}`);
				else console.warn(`⚠️ Sub-mode tab "${subModeLabel}" not found`);
			}
			if (isProcessingStopped$2()) {
				re();
				return false;
			}
			const ratioIcon = aspectRatio === "portrait" ? "crop_9_16" : "crop_16_9";
			const ratioLabel = aspectRatio === "portrait" ? "Portrait" : "Landscape";
			const ratioTab = $(`//button[@role='tab' and contains(@class,'flow_tab_slider_trigger') and .//i[normalize-space(text())='${ratioIcon}']]`);
			if (ratioTab) if (toggleTab(ratioTab)) {
				console.log(`✅ Step 4: Selected aspect ratio: ${ratioLabel}`);
				await h(300);
			} else console.log(`⏩ Step 4: Aspect ratio already: ${ratioLabel}`);
			else console.warn(`⚠️ Aspect ratio tab "${ratioLabel}" not found`);
			if (isProcessingStopped$2()) {
				re();
				return false;
			}
			const countLabel = `x${count}`;
			const countTab = $(`//button[@role='tab' and contains(@class,'flow_tab_slider_trigger') and normalize-space(text())='${countLabel}']`);
			if (countTab) if (toggleTab(countTab)) {
				console.log(`✅ Step 5: Selected count: ${countLabel}`);
				await h(300);
			} else console.log(`⏩ Step 5: Count already: ${countLabel}`);
			else console.warn(`⚠️ Count tab "${countLabel}" not found`);
			if (isProcessingStopped$2()) {
				re();
				return false;
			}
			const modelLabel = MODEL_DISPLAY_NAMES[model] || (isImageTask ? "Nano Banana Pro" : "Veo 3.1 - Fast");
			const modelTrigger = $("//div[@role='menu' and @data-state='open']//button[@aria-haspopup='menu' and .//div[@data-type='button-overlay']]");
			if (!modelTrigger) console.warn("⚠️ Model dropdown trigger not found inside control panel");
			else {
				pointerClick(modelTrigger);
				console.log("✅ Step 6a: Opened model dropdown");
				await h(500);
				const modelOption = $(`//div[@role='menuitem']//button[.//span[contains(normalize-space(text()),'${modelLabel}')]]`);
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
			if (setState$3) {
				setState$3({
					lastAppliedSettings: nextSettings,
					lastAppliedMode: taskType
				});
				console.log("💾 Settings cached for next task comparison");
			}
			return true;
		} catch (error) {
			console.error("❌ Error applying unified Flow settings:", error);
			re();
			return false;
		}
	}
	//#endregion
	//#region src/content/imageUploader.js
	var getState$3 = null;
	function init$4(getStateFn) {
		getState$3 = getStateFn;
	}
	function isStealthMode() {
		return getState$3?.().settings?.stealthMode === true;
	}
	function isProcessingStopped$1() {
		const state = getState$3?.() || {};
		return !state.isProcessing && !state.isPausing;
	}
	function randomizeDelay(delayMs) {
		return Math.round(delayMs * (.7 + Math.random() * .6));
	}
	async function waitWithStealthFactor(delayMs) {
		await h(isStealthMode() ? randomizeDelay(delayMs) : delayMs);
	}
	function clickElement(element) {
		if (isStealthMode()) {
			stealthClick(element);
			return;
		}
		element.click();
	}
	async function setTextInputValue(inputElement, value) {
		const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
		if (isStealthMode()) {
			const thinkingPause = 100 + Math.random() * 300;
			console.log(`🥷 Stealth: Input think pause ${Math.round(thinkingPause)}ms before setting "${value}"...`);
			await h(thinkingPause);
		}
		inputElement.focus();
		valueSetter.call(inputElement, value);
		inputElement.dispatchEvent(new Event("input", { bubbles: true }));
	}
	async function clearExistingReferences() {
		const buttons = document.querySelectorAll("button");
		let clearButton = null;
		for (const button of buttons) {
			const icon = button.querySelector("i.google-symbols");
			if (icon && icon.textContent.trim() === "close" && button.querySelector("span")) {
				clearButton = button;
				break;
			}
		}
		if (!clearButton) {
			console.log("✅ ImageUploader Pre-flight: No attached references found — input area is clean");
			return false;
		}
		clickElement(clearButton);
		console.log("🧹 ImageUploader Pre-flight: Clicked clear-references button — all attached references cleared");
		await waitWithStealthFactor(300);
		return true;
	}
	async function uploadAllImages(images) {
		if (!images || images.length === 0) {
			console.warn("⚠️ ImageUploader.uploadAllImages: No images provided");
			return false;
		}
		console.log(`📤 ImageUploader Phase 1: Batch-checking ${images.length} file(s) in library (single picker session)...`);
		const names = images.map((image, index) => image.name || `reference_${index + 1}.jpg`);
		const existingFiles = await checkLibraryForFiles(names);
		const totalUploadsNeeded = images.length - existingFiles.size;
		let didUpload = false;
		let uploadedCount = 0;
		for (let index = 0; index < images.length; index += 1) {
			if (isProcessingStopped$1()) {
				console.log("⏸️ ImageUploader: Processing stopped during file injection");
				return false;
			}
			const image = images[index];
			const name = names[index];
			const mimeType = image.mimeType || "image/jpeg";
			if (existingFiles.has(name)) {
				console.log(`⏩ ImageUploader Phase 1 [${index + 1}/${images.length}]: "${name}" already in library — skipping upload`);
				continue;
			}
			console.log(`📤 ImageUploader Phase 1 [${index + 1}/${images.length}]: "${name}" not in library — uploading...`);
			const fileInput = document.querySelector("input[type=\"file\"][accept*=\"image\"]");
			if (!fileInput) {
				console.warn(`⚠️ ImageUploader Phase 1: File input not found for "${name}"`);
				return false;
			}
			const file = base64ToFile(image.data, name, mimeType);
			if (!file) {
				console.warn(`⚠️ ImageUploader Phase 1: Failed to convert "${name}" to File object`);
				return false;
			}
			const dataTransfer = new DataTransfer();
			dataTransfer.items.add(file);
			fileInput.files = dataTransfer.files;
			fileInput.dispatchEvent(new Event("change", { bubbles: true }));
			console.log(`✅ ImageUploader Phase 1 [${index + 1}/${images.length}]: "${name}" injected (${(file.size / 1024).toFixed(1)} KB)`);
			didUpload = true;
			uploadedCount += 1;
			if (uploadedCount < totalUploadsNeeded) await waitWithStealthFactor(IMAGE_UPLOADER_DELAYS.UPLOAD_BETWEEN_FILES);
		}
		if (didUpload) {
			console.log(`⏳ ImageUploader Phase 1 complete — waiting ${IMAGE_UPLOADER_DELAYS.UPLOAD_SETTLE / 1e3}s for uploads to settle...`);
			await h(IMAGE_UPLOADER_DELAYS.UPLOAD_SETTLE);
		} else console.log("⏩ ImageUploader Phase 1 complete — all images already in library, no settle wait needed");
		return true;
	}
	async function attachAllImages(images, mode = "ingredients") {
		if (!images || images.length === 0) {
			console.warn("⚠️ ImageUploader.attachAllImages: No images provided");
			return false;
		}
		console.log(`🔗 ImageUploader Phase 2: Attaching ${images.length} image(s) as references [${mode}]...`);
		for (let index = 0; index < images.length; index += 1) {
			if (isProcessingStopped$1()) {
				console.log("⏸️ ImageUploader: Processing stopped during reference attachment");
				return false;
			}
			const name = images[index].name || `reference_${index + 1}.jpg`;
			console.log(`🔗 ImageUploader Phase 2 [${index + 1}/${images.length}]: Attaching "${name}" [${mode}${mode === "frames" ? `/${index === 0 ? "Start" : "End"}` : ""}]...`);
			if (!await attachSingleImage(name, mode, index)) {
				console.error(`❌ ImageUploader Phase 2: Failed to attach "${name}"`);
				return false;
			}
			console.log(`✅ ImageUploader Phase 2 [${index + 1}/${images.length}]: "${name}" attached successfully`);
		}
		console.log(`✅ ImageUploader Phase 2 complete — all ${images.length} image(s) attached`);
		return true;
	}
	async function attachSingleImage(name, mode, slotIndex) {
		const triggerElement = getTriggerElement(mode, slotIndex);
		if (!triggerElement) {
			console.warn(`⚠️ ImageUploader: ${mode === "frames" ? `Frames ${slotIndex === 0 ? "Start" : "End"} frame div` : "add_2 button"} trigger not found`);
			return false;
		}
		clickElement(triggerElement);
		console.log(`✅ ImageUploader: Clicked trigger (${mode}${mode === "frames" ? `/${slotIndex === 0 ? "Start" : "End"}` : ""})`);
		const dialog = await waitForElement("[role=\"dialog\"][data-state=\"open\"]", IMAGE_UPLOADER_TIMEOUTS.PICKER_OPEN);
		if (!dialog) {
			console.warn("⚠️ ImageUploader: Asset picker popover did not open");
			return false;
		}
		console.log("✅ ImageUploader: Asset picker popover opened");
		await waitWithStealthFactor(IMAGE_UPLOADER_DELAYS.SEARCH_SETTLE);
		const searchInput = dialog.querySelector("input[type=\"text\"]");
		if (!searchInput) {
			console.warn("⚠️ ImageUploader: Search input not found in popover");
			closePickerWithEscape();
			return false;
		}
		await setTextInputValue(searchInput, name);
		console.log(`🔍 ImageUploader: Searching for "${name}"${isStealthMode() ? " (stealth paste)" : ""}...`);
		const searchResult = await waitForSearchResult(name, IMAGE_UPLOADER_TIMEOUTS.SEARCH_RESULT);
		if (!searchResult) {
			console.warn(`⚠️ ImageUploader: Search result for "${name}" not found (upload may not have completed yet)`);
			closePickerWithEscape();
			return false;
		}
		console.log(`✅ ImageUploader: Found search result for "${name}"`);
		const resultRow = searchResult.parentElement;
		if (!resultRow) {
			console.warn("⚠️ ImageUploader: Result row parent not found");
			closePickerWithEscape();
			return false;
		}
		if (isStealthMode()) await h(150 + Math.random() * 200);
		clickElement(resultRow);
		console.log(`✅ ImageUploader: Clicked result row for "${name}"`);
		if (await waitForPickerClose(IMAGE_UPLOADER_TIMEOUTS.PICKER_CLOSE)) console.log("✅ ImageUploader: Popover closed — image attached as reference");
		else {
			console.warn("⚠️ ImageUploader: Popover did not close after clicking result — forcing close");
			closePickerWithEscape();
			await waitWithStealthFactor(300);
		}
		await waitWithStealthFactor(IMAGE_UPLOADER_DELAYS.AFTER_ATTACH);
		return true;
	}
	async function checkLibraryForFiles(names) {
		const existingFiles = /* @__PURE__ */ new Set();
		if (!names || names.length === 0) return existingFiles;
		const libraryTrigger = $("//button[.//i[normalize-space(text())='add_2']]");
		if (!libraryTrigger) {
			console.warn("⚠️ ImageUploader library check: add_2 trigger not found — assuming all images need upload");
			return existingFiles;
		}
		clickElement(libraryTrigger);
		const dialog = await waitForElement("[role=\"dialog\"][data-state=\"open\"]", IMAGE_UPLOADER_TIMEOUTS.PICKER_OPEN);
		if (!dialog) {
			console.warn("⚠️ ImageUploader library check: Popover did not open — assuming all images need upload");
			return existingFiles;
		}
		await waitWithStealthFactor(300);
		const searchInput = dialog.querySelector("input[type=\"text\"]");
		if (!searchInput) {
			console.warn("⚠️ ImageUploader library check: Search input not found — closing picker");
			closePickerWithEscape();
			return existingFiles;
		}
		for (let index = 0; index < names.length; index += 1) {
			const name = names[index];
			await setTextInputValue(searchInput, name);
			console.log(`🔍 ImageUploader library check [${index + 1}/${names.length}]: Searching for "${name}"...`);
			await waitWithStealthFactor(300);
			if (await waitForSearchResult(name, IMAGE_UPLOADER_TIMEOUTS.LIBRARY_SEARCH)) {
				console.log(`✅ ImageUploader library check [${index + 1}/${names.length}]: "${name}" found in library`);
				existingFiles.add(name);
			} else console.log(`📭 ImageUploader library check [${index + 1}/${names.length}]: "${name}" not in library — will upload`);
			if (index < names.length - 1) await waitWithStealthFactor(200);
		}
		closePickerWithEscape();
		await waitWithStealthFactor(400);
		console.log(`📊 ImageUploader library check complete: ${existingFiles.size}/${names.length} already in library`);
		return existingFiles;
	}
	async function waitForSearchResult(name, timeoutMs) {
		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			const result = [...document.querySelectorAll("[data-testid=\"virtuoso-item-list\"] img")].find((image) => image.getAttribute("alt") === name);
			if (result) return result;
			await h(IMAGE_UPLOADER_DELAYS.SEARCH_POLL);
		}
		return null;
	}
	async function waitForPickerClose(timeoutMs) {
		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			if (!document.querySelector("[role=\"dialog\"][data-state=\"open\"]")) return true;
			await h(200);
		}
		return false;
	}
	function closePickerWithEscape() {
		re();
	}
	function base64ToFile(data, name, mimeType) {
		try {
			let content = data;
			let effectiveMimeType = mimeType;
			if (data.startsWith("data:")) {
				const [prefix, payload] = data.split(",");
				content = payload;
				const mimeMatch = prefix.match(/:(.*?);/);
				if (mimeMatch) effectiveMimeType = mimeMatch[1];
			}
			const binary = atob(content);
			const bytes = new Uint8Array(binary.length);
			for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
			return new File([bytes], name, { type: effectiveMimeType });
		} catch (error) {
			console.error("❌ ImageUploader: base64ToFile conversion failed:", error);
			return null;
		}
	}
	function getTriggerElement(mode, slotIndex) {
		if (mode === "frames") return $(`//div[@aria-haspopup='dialog' and normalize-space(text())='${slotIndex === 0 ? "Start" : "End"}']`);
		return $("//button[.//i[normalize-space(text())='add_2']]");
	}
	//#endregion
	//#region src/content/errorScanner.js
	function hasCompletedMedia$1(tileElement) {
		return Boolean(tileElement.querySelector("video[src*=\"media.getMediaUrlRedirect\"]") || tileElement.querySelector("img[src*=\"media.getMediaUrlRedirect\"]"));
	}
	function hasIcon(element, iconText) {
		return [...element.querySelectorAll("i")].some((icon) => icon.textContent.trim() === iconText);
	}
	var TILE_ERROR_PATTERNS = [
		{
			type: "POLICY_VIOLATION",
			label: "Prompt flagged by content policy",
			detect(tileElement) {
				if (!hasIcon(tileElement, "warning")) return false;
				return [...tileElement.querySelectorAll("a[href]")].some((link) => {
					const href = link.getAttribute("href") || "";
					return href.includes("/faq") || href.includes("/policies") || href.includes("policy");
				});
			}
		},
		{
			type: "DAILY_LIMIT_MODEL_FALLBACK",
			label: "Daily generation limit reached — switching to Imagen 4",
			detect(tileElement) {
				if (!hasIcon(tileElement, "warning") || !hasIcon(tileElement, "refresh")) return false;
				return tileElement.textContent.includes("Nano Banana");
			}
		},
		{
			type: "GENERATION_FAILED",
			label: "Generation failed — Flow encountered an error",
			detect(tileElement) {
				if (!hasIcon(tileElement, "warning")) return false;
				return hasIcon(tileElement, "refresh");
			}
		}
	];
	var GLOBAL_ERROR_PATTERNS = [];
	function scanTileErrors(preSubmitIds, processedTileIds) {
		const errors = [];
		document.querySelectorAll("[data-tile-id]").forEach((tileElement) => {
			const tileId = tileElement.getAttribute("data-tile-id");
			if (!tileId) return;
			if (preSubmitIds?.has(tileId) || processedTileIds?.has(tileId) || hasCompletedMedia$1(tileElement)) return;
			for (const pattern of TILE_ERROR_PATTERNS) {
				if (!pattern.detect(tileElement)) continue;
				processedTileIds?.add(tileId);
				errors.push({
					tileId,
					type: pattern.type,
					label: pattern.label
				});
				console.warn(`⚠️ ErrorScanner: tile ${tileId} — ${pattern.label}`);
				break;
			}
		});
		return {
			errorCount: errors.length,
			errors
		};
	}
	function checkGlobalErrors() {
		for (const pattern of GLOBAL_ERROR_PATTERNS) {
			if (!pattern.detect()) continue;
			console.error(`❌ ErrorScanner: global error — ${pattern.label} (severity: ${pattern.severity})`);
			return {
				found: true,
				type: pattern.type,
				label: pattern.label,
				severity: pattern.severity
			};
		}
		return {
			found: false,
			type: null,
			label: null,
			severity: null
		};
	}
	//#endregion
	//#region src/content/monitoring.js
	var monitoring_exports = /* @__PURE__ */ __exportAll({
		checkForErrorsAfterSubmit: () => checkForErrorsAfterSubmit,
		checkForPromptPolicyError: () => checkForPromptPolicyError,
		checkForQueueFull: () => checkForQueueFull,
		downloadTileViaUI: () => downloadTileViaUI$1,
		init: () => init$3,
		isTileCompleted: () => isTileCompleted,
		isTileVideo: () => isTileVideo,
		periodicTileScanner: () => periodicTileScanner,
		resetDownloadQueue: () => resetDownloadQueue,
		scanForNewlyCompletedTiles: () => scanForNewlyCompletedTiles,
		snapshotExistingTileIds: () => snapshotExistingTileIds,
		startErrorMonitoring: () => startErrorMonitoring,
		startTileScanner: () => startTileScanner,
		stopErrorMonitoring: () => stopErrorMonitoring,
		stopTileScanner: () => stopTileScanner
	});
	var getState$2 = null;
	var setState$2 = null;
	var getSelectors = null;
	var eventBus$2 = null;
	var stateManager$3 = null;
	var tileScannerInterval = null;
	var errorMonitoringInterval = null;
	var downloadQueue = [];
	var isDownloadRunnerActive = false;
	function init$3({ getState: getStateFn, setState: setStateFn, getSelectors: getSelectorsFn, eventBus: eventBusInstance, stateManager: stateManagerInstance }) {
		getState$2 = getStateFn;
		setState$2 = setStateFn;
		getSelectors = getSelectorsFn;
		eventBus$2 = eventBusInstance;
		stateManager$3 = stateManagerInstance;
		eventBus$2.on(EVENTS.PROCESSING_TERMINATE, () => {
			stopTileScanner();
			stopErrorMonitoring();
			resetDownloadQueue();
		});
	}
	function snapshotExistingTileIds() {
		const tileIds = /* @__PURE__ */ new Set();
		document.querySelectorAll("[data-tile-id]").forEach((tileElement) => {
			const tileId = tileElement.getAttribute("data-tile-id");
			if (tileId) tileIds.add(tileId);
		});
		console.log(`📸 Tile snapshot: ${tileIds.size} existing tile(s)`);
		return tileIds;
	}
	function isTileCompleted(tileElement) {
		return Boolean(tileElement.querySelector("video[src*=\"media.getMediaUrlRedirect\"]") || tileElement.querySelector("img[src*=\"media.getMediaUrlRedirect\"]"));
	}
	function isTileVideo(tileElement) {
		return Boolean(tileElement.querySelector("video"));
	}
	function scanForNewlyCompletedTiles(preSubmitIds) {
		const completedTiles = [];
		const seenTileIds = /* @__PURE__ */ new Set();
		document.querySelectorAll("[data-tile-id]").forEach((tileElement) => {
			const tileId = tileElement.getAttribute("data-tile-id");
			if (!tileId || seenTileIds.has(tileId)) return;
			seenTileIds.add(tileId);
			if (preSubmitIds?.has(tileId) || !isTileCompleted(tileElement)) return;
			completedTiles.push({
				tileId,
				tileEl: tileElement,
				isVideo: isTileVideo(tileElement)
			});
		});
		return completedTiles;
	}
	function pickDownloadQualityButton(menuElement, targetQuality) {
		const buttons = [...menuElement.querySelectorAll("button[role=\"menuitem\"], button")];
		if (buttons.length === 0) return null;
		const buttonData = buttons.map((button) => ({
			button,
			label: button.querySelectorAll("span")[0]?.textContent.trim() || button.textContent.trim(),
			enabled: button.getAttribute("aria-disabled") !== "true"
		}));
		const enabledButtons = buttonData.filter((entry) => entry.enabled);
		if (targetQuality) {
			const matchingButton = buttonData.find((entry) => entry.label === targetQuality);
			if (matchingButton) {
				if (matchingButton.enabled) {
					console.log(`⬇️ Download quality: "${matchingButton.label}" (selected)`);
					return matchingButton.button;
				}
				console.warn(`⚠️ "${targetQuality}" is locked (aria-disabled). Falling back to best available.`);
			} else console.warn(`⚠️ Quality "${targetQuality}" not found in sub-menu. Falling back.`);
		}
		if (enabledButtons.length > 0) {
			const fallbackButton = enabledButtons[enabledButtons.length - 1];
			console.log(`⬇️ Download quality fallback: "${fallbackButton.label}" (best available)`);
			return fallbackButton.button;
		}
		console.warn("⚠️ All quality options disabled — clicking first button as last resort");
		return buttons[0] || null;
	}
	async function downloadTileViaUI$1(tileElement, targetQuality = null) {
		try {
			const mediaElement = tileElement.querySelector("video[src*=\"media.getMediaUrlRedirect\"]") || tileElement.querySelector("img[src*=\"media.getMediaUrlRedirect\"]");
			if (!mediaElement) {
				console.warn("⚠️ No media element found in tile for download");
				return false;
			}
			const rect = mediaElement.getBoundingClientRect();
			const clientX = rect.left + rect.width / 2;
			const clientY = rect.top + rect.height / 2;
			mediaElement.dispatchEvent(new MouseEvent("mouseenter", {
				bubbles: true,
				clientX,
				clientY
			}));
			mediaElement.dispatchEvent(new MouseEvent("mousemove", {
				bubbles: true,
				clientX,
				clientY
			}));
			await h(400);
			mediaElement.dispatchEvent(new MouseEvent("contextmenu", {
				bubbles: true,
				cancelable: true,
				clientX,
				clientY,
				button: 2
			}));
			await h(600);
			const contextMenu = document.querySelector("[data-radix-menu-content][data-state=\"open\"]");
			if (!contextMenu) {
				console.warn("⚠️ Context menu did not open for tile download");
				return false;
			}
			const downloadMenuItem = [...contextMenu.querySelectorAll("[role=\"menuitem\"]")].find((item) => item.querySelector("i")?.textContent.trim() === "download");
			if (!downloadMenuItem) {
				console.warn("⚠️ Download menuitem not found in context menu");
				document.body.dispatchEvent(new KeyboardEvent("keydown", {
					key: "Escape",
					bubbles: true
				}));
				return false;
			}
			downloadMenuItem.click();
			await h(600);
			const menus = [...document.querySelectorAll("[data-radix-menu-content][data-state=\"open\"]")];
			const qualityMenu = menus.find((menu) => menu !== contextMenu) || menus[menus.length - 1];
			if (!qualityMenu || qualityMenu === contextMenu) {
				console.warn("⚠️ Quality sub-menu did not open");
				document.body.dispatchEvent(new KeyboardEvent("keydown", {
					key: "Escape",
					bubbles: true
				}));
				return false;
			}
			const qualityButton = pickDownloadQualityButton(qualityMenu, targetQuality);
			if (!qualityButton) {
				console.warn("⚠️ No quality button found in sub-menu");
				document.body.dispatchEvent(new KeyboardEvent("keydown", {
					key: "Escape",
					bubbles: true
				}));
				return false;
			}
			qualityButton.click();
			await h(300);
			console.log("✅ Download triggered via UI");
			return true;
		} catch (error) {
			console.error("❌ Error in downloadTileViaUI:", error);
			document.body.dispatchEvent(new KeyboardEvent("keydown", {
				key: "Escape",
				bubbles: true
			}));
			return false;
		}
	}
	async function runDownloadQueue() {
		if (isDownloadRunnerActive) return;
		isDownloadRunnerActive = true;
		while (downloadQueue.length > 0) {
			const { tileEl, targetQuality, label } = downloadQueue.shift();
			console.log(`⬇️ Download runner: processing "${label}" (quality: ${targetQuality ?? "default"})`);
			await downloadTileViaUI$1(tileEl, targetQuality);
			await h(500);
		}
		resetDownloadQueue();
		console.log("✅ Download runner: queue empty, state reset");
	}
	async function periodicTileScanner() {
		const state = getState$2?.() || {};
		if (!state.isProcessing && !state.isPausing) return;
		try {
			const currentTask = state.taskList?.find((task) => task.status === "current");
			if (!currentTask) return;
			currentTask.foundVideos || (currentTask.foundVideos = 0);
			currentTask.processedTileIds || (currentTask.processedTileIds = /* @__PURE__ */ new Set());
			if (!currentTask._scanStartedAt) {
				currentTask._scanStartedAt = Date.now();
				eventBus$2?.emit(EVENTS.OVERLAY_ERROR_BANNER_CLEAR);
			}
			const isImageTask = currentTask.type === "createimage";
			const stallTimeoutMs = isImageTask ? MONITORING_TIMEOUTS.IMAGE_STALL : MONITORING_TIMEOUTS.VIDEO_STALL;
			const zeroTilesTimeoutMs = isImageTask ? MONITORING_TIMEOUTS.IMAGE_ZERO_TILES : MONITORING_TIMEOUTS.VIDEO_ZERO_TILES;
			const preSubmitIds = state.preSubmitTileIds || /* @__PURE__ */ new Set();
			const completedTiles = scanForNewlyCompletedTiles(preSubmitIds);
			let foundNewItems = false;
			for (const { tileId, tileEl, isVideo } of completedTiles) {
				if (currentTask.processedTileIds.has(tileId)) continue;
				currentTask.processedTileIds.add(tileId);
				currentTask.foundVideos += 1;
				currentTask._lastFoundAt = Date.now();
				foundNewItems = true;
				const mediaLabel = isVideo ? "Video" : "Image";
				console.log(`✅ New ${mediaLabel} detected: tile ${tileId} (${currentTask.foundVideos}/${currentTask.expectedVideos})`);
				eventBus$2?.emit(EVENTS.OVERLAY_MESSAGE, `✅ ${mediaLabel} ${currentTask.foundVideos}/${currentTask.expectedVideos} for Task ${currentTask.index}`);
				chrome.runtime.sendMessage({
					action: "updateStatus",
					status: `${mediaLabel} ${currentTask.foundVideos}/${currentTask.expectedVideos} captured for Task ${currentTask.index}`
				});
				if (state.settings?.autoDownload !== false) {
					const qualityKey = isVideo ? "videoDownloadQuality" : "imageDownloadQuality";
					const targetQuality = currentTask.settings?.[qualityKey] || state.settings?.[qualityKey] || (isVideo ? DOWNLOAD_QUALITY_DEFAULTS.video : DOWNLOAD_QUALITY_DEFAULTS.image);
					downloadQueue.push({
						tileEl,
						targetQuality,
						label: `${mediaLabel} ${tileId}`
					});
					runDownloadQueue();
				}
				stateManager$3?.sendTaskUpdate?.(currentTask);
			}
			const { errorCount, errors } = scanTileErrors(preSubmitIds, currentTask.processedTileIds);
			if (errorCount > 0) {
				if (errors.every((error) => error.type === "DAILY_LIMIT_MODEL_FALLBACK")) {
					console.warn(`🍌 Task ${currentTask.index}: ALL tile errors are DAILY_LIMIT_MODEL_FALLBACK — triggering Imagen 4 fallback`);
					stopTileScanner();
					stopErrorMonitoring();
					eventBus$2?.emit(EVENTS.OVERLAY_MESSAGE, `⚠️ Nano Banana Pro daily limit reached — switching to Imagen 4 and retrying Task ${currentTask.index}...`);
					chrome.runtime.sendMessage({
						action: "updateStatus",
						status: `Task ${currentTask.index}: Nano Banana Pro limit hit — switching to Imagen 4`
					});
					eventBus$2?.emit(EVENTS.DAILY_LIMIT_FALLBACK, {
						task: currentTask,
						taskIndex: state.currentPromptIndex,
						fallbackModel: "imagen4"
					});
					return;
				}
				currentTask.foundVideos += errorCount;
				currentTask._lastFoundAt = Date.now();
				foundNewItems = true;
				for (const error of errors) console.warn(`⚠️ Tile error counted for task ${currentTask.index}: [${error.type}] ${error.label} (tile ${error.tileId})`);
				const errorSummary = errors.reduce((summary, error) => {
					summary[error.label] = (summary[error.label] || 0) + 1;
					return summary;
				}, {});
				const lines = Object.entries(errorSummary).map(([label, count]) => `• ${count}× ${label}`);
				eventBus$2?.emit(EVENTS.OVERLAY_ERROR_BANNER, {
					lines,
					taskIndex: currentTask.index
				});
				eventBus$2?.emit(EVENTS.OVERLAY_MESSAGE, `⚠️ ${errorCount} tile error(s) — ${currentTask.foundVideos}/${currentTask.expectedVideos} resolved`);
				chrome.runtime.sendMessage({
					action: "updateStatus",
					status: `Task ${currentTask.index}: ${errorCount} error tile(s) — ${JSON.stringify(errorSummary)} — ${currentTask.foundVideos}/${currentTask.expectedVideos} resolved`
				});
				stateManager$3?.sendTaskUpdate?.(currentTask);
			}
			const globalError = checkGlobalErrors();
			if (globalError.found) {
				console.error(`❌ Global error: [${globalError.type}] ${globalError.label} (severity: ${globalError.severity})`);
				eventBus$2?.emit(EVENTS.OVERLAY_MESSAGE, `❌ ${globalError.label}`);
				if (globalError.severity === "skip_task" && currentTask.status === "current") {
					currentTask.status = "error";
					stateManager$3?.sendTaskUpdate?.(currentTask);
					emitTaskCompleted(currentTask, state.currentPromptIndex);
					return;
				}
				if (globalError.severity === "pause_processing") {
					eventBus$2?.emit(EVENTS.PROCESSING_STOP);
					return;
				}
				if (globalError.severity === "terminate") {
					eventBus$2?.emit(EVENTS.PROCESSING_TERMINATE);
					return;
				}
			}
			const now = Date.now();
			const remainingCount = currentTask.expectedVideos - currentTask.foundVideos;
			const mediaType = isImageTask ? "image" : "video";
			if (currentTask.foundVideos >= currentTask.expectedVideos && currentTask.status === "current") {
				currentTask.status = "processed";
				const outputLabel = currentTask.type === "createimage" ? "image(s)" : "video(s)";
				console.log(`✅ Task ${currentTask.index} COMPLETE (${currentTask.foundVideos}/${currentTask.expectedVideos} ${outputLabel})`);
				stateManager$3?.sendTaskUpdate?.(currentTask);
				emitTaskCompleted(currentTask, state.currentPromptIndex);
				return;
			}
			if (currentTask.foundVideos > 0 && currentTask._lastFoundAt && now - currentTask._lastFoundAt > stallTimeoutMs && currentTask.status === "current") {
				currentTask.status = "processed";
				console.warn(`⚠️ Task ${currentTask.index}: stall timeout — ${currentTask.foundVideos}/${currentTask.expectedVideos} ${mediaType}(s) (${remainingCount} failed)`);
				eventBus$2?.emit(EVENTS.OVERLAY_MESSAGE, `⚠️ Task ${currentTask.index}: ${currentTask.foundVideos}/${currentTask.expectedVideos} ${mediaType}s — ${remainingCount} failed. Continuing...`);
				chrome.runtime.sendMessage({
					action: "updateStatus",
					status: `Task ${currentTask.index}: partial (${currentTask.foundVideos}/${currentTask.expectedVideos} ${mediaType}s). Moving on.`
				});
				stateManager$3?.sendTaskUpdate?.(currentTask);
				emitTaskCompleted(currentTask, state.currentPromptIndex);
				return;
			}
			if (currentTask.foundVideos === 0 && currentTask._scanStartedAt && now - currentTask._scanStartedAt > zeroTilesTimeoutMs && currentTask.status === "current") {
				currentTask.status = "error";
				const minutes = (zeroTilesTimeoutMs / 6e4).toFixed(1);
				console.error(`❌ Task ${currentTask.index}: zero ${mediaType}s after ${minutes} min. All ${currentTask.expectedVideos} generations failed.`);
				eventBus$2?.emit(EVENTS.OVERLAY_MESSAGE, `❌ Task ${currentTask.index}: no ${mediaType}s generated after ${minutes} min. Skipping...`);
				chrome.runtime.sendMessage({
					action: "updateStatus",
					status: `Task ${currentTask.index}: all ${currentTask.expectedVideos} ${mediaType}(s) failed (${minutes}min). Skipping.`
				});
				stateManager$3?.sendTaskUpdate?.(currentTask);
				emitTaskCompleted(currentTask, state.currentPromptIndex);
				return;
			}
			if (currentTask.foundVideos > 0 && currentTask._lastFoundAt && !foundNewItems) {
				const stalledSeconds = Math.round((now - currentTask._lastFoundAt) / 1e3);
				const timeoutSeconds = Math.round((stallTimeoutMs - (now - currentTask._lastFoundAt)) / 1e3);
				if (stalledSeconds > 0 && stalledSeconds % 30 < 5) console.log(`⏳ Task ${currentTask.index} [${mediaType}]: waiting for ${remainingCount} more — stalled ${stalledSeconds}s, timeout in ${timeoutSeconds}s`);
			}
		} catch (error) {
			console.error("❌ Error in periodicTileScanner:", error);
		}
	}
	function startTileScanner() {
		stopTileScanner();
		const state = getState$2?.() || {};
		if (!state.isProcessing && !state.isPausing) return;
		const intervalMs = state.scanIntervalMs || 5e3;
		console.log(`🔍 Starting tile scanner (every ${intervalMs / 1e3}s)`);
		tileScannerInterval = setInterval(periodicTileScanner, intervalMs);
	}
	function stopTileScanner() {
		if (!tileScannerInterval) return;
		clearInterval(tileScannerInterval);
		tileScannerInterval = null;
		console.log("🛑 Tile scanner stopped");
	}
	function checkForQueueFull() {
		try {
			const selectors = getSelectors?.() || {};
			return Boolean($(selectors.QUEUE_FULL_POPUP_XPATH));
		} catch (error) {
			console.warn("⚠️ Error checking for queue full:", error);
			return false;
		}
	}
	function checkForPromptPolicyError() {
		try {
			const selectors = getSelectors?.() || {};
			return Boolean($(selectors.PROMPT_POLICY_ERROR_POPUP_XPATH));
		} catch (error) {
			console.warn("⚠️ Error checking for policy error:", error);
			return false;
		}
	}
	async function checkForErrorsAfterSubmit() {
		await h(2e3);
		for (let index = 0; index < 10; index += 1) {
			if (checkForQueueFull()) {
				console.warn("⚠️ Queue is full!");
				return "QUEUE_FULL";
			}
			if (checkForPromptPolicyError()) {
				console.warn("⚠️ Prompt violates policy!");
				return "POLICY_PROMPT";
			}
			await h(1e3);
		}
		return null;
	}
	function startErrorMonitoring() {
		stopErrorMonitoring();
		console.log("🔍 Starting error monitoring...");
		errorMonitoringInterval = setInterval(async () => {
			const state = getState$2?.() || {};
			if (!state.isProcessing && !state.isPausing) {
				stopErrorMonitoring();
				return;
			}
			if (!checkForPromptPolicyError()) return;
			console.error("❌ Policy error detected during generation!");
			stopErrorMonitoring();
			stopTileScanner();
			const currentTask = state.taskList?.[state.currentPromptIndex];
			if (currentTask) {
				currentTask.status = "error";
				stateManager$3?.sendTaskUpdate?.(currentTask);
			}
			eventBus$2?.emit(EVENTS.OVERLAY_MESSAGE, "⚠️ Policy violation detected. Skipping this prompt...");
			chrome.runtime.sendMessage({
				action: "updateStatus",
				status: `Policy violation on prompt: "${state.prompts?.[state.currentPromptIndex]?.substring(0, 30)}..."`
			});
			setTimeout(() => {
				if (!(getState$2?.() || {}).isProcessing) return;
				setState$2?.({ isCurrentPromptProcessed: true });
				if (currentTask) eventBus$2?.emit(EVENTS.TASK_COMPLETED, {
					task: currentTask,
					taskIndex: state.currentPromptIndex
				});
			}, 3e3);
		}, 2e3);
	}
	function stopErrorMonitoring() {
		if (!errorMonitoringInterval) return;
		clearInterval(errorMonitoringInterval);
		errorMonitoringInterval = null;
		console.log("🛑 Error monitoring stopped");
	}
	function resetDownloadQueue() {
		downloadQueue = [];
		isDownloadRunnerActive = false;
	}
	function emitTaskCompleted(task, taskIndex) {
		if (getState$2?.().isCurrentPromptProcessed) return;
		stopTileScanner();
		stopErrorMonitoring();
		setTimeout(() => {
			const state = getState$2?.() || {};
			if (state.isProcessing || state.isPausing) eventBus$2?.emit(EVENTS.TASK_COMPLETED, {
				task,
				taskIndex
			});
		}, 500);
	}
	//#endregion
	//#region src/content/taskRunner.js
	var getState$1 = null;
	var setState$1 = null;
	var eventBus$1 = null;
	var monitoring$1 = null;
	var stateManager$2 = null;
	function init$2({ getState: getStateFn, setState: setStateFn, eventBus: eventBusInstance, monitoring: monitoringModule, stateManager: stateManagerModule }) {
		getState$1 = getStateFn;
		setState$1 = setStateFn;
		eventBus$1 = eventBusInstance;
		monitoring$1 = monitoringModule;
		stateManager$2 = stateManagerModule;
		eventBus$1.on(EVENTS.DAILY_LIMIT_FALLBACK, ({ task, taskIndex, fallbackModel }) => {
			console.warn(`🔄 DAILY_LIMIT_FALLBACK received — switching all tasks to model: ${fallbackModel}`);
			const state = getState$1?.();
			if (!state) return;
			setState$1?.({ fallbackModel });
			const patchedTasks = state.taskList.map((item) => {
				if (item.status !== "pending" && item.status !== "current") return item;
				return {
					...item,
					settings: {
						...item.settings,
						model: fallbackModel
					},
					processedTileIds: /* @__PURE__ */ new Set(),
					foundVideos: 0,
					_scanStartedAt: null,
					_lastFoundAt: null,
					status: item.index === task.index ? "pending" : item.status
				};
			});
			setState$1?.({
				taskList: patchedTasks,
				lastAppliedSettings: null
			});
			console.log(`✅ Model patched to "${fallbackModel}" on ${patchedTasks.filter((item) => item.status === "pending" || item.status === "current").length} task(s)`);
			setTimeout(() => {
				const currentState = getState$1?.();
				if (!currentState?.isProcessing && !currentState?.isPausing) return;
				const currentTask = currentState.taskList.find((item) => item.index === task.index);
				if (!currentTask) return;
				console.log(`🔁 Re-running Task ${currentTask.index} with fallback model "${fallbackModel}"...`);
				eventBus$1?.emit(EVENTS.OVERLAY_MESSAGE, `🔁 Retrying Task ${currentTask.index} with Imagen 4...`);
				runTask(currentTask, taskIndex);
			}, 2e3);
		});
	}
	function isProcessingStopped() {
		const state = getState$1?.() || {};
		return !state.isProcessing && !state.isPausing;
	}
	async function runTask(task, taskIndex) {
		if (!task) {
			console.error("❌ TaskRunner: No task provided");
			eventBus$1?.emit(EVENTS.TASK_ERROR, {
				task: null,
				reason: "no_task"
			});
			return;
		}
		let nextTask = task;
		const prompt = nextTask.prompt;
		const isImageTask = nextTask.type === "createimage";
		const taskType = isImageTask ? "createimage" : "createvideo";
		const mediaType = isImageTask ? "image" : "video";
		logEvent("task.run_started", `Starting ${taskType} task ${nextTask.index}`, {
			taskIndex,
			task: nextTask
		});
		setState$1?.({
			currentProcessingPrompt: prompt,
			currentTaskStartTime: Date.now()
		});
		const overlayMessage = `Processing ${taskType} task ${nextTask.index}: "${prompt?.substring(0, 30)}${prompt?.length > 30 ? "..." : ""}"`;
		console.log(`📌 Task ${nextTask.index} started`);
		eventBus$1?.emit(EVENTS.OVERLAY_MESSAGE, overlayMessage);
		const fallbackModel = getState$1?.()?.fallbackModel;
		if (fallbackModel && nextTask.settings?.model !== fallbackModel) {
			console.log(`🔄 Applying fallback model override: ${nextTask.settings?.model ?? "default"} → ${fallbackModel}`);
			nextTask = {
				...nextTask,
				settings: {
					...nextTask.settings,
					model: fallbackModel
				}
			};
		}
		console.log(`⚙️ Step 0/4: Applying settings for Task ${nextTask.index} (${taskType})...`);
		eventBus$1?.emit(EVENTS.OVERLAY_MESSAGE, `Step 0/4: Applying settings for ${taskType}...`);
		if (await applyUnifiedSettings(nextTask.type || "createvideo", nextTask.settings || {})) console.log(`✅ Settings applied: ${taskType}, ${nextTask.settings?.count || "1"} ${mediaType}(s), ${nextTask.settings?.model || "default"}, ${nextTask.settings?.aspectRatio || "landscape"}`);
		else {
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
				console.log(`🧹 Step 1.5 pre-flight: Clearing any existing attached references for Task ${nextTask.index}...`);
				eventBus$1?.emit(EVENTS.OVERLAY_MESSAGE, "Step 1.5/4: Clearing previous references...");
				await clearExistingReferences();
				console.log(`🖼️ Step 1.5a/4: Checking/uploading ${images.length} file(s) into Flow [${mode}] for Task ${nextTask.index}...`);
				eventBus$1?.emit(EVENTS.OVERLAY_MESSAGE, `Step 1.5/4: Uploading ${images.length} reference image(s) to Flow library...`);
				if (!await uploadAllImages(images)) {
					if (isProcessingStopped()) {
						console.log("⏸️ Processing stopped during file injection");
						return;
					}
					console.error("❌ File injection failed — triggering retry");
					eventBus$1?.emit(EVENTS.TASK_ERROR, {
						task: nextTask,
						taskIndex,
						reason: "image_upload_failed"
					});
					return;
				}
				console.log(`🔗 Step 1.5b/4: Attaching ${images.length} image(s) as references [${mode}]...`);
				eventBus$1?.emit(EVENTS.OVERLAY_MESSAGE, `Step 1.5/4: Attaching ${images.length} reference image(s)...`);
				if (!await attachAllImages(images, mode)) {
					if (isProcessingStopped()) {
						console.log("⏸️ Processing stopped during reference attachment");
						return;
					}
					console.error("❌ Reference attachment failed — triggering retry");
					eventBus$1?.emit(EVENTS.TASK_ERROR, {
						task: nextTask,
						taskIndex,
						reason: "image_attach_failed"
					});
					return;
				}
				console.log(`✅ All ${images.length} reference image(s) [${mode}] uploaded and attached`);
				await h(500);
			}
		}
		console.log(`📝 Step 2/4: Injecting prompt for Task ${nextTask.index}...`);
		eventBus$1?.emit(EVENTS.OVERLAY_MESSAGE, "Step 2/4: Adding prompt...");
		if (!await injectText(prompt)) {
			console.error("❌ Text injection failed — triggering retry");
			eventBus$1?.emit(EVENTS.TASK_ERROR, {
				task: nextTask,
				taskIndex,
				reason: "inject_failed"
			});
			return;
		}
		await h(1e3);
		stateManager$2?.updateTask?.(taskIndex, { status: "current" });
		eventBus$1?.emit(EVENTS.TASK_START, {
			task: stateManager$2?.getCurrentTask?.() ?? nextTask,
			taskIndex
		});
		console.log(`📋 Task ${nextTask.index} status: current`);
		console.log(`🚀 Step 3/4: Submitting Task ${nextTask.index}...`);
		eventBus$1?.emit(EVENTS.OVERLAY_MESSAGE, "Step 3/4: Submitting...");
		if (monitoring$1?.snapshotExistingTileIds) {
			const preSubmitIds = monitoring$1.snapshotExistingTileIds();
			setState$1?.({ preSubmitTileIds: preSubmitIds });
			console.log(`📸 Pre-submit tile snapshot: ${preSubmitIds.size} existing tile(s)`);
		}
		if (!await clickSubmit()) {
			console.error("❌ Submit failed — triggering retry");
			eventBus$1?.emit(EVENTS.TASK_ERROR, {
				task: nextTask,
				taskIndex,
				reason: "submit_failed"
			});
			return;
		}
		console.log(`✅ Submitted prompt: "${prompt}"`);
		console.log("🔍 Step 4/4: Monitoring for completion...");
		logEvent("task.submitted", `Task ${nextTask.index} submitted to Flow`, {
			taskIndex,
			task: nextTask
		});
		eventBus$1?.emit(EVENTS.OVERLAY_MESSAGE, isImageTask ? "Step 4/4: Monitoring image generation..." : "Step 4/4: Monitoring video generation...");
		const errorAfterSubmit = monitoring$1?.checkForErrorsAfterSubmit ? await monitoring$1.checkForErrorsAfterSubmit() : null;
		if (errorAfterSubmit === "QUEUE_FULL") {
			console.warn("⚠️ Queue full — waiting 30 seconds before retry...");
			eventBus$1?.emit(EVENTS.OVERLAY_MESSAGE, "Queue is full. Waiting 30 seconds before retry...");
			await h(3e4);
			runTask(nextTask, taskIndex);
			return;
		}
		if (errorAfterSubmit === "POLICY_PROMPT") {
			console.error("❌ Prompt violates policy — skipping");
			logEvent("task.policy_violation", `Task ${nextTask.index} violated Flow policy`, {
				taskIndex,
				task: nextTask
			}, "warn");
			eventBus$1?.emit(EVENTS.OVERLAY_MESSAGE, "⚠️ Policy violation detected. Skipping this prompt...");
			stateManager$2?.updateTask?.(taskIndex, { status: "error" });
			stateManager$2?.sendTaskUpdate?.(nextTask);
			eventBus$1?.emit(EVENTS.TASK_SKIPPED, {
				task: nextTask,
				taskIndex,
				reason: "policy_violation"
			});
			chrome.runtime.sendMessage({
				action: "updateStatus",
				status: `Policy violation on prompt: "${prompt?.substring(0, 30)}..."`
			});
			await h(3e3);
			setState$1?.({ isCurrentPromptProcessed: true });
			eventBus$1?.emit(EVENTS.TASK_COMPLETED, {
				task: nextTask,
				taskIndex
			});
			return;
		}
		console.log("✅ No errors detected, starting tile scanner...");
		monitoring$1?.startTileScanner?.();
		monitoring$1?.startErrorMonitoring?.();
		const generationMessage = isImageTask ? "Generating images... scanning for images" : "Generating flow... scanning for videos";
		console.log(`⏳ ${generationMessage}`);
		eventBus$1?.emit(EVENTS.OVERLAY_MESSAGE, generationMessage);
		setState$1?.({ currentRetries: 0 });
	}
	//#endregion
	//#region src/content/queueController.js
	var stateManager$1 = null;
	var eventBus = null;
	var monitoring = null;
	var interTaskTimer = null;
	function init$1({ stateManager: stateManagerModule, eventBus: eventBusInstance, monitoring: monitoringModule }) {
		stateManager$1 = stateManagerModule;
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
		const state = stateManager$1.getState();
		stateManager$1.setState({ isCurrentPromptProcessed: false });
		const totalTasks = state.taskList.length > 0 ? state.taskList.length : state.prompts.length;
		if (!state.isProcessing || state.currentPromptIndex >= totalTasks) {
			stateManager$1.setState({ isProcessing: false });
			updateProgressBroadcast();
			eventBus.emit(EVENTS.OVERLAY_HIDE);
			if (state.currentPromptIndex >= totalTasks) {
				chrome.runtime.sendMessage({
					action: "updateStatus",
					status: "All flow prompts completed successfully!"
				});
				chrome.runtime.sendMessage({ action: "resetPageZoom" }).catch(() => {});
				stateManager$1.clearStateFromStorage?.();
				eventBus.emit(EVENTS.PROCESSING_COMPLETE);
			}
			return;
		}
		const prompt = state.prompts[state.currentPromptIndex] || "";
		const shortPrompt = prompt.length > 30 ? `${prompt.substring(0, 30)}...` : prompt;
		eventBus.emit(EVENTS.OVERLAY_SHOW, `Processing Flow: "${shortPrompt}"`);
		if (state.currentPromptIndex === 0) chrome.runtime.sendMessage({
			action: "setPageZoom",
			zoomFactor: FLOW_PAGE_ZOOM_FACTOR
		}).catch(() => {});
		chrome.storage.local.get("quotaStatus", (result) => {
			const quotaStatus = result.quotaStatus || {
				canContinue: true,
				isPaid: false
			};
			if (quotaStatus.isPaid) {
				runCurrentTask();
				return;
			}
			if (!quotaStatus.canContinue) {
				stateManager$1.setState({ isProcessing: false });
				eventBus.emit(EVENTS.OVERLAY_HIDE);
				const currentTask = stateManager$1.getCurrentTask?.();
				if (currentTask) {
					stateManager$1.updateTask?.(state.currentPromptIndex, { status: "error" });
					stateManager$1.sendTaskUpdate?.(currentTask);
				}
				chrome.runtime.sendMessage({
					action: "error",
					error: "Your quota has been depleted. Please upgrade to continue."
				});
				return;
			}
			runCurrentTask();
		});
	}
	async function onTaskCompleted({ task, taskIndex }) {
		const state = stateManager$1.getState();
		if (state.isCurrentPromptProcessed) return;
		console.log(`✅ Queue: Task ${task?.index} completed — moving to next`);
		logEvent("task.completed", `Task ${task?.index} completed`, {
			taskIndex,
			task
		});
		if (task?.queueTaskId) chrome.runtime.sendMessage({
			action: "taskStatusUpdate",
			taskId: task.queueTaskId,
			status: "processed"
		}).catch(() => {});
		eventBus.emit(EVENTS.OVERLAY_MESSAGE, `✅ All outputs captured for Task ${task?.index}`);
		chrome.runtime.sendMessage({
			action: "updateStatus",
			status: `All outputs captured for prompt: "${state.prompts?.[state.currentPromptIndex]?.substring(0, 30)}..."`
		});
		stateManager$1.setState({
			isCurrentPromptProcessed: true,
			currentProcessingPrompt: null
		});
		monitoring?.stopTileScanner?.();
		monitoring?.stopErrorMonitoring?.();
		setTimeout(() => {
			const nextState = stateManager$1.getState();
			if (nextState.isProcessing || nextState.isPausing) advanceAfterTaskCompletion();
		}, 1e3);
	}
	function onTaskSkipped({ task, taskIndex }) {
		if (task?.queueTaskId) chrome.runtime.sendMessage({
			action: "taskStatusUpdate",
			taskId: task.queueTaskId,
			status: "processed"
		}).catch(() => {});
		onTaskCompleted({
			task,
			taskIndex
		});
	}
	function onTaskError({ task, taskIndex, reason }) {
		console.warn(`⚠️ Queue: Task ${task?.index} error — reason: ${reason}`);
		logEvent("task.error", `Task ${task?.index} reported an error`, {
			taskIndex,
			task,
			reason
		}, "warn");
		if (stateManager$1.getState().currentRetries >= 2 && task?.queueTaskId) chrome.runtime.sendMessage({
			action: "taskStatusUpdate",
			taskId: task.queueTaskId,
			status: "error"
		}).catch(() => {});
		retryOrFail();
	}
	function onTaskStart({ task }) {
		if (!task?.queueTaskId) return;
		logEvent("task.current", `Task ${task.index} is now current`, { task });
		chrome.runtime.sendMessage({
			action: "taskStatusUpdate",
			taskId: task.queueTaskId,
			status: "current"
		}).catch(() => {});
	}
	function retryOrFail() {
		const state = stateManager$1.getState();
		if (state.currentRetries < 3) {
			stateManager$1.setState({ currentRetries: state.currentRetries + 1 });
			const message = `Retry ${stateManager$1.getState().currentRetries}/3: Waiting for Flow Labs interface...`;
			logEvent("task.retry_scheduled", message, {
				currentPromptIndex: state.currentPromptIndex,
				currentRetries: stateManager$1.getState().currentRetries,
				maxRetries: 3
			}, "warn");
			eventBus.emit(EVENTS.OVERLAY_MESSAGE, message);
			chrome.runtime.sendMessage({
				action: "updateStatus",
				status: message
			});
			setTimeout(processNextTask, RETRY_DELAY_MS);
			return;
		}
		eventBus.emit(EVENTS.OVERLAY_HIDE);
		const currentTask = stateManager$1.getCurrentTask?.();
		if (currentTask) {
			stateManager$1.updateTask?.(state.currentPromptIndex, { status: "error" });
			stateManager$1.sendTaskUpdate?.(currentTask);
		}
		logEvent("processing.failed", "Flow processing stopped after exhausting retries", {
			currentPromptIndex: state.currentPromptIndex,
			currentRetries: state.currentRetries,
			maxRetries: 3,
			currentTask
		}, "error");
		chrome.runtime.sendMessage({
			action: "error",
			error: "Unable to find Flow Labs interface elements after multiple attempts. Make sure you are on the correct page."
		});
		stateManager$1.setState({ isProcessing: false });
	}
	function cancelInterTaskDelay() {
		if (interTaskTimer !== null) {
			clearTimeout(interTaskTimer);
			interTaskTimer = null;
			console.log("⏹️ QueueController: inter-task delay cancelled");
		}
		stateManager$1.clearCountdownTimer?.();
	}
	function updateProgressBroadcast() {
		const state = stateManager$1.getState();
		const processed = Math.min(state.currentPromptIndex, state.prompts.length);
		if (state.isProcessing || state.isPausing) eventBus.emit(EVENTS.PROGRESS_UPDATE, { currentIndex: processed });
		chrome.runtime.sendMessage({
			action: "updateProgress",
			currentPrompt: processed < state.prompts.length ? state.prompts[processed] : "",
			processed,
			total: state.prompts.length
		});
	}
	function runCurrentTask() {
		const state = stateManager$1.getState();
		const currentTask = stateManager$1.getCurrentTask?.();
		if (!currentTask) {
			console.error("❌ QueueController: No task at current index");
			logEvent("task.missing", "No task found for the current prompt index", {
				currentPromptIndex: state.currentPromptIndex,
				taskCount: state.taskList?.length || 0
			}, "error");
			retryOrFail();
			return;
		}
		runTask(currentTask, state.currentPromptIndex);
	}
	async function advanceAfterTaskCompletion() {
		const state = stateManager$1.getState();
		if (!state.isCurrentPromptProcessed) return;
		monitoring?.stopTileScanner?.();
		const nextIndex = state.currentPromptIndex + 1;
		const totalTasks = state.taskList.length > 0 ? state.taskList.length : state.prompts.length;
		stateManager$1.setState({ currentPromptIndex: nextIndex });
		updateProgressBroadcast();
		stateManager$1.saveStateToStorage?.();
		if (!stateManager$1.getState().isProcessing) {
			monitoring?.stopTileScanner?.();
			monitoring?.stopErrorMonitoring?.();
			stateManager$1.setState({ isPausing: false });
			eventBus.emit(EVENTS.OVERLAY_HIDE);
			chrome.runtime.sendMessage({
				action: "updateStatus",
				status: "Processing paused. Click Resume to continue."
			});
			return;
		}
		const autoClearCache = state.settings?.autoClearCache ?? false;
		const autoClearCacheInterval = state.settings?.autoClearCacheInterval ?? 50;
		if (autoClearCache && nextIndex > 0 && nextIndex % autoClearCacheInterval === 0 && nextIndex < totalTasks) {
			console.log(`🗑️ Auto-clear cache milestone: task ${nextIndex}/${totalTasks} — sending clearFlowCache (fire-and-forget)`);
			eventBus.emit(EVENTS.OVERLAY_MESSAGE, `🧹 Clearing Flow cache (milestone: task ${nextIndex}/${totalTasks})...`);
			chrome.runtime.sendMessage({
				action: "updateStatus",
				status: `Task ${nextIndex} complete — clearing Flow cache for performance...`
			});
			chrome.runtime.sendMessage({ action: "clearFlowCache" }, () => {
				if (chrome.runtime.lastError) {}
			});
			return;
		}
		if (nextIndex >= totalTasks) {
			console.log("✅ All tasks done — skipping inter-task countdown");
			processNextTask();
			return;
		}
		const nextState = stateManager$1.getState();
		const nextTask = nextState.taskList.length > 0 && nextState.currentPromptIndex < nextState.taskList.length ? nextState.taskList[nextState.currentPromptIndex] : null;
		const delayMs = stateManager$1.getRandomDelay ? stateManager$1.getRandomDelay(nextTask, nextState.settings) : INTER_TASK_DELAY_FALLBACK_MS;
		eventBus.emit(EVENTS.COUNTDOWN_START, {
			ms: delayMs,
			label: "next prompt"
		});
		interTaskTimer = setTimeout(() => {
			interTaskTimer = null;
			if (stateManager$1.getState().isProcessing) processNextTask();
		}, delayMs);
	}
	//#endregion
	//#region src/content/overlayManager.js
	var getState = null;
	var setState = null;
	var clearCountdownTimer = null;
	var stateManager = null;
	function init(stateManagerModule, eventBus) {
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
			updateMessage(void 0, currentIndex);
		});
	}
	function injectOverlayStyles() {
		if (document.getElementById("labs-flow-overlay-styles")) return;
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
		if (document.getElementById("pausing-spinner-style")) return;
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
	function showOverlay(message) {
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
		const progressPercent = (state.currentPromptIndex + 1) / state.prompts.length * 100;
		setTimeout(() => {
			progressFill.style.width = `${Math.min(progressPercent, 100)}%`;
		}, 100);
	}
	function updateMessage(text, progressIndex) {
		const messageText = document.getElementById("labs-flow-message-text");
		const progressText = document.getElementById("labs-flow-progress-text");
		const progressFill = document.getElementById("labs-flow-progress-fill");
		if (messageText && text) messageText.innerText = text;
		if (progressIndex !== void 0) {
			const total = getState().prompts.length || 1;
			const progressPercent = Math.min((progressIndex + 1) / total * 100, 100);
			if (progressText) progressText.textContent = `Image Prompt: ${progressIndex + 1}/${total}`;
			if (progressFill) progressFill.style.width = `${progressPercent}%`;
		}
	}
	function hideOverlay() {
		clearCountdownTimer?.();
		const overlay = document.getElementById("labs-flow-overlay");
		if (overlay) document.body.removeChild(overlay);
	}
	function showPausingState() {
		if (!document.getElementById("labs-flow-overlay")) return;
		updateMessage("Pausing after current task completes...");
		const buttonContainer = document.getElementById("labs-flow-button-container");
		if (!buttonContainer || document.getElementById("labs-flow-pausing-button")) return;
		const pauseButton = document.getElementById("labs-flow-pause-button");
		if (pauseButton) pauseButton.remove();
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
			if (terminateIcon) terminateIcon.style.transform = "rotate(90deg)";
		});
		pausingButton.addEventListener("mouseleave", () => {
			pausingButton.style.background = "linear-gradient(135deg, #ea580c, #f97316)";
			pausingButton.style.transform = "translateY(0)";
			pausingButton.style.boxShadow = "0 4px 12px rgba(234, 88, 12, 0.25)";
			pausingContent.style.opacity = "1";
			terminateContent.style.opacity = "0";
			const terminateIcon = terminateContent.querySelector(".terminate-icon");
			if (terminateIcon) terminateIcon.style.transform = "rotate(0deg)";
		});
		pausingButton.addEventListener("click", () => {
			chrome.runtime.sendMessage({ action: "terminateProcessingFromOverlay" });
			setState({
				isPausing: false,
				isProcessing: false
			});
			hideOverlay();
		});
		buttonContainer.appendChild(pausingButton);
	}
	function injectBannerStyles() {
		if (document.getElementById("labs-flow-banner-styles")) return;
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
	function showErrorBanner({ lines = [], taskIndex = "?" } = {}) {
		const messageCard = document.getElementById("labs-flow-message");
		if (!messageCard) return;
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
		if (progress) messageCard.insertBefore(banner, progress);
		else messageCard.appendChild(banner);
	}
	function clearErrorBanner() {
		const banner = document.getElementById("labs-flow-error-banner");
		if (banner) banner.remove();
	}
	//#endregion
	//#region src/content/contentDownloadManager.js
	var contentDownloadManager_exports = /* @__PURE__ */ __exportAll({
		activate: () => activate,
		deactivate: () => deactivate,
		isActive: () => isActive,
		toggle: () => toggle
	});
	var isActiveFlag = false;
	var selectedTileIds = /* @__PURE__ */ new Set();
	var tileObserver = null;
	var observerRefreshTimer = null;
	var imageQuality = "1K";
	var videoQuality = "720p";
	var isDownloadRunActive = false;
	var isPaused = false;
	var shouldStop = false;
	var queuedTiles = [];
	var themeListener = null;
	var CONTROL_PANEL_ID = "cdm-control-panel";
	var STYLE_ID = "cdm-styles";
	var TILE_OVERLAY_CLASS = "cdm-tile-overlay";
	var DRAG_BLOCKER_SELECTOR = [
		"button",
		"select",
		"input",
		"textarea",
		"label",
		"a",
		"#cdm-resize-handle",
		"[data-no-drag]"
	].join(", ");
	function hasCompletedMedia(tileElement) {
		return Boolean(tileElement.querySelector("video[src*=\"media.getMediaUrlRedirect\"]") || tileElement.querySelector("img[src*=\"media.getMediaUrlRedirect\"]"));
	}
	function isVideoTile(tileElement) {
		return Boolean(tileElement.querySelector("video"));
	}
	function getCompletedTiles() {
		const tiles = [];
		const seenTileIds = /* @__PURE__ */ new Set();
		document.querySelectorAll("[data-tile-id]").forEach((tileElement) => {
			const tileId = tileElement.getAttribute("data-tile-id");
			if (!tileId || seenTileIds.has(tileId) || !hasCompletedMedia(tileElement)) return;
			seenTileIds.add(tileId);
			tiles.push({
				tileId,
				tileEl: tileElement,
				isVideo: isVideoTile(tileElement)
			});
		});
		return tiles;
	}
	function injectStyles() {
		if (document.getElementById(STYLE_ID)) return;
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
		if (document.getElementById(CONTROL_PANEL_ID)) return;
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
				if (tileElement) deselectTile(tileId, tileElement);
			});
			selectedTileIds.clear();
			updateStats();
		});
		document.getElementById("cdm-select-images-btn")?.addEventListener("click", () => {
			getCompletedTiles().forEach(({ tileId, tileEl, isVideo }) => {
				if (isVideo) deselectTile(tileId, tileEl);
				else selectTile(tileId, tileEl);
			});
			updateStats();
		});
		document.getElementById("cdm-select-videos-btn")?.addEventListener("click", () => {
			getCompletedTiles().forEach(({ tileId, tileEl, isVideo }) => {
				if (isVideo) selectTile(tileId, tileEl);
				else deselectTile(tileId, tileEl);
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
			if (event.target.closest(DRAG_BLOCKER_SELECTOR)) return;
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
		if (!resizeHandle) return;
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
		if (totalChip) totalChip.textContent = `${totalTiles} tile${totalTiles !== 1 ? "s" : ""}`;
		if (selectedChip) selectedChip.textContent = `${selectedCount} selected`;
		if (downloadButton) downloadButton.disabled = selectedCount === 0 || isDownloadRunActive;
		if (downloadLabel) downloadLabel.textContent = isDownloadRunActive ? "Downloading…" : `Download (${selectedCount})`;
	}
	function ensureTileOverlay(tileId, tileElement) {
		const existingOverlay = tileElement.querySelector(`.${TILE_OVERLAY_CLASS}`);
		if (existingOverlay) return existingOverlay;
		if (window.getComputedStyle(tileElement).position === "static") tileElement.style.position = "relative";
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
			if (checkbox.checked) selectTile(tileId, tileElement);
			else deselectTile(tileId, tileElement);
			updateStats();
		});
		overlay.addEventListener("click", (event) => {
			if (event.target === checkbox) return;
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
		if (checkbox) checkbox.checked = true;
		let ring = tileElement.querySelector(".cdm-tile-selected-ring");
		if (!ring) {
			ring = document.createElement("div");
			ring.className = "cdm-tile-selected-ring";
			const overlay = tileElement.querySelector(`.${TILE_OVERLAY_CLASS}`);
			if (overlay) overlay.appendChild(ring);
		}
	}
	function deselectTile(tileId, tileElement) {
		selectedTileIds.delete(tileId);
		const checkbox = tileElement.querySelector(`[data-tile-cb="${tileId}"]`);
		if (checkbox) checkbox.checked = false;
		const ring = tileElement.querySelector(".cdm-tile-selected-ring");
		if (ring) ring.remove();
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
		return document.querySelector("[data-virtuoso-scroller]") || document.querySelector("[class*=\"tileGrid\"], [class*=\"tile-grid\"], [class*=\"TileGrid\"]") || document.querySelector("main") || document.body;
	}
	function attachObserver() {
		if (tileObserver) return;
		tileObserver = new MutationObserver((mutations) => {
			if (!isActiveFlag) return;
			if (!mutations.some((mutation) => [...mutation.addedNodes].some((node) => {
				if (node.nodeType !== Node.ELEMENT_NODE) return false;
				return !node.classList?.contains(TILE_OVERLAY_CLASS) && node.id !== CONTROL_PANEL_ID && node.id !== STYLE_ID;
			}))) return;
			clearTimeout(observerRefreshTimer);
			observerRefreshTimer = setTimeout(() => {
				if (!isActiveFlag) return;
				getCompletedTiles().forEach(({ tileId, tileEl }) => {
					if (!tileEl.querySelector(`.${TILE_OVERLAY_CLASS}`)) ensureTileOverlay(tileId, tileEl);
				});
				updateStats();
			}, 200);
		});
		const root = getObserverRoot();
		tileObserver.observe(root, {
			childList: true,
			subtree: true
		});
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
		const buttons = [...menuElement.querySelectorAll("button[role=\"menuitem\"], button")];
		if (buttons.length === 0) return null;
		const buttonData = buttons.map((button) => ({
			button,
			label: button.querySelectorAll("span")[0]?.textContent.trim() || button.textContent.trim(),
			enabled: button.getAttribute("aria-disabled") !== "true"
		}));
		const enabledButtons = buttonData.filter((entry) => entry.enabled);
		if (targetQuality) {
			const matching = buttonData.find((entry) => entry.label === targetQuality);
			if (matching && matching.enabled) return matching.button;
		}
		return enabledButtons.length > 0 ? enabledButtons[enabledButtons.length - 1].button : buttons[0] || null;
	}
	async function downloadTileViaUI(tileElement, targetQuality) {
		try {
			const mediaElement = tileElement.querySelector("video[src*=\"media.getMediaUrlRedirect\"]") || tileElement.querySelector("img[src*=\"media.getMediaUrlRedirect\"]");
			if (!mediaElement) {
				console.warn("[CDM] No media element in tile");
				return false;
			}
			const rect = mediaElement.getBoundingClientRect();
			const clientX = rect.left + rect.width / 2;
			const clientY = rect.top + rect.height / 2;
			mediaElement.dispatchEvent(new MouseEvent("mouseenter", {
				bubbles: true,
				clientX,
				clientY
			}));
			mediaElement.dispatchEvent(new MouseEvent("mousemove", {
				bubbles: true,
				clientX,
				clientY
			}));
			await h(400);
			mediaElement.dispatchEvent(new MouseEvent("contextmenu", {
				bubbles: true,
				cancelable: true,
				clientX,
				clientY,
				button: 2
			}));
			await h(600);
			const contextMenu = document.querySelector("[data-radix-menu-content][data-state=\"open\"]");
			if (!contextMenu) {
				console.warn("[CDM] Context menu did not open");
				return false;
			}
			const downloadItem = [...contextMenu.querySelectorAll("[role=\"menuitem\"]")].find((item) => item.querySelector("i")?.textContent.trim() === "download");
			if (!downloadItem) {
				console.warn("[CDM] Download menuitem not found");
				document.body.dispatchEvent(new KeyboardEvent("keydown", {
					key: "Escape",
					bubbles: true
				}));
				return false;
			}
			downloadItem.click();
			await h(600);
			const menus = [...document.querySelectorAll("[data-radix-menu-content][data-state=\"open\"]")];
			const qualityMenu = menus.find((menu) => menu !== contextMenu) || menus[menus.length - 1];
			if (!qualityMenu || qualityMenu === contextMenu) {
				console.warn("[CDM] Quality sub-menu did not open");
				document.body.dispatchEvent(new KeyboardEvent("keydown", {
					key: "Escape",
					bubbles: true
				}));
				return false;
			}
			const qualityButton = pickQualityButton(qualityMenu, targetQuality);
			if (!qualityButton) {
				console.warn("[CDM] No quality button in sub-menu");
				document.body.dispatchEvent(new KeyboardEvent("keydown", {
					key: "Escape",
					bubbles: true
				}));
				return false;
			}
			qualityButton.click();
			await h(300);
			return true;
		} catch (error) {
			console.error("[CDM] downloadTileViaUI error:", error);
			document.body.dispatchEvent(new KeyboardEvent("keydown", {
				key: "Escape",
				bubbles: true
			}));
			return false;
		}
	}
	function togglePause() {
		isPaused = !isPaused;
		const pauseButton = document.getElementById("cdm-pause-btn");
		const pauseLabel = document.getElementById("cdm-pause-label");
		const pausedBadge = document.getElementById("cdm-paused-badge");
		pauseButton?.classList.toggle("cdm-paused", isPaused);
		if (pauseLabel) pauseLabel.textContent = isPaused ? "Resume" : "Pause";
		const icon = pauseButton?.querySelector("svg");
		if (icon) icon.innerHTML = isPaused ? "<polygon points=\"5,3 19,12 5,21\" fill=\"currentColor\"/>" : "<rect x=\"6\" y=\"4\" width=\"4\" height=\"16\" rx=\"1\" fill=\"currentColor\"/><rect x=\"14\" y=\"4\" width=\"4\" height=\"16\" rx=\"1\" fill=\"currentColor\"/>";
		pausedBadge?.classList.toggle("cdm-visible", isPaused);
		const progressLabel = document.getElementById("cdm-progress-label");
		if (progressLabel) progressLabel.style.opacity = isPaused ? "0.5" : "";
	}
	function stopDownloadRun() {
		if (!isDownloadRunActive) return;
		shouldStop = true;
		if (isPaused) togglePause();
	}
	async function startDownloadRun() {
		if (isDownloadRunActive || selectedTileIds.size === 0) return;
		isDownloadRunActive = true;
		isPaused = false;
		shouldStop = false;
		queuedTiles = getCompletedTiles().filter(({ tileId }) => selectedTileIds.has(tileId)).map((tile) => ({
			...tile,
			quality: tile.isVideo ? videoQuality : imageQuality
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
		if (progressLabel) progressLabel.textContent = `Downloading 0 / ${total}…`;
		if (progressFill) progressFill.style.width = "0%";
		controls?.classList.add("cdm-visible");
		pauseButton?.classList.remove("cdm-paused");
		if (pauseLabel) pauseLabel.textContent = "Pause";
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
			while (isPaused && !shouldStop) await h(150);
			if (shouldStop) {
				console.log("[CDM] Download stopped while paused");
				break;
			}
			console.log(`[CDM] Downloading tile ${tile.tileId} (quality: ${tile.quality})`);
			tile.tileEl.scrollIntoView({
				behavior: "smooth",
				block: "center",
				inline: "nearest"
			});
			await h(350);
			await downloadTileViaUI(tile.tileEl, tile.quality);
			completed += 1;
			if (progressLabel) progressLabel.textContent = `Downloading ${completed} / ${total}…`;
			if (progressFill) progressFill.style.width = `${Math.round(completed / total * 100)}%`;
			await h(400);
		}
		const wasStopped = shouldStop;
		isDownloadRunActive = false;
		isPaused = false;
		shouldStop = false;
		queuedTiles = [];
		controls?.classList.remove("cdm-visible");
		pauseButton?.classList.remove("cdm-paused");
		if (pauseLabel) pauseLabel.textContent = "Pause";
		document.getElementById("cdm-paused-badge")?.classList.remove("cdm-visible");
		if (progressLabel) {
			progressLabel.style.opacity = "";
			progressLabel.textContent = wasStopped ? `⛔ Stopped after ${completed} / ${total}` : `✅ Downloaded ${completed} / ${total} complete`;
		}
		if (progressFill) progressFill.style.width = wasStopped ? `${Math.round(completed / total * 100)}%` : "100%";
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
		}, 3e3);
	}
	function applyTheme(isDarkMode) {
		const panel = document.getElementById(CONTROL_PANEL_ID);
		if (!panel) return;
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
		if (themeListener) return;
		themeListener = (changes, areaName) => {
			if (areaName !== "local" || !("darkMode" in changes)) return;
			applyTheme(changes.darkMode.newValue !== false);
		};
		try {
			chrome.storage.onChanged.addListener(themeListener);
		} catch {}
	}
	function detachThemeListener() {
		if (!themeListener) return;
		try {
			chrome.storage.onChanged.removeListener(themeListener);
		} catch {}
		themeListener = null;
	}
	function activate() {
		if (isActiveFlag) return;
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
	function deactivate() {
		if (!isActiveFlag) return;
		isActiveFlag = false;
		console.log("[CDM] Deactivating Content Download Manager");
		detachObserver();
		detachThemeListener();
		removeOverlays();
		const panel = document.getElementById(CONTROL_PANEL_ID);
		if (panel) panel.remove();
		selectedTileIds.clear();
		isDownloadRunActive = false;
		queuedTiles = [];
	}
	function toggle() {
		if (isActiveFlag) {
			deactivate();
			return;
		}
		activate();
	}
	function isActive() {
		return isActiveFlag;
	}
	//#endregion
	//#region src/content/index.js
	function buildContentLogContext() {
		const currentState = getState$7?.() || {};
		const currentTask = currentState.taskList?.[currentState.currentPromptIndex] || null;
		return {
			href: window.location.href,
			isProcessing: currentState.isProcessing,
			isPausing: currentState.isPausing,
			currentPromptIndex: currentState.currentPromptIndex,
			promptCount: currentState.prompts?.length || 0,
			currentTask
		};
	}
	function getFlowPageState() {
		const href = window.location.href;
		const isProjectRoute = href.includes("/project/");
		const editorReady = Boolean(document.querySelector("[data-slate-editor=\"true\"]"));
		return {
			href,
			isProjectRoute,
			editorReady,
			newProjectButtonAvailable: Boolean($("//button[.//i[normalize-space()='add_2']]")),
			canStartProcessing: isProjectRoute && editorReady
		};
	}
	function sendBridgeHeartbeat(reason) {
		if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
		chrome.runtime.sendMessage({
			action: "flowTabHeartbeat",
			reason,
			href: window.location.href,
			timestamp: Date.now(),
			sessionId: getContentSessionId?.() || null
		}).catch(() => {});
	}
	installConsoleCapture({ getBaseContext: buildContentLogContext });
	installGlobalErrorLogging({ getBaseContext: buildContentLogContext });
	logEvent("content.bootstrap", "Flow content script bootstrap started", {
		href: window.location.href,
		sessionId: getContentSessionId()
	});
	init$7(getState$7);
	init$6(getState$7);
	init$5(getState$7, setState$4);
	init$4(getState$7);
	init$3({
		getState: getState$7,
		setState: setState$4,
		getSelectors: () => SELECTORS,
		eventBus: eventBus_exports,
		stateManager: stateManager_exports
	});
	init$2({
		getState: getState$7,
		setState: setState$4,
		eventBus: eventBus_exports,
		monitoring: monitoring_exports,
		stateManager: stateManager_exports
	});
	init$1({
		stateManager: stateManager_exports,
		eventBus: eventBus_exports,
		monitoring: monitoring_exports
	});
	init(stateManager_exports, eventBus_exports);
	init$8(eventBus_exports, contentDownloadManager_exports);
	function buildUnifiedQueueTasks(queueTasks) {
		return queueTasks.map((task) => ({
			queueTaskId: task.id,
			index: task.index,
			prompt: task.prompt,
			type: task.type,
			status: "pending",
			expectedVideos: parseInt(task.settings?.count, 10) || 1,
			foundVideos: 0,
			videoUrls: [],
			settings: task.settings,
			referenceImages: task.referenceImages || null
		}));
	}
	function buildLegacyTasks(message, nextSettings) {
		const prompts = message.prompts || [];
		const taskSettings = message.taskSettings || [];
		const processingMode = message.processingMode || "createvideo";
		const imagePairs = message.imagePairs || [];
		if (processingMode === "image" && imagePairs.length > 0) return imagePairs.map((pair, index) => ({
			index: index + 1,
			prompt: pair.prompt,
			image: pair.image,
			type: "image-to-video",
			status: "pending",
			expectedVideos: parseInt(pair.settings?.count, 10) || 1,
			foundVideos: 0,
			videoUrls: [],
			settings: pair.settings
		}));
		return prompts.map((prompt, index) => {
			const taskSetting = taskSettings[index] || {
				count: nextSettings.flowVideoCount,
				model: nextSettings.flowModel,
				aspectRatio: nextSettings.flowAspectRatio
			};
			return {
				index: index + 1,
				prompt,
				type: "createvideo",
				status: "pending",
				expectedVideos: parseInt(taskSetting.count || taskSetting.videoCount, 10) || 1,
				foundVideos: 0,
				videoUrls: [],
				settings: taskSetting
			};
		});
	}
	async function restorePausedState(sendResponse, ack) {
		const storedState = await loadStateFromStorage();
		if (!storedState || storedState.status !== "paused") {
			logEvent("processing.resume_failed", "Resume requested without paused state", { storedStateStatus: storedState?.status || null }, "warn");
			sendResponse({
				...ack,
				error: "No paused state to resume"
			});
			return;
		}
		setState$4({
			prompts: storedState.prompts || [],
			currentPromptIndex: storedState.currentIndex || 0,
			settings: storedState.settings || getSettings(),
			taskList: storedState.taskList || [],
			currentTaskIndex: storedState.currentTaskIndex || 0,
			isProcessing: true
		});
		setState$4({ isPausing: false });
		chrome.runtime.sendMessage({
			action: "setPageZoom",
			zoomFactor: FLOW_PAGE_ZOOM_FACTOR
		}).catch(() => {});
		console.log(`▶️ Resuming Flow from prompt ${getState$7().currentPromptIndex + 1}/${getState$7().prompts.length}`);
		console.log(`📋 Restored ${getState$7().taskList.length} tasks`);
		logEvent("processing.resumed", "Flow processing resumed from paused state", {
			taskCount: getState$7().taskList.length,
			currentPromptIndex: getState$7().currentPromptIndex
		});
		saveStateToStorage();
		getState$7().taskList.forEach((task) => sendTaskUpdate(task));
		emit(EVENTS.QUEUE_NEXT);
		sendResponse({
			...ack,
			resumed: true
		});
	}
	async function restoreAfterCacheClean(sendResponse, ack) {
		const storedState = await loadStateFromStorage();
		if (!storedState || !["running", "paused"].includes(storedState.status) || !storedState.prompts?.length) {
			console.warn("⚠️ resumeAfterCacheClean: no valid saved state found — cannot auto-resume");
			logEvent("processing.resume_after_cache_clean_failed", "Resume after cache clean failed because state was unavailable", { storedStateStatus: storedState?.status || null }, "warn");
			sendResponse({
				...ack,
				error: "No valid saved state"
			});
			return;
		}
		setState$4({
			prompts: storedState.prompts || [],
			currentPromptIndex: storedState.currentIndex || 0,
			settings: storedState.settings || getSettings(),
			taskList: storedState.taskList || [],
			currentTaskIndex: storedState.currentTaskIndex || 0,
			isProcessing: true,
			isPausing: false,
			lastAppliedSettings: null,
			lastAppliedMode: null
		});
		chrome.runtime.sendMessage({
			action: "setPageZoom",
			zoomFactor: FLOW_PAGE_ZOOM_FACTOR
		}).catch(() => {});
		saveStateToStorage();
		getState$7().taskList.forEach((task) => sendTaskUpdate(task));
		console.log(`🔄 resumeAfterCacheClean: restored ${getState$7().taskList.length} tasks, resuming from index ${getState$7().currentPromptIndex}`);
		logEvent("processing.resumed_after_cache_clean", "Flow processing resumed after cache clean", {
			taskCount: getState$7().taskList.length,
			currentPromptIndex: getState$7().currentPromptIndex
		});
		emit(EVENTS.QUEUE_NEXT);
		sendResponse({
			...ack,
			resumed: true
		});
	}
	function clickNewProjectButton(sendResponse) {
		try {
			const button = $("//button[.//i[normalize-space()='add_2']]");
			if (!button) {
				console.warn("⚠️ New project button not found");
				sendResponse({
					success: false,
					error: "Button not found",
					state: getFlowPageState()
				});
				return;
			}
			console.log("✅ New project button found. Clicking...");
			button.click();
			sendResponse({
				success: true,
				state: getFlowPageState()
			});
		} catch (error) {
			console.error("❌ Error clicking new project button:", error);
			sendResponse({
				success: false,
				error: error.message,
				state: getFlowPageState()
			});
		}
	}
	chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
		const ack = { received: true };
		if (message.action === "startProcessing") {
			logEvent("processing.start_requested", "Start processing request received", {
				useUnifiedQueue: Boolean(message.useUnifiedQueue),
				queueTaskCount: message.queueTasks?.length || 0,
				promptCount: message.prompts?.length || 0,
				settings: message.settings || {}
			});
			verifyAuthenticationState().then((authState) => {
				if (!authState.isLoggedIn) {
					const error = authState.error || "Authentication required. Please sign in first.";
					logEvent("processing.start_rejected", error, { authState }, "warn");
					chrome.runtime.sendMessage({
						action: "error",
						error
					});
					sendResponse({
						...ack,
						error
					});
					return;
				}
				if (getState$7().isProcessing) {
					logEvent("processing.start_ignored", "Start request ignored because processing is already active", { currentPromptIndex: getState$7().currentPromptIndex }, "warn");
					sendResponse({
						...ack,
						error: "Already processing"
					});
					return;
				}
				const incomingSettings = message.settings || {};
				const currentSettings = getSettings();
				const nextSettings = {
					...currentSettings,
					...incomingSettings,
					flowVideoCount: incomingSettings.flowVideoCount || currentSettings.flowVideoCount,
					flowModel: incomingSettings.flowModel || currentSettings.flowModel,
					flowAspectRatio: incomingSettings.flowAspectRatio || currentSettings.flowAspectRatio
				};
				setState$4({
					settings: nextSettings,
					isProcessing: true,
					currentPromptIndex: 0,
					currentTaskIndex: 0,
					lastAppliedSettings: null,
					lastAppliedMode: null,
					fallbackModel: null
				});
				let taskList;
				let prompts;
				if (message.useUnifiedQueue && Array.isArray(message.queueTasks) && message.queueTasks.length > 0) {
					console.log("🎯 Using UNIFIED QUEUE system");
					taskList = buildUnifiedQueueTasks(message.queueTasks);
					prompts = taskList.map((task) => task.prompt);
					console.log(`✅ Created ${taskList.length} tasks from unified queue (${taskList.filter((task) => task.type === "createvideo").length} video, ${taskList.filter((task) => task.type === "createimage").length} image)`);
				} else {
					console.log("⚠️ Using LEGACY task system");
					taskList = buildLegacyTasks(message, nextSettings);
					prompts = taskList.map((task) => task.prompt);
					console.log(`✅ Created ${taskList.length} tasks from legacy flow`);
				}
				setState$4({
					taskList,
					prompts
				});
				saveStateToStorage();
				logEvent("processing.started", "Flow processing started", {
					mode: message.useUnifiedQueue ? "unified" : "legacy",
					taskCount: taskList.length,
					prompts,
					taskList
				});
				emit(EVENTS.QUEUE_NEXT);
				sendResponse({
					...ack,
					started: true
				});
			}).catch((error) => {
				const messageText = error?.message || "Could not start processing. Please try again.";
				logError("processing.start_exception", error, { requestedMode: message.useUnifiedQueue ? "unified" : "legacy" });
				chrome.runtime.sendMessage({
					action: "error",
					error: messageText
				});
				sendResponse({
					...ack,
					error: messageText
				});
			});
			return true;
		}
		if (message.action === "resumeProcessing") {
			logEvent("processing.resume_requested", "Resume processing requested");
			restorePausedState(sendResponse, ack);
			return true;
		}
		if (message.action === "resumeAfterCacheClean") {
			logEvent("processing.resume_after_cache_clean_requested", "Resume after cache clean requested");
			restoreAfterCacheClean(sendResponse, ack);
			return true;
		}
		if (message.action === "stopProcessing") {
			logEvent("processing.pause_requested", "Pause processing requested", { currentPromptIndex: getState$7().currentPromptIndex });
			emit(EVENTS.PROCESSING_STOP);
			clearCountdownTimer$1();
			setState$4({
				isProcessing: false,
				isPausing: true
			});
			chrome.runtime.sendMessage({ action: "resetPageZoom" }).catch(() => {});
			saveStateToStorage();
			if (getState$7().isCurrentPromptProcessed) {
				setState$4({ isPausing: false });
				emit(EVENTS.OVERLAY_HIDE);
				chrome.runtime.sendMessage({
					action: "updateStatus",
					status: "Processing paused. Click Resume to continue."
				});
			} else {
				emit(EVENTS.OVERLAY_PAUSING);
				chrome.runtime.sendMessage({
					action: "updateStatus",
					status: "Flow will pause after current prompt completes..."
				});
			}
			sendResponse(ack);
			return false;
		}
		if (message.action === "terminateProcessing") {
			logEvent("processing.terminate_requested", "Terminate processing requested", {
				currentPromptIndex: getState$7().currentPromptIndex,
				pendingTasks: getState$7().taskList?.length || 0
			}, "warn");
			chrome.runtime.sendMessage({ action: "resetPageZoom" }).catch(() => {});
			setState$4({
				isProcessing: false,
				isPausing: false,
				prompts: [],
				currentPromptIndex: 0,
				taskList: [],
				currentTaskIndex: 0,
				lastAppliedSettings: null,
				lastAppliedMode: null,
				fallbackModel: null
			});
			clearStateFromStorage();
			emit(EVENTS.PROCESSING_TERMINATE);
			emit(EVENTS.OVERLAY_HIDE);
			sendResponse({
				...ack,
				terminated: true
			});
			return false;
		}
		if (message.action === "getStoredState") {
			loadStateFromStorage().then((storedState) => {
				sendResponse({
					...ack,
					state: storedState
				});
			});
			return true;
		}
		if (message.action === "authStateChanged") {
			setState$4({
				isUserLoggedIn: message.isLoggedIn,
				subscriptionStatus: message.subscriptionStatus,
				userId: message.userId
			});
			sendResponse({ success: true });
			return false;
		}
		if (message.action === "activateContentDownloader") {
			toggle();
			sendResponse({
				...ack,
				toggled: true
			});
			return false;
		}
		if (message.action === "getFlowPageState") {
			sendResponse({
				...ack,
				state: getFlowPageState()
			});
			return false;
		}
		if (message.action === "clickNewProjectButton") {
			clickNewProjectButton(sendResponse);
			return true;
		}
		if (message.action === "pingFlowContent") {
			sendResponse({ pong: true });
			return false;
		}
		sendResponse(ack);
		return false;
	});
	document.addEventListener("visibilitychange", () => {
		if (document.hidden) return;
		sendBridgeHeartbeat("visibilitychange");
		setTimeout(() => {
			verifyAuthenticationState().then((authState) => {
				chrome.runtime.sendMessage({
					action: "authStateRefreshed",
					authState
				}).catch(() => {});
			});
		}, 500);
	});
	window.addEventListener("focus", () => {
		sendBridgeHeartbeat("window-focus");
		setTimeout(() => {
			verifyAuthenticationState().then((authState) => {
				chrome.runtime.sendMessage({
					action: "authStateRefreshed",
					authState
				}).catch(() => {});
			});
		}, 500);
	});
	chrome.runtime.sendMessage({ action: "getAuthState" }, (response) => {
		if (!response) return;
		setState$4({
			isUserLoggedIn: response.isLoggedIn,
			subscriptionStatus: response.subscriptionStatus
		});
	});
	console.log("✅ Flow Automation bootstrap complete — all modules wired");
	console.log("📦 Layers: core | interactions (+ imageUploader) | workflow | ui (+ contentDownloadManager)");
	logEvent("content.bootstrap_complete", "Flow automation bootstrap complete", { href: window.location.href });
	sendBridgeHeartbeat("bootstrap-complete");
	//#endregion
})();
