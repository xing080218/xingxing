"use strict";

((root) => {
  const model = root.PocketLabSmsModel;

  function createRenderer(options = {}) {
    if (!model) {
      throw new Error("短信渲染组件缺少数据模型。");
    }

    const elements =
      options.elements && typeof options.elements === "object"
        ? options.elements
        : {};
    const getCharacterName =
      typeof options.getCharacterName === "function"
        ? options.getCharacterName
        : () => "已删除角色";
    const getAvatarUrl =
      typeof options.getAvatarUrl === "function"
        ? options.getAvatarUrl
        : () => "";
    const onOpenConversation =
      typeof options.onOpenConversation === "function"
        ? options.onOpenConversation
        : () => {};
    const isGenerating =
      typeof options.isGenerating === "function"
        ? options.isGenerating
        : () => false;

    function renderList(groups) {
      const list = elements["sms-list"];
      if (!list) return;

      list.replaceChildren();
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
          `打开 ${getCharacterName(group.characterId)} 的短信对话`,
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
          onOpenConversation(group.characterId),
        );
        fragment.append(row);
      });
      list.append(fragment);
    }

    function renderThread({
      characterId,
      records = [],
      isBlocked = false,
      active = false,
    } = {}) {
      if (!characterId) return;

      elements["sms-thread-name"].textContent =
        getCharacterName(characterId);
      applyAvatar(elements["sms-thread-avatar"], characterId);
      elements["sms-thread-contact"].classList.toggle(
        "is-blocked",
        isBlocked === true,
      );
      elements["sms-thread-meta"].textContent = records.length
        ? `${records.length} 条短信`
        : "暂无短信";
      elements["sms-thread-empty"].hidden = records.length > 0;
      elements["sms-thread"].replaceChildren();

      const fragment = document.createDocumentFragment();
      records.forEach((record) => {
        fragment.append(createMessageBubble(record));
      });
      elements["sms-thread"].append(fragment);

      if (active) {
        root.requestAnimationFrame(() => {
          elements["sms-scroll"].scrollTop =
            elements["sms-scroll"].scrollHeight;
        });
      }
    }

    function createMessageBubble(record) {
      const article = document.createElement("article");
      article.className = `sms-message is-${record.status}`;
      article.classList.toggle(
        "is-user",
        record.role === model.ROLE.USER,
      );
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
        sending.textContent =
          record.kind === model.KIND.APOLOGY
            ? "正在发送道歉短信"
            : "正在回复短信";
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
        title.textContent = record.error?.title || "短信生成失败";
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
        retry.textContent = isGenerating(record.id) ? "正在重试" : "重试";
        retry.disabled = isGenerating(record.id);
        bubble.append(retry);
      }

      const time = document.createElement("time");
      time.className = "sms-message-time";
      time.dateTime = new Date(
        record.updatedAt || record.createdAt,
      ).toISOString();
      time.textContent = formatMessageTime(
        record.updatedAt || record.createdAt,
      );
      article.append(bubble, time);
      return article;
    }

    function renderHomeBadge(groups) {
      const badge = elements["sms-unread-badge"];
      if (!badge) return;
      const unread = groups.reduce(
        (total, group) => total + group.unreadCount,
        0,
      );
      badge.hidden = unread === 0;
      badge.textContent = unread > 99 ? "99+" : String(unread);
      const appButton = document.getElementById("open-sms-app");
      appButton?.setAttribute(
        "aria-label",
        unread ? `打开短信，${unread} 条未读` : "打开短信",
      );
    }

    function applyAvatar(node, characterId) {
      if (!node) return;
      const url = getAvatarUrl(characterId);
      node.classList.toggle("has-image", Boolean(url));
      node.style.backgroundImage = url ? `url("${url}")` : "";
      node.textContent = url
        ? ""
        : firstCharacter(getCharacterName(characterId));
    }

    return Object.freeze({
      renderList,
      renderThread,
      renderHomeBadge,
    });
  }

  function firstCharacter(value) {
    return Array.from(String(value || "").trim())[0] || "?";
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

  root.PocketLabSmsRenderer = Object.freeze({
    create: createRenderer,
  });
})(window);
