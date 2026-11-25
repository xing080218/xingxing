"use strict";

const assert = require("node:assert/strict");
const model = require("../js/moments-model.js");

function runTests() {
  assert.equal(
    model.validateContent(" \n\t ").ok,
    false,
    "Whitespace-only Moments must be rejected.",
  );
  assert.equal(
    model.validateContent("a".repeat(model.MAX_CONTENT_LENGTH)).ok,
    true,
  );
  assert.equal(
    model.validateContent("a".repeat(model.MAX_CONTENT_LENGTH + 1)).ok,
    false,
  );
  assert.equal(
    model.validateContent("😀".repeat(model.MAX_CONTENT_LENGTH)).ok,
    true,
    "The limit must count Unicode characters instead of UTF-16 units.",
  );

  const nineImageIds = Array.from(
    { length: model.MAX_IMAGE_COUNT },
    (_, index) => `photo-${index + 1}`,
  );
  const twelveImageIds = Array.from(
    { length: model.MAX_IMAGE_COUNT + 3 },
    (_, index) => `photo-${index + 1}`,
  );
  assert.deepEqual(
    model.normalizeImageResourceIds(twelveImageIds),
    twelveImageIds,
    "Loading photos across multiple Moments must not apply the per-Moment photo limit.",
  );
  assert.deepEqual(
    model.normalizeImageIds(twelveImageIds),
    nineImageIds,
    "Each individual Moment must still keep at most nine photo IDs.",
  );
  const photoOnlyValidation = model.validateMoment("", nineImageIds);
  assert.equal(
    photoOnlyValidation.ok,
    true,
    "A Moment with photos and no text must be valid.",
  );
  assert.equal(photoOnlyValidation.content, "");
  assert.equal(photoOnlyValidation.imageIds.length, model.MAX_IMAGE_COUNT);
  assert.equal(
    model.validateMoment("", [...nineImageIds, "photo-10"]).ok,
    false,
    "A Moment with more than nine photos must be rejected.",
  );
  assert.deepEqual(
    model.validateMoment("", ["photo-a", "photo-a", "photo-b"]).imageIds,
    ["photo-a", "photo-b"],
    "Duplicate photo IDs must be removed in stable order.",
  );
  assert.equal(
    model.validateMoment("有文字也有照片", ["photo-a"]).ok,
    true,
    "A Moment with text and photos must remain valid.",
  );

  const first = model.createMoment("第一条朋友圈", {
    id: "moment-1",
    now: 1000,
  });
  const second = model.createMoment("第二条朋友圈", {
    id: "moment-2",
    now: 2000,
  });
  let data = model.addMoment({ moments: [] }, first);
  data = model.addMoment(data, second);
  assert.deepEqual(
    data.moments.map((moment) => moment.id),
    ["moment-2", "moment-1"],
    "New Moments must be shown first.",
  );

  const photoOnlyMoment = model.createMoment("", {
    id: "moment-photo-only",
    imageIds: ["photo-only-a", "photo-only-b"],
    now: 2500,
  });
  assert.equal(photoOnlyMoment.content, "");
  assert.deepEqual(photoOnlyMoment.imageIds, [
    "photo-only-a",
    "photo-only-b",
  ]);
  const mixedMoment = model.createMoment("混合动态", {
    id: "moment-mixed",
    imageIds: ["photo-mixed"],
    now: 2600,
  });
  assert.equal(mixedMoment.content, "混合动态");
  assert.deepEqual(mixedMoment.imageIds, ["photo-mixed"]);

  const unsafeText = "<script>alert('xss')</script>\n第二行";
  assert.equal(
    model.createMoment(unsafeText, {
      id: "moment-safe",
      now: 3000,
    }).content,
    unsafeText,
    "The model must preserve user text for safe textContent rendering.",
  );

  const normalized = model.normalizeMomentData({
    moments: [
      { id: "one", content: "旧", createdAt: 10, updatedAt: 10 },
      { id: "one", content: "重复", createdAt: 20, updatedAt: 20 },
      { id: "", content: "没有编号", createdAt: 30, updatedAt: 30 },
      {
        id: "two",
        content: "新",
        imageIds: ["photo-two", "photo-two"],
        createdAt: 40,
        updatedAt: 40,
      },
      {
        id: "photo-only",
        content: "",
        imageIds: ["photo-only"],
        createdAt: 50,
        updatedAt: 50,
      },
    ],
  });
  assert.deepEqual(
    normalized.moments.map((moment) => moment.id),
    ["photo-only", "two", "one"],
  );
  assert.equal(normalized.version, model.VERSION);
  assert.deepEqual(
    normalized.moments.find((moment) => moment.id === "two").imageIds,
    ["photo-two"],
    "Stored photo IDs must be normalized and deduplicated.",
  );
  assert.deepEqual(
    normalized.moments.find((moment) => moment.id === "one").imageIds,
    [],
    "Legacy text Moments must receive an empty photo list.",
  );
  assert.deepEqual(
    normalized.moments.find((moment) => moment.id === "one").interactions,
    [],
    "Legacy Moments must receive an empty interaction list.",
  );

  let interactionData = model.addMoment(
    { moments: [] },
    model.createMoment("用来测试角色互动", {
      id: "moment-interactions",
      now: 100,
    }),
  );
  const pendingInteraction = model.createInteraction(
    {
      characterId: "character-one",
      characterName: "角色一",
    },
    { now: 110 },
  );
  interactionData = model.addInteractions(
    interactionData,
    "moment-interactions",
    [
      pendingInteraction,
      {
        ...pendingInteraction,
        characterName: "重复角色",
        updatedAt: 111,
      },
      {
        characterId: "",
        characterName: "无效角色",
      },
    ],
    120,
  );
  assert.equal(
    model.getMoment(interactionData, "moment-interactions").interactions
      .length,
    1,
    "A Moment must keep only one interaction per character.",
  );
  assert.equal(
    model.getMoment(interactionData, "moment-interactions").interactions[0]
      .characterName,
    "重复角色",
    "The newest duplicate interaction should win.",
  );

  interactionData = model.updateInteraction(
    interactionData,
    "moment-interactions",
    "character-one",
    {
      status: model.INTERACTION_STATUS.SENT,
      liked: true,
      comment: "  这条动态很有意思。  ",
      error: null,
    },
    130,
  );
  const sentInteraction = model.getMoment(
    interactionData,
    "moment-interactions",
  ).interactions[0];
  assert.equal(sentInteraction.status, model.INTERACTION_STATUS.SENT);
  assert.equal(sentInteraction.liked, true);
  assert.equal(sentInteraction.comment, "这条动态很有意思。");
  assert.equal(sentInteraction.updatedAt, 130);

  const interrupted = model.recoverInterruptedInteractions(
    model.updateInteraction(
      interactionData,
      "moment-interactions",
      "character-one",
      {
        status: model.INTERACTION_STATUS.PENDING,
        liked: false,
        comment: "",
      },
      140,
    ),
    150,
  );
  assert.equal(interrupted.recovered, 1);
  const interruptedInteraction = model.getMoment(
    interrupted.data,
    "moment-interactions",
  ).interactions[0];
  assert.equal(
    interruptedInteraction.status,
    model.INTERACTION_STATUS.FAILED,
  );
  assert.equal(interruptedInteraction.error.title, "角色互动被中断");
  assert.equal(interruptedInteraction.updatedAt, 150);

  assert.throws(
    () => model.createMoment("   "),
    /请写一点想发布的内容，或添加至少一张照片/,
    "Creating an empty Moment must fail with a useful message.",
  );

  console.log("Moments model tests passed.");
}

runTests();
