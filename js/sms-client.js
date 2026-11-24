"use strict";

((root) => {
  const model = root.PocketLabSmsModel;
  const DEFAULT_TIMEOUT_MS = 140000;

  function normalizeConfig(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      apiUrl: String(source.apiUrl || "").trim(),
      apiKey: String(source.apiKey || "").trim(),
      modelName: String(source.modelName || "").trim(),
    };
  }

  function buildRequestBody({
    character,
    config,
    messages,
    worldBook = null,
    userProfile = null,
    smsMessages = [],
    smsText = "",
    excludeSmsRecordIds = [],
    kind = model?.KIND?.APOLOGY,
  }) {
    if (!model || !character || !character.id || !character.name) {
      throw new Error("短信请求缺少角色资料。");
    }

    const normalizedConfig = normalizeConfig(config);
    if (
      !normalizedConfig.apiUrl ||
      !normalizedConfig.apiKey ||
      !normalizedConfig.modelName
    ) {
      throw new Error("短信请求缺少 API 地址、API Key 或模型名。");
    }

    const isMessageReply = kind === model.KIND.MESSAGE;
    const smsHistory = isMessageReply
      ? model.buildSmsContext(smsMessages, {
          historyLimit: 12,
          excludeIds: excludeSmsRecordIds,
        })
      : [];
    const chatHistory = model.buildChatContext(messages, {
      historyLimit: isMessageReply
        ? Math.max(0, Math.min(8, 19 - smsHistory.length))
        : 20,
    });
    const history = [...chatHistory, ...smsHistory];
    const prompt = isMessageReply
      ? model.buildSmsPrompt(character.name, smsText, {
          hasHistory: history.length > 0,
        })
      : model.buildApologyPrompt(character.name, {
          hasHistory: history.length > 0,
        });
    if (!prompt) {
      throw new Error(
        isMessageReply
          ? "短信请求缺少要回复的用户短信。"
          : "道歉短信请求缺少角色资料。",
      );
    }
    const requestMessages = [
      ...history,
      {
        role: "user",
        content: prompt,
      },
    ];
    if (!requestMessages.length || requestMessages.length > 21) {
      throw new Error("短信请求的历史消息数量无效。");
    }

    const body = {
      apiUrl: normalizedConfig.apiUrl,
      apiKey: normalizedConfig.apiKey,
      modelName: normalizedConfig.modelName,
      characterName: String(character.name).trim(),
      persona: String(character.persona || "").trim(),
      messages: requestMessages,
    };
    if (worldBook?.name && worldBook?.content) {
      body.worldBook = {
        name: worldBook.name,
        content: worldBook.content,
      };
    }
    if (userProfile?.name && userProfile?.persona) {
      body.userProfile = {
        name: userProfile.name,
        persona: userProfile.persona,
      };
    }
    return body;
  }

  function createApiError(response, payload) {
    const error = new Error(
      payload?.error?.message ||
        payload?.message ||
        `模型服务返回 HTTP ${response.status}。`,
    );
    error.name = "SmsApiError";
    error.apiError = payload?.error || null;
    error.status = Number(response.status) || 0;
    return error;
  }

  async function generateMessage(options = {}) {
    const requestBody = buildRequestBody({
      ...options,
      kind: options.kind || model.KIND.MESSAGE,
    });
    const timeoutMs =
      Math.max(5000, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS);
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
        error.name = "SmsApiError";
        error.status = Number(response.status) || 0;
        error.apiError = {
          title: "模型服务返回格式异常",
          message: error.message,
          nextStep: "刷新页面后重试；如果仍然出现，请检查本地服务是否正常运行。",
        };
        throw error;
      }
      if (!response.ok || !payload.ok) {
        throw createApiError(response, payload);
      }

      const content = model.normalizeSmsReply(payload.reply);
      if (!content) {
        const error = new Error("模型没有返回可用的短信文字。");
        error.name = "SmsApiError";
        error.status = Number(payload.status) || 0;
        error.apiError = {
          title: "模型没有返回短信文字",
          message: "服务商完成了请求，但回复内容为空或只有格式说明。",
          nextStep: "点击“重试”；如果连续出现，请换用普通对话模型。",
        };
        throw error;
      }
      return {
        content,
        status: Number(payload.status) || 0,
      };
    } finally {
      root.clearTimeout(timeout);
    }
  }

  function generateApology(options = {}) {
    return generateMessage({
      ...options,
      kind: model.KIND.APOLOGY,
    });
  }

  root.PocketLabSmsClient = Object.freeze({
    DEFAULT_TIMEOUT_MS,
    buildRequestBody,
    generateMessage,
    generateApology,
  });
})(window);
