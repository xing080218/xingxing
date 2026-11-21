"use strict";

(() => {
  const defaultPacing = Object.freeze({
    baseDelayMs: 900,
    characterDelayMs: 18,
    maxCharacterDelayMs: 450,
    sequenceStepMs: 55,
    maxSequenceDelayMs: 220,
  });

  function normalizeLines(lines) {
    return (Array.isArray(lines) ? lines : [])
      .map((line) => (typeof line === "string" ? line.trim() : ""))
      .filter(Boolean);
  }

  function getDelay(content, index, pacing = defaultPacing) {
    const characterCount = Array.from(String(content || "").trim()).length;
    const characterDelay = Math.min(
      pacing.maxCharacterDelayMs,
      characterCount * pacing.characterDelayMs,
    );
    const sequenceDelay = Math.min(
      pacing.maxSequenceDelayMs,
      Math.max(0, Number(index) - 1) * pacing.sequenceStepMs,
    );
    return pacing.baseDelayMs + characterDelay + sequenceDelay;
  }

  function waitFor(delayMs) {
    return new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));
  }

  async function runSequentially(lines, options = {}) {
    const items = normalizeLines(lines);
    if (!items.length) return 0;

    const onShow = typeof options.onShow === "function" ? options.onShow : () => {};
    const onComplete =
      typeof options.onComplete === "function" ? options.onComplete : () => {};
    const delayFor = typeof options.delayFor === "function" ? options.delayFor : getDelay;
    const wait = typeof options.wait === "function" ? options.wait : waitFor;

    onShow(items[0], 0);
    for (let index = 1; index < items.length; index += 1) {
      const delayMs = Number(delayFor(items[index], index));
      await wait(Number.isFinite(delayMs) && delayMs > 0 ? delayMs : 0);
      onShow(items[index], index);
    }
    onComplete(items.length);
    return items.length;
  }

  const api = Object.freeze({
    defaultPacing,
    getDelay,
    runSequentially,
  });

  if (typeof window !== "undefined") {
    window.PocketLabReplyReveal = api;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
