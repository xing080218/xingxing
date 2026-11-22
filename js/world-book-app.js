"use strict";

(() => {
  const elements = {};
  const state = {
    initialized: false,
    records: [],
    usageByBookId: new Map(),
    query: "",
    category: "",
    loading: false,
    loadError: "",
    editingId: "",
    saving: false,
  };

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function cacheElements() {
    [
      "world-book-list",
      "world-book-search",
      "world-book-category-filter",
      "world-book-category-options",
      "world-book-status",
      "world-book-status-title",
      "world-book-status-message",
      "add-world-book",
      "world-book-modal",
      "world-book-modal-title",
      "close-world-book-modal",
      "world-book-form",
      "world-book-name",
      "world-book-category",
      "world-book-content",
      "world-book-name-error",
      "world-book-category-error",
      "world-book-content-error",
      "world-book-content-count",
      "cancel-world-book",
      "save-world-book",
      "save-world-book-label",
    ].forEach((id) => {
      elements[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    elements["add-world-book"].addEventListener("click", () => openEditor());
    elements["close-world-book-modal"].addEventListener("click", closeEditor);
    elements["cancel-world-book"].addEventListener("click", closeEditor);
    elements["world-book-modal"].addEventListener("click", (event) => {
      if (event.target === elements["world-book-modal"] && !state.saving) {
        closeEditor();
      }
    });
    elements["world-book-form"].addEventListener("submit", saveEditor);
    elements["world-book-search"].addEventListener("input", (event) => {
      state.query = event.target.value.trim();
      renderList();
    });
    elements["world-book-category-filter"].addEventListener("change", (event) => {
      state.category = event.target.value;
      renderList();
    });
    elements["world-book-name"].addEventListener("input", () => {
      clearFieldError("name");
    });
    elements["world-book-category"].addEventListener("input", () => {
      clearFieldError("category");
    });
    elements["world-book-content"].addEventListener("input", () => {
      clearFieldError("content");
      updateContentCount();
    });
    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        !elements["world-book-modal"].classList.contains("is-hidden") &&
        !state.saving
      ) {
        closeEditor();
      }
    });
  }

  function clearFieldError(fieldName) {
    const field = elements[`world-book-${fieldName}`];
    const error = elements[`world-book-${fieldName}-error`];
    if (field?.closest(".field")) field.closest(".field").classList.remove("has-error");
    if (error) error.textContent = "";
  }

  function showFieldError(fieldName, message) {
    const field = elements[`world-book-${fieldName}`];
    const error = elements[`world-book-${fieldName}-error`];
    if (field?.closest(".field")) field.closest(".field").classList.add("has-error");
    if (error) error.textContent = message || "";
  }

  function clearFieldErrors() {
    ["name", "category", "content"].forEach(clearFieldError);
  }

  function setStatus(kind, title, message) {
    const status = elements["world-book-status"];
    status.dataset.state = kind;
    elements["world-book-status-title"].textContent = title;
    elements["world-book-status-message"].textContent = message;
  }

  function updateContentCount() {
    const count = Array.from(elements["world-book-content"].value).length;
    elements["world-book-content-count"].textContent =
      `${count} / ${window.PocketLabWorldBookModel.MAX_CONTENT_LENGTH}`;
  }

  function renderCategoryOptions() {
    const categories = window.PocketLabWorldBookModel.listCategories(state.records);
    const datalist = elements["world-book-category-options"];
    const filter = elements["world-book-category-filter"];
    datalist.replaceChildren(
      ...categories.map((category) => {
        const option = document.createElement("option");
        option.value = category;
        return option;
      }),
    );

    const currentFilter = state.category;
    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = "全部分类";
    filter.replaceChildren(
      allOption,
      ...categories.map((category) => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        return option;
      }),
    );
    filter.value = categories.includes(currentFilter) ? currentFilter : "";
    state.category = filter.value;
  }

  function getFilteredRecords() {
    const query = state.query.toLocaleLowerCase("zh-CN");
    return state.records.filter((record) => {
      if (state.category && record.category !== state.category) return false;
      if (!query) return true;
      return [record.name, record.category, record.content].some((value) =>
        String(value || "").toLocaleLowerCase("zh-CN").includes(query),
      );
    });
  }

  function createStatePanel(title, message, actionLabel, action) {
    const panel = document.createElement("div");
    panel.className = "world-book-state";
    const heading = document.createElement("strong");
    heading.textContent = title;
    const copy = document.createElement("p");
    copy.textContent = message;
    panel.append(heading, copy);
    if (actionLabel && typeof action === "function") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary-button";
      button.textContent = actionLabel;
      button.addEventListener("click", action);
      panel.append(button);
    }
    return panel;
  }

  function createBookCard(record) {
    const card = document.createElement("article");
    card.className = "world-book-card";

    const top = document.createElement("div");
    top.className = "world-book-card-top";
    const category = document.createElement("span");
    category.className = "world-book-category";
    category.textContent = record.category;
    const actions = document.createElement("div");
    actions.className = "world-book-card-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "编辑";
    edit.addEventListener("click", () => openEditor(record.id));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "is-danger";
    remove.textContent = "删除";
    remove.addEventListener("click", () => deleteRecord(record.id));
    actions.append(edit, remove);
    top.append(category, actions);

    const title = document.createElement("h2");
    title.textContent = record.name;
    const summary = document.createElement("p");
    summary.className = "world-book-summary";
    const content = String(record.content || "");
    summary.textContent =
      content.length > 110 ? `${content.slice(0, 110)}...` : content;

    const details = document.createElement("details");
    details.className = "world-book-content";
    const detailsSummary = document.createElement("summary");
    detailsSummary.textContent = "查看完整内容";
    const fullContent = document.createElement("p");
    fullContent.textContent = content;
    details.append(detailsSummary, fullContent);

    const users = document.createElement("p");
    users.className = "world-book-users";
    const characterNames = state.usageByBookId.get(record.id) || [];
    users.textContent = characterNames.length
      ? `使用角色：${characterNames.join("、")}`
      : "暂未绑定角色";

    card.append(top, title, summary, details, users);
    return card;
  }

  function renderList() {
    const list = elements["world-book-list"];
    if (state.loading) {
      list.replaceChildren(
        createStatePanel("正在读取世界书", "请稍等，正在从本机 IndexedDB 读取。"),
      );
      return;
    }
    if (state.loadError) {
      list.replaceChildren(
        createStatePanel(
          "世界书读取失败",
          `${state.loadError} 请确认浏览器允许站点保存数据，然后重试。`,
          "重新读取",
          () => refresh(),
        ),
      );
      return;
    }
    if (!state.records.length) {
      list.replaceChildren(
        createStatePanel(
          "还没有世界书",
          "点右上角的加号，为角色创建一份可独立管理的世界设定。",
          "添加第一本世界书",
          () => openEditor(),
        ),
      );
      return;
    }

    const filtered = getFilteredRecords();
    if (!filtered.length) {
      list.replaceChildren(
        createStatePanel(
          "没有匹配的世界书",
          "换一个关键词或分类试试，也可以清空筛选条件。",
          "清空筛选",
          () => {
            state.query = "";
            state.category = "";
            elements["world-book-search"].value = "";
            elements["world-book-category-filter"].value = "";
            renderList();
          },
        ),
      );
      return;
    }

    list.replaceChildren(...filtered.map(createBookCard));
  }

  function renderCounts() {
    const boundCount = state.records.filter((record) =>
      (state.usageByBookId.get(record.id) || []).length,
    ).length;
    setStatus(
      "idle",
      `${state.records.length} 本世界书`,
      boundCount
        ? `其中 ${boundCount} 本已绑定角色。每个角色只会读取自己绑定的那一本。`
        : "世界书独立保存；在角色编辑里选择后才会进入该角色的对话。",
    );
  }

  async function refresh(options = {}) {
    if (!state.initialized) return;
    state.loading = !options.silent;
    state.loadError = "";
    if (!options.silent) renderList();

    try {
      const records = await window.PocketLabStorage.listWorldBooks();
      const usageEntries = await Promise.all(
        records.map(async (record) => {
          const characters =
            await window.PocketLabStorage.listCharactersUsingWorldBook(record.id);
          return [
            record.id,
            characters.map((character) => character.name || "未命名角色"),
          ];
        }),
      );
      state.records = records;
      state.usageByBookId = new Map(usageEntries);
      renderCategoryOptions();
      renderCounts();
    } catch (error) {
      state.loadError =
        error && error.message ? error.message : "无法读取本机世界书数据。";
      setStatus("error", "世界书读取失败", `${state.loadError} 请重试。`);
    } finally {
      state.loading = false;
      renderList();
    }
  }

  function openEditor(recordId = "") {
    const record = state.records.find((item) => item.id === recordId);
    state.editingId = record ? record.id : "";
    elements["world-book-modal-title"].textContent = record
      ? "编辑世界书"
      : "添加世界书";
    elements["save-world-book-label"].textContent = record
      ? "保存世界书"
      : "创建世界书";
    elements["world-book-name"].value = record ? record.name : "";
    elements["world-book-category"].value = record ? record.category : "";
    elements["world-book-content"].value = record ? record.content : "";
    clearFieldErrors();
    updateContentCount();
    elements["world-book-modal"].classList.remove("is-hidden");
    window.setTimeout(() => elements["world-book-name"].focus(), 60);
  }

  function closeEditor() {
    if (state.saving) return;
    state.editingId = "";
    elements["world-book-modal"].classList.add("is-hidden");
    elements["add-world-book"].focus();
  }

  async function saveEditor(event) {
    event.preventDefault();
    if (state.saving) return;
    clearFieldErrors();

    const existing = state.records.find((record) => record.id === state.editingId);
    const source = {
      id: existing?.id || `world-book-${createId()}`,
      name: elements["world-book-name"].value,
      category: elements["world-book-category"].value,
      content: elements["world-book-content"].value,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    const validation = window.PocketLabWorldBookModel.validateWorldBook(source);
    if (!validation.ok) {
      Object.entries(validation.errors).forEach(([fieldName, message]) => {
        showFieldError(fieldName, message);
      });
      const firstInvalid = ["name", "category", "content"].find(
        (fieldName) => validation.errors[fieldName],
      );
      if (firstInvalid) elements[`world-book-${firstInvalid}`].focus();
      return;
    }

    state.saving = true;
    elements["save-world-book"].disabled = true;
    elements["save-world-book"].setAttribute("aria-busy", "true");
    try {
      const saved = await window.PocketLabStorage.saveWorldBook({
        ...validation.value,
        id: source.id,
        createdAt: source.createdAt,
      });
      state.saving = false;
      closeEditor();
      await refresh({ silent: true });
      setStatus(
        "success",
        existing ? "世界书已更新" : "世界书已创建",
        `“${saved.name}”已保存在本机，可在角色编辑中选择。`,
      );
      dispatchChanged();
    } catch (error) {
      setStatus(
        "error",
        "世界书保存失败",
        `${error?.message || "无法写入本机数据库。"} 请检查浏览器存储权限和剩余空间后重试。`,
      );
      showFieldError(
        "content",
        error?.message || "世界书没有保存成功，请重试。",
      );
    } finally {
      state.saving = false;
      elements["save-world-book"].disabled = false;
      elements["save-world-book"].removeAttribute("aria-busy");
    }
  }

  async function deleteRecord(recordId) {
    const record = state.records.find((item) => item.id === recordId);
    if (!record) return;
    const users = state.usageByBookId.get(record.id) || [];
    const warning = users.length
      ? `“${record.name}”正在被 ${users.join("、")} 使用，需先解除绑定。仍要尝试删除吗？`
      : `确定删除“${record.name}”吗？删除后无法恢复。`;
    if (!window.confirm(warning)) return;

    try {
      await window.PocketLabStorage.deleteWorldBook(record.id);
      await refresh({ silent: true });
      setStatus(
        "success",
        "世界书已删除",
        `“${record.name}”已从本机删除。`,
      );
      dispatchChanged();
    } catch (error) {
      setStatus(
        "error",
        "世界书删除失败",
        `${error?.message || "无法删除世界书。"} 请先到人物列表检查角色绑定，然后重试。`,
      );
    }
  }

  function dispatchChanged() {
    window.dispatchEvent(
      new CustomEvent("pocketlab:world-books-changed", {
        detail: { worldBooks: [...state.records] },
      }),
    );
  }

  async function init() {
    if (state.initialized) {
      await refresh();
      return;
    }
    cacheElements();
    bindEvents();
    state.initialized = true;
    await refresh();
  }

  window.PocketLabWorldBookApp = Object.freeze({
    init,
    refresh,
  });
})();
