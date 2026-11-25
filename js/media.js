"use strict";

(() => {
  function isBlob(value) {
    return Boolean(value && typeof value === "object" && typeof value.size === "number");
  }

  function readAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
      if (!isBlob(blob)) {
        reject(new Error("图片内容不是有效的 Blob。"));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("图片读取失败。"));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(blob);
    });
  }

  function dataUrlToBlob(dataUrl) {
    const value = String(dataUrl || "");
    const match = value.match(/^data:([^;,]+)?(?:;[^,]*)?;base64,([\s\S]+)$/i);
    if (!match) {
      throw new Error("图片数据不是有效的 Base64 Data URL。");
    }

    const mimeType = match[1] || "application/octet-stream";
    if (!/^image\/(?:png|jpeg|webp|gif)$/i.test(mimeType)) {
      throw new Error("备份中的图片类型不受支持。");
    }

    let binary;
    try {
      binary = window.atob(match[2].replace(/\s/g, ""));
    } catch {
      throw new Error("图片 Base64 内容损坏。");
    }

    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: mimeType });
  }

  function createObjectUrl(blob) {
    if (!isBlob(blob)) return "";
    try {
      return URL.createObjectURL(blob);
    } catch {
      return "";
    }
  }

  function revokeObjectUrl(url) {
    if (!url || !String(url).startsWith("blob:")) return;
    try {
      URL.revokeObjectURL(url);
    } catch {
      // A revoked or unavailable object URL is harmless at this boundary.
    }
  }

  function resizeImageToBlob(file, options = {}) {
    const maxSize = Number(options.maxSize) || 256;
    const quality = Number(options.quality) || 0.84;

    return new Promise((resolve, reject) => {
      if (!isBlob(file)) {
        reject(new Error("图片文件无法读取。"));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error("图片读取失败。"));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("图片解析失败。"));
        image.onload = () => {
          const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
          if (!sourceSize) {
            reject(new Error("图片尺寸无效。"));
            return;
          }

          const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2);
          const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2);
          const canvas = document.createElement("canvas");
          canvas.width = maxSize;
          canvas.height = maxSize;
          const context = canvas.getContext("2d");
          if (!context) {
            reject(new Error("浏览器无法处理图片。"));
            return;
          }
          context.fillStyle = "#f5f2ea";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(
            image,
            sourceX,
            sourceY,
            sourceSize,
            sourceSize,
            0,
            0,
            canvas.width,
            canvas.height,
          );

          const finish = (blob) => {
            if (!blob) {
              reject(new Error("浏览器无法压缩图片。"));
              return;
            }
            resolve(blob);
          };

          if (typeof canvas.toBlob === "function") {
            canvas.toBlob(finish, "image/jpeg", quality);
          } else {
            try {
              finish(dataUrlToBlob(canvas.toDataURL("image/jpeg", quality)));
            } catch (error) {
              reject(error);
            }
          }
        };
        image.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
  }

  function resizeContainedImageToBlob(file, options = {}) {
    const maxDimension = Number(options.maxDimension) || 1600;
    const quality = Number(options.quality) || 0.82;
    const label = String(options.label || "壁纸");

    return new Promise((resolve, reject) => {
      if (!isBlob(file)) {
        reject(new Error(`${label}文件无法读取。`));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`${label}读取失败。`));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error(`${label}图片解析失败。`));
        image.onload = () => {
          const width = Number(image.naturalWidth);
          const height = Number(image.naturalHeight);
          if (!width || !height) {
            reject(new Error(`${label}图片尺寸无效。`));
            return;
          }

          const scale = Math.min(1, maxDimension / Math.max(width, height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          const context = canvas.getContext("2d");
          if (!context) {
            reject(new Error(`浏览器无法处理${label}图片。`));
            return;
          }
          context.fillStyle = "#f5f2ea";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);

          const finish = (blob) => {
            if (!blob) {
              reject(new Error(`浏览器无法压缩${label}图片。`));
              return;
            }
            resolve(blob);
          };

          if (typeof canvas.toBlob === "function") {
            canvas.toBlob(finish, "image/jpeg", quality);
          } else {
            try {
              finish(dataUrlToBlob(canvas.toDataURL("image/jpeg", quality)));
            } catch (error) {
              reject(error);
            }
          }
        };
        image.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
  }

  function resizeWallpaperToBlob(file, options = {}) {
    return resizeContainedImageToBlob(file, {
      ...options,
      maxDimension: Number(options.maxDimension) || 1600,
      quality: Number(options.quality) || 0.82,
      label: "壁纸",
    });
  }

  function resizeMomentPhotoToBlob(file, options = {}) {
    return resizeContainedImageToBlob(file, {
      ...options,
      maxDimension: Number(options.maxDimension) || 1800,
      quality: Number(options.quality) || 0.84,
      label: "朋友圈照片",
    });
  }

  window.PocketLabMedia = {
    isBlob,
    readAsDataUrl,
    dataUrlToBlob,
    createObjectUrl,
    revokeObjectUrl,
    resizeImageToBlob,
    resizeWallpaperToBlob,
    resizeMomentPhotoToBlob,
  };
})();
