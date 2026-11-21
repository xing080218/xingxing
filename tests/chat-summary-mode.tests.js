"use strict";

const assert = require("node:assert/strict");
const { buildPrompt, normalizeReply } = require("../js/chat-summary-mode");

const singlePrompt = buildPrompt([{ content: "今天有点累。" }]);
assert.match(singlePrompt, /综合理解整段内容/);
assert.match(singlePrompt, /今天有点累。/);
assert.doesNotMatch(singlePrompt, /第\s*1\s*条\s*[：:]/u);
assert.doesNotMatch(singlePrompt, /逐条回答/u);

const multiplePrompt = buildPrompt([
  { content: "第一件事：今天适合散步吗？" },
  { content: "第二件事：晚饭吃什么好？" },
]);
const firstPosition = multiplePrompt.indexOf("第一件事：今天适合散步吗？");
const secondPosition = multiplePrompt.indexOf("第二件事：晚饭吃什么好？");

assert.ok(firstPosition >= 0);
assert.ok(secondPosition > firstPosition);
assert.match(multiplePrompt, /融进一条自然、连贯的回复/);
assert.doesNotMatch(multiplePrompt, /第\s*1\s*条\s*[：:]/u);
assert.doesNotMatch(multiplePrompt, /第\s*2\s*条\s*[：:]/u);
assert.doesNotMatch(multiplePrompt, /逐条回答/u);

assert.equal(
  normalizeReply("第1条：我先听见你有些累。\r\n\r\n第2条：今晚就慢一点。"),
  "我先听见你有些累。\n\n今晚就慢一点。",
);
assert.equal(normalizeReply("只有一行自然回复。"), "只有一行自然回复。");

console.log("Chat summary mode tests passed.");
