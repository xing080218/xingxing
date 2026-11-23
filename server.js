"use strict";

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const ROOT = __dirname;
const WORK_DIR = path.join(ROOT, "work");
const LOG_PATH = path.join(WORK_DIR, "server.log");
const SERVER_URL_PATH = path.join(WORK_DIR, "server-url.txt");
const PHONE_URLS_PATH = path.join(WORK_DIR, "phone-urls.txt");
const DEFAULT_PORT = 4176;
const DEFAULT_API_PORT = 4177;
const MAX_BODY_BYTES = 512 * 1024;
const API_PROXY_TIMEOUT_MS = 130000;
const BUILD = "20261123-10";

function parseArgs(argv) {
  const result = {
    port: DEFAULT_PORT,
    apiPort: DEFAULT_API_PORT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];
    if (current === "--port" && next) {
      result.port = Number(next);
      index += 1;
    } else if (current === "--api-port" && next) {
      result.apiPort = Number(next);
      index += 1;
    }
  }

  if (!Number.isInteger(result.port) || result.port < 1 || result.port > 65535) {
    result.port = DEFAULT_PORT;
  }
  if (!Number.isInteger(result.apiPort) || result.apiPort < 1 || result.apiPort > 65535) {
    result.apiPort = DEFAULT_API_PORT;
  }
  return result;
}

const options = parseArgs(process.argv.slice(2));

function ensureWorkDirectory() {
  fs.mkdirSync(WORK_DIR, { recursive: true });
}

function log(message) {
  ensureWorkDirectory();
  const line = `${new Date().toISOString()} ${message}\n`;
  try {
    fs.appendFileSync(LOG_PATH, line, "utf8");
  } catch {
  }
}

function writeTextFile(filePath, value) {
  ensureWorkDirectory();
  try {
    fs.writeFileSync(filePath, value, "utf8");
  } catch {
  }
}

function isPrivateIPv4(address) {
  const parts = String(address || "").split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }
  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

function getLanIPv4Addresses() {
  const all = [];
  const physical = [];
  const virtualPattern =
    /radmin|vpn|virtual|vethernet|hyper-v|docker|wsl|tap|tun|loopback|bluetooth/i;

  for (const [interfaceName, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries || []) {
      const family = entry.family === 4 || String(entry.family).toLowerCase() === "ipv4";
      if (
        !family ||
        entry.internal ||
        !isPrivateIPv4(entry.address) ||
        String(entry.address).startsWith("169.254.")
      ) {
        continue;
      }

      if (!all.includes(entry.address)) {
        all.push(entry.address);
      }
      if (!virtualPattern.test(interfaceName) && !physical.includes(entry.address)) {
        physical.push(entry.address);
      }
    }
  }

  return physical.length > 0 ? physical : all;
}

function writeConnectionFiles() {
  const localUrl = `http://127.0.0.1:${options.port}`;
  const phoneUrls = getLanIPv4Addresses().map(
    (address) => `http://${address}:${options.port}`,
  );
  writeTextFile(SERVER_URL_PATH, localUrl);
  writeTextFile(PHONE_URLS_PATH, phoneUrls.join(os.EOL));
  return phoneUrls;
}

function getLanUrls() {
  return getLanIPv4Addresses().map(
    (address) => `http://${address}:${options.port}`,
  );
}

