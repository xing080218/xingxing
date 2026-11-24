"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const model = require("../js/sms-model.js");

const source = fs.readFileSync(
  path.join(__dirname, "..", "js", "sms-client.js"),
  "utf8",
);

function loadClient(fetchImplementation) {
  const requests = [];
  const window = {
    PocketLabSmsModel: model,
    setTimeout,
    clearTimeout,
    fetch: async (url, options) => {
      requests.push({ url, options });
      return fetchImplementation(url, options, requests.length);
    },
  };
  const context = {
    window,
    AbortController,
    setTimeout,
    clearTimeout,
  };
  vm.runInNewContext(source, context, { filename: "js/sms-client.js" });
  return {
    client: window.PocketLabSmsClient,
    requests,
  };
}

function successfulResponse(reply) {
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        ok: true,
        status: 200,
        reply,
      };
    },
  };
}

async function runTests() {
  const placeholderKey = "your-api-key";
  const character = {
    id: "character-placeholder",
    name: "占位角色",
    persona: "这是只用于自动测试的占位角色人设。",
  };
  const messages = [
    { role: "system", content: "系统消息不能进入聊天历史。" },
    { role: "user", content: "已经撤回的话", retracted: true },
    { role: "assistant", content: "失败的回复", failed: true },
    { role: "user", content: "刚才我们因为安排争执了。" },
    {
      role: "assistant",
      content: "我当时没有认真听你说话。",
    },
    { role: "user", content: "" },
  ];
  const worldBook = {
    id: "world-placeholder",
    name: "占位世界书",
    content: "只用于验证短信请求会携带角色绑定的世界书。",
  };
  const userProfile = {
    id: "profile-placeholder",
    name: "占位用户",
    persona: "这是只用于自动测试的本人资料。",
  };
  const config = {
    apiUrl: "https://api.example.com/v1",
    apiKey: placeholderKey,
    modelName: "placeholder-model",
  };
  const sentUserSms = model.createSmsRecord({
    id: "sms-user-placeholder",
    characterId: character.id,
    content: "这条短信需要角色认真回复。",
    createdAt: 300,
    status: model.STATUS.SENT,
    readAt: 300,
    role: model.ROLE.USER,
    kind: model.KIND.MESSAGE,
  });
  const sentAssistantSms = model.createSmsRecord({
    id: "sms-assistant-placeholder",
    characterId: character.id,
    content: "上一条角色短信回复。",
    createdAt: 301,
    status: model.STATUS.SENT,
    role: model.ROLE.ASSISTANT,
    kind: model.KIND.MESSAGE,
  });
  const currentReply = model.createSmsRecord({
    id: "sms-current-reply-placeholder",
    characterId: character.id,
    createdAt: 303,
    status: model.STATUS.SENDING,
    role: model.ROLE.ASSISTANT,
    kind: model.KIND.MESSAGE,
    replyToId: sentUserSms.id,
  });

  const { client, requests } = loadClient(() =>
    successfulResponse("  “对不起，刚才是我没有认真听你说话。”  "),
  );
  const requestBody = client.buildRequestBody({
    character,
    config,
    messages,
    worldBook,
    userProfile,
  });

  assert.equal(requestBody.apiUrl, config.apiUrl);
  assert.equal(requestBody.apiKey, placeholderKey);
  assert.equal(requestBody.modelName, config.modelName);
  assert.equal(requestBody.characterName, character.name);
  assert.equal(requestBody.persona, character.persona);
  assert.equal("config" in requestBody, false);
  assert.deepEqual(
    JSON.parse(JSON.stringify(requestBody.worldBook)),
    {
      name: worldBook.name,
      content: worldBook.content,
    },
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(requestBody.userProfile)),
    {
      name: userProfile.name,
      persona: userProfile.persona,
    },
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(requestBody.messages.slice(0, 2))),
    [
      { role: "user", content: "刚才我们因为安排争执了。" },
      {
        role: "assistant",
        content: "我当时没有认真听你说话。",
      },
    ],
  );
  assert.equal(requestBody.messages.length, 3);
  assert.equal(requestBody.messages.at(-1).role, "user");
  assert.match(
    requestBody.messages.at(-1).content,
    /你刚刚被对方拉黑了/,
  );
  assert.match(
    requestBody.messages.at(-1).content,
    /结合最近聊天里双方的情绪和具体分歧/,
  );
  assert.doesNotMatch(
    JSON.stringify(requestBody),
    /系统消息不能进入聊天历史|已经撤回的话|失败的回复/,
  );

  const result = await client.generateApology({
    character,
    config,
    messages,
    worldBook,
    userProfile,
  });
  assert.equal(result.content, "对不起，刚才是我没有认真听你说话。");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/chat");
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[0].options.credentials, "same-origin");
  const sentBody = JSON.parse(requests[0].options.body);
  assert.equal(sentBody.apiKey, placeholderKey);
  assert.equal("config" in sentBody, false);
  assert.equal(sentBody.worldBook.name, worldBook.name);
  assert.equal(sentBody.userProfile.name, userProfile.name);

  const messageBody = client.buildRequestBody({
    character,
    config,
    messages,
    worldBook,
    userProfile,
    smsMessages: [sentUserSms, sentAssistantSms, currentReply],
    smsText: sentUserSms.content,
    excludeSmsRecordIds: [sentUserSms.id, currentReply.id],
    kind: model.KIND.MESSAGE,
  });
  assert.equal(messageBody.apiUrl, config.apiUrl);
  assert.equal(messageBody.apiKey, placeholderKey);
  assert.equal(messageBody.characterName, character.name);
  assert.equal(messageBody.persona, character.persona);
  assert.equal(messageBody.worldBook.name, worldBook.name);
  assert.equal(messageBody.userProfile.name, userProfile.name);
  assert.ok(
    messageBody.messages.some(
      (message) => message.content === sentAssistantSms.content,
    ),
    "Previous role SMS should be sent as context.",
  );
  assert.ok(
    messageBody.messages.some(
      (message) => message.content === "刚才我们因为安排争执了。",
    ),
    "Recent normal chat should be sent as context.",
  );
  assert.match(
    messageBody.messages.at(-1).content,
    /通过手机短信和对方聊天/,
  );
  assert.match(
    messageBody.messages.at(-1).content,
    /这条短信需要角色认真回复/,
  );
  assert.doesNotMatch(
    JSON.stringify(messageBody),
    /上一条角色短信回复。.*上一条角色短信回复。/,
    "Excluded SMS history should not be duplicated.",
  );
  assert.doesNotMatch(
    JSON.stringify(messageBody),
    /sms-user-placeholder|sms-current-reply-placeholder|replyToId/,
    "Internal SMS IDs must not be sent to the provider.",
  );
  for (const internalField of ["kind", "smsText", "smsMessages"]) {
    assert.equal(internalField in messageBody, false);
  }

  await client.generateMessage({
    character,
    config,
    messages,
    worldBook,
    userProfile,
    smsMessages: [sentUserSms, sentAssistantSms, currentReply],
    smsText: sentUserSms.content,
    excludeSmsRecordIds: [sentUserSms.id, currentReply.id],
  });
  assert.equal(requests.length, 2);
  const sentMessageBody = JSON.parse(requests[1].options.body);
  assert.match(sentMessageBody.messages.at(-1).content, /通过手机短信/);
  assert.match(
    sentMessageBody.messages.at(-1).content,
    /这条短信需要角色认真回复/,
  );

  assert.throws(
    () =>
      client.buildRequestBody({
        character,
        config: { ...config, apiKey: "" },
        messages,
      }),
    /缺少 API 地址、API Key 或模型名/,
  );

  const { client: failingClient } = loadClient(() => ({
    ok: false,
    status: 500,
    async json() {
      return {
        ok: false,
        status: 500,
        error: {
          title: "占位服务失败",
          message: "这是自动测试生成的失败原因。",
          nextStep: "检查占位配置后重试。",
        },
      };
    },
  }));
  await assert.rejects(
    () =>
      failingClient.generateApology({
        character,
        config,
        messages,
      }),
    (error) => {
      assert.equal(error.name, "SmsApiError");
      assert.equal(error.status, 500);
      assert.equal(error.message, "这是自动测试生成的失败原因。");
      return true;
    },
  );

  console.log("SMS client tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
