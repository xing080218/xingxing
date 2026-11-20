"use strict";

(() => {
  const APP_ID = "beautify.settings.v1";
  const IMAGE_IDS = Object.freeze({
    home: "beautify-home-wallpaper",
    lock: "beautify-lock-wallpaper",
    chat: "beautify-chat-wallpaper",
  });

  const DEFAULTS = Object.freeze({
    version: 1,
    backgrounds: Object.freeze({
      home: "",
      lock: "",
      chat: "",
    }),
    globalFontSize: 14,
    chatBubbleFontSize: 14,
  });

  const FONT_LIMITS = Object.freeze({
    global: Object.freeze({ min: 12, max: 20 }),
    chat: Object.freeze({ min: 11, max: 24 }),
  });

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function sanitize(value) {
    const source = value && typeof value === "object" ? value : {};
    const backgrounds =
      source.backgrounds && typeof source.backgrounds === "object"
        ? source.backgrounds
        : {};
    const pickImageId = (key) =>
      typeof backgrounds[key] === "string" ? backgrounds[key].trim().slice(0, 200) : "";

    return {
      version: 1,
      backgrounds: {
        home: pickImageId("home"),
        lock: pickImageId("lock"),
        chat: pickImageId("chat"),
      },
      globalFontSize: clampNumber(
        source.globalFontSize,
        FONT_LIMITS.global.min,
        FONT_LIMITS.global.max,
        DEFAULTS.globalFontSize,
      ),
      chatBubbleFontSize: clampNumber(
        source.chatBubbleFontSize,
        FONT_LIMITS.chat.min,
        FONT_LIMITS.chat.max,
        DEFAULTS.chatBubbleFontSize,
      ),
    };
  }

  async function load() {
    const record = await window.PocketLabStorage.getAppData(APP_ID);
    return sanitize(record && record.data);
  }

  async function save(value) {
    const normalized = sanitize(value);
    await window.PocketLabStorage.saveAppData(APP_ID, normalized);
    return normalized;
  }

  window.PocketLabAppearance = {
    APP_ID,
    IMAGE_IDS,
    DEFAULTS,
    FONT_LIMITS,
    sanitize,
    load,
    save,
  };
})();
