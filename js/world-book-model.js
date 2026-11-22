"use strict";

((root, factory) => {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.PocketLabWorldBookModel = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const UNCATEGORIZED_CATEGORY = "未分类";
  const MAX_NAME_LENGTH = 80;
  const MAX_CATEGORY_LENGTH = 40;
  const MAX_CONTENT_LENGTH = 12000;

  function normalizeStableId(value) {
    if (typeof value !== "string") return "";
    const normalized = value.trim();
    return normalized && normalized.length <= 200 ? normalized : "";
  }

  function normalizeCategory(value) {
    const category = typeof value === "string" ? value.trim() : "";
    return (category || UNCATEGORIZED_CATEGORY).slice(0, MAX_CATEGORY_LENGTH);
  }

  function normalizeWorldBook(value) {
    const source = value && typeof value === "object" ? value : {};
    const now = Date.now();
    return {
      id: normalizeStableId(source.id),
      name:
        typeof source.name === "string"
          ? source.name.trim().slice(0, MAX_NAME_LENGTH)
          : "",
      category: normalizeCategory(source.category),
      content:
        typeof source.content === "string"
          ? source.content.trim().slice(0, MAX_CONTENT_LENGTH)
          : "",
      createdAt: Number.isFinite(Number(source.createdAt))
        ? Number(source.createdAt)
        : now,
      updatedAt: Number.isFinite(Number(source.updatedAt))
        ? Number(source.updatedAt)
        : now,
    };
  }

  function validateWorldBook(value) {
    const source = value && typeof value === "object" ? value : {};
    const rawName = typeof source.name === "string" ? source.name.trim() : "";
    const rawCategory =
      typeof source.category === "string" ? source.category.trim() : "";
    const rawContent =
      typeof source.content === "string" ? source.content.trim() : "";
    const errors = {};

    if (!rawName) {
      errors.name = "请填写世界书名称。";
    } else if (rawName.length > MAX_NAME_LENGTH) {
      errors.name = `世界书名称不能超过 ${MAX_NAME_LENGTH} 个字符。`;
    }

    if (rawCategory.length > MAX_CATEGORY_LENGTH) {
      errors.category = `分类不能超过 ${MAX_CATEGORY_LENGTH} 个字符。`;
    }

    if (!rawContent) {
      errors.content = "请填写世界书内容。";
    } else if (rawContent.length > MAX_CONTENT_LENGTH) {
      errors.content = `世界书内容不能超过 ${MAX_CONTENT_LENGTH} 个字符。`;
    }

    return {
      ok: Object.keys(errors).length === 0,
      errors,
      value: normalizeWorldBook(source),
    };
  }

  function listCategories(records) {
    const categories = new Set();
    (Array.isArray(records) ? records : []).forEach((record) => {
      categories.add(normalizeCategory(record && record.category));
    });
    const uncategorized = categories.delete(UNCATEGORIZED_CATEGORY)
      ? [UNCATEGORIZED_CATEGORY]
      : [];
    return [...categories, ...uncategorized];
  }

  function sortWorldBooks(records) {
    const source = Array.isArray(records) ? records : [];
    const categoryOrder = new Map();

    source.forEach((record, index) => {
      const category = normalizeCategory(record && record.category);
      const createdAt = Number(record && record.createdAt);
      const existing = categoryOrder.get(category);
      if (!existing) {
        categoryOrder.set(category, {
          createdAt: Number.isFinite(createdAt)
            ? createdAt
            : Number.MAX_SAFE_INTEGER,
          index,
        });
        return;
      }
      if (Number.isFinite(createdAt) && createdAt < existing.createdAt) {
        existing.createdAt = createdAt;
      }
    });

    return source
      .map((record, index) => ({
        record,
        index,
        category: normalizeCategory(record && record.category),
        createdAt: Number.isFinite(Number(record && record.createdAt))
          ? Number(record.createdAt)
          : Number.MAX_SAFE_INTEGER,
      }))
      .sort((left, right) => {
        if (left.category === UNCATEGORIZED_CATEGORY) {
          if (right.category !== UNCATEGORIZED_CATEGORY) return 1;
        } else if (right.category === UNCATEGORIZED_CATEGORY) {
          return -1;
        }

        if (left.category !== right.category) {
          const leftCategory = categoryOrder.get(left.category);
          const rightCategory = categoryOrder.get(right.category);
          return (
            leftCategory.createdAt - rightCategory.createdAt ||
            leftCategory.index - rightCategory.index ||
            left.category.localeCompare(right.category, "zh-CN")
          );
        }

        return (
          left.createdAt - right.createdAt ||
          String(left.record && left.record.name).localeCompare(
            String(right.record && right.record.name),
            "zh-CN",
          ) ||
          left.index - right.index
        );
      })
      .map((entry) => entry.record);
  }

  return Object.freeze({
    UNCATEGORIZED_CATEGORY,
    MAX_NAME_LENGTH,
    MAX_CATEGORY_LENGTH,
    MAX_CONTENT_LENGTH,
    normalizeStableId,
    normalizeCategory,
    normalizeWorldBook,
    validateWorldBook,
    listCategories,
    sortWorldBooks,
  });
});
