"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const ignoreText = fs.readFileSync(path.join(root, ".vercelignore"), "utf8");
const config = JSON.parse(
  fs.readFileSync(path.join(root, "vercel.json"), "utf8"),
);
const notFound = require("../api/not-found");

assert.doesNotMatch(
  ignoreText,
  /^prompts\/\s*$/m,
  "prompts/ must not be excluded from the Vercel deployment.",
);
assert.equal(
  config.functions["api/chat.js"].includeFiles,
  "prompts/**",
  "The chat function must include the external system prompt.",
);
assert.ok(
  Array.isArray(config.rewrites) &&
    config.rewrites.some(
      (rewrite) =>
        rewrite.source === "/prompts/:path*" &&
        rewrite.destination === "/api/not-found",
    ),
  "Prompt files must be rewritten to the explicit 404 function.",
);

const headers = new Map();
let responseBody = "";
const response = {
  statusCode: 200,
  setHeader(name, value) {
    headers.set(name.toLowerCase(), value);
  },
  end(value) {
    responseBody = String(value || "");
  },
};

notFound({ method: "GET" }, response);
assert.equal(response.statusCode, 404);
assert.equal(headers.get("content-type"), "text/plain; charset=utf-8");
assert.equal(headers.get("cache-control"), "no-store, max-age=0");
assert.equal(responseBody, "Not found");

console.log("Vercel deployment tests passed.");
