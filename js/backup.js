"use strict";

(() => {
  const FORMAT = "pocket-lab-backup";
  const SCHEMA_VERSION = 3;
  const SUPPORTED_SCHEMA_VERSIONS = Object.freeze([1, 2, 3]);

  function isObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function requireId(value, label) {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`${label}缺少稳定编号。`);
    }
    return value.trim();
  }

  function normalizeImage(record) {
    if (!isObject(record)) throw new Error("备份中的图片记录格式不正确。");
    const id = requireId(record.id, "图片");
    const dataUrl = String(record.dataUrl || record.data || "");
    if (!dataUrl.startsWith("data:image/")) {
      throw new Error("备份中的图片缺少有效的 Base64 数据。");
    }
    const blob = window.PocketLabMedia.dataUrlToBlob(dataUrl);
    return {
      id,
      blob,
      mimeType: String(record.mimeType || blob.type || "image/jpeg"),
      size: blob.size,
      createdAt: Number(record.createdAt) || Date.now(),
      updatedAt: Number(record.updatedAt) || Date.now(),
    };
  }

  async function createBackup() {
    const data = await window.PocketLabStorage.readAllData();
    const prepared = window.PocketLabStorage.prepareImportRecords(data);
    const images = [];
    for (const record of prepared.images) {
      images.push({
        id: record.id,
        mimeType: record.mimeType,
        size: record.blob.size,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        dataUrl: await window.PocketLabMedia.readAsDataUrl(record.blob),
      });
    }

    return {
      format: FORMAT,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      characters: prepared.characters.map((record) => cloneJson(record)),
      messages: prepared.messages.map((record) => cloneJson(record)),
      memories: prepared.memories.map((record) => cloneJson(record)),
      worldBooks: prepared.worldBooks.map((record) => cloneJson(record)),
      groupChats: prepared.groupChats.map((record) => cloneJson(record)),
      appData: prepared.appData.map((record) => cloneJson(record)),
      images,
    };
  }

  function validateAndPrepare(input) {
    if (!isObject(input)) throw new Error("备份文件不是有效的 JSON 对象。");
    if (input.format !== FORMAT) throw new Error("这不是小手机生成的备份文件。");
    const schemaVersion = Number(input.schemaVersion);
    if (!SUPPORTED_SCHEMA_VERSIONS.includes(schemaVersion)) {
      throw new Error(`备份版本 ${input.schemaVersion || "未知"} 不受支持。`);
    }

    const images =
      input.images === undefined
        ? []
        : Array.isArray(input.images)
          ? input.images.map(normalizeImage)
          : (() => {
              throw new Error("备份中的图片必须是列表。");
            })();

    const characters =
      schemaVersion === 1 && Array.isArray(input.characters)
        ? input.characters.map((record) =>
            isObject(record) ? { ...record, worldBookId: "" } : record,
          )
        : input.characters;
    const worldBooks =
      schemaVersion === 1
        ? []
        : input.worldBooks === undefined
          ? []
          : Array.isArray(input.worldBooks)
            ? input.worldBooks
            : (() => {
                throw new Error("备份中的世界书必须是列表。");
              })();
    const groupChats =
      input.groupChats === undefined
        ? []
        : Array.isArray(input.groupChats)
          ? input.groupChats
          : (() => {
              throw new Error("备份中的群聊必须是列表。");
            })();

    return window.PocketLabStorage.prepareImportRecords({
      characters,
      messages: input.messages,
      memories: input.memories,
      worldBooks,
      groupChats,
      appData: input.appData,
      images,
    });
  }

  async function importBackup(input) {
    const prepared = validateAndPrepare(input);
    const counts = await window.PocketLabStorage.importRecords(prepared);
    return {
      ...counts,
      importedAt: new Date().toISOString(),
    };
  }

  async function importJson(text) {
    let parsed;
    try {
      parsed = JSON.parse(String(text || ""));
    } catch {
      throw new Error("备份文件无法解析，可能不是完整的 JSON 文件。");
    }
    return importBackup(parsed);
  }

  async function createJson() {
    return JSON.stringify(await createBackup(), null, 2);
  }

  window.PocketLabBackup = {
    format: FORMAT,
    schemaVersion: SCHEMA_VERSION,
    createBackup,
    createJson,
    importBackup,
    importJson,
    validateAndPrepare,
  };
})();
