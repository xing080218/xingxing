"use strict";

const { URL } = require("url");
const { requestWithRecovery } = require("./provider-node-transport");

const BUILD = "20261125-05";
const MAX_BODY_BYTES = 512 * 1024;
const PROVIDER_TIMEOUT_MS = 50000;
const TEST_PROMPT = "只回复 OK";
const MAX_WORLD_BOOK_NAME_LENGTH = 80;
const MAX_WORLD_BOOK_CONTENT_LENGTH = 12000;
const MAX_USER_PROFILE_NAME_LENGTH = 24;
const MAX_USER_PROFILE_PERSONA_LENGTH = 4000;
const CHAT_OUTPUT_RULES = [
  "只以角色身份输出要发来的消息。",
  "每条消息单独一行；遇到句号、问号、感叹号等句末标点后换行。",
  "不要输出动作、神态、旁白、心理描写、角色名、说话人标签、编号、总结、分析或格式提示。",
].join("\n");

function connectionError({
  title,
  message,
  nextStep,
  status = 0,
  code = "network",
  retryable = false,
}) {
  return {
    title,
    message,
    nextStep,
    status,
    code,
    ...(retryable ? { retryable: true } : {}),
  };
}

function protectMessage(value, apiKey = "") {
  let safe = String(value || "");
  if (apiKey) {
    safe = safe.split(apiKey).join("[已隐藏]");
  }
  safe = safe.replace(/(?:\bBearer\s+)[^\s,;]+/gi, "Bearer [已隐藏]");
  safe = safe.replace(/\bsk-[A-Za-z0-9._-]{6,}\b/g, "[已隐藏]");
  safe = safe.trim();
  return safe.length > 520 ? `${safe.slice(0, 520)}...` : safe;
}

function normalizeWorldBookForPrompt(worldBook) {
  if (worldBook === undefined) {
    return { ok: true, value: null };
  }
  if (
    !worldBook ||
    typeof worldBook !== "object" ||
    Array.isArray(worldBook)
  ) {
    return {
      ok: false,
      error: connectionError({
        title: "世界书格式不正确",
        message: "聊天请求里的世界书必须是包含名称和内容的记录。",
        nextStep: "重新从角色编辑中选择一本世界书，然后重新发送消息。",
        code: "invalid_world_book",
      }),
    };
  }

  const name =
    typeof worldBook.name === "string" ? worldBook.name.trim() : "";
  const content =
    typeof worldBook.content === "string" ? worldBook.content.trim() : "";

  if (!name) {
    return {
      ok: false,
      error: connectionError({
        title: "世界书名称为空",
        message: "角色绑定的世界书没有名称。",
        nextStep: "打开角色编辑，重新选择或创建一本世界书后再发送。",
        code: "missing_world_book_name",
      }),
    };
  }
  if (name.length > MAX_WORLD_BOOK_NAME_LENGTH) {
    return {
      ok: false,
      error: connectionError({
        title: "世界书名称过长",
        message: `世界书名称不能超过 ${MAX_WORLD_BOOK_NAME_LENGTH} 个字符。`,
        nextStep: "缩短世界书名称后保存，再重新发送消息。",
        code: "world_book_name_too_long",
      }),
    };
  }
  if (!content) {
    return {
      ok: false,
      error: connectionError({
        title: "世界书内容为空",
        message: "角色绑定的世界书没有可发送的内容。",
        nextStep: "打开角色编辑，重新选择一本有内容的世界书后再发送。",
        code: "missing_world_book_content",
      }),
    };
  }
  if (content.length > MAX_WORLD_BOOK_CONTENT_LENGTH) {
    return {
      ok: false,
      error: connectionError({
        title: "世界书内容过长",
        message: `世界书内容不能超过 ${MAX_WORLD_BOOK_CONTENT_LENGTH} 个字符。`,
        nextStep: "精简世界书内容后保存，再重新发送消息。",
        code: "world_book_content_too_long",
      }),
    };
  }

  return {
    ok: true,
    value: {
      name,
      content,
    },
  };
}

