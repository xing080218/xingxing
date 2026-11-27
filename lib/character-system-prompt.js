"use strict";

const fs = require("node:fs");
const path = require("node:path");

const CHARACTER_SYSTEM_PROMPT_PATH = path.resolve(
  __dirname,
  "..",
  "prompts",
  "character-system-prompt.md",
);
const MAX_PROMPT_LENGTH = 20000;

let cachedPrompt;

function loadCharacterSystemPrompt(filePath = CHARACTER_SYSTEM_PROMPT_PATH) {
  let source;
  try {
    source = fs.readFileSync(filePath, "utf8");
  } catch {
    throw new Error("character_system_prompt_unreadable");
  }

  const prompt = source.replace(/\r\n?/g, "\n").trim();
  if (!prompt) {
    throw new Error("character_system_prompt_empty");
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new Error("character_system_prompt_too_long");
  }
  return prompt;
}

function getCharacterSystemPrompt() {
  if (cachedPrompt === undefined) {
    cachedPrompt = loadCharacterSystemPrompt();
  }
  return cachedPrompt;
}

module.exports = {
  CHARACTER_SYSTEM_PROMPT_PATH,
  getCharacterSystemPrompt,
  loadCharacterSystemPrompt,
};
