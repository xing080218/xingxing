"use strict";

(() => {
  const keys = Object.freeze({
    apiUrl: "pocket-lab-api-url",
    modelName: "pocket-lab-model-name",
    apiKey: "pocket-lab-api-key",
    connected: "pocket-lab-connected",
    activeCharacterId: "pocket-lab-active-character-id",
  });

  const legacyKeys = Object.freeze({
    character: "pocket-lab-character",
    messages: "pocket-lab-chat-messages",
  });

  function read(storage, key) {
    try {
      return storage && typeof storage.getItem === "function"
        ? storage.getItem(key) || ""
        : "";
    } catch {
      return "";
    }
  }

  function write(storage, key, value) {
    try {
      storage.setItem(key, value);
      return null;
    } catch (error) {
      return error;
    }
  }

  function remove(storage, key) {
    try {
      storage.removeItem(key);
      return null;
    } catch (error) {
      return error;
    }
  }

  window.PocketLabSettings = {
    keys,
    legacyKeys,

    readApiSettings() {
      return {
        apiUrl: read(window.localStorage, keys.apiUrl),
        modelName: read(window.localStorage, keys.modelName),
        apiKey: read(window.sessionStorage, keys.apiKey),
        connected: read(window.sessionStorage, keys.connected) === "true",
      };
    },

    saveApiSettings(settings) {
      const source = settings && typeof settings === "object" ? settings : {};
      const errors = [];
      const apiUrlError = write(window.localStorage, keys.apiUrl, String(source.apiUrl || "").trim());
      const modelError = write(
        window.localStorage,
        keys.modelName,
        String(source.modelName || "").trim(),
      );
      const keyError = write(window.sessionStorage, keys.apiKey, String(source.apiKey || "").trim());
      [apiUrlError, modelError, keyError].filter(Boolean).forEach((error) => errors.push(error));
      return errors[0] || null;
    },

    setConnected(connected) {
      return connected
        ? write(window.sessionStorage, keys.connected, "true")
        : remove(window.sessionStorage, keys.connected);
    },

    readActiveCharacterId() {
      return read(window.localStorage, keys.activeCharacterId).trim();
    },

    saveActiveCharacterId(characterId) {
      return write(
        window.localStorage,
        keys.activeCharacterId,
        String(characterId || "").trim(),
      );
    },

    readLegacyValue(key) {
      return read(window.localStorage, key);
    },

    removeLegacyValue(key) {
      return remove(window.localStorage, key);
    },
  };
})();
