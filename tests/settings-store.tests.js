"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "js", "settings-store.js"),
  "utf8",
);

function createStorageError(name, message) {
  const error = new Error(message);
  error.name = name;
  return error;
}

function createStorage(initialValues = {}) {
  const entries = new Map(Object.entries(initialValues));
  const setFailures = new Map();
  const removeFailures = new Map();

  function consumeFailure(failures, key) {
    const remaining = failures.get(key) || 0;
    if (!remaining) return null;
    failures.set(key, remaining - 1);
    return createStorageError(
      "QuotaExceededError",
      `Storage write failed for ${key}`,
    );
  }

  return {
    getItem(key) {
      return entries.has(key) ? entries.get(key) : null;
    },
    setItem(key, value) {
      const error = consumeFailure(setFailures, key);
      if (error) throw error;
      entries.set(key, String(value));
    },
    removeItem(key) {
      const error = consumeFailure(removeFailures, key);
      if (error) throw error;
      entries.delete(key);
    },
    failNextSet(key) {
      setFailures.set(key, (setFailures.get(key) || 0) + 1);
    },
    failNextRemove(key) {
      removeFailures.set(key, (removeFailures.get(key) || 0) + 1);
    },
    snapshot() {
      return Object.fromEntries(entries);
    },
  };
}

function loadSettings(localStorage, sessionStorage) {
  const context = {
    window: {
      localStorage,
      sessionStorage,
    },
  };
  vm.runInNewContext(source, context, { filename: "js/settings-store.js" });
  return context.window.PocketLabSettings;
}

