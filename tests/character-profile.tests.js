"use strict";

const assert = require("node:assert/strict");
const profile = require("../js/character-profile.js");

function runTests() {
  assert.equal(profile.normalizeMaxConsecutiveMessages("4"), 4);
  assert.equal(profile.normalizeMaxConsecutiveMessages(0), 1);
  assert.equal(profile.normalizeMaxConsecutiveMessages(99), 10);
  assert.equal(profile.normalizeMaxConsecutiveMessages("not-a-number"), 3);

  const character = profile.normalizeCharacter({
    id: "character-example",
    name: "  测试角色  ",
    persona: "  测试人设  ",
    avatarId: "image-avatar",
    chatBackgroundImageId: "image-background",
    worldBookId: "world-book-example",
    selfProfileId: "self-profile-example",
    maxConsecutiveMessages: 7,
    isBlocked: true,
  });
  assert.equal(character.id, "character-example");
  assert.equal(character.name, "测试角色");
  assert.equal(character.persona, "测试人设");
  assert.equal(character.avatarId, "image-avatar");
  assert.equal(character.chatBackgroundImageId, "image-background");
  assert.equal(character.worldBookId, "world-book-example");
  assert.equal(character.selfProfileId, "self-profile-example");
  assert.equal(character.maxConsecutiveMessages, 7);
  assert.equal(character.isBlocked, true);
  assert.equal("userProfile" in character, false);

  const fallbackCharacter = profile.normalizeCharacter({}, {
    defaultId: profile.PRIMARY_CHARACTER_ID,
  });
  assert.equal(fallbackCharacter.id, profile.PRIMARY_CHARACTER_ID);
  assert.equal(fallbackCharacter.name, profile.defaultCharacter.name);
  assert.equal(fallbackCharacter.maxConsecutiveMessages, 3);
  assert.equal(fallbackCharacter.worldBookId, "");
  assert.equal(fallbackCharacter.selfProfileId, "");
  assert.equal(fallbackCharacter.isBlocked, false);
  assert.equal(profile.defaultCharacter.isBlocked, false);
  assert.equal(profile.normalizeCharacter({ isBlocked: "true" }).isBlocked, false);
  assert.equal(
    profile.normalizeCharacter({
      selfProfileId: "x".repeat(201),
      userProfile: { name: "不应被保存", persona: "不应被复制" },
    }).selfProfileId,
    "",
  );

  assert.equal(profile.normalizeMessageCharacterId(""), profile.PRIMARY_CHARACTER_ID);
  assert.equal(
    profile.normalizeMessageCharacterId("character-other"),
    "character-other",
  );

  assert.deepEqual(
    profile.limitReplyLines(["一。", "二。", "三。", "四。"], 2),
    ["一。 二。", "三。 四。"],
  );
  assert.deepEqual(
    profile.limitReplyLines(["一。", "二。", "三。", "四。", "五。", "六。"], 3),
    ["一。 二。", "三。 四。", "五。 六。"],
  );

  const unevenLines = [
    "我先听见你有些累。",
    "今天先把手头最着急的事收个尾。",
    "剩下的明天再处理也来得及。",
    "回去路上慢一点。",
    "到家以后先喝点温水。",
  ];
  const unevenResult = profile.limitReplyLines(unevenLines, 3);
  assert.deepEqual(unevenResult, [
    "我先听见你有些累。 今天先把手头最着急的事收个尾。",
    "剩下的明天再处理也来得及。 回去路上慢一点。",
    "到家以后先喝点温水。",
  ]);
  assert.equal(unevenResult.join(" "), unevenLines.join(" "));
  assert.deepEqual(
    profile.limitReplyLines(
      Array.from({ length: 8 }, (_value, index) => `第${index + 1}句。`),
      3,
    ),
    ["第1句。 第2句。 第3句。", "第4句。 第5句。 第6句。", "第7句。 第8句。"],
  );

  const singleLongLine = [
    "这是一整句没有句末标点但内容足够长的角色回复，不能为了凑数量而从中间硬切开。",
  ];
  assert.deepEqual(profile.limitReplyLines(singleLongLine, 3), singleLongLine);
  assert.deepEqual(
    profile.limitReplyLines(["第一句。", "第二句！", "第三句？"], 1),
    ["第一句。 第二句！ 第三句？"],
  );
  const tenLineResult = profile.limitReplyLines(
    Array.from({ length: 16 }, (_value, index) => `第${index + 1}句。`),
    99,
  );
  assert.equal(tenLineResult.length, 10);
  assert.equal(
    tenLineResult.join(" "),
    Array.from({ length: 16 }, (_value, index) => `第${index + 1}句。`).join(
      " ",
    ),
  );
  const groupSizes = tenLineResult.map((line) => line.split(" ").length);
  assert.equal(Math.max(...groupSizes) - Math.min(...groupSizes), 1);

  for (let limit = 1; limit <= 10; limit += 1) {
    const lines = Array.from({ length: 16 }, (_value, index) => `第${index + 1}句。`);
    const result = profile.limitReplyLines(lines, limit);
    const sizes = result.map((line) => line.split(" ").length);

    assert.equal(result.length, Math.min(limit, lines.length));
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
    assert.equal(result.join(" "), lines.join(" "));
  }

  assert.deepEqual(profile.limitReplyLines(["一。", "", "  "], 3), ["一。"]);
  assert.deepEqual(profile.limitReplyLines([], 3), []);

  console.log("Character profile tests passed.");
}

runTests();
