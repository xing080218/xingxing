"use strict";

const assert = require("node:assert/strict");
const model = require("../js/character-deletion-model.js");

const characterId = "character-delete-me";

const smsData = {
  version: 1,
  messages: [
    { id: "sms-1", characterId, content: "要删除" },
    { id: "sms-2", characterId: "character-keep", content: "要保留" },
  ],
  customField: { keep: true },
};
const nextSmsData = model.removeCharacterFromSmsData(smsData, characterId);
assert.notEqual(nextSmsData, smsData);
assert.deepEqual(
  nextSmsData.messages.map((record) => record.id),
  ["sms-2"],
);
assert.deepEqual(nextSmsData.customField, { keep: true });
assert.equal(smsData.messages.length, 2, "输入短信数据不能被修改。");
assert.equal(
  model.removeCharacterFromSmsData(smsData, "character-missing"),
  smsData,
  "没有匹配短信时应保留原对象。",
);
assert.equal(model.removeCharacterFromSmsData(null, characterId), null);
assert.deepEqual(
  model.removeCharacterFromSmsData(
    [{ characterId }, { characterId: "character-keep" }],
    characterId,
  ),
  [{ characterId: "character-keep" }],
);

const momentsData = {
  version: 3,
  moments: [
    {
      id: "moment-1",
      content: "保留正文",
      imageIds: ["photo-1"],
      createdAt: 1000,
      updatedAt: 2000,
      interactions: [
        {
          characterId,
          characterName: "要删除",
          liked: true,
          comment: "删除这条互动",
        },
        {
          characterId: "character-keep",
          characterName: "要保留",
          liked: true,
          comment: "保留这条互动",
        },
      ],
    },
    {
      id: "moment-2",
      content: "另一条朋友圈",
      interactions: [],
    },
  ],
};
const nextMomentsData = model.removeCharacterFromMomentData(
  momentsData,
  characterId,
);
assert.notEqual(nextMomentsData, momentsData);
assert.equal(nextMomentsData.moments[0].content, "保留正文");
assert.deepEqual(nextMomentsData.moments[0].imageIds, ["photo-1"]);
assert.equal(nextMomentsData.moments[0].createdAt, 1000);
assert.equal(nextMomentsData.moments[0].updatedAt, 2000);
assert.deepEqual(
  nextMomentsData.moments[0].interactions.map(
    (interaction) => interaction.characterId,
  ),
  ["character-keep"],
);
assert.equal(
  momentsData.moments[0].interactions.length,
  2,
  "输入朋友圈数据不能被修改。",
);
assert.equal(
  model.removeCharacterFromMomentData(
    momentsData,
    "character-missing",
  ),
  momentsData,
);
assert.equal(model.removeCharacterFromMomentData(null, characterId), null);
assert.deepEqual(model.removeCharacterFromMomentData({}, characterId), {});

const groupChats = [
  {
    id: "group-1",
    name: "测试群",
    announcement: "公告保留",
    memberCharacterIds: [
      "character-before",
      characterId,
      "character-after",
    ],
    createdAt: 1000,
    updatedAt: 2000,
  },
  {
    id: "group-2",
    name: "无关群",
    memberCharacterIds: ["character-keep"],
  },
];
const nextGroupChats = model.removeCharacterFromGroupChats(
  groupChats,
  characterId,
);
assert.notEqual(nextGroupChats, groupChats);
assert.deepEqual(nextGroupChats[0].memberCharacterIds, [
  "character-before",
  "character-after",
]);
assert.equal(nextGroupChats[0].announcement, "公告保留");
assert.equal(nextGroupChats[0].updatedAt, 2000);
assert.equal(
  nextGroupChats[1],
  groupChats[1],
  "无关群聊应保持原对象。",
);
assert.equal(groupChats[0].memberCharacterIds.length, 3);
assert.equal(
  model.removeCharacterFromGroupChats(
    groupChats,
    "character-missing",
  ),
  groupChats,
);
assert.equal(
  model.removeCharacterFromGroupChats(null, characterId),
  null,
);
assert.deepEqual(
  model.removeCharacterFromGroupChats([null, {}, { members: [] }], characterId),
  [null, {}, { members: [] }],
);

console.log("character deletion model tests passed");
