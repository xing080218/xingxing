"use strict";

(() => {
  const MAX_FILE_BYTES = 8 * 1024 * 1024;
  const ACCEPTED_FILE_TYPES = /^image\/(?:png|jpeg|webp)$/i;

  function getInitial(name) {
    return Array.from(String(name || "").trim())[0] || "我";
  }

  function renderAvatar(element, name, avatarUrl) {
    if (!element) return;
    const hasImage = Boolean(avatarUrl);
    element.classList.toggle("has-image", hasImage);
    element.style.backgroundImage = hasImage ? `url("${avatarUrl}")` : "";
    element.textContent = hasImage ? "" : getInitial(name);
  }

  function createController(elements) {
    const state = {
      blob: null,
      url: "",
      ownsUrl: false,
      existingId: "",
      processing: false,
      saving: false,
      readRequestId: 0,
      temporaryUrl: "",
    };

    function revokeDraftUrl() {
      if (!state.ownsUrl) return;
      window.PocketLabMedia.revokeObjectUrl(state.url);
      state.ownsUrl = false;
    }

    function revokeTemporaryUrl() {
      window.PocketLabMedia.revokeObjectUrl(state.temporaryUrl);
      state.temporaryUrl = "";
    }

    function clearError() {
      elements.error.textContent = "";
      elements.help.hidden = false;
    }

    function showError(message, nextStep = "") {
      const copy = [String(message || "").trim(), String(nextStep || "").trim()]
        .filter(Boolean)
        .join(" ");
      elements.error.textContent = copy;
    }

    function updateControls() {
      const hasAvatar = Boolean(
        state.blob || state.url || state.existingId,
      );
      elements.file.disabled = state.saving || state.processing;
      elements.clear.disabled =
        state.saving || state.processing || !hasAvatar;
      elements.save.disabled = state.saving || state.processing;
    }

    function reset(existingAvatarId = "", name = "") {
      state.readRequestId += 1;
      revokeDraftUrl();
      revokeTemporaryUrl();
      state.blob = null;
      state.url = "";
      state.existingId = String(existingAvatarId || "").trim();
      state.processing = false;
      elements.file.value = "";
      clearError();
      renderAvatar(elements.preview, name, "");
      updateControls();
    }

    async function loadSaved(profile) {
      if (!profile?.avatarId) return;
      const requestId = state.readRequestId;

      try {
        const blob = await window.PocketLabStorage.getImageBlob(
          profile.avatarId,
        );
        if (
          requestId !== state.readRequestId ||
          state.blob ||
          state.existingId !== profile.avatarId
        ) {
          return;
        }
        if (!(blob instanceof Blob) || !blob.size) {
          throw new Error("本机数据库里没有这张头像图片。");
        }

        const url = window.PocketLabMedia.createObjectUrl(blob);
        if (!url) throw new Error("浏览器无法生成头像预览。");
        if (requestId !== state.readRequestId) {
          window.PocketLabMedia.revokeObjectUrl(url);
          return;
        }

        state.url = url;
        state.ownsUrl = true;
        renderAvatar(elements.preview, profile.name, url);
        updateControls();
      } catch (error) {
        if (requestId !== state.readRequestId) return;
        showError(
          `无法读取已保存头像：${error?.message || "图片内容不可用。"}`,
          "请重新选择一张图片，或点“移除头像”后保存。",
        );
      }
    }

    async function handleFile(event) {
      const input = event.currentTarget;
      const file = input.files && input.files[0];
      if (!file) return;
      clearError();

      if (state.saving || state.processing || elements.modal.classList.contains("is-hidden")) {
        input.value = "";
        return;
      }
      if (!ACCEPTED_FILE_TYPES.test(file.type)) {
        showError(
          "头像读取失败：请选择 PNG、JPG 或 WebP 图片。",
          "如果图片是其他格式，请先另存为 JPG 后重试。",
        );
        input.value = "";
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        showError(
          "头像读取失败：文件超过 8 MB。",
          "请换一张较小的图片，或先压缩图片后重试。",
        );
        input.value = "";
        return;
      }

      const requestId = ++state.readRequestId;
      const previousDraft = {
        blob: state.blob,
        url: state.url,
        ownsUrl: state.ownsUrl,
        existingId: state.existingId,
      };
      state.temporaryUrl = window.PocketLabMedia.createObjectUrl(file);
      if (state.temporaryUrl) {
        renderAvatar(
          elements.preview,
          elements.name.value,
          state.temporaryUrl,
        );
      }

      state.processing = true;
      updateControls();
      try {
        const avatarBlob = await window.PocketLabMedia.resizeImageToBlob(file, {
          maxSize: 256,
          quality: 0.84,
        });
        if (
          requestId !== state.readRequestId ||
          elements.modal.classList.contains("is-hidden")
        ) {
          return;
        }

        const avatarUrl = window.PocketLabMedia.createObjectUrl(avatarBlob);
        if (!avatarUrl) {
          throw new Error("浏览器无法生成头像预览。");
        }
        if (previousDraft.ownsUrl) {
          window.PocketLabMedia.revokeObjectUrl(previousDraft.url);
        }
        state.blob = avatarBlob;
        state.url = avatarUrl;
        state.ownsUrl = true;
        renderAvatar(elements.preview, elements.name.value, avatarUrl);
      } catch (error) {
        if (requestId === state.readRequestId) {
          state.blob = previousDraft.blob;
          state.url = previousDraft.url;
          state.ownsUrl = previousDraft.ownsUrl;
          state.existingId = previousDraft.existingId;
          renderAvatar(
            elements.preview,
            elements.name.value,
            previousDraft.url,
          );
          showError(
            `头像读取失败：${error?.message || "浏览器无法处理这张图片。"}`,
            "请确认图片没有损坏，再重新选择；也可以换一张 JPG 或 PNG 图片。",
          );
        }
      } finally {
        window.PocketLabMedia.revokeObjectUrl(state.temporaryUrl);
        state.temporaryUrl = "";
        input.value = "";
        if (requestId === state.readRequestId) {
          state.processing = false;
          updateControls();
        }
      }
    }

    elements.file.addEventListener("change", handleFile);
    elements.clear.addEventListener("click", () => {
      if (state.saving || state.processing) return;
      state.readRequestId += 1;
      revokeDraftUrl();
      revokeTemporaryUrl();
      state.blob = null;
      state.url = "";
      state.existingId = "";
      elements.file.value = "";
      clearError();
      renderAvatar(elements.preview, elements.name.value, "");
      updateControls();
    });
    window.addEventListener("pagehide", () => {
      state.readRequestId += 1;
      revokeDraftUrl();
      revokeTemporaryUrl();
    });

    return Object.freeze({
      reset,
      loadSaved,
      setSaving(value) {
        state.saving = Boolean(value);
        updateControls();
      },
      updateName(name) {
        if (!state.url) renderAvatar(elements.preview, name, "");
      },
      getDraft() {
        return {
          blob: state.blob,
          existingId: state.existingId,
        };
      },
      isProcessing() {
        return state.processing;
      },
      release() {
        state.readRequestId += 1;
        revokeDraftUrl();
        revokeTemporaryUrl();
      },
    });
  }

  window.PocketLabSelfProfileAvatar = Object.freeze({
    createController,
    getInitial,
    renderAvatar,
  });
})();