function contentType(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".webmanifest":
      return "application/manifest+json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".svg":
      return "image/svg+xml";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

function securityHeaders() {
  return {
    "Cache-Control": "no-store",
    "Content-Security-Policy":
      "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

function sendJson(response, statusCode, payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  response.writeHead(statusCode, {
    ...securityHeaders(),
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    Connection: "close",
  });
  response.end(body);
}

function sendText(response, statusCode, text) {
  const body = Buffer.from(String(text), "utf8");
  response.writeHead(statusCode, {
    ...securityHeaders(),
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": body.length,
    Connection: "close",
  });
  response.end(body);
}

function getClientAddress(request) {
  const raw =
    request && request.socket && request.socket.remoteAddress
      ? String(request.socket.remoteAddress)
      : "unknown";
  return raw.startsWith("::ffff:") ? raw.slice(7) : raw;
}

function resolveStaticPath(requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  } catch {
    return null;
  }

  if (pathname === "/") {
    pathname = "/index.html";
  }

  const relative = pathname.replace(/^\/+/, "");
  const candidate = path.resolve(ROOT, relative);
  const rootWithSeparator = `${path.resolve(ROOT)}${path.sep}`;
  if (candidate !== path.resolve(ROOT) && !candidate.startsWith(rootWithSeparator)) {
    return null;
  }
  return candidate;
}

async function serveStatic(request, response, requestUrl) {
  const filePath = resolveStaticPath(requestUrl);
  if (!filePath) {
    sendText(response, 404, "Not found");
    return;
  }

  let stat;
  try {
    stat = await fs.promises.stat(filePath);
  } catch {
    sendText(response, 404, "Not found");
    return;
  }

  if (!stat.isFile()) {
    sendText(response, 404, "Not found");
    return;
  }

  let body;
  try {
    body = await fs.promises.readFile(filePath);
  } catch {
    sendText(response, 500, "Could not read page");
    return;
  }

  const method = String(request.method || "GET").toUpperCase();
  const headers = {
    ...securityHeaders(),
    "Content-Type": contentType(filePath),
    "Content-Length": body.length,
    Connection: "close",
  };
  response.writeHead(200, headers);
  if (method === "HEAD") {
    response.end();
    return;
  }
  response.end(body);
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let finished = false;

    request.on("data", (chunk) => {
      if (finished) {
        return;
      }
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        finished = true;
        reject(new Error("body_too_large"));
        request.resume();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (!finished) {
        finished = true;
        resolve(Buffer.concat(chunks));
      }
    });
    request.on("error", (error) => {
      if (!finished) {
        finished = true;
        reject(error);
      }
    });
  });
}

function proxyApi(request, response, body) {
  const startedAt = Date.now();
  const apiPath = String(request.url || "").split("?")[0];
  const clientAddress = getClientAddress(request);
  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: options.apiPort,
      path: request.url,
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": body.length,
        Accept: "application/json",
        Connection: "close",
      },
      agent: false,
    },
    (upstreamResponse) => {
      const chunks = [];
      let totalBytes = 0;
      upstreamResponse.on("data", (chunk) => {
        totalBytes += chunk.length;
        if (totalBytes <= 8 * 1024 * 1024) {
          chunks.push(chunk);
        }
      });
      upstreamResponse.on("end", () => {
        const payload = Buffer.concat(chunks);
        log(
          `API proxy completed: ${apiPath} from ${clientAddress}, local API status ${upstreamResponse.statusCode || 0}, ${Date.now() - startedAt} ms. Key and messages were not logged.`,
        );
        response.writeHead(upstreamResponse.statusCode || 502, {
          ...securityHeaders(),
          "Content-Type":
            upstreamResponse.headers["content-type"] || "application/json; charset=utf-8",
          "Content-Length": payload.length,
          Connection: "close",
        });
        response.end(payload);
      });
    },
  );

  upstream.setTimeout(API_PROXY_TIMEOUT_MS, () => {
    upstream.destroy(new Error("api_timeout"));
  });
  upstream.on("error", (error) => {
    log(
      `API proxy failed: ${apiPath} from ${clientAddress}, code ${error && error.code ? error.code : "unknown"}, ${Date.now() - startedAt} ms. Key and messages were not logged.`,
    );
    if (response.headersSent) {
      response.destroy();
      return;
    }
    const timedOut = error && error.message === "api_timeout";
    sendJson(response, timedOut ? 504 : 502, {
      ok: false,
      error: {
        title: timedOut ? "本机 API 服务响应超时" : "本机 API 服务没有响应",
        message: timedOut
          ? "网页入口仍在运行，但等待模型接口的本机服务超过了 130 秒。"
          : "网页入口已经启动，但没有连接到本机 API 服务。",
        nextStep: timedOut
          ? "先检查电脑到模型服务商的网络，再重新点击连接测试或消息重试。手机页面不会因为这个等待而白屏。"
          : "关闭并重新双击 start.bat，让网页入口和本机 API 服务一起启动，然后刷新页面。",
        status: 0,
        code: timedOut ? "api_proxy_timeout" : "api_proxy_unavailable",
      },
    });
  });

  upstream.write(body);
  upstream.end();
}

