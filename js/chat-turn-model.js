"use strict";

(() => {
  function createTurn(index) {
    return {
      index,
      id: "",
      batchId: "",
      messages: [],
      userMessages: [],
      assistantMessages: [],
      hasUser: false,
      hasAssistant: false,
      retracted: false,
      pending: false,
      failed: false,
    };
  }

  function getStableMessageId(message, index) {
    const id =
      message && typeof message.id === "string" ? message.id.trim() : "";
    return id || `anonymous-${index}`;
  }

  function normalizeMessageTurns(messages) {
    const source = Array.isArray(messages) ? messages : [];
    const turns = [];
    let currentTurn = null;

    source.forEach((message) => {
      if (!message || (message.role !== "user" && message.role !== "assistant")) {
        return;
      }

      // A user message after an assistant reply always starts a new turn.
      // Consecutive user messages before a reply remain one turn.
      if (!currentTurn || (message.role === "user" && currentTurn.hasAssistant)) {
        currentTurn = createTurn(turns.length);
        turns.push(currentTurn);
      }

      currentTurn.messages.push(message);
      if (message.role === "user") {
        currentTurn.hasUser = true;
        currentTurn.userMessages.push(message);
      } else {
        currentTurn.hasAssistant = true;
        currentTurn.assistantMessages.push(message);
      }
    });

    turns.forEach((turn, index) => {
      const firstMessage = turn.messages[0];
      const stableId = getStableMessageId(firstMessage, index);
      turn.id = `turn-${stableId}`;
      turn.batchId = `batch-${stableId}`;
      turn.retracted = turn.messages.some((message) => message.retracted === true);

      turn.userMessages.forEach((message, messageIndex) => {
        message.turnId = turn.id;
        message.batchId = turn.batchId;
        message.batchIndex = messageIndex + 1;
      });
      turn.assistantMessages.forEach((message) => {
        message.turnId = turn.id;
        message.batchId = "";
        message.batchIndex = 0;
      });
    });

    const unresolvedTurns = turns.filter(
      (turn) =>
        turn.hasUser &&
        !turn.hasAssistant &&
        turn.userMessages.some((message) => message.retracted !== true),
    );
    const pendingTurn =
      unresolvedTurns.length > 0 ? unresolvedTurns[unresolvedTurns.length - 1] : null;
    const pendingSignal = Boolean(
      pendingTurn &&
        pendingTurn.userMessages.some(
          (message) =>
            message.retracted !== true &&
            (message.pendingReply === true || message.failed === true),
        ),
    );
    const failedMessage = pendingTurn
      ? [...pendingTurn.userMessages]
          .reverse()
          .find((message) => message.failed === true && message.retracted !== true)
      : null;

    turns.forEach((turn) => {
      turn.pending = Boolean(turn === pendingTurn && pendingSignal);
      turn.failed = Boolean(turn.pending && failedMessage);

      turn.userMessages.forEach((message) => {
        message.pendingReply = Boolean(
          turn.pending && message.retracted !== true,
        );
        message.failed = Boolean(
          turn.failed && message === failedMessage && message.retracted !== true,
        );
        if (!message.failed) message.error = null;
      });
      turn.assistantMessages.forEach((message) => {
        message.pendingReply = false;
        message.failed = false;
      });
    });

    return turns;
  }

  function getPendingTurn(messages, batchId = "") {
    const turns = normalizeMessageTurns(messages);
    const requestedBatchId =
      typeof batchId === "string" ? batchId.trim() : "";
    const pendingTurns = turns.filter((turn) => turn.pending);
    if (requestedBatchId) {
      return (
        pendingTurns.find((turn) => turn.batchId === requestedBatchId) || null
      );
    }
    return pendingTurns.length ? pendingTurns[pendingTurns.length - 1] : null;
  }

  function getCompletedHistory(messages, currentTurnId, options = {}) {
    const turns = normalizeMessageTurns(messages);
    const requestedTurnId =
      typeof currentTurnId === "string" ? currentTurnId.trim() : "";
    const currentIndex = requestedTurnId
      ? turns.findIndex((turn) => turn.id === requestedTurnId)
      : -1;
    const sourceTurns =
      currentIndex >= 0 ? turns.slice(0, currentIndex) : turns;
    const history = [];

    sourceTurns.forEach((turn) => {
      if (
        !turn.hasUser ||
        !turn.hasAssistant ||
        turn.retracted ||
        !turn.assistantMessages.some((message) => !message.retracted)
      ) {
        return;
      }

      turn.messages.forEach((message) => {
        if (
          (message.role !== "user" && message.role !== "assistant") ||
          message.retracted ||
          message.pendingReply ||
          message.failed ||
          typeof message.content !== "string" ||
          !message.content.trim()
        ) {
          return;
        }
        history.push({
          role: message.role,
          content: message.content,
        });
      });
    });

    const requestedLimit = Number(options.limit);
    const limit =
      Number.isInteger(requestedLimit) && requestedLimit > 0
        ? requestedLimit
        : 20;
    return history.slice(-limit);
  }

  const api = Object.freeze({
    getCompletedHistory,
    getPendingTurn,
    normalizeMessageTurns,
  });

  if (typeof window !== "undefined") {
    window.PocketLabChatTurnModel = api;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
