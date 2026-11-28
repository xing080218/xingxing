"use strict";

const assert = require("node:assert/strict");
const { buildPrompt, normalizeReply, splitMessages } = require("../js/chat-summary-mode");

const singlePrompt = buildPrompt([{ content: "今天有点累。" }]);
assert.match(singlePrompt, /综合理解整段内容/);
assert.match(singlePrompt, /今天有点累。/);
assert.match(singlePrompt, /只输出角色要发来的消息。/);
assert.match(
  singlePrompt,
  /只回应下方本轮内容；历史消息只用于理解关系和已知事实，不要复述、续写或重发上一条角色回复。/,
);
assert.match(singlePrompt, /每条消息单独一行/);
assert.match(singlePrompt, /句号、问号、感叹号等句末标点后换行/);
assert.match(singlePrompt, /不要输出动作、神态、旁白、心理描写/);
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
assert.doesNotMatch(multiplePrompt, /融进一条自然、连贯的回复/);
assert.doesNotMatch(multiplePrompt, /第\s*1\s*条\s*[：:]/u);
assert.doesNotMatch(multiplePrompt, /第\s*2\s*条\s*[：:]/u);
assert.doesNotMatch(multiplePrompt, /逐条回答/u);

assert.equal(
  normalizeReply("第1条：我先听见你有些累。\r\n\r\n第2条：今晚就慢一点。"),
  "我先听见你有些累。\n今晚就慢一点。",
);
assert.equal(normalizeReply("只有一行自然回复。"), "只有一行自然回复。");
assert.equal(
  normalizeReply("今天辛苦了。要不要歇一会儿？晚饭想吃什么？"),
  "今天辛苦了。\n要不要歇一会儿？\n晚饭想吃什么？",
);
assert.equal(
  normalizeReply("“真的吗？”她笑着问。然后她停了一下！"),
  "“真的吗？”\n她笑着问。\n然后她停了一下！",
);
assert.equal(normalizeReply("版本 1.2.3 可用。"), "版本 1.2.3 可用。");
assert.deepEqual(splitMessages("第一句。\n\n- 第二句？\n第三句！"), [
  "第一句。",
  "第二句？",
  "第三句！",
]);
assert.deepEqual(splitMessages("只有一句没有标点"), ["只有一句没有标点"]);

console.log("Chat summary mode tests passed.");
