"use strict";

const assert = require("node:assert/strict");
const model = require("../js/group-chat-model.js");

const normalized = model.normalizeGroupChat({
  id: "  group-chat-example  ",
  name: "  星港调查组  ",
  announcement: "  今晚八点集合。\r\n\r\n不要迟到。  ",
  backgroundSetting: "  废弃星港，终年有雾。  ",
  memberCharacterIds: ["  character-a  ", "character-b", "character-a", "", null],
  createdAt: 10,
  updatedAt: 20,
});
assert.equal(normalized.id, "group-chat-example");
assert.equal(normalized.name, "星港调查组");
assert.equal(normalized.announcement, "今晚八点集合。\n\n不要迟到。");
assert.equal(normalized.backgroundSetting, "废弃星港，终年有雾。");
assert.deepEqual(normalized.memberCharacterIds, [
  "character-a",
  "character-b",
]);
assert.equal(normalized.createdAt, 10);
assert.equal(normalized.updatedAt, 20);

const valid = model.validateGroupChat({
  name: "星港调查组",
  announcement: "今晚八点集合。",
  backgroundSetting: "废弃星港，终年有雾。",
});
assert.equal(valid.ok, true);
assert.deepEqual(valid.errors, {});

const optionalFields = model.validateGroupChat({ name: "只有名称" });
assert.equal(optionalFields.ok, true);
assert.equal(optionalFields.value.announcement, "");
assert.equal(optionalFields.value.backgroundSetting, "");
assert.deepEqual(optionalFields.value.memberCharacterIds, []);

assert.deepEqual(
  model.normalizeMemberCharacterIds([
    "character-b",
    " character-a ",
    "character-b",
    "",
    42,
    null,
  ]),
  ["character-b", "character-a"],
);

const invalidMembers = model.validateGroupChat({
  name: "星港调查组",
  memberCharacterIds: "character-a",
});
assert.equal(invalidMembers.ok, false);
assert.match(invalidMembers.errors.memberCharacterIds, /格式/);

const missingName = model.validateGroupChat({ announcement: "公告" });
assert.equal(missingName.ok, false);
assert.match(missingName.errors.name, /名称/);

const tooLong = model.validateGroupChat({
  name: "名".repeat(model.MAX_NAME_LENGTH + 1),
  announcement: "公".repeat(model.MAX_ANNOUNCEMENT_LENGTH + 1),
  backgroundSetting: "景".repeat(model.MAX_BACKGROUND_LENGTH + 1),
});
assert.equal(tooLong.ok, false);
assert.match(tooLong.errors.name, /40/);
assert.match(tooLong.errors.announcement, /4000/);
assert.match(tooLong.errors.backgroundSetting, /4000/);

assert.equal(
  model.getPreview({
    announcement: "第一行\n第二行",
    backgroundSetting: "备用背景",
  }),
  "第一行 第二行",
);
assert.equal(
  model.getPreview({ announcement: "", backgroundSetting: "雨夜校园" }),
  "雨夜校园",
);
assert.equal(model.getPreview({}), model.EMPTY_PREVIEW);
assert.equal(model.normalizePreview("一二三四五", 4), "一二三…");

assert.deepEqual(
  model
    .sortGroupChats([
      { id: "older", name: "旧群", updatedAt: 10 },
      { id: "newer", name: "新群", updatedAt: 30 },
      { id: "middle", name: "中间群", updatedAt: 20 },
    ])
    .map((record) => record.id),
  ["newer", "middle", "older"],
);

console.log("Group chat model tests passed.");
