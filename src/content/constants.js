export const SELECTORS = {
  PROMPT_POLICY_ERROR_POPUP_XPATH:
    "//li[@data-sonner-toast and .//i[normalize-space(text())='error'] and not(.//*[contains(., '5')])]",
  QUEUE_FULL_POPUP_XPATH:
    "//li[@data-sonner-toast and .//i[normalize-space(text())='error'] and .//*[contains(., '5')]]",
};

export const STORAGE_KEY = "flowAutomationState";

export const MODEL_DISPLAY_NAMES = {
  default: "Veo 3.1 - Fast",
  veo3_fast: "Veo 3.1 - Fast",
  veo3_quality: "Veo 3.1 - Quality",
  veo2_fast: "Veo 2 - Fast",
  veo2_quality: "Veo 2 - Quality",
  veo3_fast_low: "Veo 3.1 - Fast",
  nano_banana_pro: "Nano Banana Pro",
  nano_banana2: "Nano Banana 2",
  nano_banana: "Nano Banana 2",
  imagen4: "Imagen 4",
};

export const MONITORING_TIMEOUTS = {
  IMAGE_STALL: 30_000,
  IMAGE_ZERO_TILES: 60_000,
  VIDEO_STALL: 90_000,
  VIDEO_ZERO_TILES: 180_000,
};

export const STEALTH_PASTE_THRESHOLD = 120;

export const DEFAULT_SETTINGS = {
  autoDownload: true,
  delayBetweenPrompts: 8_000,
  delayMin: 15,
  delayMax: 30,
  flowVideoCount: "1",
  flowModel: "default",
  flowAspectRatio: "landscape",
  imageDownloadQuality: "1K",
  videoDownloadQuality: "720p",
  autoClearCache: false,
  autoClearCacheInterval: 50,
};

export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 5_000;
export const INTER_TASK_DELAY_FALLBACK_MS = 15_000;
export const DEFAULT_SCAN_INTERVAL_MS = 5_000;
export const FLOW_PAGE_ZOOM_FACTOR = 0.75;

export const IMAGE_UPLOADER_DELAYS = {
  UPLOAD_BETWEEN_FILES: 500,
  UPLOAD_SETTLE: 3_000,
  SEARCH_POLL: 300,
  SEARCH_SETTLE: 400,
  AFTER_ATTACH: 500,
};

export const IMAGE_UPLOADER_TIMEOUTS = {
  PICKER_OPEN: 8_000,
  SEARCH_RESULT: 15_000,
  PICKER_CLOSE: 8_000,
  LIBRARY_SEARCH: 5_000,
};

export const DOWNLOAD_QUALITY_DEFAULTS = {
  image: "1K",
  video: "720p",
};
