"use strict";

((root) => {
  const model = root.PocketLabSmsModel;
  const store = root.PocketLabSmsStore;
  const client = root.PocketLabSmsClient;
  const storage = root.PocketLabStorage;
  const replyFactory = root.PocketLabSmsReply;
  const rendererFactory = root.PocketLabSmsRenderer;
  const elements = {};
  const state = {
    initialized: false,
    loading: false,
    recovered: false,
    data: model ? model.normalizeSmsData(null) : { version: 1, messages: [] },
    characters: [],
    avatars: new Map(),
    generating: new Set(),
    sending: false,
    selectedCharacterId: "",
    activeView: "",
    normalizeError: null,
    onExit: () => {},
    onStorageError: () => {},
    refreshSequence: 0,
    renderer: null,
    replyService: null,
  };

  function init(options = {}) {
    if (
      !model ||
      !store ||
      !client ||
      !storage ||
      !replyFactory ||
      !rendererFactory
    ) {
      return Promise.reject(new Error("短信 App 所需组件没有完成加载。"));
    }
    if (state.initialized) return refresh(options);

    state.normalizeError =
      typeof options.normalizeError === "function"
        ? options.normalizeError
        : null;
    state.onExit =
      typeof options.onExit === "function" ? options.onExit : () => {};
    state.onStorageError =
      typeof options.onStorageError === "function"
        ? options.onStorageError
        : () => {};

    cacheElements();
    bindEvents();
    state.renderer = rendererFactory.create({
      elements,
      getCharacterName,
      getAvatarUrl,
      onOpenConversation: (characterId) => {
        void openConversation(characterId);
      },
      isGenerating: (recordId) => state.generating.has(recordId),
    });
    state.replyService = replyFactory.create({
      model,
      store,
      client,
      storage,
      normalizeError: state.normalizeError,
    });
    state.initialized = true;
    return refresh(options);
  }

  function cacheElements() {
    [
      "sms-view",
      "sms-back",
      "sms-eyebrow",
      "sms-title",
      "sms-scroll",
      "sms-list-panel",
      "sms-list-summary",
      "sms-list",
      "sms-empty",
      "sms-feedback",
      "sms-feedback-title",
      "sms-feedback-message",
      "sms-feedback-next",
      "sms-thread-panel",
      "sms-thread-contact",
      "sms-thread-avatar",
      "sms-thread-name",
      "sms-thread-meta",
      "sms-thread",
      "sms-thread-empty",
      "sms-unread-badge",
      "sms-composer",
      "sms-input",
      "sms-send",
      "sms-reply-status",
    ].forEach((id) => {
      elements[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    elements["sms-back"].addEventListener("click", handleBack);
    elements["sms-thread"].addEventListener("click", handleThreadAction);
    elements["sms-composer"].addEventListener("submit", handleComposerSubmit);
    elements["sms-input"].addEventListener("input", handleComposerInput);
    elements["sms-input"].addEventListener("keydown", handleComposerKeydown);
    root.addEventListener(
      "pocketlab:character-blocked",
      handleCharacterBlocked,
    );
  }

  async function refresh(options = {}) {
    if (!state.initialized) return;
    const sequence = ++state.refreshSequence;
    state.loading = true;
    syncLoadingState();

    try {
      if (!state.recovered) {
        state.data = await store.recoverInterrupted();
        state.recovered = true;
      } else {
        state.data = await store.load();
      }
      await loadCharacters();
      if (state.activeView === "sms" && state.selectedCharacterId) {
        await markRead(state.selectedCharacterId);
      }
      if (sequence !== state.refreshSequence) return;
      hideFeedback();
      render();
    } catch (error) {
      if (sequence !== state.refreshSequence) return;
      if (!options.silent) {
        showFeedback(
          "error",
          "无法读取短信",
          error?.message || "本机短信数据库没有完成读取。",
          "刷新页面后重试；如果仍然失败，请检查浏览器是否允许本机存储。",
        );
      }
      state.onStorageError(error, "读取短信");
    } finally {
      if (sequence === state.refreshSequence) {
        state.loading = false;
        syncLoadingState();
      }
    }
  }

  function syncLoadingState() {
    elements["sms-list"]?.setAttribute(
      "aria-busy",
      String(state.loading),
    );
    elements["sms-view"]?.classList.toggle("is-loading", state.loading);
  }

  async function loadCharacters() {
    const characters = await storage.listCharacters();
    const nextAvatars = new Map();
    await Promise.all(
      characters.map(async (character) => {
        const avatarId =
          typeof character.avatarId === "string"
            ? character.avatarId.trim()
            : "";
        const cached = state.avatars.get(character.id);
        if (avatarId && cached?.avatarId === avatarId) {
          nextAvatars.set(character.id, cached);
          return;
        }
        if (cached?.url) URL.revokeObjectURL(cached.url);
        if (!avatarId) return;

        try {
          const blob = await storage.getImageBlob(avatarId);
          if (!blob) return;
          nextAvatars.set(character.id, {
            avatarId,
            url: URL.createObjectURL(blob),
          });
        } catch {
          // A missing avatar must not hide the character or SMS record.
        }
      }),
    );

    state.avatars.forEach((avatar, characterId) => {
      if (!nextAvatars.has(characterId) && avatar.url) {
        URL.revokeObjectURL(avatar.url);
      }
    });
    state.avatars = nextAvatars;
    state.characters = characters;
  }

  async function handleCharacterBlocked(event) {
    const detail = event?.detail || {};
    const characterId = model.normalizeId(detail.characterId);
    const blockEventId = model.normalizeId(detail.blockEventId);
    if (!characterId || !blockEventId) return;

    const occurredAt = Number(detail.occurredAt) || Date.now();
    const record = model.createSmsRecord({
      id: `sms-${createId()}`,
      characterId,
      blockEventId,
      createdAt: occurredAt,
      status: model.STATUS.SENDING,
      role: model.ROLE.ASSISTANT,
      kind: model.KIND.APOLOGY,
    });

    if (
      !state.characters.some(
        (character) => character.id === characterId,
      ) &&
      typeof detail.characterName === "string"
    ) {
      state.characters.push({
        id: characterId,
        name: detail.characterName.trim().slice(0, 24) || "角色",
        avatarId: "",
      });
    }

    try {
      const result = await store.addIfMissing(record);
      state.data = result.data;
      render();
      if (!result.added) return;
      void generateRecord(result.record);
    } catch (error) {
      showFeedback(
        "error",
        "无法保存道歉短信",
        error?.message || "本机数据库没有接受这条短信记录。",
        "检查本机存储空间后重试；角色仍保持拉黑状态。",
      );
      state.onStorageError(error, "保存道歉短信");
    }
  }

  async function generateRecord(record) {
    const normalizedRecord = model.normalizeSmsRecord(record);
    const recordId = normalizedRecord?.id || "";
    if (
      !recordId ||
      normalizedRecord.role !== model.ROLE.ASSISTANT ||
      state.generating.has(recordId)
    ) {
      return;
    }

    state.generating.add(recordId);
    render();

    try {
      const characterMessages = state.data.messages.filter(
        (message) => message.characterId === normalizedRecord.characterId,
      );
      const outcome = await state.replyService.generate(
        normalizedRecord,
        characterMessages,
        {
          isReading: isReadingCharacter(normalizedRecord.characterId),
        },
      );
      state.data = outcome.data;
      if (
        outcome.ok &&
        isReadingCharacter(normalizedRecord.characterId)
      ) {
        await markRead(normalizedRecord.characterId);
      }
    } catch (error) {
      showFeedback(
        "error",
        "无法保存短信失败状态",
        error?.message ||
          "短信生成失败，失败原因也没有写入本机。",
        "刷新页面后重试；如果仍然失败，请检查浏览器存储空间。",
      );
      state.onStorageError(error, "保存短信失败状态");
    } finally {
      state.generating.delete(recordId);
      render();
    }
  }

  async function handleComposerSubmit(event) {
    event.preventDefault();
    await sendSms();
  }

  async function sendSms() {
    const characterId = model.normalizeId(state.selectedCharacterId);
    const input = elements["sms-input"];
    const content = String(input?.value || "").trim().slice(0, 2000);
    if (!characterId || !content || state.sending) return;
    if (hasPendingReply(characterId)) {
      showFeedback(
        "error",
        "角色还在回复",
        "请等待当前短信回复完成后再发送下一条。",
        "如果回复长时间没有完成，请刷新页面后点击失败记录下方“重试”。",
      );
      return;
    }

    const characterMessages = state.data.messages.filter(
      (message) => message.characterId === characterId,
    );
    const latestAt = characterMessages.reduce(
      (latest, message) => Math.max(latest, message.createdAt),
      0,
    );
    const createdAt = Math.max(Date.now(), latestAt + 1);
    const userRecord = model.createSmsRecord({
      id: `sms-${createId()}`,
      characterId,
      content,
      createdAt,
      status: model.STATUS.SENT,
      readAt: createdAt,
      role: model.ROLE.USER,
      kind: model.KIND.MESSAGE,
    });
    const replyRecord = model.createSmsRecord({
      id: `sms-${createId()}`,
      characterId,
      createdAt: createdAt + 1,
      status: model.STATUS.SENDING,
      role: model.ROLE.ASSISTANT,
      kind: model.KIND.MESSAGE,
      replyToId: userRecord?.id,
    });
    if (!userRecord || !replyRecord) {
      showFeedback(
        "error",
        "无法创建短信",
        "短信内容或角色资料没有通过本机校验。",
        "确认内容不超过 2000 字后重试。",
      );
      return;
    }

    state.sending = true;
    hideFeedback();
    syncComposerState();
    try {
      const result = await store.addMany([userRecord, replyRecord]);
      const savedReply = result.records.find(
        (record) => record.id === replyRecord.id,
      );
      if (!result.added || !savedReply) {
        throw new Error("本机没有完成这条短信和待回复记录的共同保存。");
      }

      state.data = result.data;
      if (state.selectedCharacterId === characterId) {
        input.value = "";
        resizeComposerInput();
      }
      render();
      await generateRecord(savedReply);
    } catch (error) {
      showFeedback(
        "error",
        "短信没有发出",
        error?.message || "本机数据库没有接受这条短信。",
        "检查浏览器存储空间和隐私模式设置后重试；输入内容仍保留在输入框中。",
      );
      state.onStorageError(error, "保存短信");
    } finally {
      state.sending = false;
      syncComposerState();
    }
  }

  function handleComposerInput() {
    resizeComposerInput();
    syncComposerState();
  }

  function handleComposerKeydown(event) {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    elements["sms-composer"].requestSubmit();
  }

  function resizeComposerInput() {
    const input = elements["sms-input"];
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 104)}px`;
  }

  function hasPendingReply(characterId) {
    return state.data.messages.some(
      (message) =>
        message.characterId === characterId &&
        message.role === model.ROLE.ASSISTANT &&
        message.status === model.STATUS.SENDING,
    );
  }

  function syncComposerState() {
    const composer = elements["sms-composer"];
    const input = elements["sms-input"];
    const send = elements["sms-send"];
    const status = elements["sms-reply-status"];
    if (!composer || !input || !send || !status) return;

    const inThread = Boolean(state.selectedCharacterId);
    const pending = inThread && hasPendingReply(state.selectedCharacterId);
    const disabled = !inThread || pending || state.sending;
    composer.hidden = !inThread;
    composer.classList.toggle("is-generating", pending);
    composer.setAttribute("aria-busy", String(pending));
    input.disabled = disabled;
    send.disabled = disabled || !input.value.trim();
    send.setAttribute(
      "aria-label",
      pending ? "正在回复短信" : "发送短信",
    );
    status.hidden = !pending;
  }

  function render() {
    if (!state.initialized || !state.renderer) return;
    const groups = model.groupByCharacter(state.data);
    state.renderer.renderHomeBadge(groups);
    renderHeader();
    state.renderer.renderList(groups);
    renderThread(groups);
  }

  function renderHeader() {
    const inThread = Boolean(state.selectedCharacterId);
    elements["sms-back"].setAttribute(
      "aria-label",
      inThread ? "返回短信列表" : "返回主屏幕",
    );
    elements["sms-eyebrow"].textContent = inThread
      ? "SMS MESSAGES"
      : "MESSAGES";
    elements["sms-title"].textContent = inThread
      ? getCharacterName(state.selectedCharacterId)
      : "短信";
    elements["sms-list-panel"].hidden = inThread;
    elements["sms-thread-panel"].hidden = !inThread;
    syncComposerState();
  }

  function renderThread(groups) {
    const characterId = state.selectedCharacterId;
    if (!characterId) return;
    const group = groups.find(
      (item) => item.characterId === characterId,
    );
    state.renderer.renderThread({
      characterId,
      records: group?.messages || [],
      isBlocked:
        state.characters.find((item) => item.id === characterId)
          ?.isBlocked === true,
      active: state.activeView === "sms",
    });
    syncComposerState();
  }

  async function openConversation(characterId) {
    const id = model.normalizeId(characterId);
    if (!id) return;
    state.selectedCharacterId = id;
    elements["sms-input"].value = "";
    resizeComposerInput();
    renderHeader();
    await markRead(id);
    render();
  }

  function closeConversation() {
    state.selectedCharacterId = "";
    elements["sms-input"].value = "";
    resizeComposerInput();
    render();
    root.requestAnimationFrame(() => {
      elements["sms-scroll"].scrollTop = 0;
    });
  }

  function handleBack() {
    if (state.selectedCharacterId) {
      closeConversation();
      return;
    }
    state.onExit();
  }

  async function markRead(characterId) {
    try {
      state.data = await store.markRead(characterId);
    } catch (error) {
      state.onStorageError(error, "更新短信已读状态");
    }
  }

  function handleThreadAction(event) {
    const button = event.target.closest?.("[data-sms-retry-id]");
    if (!button) return;
    const recordId = model.normalizeId(button.dataset.smsRetryId);
    if (recordId) void retryRecord(recordId);
  }

  async function retryRecord(recordId) {
    if (state.generating.has(recordId)) return;
    const record = state.data.messages.find((item) => item.id === recordId);
    if (!record || record.status !== model.STATUS.FAILED) return;
    const prepared = model.prepareRetry(record);
    if (!prepared) return;

    state.generating.add(recordId);
    try {
      state.data = await store.update(recordId, () => prepared);
      render();
      state.generating.delete(recordId);
      await generateRecord(prepared);
    } catch (error) {
      showFeedback(
        "error",
        "无法开始重试",
        error?.message || "本机数据库没有接受重试状态。",
        "刷新页面后再试；原来的失败记录仍会保留。",
      );
      state.onStorageError(error, "准备重试短信");
    } finally {
      state.generating.delete(recordId);
      render();
    }
  }

  function isReadingCharacter(characterId) {
    return (
      state.activeView === "sms" &&
      state.selectedCharacterId === characterId
    );
  }

  function getCharacterName(characterId) {
    return (
      state.characters.find((character) => character.id === characterId)
        ?.name || "已删除角色"
    );
  }

  function getAvatarUrl(characterId) {
    return state.avatars.get(characterId)?.url || "";
  }

  function showFeedback(kind, title, message, nextStep = "") {
    const panel = elements["sms-feedback"];
    if (!panel) return;
    panel.hidden = false;
    panel.dataset.state = kind;
    elements["sms-feedback-title"].textContent = title;
    elements["sms-feedback-message"].textContent = message;
    elements["sms-feedback-next"].textContent = nextStep;
    elements["sms-feedback-next"].hidden = !nextStep;
  }

  function hideFeedback() {
    if (elements["sms-feedback"]) {
      elements["sms-feedback"].hidden = true;
    }
  }

  function setActive(active) {
    state.activeView = active === true ? "sms" : "";
  }

  function createId() {
    if (root.crypto && typeof root.crypto.randomUUID === "function") {
      return root.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  root.PocketLabSmsApp = Object.freeze({
    init,
    refresh,
    setActive,
    openConversation,
    closeConversation,
    renderHomeBadge: () => {
      if (!state.renderer) return;
      state.renderer.renderHomeBadge(
        model.groupByCharacter(state.data),
      );
    },
  });
})(window);
