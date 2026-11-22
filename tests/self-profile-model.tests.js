"use strict";

const assert = require("node:assert/strict");
const model = require("../js/self-profile-model.js");

function runTests() {
  const validation = model.validateProfile({
    id: "self-profile-example",
    name: "  小星  ",
    persona: "  我是一名普通用户。\n正在学习写作。  ",
    createdAt: 100,
    updatedAt: 200,
  });
  assert.equal(validation.ok, true);
  assert.equal(validation.value.name, "小星");
  assert.equal(
    validation.value.persona,
    "我是一名普通用户。\n正在学习写作。",
  );
  assert.equal(validation.value.createdAt, 100);
  assert.equal(validation.value.updatedAt, 200);

  assert.equal(model.validateProfile({ name: "", persona: "" }).ok, false);
  assert.equal(
    model.validateProfile({
      name: "名".repeat(model.MAX_NAME_LENGTH + 1),
      persona: "设定",
    }).ok,
    false,
  );
  assert.equal(
    model.validateProfile({
      name: "名字",
      persona: "文".repeat(model.MAX_PERSONA_LENGTH + 1),
    }).ok,
    false,
  );

  const store = model.normalizeStore({
    profiles: [
      {
        id: "older",
        name: "旧资料",
        persona: "旧设定",
        createdAt: 1,
        updatedAt: 10,
      },
      {
        id: "newer",
        name: "新资料",
        persona: "新设定",
        createdAt: 1,
        updatedAt: 20,
      },
      {
        id: "newer",
        name: "重复编号",
        persona: "应被忽略",
        createdAt: 1,
        updatedAt: 30,
      },
      {
        id: "",
        name: "无编号",
        persona: "应被忽略",
      },
    ],
    activeProfileId: "missing",
  });
  assert.deepEqual(
    store.profiles.map((profile) => profile.id),
    ["newer", "older"],
  );
  assert.equal(store.activeProfileId, "newer");
  assert.equal(model.getActiveProfile(store).name, "新资料");

  const prompt = model.buildPrompt(store.profiles[0]);
  assert.match(prompt, /用户本人设定：/);
  assert.match(prompt, /名字：新资料/);
  assert.match(prompt, /人设：新设定/);
  assert.match(prompt, /角色不能代替用户说话/);
  assert.equal(model.buildPrompt({ name: "", persona: "" }), "");

  console.log("Self profile model tests passed.");
}

runTests();
