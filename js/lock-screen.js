"use strict";

(() => {
  const state = {
    initialized: false,
    unlocked: false,
    dragging: false,
    startY: 0,
    lastY: 0,
    pointerId: null,
    backgroundUrl: "",
    onUnlock: null,
  };

  const elements = {};

  function byId(id) {
    return document.getElementById(id);
  }

  function formatTime(date) {
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(date);
  }

  function updateClock() {
    const now = new Date();
    if (elements.clock) elements.clock.textContent = formatTime(now);
    if (elements.date) elements.date.textContent = formatDate(now);
  }

  function setDragOffset(offset) {
    if (!elements.screen) return;
    elements.screen.style.setProperty("--lock-drag-y", `${Math.min(0, offset)}px`);
    elements.screen.classList.toggle("is-dragging", state.dragging);
  }

  function resetDrag() {
    state.dragging = false;
    state.pointerId = null;
    if (!elements.screen) return;
    elements.screen.classList.remove("is-dragging");
    elements.screen.style.setProperty("--lock-drag-y", "0px");
  }

  function unlock() {
    if (!state.initialized || state.unlocked) return;
    state.unlocked = true;
    resetDrag();
    elements.screen.classList.add("is-unlocking");
    elements.screen.setAttribute("aria-hidden", "true");
    elements.screen.setAttribute("tabindex", "-1");
    window.setTimeout(() => {
      elements.screen.classList.add("is-unlocked");
      if (typeof state.onUnlock === "function") state.onUnlock();
    }, 240);
  }

  function handlePointerDown(event) {
    if (state.unlocked || (event.pointerType === "mouse" && event.button !== 0)) return;
    state.dragging = true;
    state.startY = event.clientY;
    state.lastY = event.clientY;
    state.pointerId = event.pointerId;
    if (elements.screen.setPointerCapture) {
      elements.screen.setPointerCapture(event.pointerId);
    }
    setDragOffset(0);
    event.preventDefault();
  }

  function handlePointerMove(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;
    state.lastY = event.clientY;
    setDragOffset(event.clientY - state.startY);
    event.preventDefault();
  }

  function finishPointer(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;
    const distance = event.clientY - state.startY;
    if (distance <= -78) {
      unlock();
      return;
    }
    resetDrag();
  }

  function handleKeyDown(event) {
    if (state.unlocked) return;
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      unlock();
    }
  }

  function setBackground(url) {
    state.backgroundUrl = url || "";
    if (!elements.background) return;
    elements.background.classList.toggle("has-image", Boolean(state.backgroundUrl));
    elements.background.style.backgroundImage = state.backgroundUrl
      ? `linear-gradient(180deg, rgba(31, 50, 57, 0.08), rgba(31, 50, 57, 0.34)), url("${state.backgroundUrl}")`
      : "";
  }

  function show() {
    if (!elements.screen) return;
    state.unlocked = false;
    resetDrag();
    elements.screen.classList.remove("is-unlocked", "is-unlocking");
    elements.screen.removeAttribute("aria-hidden");
    elements.screen.setAttribute("tabindex", "0");
    updateClock();
    window.setTimeout(() => {
      if (!state.unlocked && elements.screen) {
        elements.screen.focus({ preventScroll: true });
      }
    }, 0);
  }

  function init(options = {}) {
    if (state.initialized) return;
    state.initialized = true;
    state.onUnlock = options.onUnlock || null;
    elements.screen = byId("lock-screen");
    elements.background = byId("lock-screen-background");
    elements.clock = byId("lock-clock");
    elements.date = byId("lock-date");
    elements.unlockHint = byId("lock-unlock-hint");

    if (!elements.screen) return;
    elements.screen.addEventListener("pointerdown", handlePointerDown);
    elements.screen.addEventListener("pointermove", handlePointerMove);
    elements.screen.addEventListener("pointerup", finishPointer);
    elements.screen.addEventListener("pointercancel", finishPointer);
    elements.screen.addEventListener("lostpointercapture", () => {
      if (state.dragging) resetDrag();
    });
    elements.screen.addEventListener("keydown", handleKeyDown);
    if (elements.unlockHint) {
      elements.unlockHint.addEventListener("click", unlock);
    }
    setBackground(options.backgroundUrl || "");
    updateClock();
    show();
  }

  window.PocketLabLockScreen = {
    init,
    show,
    unlock,
    setBackground,
    updateClock,
    get isUnlocked() {
      return state.unlocked;
    },
  };
})();
