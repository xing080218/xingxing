"use strict";

((root) => {
  const ALLOWED_PHOTO_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
  ]);

  function createComposerController(options = {}) {
    const media = options.media || root.PocketLabMedia;
    const model = options.model || root.PocketLabMomentsModel;
    const input = options.input;
    const trigger = options.trigger;
    const preview = options.preview;
    const countLabel = options.countLabel;
    const onChange =
      typeof options.onChange === "function" ? options.onChange : () => {};
    const onBusyChange =
      typeof options.onBusyChange === "function"
        ? options.onBusyChange
        : () => {};
    const onError =
      typeof options.onError === "function" ? options.onError : () => {};
    const maxCount = Math.max(
      1,
      Number(options.maxCount) || Number(model?.MAX_IMAGE_COUNT) || 9,
    );

    if (
      !media ||
      !model ||
      !input ||
      !trigger ||
      !preview ||
      !countLabel
    ) {
      throw new Error("朋友圈照片选择组件没有完成加载。");
    }

    let photos = [];
    let disabled = false;
    let busy = false;
    let generation = 0;

    function reportError(title, message, nextStep) {
      onError({
        title,
        message,
        nextStep,
      });
    }

    function setBusy(value) {
      const nextBusy = Boolean(value);
      if (busy === nextBusy) return;
      busy = nextBusy;
      render();
      onBusyChange(busy);
    }

    function removePhoto(photoId) {
      if (disabled || busy) return;
      const index = photos.findIndex((photo) => photo.id === photoId);
      if (index < 0) return;
      const [removed] = photos.splice(index, 1);
      media.revokeObjectUrl(removed.previewUrl);
      render();
      onChange(getPhotos());
    }

    function render() {
      trigger.disabled = disabled || busy || photos.length >= maxCount;
      input.disabled = disabled || busy || photos.length >= maxCount;
      countLabel.textContent = `${photos.length} / ${maxCount}`;
      countLabel.classList.toggle("is-at-limit", photos.length >= maxCount);
      preview.dataset.count = String(photos.length);
      preview.classList.toggle("is-empty", photos.length === 0);

      const items = photos.map((photo, index) => {
        const item = root.document.createElement("figure");
        item.className = "moment-photo-preview-item";
        item.dataset.photoId = photo.id;

        const image = root.document.createElement("img");
        image.src = photo.previewUrl;
        image.alt = `待发布照片 ${index + 1}`;
        image.decoding = "async";

        const remove = root.document.createElement("button");
        remove.type = "button";
        remove.className = "moment-photo-remove";
        remove.dataset.removeMomentPhoto = photo.id;
        remove.setAttribute("aria-label", `移除第 ${index + 1} 张照片`);
        remove.textContent = "×";
        remove.disabled = disabled || busy;

        item.append(image, remove);
        return item;
      });
      preview.replaceChildren(...items);
    }

    async function handleFiles(filesValue) {
      const files = Array.from(filesValue || []);
      if (!files.length || disabled || busy) return;

      const remaining = maxCount - photos.length;
      if (files.length > remaining) {
        reportError(
          "照片数量超出上限",
          `每条朋友圈最多添加 ${maxCount} 张照片，当前还可以添加 ${remaining} 张。`,
          "减少本次选择的照片数量，或先移除预览中的照片后重试。",
        );
        return;
      }

      const unsupported = files.find(
        (file) =>
          !ALLOWED_PHOTO_TYPES.has(
            String(file?.type || "").toLowerCase(),
          ),
      );
      if (unsupported) {
        reportError(
          "照片格式不受支持",
          `“${unsupported.name || "所选文件"}”不是 PNG、JPG 或 WebP 图片。`,
          "重新选择 PNG、JPG 或 WebP 照片；iPhone 可在分享时选择兼容格式。",
        );
        return;
      }

      const runGeneration = generation;
      const prepared = [];
      setBusy(true);
      try {
        for (const file of files) {
          const blob = await media.resizeMomentPhotoToBlob(file, {
            maxDimension: 1800,
            quality: 0.84,
          });
          if (runGeneration !== generation) {
            prepared.forEach((photo) =>
              media.revokeObjectUrl(photo.previewUrl),
            );
            return;
          }
          const previewUrl = media.createObjectUrl(blob);
          if (!previewUrl) {
            throw new Error("浏览器无法生成照片预览。");
          }
          prepared.push({
            id: model.createImageId(),
            blob,
            previewUrl,
          });
        }
        if (runGeneration !== generation) {
          prepared.forEach((photo) =>
            media.revokeObjectUrl(photo.previewUrl),
          );
          return;
        }
        photos = photos.concat(prepared);
        render();
        onChange(getPhotos());
      } catch (error) {
        prepared.forEach((photo) =>
          media.revokeObjectUrl(photo.previewUrl),
        );
        if (runGeneration === generation) {
          reportError(
            "照片读取失败",
            error?.message || "浏览器无法处理所选照片。",
            "换一张尺寸较小的 PNG、JPG 或 WebP 照片后重试；如果只失败一张，可先单独添加其他照片。",
          );
        }
      } finally {
        if (runGeneration === generation) {
          setBusy(false);
        }
      }
    }

    input.addEventListener("change", () => {
      const files = Array.from(input.files || []);
      input.value = "";
      void handleFiles(files);
    });
    trigger.addEventListener("click", () => {
      if (!trigger.disabled) input.click();
    });
    preview.addEventListener("click", (event) => {
      const button =
        event.target instanceof Element
          ? event.target.closest("[data-remove-moment-photo]")
          : null;
      if (button) {
        removePhoto(button.dataset.removeMomentPhoto || "");
      }
    });

    render();

    function getPhotos() {
      return photos.map((photo) => ({ ...photo }));
    }

    function clear() {
      generation += 1;
      photos.forEach((photo) =>
        media.revokeObjectUrl(photo.previewUrl),
      );
      photos = [];
      busy = false;
      render();
      onBusyChange(false);
      onChange([]);
    }

    function setDisabled(value) {
      disabled = Boolean(value);
      render();
    }

    function destroy() {
      clear();
    }

    return Object.freeze({
      getPhotos,
      clear,
      setDisabled,
      isBusy: () => busy,
      isAtLimit: () => photos.length >= maxCount,
      destroy,
    });
  }

  async function loadPhotoResources(imageIdsValue, options = {}) {
    const media = options.media || root.PocketLabMedia;
    const model = options.model || root.PocketLabMomentsModel;
    const store = options.store || root.PocketLabMomentsStore;
    if (!media || !model || !store) {
      throw new Error("朋友圈照片读取组件没有完成加载。");
    }

    const imageIds = model.normalizeImageResourceIds(imageIdsValue);
    const resources = new Map();
    if (!imageIds.length) return resources;

    let records = [];
    try {
      records = await store.getImageBlobs(imageIds);
    } catch (error) {
      imageIds.forEach((id) => {
        resources.set(id, {
          url: "",
          error,
        });
      });
      return resources;
    }

    const recordsById = new Map(
      (Array.isArray(records) ? records : []).map((record) => [
        record.id,
        record,
      ]),
    );
    imageIds.forEach((id) => {
      const record = recordsById.get(id);
      const url = record?.blob ? media.createObjectUrl(record.blob) : "";
      resources.set(id, {
        url,
        error:
          record?.error ||
          (!record?.blob
            ? new Error("这张照片在本机数据库中找不到。")
            : !url
              ? new Error("浏览器无法显示这张照片。")
              : null),
      });
    });
    return resources;
  }

  function mergePhotoResources(target, source) {
    source.forEach((resource, id) => {
      if (!target.has(id)) target.set(id, resource);
    });
    return target;
  }

  function releasePhotoResources(resources, options = {}) {
    const media = options.media || root.PocketLabMedia;
    if (!resources || !media) return;
    resources.forEach((resource) => {
      media.revokeObjectUrl(resource?.url);
    });
    resources.clear();
  }

  function createPhotoFailure(message) {
    const failure = root.document.createElement("span");
    failure.className = "moment-photo-failure";
    failure.textContent = message || "照片无法显示";
    return failure;
  }

  function createFeedPhotoGrid(imageIdsValue, resources, options = {}) {
    const model = options.model || root.PocketLabMomentsModel;
    const imageIds = model?.normalizeImageIds
      ? model.normalizeImageIds(imageIdsValue)
      : Array.isArray(imageIdsValue)
        ? imageIdsValue
        : [];
    if (!imageIds.length) return null;

    const grid = root.document.createElement("div");
    grid.className = "moment-photo-grid";
    grid.dataset.count = String(imageIds.length);
    grid.setAttribute("aria-label", `动态包含 ${imageIds.length} 张照片`);

    imageIds.forEach((id, index) => {
      const tile = root.document.createElement("div");
      tile.className = "moment-photo-tile";
      tile.dataset.photoId = id;
      const resource = resources instanceof Map
        ? resources.get(id)
        : null;

      if (!resource?.url) {
        tile.append(createPhotoFailure("照片无法显示"));
      } else {
        const image = root.document.createElement("img");
        image.src = resource.url;
        image.alt = `朋友圈照片 ${index + 1}`;
        image.decoding = "async";
        image.addEventListener(
          "error",
          () => image.replaceWith(createPhotoFailure("照片加载失败")),
          { once: true },
        );
        tile.append(image);
      }
      grid.append(tile);
    });
    return grid;
  }

  root.PocketLabMomentsPhotoUI = Object.freeze({
    ALLOWED_PHOTO_TYPES,
    createComposerController,
    loadPhotoResources,
    mergePhotoResources,
    releasePhotoResources,
    createFeedPhotoGrid,
  });
})(window);
