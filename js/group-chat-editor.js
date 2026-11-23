"use strict";

(() => {
  const elements = {};
  const state = {
    initialized: false,
    records: [],
    editingId: "",
    saving: false,
    menuOpen: false,
  };

  function cacheElements() {
    [
      "add-character-from-list",
      "character-add-menu",
      "create-character-from-menu",
      "create-group-chat-from-menu",
      "group-chat-modal",
      "group-chat-modal-title",
      "close-group-chat-modal",
      "group-chat-form",
      "group-chat-name",
      "group-chat-announcement",
      "group-chat-background",
      "group-chat-name-error",
      "group-chat-announcement-error",
      "group-chat-background-error",
      "group-chat-form-error",
      "cancel-group-chat",
      "save-group-chat",
      "save-group-chat-label",
    ].forEach((id) => {
      elements[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    elements["add-character-from-list"].addEventListener("click", () => {
      setMenuOpen(!state.menuOpen);
    });
    elements["create-character-from-menu"].addEventListener("click", () => {
      setMenuOpen(false);
      window.dispatchEvent(new CustomEvent("pocketlab:request-new-character"));
    });
    elements["create-group-chat-from-menu"].addEventListener("click", () => {
      setMenuOpen(false);
      openCreate();
    });
    elements["close-group-chat-modal"].addEventListener("click", closeEditor);
    elements["cancel-group-chat"].addEventListener("click", closeEditor);
    elements["group-chat-modal"].addEventListener("click", (event) => {
      if (event.target === elements["group-chat-modal"] && !state.saving) {
        closeEditor();
      }
    });
    elements["group-chat-form"].addEventListener("submit", saveEditor);
    elements["group-chat-name"].addEventListener("input", () => {
      clearFieldError("name");
      clearFormError();
    });
    elements["group-chat-announcement"].addEventListener("input", () => {
      clearFieldError("announcement");
      clearFormError();
    });
    elements["group-chat-background"].addEventListener("input", () => {
      clearFieldError("background");
      clearFormError();
    });
    document.addEventListener("click", (event) => {
      if (
        !state.menuOpen ||
        elements["character-add-menu"].contains(event.target) ||
        elements["add-character-from-list"].contains(event.target)
      ) {
        return;
      }
      setMenuOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (state.menuOpen) {
        setMenuOpen(false);
        elements["add-character-from-list"].focus();
      }
      if (
        !elements["group-chat-modal"].classList.contains("is-hidden") &&
        !state.saving
      ) {
        closeEditor();
      }
    });
  }

  function setMenuOpen(open) {
    state.menuOpen = Boolean(open);
    elements["character-add-menu"].classList.toggle(
      "is-hidden",
      !state.menuOpen,
    );
    elements["add-character-from-list"].setAttribute(
      "aria-expanded",
      String(state.menuOpen),
    );
  }

  function fieldElements(fieldName) {
    return {
      input: elements[`group-chat-${fieldName}`],
      error: elements[`group-chat-${fieldName}-error`],
    };
  }

  function clearFieldError(fieldName) {
    const { input, error } = fieldElements(fieldName);
    if (input?.closest(".field")) {
      input.closest(".field").classList.remove("has-error");
    }
    if (error) error.textContent = "";
  }

  function showFieldError(fieldName, message) {
    const { input, error } = fieldElements(fieldName);
    if (input?.closest(".field")) {
      input.closest(".field").classList.add("has-error");
    }
    if (error) error.textContent = message || "";
  }

  function clearFieldErrors() {
    ["name", "announcement", "background"].forEach(clearFieldError);
  }

  function clearFormError() {
    elements["group-chat-form-error"].textContent = "";
    elements["group-chat-form-error"].classList.add("is-hidden");
  }

  function showFormError(message) {
    elements["group-chat-form-error"].textContent =
      message || "群聊没有保存成功，请重试。";
    elements["group-chat-form-error"].classList.remove("is-hidden");
  }

  function showToast(message) {
    window.dispatchEvent(
      new CustomEvent("pocketlab:toast", {
        detail: { message },
      }),
    );
  }

  function createGroupChatId() {
    if (
      window.PocketLabStorage &&
      typeof window.PocketLabStorage.createId === "function"
    ) {
      return window.PocketLabStorage.createId("group-chat");
    }
    return `group-chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function populateEditor(record) {
    state.editingId = record ? record.id : "";
    const isNew = !record;
    elements["group-chat-modal-title"].textContent = isNew
      ? "新建群聊"
      : "编辑群聊";
    elements["save-group-chat-label"].textContent = isNew
      ? "创建群聊"
      : "保存群聊";
    elements["group-chat-name"].value = record ? record.name : "";
    elements["group-chat-announcement"].value = record
      ? record.announcement
      : "";
    elements["group-chat-background"].value = record
      ? record.backgroundSetting
      : "";
    clearFieldErrors();
    clearFormError();
    elements["group-chat-modal"].classList.remove("is-hidden");
    window.setTimeout(() => elements["group-chat-name"].focus(), 60);
  }

  function openCreate() {
    if (state.saving) return;
    populateEditor(null);
  }

  async function openEdit(groupChatId) {
    if (state.saving) return;
    let record = state.records.find((item) => item.id === groupChatId);
    if (!record) {
      try {
        record = await window.PocketLabStorage.getGroupChat(groupChatId);
      } catch (error) {
        showToast(
          `群聊读取失败：${error?.message || "无法读取本机群聊数据。"} 请刷新页面后重试。`,
        );
        return;
      }
    }
    if (!record) {
      showToast("这个群聊已经不存在，请刷新人物列表后重试。");
      return;
    }
    populateEditor(record);
  }

  function closeEditor() {
    if (state.saving) return;
    state.editingId = "";
    setMenuOpen(false);
    elements["group-chat-modal"].classList.add("is-hidden");
    elements["add-character-from-list"].focus();
  }

  async function saveEditor(event) {
    event.preventDefault();
    if (state.saving) return;
    clearFieldErrors();
    clearFormError();

    const existing = state.records.find(
      (record) => record.id === state.editingId,
    );
    const source = {
      id: existing?.id || createGroupChatId(),
      name: elements["group-chat-name"].value,
      announcement: elements["group-chat-announcement"].value,
      backgroundSetting: elements["group-chat-background"].value,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    const validation =
      window.PocketLabGroupChatModel.validateGroupChat(source);
    if (!validation.ok) {
      Object.entries(validation.errors).forEach(([errorName, message]) => {
        const fieldName =
          errorName === "backgroundSetting" ? "background" : errorName;
        showFieldError(fieldName, message);
      });
      const firstInvalid =
        ["name", "announcement", "background"].find((fieldName) => {
          const errorName =
            fieldName === "background" ? "backgroundSetting" : fieldName;
          return validation.errors[errorName];
        }) || "";
      if (firstInvalid) elements[`group-chat-${firstInvalid}`].focus();
      return;
    }

    state.saving = true;
    elements["save-group-chat"].disabled = true;
    elements["save-group-chat"].setAttribute("aria-busy", "true");
    try {
      const saved = await window.PocketLabStorage.saveGroupChat({
        ...validation.value,
        id: source.id,
        createdAt: source.createdAt,
      });
      state.saving = false;
      closeEditor();
      await refresh({ silent: true });
      dispatchChanged();
      showToast(existing ? "群聊资料已更新。" : `“${saved.name}”已创建。`);
    } catch (error) {
      const detail = error?.message || "无法写入本机数据库。";
      showFormError(
        `${detail} 请检查浏览器是否允许保存站点数据、剩余空间是否充足，然后重试。`,
      );
    } finally {
      state.saving = false;
      elements["save-group-chat"].disabled = false;
      elements["save-group-chat"].removeAttribute("aria-busy");
    }
  }

  async function refresh() {
    state.records = await window.PocketLabStorage.listGroupChats();
    return [...state.records];
  }

  function dispatchChanged() {
    window.dispatchEvent(
      new CustomEvent("pocketlab:group-chats-changed", {
        detail: { groupChats: [...state.records] },
      }),
    );
  }

  async function init() {
    if (state.initialized) return refresh();
    cacheElements();
    bindEvents();
    state.initialized = true;
    return refresh();
  }

  window.PocketLabGroupChatEditor = Object.freeze({
    init,
    openCreate,
    openEdit,
    refresh,
  });
})();
