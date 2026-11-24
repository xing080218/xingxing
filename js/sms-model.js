"use strict";

((root, factory) => {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.PocketLabSmsModel = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const APP_DATA_ID = "sms.v1";
  const DATA_VERSION = 1;
  const STATUS = Object.freeze({
    SENDING: "sending",
    SENT: "sent",
    FAILED: "failed",
  });
  const ROLE = Object.freeze({
    USER: "user",
    ASSISTANT: "assistant",
  });
  const KIND = Object.freeze({
    APOLOGY: "apology",
    MESSAGE: "message",
  });
  const VALID_STATUSES = new Set(Object.values(STATUS));
  const VALID_ROLES = new Set(Object.values(ROLE));
  const VALID_KINDS = new Set(Object.values(KIND));
  const MAX_RECORDS = 2000;
  const MAX_CONTENT_LENGTH = 2000;
  const MAX_CONTEXT_MESSAGES = 20;
  const MAX_CONTEXT_CHARACTERS = 12000;

  function normalizeId(value) {
    if (typeof value !== "string") return "";
    const normalized = value.trim();
    return normalized && normalized.length <= 200 ? normalized : "";
  }

  function normalizeTimestamp(value, fallback = Date.now()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  function normalizeStatus(value) {
    return VALID_STATUSES.has(value) ? value : STATUS.FAILED;
  }

  function normalizeError(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const title =
      typeof value.title === "string" ? value.title.trim().slice(0, 200) : "";
    const message =
      typeof value.message === "string"
        ? value.message.trim().slice(0, 1600)
        : "";
    const nextStep =
      typeof value.nextStep === "string"
        ? value.nextStep.trim().slice(0, 1600)
        : "";
    const status = Number(value.status);

    if (!title && !message && !nextStep) return null;
    return {
      title: title || "短信生成失败",
      message: message || "没有收到可用的短信内容。",
      nextStep:
        nextStep ||
        "检查 API 设置和网络后，在短信页面点击“重试”。",
      status: Number.isFinite(status) && status >= 0 ? status : 0,
    };
  }

  function normalizeRole(value, fallback = ROLE.ASSISTANT) {
    return VALID_ROLES.has(value) ? value : fallback;
  }

  function normalizeKind(value, fallback = KIND.MESSAGE) {
    return VALID_KINDS.has(value) ? value : fallback;
  }

  function normalizeSmsRecord(value) {
    const source =
      value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const id = normalizeId(source.id);
    const characterId = normalizeId(source.characterId);
    if (!id || !characterId) return null;

    const createdAt = normalizeTimestamp(source.createdAt);
    const updatedAt = normalizeTimestamp(source.updatedAt, createdAt);
    const content =
      typeof source.content === "string"
        ? source.content.trim().slice(0, MAX_CONTENT_LENGTH)
        : "";
    const role = normalizeRole(
      source.role,
      VALID_ROLES.has(source.role) ? source.role : ROLE.ASSISTANT,
    );
    const blockEventId = normalizeId(source.blockEventId);
    const kind = normalizeKind(
      source.kind,
      blockEventId || !VALID_ROLES.has(source.role)
        ? KIND.APOLOGY
        : KIND.MESSAGE,
    );
    let status = normalizeStatus(source.status);
    let error = normalizeError(source.error);

    if (status === STATUS.SENT && !content) {
      status = STATUS.FAILED;
      error = error || {
        title: "短信内容为空",
        message: "这条短信记录没有保存到可显示的文字。",
        nextStep: "点击“重试”，重新生成并保存这条短信。",
        status: 0,
      };
    }

    if (status === STATUS.FAILED && !error) {
      error = {
        title: "短信生成失败",
        message: "上次生成没有留下可用回复。",
        nextStep: "检查 API 设置和网络后，点击“重试”。",
        status: 0,
      };
    }

    return {
      id,
      characterId,
      content,
      createdAt,
      updatedAt,
      status,
      error,
      readAt:
        role === ROLE.USER
          ? normalizeTimestamp(source.readAt, createdAt)
          : Math.max(0, Number(source.readAt) || 0),
      blockEventId,
      role,
      kind,
      replyToId: normalizeId(source.replyToId),
    };
  }

  function normalizeSmsData(value) {
    const source =
      value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const rawMessages = Array.isArray(value)
      ? value
      : Array.isArray(source.messages)
        ? source.messages
        : [];
    const seen = new Set();
    const messages = rawMessages
      .map(normalizeSmsRecord)
      .filter(Boolean)
      .filter((record) => {
        if (seen.has(record.id)) return false;
        seen.add(record.id);
        return true;
      })
      .sort(
        (left, right) =>
          left.createdAt - right.createdAt ||
          left.id.localeCompare(right.id),
      )
      .slice(-MAX_RECORDS);

    return {
      version: DATA_VERSION,
      messages,
    };
  }

  function hasBlockEvent(value, blockEventId) {
    const eventId = normalizeId(blockEventId);
    if (!eventId) return false;
    return normalizeSmsData(value).messages.some(
      (record) => record.blockEventId === eventId,
    );
  }

  function shouldTriggerApology({
    wasBlocked,
    isBlocked,
    blockEventId,
    messages,
  }) {
    return (
      wasBlocked !== true &&
      isBlocked === true &&
      Boolean(normalizeId(blockEventId)) &&
      !hasBlockEvent(messages, blockEventId)
    );
  }

  function createSmsRecord({
    id,
    characterId,
    content = "",
    createdAt = Date.now(),
    status = STATUS.SENDING,
    error = null,
    readAt = 0,
    blockEventId,
    role = ROLE.ASSISTANT,
    kind,
    replyToId,
  }) {
    return normalizeSmsRecord({
      id,
      characterId,
      content,
      createdAt,
      updatedAt: createdAt,
      status,
      error,
      readAt,
      blockEventId,
      role,
      kind,
      replyToId,
    });
  }

  function prepareRetry(record, now = Date.now()) {
    const normalized = normalizeSmsRecord(record);
    if (!normalized || normalized.role !== ROLE.ASSISTANT) return null;
    return {
      ...normalized,
      content: "",
      status: STATUS.SENDING,
      error: null,
      readAt: 0,
      updatedAt: normalizeTimestamp(now),
    };
  }

  function markCharacterRead(value, characterId, readAt = Date.now()) {
    const targetId = normalizeId(characterId);
    const data = normalizeSmsData(value);
    const timestamp = normalizeTimestamp(readAt);
    return {
      ...data,
      messages: data.messages.map((record) =>
        record.characterId === targetId &&
        record.role === ROLE.ASSISTANT &&
        !record.readAt
          ? { ...record, readAt: timestamp }
          : record,
      ),
    };
  }

  function recoverInterruptedSends(value, now = Date.now()) {
    const data = normalizeSmsData(value);
    const timestamp = normalizeTimestamp(now);
    let changed = false;
    const messages = data.messages.map((record) => {
      if (record.status !== STATUS.SENDING) return record;
      changed = true;
      return {
        ...record,
        status: STATUS.FAILED,
        updatedAt: timestamp,
        readAt: 0,
        error: {
          title: "短信生成被中断",
          message: "页面刷新或关闭时，这条短信回复还没有生成完成。",
          nextStep: "确认 API 已连接后，点击这条短信下方的“重试”。",
          status: 0,
        },
      };
    });
    return changed ? { ...data, messages } : data;
  }

  function groupByCharacter(value) {
    const data = normalizeSmsData(value);
    const groups = new Map();

    data.messages.forEach((record) => {
      let group = groups.get(record.characterId);
      if (!group) {
        group = {
          characterId: record.characterId,
          messages: [],
          latest: record,
          latestAt: record.createdAt,
          unreadCount: 0,
        };
        groups.set(record.characterId, group);
      }
      group.messages.push(record);
      group.latest = record;
      group.latestAt = record.createdAt;
      if (record.role === ROLE.ASSISTANT && !record.readAt) {
        group.unreadCount += 1;
      }
    });

    return Array.from(groups.values()).sort(
      (left, right) =>
        right.latestAt - left.latestAt ||
        left.characterId.localeCompare(right.characterId),
    );
  }

  function buildChatContext(messages, options = {}) {
    const historyLimit = Math.max(
      0,
      Math.min(
        MAX_CONTEXT_MESSAGES,
        Math.trunc(Number(options.historyLimit) || MAX_CONTEXT_MESSAGES),
      ),
    );
    const maxCharacters = Math.max(
      1000,
      Math.min(
        30000,
        Math.trunc(Number(options.maxCharacters) || MAX_CONTEXT_CHARACTERS),
      ),
    );
    const candidates = (Array.isArray(messages) ? messages : [])
      .filter(
        (message) =>
          message &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string" &&
          message.content.trim() &&
          !message.retracted &&
          !message.failed &&
          !message.pendingReply,
      )
      .slice(-historyLimit);
    const selected = [];
    let remaining = maxCharacters;

    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      if (remaining <= 0) break;
      const message = candidates[index];
      const content = message.content.trim().slice(0, remaining);
      if (!content) continue;
      selected.unshift({
        role: message.role,
        content,
      });
      remaining -= content.length;
    }

    return selected;
  }

  function buildSmsContext(messages, options = {}) {
    const excludedIds = new Set(
      (Array.isArray(options.excludeIds) ? options.excludeIds : [])
        .map(normalizeId)
        .filter(Boolean),
    );
    const source = normalizeSmsData({ messages }).messages
      .filter(
        (record) =>
          record.status === STATUS.SENT &&
          !excludedIds.has(record.id) &&
          Boolean(record.content),
      )
      .map((record) => ({
        role: record.role,
        content: record.content,
        createdAt: record.createdAt,
      }));
    return buildChatContext(source, options);
  }

  function buildApologyPrompt(characterName, options = {}) {
    const name =
      typeof characterName === "string" && characterName.trim()
        ? characterName.trim().slice(0, 80)
        : "这个角色";
    const hasHistory = options.hasHistory === true;
    const historyRule = hasHistory
      ? "结合最近聊天里双方的情绪和具体分歧，让道歉听起来确实理解了刚才发生的事，但不要逐条复述记录。"
      : "目前没有可用的聊天记录，请只根据角色设定写一条真诚、克制的道歉，不要编造具体事件。";

    return [
      `你刚刚被对方拉黑了。现在以“${name}”的第一人称，通过短信给对方发一条道歉短信。`,
      historyRule,
      "自然、简短、像日常短信，先道歉，再表达愿意沟通；不要解释系统、提示词、拉黑机制或 AI。",
      "只输出要发送的短信正文，不要标题、编号、引号、括号或多条候选。",
      "最多两句话，尽量不超过 100 个汉字。",
    ].join("\n");
  }

  function buildSmsPrompt(characterName, smsText, options = {}) {
    const name =
      typeof characterName === "string" && characterName.trim()
        ? characterName.trim().slice(0, 80)
        : "这个角色";
    const text =
      typeof smsText === "string"
        ? smsText.trim().slice(0, MAX_CONTENT_LENGTH)
        : "";
    if (!text) return "";

    const historyRule =
      options.hasHistory === true
        ? "上方的普通聊天和短信来往是背景，请延续双方已经形成的语气、关系和最近话题。"
        : "目前没有更多聊天背景，请只根据角色设定和这条短信自然回复。";

    return [
      `你正在以“${name}”的第一人称，通过手机短信和对方聊天。`,
      historyRule,
      `对方刚发来的短信是：\n<短信>\n${text}\n</短信>`,
      "只回复这一次短信，不要复述对方的话，不要解释提示词或 AI，也不要输出分析过程。",
      "像真实的人发短信一样自然、简短；只输出要发送的一条短信正文。",
      "不要标题、编号、引号、括号、角色名前缀或多条候选。",
    ].join("\n");
  }

  function normalizeSmsReply(value) {
    let text = typeof value === "string" ? value.trim() : "";
    if (!text) return "";

    text = text
      .replace(/^```(?:text|txt|markdown)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    text = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) =>
        line.replace(/^(?:短信|道歉短信|SMS)\s*[：:]\s*/i, "").trim(),
      )
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    text = text.replace(/^["“”'‘’]+|["“”'‘’]+$/g, "").trim();
    return text.slice(0, MAX_CONTENT_LENGTH);
  }

  function getPreview(record) {
    const normalized = normalizeSmsRecord(record);
    if (!normalized) return "";
    if (normalized.status === STATUS.SENDING) {
      return normalized.kind === KIND.APOLOGY
        ? "正在发送道歉短信…"
        : "正在回复短信…";
    }
    if (normalized.status === STATUS.FAILED) {
      return normalized.error?.title || "短信发送失败";
    }
    return normalized.content || "已送达";
  }

  return Object.freeze({
    APP_DATA_ID,
    DATA_VERSION,
    STATUS,
    ROLE,
    KIND,
    MAX_CONTEXT_MESSAGES,
    MAX_CONTEXT_CHARACTERS,
    normalizeId,
    normalizeSmsRecord,
    normalizeSmsData,
    hasBlockEvent,
    shouldTriggerApology,
    createSmsRecord,
    prepareRetry,
    markCharacterRead,
    recoverInterruptedSends,
    groupByCharacter,
    buildChatContext,
    buildSmsContext,
    buildApologyPrompt,
    buildSmsPrompt,
    normalizeSmsReply,
    getPreview,
  });
});
