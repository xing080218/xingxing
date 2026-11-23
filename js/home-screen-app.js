"use strict";

((root) => {
  const model = root.PocketLabHomeScreenModel;
  const store = root.PocketLabHomeScreenStore;
  const LONG_PRESS_MS = 560;
  const MOVE_CANCEL_PX = 10;
  const DRAG_START_PX = 4;
  const DROP_CONTAINER_MARGIN_PX = 24;
  const CLICK_GUARD_MS = 900;

  const state = {
    initialized: false,
    editing: false,
    saving: false,
    dirty: false,
    layout: null,
    press: null,
    drag: null,
    suppressClickUntil: 0,
    onError: () => {},
    homeView: null,
    grid: null,
    dock: null,
    containers: [],
    sectionLabel: null,
    dateLabel: null,
    doneButton: null,
    editStatus: null,
  };

  async function init(options = {}) {
    if (state.initialized) return;
    if (!model || !store) {
      throw new Error("主屏幕编辑模块没有完成加载。");
    }

    state.onError =
      typeof options.onError === "function" ? options.onError : () => {};
    cacheElements();
    if (
      !state.homeView ||
      !state.grid ||
      !state.dock ||
      !state.doneButton
    ) {
      return;
    }

    bindEvents();
    state.initialized = true;

    try {
      state.layout = await store.load(getAppIds());
      applyLayout(state.layout);
    } catch (error) {
      state.layout = model.normalizeLayout(null, getAppIds());
      applyLayout(state.layout);
      state.onError(error, "读取主屏幕布局", "home-screen");
    }
  }

  async function refresh(options = {}) {
    if (!state.initialized || state.editing || state.saving) return;
    try {
      state.layout = await store.load(getAppIds());
      state.dirty = false;
      applyLayout(state.layout);
    } catch (error) {
      if (!options.silent) {
        state.onError(error, "读取主屏幕布局", "home-screen");
      }
    }
  }

  function cacheElements() {
    state.homeView = document.getElementById("home-view");
    state.grid = document.getElementById("home-app-grid");
    state.dock = document.getElementById("home-app-dock");
    state.containers = [state.grid, state.dock].filter(Boolean);
    state.sectionLabel = document.getElementById("home-section-label");
    state.dateLabel = document.getElementById("home-date");
    state.doneButton = document.getElementById("home-edit-done");
    state.editStatus = document.getElementById("home-screen-edit-status");
  }

  function bindEvents() {
    state.containers.forEach((container) => {
      container.addEventListener("pointerdown", handlePointerDown);
      container.addEventListener("click", handleClickCapture, true);
      container.addEventListener("contextmenu", handleContextMenu);
      container.addEventListener("keydown", handleTileKeyDown);
    });
    state.doneButton.addEventListener("click", handleDone);
    document.addEventListener("pointermove", handlePointerMove, {
      passive: false,
    });
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);
    document.addEventListener("keydown", handleGlobalKeyDown);
    root.addEventListener("blur", cancelInteractions);
  }

  function getTiles(container = null) {
    const targets = container ? [container] : state.containers;
    return targets.flatMap((target) =>
      Array.from(target.querySelectorAll("[data-home-app-id]")),
    );
  }

  function getAppIds() {
    const ids = getTiles()
      .map((tile) => String(tile.dataset.homeAppId || "").trim())
      .filter(Boolean);
    return ids.length ? ids : model.DEFAULT_APP_IDS;
  }

  function getContainerForTile(tile) {
    if (!tile) return null;
    return state.containers.find((container) => container.contains(tile)) || null;
  }

  function getManagedTile(target) {
    const tile =
      target instanceof Element
        ? target.closest("[data-home-app-id]")
        : null;
    return tile && getContainerForTile(tile) ? tile : null;
  }

  function applyLayout(layout) {
    const tiles = getTiles();
    const tileById = new Map(
      tiles.map((tile) => [tile.dataset.homeAppId, tile]),
    );
    const normalized = model.normalizeLayout(
      layout,
      Array.from(tileById.keys()),
    );

    normalized.homeOrder.forEach((id) => {
      const tile = tileById.get(id);
      if (tile) state.grid.append(tile);
    });
    normalized.dockOrder.forEach((id) => {
      const tile = tileById.get(id);
      if (tile) state.dock.append(tile);
    });

    state.layout = normalized;
    updateAccessibility();
  }

  function updateAccessibility() {
    const homeTiles = getTiles(state.grid);
    const dockTiles = getTiles(state.dock);
    state.grid.setAttribute(
      "aria-label",
      `主屏幕应用，共 ${homeTiles.length} 个。长按图标可编辑排列。`,
    );
    state.dock.setAttribute(
      "aria-label",
      `主屏幕底部应用栏，共 ${dockTiles.length} 个。长按图标可编辑或移出。`,
    );

    [
      [homeTiles, "home"],
      [dockTiles, "dock"],
    ].forEach(([tiles, containerName]) => {
      tiles.forEach((tile, index) => {
        tile.dataset.homeAppPosition = String(index + 1);
        tile.dataset.homeAppContainer = containerName;
      });
    });
  }

  function handlePointerDown(event) {
    if (
      (event.pointerType === "mouse" && event.button !== 0) ||
      state.drag
    ) {
      return;
    }

    const tile = getManagedTile(event.target);
    if (!tile) return;

    clearPress();
    const press = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      tile,
      activated: state.editing,
      dragging: false,
      timer: null,
    };
    state.press = press;
    tile.setPointerCapture?.(event.pointerId);

    if (state.editing) {
      guardClick();
      return;
    }

    press.timer = root.setTimeout(() => {
      activateLongPress(event.pointerId);
    }, LONG_PRESS_MS);
  }

  function activateLongPress(pointerId) {
    const press = state.press;
    if (!press || press.pointerId !== pointerId || press.dragging) return;
    press.timer = null;
    press.activated = true;
    guardClick();
    enterEditMode({ focusTile: press.tile });
  }

  function handlePointerMove(event) {
    const drag = state.drag;
    if (drag) {
      if (drag.pointerId !== event.pointerId) return;
      if (event.cancelable) event.preventDefault();
      updateDrag(event.clientX, event.clientY);
      return;
    }

    const press = state.press;
    if (!press || press.pointerId !== event.pointerId) return;
    const distance = Math.hypot(
      event.clientX - press.startX,
      event.clientY - press.startY,
    );

    if (!press.activated) {
      if (distance > MOVE_CANCEL_PX) clearPress();
      return;
    }

    if (distance < DRAG_START_PX) return;
    if (event.cancelable) event.preventDefault();
    beginDrag(press);
    updateDrag(event.clientX, event.clientY);
  }

  function handlePointerUp(event) {
    const press = state.press;
    if (press && press.pointerId === event.pointerId) {
      if (press.timer) root.clearTimeout(press.timer);
      press.timer = null;
      if (press.activated) guardClick();
      releasePointer(press.tile, event.pointerId);
      state.press = null;
    }

    const drag = state.drag;
    if (drag && drag.pointerId === event.pointerId) {
      finishDrag();
    }
  }

  function handlePointerCancel(event) {
    const press = state.press;
    if (press && press.pointerId === event.pointerId) {
      clearPress();
    }

    const drag = state.drag;
    if (drag && drag.pointerId === event.pointerId) {
      finishDrag();
    }
  }

  function beginDrag(press) {
    if (state.drag || !press.activated) return;
    const rect = press.tile.getBoundingClientRect();
    const ghost = press.tile.cloneNode(true);
    ghost.removeAttribute("id");
    ghost.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    ghost.classList.remove("is-drag-source");
    ghost.classList.add("home-app-drag-ghost");
    ghost.setAttribute("aria-hidden", "true");
    ghost.tabIndex = -1;
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    document.body.append(ghost);

    press.tile.classList.add("is-drag-source");
    press.dragging = true;
    state.drag = {
      pointerId: press.pointerId,
      tile: press.tile,
      ghost,
      offsetX: press.startX - rect.left,
      offsetY: press.startY - rect.top,
      originLeft: rect.left,
      originTop: rect.top,
    };
    guardClick();
  }

  function updateDrag(clientX, clientY) {
    const drag = state.drag;
    if (!drag) return;

    drag.ghost.style.transform = [
      `translate3d(${clientX - drag.offsetX - drag.originLeft}px,`,
      `${clientY - drag.offsetY - drag.originTop}px,`,
      "0) scale(1.035)",
    ].join(" ");

    const container = getDropContainerAtPoint(clientX, clientY);
    const currentContainer = getContainerForTile(drag.tile);
    if (
      container === state.dock &&
      currentContainer !== state.dock &&
      getTiles(state.dock).length >= model.DOCK_MAX_APPS
    ) {
      setDropTarget(null);
      return;
    }

    setDropTarget(container);
    if (!container) return;

    const target = findClosestTile(
      clientX,
      clientY,
      drag.tile,
      getTiles(container),
    );
    if (!target) {
      if (container.lastElementChild !== drag.tile) {
        container.append(drag.tile);
      }
      return;
    }

    const rect = target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const placeAfter = container === state.dock
      ? clientX > centerX
      : Math.abs(clientY - centerY) > rect.height * 0.28
        ? clientY > centerY
        : clientX > centerX;

    if (placeAfter) {
      if (target.nextElementSibling !== drag.tile) {
        target.insertAdjacentElement("afterend", drag.tile);
      }
    } else if (target.previousElementSibling !== drag.tile) {
      target.insertAdjacentElement("beforebegin", drag.tile);
    }
  }

  function getDropContainerAtPoint(clientX, clientY) {
    const exactMatch = state.containers.find((container) => {
      const rect = container.getBoundingClientRect();
      return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      );
    });
    if (exactMatch) return exactMatch;

    let closestContainer = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    state.containers.forEach((container) => {
      const rect = container.getBoundingClientRect();
      const distanceX =
        clientX < rect.left
          ? rect.left - clientX
          : clientX > rect.right
            ? clientX - rect.right
            : 0;
      const distanceY =
        clientY < rect.top
          ? rect.top - clientY
          : clientY > rect.bottom
            ? clientY - rect.bottom
            : 0;
      const distance = Math.hypot(distanceX, distanceY);
      if (distance >= closestDistance) return;
      closestDistance = distance;
      closestContainer = container;
    });

    return closestDistance <= DROP_CONTAINER_MARGIN_PX
      ? closestContainer
      : null;
  }

  function setDropTarget(container) {
    state.containers.forEach((candidate) => {
      candidate.classList.toggle("is-drop-target", candidate === container);
    });
  }

  function clearDropTarget() {
    state.containers.forEach((container) => {
      container.classList.remove("is-drop-target");
    });
  }

  function findClosestTile(clientX, clientY, excludedTile, tiles) {
    let closest = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    tiles.forEach((tile) => {
      if (tile === excludedTile) return;
      const rect = tile.getBoundingClientRect();
      const horizontalDistance =
        clientX < rect.left
          ? rect.left - clientX
          : clientX > rect.right
            ? clientX - rect.right
            : 0;
      const verticalDistance =
        clientY < rect.top
          ? rect.top - clientY
          : clientY > rect.bottom
            ? clientY - rect.bottom
            : 0;
      const distance =
        horizontalDistance * horizontalDistance +
        verticalDistance * verticalDistance;

      if (distance >= closestDistance) return;
      closestDistance = distance;
      closest = tile;
    });

    return closest;
  }

  function finishDrag() {
    const drag = state.drag;
    if (!drag) return;
    drag.ghost.remove();
    drag.tile.classList.remove("is-drag-source");
    state.drag = null;
    if (state.press) state.press.dragging = false;
    clearDropTarget();

    const nextLayout = layoutFromDom();
    state.dirty = true;
    applyLayout(nextLayout);
    announce("应用位置已更新。完成后保存。");
  }

  function handleClickCapture(event) {
    const target = getManagedTile(event.target);
    if (!target) return;
    if (!state.editing && performance.now() >= state.suppressClickUntil) return;

    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function handleContextMenu(event) {
    const tile = getManagedTile(event.target);
    if (!tile) return;

    event.preventDefault();
    clearPress();
    guardClick();
    enterEditMode({ focusTile: tile });
  }

  function handleTileKeyDown(event) {
    const tile = getManagedTile(event.target);
    if (!tile) return;

    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      guardClick();
      enterEditMode({ focusTile: tile });
      return;
    }

    if (!state.editing || !event.altKey) return;
    const container = getContainerForTile(tile);
    if (!container) return;
    const columns = container === state.grid
      ? getGridColumnCount()
      : Math.max(1, getTiles(state.dock).length);
    const offsets = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -columns,
      ArrowDown: columns,
    };
    const offset = offsets[event.key];
    if (!Number.isFinite(offset)) return;

    event.preventDefault();
    const appId = tile.dataset.homeAppId;
    const next = model.moveAppByOffset(
      state.layout,
      appId,
      offset,
      getAppIds(),
    );
    state.dirty = true;
    applyLayout(next);
    tile.focus({ preventScroll: true });
    announce(
      container === state.dock
        ? "底部应用顺序已调整。"
        : "主屏幕图标位置已调整。",
    );
  }

  function getGridColumnCount() {
    const columns = getComputedStyle(state.grid).gridTemplateColumns;
    return Math.max(1, columns.split(/\s+/).filter(Boolean).length);
  }

  async function handleDone() {
    if (!state.editing || state.saving) return;
    state.saving = true;
    state.doneButton.disabled = true;
    state.doneButton.setAttribute("aria-busy", "true");

    if (state.dirty) {
      try {
        state.layout = await store.save(layoutFromDom(), getAppIds());
        state.dirty = false;
      } catch (error) {
        state.onError(error, "保存主屏幕布局", "home-screen");
        state.saving = false;
        state.doneButton.disabled = false;
        state.doneButton.removeAttribute("aria-busy");
        return;
      }
    }

    state.saving = false;
    state.doneButton.disabled = false;
    state.doneButton.removeAttribute("aria-busy");
    exitEditMode();
    announce("主屏幕编辑已完成。");
  }

  function layoutFromDom() {
    return model.normalizeLayout(
      {
        homeOrder: getTiles(state.grid).map(
          (tile) => tile.dataset.homeAppId,
        ),
        dockOrder: getTiles(state.dock).map(
          (tile) => tile.dataset.homeAppId,
        ),
      },
      getAppIds(),
    );
  }

  function enterEditMode(options = {}) {
    if (!state.initialized || state.editing) {
      if (options.focusTile) options.focusTile.focus({ preventScroll: true });
      return;
    }

    state.editing = true;
    state.homeView.classList.add("is-editing");
    state.containers.forEach((container) => {
      container.classList.add("is-editing");
    });
    if (state.sectionLabel) state.sectionLabel.textContent = "编辑主屏幕";
    if (state.dateLabel) state.dateLabel.hidden = true;
    state.doneButton.hidden = false;
    if (options.focusTile) {
      options.focusTile.focus({ preventScroll: true });
    }
    announce("主屏幕编辑模式已开启。可将应用拖入或拖出底部应用栏。");
  }

  function exitEditMode() {
    if (!state.editing) return;
    state.editing = false;
    clearPress();
    state.homeView.classList.remove("is-editing");
    state.containers.forEach((container) => {
      container.classList.remove("is-editing");
    });
    clearDropTarget();
    if (state.sectionLabel) state.sectionLabel.textContent = "常用功能";
    if (state.dateLabel) state.dateLabel.hidden = false;
    state.doneButton.hidden = true;
    state.doneButton.disabled = false;
    state.doneButton.removeAttribute("aria-busy");
  }

  function handleGlobalKeyDown(event) {
    if (!state.editing || event.key !== "Escape" || state.saving) return;
    event.preventDefault();
    void handleDone();
  }

  function guardClick() {
    state.suppressClickUntil = performance.now() + CLICK_GUARD_MS;
  }

  function clearPress() {
    const press = state.press;
    if (!press) return;
    if (press.timer) root.clearTimeout(press.timer);
    releasePointer(press.tile, press.pointerId);
    state.press = null;
  }

  function releasePointer(tile, pointerId) {
    if (!tile?.hasPointerCapture?.(pointerId)) return;
    tile.releasePointerCapture(pointerId);
  }

  function cancelInteractions() {
    clearPress();
    if (state.drag) finishDrag();
  }

  function announce(message) {
    if (!state.editStatus) return;
    state.editStatus.textContent = "";
    root.setTimeout(() => {
      state.editStatus.textContent = message;
    }, 20);
  }

  root.PocketLabHomeScreenApp = Object.freeze({
    init,
    refresh,
    exitEditMode,
    isEditing: () => state.editing,
  });
})(window);
