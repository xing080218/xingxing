"use strict";

((root, factory) => {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.PocketLabCharacterDeletionModel = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const SMS_APP_DATA_ID = "sms.v1";
  const MOMENTS_APP_DATA_ID = "moments.v1";

  function normalizeId(value) {
    if (typeof value !== "string") return "";
    const normalized = value.trim();
    return normalized && normalized.length <= 200 ? normalized : "";
  }

  function recordMatchesId(record, key, characterId) {
    return Boolean(
      record &&
        typeof record === "object" &&
        normalizeId(record[key]) === characterId,
    );
  }

  function removeCharacterFromSmsData(value, characterId) {
    const id = normalizeId(characterId);
    if (!id || value === null || value === undefined) return value;

    if (Array.isArray(value)) {
      const messages = value.filter(
        (record) => !recordMatchesId(record, "characterId", id),
      );
      return messages.length === value.length ? value : messages;
    }

    if (typeof value !== "object" || !Array.isArray(value.messages)) {
      return value;
    }

    const messages = value.messages.filter(
      (record) => !recordMatchesId(record, "characterId", id),
    );
    if (messages.length === value.messages.length) return value;

    return {
      ...value,
      messages,
    };
  }

  function removeCharacterFromMomentData(value, characterId) {
    const id = normalizeId(characterId);
    if (
      !id ||
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      !Array.isArray(value.moments)
    ) {
      return value;
    }

    let changed = false;
    const moments = value.moments.map((moment) => {
      if (
        !moment ||
        typeof moment !== "object" ||
        !Array.isArray(moment.interactions)
      ) {
        return moment;
      }

      const interactions = moment.interactions.filter(
        (interaction) =>
          !recordMatchesId(interaction, "characterId", id),
      );
      if (interactions.length === moment.interactions.length) return moment;

      changed = true;
      return {
        ...moment,
        interactions,
      };
    });

    return changed ? { ...value, moments } : value;
  }

  function removeCharacterFromGroupChats(records, characterId) {
    const id = normalizeId(characterId);
    if (!id || !Array.isArray(records)) return records;

    let changed = false;
    const nextRecords = records.map((record) => {
      if (
        !record ||
        typeof record !== "object" ||
        !Array.isArray(record.memberCharacterIds)
      ) {
        return record;
      }

      const memberCharacterIds = record.memberCharacterIds.filter(
        (memberId) => normalizeId(memberId) !== id,
      );
      if (memberCharacterIds.length === record.memberCharacterIds.length) {
        return record;
      }

      changed = true;
      return {
        ...record,
        memberCharacterIds,
      };
    });

    return changed ? nextRecords : records;
  }

  return Object.freeze({
    SMS_APP_DATA_ID,
    MOMENTS_APP_DATA_ID,
    removeCharacterFromSmsData,
    removeCharacterFromMomentData,
    removeCharacterFromGroupChats,
  });
});
