"use strict";

((root) => {
  const model = root.PocketLabMomentsModel;
  const storage = root.PocketLabStorage;
  let writeQueue = Promise.resolve();

  function requireModules() {
    if (!model || !storage) {
      throw new Error("朋友圈存储组件没有完成加载。");
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
    return model.normalizeMomentData(record?.data);
  }

  async function writeStoredData(data) {
    requireModules();
    const normalized = model.normalizeMomentData(data);
    await storage.saveAppData(model.APP_DATA_ID, normalized);
    return normalized;
  }

  function load() {
    return enqueue(readStoredData);
  }

  function publish(content) {
    return enqueue(async () => {
      const moment = model.createMoment(content);
      const data = await readStoredData();
      const nextData = model.addMoment(data, moment);
      await writeStoredData(nextData);
      return {
        moment,
        data: nextData,
      };
    });
  }

  function addInteractions(momentId, interactions) {
    return enqueue(async () => {
      const data = await readStoredData();
      const nextData = model.addInteractions(
        data,
        momentId,
        interactions,
      );
      await writeStoredData(nextData);
      return {
        data: nextData,
        moment: model.getMoment(nextData, momentId),
      };
    });
  }

  function updateInteraction(momentId, characterId, changes) {
    return enqueue(async () => {
      const data = await readStoredData();
      const nextData = model.updateInteraction(
        data,
        momentId,
        characterId,
        changes,
      );
      await writeStoredData(nextData);
      const moment = model.getMoment(nextData, momentId);
      return {
        data: nextData,
        moment,
        interaction:
          moment?.interactions.find(
            (interaction) => interaction.characterId === characterId,
          ) || null,
      };
    });
  }

  function recoverInterruptedInteractions() {
    return enqueue(async () => {
      const data = await readStoredData();
      const recovered = model.recoverInterruptedInteractions(data);
      if (recovered.recovered) {
        await writeStoredData(recovered.data);
      }
      return recovered;
    });
  }

  function waitForIdle() {
    return writeQueue;
  }

  root.PocketLabMomentsStore = Object.freeze({
    load,
    publish,
    addInteractions,
    updateInteraction,
    recoverInterruptedInteractions,
    waitForIdle,
  });
})(window);
