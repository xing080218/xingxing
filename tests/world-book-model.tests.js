"use strict";

const assert = require("node:assert/strict");
const model = require("../js/world-book-model.js");

function runTests() {
  const normalized = model.normalizeWorldBook({
    id: "  world-book-example  ",
    name: "  星港档案  ",
    category: "   ",
    content: "  第一段。\n\n第二段。  ",
  });
  assert.equal(normalized.id, "world-book-example");
  assert.equal(normalized.name, "星港档案");
  assert.equal(normalized.category, model.UNCATEGORIZED_CATEGORY);
  assert.equal(normalized.content, "第一段。\n\n第二段。");

  const valid = model.validateWorldBook({
    name: "星港档案",
    category: "主线",
    content: "星港位于北境。",
  });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.errors, {});

  const missing = model.validateWorldBook({});
  assert.equal(missing.ok, false);
  assert.match(missing.errors.name, /名称/);
  assert.match(missing.errors.content, /内容/);

  const tooLong = model.validateWorldBook({
    name: "名".repeat(model.MAX_NAME_LENGTH + 1),
    category: "类".repeat(model.MAX_CATEGORY_LENGTH + 1),
    content: "文".repeat(model.MAX_CONTENT_LENGTH + 1),
  });
  assert.equal(tooLong.ok, false);
  assert.match(tooLong.errors.name, /80/);
  assert.match(tooLong.errors.category, /40/);
  assert.match(tooLong.errors.content, /12000/);

  assert.deepEqual(
    model.listCategories([
      { category: "支线" },
      { category: "主线" },
      { category: "" },
      { category: "主线" },
    ]),
    ["支线", "主线", model.UNCATEGORIZED_CATEGORY],
  );

  assert.deepEqual(
    model
      .sortWorldBooks([
        {
          id: "branch-later",
          name: "乙",
          category: "支线",
          createdAt: 20,
        },
        {
          id: "main",
          name: "主线记录",
          category: "主线",
          createdAt: 10,
        },
        {
          id: "uncategorized",
          name: "未分类记录",
          category: "",
          createdAt: 1,
        },
        {
          id: "branch-earlier",
          name: "甲",
          category: "支线",
          createdAt: 5,
        },
      ])
      .map((record) => record.id),
    ["branch-earlier", "branch-later", "main", "uncategorized"],
  );

  assert.deepEqual(
    model
      .sortWorldBooks([
        { id: "a", name: "乙", category: "同一分类", createdAt: 2 },
        { id: "b", name: "甲", category: "同一分类", createdAt: 2 },
      ])
      .map((record) => record.id),
    ["b", "a"],
  );

  console.log("World book model tests passed.");
}

runTests();
