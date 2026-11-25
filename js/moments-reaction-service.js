"use strict";

((root) => {
  function create(options = {}) {
    const model = options.model || root.PocketLabMomentsModel;
    const store = options.store || root.PocketLabMomentsStore;
    const client = options.client || root.PocketLabMomentsReactionClient;
    const storage = options.storage || root.PocketLabStorage;
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
    const onChange =
      typeof options.onChange === "function" ? options.onChange : () => {};
    const onFailure =
      typeof options.onFailure === "function" ? options.onFailure : () => {};
    const concurrency = Math.max(
      1,
      Math.min(4, Number(options.concurrency) || 2),
    );

    if (!model || !store || !client || !storage) {
      throw new Error("朋友圈角色互动组件没有完成加载。");
    }

    const taskQueue = [];
    const activeKeys = new Set();
    const idleWaiters = [];
    let activeOperations = 0;
    let activeCount = 0;

    function createKey(momentId, characterId) {
      return `${momentId}\u0000${characterId}`;
    }

    function notifyChange(data, detail = {}) {
      try {
        onChange(data, detail);
      } catch {
        // A rendering callback must not turn a successful model request into a failure.
      }
    }

    function resolveIdleIfReady() {
      if (activeOperations || activeCount || taskQueue.length) return;
      while (idleWaiters.length) {
        idleWaiters.shift()();
      }
    }

    function trackOperation(work) {
      activeOperations += 1;
      return Promise.resolve()
        .then(work)
        .finally(() => {
          activeOperations -= 1;
          resolveIdleIfReady();
        });
    }

    function schedule(momentId, characterId) {
      const key = createKey(momentId, characterId);
      if (activeKeys.has(key)) {
        return Promise.resolve({
          ok: false,
          duplicate: true,
          momentId,
          characterId,
        });
      }
      activeKeys.add(key);
      return new Promise((resolve, reject) => {
        taskQueue.push({
          key,
          momentId,
          characterId,
          resolve,
          reject,
        });
        drain();
      });
    }

    function drain() {
      while (activeCount < concurrency && taskQueue.length) {
        const entry = taskQueue.shift();
        activeCount += 1;
        Promise.resolve()
          .then(() => performInteraction(entry.momentId, entry.characterId))
          .then(entry.resolve, entry.reject)
          .finally(() => {
            activeCount -= 1;
            activeKeys.delete(entry.key);
            drain();
            resolveIdleIfReady();
          });
      }
      resolveIdleIfReady();
    }

    function waitForIdle() {
      if (!activeOperations && !activeCount && !taskQueue.length) {
        return Promise.resolve();
      }
      return new Promise((resolve) => idleWaiters.push(resolve));
    }

    async function getMomentOrThrow(momentId) {
      const data = await store.load();
      const moment = model.getMoment(data, momentId);
      if (!moment) {
        throw new Error("要互动的朋友圈已经不存在。");
      }
      return {
        data,
        moment,
      };
    }

    function reactToMoment(momentId) {
      return trackOperation(() => reactToMomentInternal(momentId));
    }

    async function reactToMomentInternal(momentId) {
      const characters = await storage.listCharacters();
      const { data, moment } = await getMomentOrThrow(momentId);
      const existingIds = new Set(
        moment.interactions.map((interaction) => interaction.characterId),
      );
      const now = Date.now();
      const additions = characters
        .filter((character) => character?.id && !existingIds.has(character.id))
        .map((character) =>
          model.createInteraction(
            {
              characterId: character.id,
              characterName: character.name,
            },
            { now },
          ),
        );

      let nextData = data;
      if (additions.length) {
        const result = await store.addInteractions(momentId, additions);
        nextData = result.data;
        notifyChange(nextData, {
          momentId,
          reason: "interactions-added",
        });
      }

      const pendingInteractions =
        model.getMoment(nextData, momentId)?.interactions.filter(
          (interaction) =>
            interaction.status === model.INTERACTION_STATUS.PENDING,
        ) || [];
      const outcomes = await Promise.all(
        pendingInteractions.map((interaction) =>
          schedule(momentId, interaction.characterId),
        ),
      );
      return {
        data: nextData,
        outcomes,
      };
    }

    function retryInteraction(momentId, characterId) {
      return trackOperation(() =>
        retryInteractionInternal(momentId, characterId),
      );
    }

    async function retryInteractionInternal(momentId, characterId) {
      const key = createKey(momentId, characterId);
      if (activeKeys.has(key)) {
        return {
          ok: false,
          duplicate: true,
          momentId,
          characterId,
        };
      }
      const { moment } = await getMomentOrThrow(momentId);
      const interaction = moment.interactions.find(
        (entry) => entry.characterId === characterId,
      );
      if (!interaction) {
        throw new Error("要重试的角色互动已经不存在。");
      }
      if (interaction.status !== model.INTERACTION_STATUS.FAILED) {
        throw new Error("只有失败的角色互动可以重试。");
      }
      const pending = await store.updateInteraction(momentId, characterId, {
        status: model.INTERACTION_STATUS.PENDING,
        liked: false,
        comment: "",
        error: null,
      });
      notifyChange(pending.data, {
        momentId,
        characterId,
        reason: "retry-started",
      });
      return schedule(momentId, characterId);
    }

    async function performInteraction(momentId, characterId) {
      try {
        const [{ data, moment }, character] = await Promise.all([
          getMomentOrThrow(momentId),
          storage.getCharacter(characterId),
        ]);
        const interaction = moment.interactions.find(
          (entry) => entry.characterId === characterId,
        );
        if (!interaction) {
          throw createFailure(
            "角色互动记录不存在",
            "这条动态与角色之间的互动记录已经被删除。",
            "刷新朋友圈后重新查看；如果仍未恢复，请重新发布动态。",
          );
        }
        if (!character) {
          throw createFailure(
            "角色资料已删除",
            `“${interaction.characterName || "这个角色"}”已经不在角色列表中，无法生成点赞和评论。`,
            "重新添加该角色后，再发布新的朋友圈；这条旧互动可以保留或忽略。",
          );
        }

        const settings = getApiSettings() || {};
        const config = {
          apiUrl: String(settings.apiUrl || "").trim(),
          apiKey: String(settings.apiKey || "").trim(),
          modelName: String(settings.modelName || "").trim(),
        };
        if (!config.apiUrl || !config.apiKey || !config.modelName) {
          const missing = [
            !config.apiUrl ? "接口地址" : "",
            !config.apiKey ? "API Key" : "",
            !config.modelName ? "模型名" : "",
          ].filter(Boolean);
          throw createFailure(
            "尚未完成 API 配置",
            `缺少${missing.join("、")}，角色这次没有收到朋友圈内容。`,
            "打开“设置”补齐 API 配置并完成连接测试，然后回到朋友圈点击“重试”。",
          );
        }

        let worldBook = null;
        if (character.worldBookId) {
          worldBook = await storage.getWorldBook(character.worldBookId);
          if (!worldBook) {
            throw createFailure(
              "角色绑定的世界书不存在",
              "这次互动没有调用模型，因为角色编辑中绑定的世界书已经找不到。",
              "打开角色编辑，重新选择世界书或解除绑定，再回到朋友圈点击“重试”。",
            );
          }
        }

        const selectedProfileId =
          typeof character.selfProfileId === "string"
            ? character.selfProfileId.trim()
            : "";
        const selectedProfile = selectedProfileId
          ? getProfileById(selectedProfileId)
          : null;
        const userProfile = selectedProfile || getActiveProfile() || null;
        const messages = await storage.getMessages(character.id);
        const reaction = await client.generateReaction({
          config,
          character,
          moment,
          messages,
          worldBook,
          userProfile,
        });
        const result = await store.updateInteraction(momentId, characterId, {
          liked: reaction.liked,
          comment: reaction.comment,
          status: model.INTERACTION_STATUS.SENT,
          error: null,
        });
        notifyChange(result.data, {
          momentId,
          characterId,
          reason: "interaction-sent",
        });
        return {
          ok: true,
          momentId,
          characterId,
          interaction: result.interaction,
        };
      } catch (error) {
        const failure = describeGenerationError(error, characterId);
        try {
          const result = await store.updateInteraction(momentId, characterId, {
            liked: false,
            comment: "",
            status: model.INTERACTION_STATUS.FAILED,
            error: failure,
          });
          notifyChange(result.data, {
            momentId,
            characterId,
            reason: "interaction-failed",
            failure,
          });
          try {
            onFailure(failure, {
              momentId,
              characterId,
              interaction: result.interaction,
            });
          } catch {
            // Presentation callbacks are best-effort only.
          }
          return {
            ok: false,
            momentId,
            characterId,
            failure,
            interaction: result.interaction,
          };
        } catch (storageError) {
          storageError.momentsReactionFailure = failure;
          throw storageError;
        }
      }
    }

    function describeGenerationError(error, characterId) {
      if (error?.momentsFailure) {
        return normalizeFailure(error.momentsFailure);
      }
      if (error?.name === "AbortError") {
        return normalizeFailure({
          title: "角色互动生成超时",
          message: `等待模型服务超过约 ${Math.round(
            client.DEFAULT_TIMEOUT_MS / 1000,
          )} 秒，没有收到完整回复。`,
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
            title: "角色点赞评论失败",
            message:
              error?.message || "模型服务没有返回可显示的互动结果。",
            nextStep:
              "先到设置页确认 API 配置和连接测试正常，再点击这条动态上的“重试”。",
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
        characterId,
      });
    }

    async function recoverInterrupted() {
      const result = await store.recoverInterruptedInteractions();
      if (result.recovered) {
        notifyChange(result.data, {
          reason: "interactions-recovered",
          recovered: result.recovered,
        });
      }
      return result;
    }

    return Object.freeze({
      reactToMoment,
      retryInteraction,
      recoverInterrupted,
      describeGenerationError,
      waitForIdle,
    });
  }

  function normalizeFailure(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      title: String(source.title || "角色互动失败").slice(0, 200),
      message: String(
        source.message || "模型服务没有返回可显示的原因。",
      ).slice(0, 1600),
      nextStep: String(
        source.nextStep ||
          "检查 API 设置和网络后，点击这条动态上的“重试”。",
      ).slice(0, 1600),
      status: Math.max(0, Number(source.status) || 0),
    };
  }

  function createFailure(title, message, nextStep) {
    const error = new Error(message);
    error.name = "MomentReactionFailure";
    error.momentsFailure = { title, message, nextStep, status: 0 };
    return error;
  }

  root.PocketLabMomentsReactionService = Object.freeze({
    create,
    normalizeFailure,
  });
})(window);
