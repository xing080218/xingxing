"use strict";

(() => {
  const terminalPunctuation = new Set(["。", "．", "！", "？", "!", "?", "…"]);
  const closingPunctuation = new Set([
    "\"",
    "'",
    "”",
    "’",
    "」",
    "』",
    "）",
    ")",
    "】",
    "》",
    "〉",
    "〕",
    "］",
    "}",
  ]);

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
      "只输出角色要发来的消息。",
      "只回应下方本轮内容；历史消息只用于理解关系和已知事实，不要复述、续写或重发上一条角色回复。",
      "请像日常聊天一样，每条消息单独一行，按内容自然分条；句号、问号、感叹号等句末标点后换行。",
      "不要输出动作、神态、旁白、心理描写、角色名、说话人标签、编号、标题、括号说明、总结、分析或格式提示。",
      "不要逐条编号回答，也不要把这些话当成彼此独立的任务。",
      "要完整回应这一轮表达的重点，但不要把每个输入机械地对应成一条回复。",
    ].join("\n");
  }

  function stripReplyDecoration(line) {
    return line
      .replace(/^\s*(?:[-*•]\s+)/u, "")
      .replace(
        /^\s*(?:第\s*\d{1,2}\s*条\s*[：:、.)）]?|\d{1,2}\s*[：:、.)）])\s*/u,
        "",
      )
      .replace(/^\s*(?:角色|助手|AI|assistant)\s*[：:]\s*/iu, "")
      .trim();
  }

  function isTerminalPunctuation(text, index) {
    const character = text[index];
    if (character === "." || character === "．") {
      const previous = text[index - 1] || "";
      const next = text[index + 1] || "";
      if (/\d/u.test(previous) && /\d/u.test(next)) return false;
      if (/[A-Za-z]/u.test(previous) && /[A-Za-z]/u.test(next)) return false;
      return true;
    }
    return terminalPunctuation.has(character);
  }

  function splitLine(line) {
    const text = line.trim();
    if (!text) return [];

    const messages = [];
    let start = 0;
    let cursor = 0;

    while (cursor < text.length) {
      if (!isTerminalPunctuation(text, cursor)) {
        cursor += 1;
        continue;
      }

      let end = cursor + 1;
      while (end < text.length && isTerminalPunctuation(text, end)) {
        end += 1;
      }
      while (end < text.length && closingPunctuation.has(text[end])) {
        end += 1;
      }

      const message = text.slice(start, end).trim();
      if (message) messages.push(message);
      start = end;
      cursor = end;
    }

    const remainder = text.slice(start).trim();
    if (remainder) messages.push(remainder);
    return messages.length ? messages : [text];
  }

  function splitMessages(content) {
    const lines = String(content || "")
      .replace(/\r\n?/g, "\n")
      .split("\n");
    const messages = [];

    lines.forEach((line) => {
      const cleaned = stripReplyDecoration(line);
      if (!cleaned || /^```/u.test(cleaned)) return;
      messages.push(...splitLine(cleaned));
    });

    return messages;
  }

  function normalizeReply(reply) {
    return splitMessages(reply).join("\n");
  }

  const api = Object.freeze({
    buildPrompt,
    normalizeReply,
    splitMessages,
  });

  if (typeof window !== "undefined") {
    window.PocketLabChatSummary = api;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