function runTests() {
  const placeholderKey = "your-api-key";
  const apiUrl = "https://api.example.com/v1";
  const modelName = "example-model";
  const apiKeys = [
    "pocket-lab-api-url",
    "pocket-lab-model-name",
    "pocket-lab-api-key",
    "pocket-lab-connected",
  ];

  function readValues(settings) {
    const value = settings.readApiSettings();
    return {
      apiUrl: String(value.apiUrl || ""),
      modelName: String(value.modelName || ""),
      apiKey: String(value.apiKey || ""),
      connected: Boolean(value.connected),
    };
  }

  function assertApiKeysEmpty(storage, label) {
    for (const key of apiKeys) {
      assert.equal(storage.getItem(key), null, `${label} should remove ${key}`);
    }
  }

  // A normal save survives a new browser session and restores the key/status.
  {
    const localStorage = createStorage();
    const sessionStorage = createStorage();
    const settings = loadSettings(localStorage, sessionStorage);

    const saveError = settings.saveApiSettings({
      apiUrl,
      modelName,
      apiKey: placeholderKey,
    });

    assert.equal(saveError, null);
    assert.equal(localStorage.getItem("pocket-lab-api-url"), apiUrl);
    assert.equal(localStorage.getItem("pocket-lab-model-name"), modelName);
    assert.equal(localStorage.getItem("pocket-lab-api-key"), placeholderKey);
    assert.equal(sessionStorage.getItem("pocket-lab-api-key"), null);
    assert.equal(settings.setConnected(true), null);
    assert.equal(localStorage.getItem("pocket-lab-connected"), "true");
    assert.equal(sessionStorage.getItem("pocket-lab-connected"), null);

    const reopenedSettings = loadSettings(localStorage, createStorage());
    assert.deepEqual(readValues(reopenedSettings), {
      apiUrl,
      modelName,
      apiKey: placeholderKey,
      connected: true,
    });
  }

  // Settings left by the previous session-only implementation migrate once.
  {
    const localStorage = createStorage();
    const sessionStorage = createStorage({
      "pocket-lab-api-url": apiUrl,
      "pocket-lab-model-name": modelName,
      "pocket-lab-api-key": placeholderKey,
      "pocket-lab-connected": "true",
    });
    const settings = loadSettings(localStorage, sessionStorage);

    assert.deepEqual(readValues(settings), {
      apiUrl,
      modelName,
      apiKey: placeholderKey,
      connected: true,
    });
    assert.deepEqual(localStorage.snapshot(), {
      "pocket-lab-api-url": apiUrl,
      "pocket-lab-model-name": modelName,
      "pocket-lab-api-key": placeholderKey,
      "pocket-lab-connected": "true",
    });
    assertApiKeysEmpty(sessionStorage, "legacy session migration");
  }

  // Clearing removes current and legacy copies from both storage areas.
  {
    const localStorage = createStorage({
      "pocket-lab-api-url": apiUrl,
      "pocket-lab-model-name": modelName,
      "pocket-lab-api-key": placeholderKey,
      "pocket-lab-connected": "true",
    });
    const sessionStorage = createStorage({
      "pocket-lab-api-key": "legacy-your-api-key",
      "pocket-lab-connected": "true",
    });
    const settings = loadSettings(localStorage, sessionStorage);

    assert.equal(settings.clearApiSettings(), null);
    assertApiKeysEmpty(localStorage, "clear local settings");
    assertApiKeysEmpty(sessionStorage, "clear legacy settings");
  }

  // If local storage rejects the first write, legacy credentials stay intact.
  {
    const localStorage = createStorage();
    const legacySession = {
      "pocket-lab-api-key": placeholderKey,
      "pocket-lab-connected": "true",
    };
    const sessionStorage = createStorage(legacySession);
    const settings = loadSettings(localStorage, sessionStorage);
    localStorage.failNextSet("pocket-lab-api-url");

    const saveError = settings.saveApiSettings({
      apiUrl,
      modelName,
      apiKey: placeholderKey,
    });

    assert.equal(saveError && saveError.name, "QuotaExceededError");
    assert.deepEqual(localStorage.snapshot(), {});
    assert.deepEqual(sessionStorage.snapshot(), legacySession);
  }

  // A partial local write rolls every previously written value back.
  {
    const localValues = {
      "pocket-lab-api-url": "https://old.example.com/v1",
      "pocket-lab-model-name": "old-model",
      "pocket-lab-api-key": "old-your-api-key",
      "pocket-lab-connected": "true",
      "unrelated-setting": "keep-me",
    };
    const sessionValues = {
      "pocket-lab-api-key": "old-your-api-key",
      "pocket-lab-connected": "true",
    };
    const localStorage = createStorage(localValues);
    const sessionStorage = createStorage(sessionValues);
    const settings = loadSettings(localStorage, sessionStorage);
    localStorage.failNextSet("pocket-lab-model-name");

    const saveError = settings.saveApiSettings({
      apiUrl,
      modelName,
      apiKey: placeholderKey,
    });

    assert.equal(saveError && saveError.name, "QuotaExceededError");
    assert.deepEqual(localStorage.snapshot(), localValues);
    assert.deepEqual(sessionStorage.snapshot(), sessionValues);
  }

  // A failed migration rolls back both the copy and the legacy removals.
  {
    const sessionValues = {
      "pocket-lab-api-url": apiUrl,
      "pocket-lab-model-name": modelName,
      "pocket-lab-api-key": placeholderKey,
      "pocket-lab-connected": "true",
    };
    const localStorage = createStorage();
    const sessionStorage = createStorage(sessionValues);
    const settings = loadSettings(localStorage, sessionStorage);
    localStorage.failNextSet("pocket-lab-api-key");

    assert.deepEqual(readValues(settings), {
      apiUrl,
      modelName,
      apiKey: placeholderKey,
      connected: true,
    });
    assert.deepEqual(localStorage.snapshot(), {});
    assert.deepEqual(sessionStorage.snapshot(), sessionValues);
  }

  // Connection status is also restored if its second storage cleanup fails.
  {
    const localValues = {
      "pocket-lab-connected": "true",
    };
    const sessionValues = {
      "pocket-lab-connected": "true",
    };
    const localStorage = createStorage(localValues);
    const sessionStorage = createStorage(sessionValues);
    const settings = loadSettings(localStorage, sessionStorage);
    sessionStorage.failNextRemove("pocket-lab-connected");

    const saveError = settings.setConnected(false);

    assert.equal(saveError && saveError.name, "QuotaExceededError");
    assert.deepEqual(localStorage.snapshot(), localValues);
    assert.deepEqual(sessionStorage.snapshot(), sessionValues);
  }

  console.log("Settings store tests passed.");
}

runTests();
