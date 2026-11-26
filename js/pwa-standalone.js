"use strict";

(() => {
  const root = document.documentElement;
  const displayMode = window.matchMedia?.("(display-mode: standalone)");
  const standalone =
    window.navigator.standalone === true || displayMode?.matches === true;
  root.classList.toggle("pwa-standalone", standalone);

  if (!standalone) {
    return;
  }

  const isIos =
    /iP(ad|hone|od)/.test(window.navigator.userAgent) ||
    (window.navigator.platform === "MacIntel" &&
      window.navigator.maxTouchPoints > 1);

  if (!isIos) {
    return;
  }

  const MAX_BOTTOM_COVER = 80;
  let pendingMeasure = 0;
  let lastCover = -1;

  function hasFocusedEditor() {
    const activeElement = document.activeElement;
    return Boolean(
      activeElement?.matches?.(
        "input, textarea, select, [contenteditable='true']",
      ),
    );
  }

  function measureBottomCover() {
    pendingMeasure = 0;

    if (document.visibilityState === "hidden" || hasFocusedEditor()) {
      return;
    }

    const screenHeight = Number(window.screen?.height);
    const viewportHeight =
      document.documentElement.clientHeight || window.innerHeight || 0;

    if (!Number.isFinite(screenHeight) || viewportHeight <= 0) {
      return;
    }

    const measuredGap = Math.round(screenHeight - viewportHeight);
    const bottomCover =
      measuredGap > 0 && measuredGap <= MAX_BOTTOM_COVER ? measuredGap : 0;

    if (bottomCover === lastCover) {
      return;
    }

    lastCover = bottomCover;
    root.style.setProperty(
      "--pwa-measured-bottom-cover",
      `${bottomCover}px`,
    );
    root.dataset.pwaBottomCover = String(bottomCover);
  }

  function scheduleMeasure(delay = 0) {
    if (pendingMeasure) {
      window.clearTimeout(pendingMeasure);
    }

    pendingMeasure = window.setTimeout(() => {
      window.requestAnimationFrame(measureBottomCover);
    }, delay);
  }

  scheduleMeasure();
  window.addEventListener("resize", () => scheduleMeasure(60), {
    passive: true,
  });
  window.addEventListener("pageshow", () => scheduleMeasure(), {
    passive: true,
  });
  window.addEventListener("load", () => scheduleMeasure(), { once: true });
  window.addEventListener("orientationchange", () => scheduleMeasure(300), {
    passive: true,
  });
  window.visualViewport?.addEventListener("resize", () => scheduleMeasure(80), {
    passive: true,
  });
  document.addEventListener("focusout", () => scheduleMeasure(80));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      scheduleMeasure();
    }
  });
})();
