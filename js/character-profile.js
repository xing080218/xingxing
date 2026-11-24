"use strict";

((root, factory) => {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.PocketLabCharacterProfile = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const PRIMARY_CHARACTER_ID = "primary-character";
  const DEFAULT_MAX_CONSECUTIVE_MESSAGES = 3;
  const MIN_CONSECUTIVE_MESSAGES = 1;
  const MAX_CONSECUTIVE_MESSAGES = 10;
  const MAX_CHARACTER_NAME_LENGTH = 24;
  const MAX_PERSONA_LENGTH = 4000;
  const defaultCharacter = Object.freeze({
    id: PRIMARY_CHARACTER_ID,
    name: "小雾",
    persona:
      "你是小雾，一个住在虚拟小手机里的陪伴角色。请用自然、简洁的中文和对方聊天，保持角色设定，不要替对方说话。",
    avatarId: "",
    chatBackgroundImageId: "",
    worldBookId: "",
    selfProfileId: "",
    maxConsecutiveMessages: DEFAULT_MAX_CONSECUTIVE_MESSAGES,
    isBlocked: false,
  });

  function normalizeStableId(value, fallback = "") {
    if (typeof value !== "string") return fallback;
    const normalized = value.trim();
    if (!normalized || normalized.length > 200) return fallback;
    return normalized;
  }

  function normalizeMaxConsecutiveMessages(
    value,
    fallback = DEFAULT_MAX_CONSECUTIVE_MESSAGES,
  ) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return Math.min(
        MAX_CONSECUTIVE_MESSAGES,
        Math.max(MIN_CONSECUTIVE_MESSAGES, Math.round(Number(fallback) || DEFAULT_MAX_CONSECUTIVE_MESSAGES)),
      );
    }
    return Math.min(
      MAX_CONSECUTIVE_MESSAGES,
      Math.max(MIN_CONSECUTIVE_MESSAGES, Math.round(parsed)),
    );
  }

  function normalizeCharacter(value, options = {}) {
    const source = value && typeof value === "object" ? value : {};
    const fallback = options.fallback || defaultCharacter;
    const id = normalizeStableId(
      source.id,
      normalizeStableId(options.defaultId, fallback.id || PRIMARY_CHARACTER_ID),
    );
    const name =
      typeof source.name === "string" && source.name.trim()
        ? source.name.trim().slice(0, MAX_CHARACTER_NAME_LENGTH)
        : fallback.name;
    const persona =
      typeof source.persona === "string" && source.persona.trim()
        ? source.persona.trim().slice(0, MAX_PERSONA_LENGTH)
        : fallback.persona;
    const avatarId = normalizeStableId(source.avatarId);
    const chatBackgroundImageId = normalizeStableId(source.chatBackgroundImageId);
    const worldBookId = normalizeStableId(
      source.worldBookId,
      normalizeStableId(fallback.worldBookId),
    );
    const selfProfileId = normalizeStableId(
      source.selfProfileId,
      normalizeStableId(fallback.selfProfileId),
    );
    const now = Date.now();

    return {
      id,
      name,
      persona,
      avatarId,
      chatBackgroundImageId,
      worldBookId,
      selfProfileId,
      maxConsecutiveMessages: normalizeMaxConsecutiveMessages(
        source.maxConsecutiveMessages,
        fallback.maxConsecutiveMessages,
      ),
      isBlocked: source.isBlocked === true,
      createdAt: Number.isFinite(Number(source.createdAt))
        ? Number(source.createdAt)
        : now,
      updatedAt: Number.isFinite(Number(source.updatedAt))
        ? Number(source.updatedAt)
        : now,
    };
  }

  function normalizeMessageCharacterId(value, fallback = PRIMARY_CHARACTER_ID) {
    return normalizeStableId(value, normalizeStableId(fallback, PRIMARY_CHARACTER_ID));
  }

  function normalizeReplyLines(lines) {
    return (Array.isArray(lines) ? lines : [])
      .map((line) => (typeof line === "string" ? line.trim() : ""))
      .filter(Boolean);
  }

  function limitReplyLines(lines, maxConsecutiveMessages) {
    const normalized = normalizeReplyLines(lines);
    if (!normalized.length) return [];

    const limit = normalizeMaxConsecutiveMessages(maxConsecutiveMessages);
    if (normalized.length <= limit) return normalized;

    const visible = normalized.slice(0, limit - 1);
    visible.push(normalized.slice(limit - 1).join(" "));
    return visible;
  }

  return Object.freeze({
    PRIMARY_CHARACTER_ID,
    DEFAULT_MAX_CONSECUTIVE_MESSAGES,
    MIN_CONSECUTIVE_MESSAGES,
    MAX_CONSECUTIVE_MESSAGES,
    MAX_CHARACTER_NAME_LENGTH,
    MAX_PERSONA_LENGTH,
    defaultCharacter,
    normalizeStableId,
    normalizeMaxConsecutiveMessages,
    normalizeCharacter,
    normalizeMessageCharacterId,
    normalizeReplyLines,
    limitReplyLines,
  });
});
