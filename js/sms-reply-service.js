"use strict";

((root) => {
  function createReplyService(options = {}) {
    const model = options.model;
    const store = options.store;
    const client = options.client;
    const storage = options.storage;
    const getApiSettings =
      typeof options.getApiSettings === "function"
        ? options.getApiSettings
        : () => root.PocketLabSettings?.readApiSettings?.() || {};
    const getProfileById =
      typeof options.getProfileById === "function"
        ? options.getProfileById
        : (id) =>
            root.PocketLabSelfProfileApp?.getProfileById?.(id) || null;
    const getActiveProfile =
      typeof options.getActiveProfile === "function"
        ? options.getActiveProfile
        : () => root.PocketLabSelfProfileApp?.getActiveProfile?.() || null;
    const normalizeError =
      typeof options.normalizeError === "function"
        ? options.normalizeError
        : (error) => error;

    if (!model || !store || !client || !storage) {
      throw new Error("短信回复流程缺少必要组件。");
    }

    async function buildRequest(record, messages = []) {
      const character = await storage.getCharacter(record.characterId);
      if (!character) {
        throw createFailure(
          "角色资料已不存在",
          "这条短信对应的角色已经被删除，无法继续读取人设和聊天记录。",
          "保留记录即可；如需继续短信对话，请重新添加角色。",
        );
      }

      const settings = getApiSettings() || {};
      const apiUrl = String(settings.apiUrl || "").trim();
      const apiKey = String(settings.apiKey || "").trim();
      const modelName = String(settings.modelName || "").trim();
      if (!apiUrl || !apiKey || !modelName) {
        const missing = [
          !apiUrl ? "接口地址" : "",
          !apiKey ? "API Key" : "",
          !modelName ? "模型名" : "",
        ].filter(Boolean);
        throw createFailure(
          "尚未完成 API 配置",
          `缺少${missing.join("、")}，本次短信没有发送到模型服务。`,
          "回到主屏幕打开“设置”，补齐 API 配置并完成连接测试，然后回到短信页点击“重试”。",
        );
      }

      let worldBook = null;
      if (character.worldBookId) {
        worldBook = await storage.getWorldBook(character.worldBookId);
        if (!worldBook) {
          throw createFailure(
            "角色绑定的世界书不存在",
            "本次短信没有调用模型，因为角色编辑中绑定的世界书已经找不到。",
            "打开角色编辑，重新选择世界书或改为“不绑定世界书”，再回来点击“重试”。",
          );
        }
      }

      const chatMessages = await storage.getMessages(character.id);
      const selectedProfileId =
        typeof character.selfProfileId === "string"
          ? character.selfProfileId.trim()
          : "";
      const selectedProfile = selectedProfileId
        ? getProfileById(selectedProfileId)
        : null;
      const userProfile = selectedProfile || getActiveProfile() || null;
      const request = {
        config: {
          apiUrl,
          apiKey,
          modelName,
        },
        character,
        messages: chatMessages,
        worldBook,
        userProfile,
        kind: record.kind,
      };

      if (record.kind === model.KIND.MESSAGE) {
        const characterMessages = (Array.isArray(messages) ? messages : [])
          .filter(
            (message) => message.characterId === record.characterId,
          );
        const sourceMessage = characterMessages.find(
          (message) =>
            message.id === record.replyToId &&
            message.role === model.ROLE.USER &&
            message.status === model.STATUS.SENT &&
            Boolean(message.content),
        );
        if (!sourceMessage) {
          throw createFailure(
            "找不到要回复的短信",
            "这条角色回复关联的你的短信已经不存在，无法重新生成。",
            "返回短信对话，重新输入并发送一条短信。",
          );
        }

        request.smsText = sourceMessage.content;
        request.smsMessages = characterMessages;
        request.excludeSmsRecordIds = [record.id, sourceMessage.id];
      }

      return request;
    }

    async function generate(record, messages = [], generateOptions = {}) {
      const normalized = model.normalizeSmsRecord(record);
      if (!normalized || normalized.role !== model.ROLE.ASSISTANT) {
        throw new Error("只有角色短信可以进入生成流程。");
      }

      const readAt = generateOptions.isReading ? Date.now() : 0;
      try {
        const request = await buildRequest(normalized, messages);
        const result =
          normalized.kind === model.KIND.APOLOGY
            ? await client.generateApology(request)
            : await client.generateMessage(request);
        const data = await store.update(normalized.id, (current) => ({
          ...current,
          content: result.content,
          status: model.STATUS.SENT,
          error: null,
          readAt,
          updatedAt: Date.now(),
        }));
        return {
          ok: true,
          data,
          record: findRecord(data, normalized.id),
        };
      } catch (error) {
        const failure = describeGenerationError(
          error,
          normalized.kind,
        );
        try {
          const data = await store.update(normalized.id, (current) => ({
            ...current,
            content: "",
            status: model.STATUS.FAILED,
            error: failure,
            readAt,
            updatedAt: Date.now(),
          }));
          return {
            ok: false,
            data,
            record: findRecord(data, normalized.id),
            failure,
          };
        } catch (storageError) {
          storageError.smsFailure = failure;
          throw storageError;
        }
      }
    }

    function describeGenerationError(error, kind = model.KIND.MESSAGE) {
      const isApology = kind === model.KIND.APOLOGY;
      const subject = isApology ? "道歉短信" : "短信回复";
      if (error?.smsFailure) {
        return normalizeFailure(error.smsFailure);
      }
      if (error?.name === "AbortError") {
        return normalizeFailure({
          title: `${subject}生成超时`,
          message: `等待模型服务超过约 ${Math.round(
            client.DEFAULT_TIMEOUT_MS / 1000,
          )} 秒，没有收到完整短信。`,
          nextStep:
            "检查网络和服务商状态后点击“重试”；若连续超时，可换用响应更快的普通对话模型。",
          status: 0,
        });
      }

      const source = error?.apiError
        ? {
            ...error.apiError,
            status: error.status || error.apiError.status,
          }
        : {
            title: `${subject}生成失败`,
            message:
              error?.message || "短信生成服务没有返回可用结果。",
            nextStep:
              "先确认电脑入口仍能打开，再到设置页运行连接测试；完成后回到这里点击“重试”。",
            status: Number(error?.status) || 0,
          };
      const normalized = normalizeError(source);
      return normalizeFailure({
        ...source,
        ...normalized,
        status:
          Number(source.status) ||
          Number(normalized?.status) ||
          0,
      });
    }

    return Object.freeze({
      buildRequest,
      generate,
      describeGenerationError,
    });
  }

  function findRecord(data, recordId) {
    return (
      data.messages.find((record) => record.id === recordId) || null
    );
  }

  function normalizeFailure(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      title: String(source.title || "短信生成失败").slice(0, 200),
      message: String(
        source.message || "模型服务没有返回可显示的文字。",
      ).slice(0, 1600),
      nextStep: String(
        source.nextStep ||
          "检查 API 设置和网络后，在短信页面点击“重试”。",
      ).slice(0, 1600),
      status: Math.max(0, Number(source.status) || 0),
    };
  }

  function createFailure(title, message, nextStep) {
    const error = new Error(message);
    error.name = "SmsFailure";
    error.smsFailure = { title, message, nextStep, status: 0 };
    return error;
  }

  root.PocketLabSmsReply = Object.freeze({
    create: createReplyService,
    normalizeFailure,
  });
})(window);
