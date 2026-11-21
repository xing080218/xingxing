"use strict";

(() => {
  function getMessageContents(messages) {
    return (Array.isArray(messages) ? messages : [])
      .map((message) =>
        message && typeof message.content === "string" ? message.content.trim() : "",
      )
      .filter(Boolean);
  }

  function buildPrompt(messages) {
    const contents = getMessageContents(messages);
    if (!contents.length) return "";

    return [
      "下面是我在同一轮聊天中连续发送的内容。请先综合理解整段内容，提炼我真正关心的问题、情绪和需求，再用角色口吻自然回复。",
      "",
      contents.join("\n\n---\n\n"),
      "",
      "不要逐条编号回答，也不要把这些话当成彼此独立的任务。",
      "如果其中有多个需要回应的点，请把它们融进一条自然、连贯的回复中，并完整覆盖重点。",
    ].join("\n");
  }

  function normalizeReply(reply) {
    return String(reply || "")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) =>
        line.replace(/^\s*(?:第\s*)?\d{1,2}\s*条\s*[：:]\s*/u, "").trimEnd(),
      )
      .join("\n")
      .trim();
  }

  const api = Object.freeze({
    buildPrompt,
    normalizeReply,
  });

  if (typeof window !== "undefined") {
    window.PocketLabChatSummary = api;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
