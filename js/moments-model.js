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
  const VERSION = 2;
  const MAX_CONTENT_LENGTH = 2000;
  const MAX_COMMENT_LENGTH = 600;
  const INTERACTION_STATUS = Object.freeze({
    PENDING: "pending",
    SENT: "sent",
    FAILED: "failed",
  });

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

  function normalizeComment(value) {
    if (typeof value !== "string") return "";
    return Array.from(value.replace(/\r\n?/gu, "\n").trim())
      .slice(0, MAX_COMMENT_LENGTH)
      .join("");
  }

  function normalizeInteractionStatus(value) {
    return Object.values(INTERACTION_STATUS).includes(value)
      ? value
      : INTERACTION_STATUS.FAILED;
  }

  function normalizeInteractionError(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const title = String(value.title || "").trim().slice(0, 200);
    const message = String(value.message || "").trim().slice(0, 1600);
    const nextStep = String(value.nextStep || "").trim().slice(0, 1600);
    if (!title && !message && !nextStep) return null;
    return {
      title: title || "角色互动失败",
      message: message || "模型服务没有返回可显示的原因。",
      nextStep:
        nextStep || "检查 API 设置和网络后，点击这条动态上的“重试”。",
      status: Math.max(0, Number(value.status) || 0),
    };
  }

  function normalizeInteraction(value, now = Date.now()) {
    const source = value && typeof value === "object" ? value : {};
    return {
      characterId: normalizeStableId(source.characterId),
      characterName:
        typeof source.characterName === "string"
          ? source.characterName.trim().slice(0, 120)
          : "",
      liked: source.liked === true,
      comment: normalizeComment(source.comment),
      status: normalizeInteractionStatus(source.status),
      error: normalizeInteractionError(source.error),
      createdAt: normalizeTimestamp(source.createdAt, now),
      updatedAt: normalizeTimestamp(source.updatedAt, now),
    };
  }

  function normalizeInteractions(value, now = Date.now()) {
    const byCharacterId = new Map();
    (Array.isArray(value) ? value : []).forEach((record) => {
      const interaction = normalizeInteraction(record, now);
      if (!interaction.characterId) return;
      const existing = byCharacterId.get(interaction.characterId);
      if (!existing || interaction.updatedAt >= existing.updatedAt) {
        byCharacterId.set(interaction.characterId, interaction);
      }
    });
    return [...byCharacterId.values()];
  }

  function normalizeMoment(value, now = Date.now()) {
    const source = value && typeof value === "object" ? value : {};
    return {
      id: normalizeStableId(source.id),
      content: normalizeContent(source.content),
      createdAt: normalizeTimestamp(source.createdAt, now),
      updatedAt: normalizeTimestamp(source.updatedAt, now),
      interactions: normalizeInteractions(source.interactions, now),
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
      interactions: [],
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

  function getMoment(data, momentId) {
    const id = normalizeStableId(momentId);
    if (!id) return null;
    return (
      normalizeMomentData(data).moments.find((moment) => moment.id === id) ||
      null
    );
  }

  function createInteraction(value, options = {}) {
    const source = value && typeof value === "object" ? value : {};
    const characterId = normalizeStableId(source.characterId);
    if (!characterId) {
      throw new Error("角色互动缺少稳定角色编号。");
    }
    const now = normalizeTimestamp(options.now, Date.now());
    return normalizeInteraction(
      {
        ...source,
        characterId,
        liked: false,
        comment: "",
        status: INTERACTION_STATUS.PENDING,
        error: null,
        createdAt: now,
        updatedAt: now,
      },
      now,
    );
  }

  function addInteractions(data, momentId, interactions, now = Date.now()) {
    const id = normalizeStableId(momentId);
    if (!id) throw new Error("找不到要添加互动的朋友圈。");
    const normalizedData = normalizeMomentData(data);
    let found = false;
    const moments = normalizedData.moments.map((moment) => {
      if (moment.id !== id) return moment;
      found = true;
      const existingIds = new Set(
        moment.interactions.map((interaction) => interaction.characterId),
      );
      const additions = normalizeInteractions(interactions, now).filter(
        (interaction) => !existingIds.has(interaction.characterId),
      );
      return {
        ...moment,
        interactions: [...moment.interactions, ...additions],
        updatedAt: additions.length ? now : moment.updatedAt,
      };
    });
    if (!found) throw new Error("要添加互动的朋友圈已经不存在。");
    return normalizeMomentData({
      version: VERSION,
      moments,
    });
  }

  function updateInteraction(
    data,
    momentId,
    characterId,
    changes,
    now = Date.now(),
  ) {
    const normalizedMomentId = normalizeStableId(momentId);
    const normalizedCharacterId = normalizeStableId(characterId);
    if (!normalizedMomentId || !normalizedCharacterId) {
      throw new Error("更新角色互动时缺少稳定编号。");
    }
    const patch = changes && typeof changes === "object" ? changes : {};
    const normalizedData = normalizeMomentData(data);
    let foundMoment = false;
    let foundInteraction = false;
    const moments = normalizedData.moments.map((moment) => {
      if (moment.id !== normalizedMomentId) return moment;
      foundMoment = true;
      const interactions = moment.interactions.map((interaction) => {
        if (interaction.characterId !== normalizedCharacterId) {
          return interaction;
        }
        foundInteraction = true;
        return normalizeInteraction(
          {
            ...interaction,
            ...patch,
            characterId: interaction.characterId,
            updatedAt: now,
          },
          now,
        );
      });
      return {
        ...moment,
        interactions,
        updatedAt: foundInteraction ? now : moment.updatedAt,
      };
    });
    if (!foundMoment) throw new Error("要更新互动的朋友圈已经不存在。");
    if (!foundInteraction) throw new Error("要更新的角色互动已经不存在。");
    return normalizeMomentData({
      version: VERSION,
      moments,
    });
  }

  function recoverInterruptedInteractions(data, now = Date.now()) {
    const normalizedData = normalizeMomentData(data);
    let recovered = 0;
    const moments = normalizedData.moments.map((moment) => {
      let changed = false;
      const interactions = moment.interactions.map((interaction) => {
        if (interaction.status !== INTERACTION_STATUS.PENDING) {
          return interaction;
        }
        changed = true;
        recovered += 1;
        return normalizeInteraction(
          {
            ...interaction,
            status: INTERACTION_STATUS.FAILED,
            error: {
              title: "角色互动被中断",
              message:
                "页面在生成点赞和评论时被刷新或关闭，本次没有收到完整结果。",
              nextStep:
                "确认 API 设置和网络可用后，点击该角色旁边的“重试”。",
              status: 0,
            },
            updatedAt: now,
          },
          now,
        );
      });
      return changed
        ? {
            ...moment,
            interactions,
            updatedAt: now,
          }
        : moment;
    });
    return {
      data: normalizeMomentData({
        version: VERSION,
        moments,
      }),
      recovered,
    };
  }

  return Object.freeze({
    APP_DATA_ID,
    VERSION,
    MAX_CONTENT_LENGTH,
    MAX_COMMENT_LENGTH,
    INTERACTION_STATUS,
    normalizeStableId,
    normalizeContent,
    normalizeComment,
    validateContent,
    normalizeInteraction,
    normalizeInteractions,
    normalizeMoment,
    normalizeMomentData,
    sortMoments,
    createMoment,
    addMoment,
    getMoment,
    createInteraction,
    addInteractions,
    updateInteraction,
    recoverInterruptedInteractions,
  });
});
