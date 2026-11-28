"use strict";

const assert = require("node:assert/strict");
const {
  getCompletedHistory,
  getPendingTurn,
  normalizeMessageTurns,
} = require("../js/chat-turn-model");

function message(id, role, content, extra = {}) {
  return {
    id,
    role,
    content,
    pendingReply: false,
    failed: false,
    retracted: false,
    ...extra,
  };
}

const stalePending = [
  message("user-a", "user", "第一轮", {
    pendingReply: true,
    turnId: "old-turn",
    batchId: "old-batch",
  }),
  message("assistant-a", "assistant", "第一轮回复", {
    turnId: "old-turn",
    batchId: "old-batch",
  }),
];
const staleTurns = normalizeMessageTurns(stalePending);
assert.equal(staleTurns.length, 1);
assert.equal(stalePending[0].pendingReply, false);
assert.equal(stalePending[0].turnId, "turn-user-a");
assert.equal(stalePending[1].turnId, "turn-user-a");
assert.equal(getPendingTurn(stalePending), null);

const consecutiveTurn = [
  message("user-1", "user", "第一句", {
    pendingReply: true,
    turnId: "turn-user-1",
    batchId: "batch-user-1",
  }),
  message("user-2", "user", "第二句", {
    pendingReply: true,
    turnId: "stale-turn",
    batchId: "stale-batch",
  }),
  message("assistant-1", "assistant", "不必逐条回答", {
    turnId: "turn-wrong",
  }),
  message("user-3", "user", "下一轮", {
    pendingReply: true,
    turnId: "turn-wrong",
    batchId: "stale-batch",
  }),
];
const consecutiveTurns = normalizeMessageTurns(consecutiveTurn);
assert.equal(consecutiveTurns.length, 2);
assert.deepEqual(
  consecutiveTurns[0].userMessages.map((item) => item.id),
  ["user-1", "user-2"],
);
assert.equal(consecutiveTurns[0].batchId, "batch-user-1");
assert.equal(consecutiveTurns[0].userMessages[1].batchId, "batch-user-1");
assert.equal(consecutiveTurns[0].assistantMessages[0].turnId, "turn-user-1");
assert.equal(consecutiveTurns[1].id, "turn-user-3");
assert.equal(consecutiveTurns[1].userMessages[0].turnId, "turn-user-3");
assert.equal(consecutiveTurns[1].pending, true);
assert.equal(consecutiveTurns[0].pending, false);
assert.equal(getPendingTurn(consecutiveTurn).batchId, "batch-user-3");

const multiPending = [
  message("old-user", "user", "旧消息", {
    pendingReply: true,
    turnId: "old-turn",
    batchId: "old-batch",
  }),
  message("old-assistant", "assistant", "旧回复", {
    turnId: "old-turn",
  }),
  message("new-user-1", "user", "新消息一", {
    pendingReply: true,
    turnId: "new-turn",
    batchId: "new-batch",
  }),
  message("new-user-2", "user", "新消息二", {
    pendingReply: true,
    turnId: "new-turn",
    batchId: "new-batch",
  }),
];
normalizeMessageTurns(multiPending);
assert.equal(multiPending[0].pendingReply, false);
assert.equal(multiPending[2].pendingReply, true);
assert.equal(multiPending[3].pendingReply, true);

const historyMessages = [
  message("history-user-1", "user", "历史问题一"),
  message("history-user-2", "user", "历史问题二"),
  message("history-assistant", "assistant", "历史回复"),
  message("current-user-1", "user", "当前问题一", {
    pendingReply: true,
    turnId: "turn-current-user-1",
    batchId: "batch-current-user-1",
  }),
  message("current-user-2", "user", "当前问题二", {
    pendingReply: true,
    turnId: "turn-current-user-1",
    batchId: "batch-current-user-1",
  }),
];
assert.deepEqual(
  getCompletedHistory(historyMessages, "turn-current-user-1"),
  [
    { role: "user", content: "历史问题一" },
    { role: "user", content: "历史问题二" },
    { role: "assistant", content: "历史回复" },
  ],
);
assert.deepEqual(
  getCompletedHistory(historyMessages, "turn-current-user-1", { limit: 2 }),
  [
    { role: "user", content: "历史问题二" },
    { role: "assistant", content: "历史回复" },
  ],
);

const retractedHistory = [
  message("retracted-user", "user", "不要带上", { retracted: true }),
  message("retracted-assistant", "assistant", "不要带上回复", {
    retracted: true,
  }),
  message("active-user", "user", "继续聊"),
  message("active-assistant", "assistant", "继续回复"),
  message("current-user", "user", "当前问题", {
    pendingReply: true,
  }),
];
assert.deepEqual(
  getCompletedHistory(retractedHistory, "turn-current-user"),
  [
    { role: "user", content: "继续聊" },
    { role: "assistant", content: "继续回复" },
  ],
);

const failedTurn = [
  message("failed-user-1", "user", "第一句", {
    pendingReply: true,
    failed: true,
    error: { title: "失败", message: "原因", nextStep: "重试" },
  }),
  message("failed-user-2", "user", "第二句", {
    pendingReply: true,
  }),
];
normalizeMessageTurns(failedTurn);
assert.equal(failedTurn[0].failed, true);
assert.equal(failedTurn[1].failed, false);
assert.equal(failedTurn[1].pendingReply, true);
assert.equal(getPendingTurn(failedTurn).batchId, "batch-failed-user-1");

console.log("Chat turn model tests passed.");
