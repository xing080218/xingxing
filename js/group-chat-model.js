"use strict";

((root, factory) => {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.PocketLabGroupChatModel = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const MAX_NAME_LENGTH = 40;
  const MAX_ANNOUNCEMENT_LENGTH = 4000;
  const MAX_BACKGROUND_LENGTH = 4000;
  const EMPTY_PREVIEW = "群聊已创建，暂无公告";

  function normalizeStableId(value) {
    if (typeof value !== "string") return "";
    const normalized = value.trim();
    return normalized && normalized.length <= 200 ? normalized : "";
  }

  function normalizeMultilineText(value, maxLength) {
    if (typeof value !== "string") return "";
    return value
      .replace(/\r\n?/gu, "\n")
      .trim()
      .slice(0, maxLength);
  }

  function normalizeGroupChat(value) {
    const source = value && typeof value === "object" ? value : {};
    const now = Date.now();
    return {
      id: normalizeStableId(source.id),
      name:
        typeof source.name === "string"
          ? source.name.trim().slice(0, MAX_NAME_LENGTH)
          : "",
      announcement: normalizeMultilineText(
        source.announcement,
        MAX_ANNOUNCEMENT_LENGTH,
      ),
      backgroundSetting: normalizeMultilineText(
        source.backgroundSetting,
        MAX_BACKGROUND_LENGTH,
      ),
      createdAt: Number.isFinite(Number(source.createdAt))
        ? Number(source.createdAt)
        : now,
      updatedAt: Number.isFinite(Number(source.updatedAt))
        ? Number(source.updatedAt)
        : now,
    };
  }

  function validateGroupChat(value) {
    const source = value && typeof value === "object" ? value : {};
    const rawName = typeof source.name === "string" ? source.name.trim() : "";
    const rawAnnouncement =
      typeof source.announcement === "string" ? source.announcement : "";
    const rawBackground =
      typeof source.backgroundSetting === "string"
        ? source.backgroundSetting
        : "";
    const errors = {};

    if (!rawName) {
      errors.name = "请填写群聊名称。";
    } else if (Array.from(rawName).length > MAX_NAME_LENGTH) {
      errors.name = `群聊名称不能超过 ${MAX_NAME_LENGTH} 个字符。`;
    }

    if (
      Array.from(normalizeMultilineText(rawAnnouncement, Number.MAX_SAFE_INTEGER))
        .length > MAX_ANNOUNCEMENT_LENGTH
    ) {
      errors.announcement =
        `群公告不能超过 ${MAX_ANNOUNCEMENT_LENGTH} 个字符。`;
    }

    if (
      Array.from(normalizeMultilineText(rawBackground, Number.MAX_SAFE_INTEGER))
        .length > MAX_BACKGROUND_LENGTH
    ) {
      errors.backgroundSetting =
        `群聊背景设定不能超过 ${MAX_BACKGROUND_LENGTH} 个字符。`;
    }

    return {
      ok: Object.keys(errors).length === 0,
      errors,
      value: normalizeGroupChat(source),
    };
  }

  function normalizePreview(value, maxLength = 80) {
    const text = String(value || "")
      .replace(/[\u200B-\u200D\uFEFF]/gu, "")
      .replace(/\s+/gu, " ")
      .trim();
    if (!text) return "";

    const characters = Array.from(text);
    const safeMaxLength = Math.max(1, Number(maxLength) || 80);
    if (characters.length <= safeMaxLength) return text;
    return `${characters.slice(0, safeMaxLength - 1).join("")}…`;
  }

  function getPreview(record, maxLength = 80) {
    const groupChat = normalizeGroupChat(record);
    return (
      normalizePreview(groupChat.announcement, maxLength) ||
      normalizePreview(groupChat.backgroundSetting, maxLength) ||
      EMPTY_PREVIEW
    );
  }

  function sortGroupChats(records) {
    return (Array.isArray(records) ? records : [])
      .map((record, index) => ({
        record: normalizeGroupChat(record),
        index,
      }))
      .sort(
        (left, right) =>
          Number(right.record.updatedAt || 0) -
            Number(left.record.updatedAt || 0) ||
          Number(right.record.createdAt || 0) -
            Number(left.record.createdAt || 0) ||
          left.index - right.index,
      )
      .map((entry) => entry.record);
  }

  return Object.freeze({
    MAX_NAME_LENGTH,
    MAX_ANNOUNCEMENT_LENGTH,
    MAX_BACKGROUND_LENGTH,
    EMPTY_PREVIEW,
    normalizeStableId,
    normalizeGroupChat,
    validateGroupChat,
    normalizePreview,
    getPreview,
    sortGroupChats,
  });
});
