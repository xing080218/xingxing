"use strict";

const http = require("http");
const https = require("https");
const net = require("net");
const os = require("os");
const { URL } = require("url");

const MAX_INPUT_BYTES = 2 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT_MS = 120000;
const TRANSIENT_CODES = new Set([
  "ECONNRESET",
  "EPIPE",
  "ECONNABORTED",
  "UND_ERR_SOCKET",
  "UND_ERR_CLOSED",
  "POCKETLAB_RESPONSE_INTERRUPTED",
]);

let resultWritten = false;

function writeResult(payload) {
  if (resultWritten) {
    return;
  }
  resultWritten = true;
  process.stdout.write(JSON.stringify(payload));
}

function redactText(value, secrets = []) {
  let safe = String(value || "");
  for (const secret of secrets) {
    if (secret) {
      safe = safe.split(String(secret)).join("[已隐藏]");
    }
  }
  safe = safe.replace(/(?:\bBearer\s+)[^\s,;]+/gi, "Bearer [已隐藏]");
  safe = safe.replace(/\bsk-[A-Za-z0-9._-]{6,}\b/g, "[已隐藏]");
  return safe.slice(0, 520);
}

function isSameOrigin(left, right) {
  return (
    left.protocol === right.protocol &&
    left.hostname.toLowerCase() === right.hostname.toLowerCase() &&
    left.port === right.port
  );
}

function getHeaderValue(headers, wantedName) {
  const wanted = wantedName.toLowerCase();
  for (const [name, value] of Object.entries(headers || {})) {
    if (name.toLowerCase() === wanted && value !== undefined && value !== null) {
      return String(value);
    }
  }
  return "";
}

function removeHeader(headers, nameToRemove) {
  const wanted = nameToRemove.toLowerCase();
  for (const name of Object.keys(headers)) {
    if (name.toLowerCase() === wanted) {
      delete headers[name];
    }
  }
}

const VIRTUAL_INTERFACE_PATTERN =
  /radmin|vpn|virtual|vethernet|hyper-v|docker|wsl|(?:^|[\s_-])tap(?:[\s_-]|\d|$)|(?:^|[\s_-])tun(?:[\s_-]|\d|$)|loopback|bluetooth|wi-fi direct/i;
const PHYSICAL_INTERFACE_PATTERN = /wlan|wi-?fi|wireless|ethernet|以太网|无线/i;

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

function isUsableIPv4(address) {
  const first = Number(String(address || "").split(".")[0]);
  return (
    Number.isInteger(first) &&
    first > 0 &&
    first !== 127 &&
    first < 224 &&
    !String(address).startsWith("169.254.")
  );
}

function getPreferredLocalIPv4() {
  const candidates = [];
  let order = 0;

  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    if (!entries || VIRTUAL_INTERFACE_PATTERN.test(name)) {
      continue;
    }

    const isPhysical = PHYSICAL_INTERFACE_PATTERN.test(name);
    for (const entry of entries) {
      const isIPv4 = entry.family === 4 || String(entry.family).toLowerCase() === "ipv4";
      if (
        !isIPv4 ||
        entry.internal ||
        !isUsableIPv4(entry.address) ||
        /^00(?:[:-]00){5}$/i.test(String(entry.mac || ""))
      ) {
        continue;
      }

      const score =
        (isPhysical ? 100 : 0) +
        (isPrivateIPv4(entry.address) ? 30 : 0) +
        (String(entry.address).startsWith("192.168.") ? 10 : 0);
      candidates.push({
        address: String(entry.address),
        name,
        score,
        order,
      });
      order += 1;
    }
  }

  candidates.sort((left, right) => right.score - left.score || left.order - right.order);
  return candidates.length > 0 ? candidates[0].address : "";
}

