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
  const VERSION = 1;
  const DEFAULT_APP_IDS = Object.freeze([
    "beautify",
    "guide",
    "chat",
    "world-books",
    "settings",
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

  function normalizeLayout(value, appIds = DEFAULT_APP_IDS) {
    const knownIds = normalizeAppIds(appIds);
    const knownSet = new Set(knownIds);
    const source = value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
    const requestedOrder = Array.isArray(value)
      ? value
      : Array.isArray(source.order)
        ? source.order
        : [];
    const seen = new Set();
    const order = [];

    requestedOrder.forEach((value) => {
      const id = typeof value === "string" ? value.trim() : "";
      if (!knownSet.has(id) || seen.has(id)) return;
      seen.add(id);
      order.push(id);
    });

    knownIds.forEach((id) => {
      if (seen.has(id)) return;
      seen.add(id);
      order.push(id);
    });

    return {
      version: VERSION,
      order,
    };
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
    const sourceIndex = layout.order.indexOf(sourceId);
    const targetIndex = layout.order.indexOf(destinationId);

    if (
      sourceIndex < 0 ||
      targetIndex < 0 ||
      sourceId === destinationId
    ) {
      return layout;
    }

    layout.order.splice(sourceIndex, 1);
    const updatedTargetIndex = layout.order.indexOf(destinationId);
    const insertIndex = updatedTargetIndex + (placeAfter ? 1 : 0);
    layout.order.splice(insertIndex, 0, sourceId);
    return layout;
  }

  function moveAppByOffset(
    value,
    appId,
    offset,
    appIds = DEFAULT_APP_IDS,
  ) {
    const layout = normalizeLayout(value, appIds);
    const sourceId = typeof appId === "string" ? appId.trim() : "";
    const sourceIndex = layout.order.indexOf(sourceId);
    const numericOffset = Math.trunc(Number(offset));

    if (
      sourceIndex < 0 ||
      !Number.isFinite(numericOffset) ||
      numericOffset === 0
    ) {
      return layout;
    }

    const targetIndex = Math.min(
      layout.order.length - 1,
      Math.max(0, sourceIndex + numericOffset),
    );
    if (targetIndex === sourceIndex) return layout;

    layout.order.splice(sourceIndex, 1);
    layout.order.splice(targetIndex, 0, sourceId);
    return layout;
  }

  return Object.freeze({
    STORAGE_KEY,
    VERSION,
    DEFAULT_APP_IDS,
    normalizeAppIds,
    normalizeLayout,
    moveApp,
    moveAppByOffset,
  });
});
