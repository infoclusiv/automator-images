function hasCompletedMedia(tileElement) {
  return Boolean(
    tileElement.querySelector('video[src*="media.getMediaUrlRedirect"]') ||
      tileElement.querySelector('img[src*="media.getMediaUrlRedirect"]'),
  );
}

export function hasIcon(element, iconText) {
  return [...element.querySelectorAll("i")].some(
    (icon) => icon.textContent.trim() === iconText,
  );
}

export const TILE_ERROR_PATTERNS = [
  {
    type: "POLICY_VIOLATION",
    label: "Prompt flagged by content policy",
    detect(tileElement) {
      if (!hasIcon(tileElement, "warning")) {
        return false;
      }

      return [...tileElement.querySelectorAll("a[href]")].some((link) => {
        const href = link.getAttribute("href") || "";
        return href.includes("/faq") || href.includes("/policies") || href.includes("policy");
      });
    },
  },
  {
    type: "DAILY_LIMIT_MODEL_FALLBACK",
    label: "Daily generation limit reached — switching to Imagen 4",
    detect(tileElement) {
      if (!hasIcon(tileElement, "warning") || !hasIcon(tileElement, "refresh")) {
        return false;
      }

      return tileElement.textContent.includes("Nano Banana");
    },
  },
  {
    type: "GENERATION_FAILED",
    label: "Generation failed — Flow encountered an error",
    detect(tileElement) {
      if (!hasIcon(tileElement, "warning")) {
        return false;
      }

      return hasIcon(tileElement, "refresh");
    },
  },
];

const GLOBAL_ERROR_PATTERNS = [];

export function scanTileErrors(preSubmitIds, processedTileIds) {
  const errors = [];

  document.querySelectorAll("[data-tile-id]").forEach((tileElement) => {
    const tileId = tileElement.getAttribute("data-tile-id");
    if (!tileId) {
      return;
    }

    if (preSubmitIds?.has(tileId) || processedTileIds?.has(tileId) || hasCompletedMedia(tileElement)) {
      return;
    }

    for (const pattern of TILE_ERROR_PATTERNS) {
      if (!pattern.detect(tileElement)) {
        continue;
      }

      processedTileIds?.add(tileId);
      errors.push({ tileId, type: pattern.type, label: pattern.label });
      console.warn(`⚠️ ErrorScanner: tile ${tileId} — ${pattern.label}`);
      break;
    }
  });

  return {
    errorCount: errors.length,
    errors,
  };
}

export function checkGlobalErrors() {
  for (const pattern of GLOBAL_ERROR_PATTERNS) {
    if (!pattern.detect()) {
      continue;
    }

    console.error(
      `❌ ErrorScanner: global error — ${pattern.label} (severity: ${pattern.severity})`,
    );

    return {
      found: true,
      type: pattern.type,
      label: pattern.label,
      severity: pattern.severity,
    };
  }

  return {
    found: false,
    type: null,
    label: null,
    severity: null,
  };
}