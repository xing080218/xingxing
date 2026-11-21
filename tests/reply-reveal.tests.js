"use strict";

const assert = require("node:assert/strict");
const { getDelay, runSequentially, defaultPacing } = require("../js/reply-reveal");

async function runTests() {
  const shown = [];
  const waits = [];
  let completedWith = 0;

  const count = await runSequentially(["第一句。", "第二句？", "第三句！"], {
    delayFor(_line, index) {
      return index * 10;
    },
    async wait(delayMs) {
      waits.push(delayMs);
    },
    onShow(line, index) {
      shown.push({ line, index });
    },
    onComplete(total) {
      completedWith = total;
    },
  });

  assert.equal(count, 3);
  assert.equal(completedWith, 3);
  assert.deepEqual(waits, [10, 20]);
  assert.deepEqual(shown, [
    { line: "第一句。", index: 0 },
    { line: "第二句？", index: 1 },
    { line: "第三句！", index: 2 },
  ]);

  const shortDelay = getDelay("短", 1);
  const longDelay = getDelay("这是一句更长的角色回复。", 1);
  assert.ok(shortDelay >= defaultPacing.baseDelayMs);
  assert.ok(longDelay > shortDelay);
  assert.ok(getDelay("很长".repeat(100), 10) <= 1570);

  assert.equal(await runSequentially([], {}), 0);
  console.log("Reply reveal tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
