"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const {
  buildChatMessages,
  handleProviderRequest,
  invokeProvider,
  parseReplyText,
  protectMessage,
  resolveChatEndpoint,
} = require("../lib/vercel-provider");

function createMockResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = String(value);
    },
    end(chunk = "") {
      this.body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    },
  };
}

async function startMockProvider() {
  const requests = [];
  const server = http.createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      requests.push({
        path: request.url,
        authorization: request.headers.authorization || "",
        body,
      });

      if (request.url.startsWith("/unauthorized/")) {
        response.writeHead(401, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({
            error: {
              message: `Rejected placeholder-cloud-key ${request.headers.authorization}`,
            },
          }),
        );
        return;
      }

      if (request.url.startsWith("/budget/")) {
        response.writeHead(451, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({
            error: {
              code: 400,
              message:
                "AI Studio returned an empty response: max output tokens were exhausted before any answer (raise max_output_tokens / thinking budget)",
              status: "INVALID_ARGUMENT",
            },
          }),
        );
        return;
      }

      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          model: "mock-chat-model",
          choices: [
            {
              message: {
                content: "第一行\n\n第二行",
              },
            },
          ],
        }),
      );
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    server,
    requests,
    origin: `http://127.0.0.1:${address.port}`,
  };
}

async function run() {
  assert.equal(
    resolveChatEndpoint("https://api.example.com").endpoint,
    "https://api.example.com/v1/chat/completions",
  );
  assert.equal(
    resolveChatEndpoint("https://api.example.com/v1/").endpoint,
    "https://api.example.com/v1/chat/completions",
  );
  assert.equal(
    resolveChatEndpoint("https://api.example.com/v1/chat/completions").endpoint,
    "https://api.example.com/v1/chat/completions",
  );

  const built = buildChatMessages({
    characterName: "占位角色",
    persona: "你是用于测试的占位角色。",
    messages: [{ role: "user", content: "你好" }],
  });
  assert.equal(built.ok, true);
  assert.equal(built.messages[0].role, "system");
  assert.equal(
    built.messages[0].content,
    "角色名字：占位角色\n" +
      "你是用于测试的占位角色。\n\n" +
      "输出要求：\n" +
      "只以角色身份输出要发来的消息。\n" +
      "每条消息单独一行；遇到句号、问号、感叹号等句末标点后换行。\n" +
      "不要输出动作、神态、旁白、心理描写、角色名、说话人标签、编号、总结、分析或格式提示。",
  );
  assert.equal(built.messages[1].content, "你好");

  const withUserProfile = buildChatMessages({
    characterName: "占位角色",
    persona: "你是用于测试的占位角色。",
    userProfile: {
      name: "占位用户",
      persona: "用户是一名测试者。",
    },
    messages: [{ role: "user", content: "你好" }],
  });
  assert.equal(withUserProfile.ok, true);
  assert.match(
    withUserProfile.messages[0].content,
    /角色名字：占位角色\n你是用于测试的占位角色。\n\n用户本人设定：\n名字：占位用户\n人设：用户是一名测试者。\n这是用户本人设定，只用于理解用户身份；角色不能代替用户说话。\n\n输出要求：/,
  );
  assert.equal(withUserProfile.messages[1].content, "你好");
  assert.doesNotMatch(withUserProfile.messages[1].content, /占位用户/);
  assert.doesNotMatch(withUserProfile.messages[1].content, /用户是一名测试者/);

  const withWorldBook = buildChatMessages({
    characterName: "占位角色",
    persona: "你是用于测试的占位角色。",
    worldBook: {
      name: "占位世界书",
      content: "这个世界书只存在于系统提示中。",
    },
    messages: [{ role: "user", content: "你好" }],
  });
  assert.equal(withWorldBook.ok, true);
  assert.match(
    withWorldBook.messages[0].content,
    /角色名字：占位角色\n你是用于测试的占位角色。\n\n世界书名称：占位世界书\n世界书内容：这个世界书只存在于系统提示中。\n\n输出要求：/,
  );
  assert.doesNotMatch(withWorldBook.messages[1].content, /占位世界书/);
  assert.doesNotMatch(
    withWorldBook.messages[1].content,
    /这个世界书只存在于系统提示中。/,
  );

  const withProfileAndWorldBook = buildChatMessages({
    characterName: "占位角色",
    persona: "你是用于测试的占位角色。",
    userProfile: {
      name: "占位用户",
      persona: "用户的资料只进入系统提示。",
    },
    worldBook: {
      name: "占位世界书",
      content: "世界书和本人资料需要同时保留。",
    },
    messages: [{ role: "user", content: "你好" }],
  });
  assert.equal(withProfileAndWorldBook.ok, true);
  assert.match(
    withProfileAndWorldBook.messages[0].content,
    /用户本人设定：[\s\S]*世界书名称：占位世界书/,
  );
  assert.match(
    withProfileAndWorldBook.messages[0].content,
    /世界书和本人资料需要同时保留。/,
  );
  assert.equal(withProfileAndWorldBook.messages[1].content, "你好");

  for (const invalidUserProfile of [
    null,
    [],
    "本人资料",
    {},
    { name: "", persona: "用户人设" },
    { name: "名".repeat(25), persona: "用户人设" },
    { name: "占位用户", persona: "" },
    { name: "占位用户", persona: "文".repeat(4001) },
  ]) {
    const invalid = buildChatMessages({
      characterName: "占位角色",
      persona: "你是用于测试的占位角色。",
      userProfile: invalidUserProfile,
      messages: [{ role: "user", content: "你好" }],
    });
    assert.equal(invalid.ok, false);
    assert.equal(typeof invalid.error.title, "string");
    assert.equal(typeof invalid.error.nextStep, "string");
  }

  for (const invalidWorldBook of [
    null,
    [],
    "世界书",
    {},
    { name: "世界书", content: "" },
    { name: "名".repeat(81), content: "内容" },
    { name: "世界书", content: "文".repeat(12001) },
  ]) {
    const invalid = buildChatMessages({
      characterName: "占位角色",
      persona: "你是用于测试的占位角色。",
      worldBook: invalidWorldBook,
      messages: [{ role: "user", content: "你好" }],
    });
    assert.equal(invalid.ok, false);
    assert.equal(typeof invalid.error.title, "string");
    assert.equal(typeof invalid.error.nextStep, "string");
  }

  assert.equal(parseReplyText({
    choices: [{ message: { content: "第一行\n\n第二行" } }],
  }), "第一行\n\n第二行");

  const key = "placeholder-cloud-key";
  const safe = protectMessage(`Bearer ${key} and sk-123456789`, key);
  assert.doesNotMatch(safe, new RegExp(key));
  assert.doesNotMatch(safe, /sk-123456789/);

  const mock = await startMockProvider();
  try {
    const success = await invokeProvider({
      apiUrl: `${mock.origin}/v1`,
      apiKey: key,
      modelName: "mock-chat-model",
      messages: [{ role: "user", content: "你好" }],
    });
    assert.equal(success.status, 200);
    assert.equal(success.payload.ok, true);
    assert.equal(success.payload.reply, "第一行\n\n第二行");
    assert.equal(mock.requests[0].path, "/v1/chat/completions");
    assert.equal(mock.requests[0].authorization, `Bearer ${key}`);
    const sentBody = JSON.parse(mock.requests[0].body);
    assert.equal(sentBody.stream, false);
    assert.equal(sentBody.messages[0].content, "你好");
    assert.equal("max_tokens" in sentBody, false);

    const unauthorized = await invokeProvider({
      apiUrl: `${mock.origin}/unauthorized`,
      apiKey: key,
      modelName: "mock-chat-model",
      messages: [{ role: "user", content: "你好" }],
    });
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.payload.ok, false);
    assert.equal(unauthorized.payload.error.code, "http_401");
    assert.doesNotMatch(unauthorized.payload.error.message, new RegExp(key));

    const budget = await invokeProvider({
      apiUrl: `${mock.origin}/budget`,
      apiKey: key,
      modelName: "mock-chat-model",
      messages: [{ role: "user", content: "你好" }],
    });
    assert.equal(budget.status, 451);
    assert.equal(budget.payload.error.code, "model_output_budget");
    assert.match(budget.payload.error.nextStep, /max_output_tokens/);

    const response = createMockResponse();
    await handleProviderRequest(
      {
        method: "POST",
        body: {
          apiUrl: `${mock.origin}/v1`,
          apiKey: key,
          modelName: "mock-chat-model",
          characterName: "占位角色",
          persona: "你是用于测试的占位角色。",
          userProfile: {
            name: "占位用户",
            persona: "本人资料必须进入系统提示。",
          },
          worldBook: {
            name: "占位世界书",
            content: "世界书内容必须进入系统提示。",
          },
          messages: [{ role: "user", content: "你好" }],
        },
      },
      response,
      "chat",
    );
    assert.equal(response.statusCode, 200);
    const routedBody = JSON.parse(mock.requests[3].body);
    assert.match(routedBody.messages[0].content, /用户本人设定：/);
    assert.match(routedBody.messages[0].content, /名字：占位用户/);
    assert.match(routedBody.messages[0].content, /本人资料必须进入系统提示。/);
    assert.match(routedBody.messages[0].content, /世界书名称：占位世界书/);
    assert.match(routedBody.messages[0].content, /世界书内容必须进入系统提示。/);
    assert.equal(routedBody.messages[1].content, "你好");
  } finally {
    await new Promise((resolve) => mock.server.close(resolve));
  }

  console.log("Vercel provider tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
