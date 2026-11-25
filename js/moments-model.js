"use strict";

((root, factory) => {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.PocketLabMomentsModel = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const APP_DATA_ID = "moments.v1";
  const VERSION = 1;
  const MAX_CONTENT_LENGTH = 2000;

  let fallbackIdSequence = 0;

  function normalizeStableId(value) {
    if (typeof value !== "string") return "";
    const normalized = value.trim();
    return normalized && normalized.length <= 200 ? normalized : "";
  }

  function normalizeTimestamp(value, fallback) {
    const timestamp = Number(value);
    return Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : fallback;
  }

  function normalizeContent(value) {
    if (typeof value !== "string") return "";
    const normalized = value
      .replace(/\r\n?/gu, "\n")
      .trim();
    return Array.from(normalized).slice(0, MAX_CONTENT_LENGTH).join("");
  }

  function validateContent(value) {
    if (typeof value !== "string") {
      return {
        ok: false,
        error: "请写一点想发布的内容。",
        value: "",
      };
    }

    const normalized = value.replace(/\r\n?/gu, "\n").trim();
    const characters = Array.from(normalized);
    if (!characters.length) {
      return {
        ok: false,
        error: "请写一点想发布的内容。",
        value: "",
      };
    }
    if (characters.length > MAX_CONTENT_LENGTH) {
      return {
        ok: false,
        error: `朋友圈内容不能超过 ${MAX_CONTENT_LENGTH} 个字符。`,
        value: characters.slice(0, MAX_CONTENT_LENGTH).join(""),
      };
    }

    return {
      ok: true,
      error: "",
      value: normalized,
    };
  }

  function normalizeMoment(value, now = Date.now()) {
    const source = value && typeof value === "object" ? value : {};
    return {
      id: normalizeStableId(source.id),
      content: normalizeContent(source.content),
      createdAt: normalizeTimestamp(source.createdAt, now),
      updatedAt: normalizeTimestamp(source.updatedAt, now),
    };
  }

  function sortMoments(records) {
    return (Array.isArray(records) ? records : [])
      .map((record, index) => ({
        record: normalizeMoment(record),
        index,
      }))
      .sort(
        (left, right) =>
          right.record.createdAt - left.record.createdAt ||
          right.record.updatedAt - left.record.updatedAt ||
          left.index - right.index,
      )
      .map((entry) => entry.record);
  }

  function normalizeMomentData(value) {
    const source = value && typeof value === "object" ? value : {};
    const seenIds = new Set();
    const moments = [];

    (Array.isArray(source.moments) ? source.moments : []).forEach((record) => {
      const moment = normalizeMoment(record);
      if (!moment.id || !moment.content || seenIds.has(moment.id)) return;
      seenIds.add(moment.id);
      moments.push(moment);
    });

    return {
      version: VERSION,
      moments: sortMoments(moments),
    };
  }

  function createId(now) {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return `moment-${crypto.randomUUID()}`;
    }
    fallbackIdSequence += 1;
    return `moment-${now}-${fallbackIdSequence}`;
  }

  function createMoment(value, options = {}) {
    const validation = validateContent(value);
    if (!validation.ok) {
      const error = new Error(validation.error);
      error.code = "INVALID_MOMENT_CONTENT";
      throw error;
    }

    const now = normalizeTimestamp(options.now, Date.now());
    const id = normalizeStableId(options.id) || createId(now);
    return {
      id,
      content: validation.value,
      createdAt: now,
      updatedAt: now,
    };
  }

  function addMoment(data, moment) {
    const normalizedMoment = normalizeMoment(moment);
    if (!normalizedMoment.id || !normalizedMoment.content) {
      throw new Error("朋友圈记录缺少稳定编号或内容。");
    }
    const normalizedData = normalizeMomentData(data);
    return normalizeMomentData({
      version: VERSION,
      moments: [normalizedMoment, ...normalizedData.moments],
    });
  }

  return Object.freeze({
    APP_DATA_ID,
    VERSION,
    MAX_CONTENT_LENGTH,
    normalizeStableId,
    normalizeContent,
    validateContent,
    normalizeMoment,
    normalizeMomentData,
    sortMoments,
    createMoment,
    addMoment,
  });
});
