"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const model = require("../js/moments-model.js");

const source = fs.readFileSync(
  path.join(__dirname, "..", "js", "moments-reaction-service.js"),
  "utf8",
);

function loadServiceFactory() {
  const window = {};
  vm.runInNewContext(
    source,
    { window },
    { filename: "js/moments-reaction-service.js" },
  );
  return window.PocketLabMomentsReactionService;
}

function createMemoryStore(initialData) {
  let data = model.normalizeMomentData(initialData);
  let chain = Promise.resolve();

  function run(work) {
    const result = chain.then(work);
    chain = result.catch(() => undefined);
    return result;
  }

  return {
    load() {
      return run(() => model.normalizeMomentData(data));
    },
    addInteractions(momentId, interactions) {
      return run(() => {
        data = model.addInteractions(data, momentId, interactions);
        return {
          data: model.normalizeMomentData(data),
          moment: model.getMoment(data, momentId),
        };
      });
    },
    updateInteraction(momentId, characterId, changes) {
      return run(() => {
        data = model.updateInteraction(
          data,
          momentId,
          characterId,
          changes,
        );
        const moment = model.getMoment(data, momentId);
        return {
          data: model.normalizeMomentData(data),
          moment,
          interaction:
            moment?.interactions.find(
              (interaction) => interaction.characterId === characterId,
            ) || null,
        };
      });
    },
    recoverInterruptedInteractions() {
      return run(() => {
        const result = model.recoverInterruptedInteractions(data);
        data = result.data;
        return {
          data: model.normalizeMomentData(data),
          recovered: result.recovered,
        };
      });
    },
    waitForIdle() {
      return chain;
    },
    snapshot() {
      return model.normalizeMomentData(data);
    },
  };
}

function createFixture() {
  const moment = model.createMoment("今天学会了做第一杯拿铁。", {
    id: "moment-service-placeholder",
    now: 100,
  });
  const initialData = model.addMoment({ moments: [] }, moment);
  const characters = [
    {
      id: "character-a",
      name: "角色甲",
      persona: "说话温柔。",
      worldBookId: "world-a",
      selfProfileId: "profile-selected",
    },
    {
      id: "character-b",
      name: "角色乙",
      persona: "说话活泼。",
    },
  ];
  const store = createMemoryStore(initialData);
  const calls = [];
  let failCharacterB = true;
  let releaseFirstCall;
  let firstCallGate = null;
  let useFirstCallGate = false;
  const client = {
    DEFAULT_TIMEOUT_MS: 140000,
    async generateReaction(options) {
      calls.push(options);
      if (useFirstCallGate && firstCallGate) {
        await firstCallGate;
      }
      if (options.character.id === "character-b" && failCharacterB) {
        const error = new Error("占位服务暂时拒绝了请求。");
        error.status = 503;
        error.apiError = {
          title: "占位服务不可用",
          message: "这是自动测试生成的失败原因。",
          nextStep: "检查占位服务状态后重试。",
        };
        throw error;
      }
      return {
        liked: true,
        comment: `${options.character.name}看到了这条动态。`,
      };
    },
  };
  const storage = {
    async listCharacters() {
      return characters;
    },
    async getCharacter(characterId) {
      return (
        characters.find((character) => character.id === characterId) ||
        null
      );
    },
    async getWorldBook(worldBookId) {
      if (worldBookId !== "world-a") return null;
      return {
        id: "world-a",
        name: "占位世界书",
        content: "只用于验证朋友圈角色请求上下文。",
      };
    },
    async getMessages(characterId) {
      return [
        {
          id: `message-${characterId}`,
          characterId,
          role: "user",
          content: "最近一次普通聊天。",
        },
      ];
    },
  };
  const profiles = {
    selected: {
      id: "profile-selected",
      name: "指定本人",
      persona: "只用于自动测试的指定资料。",
    },
    active: {
      id: "profile-active",
      name: "当前本人",
      persona: "只用于自动测试的当前资料。",
    },
  };
  let latestData = initialData;
  const changes = [];
  const service = loadServiceFactory().create({
    model,
    store,
    client,
    storage,
    getApiSettings: () => ({
      apiUrl: "https://api.example.com/v1",
      apiKey: "your-api-key",
      modelName: "placeholder-model",
    }),
    getProfileById: (id) =>
      id === profiles.selected.id ? profiles.selected : null,
    getActiveProfile: () => profiles.active,
    normalizeError: (error) => ({
      title: error.title || "角色互动失败",
      message: error.message || "自动测试失败。",
      nextStep: error.nextStep || "检查配置后重试。",
      status: Number(error.status) || 0,
    }),
    onChange: (data, detail) => {
      latestData = data;
      changes.push(detail);
    },
    concurrency: 2,
  });

  return {
    moment,
    initialData,
    store,
    calls,
    service,
    profiles,
    getLatestData: () => latestData,
    getChanges: () => changes,
    setFailCharacterB(value) {
      failCharacterB = Boolean(value);
    },
    createFirstCallGate() {
      useFirstCallGate = true;
      firstCallGate = new Promise((resolve) => {
        releaseFirstCall = resolve;
      });
    },
    releaseFirstCall() {
      useFirstCallGate = false;
      releaseFirstCall?.();
    },
  };
}

