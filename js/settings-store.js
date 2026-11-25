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

  const apiStorageKeys = Object.freeze([
    keys.apiUrl,
    keys.modelName,
    keys.apiKey,
    keys.connected,
  ]);

  function resolveStorage(name) {
    try {
      const storage = window[name];
      if (
        !storage ||
        typeof storage.getItem !== "function" ||
        typeof storage.setItem !== "function" ||
        typeof storage.removeItem !== "function"
      ) {
        throw new Error("浏览器没有提供可用的本地存储。");
      }
      return { storage, error: null };
    } catch (error) {
      return { storage: null, error };
    }
  }

  function readRaw(storage, key) {
    if (!storage) return { value: null, error: null };
    try {
      return { value: storage.getItem(key), error: null };
    } catch (error) {
      return { value: null, error };
    }
  }

  function readText(storage, key) {
    const result = readRaw(storage, key);
    return result.error ? "" : result.value || "";
  }

  function writeRaw(storage, key, value) {
    try {
      if (value === null) {
        storage.removeItem(key);
      } else {
        storage.setItem(key, value);
      }
      return null;
    } catch (error) {
      return error;
    }
  }

  function snapshotStorage(storage, storageKeys) {
    const snapshot = [];
    for (const key of storageKeys) {
      const result = readRaw(storage, key);
      if (result.error) return { snapshot, error: result.error };
      snapshot.push({ key, value: result.value });
    }
    return { snapshot, error: null };
  }

  function restoreSnapshot(storage, snapshot) {
    const errors = [];
    for (const entry of snapshot) {
      const error = writeRaw(storage, entry.key, entry.value);
      if (error) errors.push(error);
    }
    return errors;
  }

  function attachRollbackError(error, rollbackErrors) {
    if (!error || !rollbackErrors.length) return error;
    try {
      Object.defineProperty(error, "rollbackError", {
        configurable: true,
        enumerable: false,
        value: rollbackErrors[0],
      });
    } catch {
      // Preserve the original storage error if it cannot be extended.
    }
    return error;
  }

  function applyStorageChanges(changes) {
    for (const change of changes) {
      if (!change.storage) {
        continue;
      }
      const error = writeRaw(change.storage, change.key, change.value);
      if (error) return error;
    }
    return null;
  }

  function rollbackAll(snapshots) {
    const errors = [];
    snapshots.forEach(({ storage, snapshot }) => {
      if (storage) errors.push(...restoreSnapshot(storage, snapshot));
    });
    return errors;
  }

  function readApiValues(localResult, sessionResult) {
    const values = {};
    for (const key of apiStorageKeys) {
      const localRead = localResult.error
        ? { value: null }
        : readRaw(localResult.storage, key);
      const sessionRead = sessionResult.error
        ? { value: null }
        : readRaw(sessionResult.storage, key);
      values[key] =
        localRead.value !== null ? localRead.value : sessionRead.value;
    }
    return values;
  }

  function migrateSessionSettings(localResult, sessionResult) {
    if (localResult.error) {
      return {
        error: localResult.error,
        values: null,
      };
    }

    const localSnapshotResult = snapshotStorage(localResult.storage, apiStorageKeys);
    if (localSnapshotResult.error) {
      return {
        error: localSnapshotResult.error,
        values: null,
      };
    }

    if (sessionResult.error || !sessionResult.storage) {
      return {
        error: null,
        values: readApiValues(localResult, sessionResult),
      };
    }

    const sessionSnapshotResult = snapshotStorage(sessionResult.storage, apiStorageKeys);
    if (sessionSnapshotResult.error) {
      return {
        error: null,
        values: readApiValues(localResult, sessionResult),
      };
    }

    const values = readApiValues(localResult, sessionResult);
    const changes = [];
    const sessionRemovals = [];
    for (const key of apiStorageKeys) {
      const localValue = localSnapshotResult.snapshot.find(
        (entry) => entry.key === key,
      )?.value;
      const sessionValue = sessionSnapshotResult.snapshot.find(
        (entry) => entry.key === key,
      )?.value;
      if (localValue === null && sessionValue !== null) {
        changes.push({ storage: localResult.storage, key, value: sessionValue });
        sessionRemovals.push({
          storage: sessionResult.storage,
          key,
          value: null,
        });
      }
    }

    if (!changes.length && !sessionRemovals.length) {
      return { error: null, values };
    }

    const snapshots = [
      { storage: localResult.storage, snapshot: localSnapshotResult.snapshot },
      {
        storage: sessionResult.storage,
        snapshot: sessionSnapshotResult.snapshot,
      },
    ];
    const migrationError = applyStorageChanges([
      ...changes,
      ...sessionRemovals,
    ]);
    if (!migrationError) {
      return { error: null, values };
    }

    return {
      error: attachRollbackError(migrationError, rollbackAll(snapshots)),
      values,
    };
  }

  window.PocketLabSettings = {
    keys,
    legacyKeys,

    readApiSettings() {
      const localResult = resolveStorage("localStorage");
      const sessionResult = resolveStorage("sessionStorage");
      const migration = migrateSessionSettings(localResult, sessionResult);
      const values =
        migration.values ||
        readApiValues(localResult, sessionResult);
      return {
        apiUrl: values[keys.apiUrl] || "",
        modelName: values[keys.modelName] || "",
        apiKey: values[keys.apiKey] || "",
        connected: values[keys.connected] === "true",
        storageError: migration.error,
      };
    },

    saveApiSettings(settings) {
      const source = settings && typeof settings === "object" ? settings : {};
      const localResult = resolveStorage("localStorage");
      if (localResult.error) return localResult.error;

      const sessionResult = resolveStorage("sessionStorage");
      const localSnapshotResult = snapshotStorage(localResult.storage, apiStorageKeys);
      if (localSnapshotResult.error) return localSnapshotResult.error;

      const snapshots = [
        {
          storage: localResult.storage,
          snapshot: localSnapshotResult.snapshot,
        },
      ];
      if (!sessionResult.error && sessionResult.storage) {
        const sessionSnapshotResult = snapshotStorage(
          sessionResult.storage,
          [keys.apiKey, keys.connected],
        );
        if (sessionSnapshotResult.error) return sessionSnapshotResult.error;
        snapshots.push({
          storage: sessionResult.storage,
          snapshot: sessionSnapshotResult.snapshot,
        });
      }

      const writeError = applyStorageChanges([
        {
          storage: localResult.storage,
          key: keys.apiUrl,
          value: String(source.apiUrl || "").trim(),
        },
        {
          storage: localResult.storage,
          key: keys.modelName,
          value: String(source.modelName || "").trim(),
        },
        {
          storage: localResult.storage,
          key: keys.apiKey,
          value: String(source.apiKey || "").trim(),
        },
        {
          storage: localResult.storage,
          key: keys.connected,
          value: null,
        },
        {
          storage: sessionResult.storage,
          key: keys.apiKey,
          value: null,
        },
        {
          storage: sessionResult.storage,
          key: keys.connected,
          value: null,
        },
      ]);

      return writeError
        ? attachRollbackError(writeError, rollbackAll(snapshots))
        : null;
    },

    setConnected(connected) {
      const localResult = resolveStorage("localStorage");
      if (localResult.error) return localResult.error;

      const sessionResult = resolveStorage("sessionStorage");
      const localSnapshotResult = snapshotStorage(
        localResult.storage,
        [keys.connected],
      );
      if (localSnapshotResult.error) return localSnapshotResult.error;

      const snapshots = [
        {
          storage: localResult.storage,
          snapshot: localSnapshotResult.snapshot,
        },
      ];
      if (!sessionResult.error && sessionResult.storage) {
        const sessionSnapshotResult = snapshotStorage(
          sessionResult.storage,
          [keys.connected],
        );
        if (sessionSnapshotResult.error) return sessionSnapshotResult.error;
        snapshots.push({
          storage: sessionResult.storage,
          snapshot: sessionSnapshotResult.snapshot,
        });
      }

      const writeError = applyStorageChanges([
        {
          storage: localResult.storage,
          key: keys.connected,
          value: connected ? "true" : null,
        },
        {
          storage: sessionResult.storage,
          key: keys.connected,
          value: null,
        },
      ]);

      return writeError
        ? attachRollbackError(writeError, rollbackAll(snapshots))
        : null;
    },

    clearApiSettings() {
      const localResult = resolveStorage("localStorage");
      if (localResult.error) return localResult.error;

      const sessionResult = resolveStorage("sessionStorage");
      const localSnapshotResult = snapshotStorage(localResult.storage, apiStorageKeys);
      if (localSnapshotResult.error) return localSnapshotResult.error;

      const snapshots = [
        {
          storage: localResult.storage,
          snapshot: localSnapshotResult.snapshot,
        },
      ];
      if (!sessionResult.error && sessionResult.storage) {
        const sessionSnapshotResult = snapshotStorage(
          sessionResult.storage,
          apiStorageKeys,
        );
        if (sessionSnapshotResult.error) return sessionSnapshotResult.error;
        snapshots.push({
          storage: sessionResult.storage,
          snapshot: sessionSnapshotResult.snapshot,
        });
      }

      const clearError = applyStorageChanges([
        ...apiStorageKeys.map((key) => ({
          storage: localResult.storage,
          key,
          value: null,
        })),
        ...apiStorageKeys.map((key) => ({
          storage: sessionResult.storage,
          key,
          value: null,
        })),
      ]);

      return clearError
        ? attachRollbackError(clearError, rollbackAll(snapshots))
        : null;
    },

    readActiveCharacterId() {
      return readText(
        resolveStorage("localStorage").storage,
        keys.activeCharacterId,
      ).trim();
    },

    saveActiveCharacterId(characterId) {
      const localResult = resolveStorage("localStorage");
      if (localResult.error) return localResult.error;
      return writeRaw(
        localResult.storage,
        keys.activeCharacterId,
        String(characterId || "").trim(),
      );
    },

    readLegacyValue(key) {
      return readText(resolveStorage("localStorage").storage, key);
    },

    removeLegacyValue(key) {
      const localResult = resolveStorage("localStorage");
      if (localResult.error) return localResult.error;
      return writeRaw(localResult.storage, key, null);
    },
  };
})();
