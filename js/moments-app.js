"use strict";

((root) => {
  const state = {
    initialized: false,
    isPublishing: false,
    loadSequence: 0,
    posts: [],
  };
  const elements = {};

  function init() {
    if (state.initialized) return Promise.resolve();
    cacheElements();
    if (
      !elements.feed ||
      !elements.modal ||
      !elements.form ||
      !root.PocketLabMomentsStore
    ) {
      throw new Error("朋友圈页面没有完成加载。");
    }

    bindEvents();
    state.initialized = true;
    return refresh();
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
      const target =
        event.target instanceof Element
          ? event.target.closest("[data-retry-moments]")
          : null;
      if (target) refresh();
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
    return article;
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
  });
})(window);
