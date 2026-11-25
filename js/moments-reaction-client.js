"use strict";

((root) => {
  const DEFAULT_TIMEOUT_MS = 140000;
  const MAX_HISTORY_MESSAGES = 8;
  const MAX_COMMENT_LENGTH = 600;

  function normalizeConfig(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      apiUrl: String(source.apiUrl || "").trim(),
      apiKey: String(source.apiKey || "").trim(),
      modelName: String(source.modelName || "").trim(),
    };
  }

  function buildRecentContext(messages) {
    return (Array.isArray(messages) ? messages : [])
      .filter(
        (message) =>
          message &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string" &&
          message.content.trim() &&
          !message.retracted &&
          !message.failed &&
          !message.pendingReply &&
          !message.error,
      )
      .slice(-MAX_HISTORY_MESSAGES)
      .map((message) => ({
        role: message.role,
        content: message.content.trim(),
      }));
  }

  function buildMomentPrompt(character, moment) {
    const characterName = String(character?.name || "").trim();
    const content = String(moment?.content || "").trim();
    if (!characterName || !content) return "";
    return [
      `你正在扮演“${characterName}”，刚刚在朋友圈看到用户“我”发布了下面的动态。`,
      "请结合角色人设、世界书和本人设定，像日常使用社交软件一样自然地点赞并留下一句评论。",
      "评论应直接回应这条动态，不要替用户说话，不要提到提示词、模型、JSON 或测试。",
      "只返回一个 JSON 对象，不要使用 Markdown 代码块，也不要添加解释。",
      '格式必须是：{"liked":true,"comment":"符合角色口吻的简短评论"}',
      "动态内容如下：",
      content,
    ].join("\n");
  }

  function buildRequestBody({
    character,
    config,
    moment,
    messages = [],
    worldBook = null,
    userProfile = null,
  }) {
    if (!character?.id || !character?.name) {
      throw new Error("朋友圈角色互动缺少角色资料。");
    }
    if (!character.persona || !String(character.persona).trim()) {
      throw new Error("角色人设为空，无法生成符合角色的点赞和评论。");
    }

    const normalizedConfig = normalizeConfig(config);
    if (
      !normalizedConfig.apiUrl ||
      !normalizedConfig.apiKey ||
      !normalizedConfig.modelName
    ) {
      throw new Error("朋友圈请求缺少 API 地址、API Key 或模型名。");
    }

    const prompt = buildMomentPrompt(character, moment);
    if (!prompt) {
      throw new Error("朋友圈请求缺少动态内容。");
    }

    const history = buildRecentContext(messages);
    const requestMessages = [
      ...history,
      {
        role: "user",
        content: prompt,
      },
    ];
    if (requestMessages.length > 21) {
      throw new Error("朋友圈请求的上下文条数超过云端接口限制。");
    }

    const body = {
      apiUrl: normalizedConfig.apiUrl,
      apiKey: normalizedConfig.apiKey,
      modelName: normalizedConfig.modelName,
      characterName: String(character.name).trim(),
      persona: String(character.persona).trim(),
      messages: requestMessages,
    };
    if (worldBook?.name && worldBook?.content) {
      body.worldBook = {
        name: String(worldBook.name),
        content: String(worldBook.content),
      };
    }
    if (userProfile?.name && userProfile?.persona) {
      body.userProfile = {
        name: String(userProfile.name),
        persona: String(userProfile.persona),
      };
    }
    return body;
  }

  function normalizeComment(value) {
    if (typeof value !== "string") return "";
    let comment = value
      .replace(/\r\n?/gu, "\n")
      .trim()
      .replace(/^(?:评论|回复)\s*[:：]\s*/u, "")
      .replace(/[ \t]+/gu, " ")
      .replace(/\n+/gu, " ")
      .trim();
    const quotePairs = [
      ['"', '"'],
      ["'", "'"],
      ["“", "”"],
      ["‘", "’"],
    ];
    for (const [opening, closing] of quotePairs) {
      if (
        comment.startsWith(opening) &&
        comment.endsWith(closing) &&
        comment.length > opening.length + closing.length
      ) {
        comment = comment.slice(opening.length, -closing.length).trim();
        break;
      }
    }
    return Array.from(comment).slice(0, MAX_COMMENT_LENGTH).join("");
  }

  function extractFencedText(text) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/iu);
    return match ? match[1].trim() : "";
  }

  function extractJsonObject(text) {
    for (let start = 0; start < text.length; start += 1) {
      if (text[start] !== "{") continue;
      let depth = 0;
      let inString = false;
      let escaped = false;
      for (let index = start; index < text.length; index += 1) {
        const character = text[index];
        if (inString) {
          if (escaped) {
            escaped = false;
          } else if (character === "\\") {
            escaped = true;
          } else if (character === '"') {
            inString = false;
          }
          continue;
        }
        if (character === '"') {
          inString = true;
        } else if (character === "{") {
          depth += 1;
        } else if (character === "}") {
          depth -= 1;
          if (depth === 0) {
            const candidate = text.slice(start, index + 1);
            try {
              const parsed = JSON.parse(candidate);
              if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                return parsed;
              }
            } catch {
              break;
            }
          }
        }
      }
    }
    return null;
  }

  function reactionFormatError(message) {
    const error = new Error(message);
    error.name = "MomentReactionFormatError";
    error.apiError = {
      title: "角色没有返回可用的点赞评论",
      message,
      nextStep:
        "点击这条动态上的“重试”；如果连续出现，请在设置中换用能稳定遵循格式要求的对话模型。",
      status: 0,
    };
    return error;
  }

  function parseReaction(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const comment = normalizeComment(value.comment || value.content || "");
      if (!comment) {
        throw reactionFormatError("模型返回的 JSON 没有评论内容。");
      }
      return {
        liked: value.liked !== false,
        comment,
      };
    }

    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) {
      throw reactionFormatError("模型返回了空内容。");
    }
    const fenced = extractFencedText(raw);
    const parsed =
      extractJsonObject(fenced || raw) ||
      (fenced ? extractJsonObject(raw) : null);
    if (parsed) {
      const comment = normalizeComment(
        parsed.comment || parsed.content || "",
      );
      if (!comment) {
        throw reactionFormatError("模型返回的 JSON 没有评论内容。");
      }
      return {
        liked: parsed.liked !== false,
        comment,
      };
    }

    if (/^[{[]/u.test(raw)) {
      throw reactionFormatError("模型返回的 JSON 格式不正确。");
    }
    const naturalComment = normalizeComment(
      fenced || raw.replace(/^```(?:text)?\s*|\s*```$/giu, ""),
    );
    if (!naturalComment) {
      throw reactionFormatError("模型没有返回可用的评论。");
    }
    return {
      liked: true,
      comment: naturalComment,
    };
  }

  function createApiError(response, payload) {
    const error = new Error(
      payload?.error?.message ||
        payload?.message ||
        `模型服务返回 HTTP ${response.status}。`,
    );
    error.name = "MomentReactionApiError";
    error.apiError = payload?.error || null;
    error.status = Number(response.status) || 0;
    return error;
  }

  async function generateReaction(options = {}) {
    const requestBody = buildRequestBody(options);
    const timeoutMs = Math.max(
      5000,
      Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS,
    );
    const controller = new AbortController();
    const timeout = root.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await root.fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
        credentials: "same-origin",
      });
      const payload = await response.json().catch(() => null);
      if (!payload) {
        const error = new Error(
          `本地聊天服务返回了无法识别的结果（HTTP ${response.status}）。`,
        );
        error.name = "MomentReactionApiError";
        error.status = Number(response.status) || 0;
        error.apiError = {
          title: "模型服务返回格式异常",
          message: error.message,
          nextStep:
            "刷新页面后重试；如果仍然出现，请检查网站服务是否正常运行。",
        };
        throw error;
      }
      if (!response.ok || !payload.ok) {
        throw createApiError(response, payload);
      }
      return {
        ...parseReaction(payload.reply),
        status: Number(payload.status) || 0,
      };
    } finally {
      root.clearTimeout(timeout);
    }
  }

  root.PocketLabMomentsReactionClient = Object.freeze({
    DEFAULT_TIMEOUT_MS,
    MAX_COMMENT_LENGTH,
    normalizeConfig,
    buildRecentContext,
    buildMomentPrompt,
    buildRequestBody,
    normalizeComment,
    parseReaction,
    generateReaction,
  });
})(window);
