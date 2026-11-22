"use strict";

const assert = require("node:assert/strict");
const model = require("../js/home-screen-model.js");

function runTests() {
  assert.deepEqual(model.normalizeLayout(null).order, [
    "beautify",
    "guide",
    "chat",
    "world-books",
    "settings",
  ]);

  const customIds = ["beautify", "chat", "settings", "memory"];
  assert.deepEqual(
    model.normalizeLayout(
      {
        version: 99,
        order: ["chat", "missing", "chat", "", "settings"],
      },
      customIds,
    ),
    {
      version: 1,
      order: ["chat", "settings", "beautify", "memory"],
    },
  );

  assert.deepEqual(
    model.moveApp(
      ["beautify", "guide", "chat", "world-books", "settings"],
      "settings",
      "beautify",
      false,
    ).order,
    ["settings", "beautify", "guide", "chat", "world-books"],
  );

  assert.deepEqual(
    model.moveApp(
      ["beautify", "guide", "chat", "world-books", "settings"],
      "beautify",
      "chat",
      true,
    ).order,
    ["guide", "chat", "beautify", "world-books", "settings"],
  );

  assert.deepEqual(
    model.moveAppByOffset(
      ["beautify", "guide", "chat", "world-books", "settings"],
      "chat",
      -4,
    ).order,
    ["chat", "beautify", "guide", "world-books", "settings"],
  );

  assert.deepEqual(
    model.moveAppByOffset(
      ["beautify", "guide", "chat", "world-books", "settings"],
      "guide",
      1,
    ).order,
    ["beautify", "chat", "guide", "world-books", "settings"],
  );

  assert.deepEqual(
    model.normalizeLayout(
      {
        order: ["chat", "chat", "world-books"],
      },
      ["chat", "world-books"],
    ).order,
    ["chat", "world-books"],
  );

  console.log("Home screen model tests passed.");
}

runTests();
