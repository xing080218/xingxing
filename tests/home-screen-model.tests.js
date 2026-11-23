"use strict";

const assert = require("node:assert/strict");
const model = require("../js/home-screen-model.js");

function runTests() {
  assert.equal(model.DOCK_MAX_APPS, 4);
  assert.deepEqual(model.normalizeLayout(null), {
    version: 2,
    homeOrder: [
      "beautify",
      "guide",
      "chat",
      "world-books",
      "settings",
    ],
    dockOrder: ["self-profile"],
  });

  const customIds = ["beautify", "chat", "settings", "memory"];
  assert.deepEqual(
    model.normalizeLayout(
      {
        version: 1,
        order: ["chat", "missing", "chat", "", "settings"],
      },
      customIds,
    ),
    {
      version: 2,
      homeOrder: ["chat", "settings", "beautify", "memory"],
      dockOrder: [],
    },
  );

  assert.deepEqual(
    model.normalizeLayout(
      {
        version: 1,
        order: ["chat", "settings", "beautify", "self-profile"],
      },
      model.DEFAULT_APP_IDS,
    ),
    {
      version: 2,
      homeOrder: [
        "chat",
        "settings",
        "beautify",
        "guide",
        "world-books",
      ],
      dockOrder: ["self-profile"],
    },
  );

  assert.deepEqual(
    model.normalizeLayout(
      {
        version: 2,
        homeOrder: ["chat", "missing", "chat", "world-books"],
        dockOrder: ["settings", "settings", "self-profile"],
      },
      model.DEFAULT_APP_IDS,
    ),
    {
      version: 2,
      homeOrder: ["chat", "world-books", "beautify", "guide"],
      dockOrder: ["settings", "self-profile"],
    },
  );

  assert.deepEqual(
    model.normalizeLayout(
      {
        version: 2,
        homeOrder: [],
        dockOrder: [
          "self-profile",
          "settings",
          "world-books",
          "chat",
          "guide",
          "beautify",
        ],
      },
      model.DEFAULT_APP_IDS,
    ),
    {
      version: 2,
      homeOrder: ["guide", "beautify"],
      dockOrder: ["self-profile", "settings", "world-books", "chat"],
    },
  );

  assert.deepEqual(
    model.moveApp(
      model.normalizeLayout(null),
      "settings",
      "self-profile",
      false,
    ),
    {
      version: 2,
      homeOrder: ["beautify", "guide", "chat", "world-books"],
      dockOrder: ["settings", "self-profile"],
    },
  );

  assert.deepEqual(
    model.moveApp(
      model.normalizeLayout(null),
      "self-profile",
      "chat",
      true,
    ),
    {
      version: 2,
      homeOrder: [
        "beautify",
        "guide",
        "chat",
        "self-profile",
        "world-books",
        "settings",
      ],
      dockOrder: [],
    },
  );

  assert.deepEqual(
    model.moveApp(
      {
        version: 2,
        homeOrder: ["beautify", "guide", "chat", "world-books"],
        dockOrder: ["self-profile", "settings"],
      },
      "settings",
      "self-profile",
      true,
    ),
    {
      version: 2,
      homeOrder: ["beautify", "guide", "chat", "world-books"],
      dockOrder: ["self-profile", "settings"],
    },
  );

  assert.deepEqual(
    model.moveAppToContainer(
      {
        version: 2,
        homeOrder: ["beautify"],
        dockOrder: [
          "self-profile",
          "settings",
          "chat",
          "world-books",
          "guide",
        ],
      },
      "beautify",
      "dock",
    ),
    {
      version: 2,
      homeOrder: ["guide", "self-profile"],
      dockOrder: ["settings", "chat", "world-books", "beautify"],
    },
  );

  assert.deepEqual(
    model.moveAppByOffset(
      {
        version: 2,
        homeOrder: ["beautify", "guide", "chat", "world-books"],
        dockOrder: ["self-profile", "settings"],
      },
      "settings",
      -1,
    ),
    {
      version: 2,
      homeOrder: ["beautify", "guide", "chat", "world-books"],
      dockOrder: ["settings", "self-profile"],
    },
  );

  console.log("Home screen model tests passed.");
}

runTests();
