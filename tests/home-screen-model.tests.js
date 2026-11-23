"use strict";

const assert = require("node:assert/strict");
const model = require("../js/home-screen-model.js");

function withEmptySlots(values, minimum = model.HOME_MIN_SLOTS) {
  const slots = values.slice();
  while (slots.length < minimum) slots.push(null);
  return slots;
}

function runTests() {
  assert.equal(model.VERSION, 3);
  assert.equal(model.HOME_COLUMNS, 4);
  assert.equal(model.HOME_MIN_SLOTS, 12);
  assert.equal(model.HOME_MAX_SLOTS, 64);
  assert.equal(model.DOCK_MAX_APPS, 4);

  assert.deepEqual(model.normalizeLayout(null), {
    version: 3,
    homeSlots: withEmptySlots([
      "beautify",
      "guide",
      "chat",
      "world-books",
      "settings",
    ]),
    dockOrder: ["self-profile"],
  });

  const sparseIds = ["chat", "settings", "beautify", "self-profile"];
  assert.deepEqual(
    model.normalizeLayout(
      {
        version: 3,
        homeSlots: [
          null,
          "chat",
          null,
          "settings",
          null,
          null,
          null,
          null,
          "beautify",
        ],
        dockOrder: ["self-profile"],
      },
      sparseIds,
    ),
    {
      version: 3,
      homeSlots: withEmptySlots([
        null,
        "chat",
        null,
        "settings",
        null,
        null,
        null,
        null,
        "beautify",
      ]),
      dockOrder: ["self-profile"],
    },
  );

  const defaultLayout = model.normalizeLayout(null);
  assert.deepEqual(
    model.moveAppToHomeSlot(defaultLayout, "beautify", 8),
    {
      version: 3,
      homeSlots: withEmptySlots([
        null,
        "guide",
        "chat",
        "world-books",
        "settings",
        null,
        null,
        null,
        "beautify",
      ]),
      dockOrder: ["self-profile"],
    },
  );

  assert.deepEqual(
    model.moveAppToHomeSlot(defaultLayout, "beautify", 2),
    {
      version: 3,
      homeSlots: withEmptySlots([
        "chat",
        "guide",
        "beautify",
        "world-books",
        "settings",
      ]),
      dockOrder: ["self-profile"],
    },
  );

  assert.deepEqual(
    model.moveAppToDock(defaultLayout, "settings"),
    {
      version: 3,
      homeSlots: withEmptySlots([
        "beautify",
        "guide",
        "chat",
        "world-books",
      ]),
      dockOrder: ["self-profile", "settings"],
    },
  );

  assert.deepEqual(
    model.moveAppToHomeSlot(defaultLayout, "self-profile", 8),
    {
      version: 3,
      homeSlots: withEmptySlots([
        "beautify",
        "guide",
        "chat",
        "world-books",
        "settings",
        null,
        null,
        null,
        "self-profile",
      ]),
      dockOrder: [],
    },
  );

  assert.deepEqual(
    model.moveAppToHomeSlot(defaultLayout, "self-profile", 0),
    {
      version: 3,
      homeSlots: withEmptySlots([
        "self-profile",
        "guide",
        "chat",
        "world-books",
        "settings",
      ]),
      dockOrder: ["beautify"],
    },
  );

  const fullDockLayout = model.normalizeLayout({
    version: 3,
    homeSlots: withEmptySlots(["beautify", "guide"]),
    dockOrder: ["self-profile", "settings", "chat", "world-books"],
  });
  assert.deepEqual(
    model.moveAppToDock(fullDockLayout, "beautify"),
    fullDockLayout,
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
      version: 3,
      homeSlots: withEmptySlots([
        "chat",
        "settings",
        "beautify",
        "guide",
        "world-books",
      ]),
      dockOrder: ["self-profile"],
    },
  );

  assert.deepEqual(
    model.normalizeLayout(
      {
        version: 2,
        homeOrder: ["chat", "world-books"],
        dockOrder: ["self-profile", "settings"],
      },
      model.DEFAULT_APP_IDS,
    ),
    {
      version: 3,
      homeSlots: withEmptySlots([
        "chat",
        "world-books",
        "beautify",
        "guide",
      ]),
      dockOrder: ["self-profile", "settings"],
    },
  );

  assert.deepEqual(
    model.normalizeLayout(
      {
        version: 3,
        homeSlots: ["chat", "missing", "chat", null, "settings"],
        dockOrder: ["self-profile", "self-profile", "unknown"],
      },
      model.DEFAULT_APP_IDS,
    ),
    {
      version: 3,
      homeSlots: withEmptySlots([
        "chat",
        "beautify",
        "guide",
        "world-books",
        "settings",
      ]),
      dockOrder: ["self-profile"],
    },
  );

  assert.deepEqual(
    model.normalizeLayout(
      {
        version: 3,
        homeSlots: withEmptySlots(["beautify"]),
        dockOrder: [
          "self-profile",
          "settings",
          "chat",
          "world-books",
          "guide",
        ],
      },
      model.DEFAULT_APP_IDS,
    ),
    {
      version: 3,
      homeSlots: withEmptySlots(["beautify", "guide"]),
      dockOrder: ["self-profile", "settings", "chat", "world-books"],
    },
  );

  assert.equal(model.findContainer(defaultLayout, "chat"), "homeSlots");
  assert.equal(
    model.findContainer(defaultLayout, "self-profile"),
    "dockOrder",
  );

  assert.deepEqual(
    model.moveHomeAppByOffset(defaultLayout, "chat", -1),
    {
      version: 3,
      homeSlots: withEmptySlots([
        "beautify",
        "chat",
        "guide",
        "world-books",
        "settings",
      ]),
      dockOrder: ["self-profile"],
    },
  );

  const twoDockApps = model.normalizeLayout({
    version: 3,
    homeSlots: withEmptySlots(["beautify"]),
    dockOrder: ["self-profile", "settings"],
  });
  assert.deepEqual(
    model.moveDockAppByOffset(twoDockApps, "settings", -1),
    {
      ...twoDockApps,
      dockOrder: ["settings", "self-profile"],
    },
  );

  console.log("Home screen model tests passed.");
}

runTests();
