"use strict";

((root) => {
  const state = {
    initialized: false,
    isPublishing: false,
    loadSequence: 0,
    normalizeError: null,
    posts: [],
    reactionService: null,
    retryingInteractions: new Set(),
  };
  const elements = {};

  function init(options = {}) {
    if (state.initialized) return refresh();
    cacheElements();
    if (
      !elements.feed ||
      !elements.modal ||
      !elements.form ||
      !root.PocketLabMomentsStore ||
      !root.PocketLabMomentsReactionService
    ) {
      throw new Error("朋友圈页面没有完成加载。");
    }

    state.normalizeError =
      typeof options.normalizeError === "function"
        ? options.normalizeError
        : null;
    bindEvents();
    state.reactionService = root.PocketLabMomentsReactionService.create({
      model: root.PocketLabMomentsModel,
      store: root.PocketLabMomentsStore,
      client: root.PocketLabMomentsReactionClient,
      storage: root.PocketLabStorage,
      normalizeError: state.normalizeError,
      onChange: (data) => {
        if (!state.initialized) return;
        state.posts = data.moments;
        renderPosts();
      },
    });
    state.initialized = true;
    return recoverInterruptedInteractions().then(refresh);
  }

  async function recoverInterruptedInteractions() {
    try {
      await state.reactionService.recoverInterrupted();
    } catch (error) {
      root.dispatchEvent(
        new CustomEvent("pocketlab:toast", {
          detail: {
            message:
              error?.message ||
              "朋友圈互动状态未能恢复，将重新读取现有内容。",
          },
        }),
      );
    }
  }

  function cacheElements() {
    [
      "publish-moment",
      "moments-feed",
      "moments-feed-scroll",
      "moments-composer-modal",
      "moments-composer-form",
      "moments-content",
      "moments-character-count",
      "moments-form-error",
      "moments-form-error-title",
      "moments-form-error-message",
      "moments-form-error-next",
      "close-moments-composer",
      "cancel-moments-composer",
      "submit-moment",
      "submit-moment-label",
    ].forEach((id) => {
      elements[id] = root.document.getElementById(id);
    });
    elements.modal = elements["moments-composer-modal"];
    elements.form = elements["moments-composer-form"];
    elements.feed = elements["moments-feed"];
    elements.textarea = elements["moments-content"];
  }

  function bindEvents() {
    elements["publish-moment"]?.addEventListener("click", openComposer);
    elements["close-moments-composer"]?.addEventListener(
      "click",
      closeComposer,
    );
    elements["cancel-moments-composer"]?.addEventListener(
      "click",
      closeComposer,
    );
    elements.form.addEventListener("submit", handlePublish);
    elements.textarea.addEventListener("input", handleContentInput);
    elements.modal.addEventListener("click", (event) => {
      if (event.target === elements.modal) closeComposer();
    });
    elements.feed.addEventListener("click", (event) => {
      const retryFeed =
        event.target instanceof Element
          ? event.target.closest("[data-retry-moments]")
          : null;
      if (retryFeed) {
        refresh();
        return;
      }

      const retryInteraction =
        event.target instanceof Element
          ? event.target.closest("[data-retry-moment-interaction]")
          : null;
      if (retryInteraction) {
        retryMomentInteraction(
          retryInteraction.dataset.momentId || "",
          retryInteraction.dataset.characterId || "",
        );
      }
    });
    root.document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isComposerOpen()) {
        closeComposer();
      }
    });
    root.addEventListener(
      "pocketlab:conversation-tab-changed",
      (event) => {
        if (event?.detail?.tab === "moments") {
          refresh();
          return;
        }
        closeComposer({ force: true });
      },
    );
  }

  async function refresh() {
    if (!state.initialized) return;
    const sequence = ++state.loadSequence;
    renderLoading();
    try {
      const data = await root.PocketLabMomentsStore.load();
      if (sequence !== state.loadSequence) return;
      state.posts = data.moments;
      renderPosts();
    } catch (error) {
      if (sequence !== state.loadSequence) return;
      renderLoadError(error);
    }
  }

  function renderLoading() {
    setFeedBusy(true);
    const status = root.document.createElement("div");
    status.className = "moments-state";
    status.setAttribute("role", "status");
    const title = root.document.createElement("strong");
    title.textContent = "正在读取朋友圈";
    const copy = root.document.createElement("p");
    copy.textContent = "正在从本机数据库读取已发布内容。";
    status.append(title, copy);
    elements.feed.replaceChildren(status);
  }

  function renderPosts() {
    setFeedBusy(false);
    if (!state.posts.length) {
      const empty = root.document.createElement("div");
      empty.className = "moments-state moments-empty";
      const mark = root.document.createElement("span");
      mark.className = "moments-empty-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = "我";
      const title = root.document.createElement("strong");
      title.textContent = "还没有朋友圈";
      const copy = root.document.createElement("p");
      copy.textContent = "点右上角的加号，发布第一条朋友圈。";
      empty.append(mark, title, copy);
      elements.feed.replaceChildren(empty);
      return;
    }

    const cards = state.posts.map(createPostCard);
    elements.feed.replaceChildren(...cards);
  }

  function createPostCard(post) {
    const article = root.document.createElement("article");
    article.className = "moment-card";
    article.dataset.momentId = post.id;

    const authorRow = root.document.createElement("div");
    authorRow.className = "moment-author";
    const avatar = root.document.createElement("span");
    avatar.className = "moment-author-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "我";

    const identity = root.document.createElement("span");
    identity.className = "moment-author-copy";
    const name = root.document.createElement("strong");
    name.textContent = "我";
    const time = root.document.createElement("time");
    const createdAt = new Date(post.createdAt);
    time.dateTime = Number.isNaN(createdAt.getTime())
      ? ""
      : createdAt.toISOString();
    time.textContent = formatTime(post.createdAt);
    identity.append(name, time);
    authorRow.append(avatar, identity);

    const content = root.document.createElement("p");
    content.className = "moment-content";
    content.textContent = post.content;
    article.append(authorRow, content);

    const interactions = createInteractionsPanel(post);
    if (interactions) article.append(interactions);
    return article;
  }

  function createInteractionsPanel(post) {
    const interactions = Array.isArray(post.interactions)
      ? post.interactions
      : [];
    if (!interactions.length) return null;

    const status = root.PocketLabMomentsModel.INTERACTION_STATUS;
    const sent = interactions.filter(
      (interaction) => interaction.status === status.SENT,
    );
    const pending = interactions.filter(
      (interaction) => interaction.status === status.PENDING,
    );
    const failed = interactions.filter(
      (interaction) => interaction.status === status.FAILED,
    );
    const panel = root.document.createElement("section");
    panel.className = "moment-interactions";
    panel.setAttribute("aria-label", "角色互动");

    const liked = sent.filter((interaction) => interaction.liked);
    if (liked.length) {
      const likes = root.document.createElement("p");
      likes.className = "moment-likes";
      const mark = root.document.createElement("span");
      mark.className = "moment-like-mark";
      mark.textContent = "赞";
      const names = root.document.createElement("span");
      names.textContent = liked
        .map((interaction) => interaction.characterName || "角色")
        .join("、");
      likes.append(mark, names);
      panel.append(likes);
    }

    const comments = sent.filter((interaction) => interaction.comment);
    if (comments.length) {
      const list = root.document.createElement("div");
      list.className = "moment-comments";
      comments.forEach((interaction) => {
        const comment = root.document.createElement("p");
        comment.className = "moment-comment";
        const name = root.document.createElement("strong");
        name.textContent = interaction.characterName || "角色";
        const copy = root.document.createElement("span");
        copy.textContent = interaction.comment;
        comment.append(name, copy);
        list.append(comment);
      });
      panel.append(list);
    }

    if (pending.length) {
      const loading = root.document.createElement("p");
      loading.className = "moment-reactions-pending";
      loading.setAttribute("role", "status");
      loading.textContent = `${pending
        .map((interaction) => interaction.characterName || "角色")
        .join("、")}正在看这条动态…`;
      panel.append(loading);
    }

    failed.forEach((interaction) => {
      const failure = interaction.error || {};
      const errorBox = root.document.createElement("div");
      errorBox.className = "moment-reaction-error";
      errorBox.setAttribute("role", "alert");

      const heading = root.document.createElement("div");
      heading.className = "moment-reaction-error-heading";
      const title = root.document.createElement("strong");
      title.textContent = `${interaction.characterName || "角色"}没有完成互动`;
      heading.append(title);
      if (Number(failure.status) > 0) {
        const httpStatus = root.document.createElement("span");
        httpStatus.textContent = `HTTP ${Number(failure.status)}`;
        heading.append(httpStatus);
      }

      const reason = root.document.createElement("p");
      reason.textContent = [
        failure.title,
        failure.message,
      ]
        .filter(Boolean)
        .join("：") || "模型服务没有返回可显示的原因。";
      const next = root.document.createElement("small");
      next.textContent =
        failure.nextStep ||
        "检查 API 设置和网络后，点击“重试”。";
      const retry = root.document.createElement("button");
      retry.type = "button";
      retry.dataset.retryMomentInteraction = "";
      retry.dataset.momentId = post.id;
      retry.dataset.characterId = interaction.characterId;
      retry.textContent = state.retryingInteractions.has(
        createInteractionKey(post.id, interaction.characterId),
      )
        ? "正在重试…"
        : "重试";
      retry.disabled = state.retryingInteractions.has(
        createInteractionKey(post.id, interaction.characterId),
      );
      errorBox.append(heading, reason, next, retry);
      panel.append(errorBox);
    });

    return panel;
  }

  function createInteractionKey(momentId, characterId) {
    return `${momentId}\u0000${characterId}`;
  }

  async function retryMomentInteraction(momentId, characterId) {
    const service = state.reactionService;
    const key = createInteractionKey(momentId, characterId);
    if (!service || !momentId || !characterId || state.retryingInteractions.has(key)) {
      return;
    }

    state.retryingInteractions.add(key);
    renderPosts();
    try {
      await service.retryInteraction(momentId, characterId);
    } catch (error) {
      const description = describeReactionError(error);
      root.dispatchEvent(
        new CustomEvent("pocketlab:toast", {
          detail: {
            message: `${description.title}：${description.message}`,
          },
        }),
      );
    } finally {
      state.retryingInteractions.delete(key);
      renderPosts();
    }
  }

  async function startCharacterInteractions(momentId) {
    if (!state.reactionService || !momentId) return;
    try {
      await state.reactionService.reactToMoment(momentId);
    } catch (error) {
      const description = describeReactionError(error);
      root.dispatchEvent(
        new CustomEvent("pocketlab:toast", {
          detail: {
            message: `${description.title}：${description.message}`,
          },
        }),
      );
    }
  }

  function describeReactionError(error) {
    if (state.normalizeError) {
      const normalized = state.normalizeError(error || {});
      if (normalized && typeof normalized === "object") {
        return {
          title: normalized.title || "角色互动失败",
          message:
            normalized.message ||
            "朋友圈已保存，但角色互动没有完成。",
        };
      }
    }
    return {
      title: "角色互动失败",
      message:
        error?.message ||
        "朋友圈已保存，但角色互动没有完成。",
    };
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "刚刚";
    return new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function renderLoadError(error) {
    setFeedBusy(false);
    const description = describeStorageError(error, "读取朋友圈");
    const status = root.document.createElement("div");
    status.className = "moments-state moments-state-error";
    status.setAttribute("role", "alert");
    const title = root.document.createElement("strong");
    title.textContent = description.title;
    const message = root.document.createElement("p");
    message.textContent = description.message;
    const next = root.document.createElement("p");
    next.textContent = description.nextStep;
    const retry = root.document.createElement("button");
    retry.type = "button";
    retry.dataset.retryMoments = "";
    retry.textContent = "重新读取";
    status.append(title, message, next, retry);
    elements.feed.replaceChildren(status);
  }

  function setFeedBusy(isBusy) {
    elements.feed.setAttribute("aria-busy", String(Boolean(isBusy)));
  }

  function openComposer() {
    if (isComposerOpen()) return;
    clearComposerError();
    elements.form.reset();
    updateCharacterCount();
    elements.modal.classList.remove("is-hidden");
    elements.modal.setAttribute("aria-hidden", "false");
    root.setTimeout(() => elements.textarea.focus(), 50);
  }

  function closeComposer(options = {}) {
    if (state.isPublishing && !options.force) return;
    if (!isComposerOpen()) return;
    elements.modal.classList.add("is-hidden");
    elements.modal.setAttribute("aria-hidden", "true");
    clearComposerError();
    if (!options.force) {
      elements["publish-moment"]?.focus();
    }
  }

  function isComposerOpen() {
    return (
      elements.modal &&
      !elements.modal.classList.contains("is-hidden")
    );
  }

  async function handlePublish(event) {
    event.preventDefault();
    if (state.isPublishing) return;
    const validation = root.PocketLabMomentsModel.validateContent(
      elements.textarea.value,
    );
    if (!validation.ok) {
      showComposerError(
        "还不能发布",
        validation.error,
        "内容需要为 1–2000 个字符；修改后再点“发布”。",
      );
      elements.textarea.focus();
      return;
    }

    setPublishing(true);
    clearComposerError();
    try {
      const result = await root.PocketLabMomentsStore.publish(validation.value);
      state.posts = result.data.moments;
      renderPosts();
      closeComposer({ force: true });
      elements["publish-moment"]?.focus();
      root.dispatchEvent(
        new CustomEvent("pocketlab:toast", {
          detail: { message: "朋友圈已发布。" },
        }),
      );
      void startCharacterInteractions(result.moment.id);
    } catch (error) {
      const description = describeStorageError(error, "发布朋友圈");
      showComposerError(
        description.title,
        description.message,
        description.nextStep,
      );
    } finally {
      setPublishing(false);
    }
  }

  function setPublishing(isPublishing) {
    state.isPublishing = Boolean(isPublishing);
    elements.form.setAttribute("aria-busy", String(state.isPublishing));
    elements.textarea.disabled = state.isPublishing;
    elements["close-moments-composer"].disabled = state.isPublishing;
    elements["cancel-moments-composer"].disabled = state.isPublishing;
    elements["submit-moment"].disabled = state.isPublishing;
    elements["submit-moment-label"].textContent = state.isPublishing
      ? "发布中…"
      : "发布";
  }

  function handleContentInput() {
    updateCharacterCount();
    clearComposerError();
  }

  function updateCharacterCount() {
    const count = Array.from(elements.textarea.value).length;
    elements["moments-character-count"].textContent =
      `${count} / ${root.PocketLabMomentsModel.MAX_CONTENT_LENGTH}`;
    elements["moments-character-count"].classList.toggle(
      "is-over-limit",
      count > root.PocketLabMomentsModel.MAX_CONTENT_LENGTH,
    );
  }

  function showComposerError(title, message, nextStep) {
    elements["moments-form-error-title"].textContent = title;
    elements["moments-form-error-message"].textContent = message;
    elements["moments-form-error-next"].textContent = nextStep;
    elements["moments-form-error"].classList.remove("is-hidden");
  }

  function clearComposerError() {
    elements["moments-form-error"]?.classList.add("is-hidden");
  }

  function describeStorageError(error, action) {
    if (
      root.PocketLabStorage &&
      typeof root.PocketLabStorage.describeError === "function"
    ) {
      return root.PocketLabStorage.describeError(error, action);
    }
    return {
      title: `${action}失败`,
      message: String(error?.message || "浏览器没有返回详细原因。"),
      nextStep: "刷新页面后重试；如果仍失败，请先保留本机数据。",
    };
  }

  root.PocketLabMomentsApp = Object.freeze({
    init,
    refresh,
    waitForIdle: () =>
      state.reactionService
        ? state.reactionService.waitForIdle()
        : Promise.resolve(),
  });
})(window);
