"use strict";

const assert = require("node:assert/strict");
const model = require("../js/sms-model.js");

function sentRecord(overrides = {}) {
  return model.createSmsRecord({
    id: "sms-1",
    characterId: "character-1",
    blockEventId: "block-1",
    content: "对不起，刚才是我说得太重了。",
    createdAt: 100,
    status: model.STATUS.SENT,
    ...overrides,
  });
}

function runTests() {
  const first = sentRecord();
  const data = model.normalizeSmsData({ messages: [first] });
  const legacyApology = model.normalizeSmsRecord({
    id: "sms-legacy",
    characterId: "character-1",
    blockEventId: "block-legacy",
    content: "旧版道歉短信",
    createdAt: 50,
    status: model.STATUS.SENT,
  });
  assert.equal(legacyApology.role, model.ROLE.ASSISTANT);
  assert.equal(legacyApology.kind, model.KIND.APOLOGY);

  const userRecord = model.createSmsRecord({
    id: "sms-user",
    characterId: "character-1",
    content: "这是用户发出的短信。",
    createdAt: 80,
    status: model.STATUS.SENT,
    role: model.ROLE.USER,
    kind: model.KIND.MESSAGE,
  });
  assert.equal(userRecord.readAt, 80);
  assert.equal(
    model.groupByCharacter({ messages: [userRecord] })[0].unreadCount,
    0,
    "User SMS must not increase the unread badge.",
  );
  assert.equal(
    model.prepareRetry({
      ...userRecord,
      status: model.STATUS.FAILED,
    }),
    null,
    "Only assistant SMS records can be retried.",
  );

  assert.equal(
    model.shouldTriggerApology({
      wasBlocked: false,
      isBlocked: true,
      blockEventId: "block-1",
      messages: null,
    }),
    true,
    "The first transition into blocked must trigger one apology.",
  );
  assert.equal(
    model.shouldTriggerApology({
      wasBlocked: true,
      isBlocked: true,
      blockEventId: "block-1",
      messages: null,
    }),
    false,
    "Repeated blocked saves must not trigger another apology.",
  );
  assert.equal(
    model.shouldTriggerApology({
      wasBlocked: false,
      isBlocked: true,
      blockEventId: "block-1",
      messages: data,
    }),
    false,
    "A duplicate block event must be ignored.",
  );
  assert.equal(
    model.shouldTriggerApology({
      wasBlocked: false,
      isBlocked: true,
      blockEventId: "block-2",
      messages: data,
    }),
    true,
    "Unblocking and blocking again must create a new apology.",
  );

  const retry = model.prepareRetry(
    {
      ...first,
      readAt: 500,
      status: model.STATUS.FAILED,
      error: {
        title: "失败",
        message: "原因",
        nextStep: "重试",
      },
    },
    600,
  );
  assert.equal(retry.id, first.id);
  assert.equal(retry.blockEventId, first.blockEventId);
  assert.equal(retry.status, model.STATUS.SENDING);
  assert.equal(retry.content, "");
  assert.equal(retry.error, null);
  assert.equal(retry.readAt, 0);

  const interrupted = model.recoverInterruptedSends(
    {
      messages: [
        model.createSmsRecord({
          id: "sms-pending",
          characterId: "character-1",
          blockEventId: "block-pending",
          status: model.STATUS.SENDING,
        }),
      ],
    },
    700,
  );
  assert.equal(interrupted.messages[0].status, model.STATUS.FAILED);
  assert.equal(interrupted.messages[0].error.title, "短信生成被中断");
  assert.equal(interrupted.messages[0].updatedAt, 700);

  const readData = model.markCharacterRead(
    {
      messages: [
        sentRecord(),
        sentRecord({
          id: "sms-2",
          blockEventId: "block-2",
          status: model.STATUS.FAILED,
          error: {
            title: "失败",
            message: "测试失败",
            nextStep: "重试",
          },
          createdAt: 200,
        }),
      ],
    },
    "character-1",
    900,
  );
  assert.deepEqual(
    readData.messages.map((record) => record.readAt),
    [900, 900],
  );
  assert.equal(
    model.groupByCharacter(readData)[0].unreadCount,
    0,
  );
  assert.equal(
    model.groupByCharacter({ messages: [first] })[0].unreadCount,
    1,
  );

  const smsContext = model.buildSmsContext(
    [
      userRecord,
      model.createSmsRecord({
        id: "sms-assistant",
        characterId: "character-1",
        content: "这是角色回复。",
        createdAt: 90,
        status: model.STATUS.SENT,
        role: model.ROLE.ASSISTANT,
        kind: model.KIND.MESSAGE,
      }),
      model.createSmsRecord({
        id: "sms-pending-context",
        characterId: "character-1",
        content: "生成中不应进入历史。",
        createdAt: 100,
        status: model.STATUS.SENDING,
        role: model.ROLE.ASSISTANT,
        kind: model.KIND.MESSAGE,
      }),
      model.createSmsRecord({
        id: "sms-failed-context",
        characterId: "character-1",
        content: "失败内容不应进入历史。",
        createdAt: 110,
        status: model.STATUS.FAILED,
        error: {
          title: "失败",
          message: "测试失败",
          nextStep: "重试",
        },
        role: model.ROLE.ASSISTANT,
        kind: model.KIND.MESSAGE,
      }),
    ],
    {
      historyLimit: 20,
      excludeIds: ["sms-assistant"],
    },
  );
  assert.deepEqual(smsContext, [
    {
      role: model.ROLE.USER,
      content: "这是用户发出的短信。",
    },
  ]);

  const filtered = model.buildChatContext(
    [
      { role: "system", content: "不要发送" },
      { role: "user", content: "第一句", retracted: true },
      { role: "user", content: "第二句" },
      { role: "assistant", content: "回应", failed: true },
      { role: "assistant", content: "完成", pendingReply: true },
      { role: "assistant", content: "有效回应" },
      { role: "user", content: "最近一句" },
    ],
    { historyLimit: 20 },
  );
  assert.deepEqual(filtered, [
    { role: "user", content: "第二句" },
    { role: "assistant", content: "有效回应" },
    { role: "user", content: "最近一句" },
  ]);

  assert.equal(
    model.normalizeSmsReply(
      '```text\n短信：“对不起，刚才是我忽略了你的感受。”\n```',
    ),
    "对不起，刚才是我忽略了你的感受。",
  );
  assert.equal(
    model.getPreview(
      model.createSmsRecord({
        id: "sms-sending",
        characterId: "character-1",
        blockEventId: "block-sending",
        status: model.STATUS.SENDING,
      }),
    ),
    "正在发送道歉短信…",
  );
  assert.equal(
    model.getPreview(
      model.createSmsRecord({
        id: "sms-message-sending",
        characterId: "character-1",
        status: model.STATUS.SENDING,
        role: model.ROLE.ASSISTANT,
        kind: model.KIND.MESSAGE,
      }),
    ),
    "正在回复短信…",
  );
  assert.match(
    model.buildSmsPrompt("占位角色", "今天还好吗？", {
      hasHistory: true,
    }),
    /今天还好吗？/,
  );
  assert.equal(model.buildSmsPrompt("占位角色", "   "), "");

  console.log("SMS model tests passed.");
}

runTests();
