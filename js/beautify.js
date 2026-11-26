"use strict";

(() => {
  const BACKGROUND_KEYS = ["home", "lock", "chat"];
  const BACKGROUND_LABELS = {
    home: "全局背景",
    lock: "锁屏背景",
    chat: "聊天背景",
  };
  const BEAUTIFY_PAGES = {
    menu: {
      eyebrow: "APPEARANCE",
      title: "美化",
      backLabel: "返回设置",
    },
    phone: {
      eyebrow: "WHOLE PHONE",
      title: "整体手机",
      backLabel: "返回美化",
    },
    layout: {
      eyebrow: "ICONS & LAYOUT",
      title: "图标布局",
      backLabel: "返回美化",
    },
    "chat-style": {
      eyebrow: "CHAT APPEARANCE",
      title: "聊天外观",
      backLabel: "返回美化",
    },
  };

  const state = {
    initialized: false,
    settings: null,
    activePage: "menu",
    backgroundUrls: {
      home: "",
      lock: "",
      chat: "",
    },
    saveTimer: null,
    saveChain: Promise.resolve(),
    onError: null,
    onSaved: null,
  };

  const elements = {};

  function byId(id) {
    return document.getElementById(id);
  }

  function cloneSettings(value) {
    return window.PocketLabAppearance.sanitize({
      ...value,
      backgrounds: {
        ...(value && value.backgrounds ? value.backgrounds : {}),
      },
    });
  }

  function cacheElements() {
    [
      "beautify-view",
      "beautify-scroll",
      "beautify-eyebrow",
      "beautify-title",
      "beautify-back",
      "beautify-status",
      "beautify-status-title",
      "beautify-status-message",
      "beautify-global-size",
      "beautify-global-size-value",
      "beautify-global-preview",
      "beautify-chat-size",
      "beautify-chat-size-value",
      "beautify-chat-preview",
      "beautify-home-file",
      "beautify-lock-file",
      "beautify-chat-file",
      "beautify-home-preview",
      "beautify-lock-preview",
      "beautify-chat-preview-wallpaper",
      "beautify-home-remove",
      "beautify-lock-remove",
      "beautify-chat-remove",
    ].forEach((id) => {
      elements[id] = byId(id);
    });
  }

  function setStatus(kind, title, message) {
    if (!elements["beautify-status"]) return;
    elements["beautify-status"].dataset.state = kind;
    elements["beautify-status-title"].textContent = title;
    elements["beautify-status-message"].textContent = message;
  }

  function describeError(error, action) {
    if (
      window.PocketLabStorage &&
      typeof window.PocketLabStorage.describeError === "function"
    ) {
      return window.PocketLabStorage.describeError(error, action);
    }
    return {
      title: `${action || "保存"}失败`,
      message:
        error && error.message
          ? String(error.message)
          : "浏览器没有返回详细原因。",
      nextStep: "请检查浏览器是否允许本网站保存数据，或释放一些本机存储空间后重试。",
    };
  }

  function reportFailure(error, action) {
    const description = describeError(error, action);
    setStatus(
      "error",
      description.title,
      `${description.message} ${description.nextStep || ""}`.trim(),
    );
    if (typeof state.onError === "function") {
      state.onError(error, action, "beautify");
    }
  }

  function notifySaved(message) {
    setStatus("success", "已保存到本机", message);
    if (typeof state.onSaved === "function") state.onSaved();
  }

  function releaseBackgroundUrl(key) {
    const url = state.backgroundUrls[key];
    if (url) window.PocketLabMedia.revokeObjectUrl(url);
    state.backgroundUrls[key] = "";
  }

  function releaseAllBackgroundUrls() {
    BACKGROUND_KEYS.forEach(releaseBackgroundUrl);
  }

  function setBackgroundUrl(key, blob) {
    releaseBackgroundUrl(key);
    state.backgroundUrls[key] = blob
      ? window.PocketLabMedia.createObjectUrl(blob)
      : "";
  }

  function applyBackgroundToPage(key) {
    const url = state.backgroundUrls[key];
    if (key === "home") {
      const screen = document.querySelector(".phone-screen");
      if (!screen) return;
      screen.style.setProperty(
        "--home-background-image",
        url ? `url("${url}")` : "none",
      );
      screen.classList.toggle("has-custom-home-background", Boolean(url));
      return;
    }

    if (key === "chat") {
      const view = byId("chat-view");
      if (!view) return;
      view.style.setProperty("--chat-background-image", url ? `url("${url}")` : "none");
      view.classList.toggle("has-custom-background", Boolean(url));
      return;
    }

    if (key === "lock" && window.PocketLabLockScreen) {
      window.PocketLabLockScreen.setBackground(url);
    }
  }

  function updateBackgroundPreview(key) {
    const previewId =
      key === "chat" ? "beautify-chat-preview-wallpaper" : `beautify-${key}-preview`;
    const removeId = `beautify-${key}-remove`;
    const preview = elements[previewId];
    const removeButton = elements[removeId];
    const url = state.backgroundUrls[key];
    if (preview) {
      preview.classList.toggle("has-image", Boolean(url));
      preview.style.backgroundImage = url ? `url("${url}")` : "";
    }
    if (removeButton) removeButton.disabled = !url;
  }

  function applyFontSettings() {
    if (!state.settings) return;
    const root = document.documentElement;
    root.style.setProperty("--global-font-size", `${state.settings.globalFontSize}px`);
    root.style.setProperty(
      "--chat-bubble-font-size",
      `${state.settings.chatBubbleFontSize}px`,
    );

    if (elements["beautify-global-size"]) {
      elements["beautify-global-size"].value = String(state.settings.globalFontSize);
    }
    if (elements["beautify-chat-size"]) {
      elements["beautify-chat-size"].value = String(state.settings.chatBubbleFontSize);
    }
    if (elements["beautify-global-size-value"]) {
      elements["beautify-global-size-value"].textContent =
        `${state.settings.globalFontSize}px`;
    }
    if (elements["beautify-chat-size-value"]) {
      elements["beautify-chat-size-value"].textContent =
        `${state.settings.chatBubbleFontSize}px`;
    }
    if (elements["beautify-global-preview"]) {
      elements["beautify-global-preview"].style.fontSize =
        `${state.settings.globalFontSize}px`;
    }
    if (elements["beautify-chat-preview"]) {
      elements["beautify-chat-preview"].style.fontSize =
        `${state.settings.chatBubbleFontSize}px`;
    }
  }

  function applyAllSettings() {
    applyFontSettings();
    BACKGROUND_KEYS.forEach((key) => {
      applyBackgroundToPage(key);
      updateBackgroundPreview(key);
    });
  }

  async function hydrateBackgroundUrls(settings) {
    const nextBlobs = await Promise.all(
      BACKGROUND_KEYS.map(async (key) => {
        const imageId = settings.backgrounds[key];
        if (!imageId) return null;
        const blob = await window.PocketLabStorage.getImageBlob(imageId);
        return blob instanceof Blob && blob.size ? blob : null;
      }),
    );

    BACKGROUND_KEYS.forEach((key, index) => {
      setBackgroundUrl(key, nextBlobs[index]);
    });
  }

  async function persistSettings(action) {
    window.clearTimeout(state.saveTimer);
    state.saveTimer = null;
    const snapshot = cloneSettings(state.settings);
    const operation = state.saveChain.then(async () => {
      const saved = await window.PocketLabAppearance.save(snapshot);
      state.settings = cloneSettings(saved);
      return state.settings;
    });
    state.saveChain = operation.catch(() => {});
    try {
      const saved = await operation;
      notifySaved(action || "字号和本机外观设置已保存，刷新后会继续保留。");
      return saved;
    } catch (error) {
      reportFailure(error, "保存美化设置");
      throw error;
    }
  }

  async function flushPendingSettings() {
    const hadPendingTimer = Boolean(state.saveTimer);
    window.clearTimeout(state.saveTimer);
    state.saveTimer = null;
    if (hadPendingTimer) {
      await persistSettings("字号已保存，聊天和页面会继续使用新的文字大小。");
      return;
    }
    await state.saveChain;
  }

  function scheduleFontSave() {
    window.clearTimeout(state.saveTimer);
    setStatus("working", "正在预览", "字号已经实时生效，松手后会保存到本机。");
    state.saveTimer = window.setTimeout(() => {
      persistSettings("字号已保存，聊天和页面会继续使用新的文字大小。").catch(() => {});
    }, 320);
  }

  function handleFontInput(kind, event) {
    if (!state.settings) return;
    const input = event.currentTarget;
    const value = Number(input.value);
    if (!Number.isFinite(value)) return;
    if (kind === "global") {
      state.settings.globalFontSize = value;
    } else {
      state.settings.chatBubbleFontSize = value;
    }
    state.settings = cloneSettings(state.settings);
    applyFontSettings();
    scheduleFontSave();
  }

  async function saveBackgroundBlob(key, blob) {
    window.clearTimeout(state.saveTimer);
    state.saveTimer = null;
    await state.saveChain;
    const imageId = window.PocketLabAppearance.IMAGE_IDS[key];
    const previousBlob = await window.PocketLabStorage.getImageBlob(imageId);
    await window.PocketLabStorage.saveImage(blob, {
      id: imageId,
      mimeType: blob.type || "image/jpeg",
    });

    const nextSettings = cloneSettings(state.settings);
    nextSettings.backgrounds[key] = imageId;
    try {
      await window.PocketLabAppearance.save(nextSettings);
    } catch (error) {
      try {
        if (previousBlob) {
          await window.PocketLabStorage.saveImage(previousBlob, {
            id: imageId,
            mimeType: previousBlob.type || "image/jpeg",
          });
        } else {
          await window.PocketLabStorage.deleteImage(imageId);
        }
      } catch {
        // The original error is the useful one; cleanup is best effort.
      }
      throw error;
    }

    state.settings = nextSettings;
    setBackgroundUrl(key, blob);
    applyBackgroundToPage(key);
    updateBackgroundPreview(key);
    notifySaved(`${BACKGROUND_LABELS[key]}已保存，刷新页面后仍会保留。`);
  }

  async function handleBackgroundFile(key, event) {
    const input = event.currentTarget;
    const file = input.files && input.files[0];
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      reportFailure(new Error("请选择 PNG、JPG 或 WebP 图片文件。"), "读取背景图片");
      input.value = "";
      return;
    }

    setStatus(
      "working",
      `正在处理${BACKGROUND_LABELS[key]}`,
      "图片会在本机压缩后保存，不会上传到外部服务器。",
    );
    try {
      await state.saveChain;
      const blob = await window.PocketLabMedia.resizeWallpaperToBlob(file, {
        maxDimension: 1800,
        quality: 0.84,
      });
      await saveBackgroundBlob(key, blob);
    } catch (error) {
      reportFailure(error, `保存${BACKGROUND_LABELS[key]}`);
    } finally {
      input.value = "";
    }
  }

  async function removeBackground(key) {
    if (!state.settings || !state.settings.backgrounds[key]) return;
    window.clearTimeout(state.saveTimer);
    state.saveTimer = null;
    await state.saveChain;
    const imageId = state.settings.backgrounds[key];
    const nextSettings = cloneSettings(state.settings);
    nextSettings.backgrounds[key] = "";
    setStatus("working", `正在恢复${BACKGROUND_LABELS[key]}`, "正在移除自定义背景。");
    try {
      await window.PocketLabAppearance.save(nextSettings);
      state.settings = nextSettings;
      releaseBackgroundUrl(key);
      applyBackgroundToPage(key);
      updateBackgroundPreview(key);
      try {
        await window.PocketLabStorage.deleteImage(imageId);
      } catch (cleanupError) {
        reportFailure(cleanupError, "清理背景图片");
        return;
      }
      notifySaved(`${BACKGROUND_LABELS[key]}已恢复内置默认背景。`);
    } catch (error) {
      reportFailure(error, `恢复${BACKGROUND_LABELS[key]}`);
    }
  }

  function showPage(pageName, options = {}) {
    const resolvedPage = Object.prototype.hasOwnProperty.call(
      BEAUTIFY_PAGES,
      pageName,
    )
      ? pageName
      : "menu";
    const pageMeta = BEAUTIFY_PAGES[resolvedPage];
    state.activePage = resolvedPage;

    if (elements["beautify-view"]) {
      elements["beautify-view"].dataset.beautifyCurrentPage = resolvedPage;
    }
    document.querySelectorAll("[data-beautify-page]").forEach((page) => {
      const isCurrent = page.dataset.beautifyPage === resolvedPage;
      page.hidden = !isCurrent;
      page.setAttribute("aria-hidden", String(!isCurrent));
    });

    if (elements["beautify-eyebrow"]) {
      elements["beautify-eyebrow"].textContent = pageMeta.eyebrow;
    }
    if (elements["beautify-title"]) {
      elements["beautify-title"].textContent = pageMeta.title;
    }
    if (elements["beautify-back"]) {
      elements["beautify-back"].setAttribute("aria-label", pageMeta.backLabel);
      elements["beautify-back"].title = pageMeta.backLabel;
    }

    if (!options.preserveScroll) {
      elements["beautify-scroll"]?.scrollTo({ top: 0 });
    }
  }

  function bindNavigation() {
    document.querySelectorAll("[data-beautify-main]").forEach((button) => {
      button.addEventListener("click", () => {
        showPage(button.dataset.beautifyMain);
      });
    });

    document.querySelectorAll("[data-beautify-phone-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        const panel = button.dataset.beautifyPhoneTab;
        document.querySelectorAll("[data-beautify-phone-tab]").forEach((item) => {
          const selected = item === button;
          item.classList.toggle("is-active", selected);
          item.setAttribute("aria-selected", String(selected));
        });
        document.querySelectorAll("[data-beautify-phone-panel]").forEach((item) => {
          item.hidden = item.dataset.beautifyPhonePanel !== panel;
        });
      });
    });
  }

  function bindEvents() {
    BACKGROUND_KEYS.forEach((key) => {
      elements[`beautify-${key}-file`]?.addEventListener("change", (event) => {
        handleBackgroundFile(key, event);
      });
      elements[`beautify-${key}-remove`]?.addEventListener("click", () => {
        removeBackground(key);
      });
    });
    elements["beautify-global-size"]?.addEventListener("input", (event) => {
      handleFontInput("global", event);
    });
    elements["beautify-global-size"]?.addEventListener("change", () => {
      flushPendingSettings().catch(() => {});
    });
    elements["beautify-chat-size"]?.addEventListener("input", (event) => {
      handleFontInput("chat", event);
    });
    elements["beautify-chat-size"]?.addEventListener("change", () => {
      flushPendingSettings().catch(() => {});
    });
    bindNavigation();
  }

  async function init(options = {}) {
    if (state.initialized) return state.settings;
    state.initialized = true;
    state.onError = options.onError || null;
    state.onSaved = options.onSaved || null;
    cacheElements();
    bindEvents();

    try {
      state.settings = await window.PocketLabAppearance.load();
      await hydrateBackgroundUrls(state.settings);
      applyAllSettings();
      const missingCount = BACKGROUND_KEYS.filter(
        (key) => state.settings.backgrounds[key] && !state.backgroundUrls[key],
      ).length;
      if (missingCount) {
        setStatus(
          "warning",
          "部分背景图片缺失",
          "旧记录仍在，但图片文件没有读回。可以重新选择对应背景覆盖。",
        );
      } else {
        setStatus("idle", "外观设置已就绪", "改动会立即预览，并自动保存在本机。");
      }
    } catch (error) {
      state.settings = cloneSettings(window.PocketLabAppearance.DEFAULTS);
      applyAllSettings();
      reportFailure(error, "读取美化设置");
    }
    return state.settings;
  }

  async function reload() {
    await flushPendingSettings();
    releaseAllBackgroundUrls();
    try {
      state.settings = await window.PocketLabAppearance.load();
      await hydrateBackgroundUrls(state.settings);
      applyAllSettings();
      const missingCount = BACKGROUND_KEYS.filter(
        (key) => state.settings.backgrounds[key] && !state.backgroundUrls[key],
      ).length;
      setStatus(
        missingCount ? "warning" : "idle",
        missingCount ? "部分背景图片缺失" : "外观设置已重新载入",
        missingCount
          ? "记录仍在，但图片文件没有读回。可以重新选择对应背景覆盖。"
          : "导入的字体和背景已经应用。",
      );
      return state.settings;
    } catch (error) {
      state.settings = cloneSettings(window.PocketLabAppearance.DEFAULTS);
      applyAllSettings();
      reportFailure(error, "重新读取美化设置");
      return state.settings;
    }
  }

  function getBackgroundUrl(key) {
    return state.backgroundUrls[key] || "";
  }

  function refresh() {
    showPage("menu");
    applyAllSettings();
  }

  function goBack() {
    if (state.activePage === "menu") return false;
    showPage("menu");
    return true;
  }

  window.PocketLabBeautify = {
    init,
    reload,
    flush: flushPendingSettings,
    refresh,
    getBackgroundUrl,
    goBack,
    getCurrentPage() {
      return state.activePage;
    },
    getSettings() {
      return state.settings ? cloneSettings(state.settings) : null;
    },
  };

  window.addEventListener("pagehide", releaseAllBackgroundUrls, { once: true });
})();