function normalizeUserProfileForPrompt(userProfile) {
  if (userProfile === undefined) {
    return { ok: true, value: null };
  }
  if (
    !userProfile ||
    typeof userProfile !== "object" ||
    Array.isArray(userProfile)
  ) {
    return {
      ok: false,
      error: connectionError({
        title: "本人资料格式不正确",
        message: "聊天请求里的本人资料必须是包含名字和人设的记录。",
        nextStep: "打开主屏幕“我”，重新选择当前本人资料后再发送。",
        code: "invalid_user_profile",
      }),
    };
  }

  const name =
    typeof userProfile.name === "string" ? userProfile.name.trim() : "";
  const persona =
    typeof userProfile.persona === "string"
      ? userProfile.persona.trim()
      : "";

  if (!name) {
    return {
      ok: false,
      error: connectionError({
        title: "本人资料名字为空",
        message: "当前本人资料没有名字。",
        nextStep: "打开主屏幕“我”，编辑当前资料并填写名字后再发送。",
        code: "missing_user_profile_name",
      }),
    };
  }
  if (name.length > MAX_USER_PROFILE_NAME_LENGTH) {
    return {
      ok: false,
      error: connectionError({
        title: "本人资料名字过长",
        message: `本人资料名字不能超过 ${MAX_USER_PROFILE_NAME_LENGTH} 个字符。`,
        nextStep: "打开主屏幕“我”，缩短当前资料名字后再发送。",
        code: "user_profile_name_too_long",
      }),
    };
  }
  if (!persona) {
    return {
      ok: false,
      error: connectionError({
        title: "本人人设为空",
        message: "当前本人资料没有可发送的人设内容。",
        nextStep: "打开主屏幕“我”，编辑当前资料并填写人设后再发送。",
        code: "missing_user_profile_persona",
      }),
    };
  }
  if (persona.length > MAX_USER_PROFILE_PERSONA_LENGTH) {
    return {
      ok: false,
      error: connectionError({
        title: "本人人设过长",
        message: `本人人设不能超过 ${MAX_USER_PROFILE_PERSONA_LENGTH} 个字符。`,
        nextStep: "打开主屏幕“我”，精简当前资料人设后再发送。",
        code: "user_profile_persona_too_long",
      }),
    };
  }

  return {
    ok: true,
    value: {
      name,
      persona,
    },
  };
}

function resolveChatEndpoint(apiUrl) {
  const trimmed = String(apiUrl || "").trim();
  if (!trimmed) {
    throw new Error("接口地址不能为空。");
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("接口地址格式不正确，应以 http:// 或 https:// 开头。");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("接口地址只支持 http:// 或 https://。");
  }
  if (url.username || url.password) {
    throw new Error("接口地址不能包含用户名或密码。");
  }

  let pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  if (!pathname) {
    pathname = "/v1/chat/completions";
  } else if (!pathname.endsWith("/chat/completions")) {
    if (
      pathname.endsWith("/v1") ||
      pathname.endsWith("/compatible-mode/v1") ||
      pathname.endsWith("/api/v1")
    ) {
      pathname = `${pathname}/chat/completions`;
    } else if (pathname.endsWith("/chat")) {
      pathname = `${pathname}/completions`;
    } else {
      pathname = `${pathname}/chat/completions`;
    }
  }

  url.pathname = pathname;
  url.hash = "";
  return {
    endpoint: url.toString(),
    endpointLabel: pathname,
  };
}

function normalizeProviderMessages(messages) {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 21) {
    return {
      ok: false,
      error: connectionError({
        title: "聊天记录数量不合适",
        message: "一次只能提交当前消息和最近 20 条聊天记录。",
        nextStep: "缩短最近聊天记录后再发送。",
        code: "invalid_messages",
      }),
    };
  }

  const normalized = [];
  let hasUserMessage = false;
  for (const message of messages) {
    if (!message) continue;
    const role = String(message.role || "");
    const content = typeof message.content === "string" ? message.content : "";
    if ((role !== "user" && role !== "assistant") || !content.trim()) {
      continue;
    }
    if (content.length > 16000) {
      return {
        ok: false,
        error: connectionError({
          title: "消息内容过长",
          message: "单条消息不能超过 16000 个字符。",
          nextStep: "缩短这条消息后再发送。",
          code: "message_too_long",
        }),
      };
    }
    if (role === "user") hasUserMessage = true;
    normalized.push({ role, content });
  }

  if (!hasUserMessage) {
    return {
      ok: false,
      error: connectionError({
        title: "没有可发送的用户消息",
        message: "聊天请求里没有有效的用户消息。",
        nextStep: "在输入框里重新输入一条消息后发送。",
        code: "missing_user_message",
      }),
    };
  }

  return { ok: true, messages: normalized };
}

