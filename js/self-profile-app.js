"use strict";

(() => {
  const model = window.PocketLabSelfProfileModel;
  const avatarUi = window.PocketLabSelfProfileAvatar;
  const elements = {};
  let avatarController = null;
  const state = {
    initialized: false,
    store: {
      profiles: [],
      activeProfileId: "",
    },
    loading: false,
    loadError: "",
    editingId: "",
    saving: false,
    refreshRequestId: 0,
    listAvatarRenderId: 0,
    listAvatarUrls: new Map(),
  };

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function cacheElements() {
    [
      "self-profile-list",
      "self-profile-count",
      "self-profile-feedback",
      "self-profile-feedback-title",
      "self-profile-feedback-message",
      "self-profile-feedback-next",
      "add-self-profile",
      "self-profile-modal",
      "self-profile-modal-title",
      "close-self-profile-modal",
      "self-profile-form",
      "self-profile-avatar-preview",
      "self-profile-avatar-file",
      "clear-self-profile-avatar",
      "self-profile-avatar-help",
      "self-profile-avatar-error",
      "self-profile-name",
      "self-profile-persona",
      "self-profile-persona-count",
      "self-profile-name-error",
      "self-profile-persona-error",
      "cancel-self-profile",
      "save-self-profile",
      "save-self-profile-label",
    ].forEach((id) => {
      elements[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    elements["add-self-profile"].addEventListener("click", () => openEditor());
    elements["close-self-profile-modal"].addEventListener("click", closeEditor);
    elements["cancel-self-profile"].addEventListener("click", closeEditor);
    elements["self-profile-modal"].addEventListener("click", (event) => {
      if (
        event.target === elements["self-profile-modal"] &&
        !state.saving
      ) {
        closeEditor();
      }
    });
    elements["self-profile-form"].addEventListener("submit", saveEditor);
    elements["self-profile-name"].addEventListener("input", () => {
      clearFieldError("name");
      avatarController.updateName(elements["self-profile-name"].value);
    });
    elements["self-profile-persona"].addEventListener("input", () => {
      clearFieldError("persona");
      updatePersonaCount();
    });
    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        !elements["self-profile-modal"].classList.contains("is-hidden") &&
        !state.saving
      ) {
        closeEditor();
      }
    });
    window.addEventListener("pagehide", () => {
      state.listAvatarRenderId += 1;
      revokeListAvatarUrls();
    });
  }

  function getActiveProfile() {
    return model.getActiveProfile(state.store);
  }

  function getProfile(profileId) {
    return (
      state.store.profiles.find((profile) => profile.id === profileId) || null
    );
  }

  function getProfiles() {
    return state.store.profiles.map((profile) => ({ ...profile }));
  }

  function getProfileById(profileId) {
    const profile = getProfile(profileId);
    return profile ? { ...profile } : null;
  }

  function setFeedback(kind, title, message, nextStep = "") {
    const feedback = elements["self-profile-feedback"];
    feedback.dataset.state = kind;
    feedback.hidden = false;
    elements["self-profile-feedback-title"].textContent = title;
    elements["self-profile-feedback-message"].textContent = message;
    elements["self-profile-feedback-next"].textContent = nextStep;
    elements["self-profile-feedback-next"].hidden = !nextStep;
  }

  function hideFeedback() {
    elements["self-profile-feedback"].hidden = true;
  }

  function clearFieldError(fieldName) {
    const field = elements[`self-profile-${fieldName}`];
    const error = elements[`self-profile-${fieldName}-error`];
    field?.closest(".field")?.classList.remove("has-error");
    if (error) error.textContent = "";
  }

  function showFieldError(fieldName, message) {
    const field = elements[`self-profile-${fieldName}`];
    const error = elements[`self-profile-${fieldName}-error`];
    field?.closest(".field")?.classList.add("has-error");
    if (error) error.textContent = message || "";
  }

  function clearFieldErrors() {
    ["name", "persona"].forEach(clearFieldError);
  }

  function updatePersonaCount() {
    const count = Array.from(elements["self-profile-persona"].value).length;
    elements["self-profile-persona-count"].textContent =
      `${count} / ${model.MAX_PERSONA_LENGTH}`;
  }

  function revokeListAvatarUrls() {
    state.listAvatarUrls.forEach((url) =>
      window.PocketLabMedia.revokeObjectUrl(url),
    );
    state.listAvatarUrls.clear();
  }

  function createStatePanel(title, message, actionLabel, action) {
    const panel = document.createElement("div");
    panel.className = "self-profile-state";
    const heading = document.createElement("strong");
    heading.textContent = title;
    const copy = document.createElement("p");
    copy.textContent = message;
    panel.append(heading, copy);
    if (actionLabel && typeof action === "function") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary-button";
      button.textContent = actionLabel;
      button.addEventListener("click", action);
      panel.append(button);
    }
    return panel;
  }

  function createActionButton(label, className, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", handler);
    return button;
  }

  function createProfileCard(profile) {
    const isActive = profile.id === state.store.activeProfileId;
    const card = document.createElement("article");
    card.className = `self-profile-card${isActive ? " is-active" : ""}`;

    const heading = document.createElement("div");
    heading.className = "self-profile-card-heading";
    const avatar = document.createElement("span");
    avatar.className = "self-profile-card-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = avatarUi.getInitial(profile.name);
    const titleGroup = document.createElement("div");
    titleGroup.className = "self-profile-card-title";
    const nameRow = document.createElement("div");
    nameRow.className = "self-profile-name-row";
    const title = document.createElement("h2");
    title.textContent = profile.name;
    nameRow.append(title);
    if (isActive) {
      const badge = document.createElement("span");
      badge.className = "self-profile-current-badge";
      badge.textContent = "当前";
      nameRow.append(badge);
    }
    const meta = document.createElement("p");
    meta.textContent = isActive
      ? "当前资料：未指定人设的角色默认使用"
      : "角色可在编辑页单独选择这份资料";
    titleGroup.append(nameRow, meta);
    heading.append(avatar, titleGroup);

    const summary = document.createElement("p");
    summary.className = "self-profile-card-summary";
    const persona = String(profile.persona || "");
    summary.textContent =
      persona.length > 150 ? `${persona.slice(0, 150)}...` : persona;

    const actions = document.createElement("div");
    actions.className = "self-profile-card-actions";
    if (!isActive) {
      actions.append(
        createActionButton(
          "设为当前",
          "self-profile-current-action",
          () => setActiveProfile(profile.id),
        ),
      );
    }
    actions.append(
      createActionButton("编辑", "", () => openEditor(profile.id)),
      createActionButton(
        "删除",
        "is-danger",
        () => deleteProfile(profile.id),
      ),
    );
    card.append(heading, summary, actions);
    return card;
  }

  async function hydrateCardAvatar(profile, avatar, requestId) {
    if (!profile.avatarId) return;

    try {
      const blob = await window.PocketLabStorage.getImageBlob(profile.avatarId);
      if (requestId !== state.listAvatarRenderId) return;
      if (!(blob instanceof Blob) || !blob.size) return;

      const url = window.PocketLabMedia.createObjectUrl(blob);
      if (!url) return;
      if (requestId !== state.listAvatarRenderId) {
        window.PocketLabMedia.revokeObjectUrl(url);
        return;
      }

      state.listAvatarUrls.set(profile.id, url);
      avatarUi.renderAvatar(avatar, profile.name, url);
    } catch {
      // A missing avatar must not hide the profile or its text data.
    }
  }

  function renderList() {
    const list = elements["self-profile-list"];
    const count = state.store.profiles.length;
    const requestId = ++state.listAvatarRenderId;
    revokeListAvatarUrls();
    elements["self-profile-count"].textContent =
      count > 0 ? `${count} 份本人资料` : "尚未添加";

    if (state.loading) {
      list.replaceChildren(
        createStatePanel(
          "正在读取本人资料",
          "请稍等，正在从本机 IndexedDB 读取。",
        ),
      );
      return;
    }
    if (state.loadError) {
      list.replaceChildren(
        createStatePanel(
          "本人资料读取失败",
          `${state.loadError} 请确认浏览器允许站点保存数据，然后重新读取。`,
          "重新读取",
          () => refresh(),
        ),
      );
      return;
    }
    if (!count) {
      list.replaceChildren(
        createStatePanel(
          "还没有本人设定",
          "点右上角加号，写下你希望角色在聊天里认识的你。没有本人资料时，聊天仍可正常使用。",
          "添加我的第一份资料",
          () => openEditor(),
        ),
      );
      return;
    }

    const cards = state.store.profiles.map((profile) => {
      const card = createProfileCard(profile);
      return {
        profile,
        card,
        avatar: card.querySelector(".self-profile-card-avatar"),
      };
    });
    list.replaceChildren(...cards.map((entry) => entry.card));
    cards.forEach(({ profile, avatar }) => {
      hydrateCardAvatar(profile, avatar, requestId);
    });
  }

  async function persist(nextStore, avatarImage = null) {
    state.refreshRequestId += 1;
    state.loading = false;
    const normalized = model.normalizeStore(nextStore);
    if (avatarImage?.blob) {
      await window.PocketLabStorage.saveAppDataWithImage(
        model.STORAGE_KEY,
        normalized,
        avatarImage.blob,
        { id: avatarImage.id },
      );
    } else {
      await window.PocketLabStorage.saveAppData(model.STORAGE_KEY, normalized);
    }
    state.store = normalized;
    state.loadError = "";
    return normalized;
  }

  function dispatchChanged() {
    window.dispatchEvent(
      new CustomEvent("pocketlab:self-profiles-changed", {
        detail: {
          profiles: state.store.profiles.map((profile) => ({ ...profile })),
          activeProfileId: state.store.activeProfileId,
          activeProfile: getActiveProfile(),
        },
      }),
    );
  }

  async function refresh(options = {}) {
    if (!state.initialized) return false;
    const requestId = ++state.refreshRequestId;
    state.loading = !options.silent;
    state.loadError = "";
    if (!options.silent) renderList();

    try {
      const record = await window.PocketLabStorage.getAppData(model.STORAGE_KEY);
      if (requestId !== state.refreshRequestId) return false;
      state.store = model.normalizeStore(record && record.data);
      hideFeedback();
      dispatchChanged();
      return true;
    } catch (error) {
      if (requestId !== state.refreshRequestId) return false;
      state.loadError =
        error && error.message ? error.message : "无法读取本机本人资料。";
      setFeedback(
        "error",
        "本人资料读取失败",
        state.loadError,
        "请确认没有使用禁止站点存储的隐私模式，并检查浏览器剩余空间，然后点“重新读取”。",
      );
      dispatchChanged();
      return false;
    } finally {
      if (requestId === state.refreshRequestId) {
        state.loading = false;
        renderList();
      }
    }
  }

  function openEditor(profileId = "") {
    const profile = getProfile(profileId);
    if (state.saving) return;
    state.editingId = profile ? profile.id : "";
    elements["self-profile-modal-title"].textContent = profile
      ? "编辑本人资料"
      : "添加本人资料";
    elements["save-self-profile-label"].textContent = profile
      ? "保存修改"
      : "添加并设为当前";
    avatarController.reset(profile?.avatarId || "", profile?.name || "");
    elements["self-profile-name"].value = profile ? profile.name : "";
    elements["self-profile-persona"].value = profile ? profile.persona : "";
    clearFieldErrors();
    updatePersonaCount();
    elements["self-profile-modal"].classList.remove("is-hidden");
    window.setTimeout(() => elements["self-profile-name"].focus(), 60);

    if (profile?.avatarId) {
      avatarController.loadSaved(profile);
    }
  }

  function closeEditor() {
    if (state.saving) return;
    avatarController.reset("", "");
    state.editingId = "";
    elements["self-profile-modal"].classList.add("is-hidden");
    elements["add-self-profile"].focus();
  }

  async function saveEditor(event) {
    event.preventDefault();
    if (state.saving || avatarController.isProcessing()) return;
    clearFieldErrors();

    const existing = getProfile(state.editingId);
    const avatarDraft = avatarController.getDraft();
    const now = Date.now();
    const source = {
      id: existing?.id || `self-profile-${createId()}`,
      avatarId: avatarDraft.blob ? "" : avatarDraft.existingId,
      name: elements["self-profile-name"].value,
      persona: elements["self-profile-persona"].value,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    const validation = model.validateProfile(source);
    if (!validation.ok) {
      Object.entries(validation.errors).forEach(([fieldName, message]) => {
        showFieldError(fieldName, message);
      });
      const firstInvalid = ["name", "persona"].find(
        (fieldName) => validation.errors[fieldName],
      );
      if (firstInvalid) elements[`self-profile-${firstInvalid}`].focus();
      return;
    }

    const oldAvatarId = existing?.avatarId || "";
    if (avatarDraft.blob) {
      validation.value.avatarId = window.PocketLabStorage.createId(
        "self-profile-avatar",
      );
    }
    const avatarImage = avatarDraft.blob
      ? {
          id: validation.value.avatarId,
          blob: avatarDraft.blob,
        }
      : null;

    const nextProfiles = existing
      ? state.store.profiles.map((profile) =>
          profile.id === existing.id ? validation.value : profile,
        )
      : [...state.store.profiles, validation.value];
    const nextActiveProfileId = existing
      ? state.store.activeProfileId
      : validation.value.id;

    state.saving = true;
    avatarController.setSaving(true);
    elements["save-self-profile"].setAttribute("aria-busy", "true");
    try {
      await persist(
        {
          profiles: nextProfiles,
          activeProfileId: nextActiveProfileId,
        },
        avatarImage,
      );
      const savedProfile = getProfile(validation.value.id);
      if (oldAvatarId && oldAvatarId !== savedProfile?.avatarId) {
        await window.PocketLabStorage.deleteImageIfUnused(oldAvatarId).catch(
          () => undefined,
        );
      }
      state.saving = false;
      closeEditor();
      renderList();
      setFeedback(
        "success",
        existing ? "本人资料已更新" : "本人资料已添加",
        existing
          ? `“${validation.value.name}”已保存在本机。`
          : `“${validation.value.name}”已保存在本机，并设为未指定人设角色的默认资料。`,
      );
      dispatchChanged();
    } catch (error) {
      setFeedback(
        "error",
        "本人资料保存失败",
        error?.message || "无法写入本机数据库。",
        "请检查浏览器存储权限和剩余空间，然后保持弹窗内容并再次保存。",
      );
      showFieldError(
        "persona",
        error?.message || "本人资料没有保存成功，请重试。",
      );
    } finally {
      state.saving = false;
      avatarController.setSaving(false);
      elements["save-self-profile"].removeAttribute("aria-busy");
    }
  }

  async function setActiveProfile(profileId) {
    const profile = getProfile(profileId);
    if (!profile || profile.id === state.store.activeProfileId) return;

    try {
      await persist({
        profiles: state.store.profiles,
        activeProfileId: profile.id,
      });
      renderList();
      setFeedback(
        "success",
        "已切换本人资料",
        `下一次发送聊天消息时会使用“${profile.name}”。`,
      );
      dispatchChanged();
    } catch (error) {
      setFeedback(
        "error",
        "无法切换本人资料",
        error?.message || "无法写入本机数据库。",
        "请检查浏览器存储权限和剩余空间，然后重试。",
      );
    }
  }

  async function deleteProfile(profileId) {
    const profile = getProfile(profileId);
    if (!profile) return;
    if (!window.confirm(`确定删除“${profile.name}”吗？删除后无法恢复。`)) {
      return;
    }

    const nextProfiles = state.store.profiles.filter(
      (item) => item.id !== profile.id,
    );
    const nextActiveProfileId =
      state.store.activeProfileId === profile.id
        ? nextProfiles[0]?.id || ""
        : state.store.activeProfileId;

    try {
      await persist({
        profiles: nextProfiles,
        activeProfileId: nextActiveProfileId,
      });
      if (profile.avatarId) {
        await window.PocketLabStorage.deleteImageIfUnused(
          profile.avatarId,
        ).catch(() => undefined);
      }
      renderList();
      const nextActive = getActiveProfile();
      setFeedback(
        "success",
        "本人资料已删除",
        nextActive
          ? `“${profile.name}”已删除，当前改用“${nextActive.name}”。`
          : `“${profile.name}”已删除。现在没有本人资料，角色聊天仍可正常使用。`,
      );
      dispatchChanged();
    } catch (error) {
      setFeedback(
        "error",
        "本人资料删除失败",
        error?.message || "无法写入本机数据库。",
        "请检查浏览器存储权限和剩余空间，然后重试。",
      );
    }
  }

  async function init() {
    if (state.initialized) {
      await refresh();
      return;
    }
    cacheElements();
    avatarController = avatarUi.createController({
      modal: elements["self-profile-modal"],
      file: elements["self-profile-avatar-file"],
      clear: elements["clear-self-profile-avatar"],
      save: elements["save-self-profile"],
      preview: elements["self-profile-avatar-preview"],
      help: elements["self-profile-avatar-help"],
      error: elements["self-profile-avatar-error"],
      name: elements["self-profile-name"],
    });
    bindEvents();
    state.initialized = true;
    await refresh();
  }

  window.PocketLabSelfProfileApp = Object.freeze({
    init,
    refresh,
    getActiveProfile,
    getProfiles,
    getProfileById,
  });
})();
