"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "js", "settings-store.js"),
  "utf8",
);

function createStorage() {
  const entries = new Map();
  return {
    getItem(key) {
      return entries.has(key) ? entries.get(key) : null;
    },
    setItem(key, value) {
      entries.set(key, String(value));
    },
    removeItem(key) {
      entries.delete(key);
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
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const settings = loadSettings(localStorage, sessionStorage);
  const placeholderKey = "your-api-key";

  const saveError = settings.saveApiSettings({
    apiUrl: "https://api.example.com/v1",
    modelName: "example-model",
    apiKey: placeholderKey,
  });

  assert.equal(saveError, null);
  assert.equal(localStorage.getItem("pocket-lab-api-url"), "https://api.example.com/v1");
  assert.equal(localStorage.getItem("pocket-lab-model-name"), "example-model");
  assert.equal(localStorage.getItem("pocket-lab-api-key"), null);
  assert.equal(sessionStorage.getItem("pocket-lab-api-key"), placeholderKey);
  assert.equal(JSON.stringify(localStorage.snapshot()).includes(placeholderKey), false);

  settings.setConnected(true);
  assert.equal(sessionStorage.getItem("pocket-lab-connected"), "true");
  assert.deepEqual(
    { ...settings.readApiSettings() },
    {
      apiUrl: "https://api.example.com/v1",
      modelName: "example-model",
      apiKey: placeholderKey,
      connected: true,
    },
  );

  const newSessionStorage = createStorage();
  const reopenedSettings = loadSettings(localStorage, newSessionStorage);
  const reopened = reopenedSettings.readApiSettings();
  assert.equal(reopened.apiUrl, "https://api.example.com/v1");
  assert.equal(reopened.modelName, "example-model");
  assert.equal(reopened.apiKey, "");
  assert.equal(reopened.connected, false);

  console.log("Settings store tests passed.");
}

runTests();