function buildChatMessages({
  characterName,
  persona,
  userProfile,
  worldBook,
  messages,
}) {
  const safeCharacterName = String(characterName || "").trim();
  const safePersona = String(persona || "").trim();

  if (!safeCharacterName) {
    return {
      ok: false,
      error: connectionError({
        title: "角色名字为空",
        message: "聊天请求没有包含角色名字。",
        nextStep: "打开聊天页右上角的角色编辑，填写名字后保存。",
        code: "missing_character_name",
      }),
    };
  }
  if (safeCharacterName.length > 24) {
    return {
      ok: false,
      error: connectionError({
        title: "角色名字过长",
        message: "角色名字不能超过 24 个字符。",
        nextStep: "缩短角色名字后保存，再重新发送消息。",
        code: "character_name_too_long",
      }),
    };
  }
  if (!safePersona) {
    return {
      ok: false,
      error: connectionError({
        title: "角色人设为空",
        message: "聊天请求没有包含角色人设。",
        nextStep: "打开聊天页右上角的角色编辑，填写人设后保存。",
        code: "missing_persona",
      }),
    };
  }
  if (safePersona.length > 4000) {
    return {
      ok: false,
      error: connectionError({
        title: "角色人设过长",
        message: "人设超过 4000 个字符。",
        nextStep: "精简角色人设后保存，再重新发送消息。",
        code: "persona_too_long",
      }),
    };
  }

  const normalizedUserProfile = normalizeUserProfileForPrompt(userProfile);
  if (!normalizedUserProfile.ok) return normalizedUserProfile;

  const normalizedWorldBook = normalizeWorldBookForPrompt(worldBook);
  if (!normalizedWorldBook.ok) return normalizedWorldBook;

  const normalized = normalizeProviderMessages(messages);
  if (!normalized.ok) return normalized;

  const userProfilePrompt = normalizedUserProfile.value
    ? `\n\n用户本人设定：\n名字：${normalizedUserProfile.value.name}\n人设：${normalizedUserProfile.value.persona}\n这是用户本人设定，只用于理解用户身份；角色不能代替用户说话。`
    : "";
  const worldBookPrompt = normalizedWorldBook.value
    ? `\n\n世界书名称：${normalizedWorldBook.value.name}\n世界书内容：${normalizedWorldBook.value.content}`
    : "";

  return {
    ok: true,
    messages: [
      {
        role: "system",
        content:
          `角色名字：${safeCharacterName}\n${safePersona}${userProfilePrompt}${worldBookPrompt}\n\n` +
          `输出要求：\n${CHAT_OUTPUT_RULES}`,
      },
      ...normalized.messages,
    ],
  };
}

function getProviderErrorMessage(body) {
  const text = String(body || "").trim();
  if (!text) return "";
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed.error === "string") return parsed.error;
    if (parsed.error && parsed.error.message) return String(parsed.error.message);
    if (parsed.message) return String(parsed.message);
    return text;
  } catch {
    return text;
  }
}

function isOutputBudgetError(message) {
  const hasBudgetName =
    /max(?:imum)?\s+output\s+tokens?|max_output_tokens|max_completion_tokens|max_tokens|thinking\s+budget/i.test(
      message,
    );
  const hasExhaustionSignal =
    /exhaust(?:ed|ion)?|ran\s+out|used\s+up|not\s+enough|empty\s+response|before\s+any\s+answer|no\s+answer|no\s+output|finish_reason\s*=\s*max_tokens|\braise\b|\bincrease\b|\bhigher\b/i.test(
      message,
    );
  return hasBudgetName && hasExhaustionSignal;
}

