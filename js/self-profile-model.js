"use strict";

((root, factory) => {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.PocketLabSelfProfileModel = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const STORAGE_KEY = "self-profiles.v1";
  const MAX_NAME_LENGTH = 24;
  const MAX_PERSONA_LENGTH = 4000;

  function normalizeStableId(value) {
    if (typeof value !== "string") return "";
    const normalized = value.trim();
    return normalized && normalized.length <= 200 ? normalized : "";
  }

  function normalizeTimestamp(value, fallback) {
    const timestamp = Number(value);
    return Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : fallback;
  }

  function normalizeProfile(value, now = Date.now()) {
    const source = value && typeof value === "object" ? value : {};
    return {
      id: normalizeStableId(source.id),
      name:
        typeof source.name === "string"
          ? source.name.trim().slice(0, MAX_NAME_LENGTH)
          : "",
      persona:
        typeof source.persona === "string"
          ? source.persona.trim().slice(0, MAX_PERSONA_LENGTH)
          : "",
      createdAt: normalizeTimestamp(source.createdAt, now),
      updatedAt: normalizeTimestamp(source.updatedAt, now),
    };
  }

  function validateProfile(value) {
    const source = value && typeof value === "object" ? value : {};
    const rawName = typeof source.name === "string" ? source.name.trim() : "";
    const rawPersona =
      typeof source.persona === "string" ? source.persona.trim() : "";
    const errors = {};

    if (!rawName) {
      errors.name = "请填写这份资料的名字。";
    } else if (rawName.length > MAX_NAME_LENGTH) {
      errors.name = `名字不能超过 ${MAX_NAME_LENGTH} 个字符。`;
    }

    if (!rawPersona) {
      errors.persona = "请填写你的人物设定。";
    } else if (rawPersona.length > MAX_PERSONA_LENGTH) {
      errors.persona = `人物设定不能超过 ${MAX_PERSONA_LENGTH} 个字符。`;
    }

    return {
      ok: Object.keys(errors).length === 0,
      errors,
      value: normalizeProfile(source),
    };
  }

  function normalizeStore(value) {
    const source = value && typeof value === "object" ? value : {};
    const seenIds = new Set();
    const profiles = [];

    (Array.isArray(source.profiles) ? source.profiles : []).forEach((record) => {
      const profile = normalizeProfile(record);
      if (
        !profile.id ||
        !profile.name ||
        !profile.persona ||
        seenIds.has(profile.id)
      ) {
        return;
      }
      seenIds.add(profile.id);
      profiles.push(profile);
    });

    profiles.sort(
      (left, right) =>
        right.updatedAt - left.updatedAt ||
        left.name.localeCompare(right.name, "zh-CN"),
    );

    const requestedActiveId = normalizeStableId(source.activeProfileId);
    const activeProfileId = seenIds.has(requestedActiveId)
      ? requestedActiveId
      : profiles[0]?.id || "";

    return {
      profiles,
      activeProfileId,
    };
  }

  function getActiveProfile(storeValue) {
    const store = normalizeStore(storeValue);
    return (
      store.profiles.find((profile) => profile.id === store.activeProfileId) ||
      null
    );
  }

  function buildPrompt(profileValue) {
    const validation = validateProfile(profileValue);
    if (!validation.ok) return "";
    const profile = validation.value;
    return [
      "用户本人设定：",
      `名字：${profile.name}`,
      `人设：${profile.persona}`,
      "这是用户本人设定，只用于理解用户身份；角色不能代替用户说话。",
    ].join("\n");
  }

  return Object.freeze({
    STORAGE_KEY,
    MAX_NAME_LENGTH,
    MAX_PERSONA_LENGTH,
    normalizeStableId,
    normalizeProfile,
    validateProfile,
    normalizeStore,
    getActiveProfile,
    buildPrompt,
  });
});
