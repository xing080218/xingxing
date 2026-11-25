"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "js", "moments-reaction-client.js"),
  "utf8",
);

function loadClient(fetchImplementation) {
  const requests = [];
  const window = {
    setTimeout,
    clearTimeout,
    fetch: async (url, options) => {
      requests.push({ url, options });
      return fetchImplementation(url, options, requests.length);
    },
  };
  vm.runInNewContext(
    source,
    {
      window,
      AbortController,
      setTimeout,
      clearTimeout,
    },
    { filename: "js/moments-reaction-client.js" },
  );
  return {
    client: window.PocketLabMomentsReactionClient,
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
  const character = {
    id: "character-placeholder",
    name: "占位角色",
    persona: "这是只用于自动测试的占位角色人设，说话简短而自然。",
  };
  const moment = {
    id: "moment-placeholder",
    content: "今天第一次尝试做手冲咖啡，味道比预想中好。",
  };
  const config = {
    apiUrl: "https://api.example.com/v1",
    apiKey: "your-api-key",
    modelName: "placeholder-model",
  };
  const messages = [
    { role: "system", content: "系统提示不能进入历史。" },
    { role: "user", content: "我已经撤回的消息", retracted: true },
    { role: "assistant", content: "生成失败的消息", failed: true },
    { role: "assistant", content: "等待中的消息", pendingReply: true },
    { role: "user", content: "最近一次普通聊天。" },
    { role: "assistant", content: "我会认真回应你。" },
    { role: "user", content: "   " },
  ];
  const worldBook = {
    name: "占位世界书",
    content: "角色住在一座安静的海边小城。",
  };
  const userProfile = {
    name: "占位用户",
    persona: "喜欢记录日常生活。",
  };

  const { client, requests } = loadClient(() =>
    successfulResponse(
      '```json\n{"liked":true,"comment":"看起来很香，下次也给我留一杯。"}\n```',
    ),
  );
  const body = client.buildRequestBody({
    character,
    config,
    moment,
    messages,
    worldBook,
    userProfile,
  });
  assert.equal(body.apiUrl, config.apiUrl);
  assert.equal(body.apiKey, "your-api-key");
  assert.equal(body.modelName, config.modelName);
  assert.equal(body.characterName, character.name);
  assert.equal(body.persona, character.persona);
  assert.deepEqual(
    JSON.parse(JSON.stringify(body.messages.slice(0, -1))),
    [
      { role: "user", content: "最近一次普通聊天。" },
      { role: "assistant", content: "我会认真回应你。" },
    ],
  );
  assert.match(body.messages.at(-1).content, new RegExp(moment.content));
  assert.match(body.messages.at(-1).content, /JSON/);
  assert.deepEqual(
    JSON.parse(JSON.stringify(body.worldBook)),
    worldBook,
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(body.userProfile)),
    userProfile,
  );
  assert.doesNotMatch(
    JSON.stringify(body),
    /系统提示不能进入历史|已经撤回|生成失败|等待中的消息/,
  );

  const photoOnlyMoment = {
    id: "moment-photo-placeholder",
    content: "",
    imageIds: [
      "moment-photo-alpha",
      "moment-photo-beta",
    ],
  };
  const photoBody = client.buildRequestBody({
    character,
    config,
    moment: photoOnlyMoment,
  });
  const photoPrompt = photoBody.messages.at(-1).content;
  assert.match(
    photoPrompt,
    /动态包含 2 张照片/,
    "A photo-only Moment must still produce a character prompt.",
  );
  assert.match(photoPrompt, /这条动态没有文字/);
  assert.doesNotMatch(
    JSON.stringify(photoBody),
    /moment-photo-alpha|moment-photo-beta|data:image|base64/iu,
    "Photo IDs and image payloads must never be sent to the model.",
  );

  assert.deepEqual(
    {
      ...client.parseReaction(
        '说明文字\n```json\n{"liked":true,"comment":"  “收到你的分享。”  "}\n```',
      ),
    },
    {
      liked: true,
      comment: "收到你的分享。",
    },
  );
  assert.deepEqual(
    { ...client.parseReaction("评论：这家店我也去过，氛围很好。") },
    {
      liked: true,
      comment: "这家店我也去过，氛围很好。",
    },
  );
  assert.throws(
    () => client.parseReaction('{"liked":true}'),
    /没有评论内容/,
  );

  const generated = await client.generateReaction({
    character,
    config,
    moment,
    messages,
    worldBook,
    userProfile,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(generated)), {
    liked: true,
    comment: "看起来很香，下次也给我留一杯。",
    status: 200,
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/chat");
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[0].options.credentials, "same-origin");
  const sentBody = JSON.parse(requests[0].options.body);
  assert.equal(sentBody.apiKey, "your-api-key");
  assert.equal(sentBody.worldBook.name, worldBook.name);
  assert.equal(sentBody.userProfile.name, userProfile.name);

  assert.throws(
    () =>
      client.buildRequestBody({
        character,
        config: { ...config, apiKey: "" },
        moment,
      }),
    /缺少 API 地址、API Key 或模型名/,
  );
  assert.throws(
    () =>
      client.buildRequestBody({
        character: { ...character, persona: "" },
        config,
        moment,
      }),
    /角色人设为空/,
  );
  assert.throws(
    () =>
      client.buildRequestBody({
        character,
        config,
        moment: { id: "empty", content: "", imageIds: [] },
      }),
    /缺少动态文字或照片/,
  );

  const { client: failingClient } = loadClient(() => ({
    ok: false,
    status: 429,
    async json() {
      return {
        ok: false,
        status: 429,
        error: {
          title: "请求过于频繁",
          message: "自动测试生成的限流原因。",
          nextStep: "稍后重试。",
        },
      };
    },
  }));
  await assert.rejects(
    () =>
      failingClient.generateReaction({
        character,
        config,
        moment,
      }),
    (error) => {
      assert.equal(error.name, "MomentReactionApiError");
      assert.equal(error.status, 429);
      assert.equal(error.message, "自动测试生成的限流原因。");
      assert.equal(error.apiError.title, "请求过于频繁");
      return true;
    },
  );

  console.log("Moments reaction client tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
