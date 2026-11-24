"use strict";

((root, factory) => {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.PocketLabHomeScreenModel = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const STORAGE_KEY = "home-screen.layout.v1";
  const VERSION = 4;
  const HOME_COLUMNS = 4;
  const HOME_ROWS = 4;
  const HOME_SLOT_COUNT = HOME_COLUMNS * HOME_ROWS;
  const HOME_MIN_SLOTS = HOME_SLOT_COUNT;
  const HOME_MAX_SLOTS = HOME_SLOT_COUNT;
  const LEGACY_SLOT_LIMIT = 64;
  const DOCK_MAX_APPS = 4;
  const DEFAULT_HOME_ORDER = Object.freeze([
    "beautify",
    "guide",
    "chat",
    "sms",
    "world-books",
    "settings",
  ]);
  const DEFAULT_DOCK_ORDER = Object.freeze(["self-profile"]);
  const DEFAULT_APP_IDS = Object.freeze([
    ...DEFAULT_HOME_ORDER,
    ...DEFAULT_DOCK_ORDER,
  ]);

  function normalizeAppIds(appIds) {
    const source = Array.isArray(appIds) && appIds.length
      ? appIds
      : DEFAULT_APP_IDS;
    const seen = new Set();
    const normalized = [];

    source.forEach((value) => {
      const id = typeof value === "string" ? value.trim() : "";
      if (!id || seen.has(id)) return;
      seen.add(id);
      normalized.push(id);
    });

    return normalized;
  }

  function filterKnownIds(values, knownSet, seen) {
    const normalized = [];
    const source = Array.isArray(values) ? values : [];

    source.forEach((value) => {
      const id = typeof value === "string" ? value.trim() : "";
      if (!knownSet.has(id) || seen.has(id)) return;
      seen.add(id);
      normalized.push(id);
    });

    return normalized;
  }

  function findFirstEmptySlot(slots) {
    return slots.findIndex((value) => value === null);
  }

  function placeInFirstEmptySlot(slots, appId) {
    const index = findFirstEmptySlot(slots);
    if (index >= 0) {
      slots[index] = appId;
      return;
    }
    slots.push(appId);
  }

  function normalizeSlotCount(slots) {
    const normalized = slots.slice(0, HOME_SLOT_COUNT);
    while (normalized.length < HOME_SLOT_COUNT) normalized.push(null);
    return normalized;
  }

  function normalizeLayout(value, appIds = DEFAULT_APP_IDS) {
    const knownIds = normalizeAppIds(appIds);
    const knownSet = new Set(knownIds);
    const source = value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
    const usesSlotLayout =
      Array.isArray(source.homeSlots) || Number(source.version) >= 3;
    const usesContainerLayout =
      usesSlotLayout ||
      Array.isArray(source.homeOrder) ||
      Array.isArray(source.dockOrder) ||
      Number(source.version) >= 2;
    const legacyOrder = Array.isArray(value)
      ? value
      : Array.isArray(source.order)
        ? source.order
        : [];
    const requestedHomeOrder = usesSlotLayout
      ? []
      : usesContainerLayout
        ? source.homeOrder
        : legacyOrder.filter((value) => {
            const id = typeof value === "string" ? value.trim() : "";
            return !DEFAULT_DOCK_ORDER.includes(id);
          });
    const requestedDockOrder = usesContainerLayout
      ? source.dockOrder
      : DEFAULT_DOCK_ORDER;
    const seen = new Set();
    let homeSlots = [];

    if (usesSlotLayout) {
      const sourceSlots = Array.isArray(source.homeSlots)
        ? source.homeSlots.slice(0, LEGACY_SLOT_LIMIT)
        : [];
      homeSlots = sourceSlots.slice(0, HOME_SLOT_COUNT).map((value) => {
        const id = typeof value === "string" ? value.trim() : "";
        if (!knownSet.has(id) || seen.has(id)) return null;
        seen.add(id);
        return id;
      });
      sourceSlots.slice(HOME_SLOT_COUNT).forEach((value) => {
        const id = typeof value === "string" ? value.trim() : "";
        if (!knownSet.has(id) || seen.has(id)) return;
        seen.add(id);
        placeInFirstEmptySlot(homeSlots, id);
      });
    } else {
      filterKnownIds(requestedHomeOrder, knownSet, seen).forEach((id) => {
        homeSlots.push(id);
      });
    }

    const requestedDock = filterKnownIds(
      requestedDockOrder,
      knownSet,
      seen,
    );
    const dockOrder = requestedDock.slice(0, DOCK_MAX_APPS);

    requestedDock
      .slice(DOCK_MAX_APPS)
      .forEach((id) => placeInFirstEmptySlot(homeSlots, id));

    // Apps added by later versions default to the first free home-screen slot.
    knownIds.forEach((id) => {
      if (seen.has(id)) return;
      seen.add(id);
      placeInFirstEmptySlot(homeSlots, id);
    });

    return {
      version: VERSION,
      homeSlots: normalizeSlotCount(homeSlots),
      dockOrder,
    };
  }

  function findContainer(layout, appId) {
    if (layout.homeSlots.includes(appId)) return "homeSlots";
    if (layout.dockOrder.includes(appId)) return "dockOrder";
    return "";
  }

  function moveAppToHomeSlot(
    value,
    appId,
    slotIndex,
    appIds = DEFAULT_APP_IDS,
  ) {
    const layout = normalizeLayout(value, appIds);
    const sourceId = typeof appId === "string" ? appId.trim() : "";
    const targetIndex = Math.trunc(Number(slotIndex));
    const sourceContainer = findContainer(layout, sourceId);

    if (
      !sourceContainer ||
      !Number.isFinite(targetIndex) ||
      targetIndex < 0 ||
      targetIndex >= HOME_MAX_SLOTS
    ) {
      return layout;
    }

    while (layout.homeSlots.length <= targetIndex) {
      layout.homeSlots.push(null);
    }

    if (sourceContainer === "homeSlots") {
      const sourceIndex = layout.homeSlots.indexOf(sourceId);
      if (sourceIndex === targetIndex) return layout;
      const displacedId = layout.homeSlots[targetIndex];
      layout.homeSlots[targetIndex] = sourceId;
      layout.homeSlots[sourceIndex] = displacedId || null;
      return normalizeLayout(layout, appIds);
    }

    const dockIndex = layout.dockOrder.indexOf(sourceId);
    const displacedId = layout.homeSlots[targetIndex];
    layout.dockOrder.splice(dockIndex, 1);
    layout.homeSlots[targetIndex] = sourceId;
    if (displacedId) {
      layout.dockOrder.splice(
        Math.min(dockIndex, layout.dockOrder.length),
        0,
        displacedId,
      );
    }
    return normalizeLayout(layout, appIds);
  }

  function moveAppToDock(
    value,
    appId,
    targetIndex = -1,
    appIds = DEFAULT_APP_IDS,
  ) {
    const layout = normalizeLayout(value, appIds);
    const sourceId = typeof appId === "string" ? appId.trim() : "";
    const sourceContainer = findContainer(layout, sourceId);
    const numericTarget = Math.trunc(Number(targetIndex));

    if (!sourceContainer) return layout;

    if (sourceContainer === "homeSlots") {
      if (layout.dockOrder.length >= DOCK_MAX_APPS) return layout;
      layout.homeSlots[layout.homeSlots.indexOf(sourceId)] = null;
    } else if (
      !Number.isFinite(numericTarget) ||
      numericTarget < 0
    ) {
      return layout;
    } else {
      layout.dockOrder.splice(layout.dockOrder.indexOf(sourceId), 1);
    }

    const insertIndex = Number.isFinite(numericTarget) && numericTarget >= 0
      ? Math.min(numericTarget, layout.dockOrder.length)
      : layout.dockOrder.length;
    layout.dockOrder.splice(insertIndex, 0, sourceId);
    return normalizeLayout(layout, appIds);
  }

  function moveHomeAppByOffset(
    value,
    appId,
    offset,
    appIds = DEFAULT_APP_IDS,
  ) {
    const layout = normalizeLayout(value, appIds);
    const sourceId = typeof appId === "string" ? appId.trim() : "";
    const sourceIndex = layout.homeSlots.indexOf(sourceId);
    const numericOffset = Math.trunc(Number(offset));

    if (
      sourceIndex < 0 ||
      !Number.isFinite(numericOffset) ||
      numericOffset === 0
    ) {
      return layout;
    }

    const targetIndex = Math.min(
      layout.homeSlots.length - 1,
      Math.max(0, sourceIndex + numericOffset),
    );
    return moveAppToHomeSlot(layout, sourceId, targetIndex, appIds);
  }

  function moveDockAppByOffset(
    value,
    appId,
    offset,
    appIds = DEFAULT_APP_IDS,
  ) {
    const layout = normalizeLayout(value, appIds);
    const sourceId = typeof appId === "string" ? appId.trim() : "";
    const sourceIndex = layout.dockOrder.indexOf(sourceId);
    const numericOffset = Math.trunc(Number(offset));

    if (
      sourceIndex < 0 ||
      !Number.isFinite(numericOffset) ||
      numericOffset === 0
    ) {
      return layout;
    }

    const targetIndex = Math.min(
      layout.dockOrder.length - 1,
      Math.max(0, sourceIndex + numericOffset),
    );
    if (targetIndex === sourceIndex) return layout;
    layout.dockOrder.splice(sourceIndex, 1);
    layout.dockOrder.splice(targetIndex, 0, sourceId);
    return normalizeLayout(layout, appIds);
  }

  return Object.freeze({
    STORAGE_KEY,
    VERSION,
    HOME_COLUMNS,
    HOME_ROWS,
    HOME_SLOT_COUNT,
    HOME_MIN_SLOTS,
    HOME_MAX_SLOTS,
    DOCK_MAX_APPS,
    DEFAULT_HOME_ORDER,
    DEFAULT_DOCK_ORDER,
    DEFAULT_APP_IDS,
    normalizeAppIds,
    normalizeLayout,
    findContainer,
    moveAppToHomeSlot,
    moveAppToDock,
    moveHomeAppByOffset,
    moveDockAppByOffset,
  });
});