function providerHttpError(status, body, endpointLabel, apiKey) {
  const providerMessage = protectMessage(getProviderErrorMessage(body), apiKey);
  const displayMessage = providerMessage || "服务商没有提供详细错误信息。";

  if (isOutputBudgetError(displayMessage)) {
    return connectionError({
      title: "模型输出预算不足",
      message: `服务商已经收到请求，但模型的思考过程在生成答复前耗尽了输出预算。服务商原文：${displayMessage}`,
      nextStep:
        "这不是 API Key、接口地址或权限错误。请在服务商控制台或网关中提高 max_output_tokens / thinking budget；如果当前模型是推理模型，也可以先换用普通对话模型再测试。",
      status,
      code: "model_output_budget",
    });
  }

  if (status === 400) {
    return connectionError({
      title: "请求参数被服务商拒绝",
      message: displayMessage,
      nextStep:
        "重点检查模型名是否与服务商文档完全一致，并确认该模型支持 chat/completions 接口。",
      status,
      code: "http_400",
    });
  }
  if (status === 401) {
    return connectionError({
      title: "API Key 未通过验证",
      message: displayMessage,
      nextStep:
        "重新复制完整 API Key，确认没有空格或引号；再到服务商控制台确认 Key 已启用且账户状态正常。",
      status,
      code: "http_401",
    });
  }
  if (status === 403) {
    return connectionError({
      title: "当前 Key 没有调用权限",
      message: displayMessage,
      nextStep:
        "检查该 Key 是否开通了对应模型，或服务商是否要求额外权限、IP 白名单、项目 ID 或云端调用授权。",
      status,
      code: "http_403",
    });
  }
  if (status === 404) {
    return connectionError({
      title: "接口地址或模型不存在",
      message: `${displayMessage}\n实际请求路径：${endpointLabel}`,
      nextStep:
        "接口地址请只填服务商文档中的 Base URL（常见以 /v1 结尾），或完整填入以 /chat/completions 结尾的地址，二选一，不要填写网页登录地址。模型名必须填写文档中的模型 ID。",
      status,
      code: "http_404",
    });
  }
  if (status === 429) {
    return connectionError({
      title: "请求过多或额度不足",
      message: displayMessage,
      nextStep: "检查账户余额和限流设置，等待几分钟后再测试。",
      status,
      code: "http_429",
    });
  }
  if (status >= 500) {
    return connectionError({
      title: "服务商暂时不可用",
      message: displayMessage,
      nextStep:
        "这不是你填写错误造成的。稍后再试，并查看服务商状态页是否发布故障通知。",
      status,
      code: `http_${status}`,
    });
  }

  return connectionError({
    title: "服务商拒绝了请求",
    message: displayMessage,
    nextStep:
      "检查接口地址、API Key 和模型名是否来自同一家服务商和同一个项目。",
    status,
    code: `http_${status}`,
  });
}

function transportError(result, endpointLabel) {
  const raw = result.transportError || {};
  const code = String(raw.code || "network");
  const common = {
    status: 0,
    code,
    retryable: Boolean(raw.retryable),
  };

  if (code === "timeout") {
    return connectionError({
      ...common,
      title: "连接超时",
      message:
        "云端接口在 50 秒内没有收到模型服务商的完整响应。请求可能已经到达服务商，但答复没有及时返回。",
      nextStep:
        "先在服务商控制台确认账户和服务状态；推理模型可改用普通对话模型。若反复超时，请检查服务商是否允许来自云服务器的请求。",
    });
  }
  if (code === "dns") {
    return connectionError({
      ...common,
      title: "找不到接口服务器",
      message: "云端无法解析接口地址中的域名。",
      nextStep:
        "检查接口地址中的域名是否复制正确，并确认该地址能在公共网络访问。",
    });
  }
  if (code === "connection_refused") {
    return connectionError({
      ...common,
      title: "接口服务器拒绝连接",
      message: "接口服务器拒绝了云端的连接。",
      nextStep:
        "确认接口地址、端口和协议与服务商文档一致；服务商维护期间也可能暂时拒绝连接。",
    });
  }
  if (code === "certificate") {
    return connectionError({
      ...common,
      title: "接口证书验证失败",
      message: "云端无法验证接口地址的 HTTPS 证书。",
      nextStep:
        "先从服务商文档重新复制正式接口域名，不要填写测试域名、自签名地址或错误信息里的远端 IP。",
    });
  }
  if (code === "socket_permission") {
    return connectionError({
      ...common,
      title: "云端网络权限阻止了连接",
      message: "云端运行环境没有获得访问该接口地址的网络权限。",
      nextStep:
        "确认接口地址是公开的 HTTPS 地址，并检查服务商是否限制云服务器出口或要求 IP 白名单。",
    });
  }
  if (code === "connection_reset") {
    return connectionError({
      ...common,
      title: "云端无法连接模型服务商",
      message:
        "与模型服务商的 HTTPS 连接被远端中断，请求没有获得完整响应。页面本身和 Vercel 服务均正常。",
      nextStep:
        "确认服务商接受来自云服务器的请求，并检查是否启用了 IP 白名单、地区限制、防火墙或反机器人策略。不要先把问题归因于 API Key。",
    });
  }

  return connectionError({
    ...common,
    title: "云端无法访问接口地址",
    message: protectMessage(raw.message || "云端网络请求没有完成。"),
    nextStep: `检查接口地址是否完整、服务商是否允许云端访问；实际请求路径：${endpointLabel}。`,
  });
}

