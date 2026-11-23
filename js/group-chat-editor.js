"use strict";

(() => {
  const elements = {};
  const state = {
    initialized: false,
    records: [],
    characters: [],
    editingId: "",
    editingRecord: null,
    memberCharacterIds: [],
    pickerOpen: false,
    pickerSelectedIds: [],
    saving: false,
    menuOpen: false,
    avatarRenderToken: 0,
    avatarObjectUrls: [],
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
      "group-chat-member-count",
      "group-chat-member-list",
      "open-group-member-picker",
      "open-group-member-picker-label",
      "group-chat-member-help",
      "group-member-picker",
      "group-member-picker-list",
      "group-member-picker-count",
      "close-group-member-picker",
      "cancel-group-member-picker",
      "confirm-group-member-picker",
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
    elements["group-chat-member-list"].addEventListener("click", (event) => {
      const button =
        event.target instanceof Element
          ? event.target.closest("[data-remove-group-member]")
          : null;
      if (!button || state.saving) return;
      removeDraftMember(button.dataset.removeGroupMember);
      clearFormError();
    });
    elements["open-group-member-picker"].addEventListener(
      "click",
      openMemberPicker,
    );
    elements["close-group-member-picker"].addEventListener(
      "click",
      closeMemberPicker,
    );
    elements["cancel-group-member-picker"].addEventListener(
      "click",
      closeMemberPicker,
    );
    elements["confirm-group-member-picker"].addEventListener(
      "click",
      confirmPickedMembers,
    );
    elements["group-member-picker"].addEventListener("click", (event) => {
      if (event.target === elements["group-member-picker"]) {
        closeMemberPicker();
      }
    });
    elements["group-member-picker-list"].addEventListener(
      "change",
      handlePickerSelectionChange,
    );
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
      if (state.pickerOpen) {
        closeMemberPicker();
        return;
      }
      if (state.menuOpen) {
        setMenuOpen(false);
        elements["add-character-from-list"].focus();
        return;
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

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/gu, "&amp;")
      .replace(/</gu, "&lt;")
      .replace(/>/gu, "&gt;")
      .replace(/"/gu, "&quot;")
      .replace(/'/gu, "&#39;");
  }

  function getCharacterInitial(name) {
    return Array.from(String(name || "").trim())[0] || "角";
  }

  function getCharacterById(characterId) {
    return state.characters.find((character) => character.id === characterId);
  }

  function getMemberCharacters() {
    return state.memberCharacterIds
      .map(getCharacterById)
      .filter(Boolean);
  }

  function getAvailableCharacters() {
    const selectedIds = new Set(state.memberCharacterIds);
    return state.characters.filter(
      (character) => !selectedIds.has(character.id),
    );
  }

  async function loadCharacters() {
    const characters = await window.PocketLabStorage.listCharacters();
    state.characters = (Array.isArray(characters) ? characters : []).filter(
      (character) =>
        character &&
        typeof character.id === "string" &&
        Boolean(character.id.trim()),
    );
  }

  function releaseAvatarObjectUrls() {
    const media = window.PocketLabMedia;
    if (!media || typeof media.revokeObjectUrl !== "function") {
      state.avatarObjectUrls = [];
      return;
    }
    state.avatarObjectUrls.forEach((url) => media.revokeObjectUrl(url));
    state.avatarObjectUrls = [];
  }

  async function refreshDynamicAvatars() {
    state.avatarRenderToken += 1;
    const token = state.avatarRenderToken;
    releaseAvatarObjectUrls();
    const media = window.PocketLabMedia;
    if (!media || typeof media.createObjectUrl !== "function") return;

    const nodes = elements["group-chat-modal"].querySelectorAll(
      "[data-group-member-avatar-id]",
    );
    await Promise.all(
      Array.from(nodes).map(async (node) => {
        const characterId = node.dataset.groupMemberAvatarId;
        const character = getCharacterById(characterId);
        if (!character || !character.avatarId) return;
        let blob;
        try {
          blob = await window.PocketLabStorage.getImageBlob(
            character.avatarId,
          );
        } catch {
          return;
        }
        if (!blob || token !== state.avatarRenderToken) return;
        const objectUrl = media.createObjectUrl(blob);
        if (!objectUrl) return;
        if (token !== state.avatarRenderToken) {
          media.revokeObjectUrl(objectUrl);
          return;
        }
        state.avatarObjectUrls.push(objectUrl);
        node.style.backgroundImage = `url(${JSON.stringify(objectUrl)})`;
        node.classList.add("has-image");
        node.textContent = "";
      }),
    );
  }

  function renderMemberSection() {
    const members = getMemberCharacters();
    const available = getAvailableCharacters();
    elements["group-chat-member-count"].textContent = `${members.length} 人`;

    if (!members.length) {
      elements["group-chat-member-list"].innerHTML = `
        <div class="group-chat-members-empty">
          <strong>还没有群成员</strong>
          <span>可以先创建空群聊，之后再从群聊编辑中拉入角色。</span>
        </div>
      `;
    } else {
      elements["group-chat-member-list"].innerHTML = members
        .map(
          (character) => `
            <div class="group-chat-member-row" role="listitem">
              <span
                class="group-chat-member-avatar"
                data-group-member-avatar-id="${escapeHtml(character.id)}"
                aria-hidden="true"
              >${escapeHtml(getCharacterInitial(character.name))}</span>
              <span class="group-chat-member-copy">
                <strong>${escapeHtml(character.name || "未命名角色")}</strong>
                <small>现有角色</small>
              </span>
              <button
                class="group-chat-member-remove"
                type="button"
                data-remove-group-member="${escapeHtml(character.id)}"
                aria-label="将 ${escapeHtml(character.name || "未命名角色")} 移出群聊"
              >移出</button>
            </div>
          `,
        )
        .join("");
    }

    const addButton = elements["open-group-member-picker"];
    const label = elements["open-group-member-picker-label"];
    if (!state.characters.length) {
      addButton.disabled = true;
      label.textContent = "暂无角色";
      elements["group-chat-member-help"].textContent =
        "还没有现有角色。请先在对话页新建角色，再回来拉入群聊。";
    } else if (!available.length) {
      addButton.disabled = true;
      label.textContent = "全部已入群";
      elements["group-chat-member-help"].textContent =
        "所有现有角色都已经在这个群聊里。";
    } else {
      addButton.disabled = state.saving;
      label.textContent = state.editingId ? "拉入角色" : "选择角色";
      elements["group-chat-member-help"].textContent =
        "可以从现有角色中选择一个或多个加入群聊。";
    }

    void refreshDynamicAvatars();
  }

  function updatePickerControls() {
    const selectedCount = state.pickerSelectedIds.length;
    elements["group-member-picker-count"].textContent =
      selectedCount > 0 ? `已选择 ${selectedCount} 人` : "可多选";
    elements["confirm-group-member-picker"].disabled = selectedCount === 0;
    elements["confirm-group-member-picker"].textContent =
      selectedCount > 0 ? `加入群聊 · ${selectedCount}` : "加入群聊";
  }

  function renderMemberPicker() {
    const available = getAvailableCharacters();
    if (!available.length) {
      elements["group-member-picker-list"].innerHTML = `
        <div class="group-member-picker-empty">
          <strong>没有可拉入的角色</strong>
          <span>现有角色都已经在这个群聊里。</span>
        </div>
      `;
    } else {
      const selectedIds = new Set(state.pickerSelectedIds);
      elements["group-member-picker-list"].innerHTML = available
        .map(
          (character) => `
            <label class="group-member-picker-row">
              <input
                type="checkbox"
                data-group-member-picker-id="${escapeHtml(character.id)}"
                ${selectedIds.has(character.id) ? "checked" : ""}
              />
              <span
                class="group-chat-member-avatar"
                data-group-member-avatar-id="${escapeHtml(character.id)}"
                aria-hidden="true"
              >${escapeHtml(getCharacterInitial(character.name))}</span>
              <span class="group-chat-member-copy">
                <strong>${escapeHtml(character.name || "未命名角色")}</strong>
                <small>加入后仍保留原角色资料</small>
              </span>
              <span class="group-member-picker-check" aria-hidden="true"></span>
            </label>
          `,
        )
        .join("");
    }
    updatePickerControls();
    void refreshDynamicAvatars();
  }

  function openMemberPicker() {
    if (state.saving || !getAvailableCharacters().length) return;
    state.pickerSelectedIds = [];
    state.pickerOpen = true;
    renderMemberPicker();
    elements["group-member-picker"].classList.remove("is-hidden");
    const firstCheckbox =
      elements["group-member-picker-list"].querySelector(
        "[data-group-member-picker-id]",
      );
    window.setTimeout(() => firstCheckbox?.focus(), 40);
  }

  function closeMemberPicker() {
    if (state.saving) return;
    state.pickerOpen = false;
    state.pickerSelectedIds = [];
    elements["group-member-picker"].classList.add("is-hidden");
    elements["open-group-member-picker"].focus();
  }

  function handlePickerSelectionChange(event) {
    const input =
      event.target instanceof HTMLInputElement
        ? event.target
        : null;
    if (!input || !input.matches("[data-group-member-picker-id]")) return;
    const characterId = input.dataset.groupMemberPickerId;
    if (!characterId || state.memberCharacterIds.includes(characterId)) return;
    if (input.checked) {
      if (!state.pickerSelectedIds.includes(characterId)) {
        state.pickerSelectedIds.push(characterId);
      }
    } else {
      state.pickerSelectedIds = state.pickerSelectedIds.filter(
        (id) => id !== characterId,
      );
    }
    updatePickerControls();
  }

  function confirmPickedMembers() {
    if (state.saving) return;
    const availableIds = new Set(
      getAvailableCharacters().map((character) => character.id),
    );
    const pickedIds = state.pickerSelectedIds.filter(
      (characterId, index, ids) =>
        availableIds.has(characterId) && ids.indexOf(characterId) === index,
    );
    state.memberCharacterIds.push(...pickedIds);
    closeMemberPicker();
    renderMemberSection();
    clearFormError();
  }

  function removeDraftMember(characterId) {
    if (!characterId) return;
    state.memberCharacterIds = state.memberCharacterIds.filter(
      (id) => id !== characterId,
    );
    renderMemberSection();
  }

  function populateEditor(record) {
    state.editingId = record ? record.id : "";
    state.editingRecord = record ? { ...record } : null;
    state.memberCharacterIds =
      window.PocketLabGroupChatModel.normalizeMemberCharacterIds(
        record?.memberCharacterIds,
      ).filter((characterId) => Boolean(getCharacterById(characterId)));
    state.pickerOpen = false;
    state.pickerSelectedIds = [];
    elements["group-member-picker"].classList.add("is-hidden");

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
    renderMemberSection();
    elements["group-chat-modal"].classList.remove("is-hidden");
    window.setTimeout(() => elements["group-chat-name"].focus(), 60);
  }

  async function openCreate() {
    if (state.saving) return;
    try {
      await loadCharacters();
    } catch (error) {
      showToast(
        `角色列表读取失败：${error?.message || "无法读取本机角色数据。"} 请刷新页面后重试。`,
      );
      return;
    }
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
    try {
      await loadCharacters();
    } catch (error) {
      showToast(
        `角色列表读取失败：${error?.message || "无法读取本机角色数据。"} 为避免误删群成员，请刷新页面后重试。`,
      );
      return;
    }
    populateEditor(record);
  }

  function closeEditor() {
    if (state.saving || state.pickerOpen) return;
    state.editingId = "";
    state.editingRecord = null;
    state.memberCharacterIds = [];
    state.pickerSelectedIds = [];
    state.avatarRenderToken += 1;
    releaseAvatarObjectUrls();
    setMenuOpen(false);
    elements["group-member-picker"].classList.add("is-hidden");
    elements["group-chat-modal"].classList.add("is-hidden");
    elements["add-character-from-list"].focus();
  }

  async function saveEditor(event) {
    event.preventDefault();
    if (state.saving) return;
    if (state.pickerOpen) return;
    clearFieldErrors();
    clearFormError();

    const existing =
      state.editingRecord ||
      state.records.find((record) => record.id === state.editingId);
    const source = {
      id: state.editingId || createGroupChatId(),
      name: elements["group-chat-name"].value,
      announcement: elements["group-chat-announcement"].value,
      backgroundSetting: elements["group-chat-background"].value,
      memberCharacterIds: [...state.memberCharacterIds],
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    const validation =
      window.PocketLabGroupChatModel.validateGroupChat(source);
    if (!validation.ok) {
      Object.entries(validation.errors).forEach(([errorName, message]) => {
        const fieldName =
          errorName === "backgroundSetting" ? "background" : errorName;
        if (fieldName === "memberCharacterIds") return;
        showFieldError(fieldName, message);
      });
      if (validation.errors.memberCharacterIds) {
        showFormError(validation.errors.memberCharacterIds);
      }
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
    elements["open-group-member-picker"].disabled = true;
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
      elements["open-group-member-picker"].disabled =
        !getAvailableCharacters().length;
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