async function runTests() {
  const fixture = createFixture();
  const reaction = await fixture.service.reactToMoment(fixture.moment.id);
  assert.equal(reaction.outcomes.length, 2);
  assert.equal(
    reaction.outcomes.filter((outcome) => outcome.ok).length,
    1,
  );
  assert.equal(
    reaction.outcomes.filter((outcome) => !outcome.ok).length,
    1,
  );
  assert.equal(fixture.calls.length, 2);

  const characterACall = fixture.calls.find(
    (call) => call.character.id === "character-a",
  );
  assert.equal(characterACall.config.apiKey, "your-api-key");
  assert.equal(characterACall.worldBook.name, "占位世界书");
  assert.equal(characterACall.userProfile.id, "profile-selected");
  assert.equal(
    characterACall.messages[0].content,
    "最近一次普通聊天。",
  );
  const characterBCall = fixture.calls.find(
    (call) => call.character.id === "character-b",
  );
  assert.equal(characterBCall.worldBook, null);
  assert.equal(characterBCall.userProfile.id, "profile-active");

  let interactions = model.getMoment(
    fixture.store.snapshot(),
    fixture.moment.id,
  ).interactions;
  assert.equal(interactions.length, 2);
  const sentA = interactions.find(
    (interaction) => interaction.characterId === "character-a",
  );
  const failedB = interactions.find(
    (interaction) => interaction.characterId === "character-b",
  );
  assert.equal(sentA.status, model.INTERACTION_STATUS.SENT);
  assert.equal(sentA.liked, true);
  assert.equal(sentA.comment, "角色甲看到了这条动态。");
  assert.equal(failedB.status, model.INTERACTION_STATUS.FAILED);
  assert.equal(failedB.error.title, "占位服务不可用");
  assert.equal(failedB.error.status, 503);
  assert.equal(failedB.error.nextStep, "检查占位服务状态后重试。");

  assert.ok(
    fixture.getChanges().some(
      (change) => change.reason === "interaction-sent",
    ),
  );
  assert.ok(
    fixture.getChanges().some(
      (change) => change.reason === "interaction-failed",
    ),
  );

  const callsBeforeDuplicateCheck = fixture.calls.length;
  await fixture.service.reactToMoment(fixture.moment.id);
  assert.equal(
    fixture.calls.length,
    callsBeforeDuplicateCheck,
    "Already handled characters must not generate another interaction.",
  );

  fixture.setFailCharacterB(false);
  const retry = await fixture.service.retryInteraction(
    fixture.moment.id,
    "character-b",
  );
  assert.equal(retry.ok, true);
  interactions = model.getMoment(
    fixture.store.snapshot(),
    fixture.moment.id,
  ).interactions;
  assert.equal(
    interactions.length,
    2,
    "Retry must update the existing character interaction.",
  );
  const retriedB = interactions.find(
    (interaction) => interaction.characterId === "character-b",
  );
  assert.equal(retriedB.status, model.INTERACTION_STATUS.SENT);
  assert.equal(retriedB.comment, "角色乙看到了这条动态。");
  assert.equal(retriedB.error, null);
  assert.equal(
    fixture.calls.filter(
      (call) => call.character.id === "character-b",
    ).length,
    2,
  );

  const waitFixture = createFixture();
  waitFixture.createFirstCallGate();
  const pendingReaction = waitFixture.service.reactToMoment(
    waitFixture.moment.id,
  );
  let idleResolved = false;
  const idlePromise = waitFixture.service.waitForIdle().then(() => {
    idleResolved = true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    idleResolved,
    false,
    "Backup waits must include interactions that are still preparing.",
  );
  waitFixture.releaseFirstCall();
  await pendingReaction;
  await idlePromise;
  assert.equal(idleResolved, true);

  const missingConfigFixture = createFixture();
  const missingConfigService = loadServiceFactory().create({
    model,
    store: missingConfigFixture.store,
    client: missingConfigFixture.calls.push.bind(
      missingConfigFixture.calls,
    ),
    storage: {
      async listCharacters() {
        return [
          {
            id: "character-a",
            name: "角色甲",
            persona: "说话温柔。",
          },
        ];
      },
      async getCharacter() {
        return {
          id: "character-a",
          name: "角色甲",
          persona: "说话温柔。",
        };
      },
      async getMessages() {
        return [];
      },
    },
    getApiSettings: () => ({}),
  });
  const missingConfigResult =
    await missingConfigService.reactToMoment(fixture.moment.id);
  assert.equal(missingConfigResult.outcomes[0].ok, false);
  assert.equal(
    missingConfigResult.outcomes[0].failure.title,
    "尚未完成 API 配置",
  );

  console.log("Moments reaction service tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
