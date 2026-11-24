"use strict";

const assert = require("node:assert/strict");
const model = require("../js/home-screen-model.js");

function withEmptySlots(values, count = model.HOME_SLOT_COUNT) {
  const slots = values.slice();
  while (slots.length < count) slots.push(null);
  return slots.slice(0, count);
}

function assertAllAppsOnce(layout, appIds = model.DEFAULT_APP_IDS) {
  assert.equal(layout.version, model.VERSION);
  assert.equal(layout.homeSlots.length, model.HOME_SLOT_COUNT);

  const placedIds = [
    ...layout.homeSlots.filter(Boolean),
    ...layout.dockOrder,
  ];
  assert.equal(
    new Set(placedIds).size,
    placedIds.length,
    "Every app must appear only once.",
  );
  assert.deepEqual(
    placedIds.slice().sort(),
    Array.from(new Set(appIds)).slice().sort(),
    "No app may disappear during layout normalization.",
  );
}

function runTests() {
  assert.equal(model.VERSION, 4);
  assert.equal(model.HOME_COLUMNS, 4);
  assert.equal(model.HOME_ROWS, 4);
  assert.equal(model.HOME_SLOT_COUNT, 16);
  assert.equal(model.HOME_SLOT_COUNT, model.HOME_COLUMNS * model.HOME_ROWS);
  assert.equal(model.HOME_MIN_SLOTS, 16);
  assert.equal(model.HOME_MAX_SLOTS, 16);
  assert.equal(model.DOCK_MAX_APPS, 4);

  const defaultLayout = model.normalizeLayout(null);
  assert.deepEqual(defaultLayout, {
    version: 4,
    homeSlots: withEmptySlots([
      "beautify",
      "guide",
      "chat",
      "sms",
      "world-books",
      "settings",
    ]),
    dockOrder: ["self-profile"],
  });
  assertAllAppsOnce(defaultLayout);

  const twelveSlotLayout = model.normalizeLayout({
    version: 3,
    homeSlots: [
      null,
      "guide",
      "chat",
      "world-books",
      "settings",
      null,
      null,
      null,
      "beautify",
      null,
      null,
      null,
    ],
    dockOrder: ["self-profile"],
  });
  assert.equal(
    twelveSlotLayout.homeSlots.length,
    model.HOME_SLOT_COUNT,
    "A saved 12-slot layout must expand to the fixed four-row grid.",
  );
  assert.equal(
    twelveSlotLayout.homeSlots[8],
    "beautify",
    "Apps that already fit inside the first 16 slots must keep their position.",
  );
  assertAllAppsOnce(twelveSlotLayout);

  const rowFiveAppIds = [
    ...model.DEFAULT_APP_IDS,
    "extra-app",
  ];
  const rowFiveLayout = model.normalizeLayout(
    {
      version: 3,
      homeSlots: withEmptySlots(
        [
          "beautify",
          "guide",
          "chat",
          "world-books",
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          "settings",
          "extra-app",
          null,
        ],
        20,
      ),
      dockOrder: ["self-profile"],
    },
    rowFiveAppIds,
  );
  assert.deepEqual(rowFiveLayout.homeSlots, withEmptySlots([
    "beautify",
    "guide",
    "chat",
    "world-books",
    "settings",
    "extra-app",
    "sms",
  ]));
  assert.deepEqual(rowFiveLayout.dockOrder, ["self-profile"]);
  assertAllAppsOnce(rowFiveLayout, rowFiveAppIds);

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
      version: 4,
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

  assert.deepEqual(
    model.moveAppToHomeSlot(defaultLayout, "beautify", 8),
    {
      version: 4,
      homeSlots: withEmptySlots([
        null,
        "guide",
        "chat",
        "sms",
        "world-books",
        "settings",
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
      version: 4,
      homeSlots: withEmptySlots([
        "chat",
        "guide",
        "beautify",
        "sms",
        "world-books",
        "settings",
      ]),
      dockOrder: ["self-profile"],
    },
  );

  assert.deepEqual(
    model.moveAppToDock(defaultLayout, "settings"),
    {
      version: 4,
      homeSlots: withEmptySlots([
        "beautify",
        "guide",
        "chat",
        "sms",
        "world-books",
      ]),
      dockOrder: ["self-profile", "settings"],
    },
  );

  assert.deepEqual(
    model.moveAppToHomeSlot(defaultLayout, "self-profile", 8),
    {
      version: 4,
      homeSlots: withEmptySlots([
        "beautify",
        "guide",
        "chat",
        "sms",
        "world-books",
        "settings",
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
      version: 4,
      homeSlots: withEmptySlots([
        "self-profile",
        "guide",
        "chat",
        "sms",
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
  assertAllAppsOnce(fullDockLayout);

  assert.deepEqual(
    model.normalizeLayout(
      {
        version: 1,
        order: ["chat", "settings", "beautify", "self-profile"],
      },
      model.DEFAULT_APP_IDS,
    ),
    {
      version: 4,
      homeSlots: withEmptySlots([
        "chat",
        "settings",
        "beautify",
        "guide",
        "sms",
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
      version: 4,
      homeSlots: withEmptySlots([
        "chat",
        "world-books",
        "beautify",
        "guide",
        "sms",
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
      version: 4,
      homeSlots: withEmptySlots([
        "chat",
        "beautify",
        "guide",
        "sms",
        "settings",
        "world-books",
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
      version: 4,
      homeSlots: withEmptySlots(["beautify", "guide", "sms"]),
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
      version: 4,
      homeSlots: withEmptySlots([
        "beautify",
        "chat",
        "guide",
        "sms",
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
