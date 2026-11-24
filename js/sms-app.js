"use strict";

((root) => {
  const model = root.PocketLabSmsModel;
  const store = root.PocketLabSmsStore;
  const client = root.PocketLabSmsClient;
  const storage = root.PocketLabStorage;
  const elements = {};
  const state = {
    initialized: false,
    loading: false,
    recovered: false,
    data: model ? model.normalizeSmsData(null) : { version: 1, messages: [] },
    characters: [],
    avatars: new Map(),
    generating: new Set(),
    selectedCharacterId: "",
    activeView: "",
    normalizeError: null,
    onExit: () => {},
    onStorageError: () => {},
    refreshSequence: 0,
  };

  function init(options = {}) {
    if (!model || !store || !client || !storage) {
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
    ].forEach((id) => {
      elements[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    elements["sms-back"].addEventListener("click", handleBack);
    elements["sms-thread"].addEventListener("click", handleThreadAction);
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
    const recordId = model.normalizeId(record?.id);
    if (!recordId || state.generating.has(recordId)) return;
    state.generating.add(recordId);
    render();

    try {
      const request = await buildGenerationRequest(record.characterId);
      const result = await client.generateApology(request);
      state.data = await store.update(recordId, (current) => ({
        ...current,
        content: result.content,
        status: model.STATUS.SENT,
        error: null,
        readAt: isReadingCharacter(current.characterId) ? Date.now() : 0,
        updatedAt: Date.now(),
      }));
      if (isReadingCharacter(record.characterId)) {
        // Marking a thread read is secondary to keeping the generated reply.
        // A read-state write failure must not turn a successful SMS into a failure.
        await markRead(record.characterId);
      }
    } catch (error) {
      const failure = describeGenerationError(error);
      try {
        state.data = await store.update(recordId, (current) => ({
          ...current,
          content: "",
          status: model.STATUS.FAILED,
          error: failure,
          readAt: isReadingCharacter(current.characterId) ? Date.now() : 0,
          updatedAt: Date.now(),
        }));
      } catch (storageError) {
        showFeedback(
          "error",
          "无法保存短信失败状态",
          storageError?.message ||
            "道歉短信生成失败，失败原因也没有写入本机。",
          "刷新页面后重试；如果仍然失败，请检查浏览器存储空间。",
        );
        state.onStorageError(storageError, "保存短信失败状态");
      }
    } finally {
      state.generating.delete(recordId);
      render();
    }
  }

  async function buildGenerationRequest(characterId) {
    const character = await storage.getCharacter(characterId);
    if (!character) {
      throw createFailure(
        "角色资料已不存在",
        "这条短信对应的角色已经被删除，无法继续读取人设和聊天记录。",
        "保留这条记录即可；如需新短信，请重新添加角色后再拉黑。",
      );
    }

    const settings = root.PocketLabSettings?.readApiSettings?.() || {};
    const apiUrl = String(settings.apiUrl || "").trim();
    const apiKey = String(settings.apiKey || "").trim();
    const modelName = String(settings.modelName || "").trim();
    if (!apiUrl || !apiKey || !modelName) {
      const missing = [
        !apiUrl ? "接口地址" : "",
        !apiKey ? "API Key" : "",
        !modelName ? "模型名" : "",
      ].filter(Boolean);
      throw createFailure(
        "尚未完成 API 配置",
        `缺少${missing.join("、")}，本次道歉短信没有发送到模型服务。`,
        "回到主屏幕打开“设置”，补齐 API 配置并完成连接测试，然后回到短信页点击“重试”。",
      );
    }

    let worldBook = null;
    if (character.worldBookId) {
      worldBook = await storage.getWorldBook(character.worldBookId);
      if (!worldBook) {
        throw createFailure(
          "角色绑定的世界书不存在",
          "本次短信没有调用模型，因为角色编辑中绑定的世界书已经找不到。",
          "打开角色编辑，重新选择世界书或改为“不绑定世界书”，再回来点击“重试”。",
        );
      }
    }

    const messages = await storage.getMessages(character.id);
    const selectedProfileId =
      typeof character.selfProfileId === "string"
        ? character.selfProfileId.trim()
        : "";
    const selectedProfile = selectedProfileId
      ? root.PocketLabSelfProfileApp?.getProfileById?.(selectedProfileId)
      : null;
    const userProfile =
      selectedProfile ||
      root.PocketLabSelfProfileApp?.getActiveProfile?.() ||
      null;

    return {
      config: {
        apiUrl,
        apiKey,
        modelName,
      },
      character,
      messages,
      worldBook,
      userProfile,
    };
  }

  function describeGenerationError(error) {
    if (error?.smsFailure) {
      return normalizeFailure(error.smsFailure);
    }
    if (error?.name === "AbortError") {
      return normalizeFailure({
        title: "道歉短信生成超时",
        message: `等待模型服务超过约 ${Math.round(
          client.DEFAULT_TIMEOUT_MS / 1000,
        )} 秒，没有收到完整短信。`,
        nextStep:
          "检查网络和服务商状态后点击“重试”；若连续超时，可换用响应更快的普通对话模型。",
        status: 0,
      });
    }

    const source = error?.apiError
      ? { ...error.apiError, status: error.status || error.apiError.status }
      : {
          title: "道歉短信生成失败",
          message: error?.message || "短信生成服务没有返回可用结果。",
          nextStep:
            "先确认电脑入口仍能打开，再到设置页运行连接测试；完成后回到这里点击“重试”。",
          status: Number(error?.status) || 0,
        };
    const normalized = state.normalizeError
      ? state.normalizeError(source)
      : source;
    return normalizeFailure({
      ...source,
      ...normalized,
      status:
        Number(source.status) ||
        Number(normalized?.status) ||
        0,
    });
  }

  function normalizeFailure(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      title: String(source.title || "道歉短信生成失败").slice(0, 200),
      message: String(
        source.message || "模型服务没有返回可显示的文字。",
      ).slice(0, 1600),
      nextStep: String(
        source.nextStep ||
          "检查 API 设置和网络后，在短信页面点击“重试”。",
      ).slice(0, 1600),
      status: Math.max(0, Number(source.status) || 0),
    };
  }

  function createFailure(title, message, nextStep) {
    const error = new Error(message);
    error.name = "SmsFailure";
    error.smsFailure = { title, message, nextStep, status: 0 };
    return error;
  }

  function render() {
    if (!state.initialized) return;
    const groups = model.groupByCharacter(state.data);
    renderHomeBadge(groups);
    renderHeader();
    renderList(groups);
    renderThread();
  }

  function renderHeader() {
    const inThread = Boolean(state.selectedCharacterId);
    elements["sms-back"].setAttribute(
      "aria-label",
      inThread ? "返回短信列表" : "返回主屏幕",
    );
    elements["sms-eyebrow"].textContent = inThread
      ? "APOLOGY MESSAGES"
      : "MESSAGES";
    elements["sms-title"].textContent = inThread
      ? getCharacterName(state.selectedCharacterId)
      : "短信";
    elements["sms-list-panel"].hidden = inThread;
    elements["sms-thread-panel"].hidden = !inThread;
  }

  function renderList(groups) {
    elements["sms-list"].replaceChildren();
    elements["sms-list-summary"].textContent = groups.length
      ? `${groups.length} 位角色`
      : "";
    elements["sms-empty"].hidden = groups.length > 0;

    const fragment = document.createDocumentFragment();
    groups.forEach((group) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "sms-conversation-row";
      row.setAttribute("role", "listitem");
      row.dataset.characterId = group.characterId;
      row.setAttribute(
        "aria-label",
        `打开 ${getCharacterName(group.characterId)} 的道歉短信`,
      );

      const avatar = document.createElement("span");
      avatar.className = "sms-avatar sms-list-avatar";
      avatar.setAttribute("aria-hidden", "true");
      applyAvatar(avatar, group.characterId);

      const copy = document.createElement("span");
      copy.className = "sms-conversation-copy";
      const name = document.createElement("strong");
      name.textContent = getCharacterName(group.characterId);
      const preview = document.createElement("span");
      preview.className = "sms-conversation-preview";
      if (group.latest.status === model.STATUS.FAILED) {
        preview.classList.add("is-error");
      }
      preview.textContent = model.getPreview(group.latest);
      copy.append(name, preview);

      const meta = document.createElement("span");
      meta.className = "sms-conversation-meta";
      const time = document.createElement("time");
      time.dateTime = new Date(group.latestAt).toISOString();
      time.textContent = formatListTime(group.latestAt);
      meta.append(time);
      if (group.unreadCount > 0) {
        const unread = document.createElement("span");
        unread.className = "sms-unread-count";
        unread.textContent =
          group.unreadCount > 99 ? "99+" : String(group.unreadCount);
        meta.append(unread);
      }

      row.append(avatar, copy, meta);
      row.addEventListener("click", () =>
        openConversation(group.characterId),
      );
      fragment.append(row);
    });
    elements["sms-list"].append(fragment);
  }

  function renderThread() {
    const characterId = state.selectedCharacterId;
    if (!characterId) return;

    const group = model
      .groupByCharacter(state.data)
      .find((item) => item.characterId === characterId);
    const records = group?.messages || [];
    elements["sms-thread-name"].textContent = getCharacterName(characterId);
    applyAvatar(elements["sms-thread-avatar"], characterId);
    elements["sms-thread-contact"].classList.toggle(
      "is-blocked",
      state.characters.find((item) => item.id === characterId)?.isBlocked ===
        true,
    );
    elements["sms-thread-meta"].textContent = records.length
      ? `${records.length} 条道歉短信`
      : "暂无短信";
    elements["sms-thread-empty"].hidden = records.length > 0;
    elements["sms-thread"].replaceChildren();

    const fragment = document.createDocumentFragment();
    records.forEach((record) => {
      fragment.append(createMessageBubble(record));
    });
    elements["sms-thread"].append(fragment);

    if (state.activeView === "sms") {
      root.requestAnimationFrame(() => {
        elements["sms-scroll"].scrollTop =
          elements["sms-scroll"].scrollHeight;
      });
    }
  }

  function createMessageBubble(record) {
    const article = document.createElement("article");
    article.className = `sms-message is-${record.status}`;
    article.dataset.recordId = record.id;

    const bubble = document.createElement("div");
    bubble.className = "sms-message-bubble";
    if (record.status === model.STATUS.SENT) {
      const text = document.createElement("p");
      text.textContent = record.content;
      bubble.append(text);
    } else if (record.status === model.STATUS.SENDING) {
      const sending = document.createElement("p");
      sending.className = "sms-message-sending";
      sending.textContent = "正在发送道歉短信";
      const dots = document.createElement("span");
      dots.className = "sms-typing-dots";
      dots.setAttribute("aria-hidden", "true");
      dots.append(
        document.createElement("span"),
        document.createElement("span"),
        document.createElement("span"),
      );
      bubble.append(sending, dots);
    } else {
      const title = document.createElement("strong");
      title.textContent = record.error?.title || "道歉短信生成失败";
      const message = document.createElement("p");
      message.textContent =
        record.error?.message || "服务商没有返回可用短信。";
      bubble.append(title, message);
      if (record.error?.nextStep) {
        const next = document.createElement("small");
        next.textContent = record.error.nextStep;
        bubble.append(next);
      }
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "sms-retry-button";
      retry.dataset.smsRetryId = record.id;
      retry.textContent =
        state.generating.has(record.id) ? "正在重试" : "重试";
      retry.disabled = state.generating.has(record.id);
      bubble.append(retry);
    }

    const time = document.createElement("time");
    time.className = "sms-message-time";
    time.dateTime = new Date(record.updatedAt || record.createdAt).toISOString();
    time.textContent = formatMessageTime(record.updatedAt || record.createdAt);
    article.append(bubble, time);
    return article;
  }

  async function openConversation(characterId) {
    const id = model.normalizeId(characterId);
    if (!id) return;
    state.selectedCharacterId = id;
    renderHeader();
    await markRead(id);
    render();
    root.requestAnimationFrame(() => {
      elements["sms-scroll"].scrollTop = 0;
    });
  }

  function closeConversation() {
    state.selectedCharacterId = "";
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
      state.onStorageError(error, "准备重试道歉短信");
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

  function applyAvatar(node, characterId) {
    if (!node) return;
    const avatar = state.avatars.get(characterId);
    node.classList.toggle("has-image", Boolean(avatar?.url));
    node.style.backgroundImage = avatar?.url
      ? `url("${avatar.url}")`
      : "";
    node.textContent = avatar?.url
      ? ""
      : firstCharacter(getCharacterName(characterId));
  }

  function firstCharacter(value) {
    return Array.from(String(value || "").trim())[0] || "?";
  }

  function renderHomeBadge(groups = model.groupByCharacter(state.data)) {
    if (!elements["sms-unread-badge"]) return;
    const unread = groups.reduce(
      (total, group) => total + group.unreadCount,
      0,
    );
    elements["sms-unread-badge"].hidden = unread === 0;
    elements["sms-unread-badge"].textContent =
      unread > 99 ? "99+" : String(unread);
    const appButton = document.getElementById("open-sms-app");
    appButton?.setAttribute(
      "aria-label",
      unread ? `打开短信，${unread} 条未读` : "打开短信",
    );
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

  function formatListTime(value) {
    const date = new Date(Number(value) || Date.now());
    const now = new Date();
    const sameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    if (sameDay) {
      return new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date);
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getFullYear() === yesterday.getFullYear() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getDate() === yesterday.getDate();
    if (isYesterday) return "昨天";
    return new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric",
    }).format(date);
  }

  function formatMessageTime(value) {
    const date = new Date(Number(value) || Date.now());
    return new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
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
    renderHomeBadge: () => renderHomeBadge(),
  });
})(window);
