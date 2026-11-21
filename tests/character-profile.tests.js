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
    maxConsecutiveMessages: 7,
  });
  assert.equal(character.id, "character-example");
  assert.equal(character.name, "测试角色");
  assert.equal(character.persona, "测试人设");
  assert.equal(character.avatarId, "image-avatar");
  assert.equal(character.chatBackgroundImageId, "image-background");
  assert.equal(character.maxConsecutiveMessages, 7);

  const fallbackCharacter = profile.normalizeCharacter({}, {
    defaultId: profile.PRIMARY_CHARACTER_ID,
  });
  assert.equal(fallbackCharacter.id, profile.PRIMARY_CHARACTER_ID);
  assert.equal(fallbackCharacter.name, profile.defaultCharacter.name);
  assert.equal(fallbackCharacter.maxConsecutiveMessages, 3);

  assert.equal(profile.normalizeMessageCharacterId(""), profile.PRIMARY_CHARACTER_ID);
  assert.equal(
    profile.normalizeMessageCharacterId("character-other"),
    "character-other",
  );

  assert.deepEqual(
    profile.limitReplyLines(["一。", "二。", "三。", "四。"], 2),
    ["一。", "二。 三。 四。"],
  );
  assert.deepEqual(profile.limitReplyLines(["一。", "", "  "], 3), ["一。"]);
  assert.deepEqual(profile.limitReplyLines([], 3), []);

  console.log("Character profile tests passed.");
}

runTests();
