"use strict";

const assert = require("node:assert/strict");
const {
  EMPTY_PREVIEW,
  buildCharacterRows,
  formatListTime,
  getLatestMessage,
  normalizePreview,
} = require("../js/chat-list-model");

const now = new Date(2026, 10, 23, 15, 30, 0);
const at = (year, month, day, hour, minute, second = 0) =>
  new Date(year, month - 1, day, hour, minute, second).getTime();

assert.equal(
  normalizePreview("  第一行\n\n第二行\t第三行  "),
  "第一行 第二行 第三行",
);
assert.equal(normalizePreview("   \n\t  "), EMPTY_PREVIEW);
assert.equal(normalizePreview("一二三四五", 4), "一二三…");
assert.equal(normalizePreview("😀😀😀😀", 3), "😀😀…");

const messages = [
  { role: "assistant", content: "较早的消息", createdAt: 10 },
  {
    role: "assistant",
    content: "已经撤回的消息",
    createdAt: 30,
    retracted: true,
  },
  { role: "user", content: "最新消息\n仍在待回复", createdAt: 20 },
];
assert.equal(getLatestMessage(messages).content, "最新消息\n仍在待回复");
assert.equal(
  getLatestMessage([{ role: "assistant", content: " ", createdAt: 1 }]),
  null,
);

assert.equal(formatListTime(at(2026, 11, 23, 15, 29, 15), now), "刚刚");
assert.equal(formatListTime(at(2026, 11, 23, 15, 2), now), "28分钟前");
assert.equal(formatListTime(at(2026, 11, 23, 9, 5), now), "09:05");
assert.equal(formatListTime(at(2026, 11, 22, 9, 5), now), "昨天");
assert.equal(formatListTime(at(2026, 11, 20, 9, 5), now), "周五");
assert.equal(formatListTime(at(2026, 10, 3, 9, 5), now), "10月3日");
assert.equal(formatListTime(at(2025, 10, 3, 9, 5), now), "2025年10月3日");
assert.equal(formatListTime(0, now), "");

const rows = buildCharacterRows(
  [
    {
      character: { id: "no-message", name: "无消息" },
      messages: [],
    },
    {
      character: { id: "older", name: "较早角色" },
      messages: [
        { role: "assistant", content: "旧消息", createdAt: at(2026, 11, 22, 8, 0) },
      ],
    },
    {
      character: { id: "newer", name: "最新角色" },
      messages: [
        { role: "user", content: "上一条", createdAt: at(2026, 11, 23, 8, 0) },
        {
          role: "assistant",
          content: "最新一条\n消息",
          createdAt: at(2026, 11, 23, 9, 0),
        },
      ],
    },
    {
      character: { id: "also-empty", name: "另一个无消息" },
      messages: [{ role: "assistant", content: "撤回", retracted: true }],
    },
  ],
  now,
);

assert.deepEqual(
  rows.map((row) => row.character.id),
  ["newer", "older", "no-message", "also-empty"],
);
assert.equal(rows[0].preview, "最新一条 消息");
assert.equal(rows[2].preview, EMPTY_PREVIEW);
assert.equal(rows[2].timeLabel, "");

console.log("Chat list model tests passed.");
