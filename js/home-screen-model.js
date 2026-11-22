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
  const VERSION = 2;
  const DOCK_MAX_APPS = 4;
  const DEFAULT_HOME_ORDER = Object.freeze([
    "beautify",
    "guide",
    "chat",
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

  function normalizeLayout(value, appIds = DEFAULT_APP_IDS) {
    const knownIds = normalizeAppIds(appIds);
    const knownSet = new Set(knownIds);
    const source = value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
    const usesContainerLayout =
      Array.isArray(source.homeOrder) ||
      Array.isArray(source.dockOrder) ||
      Number(source.version) >= 2;
    const rawHomeOrder = usesContainerLayout
      ? source.homeOrder
      : Array.isArray(value)
        ? value
        : source.order;
    const requestedHomeOrder = usesContainerLayout
      ? rawHomeOrder
      : (Array.isArray(rawHomeOrder) ? rawHomeOrder : []).filter((value) => {
          const id = typeof value === "string" ? value.trim() : "";
          return !DEFAULT_DOCK_ORDER.includes(id);
        });
    const requestedDockOrder = usesContainerLayout
      ? source.dockOrder
      : DEFAULT_DOCK_ORDER;
    const seen = new Set();
    const homeOrder = filterKnownIds(requestedHomeOrder, knownSet, seen);
    const dockOrder = filterKnownIds(requestedDockOrder, knownSet, seen);

    // Apps added by later versions default to the main screen, not the Dock.
    knownIds.forEach((id) => {
      if (seen.has(id)) return;
      seen.add(id);
      homeOrder.push(id);
    });

    if (dockOrder.length > DOCK_MAX_APPS) {
      homeOrder.push(...dockOrder.splice(DOCK_MAX_APPS));
    }

    return {
      version: VERSION,
      homeOrder,
      dockOrder,
    };
  }

  function findContainer(layout, appId) {
    if (layout.homeOrder.includes(appId)) return "homeOrder";
    if (layout.dockOrder.includes(appId)) return "dockOrder";
    return "";
  }

  function moveApp(
    value,
    appId,
    targetId,
    placeAfter = false,
    appIds = DEFAULT_APP_IDS,
  ) {
    const layout = normalizeLayout(value, appIds);
    const sourceId = typeof appId === "string" ? appId.trim() : "";
    const destinationId =
      typeof targetId === "string" ? targetId.trim() : "";
    const sourceContainer = findContainer(layout, sourceId);
    const targetContainer = findContainer(layout, destinationId);

    if (
      !sourceContainer ||
      !targetContainer ||
      sourceId === destinationId
    ) {
      return layout;
    }

    layout[sourceContainer].splice(
      layout[sourceContainer].indexOf(sourceId),
      1,
    );

    const updatedTargetIndex = layout[targetContainer].indexOf(destinationId);
    const insertIndex = updatedTargetIndex + (placeAfter ? 1 : 0);
    layout[targetContainer].splice(insertIndex, 0, sourceId);

    if (layout.dockOrder.length > DOCK_MAX_APPS) {
      layout.homeOrder.push(...layout.dockOrder.splice(DOCK_MAX_APPS));
    }

    return normalizeLayout(layout, appIds);
  }

  function moveAppToContainer(
    value,
    appId,
    container,
    appIds = DEFAULT_APP_IDS,
  ) {
    const layout = normalizeLayout(value, appIds);
    const sourceId = typeof appId === "string" ? appId.trim() : "";
    const sourceContainer = findContainer(layout, sourceId);
    const targetContainer = container === "dock"
      ? "dockOrder"
      : container === "home"
        ? "homeOrder"
        : "";

    if (
      !sourceContainer ||
      !targetContainer ||
      sourceContainer === targetContainer
    ) {
      return layout;
    }

    layout[sourceContainer].splice(
      layout[sourceContainer].indexOf(sourceId),
      1,
    );

    if (targetContainer === "dockOrder" &&
        layout.dockOrder.length >= DOCK_MAX_APPS) {
      layout.homeOrder.push(layout.dockOrder.shift());
    }

    layout[targetContainer].push(sourceId);
    return normalizeLayout(layout, appIds);
  }

  function moveAppByOffset(
    value,
    appId,
    offset,
    appIds = DEFAULT_APP_IDS,
  ) {
    const layout = normalizeLayout(value, appIds);
    const sourceId = typeof appId === "string" ? appId.trim() : "";
    const container = findContainer(layout, sourceId);
    const order = container ? layout[container] : [];
    const sourceIndex = order.indexOf(sourceId);
    const numericOffset = Math.trunc(Number(offset));

    if (
      sourceIndex < 0 ||
      !Number.isFinite(numericOffset) ||
      numericOffset === 0
    ) {
      return layout;
    }

    const targetIndex = Math.min(
      order.length - 1,
      Math.max(0, sourceIndex + numericOffset),
    );
    if (targetIndex === sourceIndex) return layout;

    order.splice(sourceIndex, 1);
    order.splice(targetIndex, 0, sourceId);
    return layout;
  }

  return Object.freeze({
    STORAGE_KEY,
    VERSION,
    DOCK_MAX_APPS,
    DEFAULT_HOME_ORDER,
    DEFAULT_DOCK_ORDER,
    DEFAULT_APP_IDS,
    normalizeAppIds,
    normalizeLayout,
    moveApp,
    moveAppToContainer,
    moveAppByOffset,
  });
});