function parseReplyText(payload) {
  const choices = Array.isArray(payload && payload.choices) ? payload.choices : [];
  const firstChoice = choices[0];
  const message = firstChoice && firstChoice.message;
  const content = message && message.content;

  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  if (payload && typeof payload.output_text === "string") {
    return payload.output_text.trim();
  }
  return "";
}

async function invokeProvider({
  apiUrl,
  apiKey,
  modelName,
  messages,
}) {
  let resolved;
  try {
    resolved = resolveChatEndpoint(apiUrl);
  } catch (error) {
    return {
      status: 400,
      payload: {
        ok: false,
        error: connectionError({
          title: "接口地址格式不正确",
          message: String(error.message || "接口地址格式不正确。"),
          nextStep:
            "检查地址是否以 http:// 或 https:// 开头，再从服务商文档复制一次。",
          code: "invalid_url",
        }),
      },
    };
  }

  const requestBody = JSON.stringify({
    model: String(modelName).trim(),
    messages,
    stream: false,
  });
  const startedAt = Date.now();
  const result = await requestWithRecovery({
    url: resolved.endpoint,
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${String(apiKey).trim()}`,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(requestBody, "utf8"),
      "User-Agent": "YingXingYu/1.0",
    },
    body: requestBody,
    timeoutMs: PROVIDER_TIMEOUT_MS,
    secrets: [String(apiKey).trim()],
  });
  const latencyMs = Date.now() - startedAt;

  if (!result.ok) {
    return {
      status: result.transportError && result.transportError.code === "timeout" ? 504 : 502,
      payload: {
        ok: false,
        error: transportError(result, resolved.endpointLabel),
      },
    };
  }

  if (result.statusCode < 200 || result.statusCode >= 300) {
    return {
      status: result.statusCode,
      payload: {
        ok: false,
        error: providerHttpError(
          result.statusCode,
          result.body,
          resolved.endpointLabel,
          String(apiKey).trim(),
        ),
      },
    };
  }

  let payload;
  try {
    payload = JSON.parse(result.body);
  } catch {
    return {
      status: 502,
      payload: {
        ok: false,
        error: connectionError({
          title: "返回格式不符合预期",
          message:
            "服务商返回了成功状态，但内容不是标准 JSON。请确认接口地址指向 chat/completions，而不是网页或控制台页面。",
          nextStep:
            "从服务商文档重新复制 OpenAI 兼容接口地址；如果文档使用其他协议，需要增加专用适配。",
          code: "invalid_response",
        }),
      },
    };
  }

  const reply = parseReplyText(payload);
  if (!reply) {
    if (isOutputBudgetError(result.body)) {
      return {
        status: 502,
        payload: {
          ok: false,
          error: providerHttpError(
            result.statusCode,
            result.body,
            resolved.endpointLabel,
            String(apiKey).trim(),
          ),
        },
      };
    }
    return {
      status: 502,
      payload: {
        ok: false,
        error: connectionError({
          title: "模型没有返回文字",
          message:
            "服务商返回了有效 JSON，但 choices[0].message.content 为空。",
          nextStep:
            "确认模型支持 chat/completions，或换用普通对话模型后点击重试按钮。",
          code: "empty_reply",
        }),
      },
    };
  }

  return {
    status: result.statusCode,
    payload: {
      ok: true,
      status: result.statusCode,
      model:
        payload && typeof payload.model === "string" && payload.model.trim()
          ? payload.model.trim()
          : String(modelName).trim(),
      latencyMs,
      endpoint: resolved.endpointLabel,
      reply: protectMessage(reply, String(apiKey).trim()),
    },
  };
}

async function readJsonBody(request) {
  if (request.body !== undefined) {
    if (Buffer.byteLength(JSON.stringify(request.body), "utf8") > MAX_BODY_BYTES) {
      const error = new Error("body_too_large");
      error.code = "body_too_large";
      throw error;
    }
    if (typeof request.body === "string") {
      try {
        return JSON.parse(request.body);
      } catch {
        const error = new Error("invalid_json");
        error.code = "invalid_json";
        throw error;
      }
    }
    if (request.body && typeof request.body === "object") {
      return request.body;
    }
  }

  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > MAX_BODY_BYTES) {
      const error = new Error("body_too_large");
      error.code = "body_too_large";
      throw error;
    }
    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("invalid_json");
    error.code = "invalid_json";
    throw error;
  }
}

function setResponseHeaders(response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
}

function sendJson(response, status, payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  setResponseHeaders(response);
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Length", body.length);
  response.end(body);
}

function validateConfig(body) {
  if (
    !body ||
    !String(body.apiUrl || "").trim() ||
    !String(body.apiKey || "").trim() ||
    !String(body.modelName || "").trim()
  ) {
    return connectionError({
      title: "API 配置不完整",
      message: "接口地址、API Key 和模型名都必须存在。",
      nextStep: "回到设置页补齐三个字段，并重新测试连接。",
      code: "incomplete_config",
    });
  }
  return null;
}

async function handleProviderRequest(request, response, mode) {
  if (String(request.method || "POST").toUpperCase() !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, {
      ok: false,
      error: connectionError({
        title: "请求方式不正确",
        message: "这个接口只接受 POST 请求。",
        nextStep: "返回濴星语页面重新操作。",
        code: "method_not_allowed",
      }),
    });
    return;
  }

  let body;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    const tooLarge = error && error.code === "body_too_large";
    sendJson(response, tooLarge ? 413 : 400, {
      ok: false,
      error: connectionError({
        title: tooLarge ? "提交内容过大" : "请求格式不正确",
        message: tooLarge
          ? "本次提交的内容超过云端接口的安全限制。"
          : "页面提交的数据不是有效 JSON。",
        nextStep: tooLarge
          ? "缩短角色人设或最近聊天记录后再试。"
          : "刷新页面后重新操作。",
        code: tooLarge ? "request_too_large" : "invalid_json",
      }),
    });
    return;
  }

  const configError = validateConfig(body);
  if (configError) {
    sendJson(response, 400, { ok: false, error: configError });
    return;
  }

  let messages;
  if (mode === "test") {
    messages = [{ role: "user", content: TEST_PROMPT }];
  } else {
    const chat = buildChatMessages({
      characterName: body.characterName,
      persona: body.persona,
      userProfile: body.userProfile,
      worldBook: body.worldBook,
      messages: body.messages,
    });
    if (!chat.ok) {
      sendJson(response, 400, { ok: false, error: chat.error });
      return;
    }
    messages = chat.messages;
  }

  const result = await invokeProvider({
    apiUrl: body.apiUrl,
    apiKey: body.apiKey,
    modelName: body.modelName,
    messages,
  });
  sendJson(response, result.status, result.payload);
}

async function healthHandler(request, response) {
  if (!["GET", "HEAD"].includes(String(request.method || "GET").toUpperCase())) {
    response.setHeader("Allow", "GET, HEAD");
    sendJson(response, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  const payload = {
    ok: true,
    build: BUILD,
    serverTime: new Date().toISOString(),
    mode: "vercel",
    region: String(process.env.VERCEL_REGION || ""),
  };
  if (String(request.method).toUpperCase() === "HEAD") {
    setResponseHeaders(response);
    response.statusCode = 200;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end();
    return;
  }
  sendJson(response, 200, payload);
}

module.exports = {
  BUILD,
  buildChatMessages,
  handleProviderRequest,
  healthHandler,
  invokeProvider,
  isOutputBudgetError,
  normalizeProviderMessages,
  normalizeUserProfileForPrompt,
  parseReplyText,
  protectMessage,
  providerHttpError,
  resolveChatEndpoint,
};
