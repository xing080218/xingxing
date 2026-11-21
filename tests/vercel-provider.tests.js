"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const {
  buildChatMessages,
  invokeProvider,
  parseReplyText,
  protectMessage,
  resolveChatEndpoint,
} = require("../lib/vercel-provider");

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
  assert.match(built.messages[0].content, /占位角色/);
  assert.match(built.messages[0].content, /只以角色身份输出要发来的消息/);
  assert.match(built.messages[0].content, /每条消息单独一行/);
  assert.match(built.messages[0].content, /不要输出动作、神态、旁白/);
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
  } finally {
    await new Promise((resolve) => mock.server.close(resolve));
  }

  console.log("Vercel provider tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