function handleRequest(request, response) {
  const method = String(request.method || "GET").toUpperCase();
  const requestUrl = String(request.url || "/");
  const pathname = requestUrl.split("?")[0];
  const remote = request.socket && request.socket.remoteAddress
    ? `${request.socket.remoteAddress}:${request.socket.remotePort || 0}`
    : "unknown";

  if (method === "GET" && pathname === "/api/health") {
    log(`Health request: ${pathname} from ${remote}`);
    const lanUrls = getLanUrls();
    sendJson(response, 200, {
      ok: true,
      build: BUILD,
      serverTime: new Date().toISOString(),
      mode: "node-web-entry",
      port: options.port,
      apiPort: options.apiPort,
      clientAddress: getClientAddress(request),
      lanUrls,
      primaryPhoneUrl: lanUrls[0] || "",
    });
    return;
  }

  if (method === "GET" && pathname === "/favicon.ico") {
    response.writeHead(204, {
      ...securityHeaders(),
      "Content-Type": "image/x-icon",
      "Content-Length": 0,
    });
    response.end();
    return;
  }

  if ((method === "POST") && (pathname === "/api/test" || pathname === "/api/chat")) {
    readRequestBody(request)
      .then((body) => {
        log(`API request: ${pathname} from ${remote}`);
        proxyApi(request, response, body);
      })
      .catch((error) => {
        if (error && error.message === "body_too_large") {
          sendJson(response, 413, {
            ok: false,
            error: {
              title: "提交内容过大",
              message: "请求内容超过网页入口的安全限制。",
              nextStep: "缩短最近聊天记录后重新提交。",
              status: 0,
              code: "request_too_large",
            },
          });
          return;
        }
        sendJson(response, 400, {
          ok: false,
          error: {
            title: "请求没有读取完整",
            message: "浏览器提交的内容没有完整到达网页入口。",
            nextStep: "刷新页面后重新提交。",
            status: 0,
            code: "request_read_failed",
          },
        });
      });
    return;
  }

  if (method === "GET" || method === "HEAD") {
    if (pathname === "/") {
      log(`Bundled app request: GET / from ${remote}`);
    } else if (pathname !== "/api/health") {
      log(`Static request: GET ${pathname} from ${remote}`);
    }
    serveStatic(request, response, requestUrl).catch(() => {
      if (!response.headersSent) {
        sendText(response, 500, "Internal server error");
      } else {
        response.destroy();
      }
    });
    return;
  }

  if (method === "POST") {
    sendJson(response, 404, { ok: false, error: "Not found" });
    return;
  }

  sendText(response, 405, "Method not allowed");
}

const server = http.createServer(handleRequest);
server.on("error", (error) => {
  log(`Node web entry failed: ${error.code || error.message}`);
  process.exitCode = 1;
});
server.listen(options.port, "0.0.0.0", () => {
  const phoneUrls = writeConnectionFiles();
  log(
    `Node web entry started at http://127.0.0.1:${options.port} (API proxy: 127.0.0.1:${options.apiPort})`,
  );
  process.stdout.write(`PocketLab web entry: http://127.0.0.1:${options.port}\n`);
  for (const phoneUrl of phoneUrls) {
    process.stdout.write(`PocketLab phone entry: ${phoneUrl}\n`);
  }
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("uncaughtException", (error) => {
  log(`Node web entry error: ${error && error.message ? error.message : "unknown"}`);
});
