"use strict";

((root) => {
  const model = root.PocketLabMomentsModel;
  const storage = root.PocketLabStorage;
  const ALLOWED_PHOTO_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
  ]);
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

  function normalizePhotos(value) {
    requireModules();
    const source = Array.isArray(value) ? value : [];
    if (source.length > model.MAX_IMAGE_COUNT) {
      throw new Error(`每条朋友圈最多添加 ${model.MAX_IMAGE_COUNT} 张照片。`);
    }
    const seenIds = new Set();
    return source.map((item) => {
      const isBlob =
        typeof root.PocketLabMedia?.isBlob === "function"
          ? root.PocketLabMedia.isBlob
          : (candidate) =>
              Boolean(
                candidate &&
                  typeof candidate === "object" &&
                  typeof candidate.size === "number",
              );
      const candidate =
        item && typeof item === "object" && !isBlob(item)
          ? item
          : { blob: item };
      const blob = candidate?.blob;
      if (!isBlob(blob)) {
        throw new Error("朋友圈照片内容无法读取。");
      }
      const mimeType = String(blob.type || "").toLowerCase();
      if (!ALLOWED_PHOTO_TYPES.has(mimeType)) {
        throw new Error("朋友圈照片仅支持 PNG、JPG 或 WebP 格式。");
      }
      const requestedId = model.normalizeStableId(candidate.id);
      const id = requestedId || model.createImageId();
      if (seenIds.has(id)) {
        throw new Error("朋友圈照片编号重复，请移除后重新添加。");
      }
      seenIds.add(id);
      return { id, blob };
    });
  }

  function publish(content, photosValue = []) {
    return enqueue(async () => {
      const photos = normalizePhotos(photosValue);
      const validation = model.validateMoment(
        content,
        photos.map((photo) => photo.id),
      );
      if (!validation.ok) {
        const error = new Error(validation.error);
        error.code = "INVALID_MOMENT_CONTENT";
        throw error;
      }

      const savedImageIds = [];
      const now = Date.now();
      try {
        for (const photo of photos) {
          await storage.saveImage(photo.blob, {
            id: photo.id,
            mimeType: photo.blob.type,
            createdAt: now,
            updatedAt: now,
          });
          savedImageIds.push(photo.id);
        }

        const data = await readStoredData();
        const moment = model.createMoment(validation.content, {
          imageIds: validation.imageIds,
          now,
        });
        const nextData = model.addMoment(data, moment);
        await writeStoredData(nextData);
        return {
          moment,
          data: nextData,
        };
      } catch (error) {
        await Promise.all(
          savedImageIds.map((imageId) =>
            storage.deleteImageIfUnused(imageId).catch(() => undefined),
          ),
        );
        throw error;
      }
    });
  }

  function getImageBlobs(imageIds) {
    return enqueue(async () => {
      const ids = model.normalizeImageResourceIds(imageIds);
      return Promise.all(
        ids.map(async (id) => {
          try {
            return {
              id,
              blob: await storage.getImageBlob(id),
              error: null,
            };
          } catch (error) {
            return {
              id,
              blob: null,
              error,
            };
          }
        }),
      );
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
    getImageBlobs,
    addInteractions,
    updateInteraction,
    recoverInterruptedInteractions,
    waitForIdle,
  });
})(window);
