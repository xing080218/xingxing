"use strict";

((root) => {
  const model = root.PocketLabSmsModel;
  const storage = root.PocketLabStorage;
  let writeQueue = Promise.resolve();

  function requireModules() {
    if (!model || !storage) {
      throw new Error("短信存储组件没有完成加载。");
    }
  }

  function enqueue(work) {
    const result = writeQueue.then(work);
    writeQueue = result.catch(() => undefined);
    return result;
  }

  async function readStoredData() {
    requireModules();
    const record = await storage.getAppData(model.APP_DATA_ID);
    return model.normalizeSmsData(record?.data);
  }

  async function writeStoredData(data) {
    requireModules();
    const normalized = model.normalizeSmsData(data);
    await storage.saveAppData(model.APP_DATA_ID, normalized);
    return normalized;
  }

  function load() {
    return enqueue(readStoredData);
  }

  function addIfMissing(record) {
    return enqueue(async () => {
      const normalizedRecord = model.normalizeSmsRecord(record);
      if (!normalizedRecord) {
        throw new Error("短信记录缺少稳定编号或角色编号。");
      }

      const data = await readStoredData();
      const duplicate = data.messages.find(
        (item) =>
          item.id === normalizedRecord.id ||
          item.blockEventId === normalizedRecord.blockEventId,
      );
      if (duplicate) {
        return {
          added: false,
          record: duplicate,
          data,
        };
      }

      const nextData = {
        ...data,
        messages: [...data.messages, normalizedRecord],
      };
      await writeStoredData(nextData);
      return {
        added: true,
        record: normalizedRecord,
        data: model.normalizeSmsData(nextData),
      };
    });
  }

  function update(recordId, updater) {
    return enqueue(async () => {
      const id = model.normalizeId(recordId);
      if (!id || typeof updater !== "function") {
        throw new Error("更新短信时缺少记录编号或处理函数。");
      }

      const data = await readStoredData();
      let found = false;
      const messages = data.messages.map((record) => {
        if (record.id !== id) return record;
        found = true;
        return model.normalizeSmsRecord(updater(record)) || record;
      });
      if (!found) {
        throw new Error("要更新的短信记录已经不存在。");
      }

      const nextData = { ...data, messages };
      await writeStoredData(nextData);
      return model.normalizeSmsData(nextData);
    });
  }

  function markRead(characterId, readAt = Date.now()) {
    return enqueue(async () => {
      const data = await readStoredData();
      const nextData = model.markCharacterRead(data, characterId, readAt);
      if (
        nextData.messages.every(
          (record, index) =>
            record.readAt === data.messages[index]?.readAt,
        )
      ) {
        return data;
      }
      await writeStoredData(nextData);
      return nextData;
    });
  }

  function recoverInterrupted() {
    return enqueue(async () => {
      const data = await readStoredData();
      const recovered = model.recoverInterruptedSends(data);
      if (recovered === data) return data;
      await writeStoredData(recovered);
      return recovered;
    });
  }

  root.PocketLabSmsStore = Object.freeze({
    load,
    addIfMissing,
    update,
    markRead,
    recoverInterrupted,
  });
})(window);
