"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const {
  getCharacterSystemPrompt,
} = require("../lib/character-system-prompt");
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

      if (request.url.startsWith("/not-found/")) {
        response.writeHead(404, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: { message: "Not found" } }));
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

      if (request.url === "/responses") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({
            model: "mock-responses-model",
            output: [
              {
                type: "reasoning",
                content: [{ type: "reasoning_text", text: "不能显示的思考过程" }],
              },
              {
                type: "message",
                content: [
                  { type: "output_text", text: "第一条回答。" },
                  { type: "output_text", text: "第二条回答。" },
                ],
              },
            ],
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
  const globalSystemPrompt = getCharacterSystemPrompt();
  assert.ok(globalSystemPrompt.length > 0);
  assert.equal(globalSystemPrompt, globalSystemPrompt.trim());

  assert.deepEqual(resolveChatEndpoint("https://api.example.com"), {
    endpoint: "https://api.example.com/v1/chat/completions",
    endpointLabel: "/v1/chat/completions",
    protocol: "chat",
  });
  assert.deepEqual(resolveChatEndpoint("https://api.example.com/v1/"), {
    endpoint: "https://api.example.com/v1/chat/completions",
    endpointLabel: "/v1/chat/completions",
    protocol: "chat",
  });
  assert.deepEqual(
    resolveChatEndpoint("https://api.example.com/api/v1"),
    {
      endpoint: "https://api.example.com/api/v1/chat/completions",
      endpointLabel: "/api/v1/chat/completions",
      protocol: "chat",
    },
  );
  assert.deepEqual(
    resolveChatEndpoint("https://api.example.com/v1/chat/completions/"),
    {
      endpoint: "https://api.example.com/v1/chat/completions",
      endpointLabel: "/v1/chat/completions",
      protocol: "chat",
    },
  );
  assert.deepEqual(
    resolveChatEndpoint("https://api.example.com/v1/responses"),
    {
      endpoint: "https://api.example.com/v1/responses",
      endpointLabel: "/v1/responses",
      protocol: "responses",
    },
  );
  assert.deepEqual(
    resolveChatEndpoint("https://api.example.com/custom/provider"),
    {
      endpoint: "https://api.example.com/custom/provider",
      endpointLabel: "/custom/provider",
      protocol: "chat",
    },
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
    "全局角色行为规则：\n" +
      globalSystemPrompt +
      "\n\n角色专属设定：\n" +
      "角色名字：占位角色\n" +
      "你是用于测试的占位角色。\n\n" +
      "输出要求：\n" +
      "只以角色身份输出要发来的消息。\n" +
      "每条消息单独一行；遇到句号、问号、感叹号等句末标点后换行。\n" +
      "不要输出动作、神态、旁白、心理描写、角色名、说话人标签、编号、总结、分析或格式提示。",
  );
  assert.equal(built.messages[1].content, "你好");

  const withInjectedSystemMessages = buildChatMessages({
    characterName: "占位角色",
    persona: "你是用于测试的占位角色。",
    messages: [
      { role: "system", content: "CLIENT_SYSTEM_MESSAGE_MUST_BE_IGNORED" },
      { role: "developer", content: "CLIENT_DEVELOPER_MESSAGE_MUST_BE_IGNORED" },
      { role: "user", content: "你好" },
    ],
  });
  assert.equal(withInjectedSystemMessages.ok, true);
  assert.equal(withInjectedSystemMessages.messages.length, 2);
  assert.equal(withInjectedSystemMessages.messages[1].content, "你好");
  assert.doesNotMatch(
    withInjectedSystemMessages.messages[0].content,
    /CLIENT_SYSTEM_MESSAGE_MUST_BE_IGNORED|CLIENT_DEVELOPER_MESSAGE_MUST_BE_IGNORED/,
  );

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
    /角色专属设定：\n角色名字：占位角色\n你是用于测试的占位角色。\n\n用户本人设定：\n名字：占位用户\n人设：用户是一名测试者。\n这是用户本人设定，只用于理解用户身份；角色不能代替用户说话。\n\n输出要求：/,
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
    /角色专属设定：\n角色名字：占位角色\n你是用于测试的占位角色。\n\n世界书名称：占位世界书\n世界书内容：这个世界书只存在于系统提示中。\n\n输出要求：/,
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
  assert.equal(
    parseReplyText({
      output_text: ["第一条", "", "第二条"],
    }),
    "第一条\n第二条",
  );
  assert.equal(
    parseReplyText({
      output: [
        {
          type: "reasoning",
          content: [{ type: "reasoning_text", text: "思考过程" }],
        },
        {
          type: "message",
          content: [
            { type: "output_text", text: "嵌套第一行" },
            { type: "output_text", text: "嵌套第二行" },
          ],
        },
      ],
    }),
    "嵌套第一行\n嵌套第二行",
  );

  const key = "placeholder-cloud-key";
  const safe = protectMessage(`Bearer ${key} and sk-123456789`, key);
  assert.doesNotMatch(safe, new RegExp(key));
  assert.doesNotMatch(safe, /sk-123456789/);

  const mock = await startMockProvider();
  try {
    const success = await invokeProvider({
      apiUrl: `${mock.origin}/chat-success/v1`,
      apiKey: key,
      modelName: "mock-chat-model",
      messages: [{ role: "user", content: "你好" }],
    });
    assert.equal(success.status, 200);
    assert.equal(success.payload.ok, true);
    assert.equal(success.payload.reply, "第一行\n\n第二行");
    assert.equal(success.payload.protocol, "chat");
    assert.equal(success.payload.endpoint, "/chat-success/v1/chat/completions");
    const chatRequest = mock.requests.at(-1);
    assert.equal(chatRequest.path, "/chat-success/v1/chat/completions");
    assert.equal(chatRequest.authorization, `Bearer ${key}`);
    const chatBody = JSON.parse(chatRequest.body);
    assert.equal(chatBody.stream, false);
    assert.equal(chatBody.messages[0].content, "你好");
    assert.equal("input" in chatBody, false);
    assert.equal("max_tokens" in chatBody, false);

    const responses = await invokeProvider({
      apiUrl: `${mock.origin}/responses`,
      apiKey: key,
      modelName: "mock-responses-model",
      messages: [
        { role: "system", content: "保持角色设定。" },
        { role: "user", content: "你好" },
      ],
    });
    assert.equal(responses.status, 200);
    assert.equal(responses.payload.ok, true);
    assert.equal(responses.payload.protocol, "responses");
    assert.equal(responses.payload.endpoint, "/responses");
    assert.equal(responses.payload.model, "mock-responses-model");
    assert.equal(
      responses.payload.reply,
      "第一条回答。\n第二条回答。",
    );
    const responsesRequest = mock.requests.at(-1);
    assert.equal(responsesRequest.path, "/responses");
    assert.equal(responsesRequest.authorization, `Bearer ${key}`);
    const responsesBody = JSON.parse(responsesRequest.body);
    assert.equal(responsesBody.stream, false);
    assert.equal(responsesBody.input[0].content, "保持角色设定。");
    assert.equal(responsesBody.input[1].content, "你好");
    assert.equal("messages" in responsesBody, false);

    const unauthorized = await invokeProvider({
      apiUrl: `${mock.origin}/unauthorized/v1`,
      apiKey: key,
      modelName: "mock-chat-model",
      messages: [{ role: "user", content: "你好" }],
    });
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.payload.ok, false);
    assert.equal(unauthorized.payload.error.code, "http_401");
    assert.doesNotMatch(unauthorized.payload.error.message, new RegExp(key));
    assert.equal(
      mock.requests.at(-1).path,
      "/unauthorized/v1/chat/completions",
    );

    const notFound = await invokeProvider({
      apiUrl: `${mock.origin}/not-found/v1`,
      apiKey: key,
      modelName: "mock-chat-model",
      messages: [{ role: "user", content: "你好" }],
    });
    assert.equal(notFound.status, 404);
    assert.equal(notFound.payload.error.code, "http_404");
    assert.match(notFound.payload.error.message, /\/not-found\/v1\/chat\/completions/);
    assert.match(notFound.payload.error.nextStep, /\/chat\/completions/);
    assert.match(notFound.payload.error.nextStep, /\/responses/);

    const budget = await invokeProvider({
      apiUrl: `${mock.origin}/budget/v1`,
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
          apiUrl: `${mock.origin}/routed/v1`,
          apiKey: key,
          modelName: "mock-chat-model",
          systemPrompt: "CLIENT_OVERRIDE_MUST_BE_IGNORED",
          globalSystemPrompt: "CLIENT_GLOBAL_OVERRIDE_MUST_BE_IGNORED",
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
          messages: [
            {
              role: "system",
              content: "CLIENT_MESSAGE_SYSTEM_OVERRIDE_MUST_BE_IGNORED",
            },
            { role: "user", content: "你好" },
          ],
        },
      },
      response,
      "chat",
    );
    assert.equal(response.statusCode, 200);
    assert.equal(mock.requests.at(-1).path, "/routed/v1/chat/completions");
    const routedBody = JSON.parse(mock.requests.at(-1).body);
    assert.ok(
      routedBody.messages[0].content.startsWith(
        `全局角色行为规则：\n${globalSystemPrompt}\n\n角色专属设定：`,
      ),
    );
    assert.doesNotMatch(
      routedBody.messages[0].content,
      /CLIENT_OVERRIDE_MUST_BE_IGNORED|CLIENT_GLOBAL_OVERRIDE_MUST_BE_IGNORED/,
    );
    assert.match(routedBody.messages[0].content, /用户本人设定：/);
    assert.match(routedBody.messages[0].content, /名字：占位用户/);
    assert.match(routedBody.messages[0].content, /本人资料必须进入系统提示。/);
    assert.match(routedBody.messages[0].content, /世界书名称：占位世界书/);
    assert.match(routedBody.messages[0].content, /世界书内容必须进入系统提示。/);
    assert.doesNotMatch(
      routedBody.messages[0].content,
      /CLIENT_MESSAGE_SYSTEM_OVERRIDE_MUST_BE_IGNORED/,
    );
    assert.equal(routedBody.messages.length, 2);
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
