"use strict";

((root, factory) => {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.PocketLabChatListModel = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const EMPTY_PREVIEW = "暂无消息";
  const LOADING_PREVIEW = "正在读取最新消息…";
  const WEEKDAY_LABELS = Object.freeze([
    "周日",
    "周一",
    "周二",
    "周三",
    "周四",
    "周五",
    "周六",
  ]);

  function toTimestamp(value) {
    const timestamp = Number(value);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return 0;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? 0 : timestamp;
  }

  function getLatestMessage(messages) {
    const source = Array.isArray(messages) ? messages : [];
    for (let index = source.length - 1; index >= 0; index -= 1) {
      const message = source[index];
      if (!message || message.retracted === true) continue;
      if (message.role !== "user" && message.role !== "assistant") continue;
      if (
        typeof message.content !== "string" ||
        !message.content.trim()
      ) {
        continue;
      }
      return message;
    }
    return null;
  }

  function normalizePreview(content, maxLength = 80) {
    const text = String(content || "")
      .replace(/[\u200B-\u200D\uFEFF]/gu, "")
      .replace(/\s+/gu, " ")
      .trim();
    if (!text) return EMPTY_PREVIEW;

    const characters = Array.from(text);
    const safeMaxLength = Math.max(1, Number(maxLength) || 80);
    if (characters.length <= safeMaxLength) return text;
    return `${characters.slice(0, safeMaxLength - 1).join("")}…`;
  }

  function formatClock(date) {
    return `${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes(),
    ).padStart(2, "0")}`;
  }

  function formatListTime(timestamp, nowValue = Date.now()) {
    const safeTimestamp = toTimestamp(timestamp);
    if (!safeTimestamp) return "";

    const now = new Date(nowValue);
    const date = new Date(safeTimestamp);
    if (Number.isNaN(now.getTime()) || Number.isNaN(date.getTime())) return "";

    const elapsedMs = now.getTime() - safeTimestamp;
    if (elapsedMs >= 0 && elapsedMs < 60 * 1000) return "刚刚";
    if (elapsedMs >= 60 * 1000 && elapsedMs < 60 * 60 * 1000) {
      return `${Math.max(1, Math.floor(elapsedMs / (60 * 1000)))}分钟前`;
    }

    const startOfNow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const startOfDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    ).getTime();
    const dayDifference = Math.round(
      (startOfNow - startOfDate) / (24 * 60 * 60 * 1000),
    );

    if (dayDifference <= 0) return formatClock(date);
    if (dayDifference === 1) return "昨天";
    if (dayDifference < 7) return WEEKDAY_LABELS[date.getDay()];
    if (date.getFullYear() === now.getFullYear()) {
      return `${date.getMonth() + 1}月${date.getDate()}日`;
    }
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function buildCharacterRows(entries, nowValue = Date.now()) {
    const source = Array.isArray(entries) ? entries : [];
    return source
      .map((entry, originalIndex) => {
        const character = entry && entry.character ? entry.character : null;
        if (!character) return null;

        const latestMessage = getLatestMessage(entry.messages);
        const timestamp = latestMessage
          ? toTimestamp(latestMessage.createdAt)
          : 0;
        return {
          character,
          latestMessage,
          timestamp,
          timeLabel: timestamp ? formatListTime(timestamp, nowValue) : "",
          preview: latestMessage
            ? normalizePreview(latestMessage.content)
            : EMPTY_PREVIEW,
          originalIndex,
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        if (left.timestamp && right.timestamp) {
          return (
            right.timestamp - left.timestamp ||
            left.originalIndex - right.originalIndex
          );
        }
        if (left.timestamp) return -1;
        if (right.timestamp) return 1;
        return left.originalIndex - right.originalIndex;
      });
  }

  return Object.freeze({
    EMPTY_PREVIEW,
    LOADING_PREVIEW,
    buildCharacterRows,
    formatListTime,
    getLatestMessage,
    normalizePreview,
  });
});
