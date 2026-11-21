"use strict";

(() => {
  const PIN_LENGTH = 4;
  const state = {
    initialized: false,
    unlocked: false,
    mode: "idle",
    dragging: false,
    startY: 0,
    lastY: 0,
    pointerId: null,
    pin: "",
    verifying: false,
    backgroundUrl: "",
    onUnlock: null,
    feedbackTimer: null,
    unlockTimer: null,
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

  function clearFeedbackTimer() {
    if (state.feedbackTimer) {
      window.clearTimeout(state.feedbackTimer);
      state.feedbackTimer = null;
    }
  }

  function renderPin() {
    const count = state.pin.length;
    if (elements.pinDots) {
      Array.from(elements.pinDots.children).forEach((dot, index) => {
        dot.classList.toggle("is-filled", index < count);
      });
      elements.pinDots.setAttribute("aria-label", `已输入${count}位密码`);
    }
  }

  function setKeypadDisabled(disabled) {
    if (!elements.keypad) return;
    elements.keypad.querySelectorAll("button").forEach((button) => {
      button.disabled = disabled;
    });
  }

  function clearPinError() {
    if (elements.pinError) elements.pinError.textContent = "";
    if (elements.pinMessage) {
      elements.pinMessage.textContent = "请输入四位数字密码";
      elements.pinMessage.classList.remove("is-error");
    }
    if (elements.screen) elements.screen.classList.remove("is-rejected");
  }

  function showPinError(message, shouldShake = true) {
    clearFeedbackTimer();
    if (elements.pinError) elements.pinError.textContent = message;
    if (elements.pinMessage) {
      elements.pinMessage.textContent = "请重新输入锁屏密码";
      elements.pinMessage.classList.add("is-error");
    }
    if (elements.screen && shouldShake) {
      elements.screen.classList.add("is-rejected");
      state.feedbackTimer = window.setTimeout(() => {
        if (elements.screen) elements.screen.classList.remove("is-rejected");
      }, 420);
    }
  }

  function resetPin() {
    state.pin = "";
    state.verifying = false;
    clearFeedbackTimer();
    clearPinError();
    setKeypadDisabled(false);
    renderPin();
  }

  function enterPinMode(message = "") {
    if (!elements.screen || state.unlocked) return;
    state.mode = "pin";
    resetDrag();
    resetPin();
    elements.screen.classList.add("is-pin-entry");
    elements.screen.setAttribute("aria-label", "锁屏密码，输入四位数字解锁");
    if (elements.pinLayer) elements.pinLayer.setAttribute("aria-hidden", "false");
    if (elements.unlockHint) elements.unlockHint.setAttribute("tabindex", "-1");
    if (message) showPinError(message, false);
  }

  function leavePinMode() {
    if (state.unlocked || state.mode !== "pin") return;
    state.mode = "idle";
    state.pin = "";
    state.verifying = false;
    clearFeedbackTimer();
    clearPinError();
    setKeypadDisabled(false);
    renderPin();
    elements.screen.classList.remove("is-pin-entry", "is-rejected");
    elements.screen.setAttribute("aria-label", "锁屏，向上滑动解锁");
    if (elements.pinLayer) elements.pinLayer.setAttribute("aria-hidden", "true");
    if (elements.unlockHint) elements.unlockHint.removeAttribute("tabindex");
    try {
      elements.screen.focus({ preventScroll: true });
    } catch {
      elements.screen.focus();
    }
  }

  function completeUnlock() {
    if (!state.initialized || state.unlocked) return;
    state.unlocked = true;
    state.mode = "idle";
    state.verifying = false;
    clearFeedbackTimer();
    resetDrag();
    elements.screen.classList.remove("is-pin-entry", "is-rejected");
    elements.screen.classList.add("is-unlocking");
    elements.screen.setAttribute("aria-hidden", "true");
    elements.screen.setAttribute("tabindex", "-1");
    if (elements.pinLayer) elements.pinLayer.setAttribute("aria-hidden", "true");
    state.unlockTimer = window.setTimeout(() => {
      if (!state.unlocked || !elements.screen) return;
      elements.screen.classList.add("is-unlocked");
      if (typeof state.onUnlock === "function") state.onUnlock();
    }, 240);
  }

  function requestUnlock() {
    if (!state.initialized || state.unlocked) return;
    const passwordStore = window.PocketLabLockPassword;
    if (!passwordStore) {
      enterPinMode("密码组件没有加载，请刷新页面后重试。");
      setKeypadDisabled(true);
      return;
    }

    let passwordEnabled = true;
    try {
      passwordEnabled = passwordStore.isEnabled();
    } catch {
      enterPinMode("无法读取密码设置，请刷新页面后重试。");
      setKeypadDisabled(true);
      return;
    }

    if (!passwordEnabled) {
      completeUnlock();
      return;
    }
    enterPinMode();
  }

  async function submitPassword(value) {
    const pin = String(value || "");
    if (
      !state.initialized ||
      state.unlocked ||
      state.mode !== "pin" ||
      state.verifying ||
      !/^\d{4}$/.test(pin)
    ) {
      if (state.mode === "pin" && !state.verifying && pin.length < PIN_LENGTH) {
        showPinError("请输入完整的四位数字密码。", false);
      }
      return false;
    }

    const passwordStore = window.PocketLabLockPassword;
    if (!passwordStore) {
      showPinError("密码组件没有加载，请刷新页面后重试。");
      return false;
    }

    state.verifying = true;
    clearPinError();
    setKeypadDisabled(true);

    let valid = false;
    try {
      valid = await passwordStore.verifyPassword(pin);
    } catch {
      state.verifying = false;
      setKeypadDisabled(false);
      showPinError("无法验证密码，请刷新页面后重试。");
      return false;
    }

    if (state.unlocked || state.mode !== "pin") return false;
    if (valid) {
      state.verifying = false;
      completeUnlock();
      return true;
    }

    state.verifying = false;
    state.pin = "";
    renderPin();
    setKeypadDisabled(false);
    showPinError("密码错误，请重新输入。");
    return false;
  }

  function appendDigit(digit) {
    if (
      state.mode !== "pin" ||
      state.unlocked ||
      state.verifying ||
      !/^\d$/.test(String(digit)) ||
      state.pin.length >= PIN_LENGTH
    ) {
      return false;
    }
    state.pin += String(digit);
    renderPin();
    if (state.pin.length === PIN_LENGTH) {
      void submitPassword(state.pin);
    }
    return true;
  }

  function deleteDigit() {
    if (state.mode !== "pin" || state.unlocked || state.verifying || !state.pin) return false;
    state.pin = state.pin.slice(0, -1);
    clearPinError();
    renderPin();
    return true;
  }

  function handlePointerDown(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (
      state.unlocked ||
      state.mode !== "idle" ||
      (event.pointerType === "mouse" && event.button !== 0) ||
      (target && target.closest("button, .lock-pin-layer"))
    ) {
      return;
    }
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
      requestUnlock();
      return;
    }
    resetDrag();
  }

  function handleKeyDown(event) {
    if (state.unlocked) return;

    if (state.mode === "pin") {
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        appendDigit(event.key);
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        deleteDigit();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        leavePinMode();
        return;
      }
      if (event.key === "Enter" && state.pin.length === PIN_LENGTH) {
        event.preventDefault();
        void submitPassword(state.pin);
      }
      return;
    }

    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      requestUnlock();
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
    if (state.unlockTimer) {
      window.clearTimeout(state.unlockTimer);
      state.unlockTimer = null;
    }
    state.unlocked = false;
    state.mode = "idle";
    state.pin = "";
    state.verifying = false;
    resetDrag();
    clearFeedbackTimer();
    clearPinError();
    renderPin();
    setKeypadDisabled(false);
    elements.screen.classList.remove("is-unlocked", "is-unlocking", "is-pin-entry", "is-rejected");
    elements.screen.removeAttribute("aria-hidden");
    elements.screen.setAttribute("aria-label", "锁屏，向上滑动解锁");
    elements.screen.setAttribute("tabindex", "0");
    if (elements.pinLayer) elements.pinLayer.setAttribute("aria-hidden", "true");
    if (elements.unlockHint) elements.unlockHint.removeAttribute("tabindex");
    updateClock();
    window.setTimeout(() => {
      if (!state.unlocked && elements.screen) {
        try {
          elements.screen.focus({ preventScroll: true });
        } catch {
          elements.screen.focus();
        }
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
    elements.pinLayer = byId("lock-pin-layer");
    elements.pinBack = byId("lock-pin-back");
    elements.pinDots = byId("lock-pin-dots");
    elements.pinMessage = byId("lock-pin-message");
    elements.pinError = byId("lock-pin-error");
    elements.keypad = byId("lock-keypad");
    elements.pinDelete = byId("lock-pin-delete");

    if (!elements.screen) return;
    elements.screen.addEventListener("pointerdown", handlePointerDown);
    elements.screen.addEventListener("pointermove", handlePointerMove);
    elements.screen.addEventListener("pointerup", finishPointer);
    elements.screen.addEventListener("pointercancel", () => {
      if (state.dragging) resetDrag();
    });
    elements.screen.addEventListener("lostpointercapture", () => {
      if (state.dragging) resetDrag();
    });
    elements.screen.addEventListener("keydown", handleKeyDown);
    if (elements.unlockHint) {
      elements.unlockHint.addEventListener("click", requestUnlock);
    }
    if (elements.pinBack) {
      elements.pinBack.addEventListener("click", leavePinMode);
    }
    if (elements.keypad) {
      elements.keypad.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const key = target ? target.closest("[data-pin-key]") : null;
        if (key) appendDigit(key.dataset.pinKey);
      });
    }
    if (elements.pinDelete) {
      elements.pinDelete.addEventListener("click", deleteDigit);
    }
    setBackground(options.backgroundUrl || "");
    updateClock();
    show();
  }

  window.PocketLabLockScreen = {
    init,
    show,
    unlock: requestUnlock,
    requestUnlock,
    submitPassword,
    appendDigit,
    deleteDigit,
    setBackground,
    updateClock,
    get isUnlocked() {
      return state.unlocked;
    },
    get isPasswordStep() {
      return state.mode === "pin";
    },
  };
})();
