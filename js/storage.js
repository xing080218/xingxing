"use strict";

(() => {
  const DB_NAME = String(window.POCKET_LAB_DB_NAME || "pocket-lab");
  const DB_VERSION = 3;
  const STORES = Object.freeze({
    characters: "characters",
    messages: "messages",
    memories: "memories",
    worldBooks: "worldBooks",
    appData: "appData",
    images: "images",
    meta: "meta",
  });
  const USER_DATA_STORES = Object.freeze([
    STORES.characters,
    STORES.messages,
    STORES.memories,
    STORES.worldBooks,
    STORES.appData,
    STORES.images,
  ]);
  const PRIMARY_CHARACTER_ID = "primary-character";
  const MIGRATION_META_KEY = "legacy-local-storage-migration";
  const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
  const MAX_TOTAL_IMAGE_BYTES = 100 * 1024 * 1024;

  let databasePromise = null;

  function createId(prefix = "id") {
    const suffix =
      window.crypto && typeof window.crypto.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    return `${prefix}-${suffix}`;
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB 请求失败。"));
    });
  }

  function transactionToPromise(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error || new Error("IndexedDB 事务失败。"));
      transaction.onabort = () =>
        reject(transaction.error || new Error("IndexedDB 事务已中止。"));
    });
  }

  async function runWriteTransaction(storeNames, work) {
    const database = await open();
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    const transaction = database.transaction(names, "readwrite");
    const completion = transactionToPromise(transaction);

    try {
      work(transaction);
      await completion;
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // The transaction may already have completed or aborted.
      }
      await completion.catch(() => undefined);
      throw error;
    }
  }

  function ensureMessageIndexes(store) {
    if (!store.indexNames.contains("by-order")) {
      store.createIndex("by-order", "order", { unique: false });
    }
    if (!store.indexNames.contains("by-turn")) {
      store.createIndex("by-turn", "turnId", { unique: false });
    }
    if (!store.indexNames.contains("by-character")) {
      store.createIndex("by-character", "characterId", { unique: false });
    }
  }

  function createStores(database, transaction, oldVersion) {
    if (!database.objectStoreNames.contains(STORES.characters)) {
      database.createObjectStore(STORES.characters, { keyPath: "id" });
    }
    let messageStore;
    if (!database.objectStoreNames.contains(STORES.messages)) {
      messageStore = database.createObjectStore(STORES.messages, { keyPath: "id" });
      ensureMessageIndexes(messageStore);
    } else if (transaction) {
      messageStore = transaction.objectStore(STORES.messages);
      ensureMessageIndexes(messageStore);
    }
    if (!database.objectStoreNames.contains(STORES.memories)) {
      database.createObjectStore(STORES.memories, { keyPath: "id" });
    }
    if (!database.objectStoreNames.contains(STORES.worldBooks)) {
      database.createObjectStore(STORES.worldBooks, { keyPath: "id" });
    }
    if (!database.objectStoreNames.contains(STORES.appData)) {
      database.createObjectStore(STORES.appData, { keyPath: "appId" });
    }
    if (!database.objectStoreNames.contains(STORES.images)) {
      database.createObjectStore(STORES.images, { keyPath: "id" });
    }
    if (!database.objectStoreNames.contains(STORES.meta)) {
      database.createObjectStore(STORES.meta, { keyPath: "key" });
    }

    if (messageStore && Number(oldVersion) < 2) {
      messageStore.openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) return;
        const record = cursor.value;
        if (!record.characterId) {
          cursor.update({
            ...record,
            characterId: PRIMARY_CHARACTER_ID,
          });
        }
        cursor.continue();
      };
    }
  }

  function open() {
    if (databasePromise) return databasePromise;

    databasePromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("当前浏览器不支持 IndexedDB，无法安全保存本机数据。"));
        return;
      }

      let request;
      try {
        request = window.indexedDB.open(DB_NAME, DB_VERSION);
      } catch (error) {
        reject(error);
        return;
      }

      request.onupgradeneeded = (event) =>
        createStores(request.result, request.transaction, event.oldVersion);
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          databasePromise = null;
        };
        resolve(database);
      };
      request.onerror = () =>
        reject(request.error || new Error("无法打开本机 IndexedDB 数据库。"));
      request.onblocked = () =>
        reject(new Error("本机数据库被其他旧页面占用，请关闭旧页面后刷新重试。"));
    }).catch((error) => {
      databasePromise = null;
      throw error;
    });

    return databasePromise;
  }

  async function readAll(storeName) {
    const database = await open();
    const transaction = database.transaction(storeName, "readonly");
    return requestToPromise(transaction.objectStore(storeName).getAll());
  }

  async function readOne(storeName, key) {
    const database = await open();
    const transaction = database.transaction(storeName, "readonly");
    return requestToPromise(transaction.objectStore(storeName).get(key));
  }

  async function putOne(storeName, value) {
    await runWriteTransaction(storeName, (transaction) => {
      transaction.objectStore(storeName).put(value);
    });
    return value;
  }

  async function deleteOne(storeName, key) {
    await runWriteTransaction(storeName, (transaction) => {
      transaction.objectStore(storeName).delete(key);
    });
  }

  function makeImageRecord(blob, source = {}) {
    if (!(blob instanceof Blob) || !String(blob.type || "").startsWith("image/")) {
      throw new Error("只能保存图片 Blob。");
    }
    if (!blob.size) {
      throw new Error("不能保存空图片。");
    }
    if (blob.size > MAX_IMAGE_BYTES) {
      throw new Error("单张图片超过 25 MB，无法保存。");
    }
    const now = Date.now();
    return {
      id: String(source.id || createId("image")),
      blob,
      mimeType: String(source.mimeType || blob.type || "image/jpeg"),
      size: blob.size,
      createdAt: Number(source.createdAt) || now,
      updatedAt: Number(source.updatedAt) || now,
    };
  }

  async function saveImage(blob, source = {}) {
    const record = makeImageRecord(blob, source);
    return putOne(STORES.images, record);
  }

  async function getImage(imageId) {
    if (!imageId) return null;
    return readOne(STORES.images, imageId);
  }

  async function getImageBlob(imageId) {
    const record = await getImage(imageId);
    return record && record.blob instanceof Blob ? record.blob : null;
  }

  async function deleteImage(imageId) {
    if (!imageId) return;
    await deleteOne(STORES.images, imageId);
  }

  function valueReferencesImage(value, imageId, depth = 0) {
    if (depth > 8 || value === null || value === undefined) return false;
    if (typeof value === "string") return value === imageId;
    if (Array.isArray(value)) {
      return value.some((item) => valueReferencesImage(item, imageId, depth + 1));
    }
    if (typeof value !== "object" || value instanceof Blob) return false;
    return Object.values(value).some((item) =>
      valueReferencesImage(item, imageId, depth + 1),
    );
  }

  async function deleteImageIfUnused(imageId) {
    const id = typeof imageId === "string" ? imageId.trim() : "";
    if (!id) return false;

    const [characters, appDataRecords] = await Promise.all([
      readAll(STORES.characters),
      readAll(STORES.appData),
    ]);
    const usedByCharacter = characters.some(
      (character) =>
        character.avatarId === id || character.chatBackgroundImageId === id,
    );
    const usedByApp = appDataRecords.some((record) =>
      valueReferencesImage(record.data, id),
    );
    if (usedByCharacter || usedByApp) return false;

    await deleteImage(id);
    return true;
  }

  async function getCharacter(characterId = PRIMARY_CHARACTER_ID) {
    return readOne(STORES.characters, characterId);
  }

  async function listCharacters() {
    const characters = await readAll(STORES.characters);
    return characters.sort((left, right) => {
      if (left.id === PRIMARY_CHARACTER_ID) return -1;
      if (right.id === PRIMARY_CHARACTER_ID) return 1;
      return (
        Number(left.createdAt || 0) - Number(right.createdAt || 0) ||
        String(left.name || "").localeCompare(String(right.name || ""), "zh-CN")
      );
    });
  }

  function normalizeWorldBookRecord(value) {
    const model = window.PocketLabWorldBookModel;
    if (model && typeof model.normalizeWorldBook === "function") {
      return model.normalizeWorldBook(value);
    }

    const source = value && typeof value === "object" ? value : {};
    const now = Date.now();
    return {
      id: typeof source.id === "string" ? source.id.trim() : "",
      name: typeof source.name === "string" ? source.name.trim().slice(0, 80) : "",
      category:
        typeof source.category === "string" && source.category.trim()
          ? source.category.trim().slice(0, 40)
          : "未分类",
      content:
        typeof source.content === "string"
          ? source.content.trim().slice(0, 12000)
          : "",
      createdAt: Number.isFinite(Number(source.createdAt))
        ? Number(source.createdAt)
        : now,
      updatedAt: Number.isFinite(Number(source.updatedAt))
        ? Number(source.updatedAt)
        : now,
    };
  }

  function validateWorldBookRecord(value, label = "世界书") {
    const model = window.PocketLabWorldBookModel;
    const validation =
      model && typeof model.validateWorldBook === "function"
        ? model.validateWorldBook(value)
        : { ok: Boolean(normalizeWorldBookRecord(value).name && normalizeWorldBookRecord(value).content) };
    if (!validation.ok) {
      const firstError =
        Object.values(validation.errors || {}).find(Boolean) ||
        `${label}内容不完整。`;
      throw new Error(firstError);
    }
    return normalizeWorldBookRecord(value);
  }

  async function getWorldBook(worldBookId) {
    if (!worldBookId) return null;
    return readOne(STORES.worldBooks, String(worldBookId).trim());
  }

  async function listWorldBooks() {
    const records = await readAll(STORES.worldBooks);
    const normalized = records.map((record) => normalizeWorldBookRecord(record));
    const model = window.PocketLabWorldBookModel;
    return model && typeof model.sortWorldBooks === "function"
      ? model.sortWorldBooks(normalized)
      : normalized;
  }

  async function saveWorldBook(record) {
    const validation = validateWorldBookRecord(record);
    const id = requireStableId(validation.id || record?.id, "世界书");
    const saved = {
      ...validation,
      id,
      updatedAt: Date.now(),
      createdAt: Number(validation.createdAt) || Date.now(),
    };
    await putOne(STORES.worldBooks, saved);
    return saved;
  }

  async function listCharactersUsingWorldBook(worldBookId) {
    const id = typeof worldBookId === "string" ? worldBookId.trim() : "";
    if (!id) return [];
    return (await listCharacters()).filter(
      (character) => String(character.worldBookId || "").trim() === id,
    );
  }

  async function deleteWorldBook(worldBookId) {
    const id = requireStableId(worldBookId, "世界书");
    const users = await listCharactersUsingWorldBook(id);
    if (users.length) {
      const names = users
        .map((character) => String(character.name || "未命名角色"))
        .join("、");
      throw new Error(`世界书仍绑定角色：${names}。请先在角色编辑中解除绑定。`);
    }
    await deleteOne(STORES.worldBooks, id);
    return true;
  }

  function persistentCharacterRecord(
    source,
    id,
    avatarId,
    chatBackgroundImageId,
    updatedAt,
  ) {
    const record = { ...source };
    [
      "avatarUrl",
      "avatar",
      "avatarData",
      "dataUrl",
      "chatBackgroundUrl",
      "chatBackgroundData",
    ].forEach((key) => {
      delete record[key];
    });
    return {
      ...record,
      id,
      avatarId,
      chatBackgroundImageId,
      worldBookId:
        typeof source.worldBookId === "string" &&
        source.worldBookId.trim().length <= 200
          ? source.worldBookId.trim()
          : "",
      selfProfileId:
        typeof source.selfProfileId === "string" &&
        source.selfProfileId.trim().length <= 200
          ? source.selfProfileId.trim()
          : "",
      updatedAt,
    };
  }

  async function saveCharacter(
    record,
    avatarBlob = null,
    chatBackgroundBlob = null,
  ) {
    const source = record && typeof record === "object" ? record : {};
    const avatarImageRecord = avatarBlob ? makeImageRecord(avatarBlob) : null;
    const chatBackgroundImageRecord = chatBackgroundBlob
      ? makeImageRecord(chatBackgroundBlob)
      : null;
    const id = requireStableId(source.id || PRIMARY_CHARACTER_ID, "角色");
    const avatarId = avatarImageRecord
      ? avatarImageRecord.id
      : typeof source.avatarId === "string"
        ? source.avatarId.trim()
        : "";
    const chatBackgroundImageId = chatBackgroundImageRecord
      ? chatBackgroundImageRecord.id
      : typeof source.chatBackgroundImageId === "string"
        ? source.chatBackgroundImageId.trim()
        : "";
    const worldBookId =
      typeof source.worldBookId === "string" ? source.worldBookId.trim() : "";
    const saved = persistentCharacterRecord(
      source,
      id,
      avatarId,
      chatBackgroundImageId,
      Date.now(),
    );

    if (avatarId && !avatarImageRecord) {
      const existingImage = await getImage(avatarId);
      if (!existingImage) {
        throw new Error("角色头像引用不存在，未保存角色资料。");
      }
    }
    if (chatBackgroundImageId && !chatBackgroundImageRecord) {
      const existingImage = await getImage(chatBackgroundImageId);
      if (!existingImage) {
        throw new Error("角色聊天背景引用不存在，未保存角色资料。");
      }
    }
    if (worldBookId) {
      const existingWorldBook = await getWorldBook(worldBookId);
      if (!existingWorldBook) {
        throw new Error("角色绑定的世界书不存在，未保存角色资料。");
      }
    }

    await runWriteTransaction(
      [STORES.characters, STORES.images],
      (transaction) => {
        if (avatarImageRecord) {
          transaction.objectStore(STORES.images).put(avatarImageRecord);
        }
        if (chatBackgroundImageRecord) {
          transaction.objectStore(STORES.images).put(chatBackgroundImageRecord);
        }
        transaction.objectStore(STORES.characters).put(saved);
      },
    );
    return saved;
  }

  function normalizeMessageOrder(messages) {
    return messages.map((message, index) => ({
      ...message,
      order: index,
      updatedAt: Date.now(),
    }));
  }

  async function saveMessages(messages) {
    const records = normalizeMessageOrder(Array.isArray(messages) ? messages : []).map(
      (message) => ({
        ...message,
        characterId: message.characterId || PRIMARY_CHARACTER_ID,
      }),
    );
    const ids = new Set();
    records.forEach((message) => {
      const id = requireStableId(message.id, "聊天记录");
      if (ids.has(id)) throw new Error(`聊天记录编号重复：${id}`);
      if (message.role !== "user" && message.role !== "assistant") {
        throw new Error(`聊天记录 ${id} 的角色无效。`);
      }
      if (typeof message.content !== "string" || !message.content.trim()) {
        throw new Error(`聊天记录 ${id} 的内容为空或格式不正确。`);
      }
      ids.add(id);
    });
    await runWriteTransaction(STORES.messages, (transaction) => {
      const store = transaction.objectStore(STORES.messages);
      store.clear();
      records.forEach((message) => store.put(message));
    });
    return records;
  }

  async function saveMessagesForCharacter(characterId, messages) {
    const safeCharacterId = requireStableId(characterId, "角色");
    const records = normalizeMessageOrder(Array.isArray(messages) ? messages : []).map(
      (message) => ({
        ...message,
        characterId: safeCharacterId,
      }),
    );
    const ids = new Set();
    records.forEach((message) => {
      const id = requireStableId(message.id, "聊天记录");
      if (ids.has(id)) throw new Error(`聊天记录编号重复：${id}`);
      if (message.role !== "user" && message.role !== "assistant") {
        throw new Error(`聊天记录 ${id} 的角色无效。`);
      }
      if (typeof message.content !== "string" || !message.content.trim()) {
        throw new Error(`聊天记录 ${id} 的内容为空或格式不正确。`);
      }
      ids.add(id);
    });

    await runWriteTransaction(STORES.messages, (transaction) => {
      const store = transaction.objectStore(STORES.messages);
      const index = store.index("by-character");
      const cursorRequest = index.openKeyCursor(
        IDBKeyRange.only(safeCharacterId),
      );
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
          return;
        }
        records.forEach((message) => store.put(message));
      };
    });
    return records;
  }

  async function getMessages(characterId = "") {
    const messages = characterId
      ? await (async () => {
          const database = await open();
          const transaction = database.transaction(STORES.messages, "readonly");
          return requestToPromise(
            transaction
              .objectStore(STORES.messages)
              .index("by-character")
              .getAll(characterId),
          );
        })()
      : await readAll(STORES.messages);
    return messages.sort((left, right) => {
      const orderDifference = Number(left.order || 0) - Number(right.order || 0);
      if (orderDifference) return orderDifference;
      return Number(left.createdAt || 0) - Number(right.createdAt || 0);
    });
  }

  async function getMemories() {
    return readAll(STORES.memories);
  }

  async function saveMemories(memories) {
    const records = Array.isArray(memories) ? memories : [];
    const ids = new Set();
    records.forEach((memory) => {
      const id = requireStableId(memory && memory.id, "记忆");
      if (ids.has(id)) throw new Error(`记忆编号重复：${id}`);
      ids.add(id);
    });
    await runWriteTransaction(STORES.memories, (transaction) => {
      const store = transaction.objectStore(STORES.memories);
      store.clear();
      records.forEach((memory) => store.put(memory));
    });
    return records;
  }

  async function getAppData(appId) {
    if (!appId) return null;
    return readOne(STORES.appData, appId);
  }

  async function listAppData() {
    return readAll(STORES.appData);
  }

  async function saveAppData(appId, data) {
    const id = String(appId || "").trim();
    if (!id) throw new Error("App 存档必须使用稳定编号。");
    return putOne(STORES.appData, {
      appId: id,
      data,
      updatedAt: Date.now(),
    });
  }

  async function getMeta(key) {
    const record = await readOne(STORES.meta, key);
    return record ? record.value : null;
  }

  async function setMeta(key, value) {
    return putOne(STORES.meta, {
      key: String(key),
      value,
      updatedAt: Date.now(),
    });
  }

  function requireStableId(value, label) {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`${label}缺少稳定编号。`);
    }
    const id = value.trim();
    if (id.length > 200) {
      throw new Error(`${label}编号过长，无法导入。`);
    }
    return id;
  }

  function requireRecordArray(value, label) {
    if (value === undefined) return [];
    if (!Array.isArray(value)) {
      throw new Error(`备份中的${label}必须是列表。`);
    }
    return value;
  }

  function assertUniqueRecords(records, key, label) {
    const seen = new Set();
    records.forEach((record) => {
      const id = requireStableId(record && record[key], label);
      if (seen.has(id)) {
        throw new Error(`${label}编号重复：${id}`);
      }
      seen.add(id);
    });
    return seen;
  }

  function prepareImportedImages(records) {
    const imageIds = assertUniqueRecords(records, "id", "图片");
    let totalBytes = 0;
    const images = records.map((record) => {
      if (!record || typeof record !== "object") {
        throw new Error("备份中的图片记录格式不正确。");
      }
      if (!(record.blob instanceof Blob)) {
        throw new Error(`图片 ${record.id} 没有成功转换为 Blob。`);
      }
      const mimeType = String(record.mimeType || record.blob.type || "");
      if (!/^image\/(?:png|jpeg|webp|gif)$/i.test(mimeType)) {
        throw new Error(`图片 ${record.id} 的类型不受支持。`);
      }
      if (!record.blob.size || record.blob.size > MAX_IMAGE_BYTES) {
        throw new Error(`图片 ${record.id} 为空或超过 25 MB。`);
      }
      totalBytes += record.blob.size;
      if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
        throw new Error("备份中的图片总量超过 100 MB，无法一次导入。");
      }
      const blob =
        record.blob.type === mimeType
          ? record.blob
          : new Blob([record.blob], { type: mimeType });
      return {
        id: record.id.trim(),
        blob,
        mimeType,
        size: blob.size,
        createdAt: Number(record.createdAt) || Date.now(),
        updatedAt: Number(record.updatedAt) || Date.now(),
      };
    });
    return { images, imageIds };
  }

  function prepareImportedWorldBooks(records) {
    const worldBookIds = assertUniqueRecords(records, "id", "世界书");
    const worldBooks = records.map((record) => {
      if (!record || typeof record !== "object") {
        throw new Error("备份中的世界书记录格式不正确。");
      }
      const validation = validateWorldBookRecord(record);
      return {
        ...validation,
        id: record.id.trim(),
        createdAt: Number(validation.createdAt) || Date.now(),
        updatedAt: Number(validation.updatedAt) || Date.now(),
      };
    });
    return { worldBooks, worldBookIds };
  }

  function prepareImportedCharacters(records, imageIds, worldBookIds) {
    const characterIds = assertUniqueRecords(records, "id", "角色");
    const characters = records.map((record) => {
      if (!record || typeof record !== "object") {
        throw new Error("备份中的角色记录格式不正确。");
      }
      const id = record.id.trim();
      const avatarId =
        typeof record.avatarId === "string" ? record.avatarId.trim() : "";
      const chatBackgroundImageId =
        typeof record.chatBackgroundImageId === "string"
          ? record.chatBackgroundImageId.trim()
          : "";
      const worldBookId =
        typeof record.worldBookId === "string" ? record.worldBookId.trim() : "";
      const selfProfileId =
        typeof record.selfProfileId === "string"
          ? record.selfProfileId.trim()
          : "";
      if (avatarId && !imageIds.has(avatarId)) {
        throw new Error(`角色 ${id} 引用了备份中不存在的头像 ${avatarId}。`);
      }
      if (chatBackgroundImageId && !imageIds.has(chatBackgroundImageId)) {
        throw new Error(
          `角色 ${id} 引用了备份中不存在的聊天背景 ${chatBackgroundImageId}。`,
        );
      }
      if (worldBookId && !worldBookIds.has(worldBookId)) {
        throw new Error(
          `角色 ${id} 引用了备份中不存在的世界书 ${worldBookId}。`,
        );
      }
      return persistentCharacterRecord(
        { ...record, worldBookId, selfProfileId },
        id,
        avatarId,
        chatBackgroundImageId,
        Number(record.updatedAt) || Date.now(),
      );
    });
    return { characters, characterIds };
  }

  function prepareImportedMessages(records, characterIds) {
    const messageIds = assertUniqueRecords(records, "id", "聊天记录");
    const messages = records.map((record) => {
      if (!record || typeof record !== "object") {
        throw new Error("备份中的聊天记录格式不正确。");
      }
      if (record.role !== "user" && record.role !== "assistant") {
        throw new Error(`聊天记录 ${record.id} 的角色无效。`);
      }
      if (typeof record.content !== "string" || !record.content.trim()) {
        throw new Error(`聊天记录 ${record.id} 的内容为空或格式不正确。`);
      }
      const characterId =
        typeof record.characterId === "string" && record.characterId.trim()
          ? record.characterId.trim()
          : PRIMARY_CHARACTER_ID;
      if (!characterIds.has(characterId)) {
        throw new Error(`聊天记录 ${record.id} 引用了备份中不存在的角色 ${characterId}。`);
      }
      return { ...record, id: record.id.trim(), characterId };
    });
    return { messages, messageIds };
  }

  function prepareImportedMemories(records) {
    assertUniqueRecords(records, "id", "记忆");
    return records.map((record) => {
      if (!record || typeof record !== "object") {
        throw new Error("备份中的记忆记录格式不正确。");
      }
      return { ...record, id: record.id.trim() };
    });
  }

  function prepareImportedAppData(records) {
    assertUniqueRecords(records, "appId", "App 存档");
    return records.map((record) => {
      if (!record || typeof record !== "object") {
        throw new Error("备份中的 App 存档格式不正确。");
      }
      return { ...record, appId: record.appId.trim() };
    });
  }

  function prepareImportRecords(input) {
    const source = input && typeof input === "object" ? input : {};
    const rawCharacters = requireRecordArray(source.characters, "角色");
    const rawMessages = requireRecordArray(source.messages, "聊天记录");
    const rawMemories = requireRecordArray(source.memories, "记忆");
    const rawWorldBooks = requireRecordArray(source.worldBooks, "世界书");
    const rawAppData = requireRecordArray(source.appData, "App 存档");
    const rawImages = requireRecordArray(source.images, "图片");
    const preparedImages = prepareImportedImages(rawImages);
    const preparedWorldBooks = prepareImportedWorldBooks(rawWorldBooks);
    let preparedCharacters = prepareImportedCharacters(
      rawCharacters,
      preparedImages.imageIds,
      preparedWorldBooks.worldBookIds,
    );
    const needsPrimaryCharacter = rawMessages.some(
      (record) =>
        !record ||
        typeof record.characterId !== "string" ||
        !record.characterId.trim() ||
        record.characterId.trim() === PRIMARY_CHARACTER_ID,
    );
    if (needsPrimaryCharacter && !preparedCharacters.characterIds.has(PRIMARY_CHARACTER_ID)) {
      const profile = window.PocketLabCharacterProfile;
      const fallback = profile
        ? profile.normalizeCharacter({
            id: PRIMARY_CHARACTER_ID,
            ...profile.defaultCharacter,
          })
        : {
            id: PRIMARY_CHARACTER_ID,
            name: "小雾",
            persona:
              "你是小雾，一个住在虚拟小手机里的陪伴角色。请用自然、简洁的中文和对方聊天，保持角色设定，不要替对方说话。",
            avatarId: "",
            chatBackgroundImageId: "",
            maxConsecutiveMessages: 3,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
      preparedCharacters.characters.unshift(fallback);
      preparedCharacters.characterIds.add(PRIMARY_CHARACTER_ID);
    }
    const preparedMessages = prepareImportedMessages(
      rawMessages,
      preparedCharacters.characterIds,
    );
    return {
      characters: preparedCharacters.characters,
      messages: preparedMessages.messages,
      memories: prepareImportedMemories(rawMemories),
      worldBooks: preparedWorldBooks.worldBooks,
      appData: prepareImportedAppData(rawAppData),
      images: preparedImages.images,
    };
  }

  async function importRecords(input) {
    const records = prepareImportRecords(input);
    await runWriteTransaction(USER_DATA_STORES, (transaction) => {
      USER_DATA_STORES.forEach((storeName) => {
        transaction.objectStore(storeName).clear();
      });
      records.characters.forEach((record) => {
        transaction.objectStore(STORES.characters).put(record);
      });
      records.messages.forEach((record) => {
        transaction.objectStore(STORES.messages).put(record);
      });
      records.memories.forEach((record) => {
        transaction.objectStore(STORES.memories).put(record);
      });
      records.worldBooks.forEach((record) => {
        transaction.objectStore(STORES.worldBooks).put(record);
      });
      records.appData.forEach((record) => {
        transaction.objectStore(STORES.appData).put(record);
      });
      records.images.forEach((record) => {
        transaction.objectStore(STORES.images).put(record);
      });
    });

    return {
      characters: records.characters.length,
      messages: records.messages.length,
      memories: records.memories.length,
      worldBooks: records.worldBooks.length,
      appData: records.appData.length,
      images: records.images.length,
    };
  }

  async function readAllData() {
    const [characters, messages, memories, worldBooks, appData, images] =
      await Promise.all([
      readAll(STORES.characters),
      getMessages(),
      readAll(STORES.memories),
      readAll(STORES.worldBooks),
      readAll(STORES.appData),
      readAll(STORES.images),
      ]);
    return { characters, messages, memories, worldBooks, appData, images };
  }

  async function migrateLegacyData(input) {
    const source = input && typeof input === "object" ? input : {};
    const legacyCharacter =
      source.character && typeof source.character === "object"
        ? source.character
        : null;
    const legacyMessages = Array.isArray(source.messages) ? source.messages : [];
    const avatarBlob = source.avatarBlob instanceof Blob ? source.avatarBlob : null;
    if (!legacyCharacter && !legacyMessages.length) {
      return { characterMigrated: false, messagesMigrated: 0, avatarMigrated: false };
    }

    const [currentCharacter, currentMessages] = await Promise.all([
      getCharacter(PRIMARY_CHARACTER_ID),
      getMessages(PRIMARY_CHARACTER_ID),
    ]);
    const existingMessageIds = new Set(currentMessages.map((message) => message.id));
    let expectedCharacter = null;
    let expectedAvatarId = "";
    let imageRecord = null;
    let nextOrder =
      currentMessages.reduce(
        (maximum, message) => Math.max(maximum, Number(message.order) || 0),
        -1,
      ) + 1;

    const isUntouchedPlaceholder =
      Boolean(currentCharacter) &&
      currentMessages.length === 0 &&
      !currentCharacter.avatarId &&
      !currentCharacter.chatBackgroundImageId;

    if (legacyCharacter && (!currentCharacter || isUntouchedPlaceholder)) {
      imageRecord = avatarBlob ? makeImageRecord(avatarBlob) : null;
      expectedAvatarId = imageRecord ? imageRecord.id : "";
      expectedCharacter = persistentCharacterRecord(
        {
          ...(currentCharacter || {}),
          name: legacyCharacter.name,
          persona: legacyCharacter.persona,
        },
        PRIMARY_CHARACTER_ID,
        expectedAvatarId,
        "",
        Date.now(),
      );
    } else if (currentCharacter && !currentCharacter.avatarId && avatarBlob) {
      imageRecord = makeImageRecord(avatarBlob);
      expectedAvatarId = imageRecord.id;
      expectedCharacter = persistentCharacterRecord(
        currentCharacter,
        PRIMARY_CHARACTER_ID,
        expectedAvatarId,
        currentCharacter.chatBackgroundImageId || "",
        Date.now(),
      );
    }

    const messagesToWrite = [];
    const legacyMessageIds = new Set();
    legacyMessages.forEach((message) => {
      const id = requireStableId(message && message.id, "旧版聊天记录");
      if (legacyMessageIds.has(id)) {
        throw new Error(`旧版聊天记录编号重复：${id}`);
      }
      legacyMessageIds.add(id);
      if (message.role !== "user" && message.role !== "assistant") {
        throw new Error(`旧版聊天记录 ${id} 的角色无效。`);
      }
      if (typeof message.content !== "string" || !message.content.trim()) {
        throw new Error(`旧版聊天记录 ${id} 的内容为空或格式不正确。`);
      }
      if (existingMessageIds.has(id)) return;
      existingMessageIds.add(id);
      messagesToWrite.push({
        ...message,
        id,
        characterId: PRIMARY_CHARACTER_ID,
        order: nextOrder,
        updatedAt: Date.now(),
      });
      nextOrder += 1;
    });

    await runWriteTransaction(
      [STORES.characters, STORES.messages, STORES.images],
      (transaction) => {
        if (imageRecord) {
          transaction.objectStore(STORES.images).put(imageRecord);
        }
        if (expectedCharacter) {
          transaction.objectStore(STORES.characters).put(expectedCharacter);
        }
        messagesToWrite.forEach((message) => {
          transaction.objectStore(STORES.messages).put(message);
        });
      },
    );

    const [verifiedCharacter, verifiedMessages] = await Promise.all([
      getCharacter(PRIMARY_CHARACTER_ID),
      getMessages(PRIMARY_CHARACTER_ID),
    ]);
    if (expectedCharacter) {
      if (
        !verifiedCharacter ||
        verifiedCharacter.name !== expectedCharacter.name ||
        verifiedCharacter.persona !== expectedCharacter.persona
      ) {
        throw new Error("旧角色文字写入后未能完整读回。");
      }
      if (expectedAvatarId) {
        const blob = await getImageBlob(expectedAvatarId);
        if (!(blob instanceof Blob) || blob.size <= 0) {
          throw new Error("旧头像写入后未能完整读回。");
        }
      }
    }

    const verifiedById = new Map(verifiedMessages.map((message) => [message.id, message]));
    messagesToWrite.forEach((message) => {
      const verified = verifiedById.get(message.id);
      if (!verified || verified.content !== message.content) {
        throw new Error("旧聊天记录写入后未能完整读回。");
      }
    });

    await setMeta(MIGRATION_META_KEY, {
      version: 1,
      completedAt: Date.now(),
      characterMigrated: Boolean(expectedCharacter),
      messagesMigrated: messagesToWrite.length,
      avatarMigrated: Boolean(expectedAvatarId),
    });

    return {
      characterMigrated: Boolean(expectedCharacter),
      messagesMigrated: messagesToWrite.length,
      avatarMigrated: Boolean(expectedAvatarId),
    };
  }

  function isQuotaError(error) {
    const raw = error || {};
    return (
      raw.name === "QuotaExceededError" ||
      raw.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      raw.code === 22 ||
      raw.code === 1014 ||
      /quota|storage is full|存储空间不足|磁盘空间/i.test(String(raw.message || ""))
    );
  }

  function describeError(error, action = "保存本机数据") {
    const raw = error || {};
    const detail = String(raw.message || "浏览器没有返回详细原因。");
    if (isQuotaError(raw)) {
      return {
        title: "本机存储空间不足",
        message: `${action}没有完成：浏览器可用于网页的存储空间已经不足。`,
        nextStep:
          "先到设置页导出备份，再清理浏览器中不需要的站点数据或删除不用的图片，然后刷新页面重试。",
        isQuota: true,
      };
    }

    if (
      raw.name === "SecurityError" ||
      /indexeddb|database|数据库|安全策略|not allowed/i.test(detail)
    ) {
      return {
        title: "浏览器阻止了本机数据库",
        message: `${action}没有完成：${detail}`,
        nextStep:
          "确认没有使用无痕模式或禁用站点数据；关闭其他旧页面，再刷新当前页面重试。",
        isQuota: false,
      };
    }

    return {
      title: `${action}失败`,
      message: detail.slice(0, 500),
      nextStep:
        "先刷新页面重试；如果仍失败，请导出备份并保留旧数据，不要清理浏览器站点数据。",
      isQuota: false,
    };
  }

  async function storageEstimate() {
    if (!navigator.storage || typeof navigator.storage.estimate !== "function") {
      return null;
    }
    try {
      return await navigator.storage.estimate();
    } catch {
      return null;
    }
  }

  async function clearStoreForTests(storeName) {
    if (!Object.values(STORES).includes(storeName)) {
      throw new Error(`未知对象仓库：${storeName}`);
    }
    const database = await open();
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).clear();
    await transactionToPromise(transaction);
  }

  async function deleteDatabaseForTests() {
    const database = await open();
    database.close();
    databasePromise = null;
    await new Promise((resolve, reject) => {
      const request = window.indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(request.error || new Error("测试数据库删除失败。"));
    });
  }

  window.PocketLabStorage = {
    dbName: DB_NAME,
    dbVersion: DB_VERSION,
    stores: STORES,
    primaryCharacterId: PRIMARY_CHARACTER_ID,
    migrationMetaKey: MIGRATION_META_KEY,
    open,
    createId,
    readAll,
    getCharacter,
    listCharacters,
    saveCharacter,
    getWorldBook,
    listWorldBooks,
    saveWorldBook,
    deleteWorldBook,
    listCharactersUsingWorldBook,
    getMessages,
    saveMessages,
    saveMessagesForCharacter,
    getMemories,
    saveMemories,
    getAppData,
    listAppData,
    saveAppData,
    getImage,
    getImageBlob,
    saveImage,
    deleteImage,
    deleteImageIfUnused,
    getMeta,
    setMeta,
    readAllData,
    prepareImportRecords,
    importRecords,
    migrateLegacyData,
    describeError,
    isQuotaError,
    storageEstimate,
    clearStoreForTests,
    deleteDatabaseForTests,
  };
})();