function getBearerToken(headers) {
  const authorization = getHeaderValue(headers, "Authorization");
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function getPhaseLabel(phase) {
  const labels = {
    connecting: "正在连接服务器",
    tls_handshake: "正在建立 HTTPS 加密连接",
    sending_request: "连接已建立，正在发送请求",
    awaiting_response: "请求已发送，正在等待服务商响应",
    reading_response: "已收到响应，正在读取内容",
  };
  return labels[phase] || "连接过程中";
}

function collectErrorCodes(error) {
  const codes = [];
  const seen = new Set();
  let current = error;

  for (let depth = 0; depth < 8 && current && !seen.has(current); depth += 1) {
    seen.add(current);
    if (typeof current.code === "string" && current.code) {
      codes.push(current.code.toUpperCase());
    }
    if (Array.isArray(current.errors)) {
      for (const nested of current.errors) {
        if (nested && typeof nested.code === "string" && nested.code) {
          codes.push(nested.code.toUpperCase());
        }
      }
    }
    current = current.cause;
  }

  return [...new Set(codes)];
}

function getErrorCode(error) {
  const codes = collectErrorCodes(error);
  const genericCodes = new Set([
    "UND_ERR_SOCKET",
    "UND_ERR_CLOSED",
    "FETCH_FAILED",
    "ERR_FAILED",
  ]);
  return codes.find((code) => !genericCodes.has(code)) || codes[0] || "UNKNOWN";
}

function classifyError(error, context = {}, secrets = []) {
  const code = getErrorCode(error);
  const phase = context.phase || "connecting";
  const phaseLabel = getPhaseLabel(phase);
  const detailParts = [phaseLabel, code];
  const metadata = {
    rawCode: code,
    phase,
    remoteAddress: String(context.remoteAddress || ""),
    remotePort: Number(context.remotePort || 0),
  };

  if (context.remoteAddress) {
    detailParts.push(context.remotePort
      ? `远端 ${context.remoteAddress}:${context.remotePort}`
      : `远端 ${context.remoteAddress}`);
  }

  const detail = detailParts.join("；");
  const certificateCodes = new Set([
    "CERT_HAS_EXPIRED",
    "DEPTH_ZERO_SELF_SIGNED_CERT",
    "ERR_TLS_CERT_ALTNAME_INVALID",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "UNABLE_TO_GET_ISSUER_CERT",
    "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  ]);

  if (certificateCodes.has(code)) {
    return {
      ...metadata,
      code: "certificate",
      message: `HTTPS 证书验证失败（${detail}）。`,
    };
  }

  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return {
      ...metadata,
      code: "dns",
      message: `无法解析接口地址的域名（${detail}）。`,
    };
  }

  if (code === "ECONNREFUSED") {
    return {
      ...metadata,
      code: "connection_refused",
      message: `接口地址拒绝连接（${detail}）。`,
    };
  }

  if (code === "EACCES" || code === "EPERM") {
    return {
      ...metadata,
      code: "socket_permission",
      message: `后端运行环境的 Windows 防火墙或网络权限阻止了 Node 建立连接（${detail}）。请求尚未到达服务商，不是 API Key、模型名或接口地址内容错误。`,
    };
  }

  if (
    code === "ETIMEDOUT" ||
    code === "POCKETLAB_TIMEOUT" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "UND_ERR_HEADERS_TIMEOUT" ||
    code === "UND_ERR_BODY_TIMEOUT"
  ) {
    return {
      ...metadata,
      code: "timeout",
      message: `接口地址在限定时间内没有响应（${detail}）。`,
    };
  }

  if (TRANSIENT_CODES.has(code)) {
    return {
      ...metadata,
      code: "connection_reset",
      message: `连接被远端或后端网络中断（${detail}）。`,
      retryable: true,
    };
  }

  if (
    code.startsWith("ERR_SSL_") ||
    code.startsWith("ERR_TLS_") ||
    code === "EPROTO"
  ) {
    return {
      ...metadata,
      code: "certificate",
      message: `HTTPS 加密连接失败（${detail}）。`,
    };
  }

  if (code === "POCKETLAB_RESPONSE_TOO_LARGE") {
    return {
      ...metadata,
      code: "response_too_large",
      message: "服务商返回的内容超过后端安全限制。",
    };
  }

  const safeMessage = redactText(error && error.message, secrets);
  return {
    ...metadata,
    code: "network",
    message: `网络请求未完成（${detail}${safeMessage ? `；${safeMessage}` : ""}）。`,
  };
}

function requestOnce(options, redirectCount = 0) {
  return new Promise((resolve) => {
    const parsedUrl = new URL(options.url);
    const client = parsedUrl.protocol === "https:" ? https : http;
    const context = {
      phase: "connecting",
      remoteAddress: "",
      remotePort: 0,
    };
    const requestOptions = {
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || undefined,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      method: options.method,
      headers: options.headers,
      agent: false,
    };
    if (options.family === 4 || options.family === 6) {
      requestOptions.family = options.family;
    }
    if (options.localAddress) {
      requestOptions.localAddress = options.localAddress;
    }
    if (options.tlsVersion === "TLSv1.2") {
      requestOptions.minVersion = "TLSv1.2";
      requestOptions.maxVersion = "TLSv1.2";
      requestOptions.ALPNProtocols = ["http/1.1"];
    }

    let settled = false;
    let timeoutHandle = null;
    let timeoutTriggered = false;
    let request = null;

    const settle = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      resolve(result);
    };

    const fail = (error) => {
      if (timeoutTriggered) {
        error = new Error("POCKETLAB_TIMEOUT");
        error.code = "POCKETLAB_TIMEOUT";
      }
      settle({
        ok: false,
        transportError: classifyError(error, context, options.secrets),
      });
    };

    try {
      request = client.request(requestOptions, (response) => {
        context.phase = "reading_response";
        const statusCode = Number(response.statusCode || 0);
        const location = response.headers.location;

        if (
          location &&
          [301, 302, 303, 307, 308].includes(statusCode) &&
          redirectCount < MAX_REDIRECTS
        ) {
          response.resume();
          let nextUrl;
          try {
            nextUrl = new URL(location, parsedUrl);
          } catch {
            settle({
              ok: false,
              transportError: {
                code: "redirect",
                message: "接口地址返回了无效的跳转地址。",
              },
            });
            return;
          }

          if (nextUrl.protocol !== "http:" && nextUrl.protocol !== "https:") {
            settle({
              ok: false,
              transportError: {
                code: "redirect",
                message: "接口地址返回了不受支持的跳转地址。",
              },
            });
            return;
          }

          const nextHeaders = { ...options.headers };
          if (!isSameOrigin(parsedUrl, nextUrl)) {
            removeHeader(nextHeaders, "Authorization");
          }

          const nextMethod = statusCode === 303 ? "GET" : options.method;
          const nextBody = statusCode === 303 ? "" : options.body;
          if (nextMethod === "GET") {
            removeHeader(nextHeaders, "Content-Length");
            removeHeader(nextHeaders, "Content-Type");
          }

          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
            timeoutHandle = null;
          }
          requestOnce(
            {
              ...options,
              url: nextUrl.toString(),
              headers: nextHeaders,
              method: nextMethod,
              body: nextBody,
            },
            redirectCount + 1,
          ).then(settle);
          return;
        }

        const chunks = [];
        let totalBytes = 0;
        response.on("data", (chunk) => {
          totalBytes += chunk.length;
          if (totalBytes > MAX_RESPONSE_BYTES) {
            const sizeError = new Error("POCKETLAB_RESPONSE_TOO_LARGE");
            sizeError.code = "POCKETLAB_RESPONSE_TOO_LARGE";
            request.destroy(sizeError);
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          settle({
            ok: true,
            statusCode,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
        response.on("error", (error) => {
          fail(error);
        });
        response.on("aborted", () => {
          const aborted = new Error("POCKETLAB_RESPONSE_INTERRUPTED");
          aborted.code = "POCKETLAB_RESPONSE_INTERRUPTED";
          fail(aborted);
        });
      });
    } catch (error) {
      fail(error);
      return;
    }

    request.on("socket", (socket) => {
      const captureAddress = () => {
        if (socket.remoteAddress) {
          context.remoteAddress = socket.remoteAddress;
        }
        if (socket.remotePort) {
          context.remotePort = socket.remotePort;
        }
      };

      captureAddress();
      socket.once("connect", () => {
        captureAddress();
        context.phase = parsedUrl.protocol === "https:"
          ? "tls_handshake"
          : "sending_request";
      });
      socket.once("secureConnect", () => {
        captureAddress();
        context.phase = "sending_request";
      });
    });

    request.on("finish", () => {
      if (!settled) {
        context.phase = "awaiting_response";
      }
    });

    timeoutHandle = setTimeout(() => {
      timeoutTriggered = true;
      const timeoutError = new Error("POCKETLAB_TIMEOUT");
      timeoutError.code = "POCKETLAB_TIMEOUT";
      request.destroy(timeoutError);
    }, Math.max(1000, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS));

    request.on("error", (error) => {
      fail(error);
    });

    if (options.method !== "GET" && options.body) {
      request.write(options.body);
    }
    request.end();
  });
}

function buildFetchHeaders(originalHeaders) {
  const blocked = new Set([
    "accept-encoding",
    "connection",
    "content-length",
    "host",
    "transfer-encoding",
  ]);
  const headers = {};

  for (const [name, value] of Object.entries(buildCompatibilityHeaders(originalHeaders))) {
    if (
      !name ||
      value === undefined ||
      value === null ||
      blocked.has(name.toLowerCase()) ||
      /[\r\n]/.test(name) ||
      /[\r\n]/.test(String(value))
    ) {
      continue;
    }
    headers[name] = String(value);
  }

  return headers;
}

async function requestWithFetchOnce(options, redirectCount = 0) {
  const parsedUrl = new URL(options.url);
  const controller = new AbortController();
  let timedOut = false;
  let phase = parsedUrl.protocol === "https:" ? "tls_handshake" : "connecting";
  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS);
  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    let response;
    try {
      response = await fetch(parsedUrl, {
        method: options.method,
        headers: options.headers,
        body: options.method === "GET" || options.method === "HEAD"
          ? undefined
          : options.body,
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      if (timedOut) {
        const timeoutError = new Error("POCKETLAB_TIMEOUT");
        timeoutError.code = "POCKETLAB_TIMEOUT";
        error = timeoutError;
      }
      return {
        ok: false,
        transportError: classifyError(error, { phase }, options.secrets || []),
      };
    }

    phase = "reading_response";
    const statusCode = Number(response.status || 0);
    const location = response.headers.get("location");

    if (
      location &&
      [301, 302, 303, 307, 308].includes(statusCode) &&
      redirectCount < MAX_REDIRECTS
    ) {
      try {
        await response.body?.cancel();
      } catch {
      }

      let nextUrl;
      try {
        nextUrl = new URL(location, parsedUrl);
      } catch {
        return {
          ok: false,
          transportError: {
            code: "redirect",
            phase: "reading_response",
            message: "接口地址返回了无效的跳转地址。",
          },
        };
      }

      if (nextUrl.protocol !== "http:" && nextUrl.protocol !== "https:") {
        return {
          ok: false,
          transportError: {
            code: "redirect",
            phase: "reading_response",
            message: "接口地址返回了不受支持的跳转地址。",
          },
        };
      }

      const nextHeaders = { ...options.headers };
      if (!isSameOrigin(parsedUrl, nextUrl)) {
        removeHeader(nextHeaders, "Authorization");
      }

      const nextMethod = statusCode === 303 ? "GET" : options.method;
      const nextBody = statusCode === 303 ? "" : options.body;
      if (nextMethod === "GET") {
        removeHeader(nextHeaders, "Content-Type");
        removeHeader(nextHeaders, "Content-Length");
      }

      clearTimeout(timeoutHandle);
      return requestWithFetchOnce(
        {
          ...options,
          url: nextUrl.toString(),
          headers: nextHeaders,
          method: nextMethod,
          body: nextBody,
        },
        redirectCount + 1,
      );
    }

    if (!response.body) {
      return {
        ok: true,
        statusCode,
        body: "",
      };
    }

    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        const chunk = Buffer.from(value);
        totalBytes += chunk.length;
        if (totalBytes > MAX_RESPONSE_BYTES) {
          try {
            await reader.cancel();
          } catch {
          }
          return {
            ok: false,
            transportError: {
              code: "response_too_large",
              phase: "reading_response",
              message: "服务商返回的内容超过后端安全限制。",
            },
          };
        }
        chunks.push(chunk);
      }
    } catch (error) {
      if (timedOut) {
        const timeoutError = new Error("POCKETLAB_TIMEOUT");
        timeoutError.code = "POCKETLAB_TIMEOUT";
        error = timeoutError;
      }
      return {
        ok: false,
        transportError: classifyError(error, { phase }, options.secrets || []),
      };
    }

    return {
      ok: true,
      statusCode,
      body: Buffer.concat(chunks).toString("utf8"),
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function isRetryableResult(result) {
  return Boolean(
    result &&
    !result.ok &&
    result.transportError &&
    (result.transportError.retryable ||
      result.transportError.code === "connection_reset"),
  );
}

function makeAttemptSummary(attempt, transport, result) {
  if (result.ok) {
    return {
      attempt,
      transport,
      statusCode: result.statusCode,
    };
  }
  const error = result.transportError || {};
  return {
    attempt,
    transport,
    code: String(error.code || "network"),
    phase: String(error.phase || ""),
    rawCode: String(error.rawCode || ""),
    remoteAddress: String(error.remoteAddress || ""),
    remotePort: Number(error.remotePort || 0),
  };
}

function buildCompatibilityHeaders(originalHeaders) {
  return {
    ...originalHeaders,
    Connection: "close",
    "Accept-Encoding": "identity",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 PocketLab/1.0 compatibility retry",
  };
}

function formatAttemptDetails(attempts) {
  return attempts
    .map((attempt) => {
      const parts = [
        `第 ${attempt.attempt} 次：${getPhaseLabel(attempt.phase)}`,
      ];
      if (attempt.rawCode) {
        parts.push(attempt.rawCode);
      }
      if (attempt.remoteAddress) {
        parts.push(attempt.remotePort
          ? `远端 ${attempt.remoteAddress}:${attempt.remotePort}`
          : `远端 ${attempt.remoteAddress}`);
      }
      return parts.join("，");
    })
    .join("；");
}

function formatAttemptCount(count) {
  const labels = {
    1: "一次尝试",
    2: "两次尝试",
    3: "三次尝试",
    4: "四次尝试",
  };
  return labels[count] || `${count} 次尝试`;
}

function buildTransportFailure(attempts, requestUrl = "") {
  const details = formatAttemptDetails(attempts);
  const phases = attempts.map((attempt) => attempt.phase);
  const attemptCount = formatAttemptCount(attempts.length);
  const triedLocalInterface = attempts.some((attempt) => attempt.transport === "node-lan");
  const triedFetchCompatibility = attempts.some((attempt) => attempt.transport === "node-fetch");
  const backendContext =
    "页面已经连接到濴星语后端服务，说明浏览器到后端这一段正常；失败发生在后端到模型服务商这一段。";
  let endpointHostname = "";
  try {
    endpointHostname = new URL(requestUrl).hostname;
  } catch {
  }
  const ipAddressHint = net.isIP(endpointHostname)
    ? `当前接口地址填写的是 IP 地址（${endpointHostname}）。只有服务商文档明确给出 IP 时才这样填写；否则请从文档重新复制域名形式的地址，不要用解析后的 IP 代替域名。`
    : endpointHostname
      ? `当前接口域名是 ${endpointHostname}。请保留服务商文档中的域名，不要把接口地址改成错误信息里的远端 IP。`
      : "请检查后端运行环境的网络，或只把服务商文档中的接口域名发给我继续诊断。";
  const reachedRequestPhase = phases.some((phase) =>
    ["sending_request", "awaiting_response", "reading_response"].includes(phase));

  if (phases.includes("reading_response")) {
    return {
      message: `${backendContext}服务商已经返回部分内容，但连接随后中断（${details}）。`,
      nextStep: "已经收到响应但未完整读取。请先检查后端网络、代理或 HTTPS 扫描；若使用本地测试版，可重启本地服务后再试。",
    };
  }

  if (reachedRequestPhase) {
    return {
      message: `${backendContext}HTTPS 连接已经进入发送或等待响应阶段，但随后被中断（${details}）。`,
      nextStep: "请求可能已经到达服务商。请稍后重试，并避免连续点击；如果持续失败，请检查后端网络、VPN、代理或安全软件的网络扫描。",
    };
  }

  if (phases.includes("tls_handshake")) {
    const interfaceAttempt = triedLocalInterface
      ? "，并固定从正常 Wi-Fi/以太网网卡发出"
      : "";
    const nextAction = triedLocalInterface
      ? "程序已尝试避开本地虚拟网卡。请再确认后端所在环境的 VPN、代理和防火墙设置，然后点一次“连接测试”。"
      : "请先检查后端所在环境的 VPN、代理和防火墙，再点一次“连接测试”。";
    const fetchAttempt = triedFetchCompatibility ? "、Node Fetch 兼容连接" : "";
    return {
      message: `${backendContext}${attemptCount}都没能完成与接口服务器的 HTTPS 加密连接（${details}）；程序已尝试普通连接、TLS 1.2 兼容连接${interfaceAttempt}${fetchAttempt}，模型服务商没有接受本次 HTTPS 请求。`,
      nextStep: `${nextAction}如果仍然失败，请检查后端网络的出口 IP、服务商地区限制或云服务器访问策略。${ipAddressHint}此阶段不要先修改 API Key。`,
    };
  }

  return {
    message: `${backendContext}${attemptCount}都没能连接到接口服务器（${details}）；请求尚未完成。`,
    nextStep: `先检查后端网络、VPN、代理或防火墙，再点一次“连接测试”。如果仍然失败，请检查后端出口 IP 或服务商访问策略。${ipAddressHint}此阶段不需要重新填写 API Key。`,
  };
}

async function requestWithRecovery(input) {
  const startedAt = Date.now();
  const timeoutMs = Math.max(1000, Number(input.timeoutMs) || DEFAULT_TIMEOUT_MS);
  const deadline = startedAt + timeoutMs;
  const secrets = input.secrets || [];
  const attempts = [];
  const localAddress = getPreferredLocalIPv4();
  const attemptPlan = [
    {
      kind: "direct",
      family: 0,
      tlsVersion: "",
      compatibility: false,
      transport: "node",
    },
    {
      kind: "compatibility",
      family: 4,
      tlsVersion: "TLSv1.2",
      compatibility: true,
      transport: "node-compat",
    },
  ];

  if (localAddress) {
    attemptPlan.push({
      kind: "lan",
      family: 4,
      tlsVersion: "TLSv1.2",
      compatibility: true,
      localAddress,
      transport: "node-lan",
    });
  }

  for (let attempt = 1; attempt <= attemptPlan.length; attempt += 1) {
    const remainingMs = deadline - Date.now();
    if (remainingMs < 100) {
      break;
    }

    const plan = attemptPlan[attempt - 1];
    const attemptTimeoutMs = remainingMs;
    const attemptHeaders = plan.compatibility
      ? buildCompatibilityHeaders(input.headers)
      : { ...input.headers };
    const result = await requestOnce({
      url: input.url,
      method: input.method,
      headers: attemptHeaders,
      body: input.body,
      timeoutMs: attemptTimeoutMs,
      family: plan.family,
      tlsVersion: plan.tlsVersion,
      localAddress: plan.localAddress,
      secrets,
    });
    attempts.push(makeAttemptSummary(attempt, plan.transport, result));

    if (result.ok) {
      return {
        ...result,
        recovery: plan.kind === "direct"
          ? "direct"
          : plan.kind === "lan"
            ? "lan-interface-retry"
            : "compatibility-retry",
        attempts,
      };
    }

    if (!isRetryableResult(result)) {
      return {
        ...result,
        attempts,
      };
    }

    if (attempt < attemptPlan.length) {
      await new Promise((resolve) => {
        setTimeout(resolve, 200);
      });
    }
  }

  if (attempts.length === 0) {
    const timeoutError = new Error("POCKETLAB_TIMEOUT");
    timeoutError.code = "POCKETLAB_TIMEOUT";
    return {
      ok: false,
      transportError: classifyError(timeoutError, { phase: "connecting" }, secrets),
      attempts,
      recovery: "none",
    };
  }

  const remainingMs = deadline - Date.now();
  if (remainingMs >= 1000 && attempts.length > 0) {
    const fetchResult = await requestWithFetchOnce({
      url: input.url,
      method: input.method,
      headers: buildFetchHeaders(input.headers),
      body: input.body,
      timeoutMs: remainingMs,
      secrets,
    });
    attempts.push(makeAttemptSummary(attempts.length + 1, "node-fetch", fetchResult));

    if (fetchResult.ok) {
      return {
        ...fetchResult,
        recovery: "fetch-compatibility-retry",
        attempts,
      };
    }

    if (!isRetryableResult(fetchResult)) {
      return {
        ...fetchResult,
        attempts,
      };
    }
  }

  const lastAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
  const failure = buildTransportFailure(attempts, input.url);
  return {
    ok: false,
    transportError: {
      code: lastAttempt && lastAttempt.code ? lastAttempt.code : "connection_reset",
      message: failure.message,
      nextStep: failure.nextStep,
      attempts,
    },
    attempts,
    recovery: attempts.some((attempt) => attempt.transport === "node-fetch")
      ? "node-fetch-only"
      : "node-only",
  };
}

async function readStandardInput() {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of process.stdin) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_INPUT_BYTES) {
      return null;
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const inputText = await readStandardInput();
  if (inputText === null) {
    writeResult({
      ok: false,
      transportError: {
        code: "request_too_large",
        message: "后端请求内容超过安全限制。",
      },
    });
    return;
  }

  let input;
  try {
    input = JSON.parse(inputText);
  } catch {
    writeResult({
      ok: false,
      transportError: {
        code: "invalid_request",
        message: "后端请求格式不正确。",
      },
    });
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(String(input.url || ""));
  } catch {
    writeResult({
      ok: false,
      transportError: {
        code: "invalid_url",
        message: "接口地址格式不正确。",
      },
    });
    return;
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    writeResult({
      ok: false,
      transportError: {
        code: "invalid_url",
        message: "接口地址只支持 HTTP 或 HTTPS。",
      },
    });
    return;
  }

  const body = String(input.body || "");
  const method = String(input.method || "POST").toUpperCase();
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body, "utf8"),
    "User-Agent": "PocketLab/1.0",
  };

  for (const [name, value] of Object.entries(input.headers || {})) {
    const normalizedName = String(name || "").toLowerCase();
    if (
      !name ||
      value === undefined ||
      value === null ||
      normalizedName === "content-length" ||
      normalizedName === "host" ||
      /[\r\n]/.test(name) ||
      /[\r\n]/.test(String(value))
    ) {
      continue;
    }
    headers[name] = String(value);
  }
  headers["Content-Length"] = Buffer.byteLength(body, "utf8");

  const bearerToken = getBearerToken(headers);
  if (!bearerToken) {
    writeResult({
      ok: false,
      transportError: {
        code: "invalid_request",
        message: "后端请求缺少可用的 API 认证信息。",
      },
    });
    return;
  }

  const result = await requestWithRecovery({
    url: parsedUrl.toString(),
    method,
    headers,
    body,
    timeoutMs: Number(input.timeoutMs) || DEFAULT_TIMEOUT_MS,
    secrets: [bearerToken],
  });
  writeResult(result);
}

if (require.main === module) {
  process.on("uncaughtException", () => {
    writeResult({
      ok: false,
      transportError: {
        code: "transport_internal",
        message: "后端连接组件发生内部错误。",
      },
    });
  });

  main().catch(() => {
    writeResult({
      ok: false,
      transportError: {
        code: "transport_internal",
        message: "后端连接组件发生内部错误。",
      },
    });
  });
} else {
  module.exports = {
    buildFetchHeaders,
    getPreferredLocalIPv4,
    requestWithFetchOnce,
    requestWithRecovery,
    buildTransportFailure,
  };
}
