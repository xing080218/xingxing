"use strict";

(() => {
  const BUILD = "20261123-18";
  const status = document.getElementById("connection-status");
  const phoneMainAddress = document.getElementById("phone-main-address");
  const phoneCheckAddress = document.getElementById("phone-check-address");
  const phoneMainLink = document.getElementById("phone-main-link");
  const phoneCheckLink = document.getElementById("phone-check-link");

  if (
    !status ||
    !phoneMainAddress ||
    !phoneCheckAddress ||
    !phoneMainLink ||
    !phoneCheckLink
  ) {
    return;
  }

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  function isPrivateIPv4(hostname) {
    const parts = String(hostname || "").split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
      return false;
    }
    return (
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168)
    );
  }

  function currentPrivateUrl() {
    const hostname = window.location.hostname;
    if (!isPrivateIPv4(hostname)) {
      return "";
    }
    return window.location.protocol + "//" + window.location.host;
  }

  function trimTrailingSlash(value) {
    return String(value || "").replace(/\/+$/, "");
  }

  function pageUrl(base, page, query = "") {
    return trimTrailingSlash(base) + "/" + page + "?v=" + BUILD + query;
  }

  function setPhoneLinks(base) {
    const mainUrl = pageUrl(base, "");
    const checkUrl = pageUrl(base, "mobile-check.html");
    phoneMainAddress.textContent = mainUrl;
    phoneCheckAddress.textContent = checkUrl;
    phoneMainLink.href = mainUrl;
    phoneCheckLink.href = checkUrl;
  }

  function showUnavailable(message) {
    setStatus(message, true);
    phoneMainAddress.textContent = "没有检测到可用的电脑 Wi-Fi 地址";
    phoneCheckAddress.textContent = "请确认电脑已经连接 Wi-Fi 或以太网，然后刷新本页";
    phoneMainLink.removeAttribute("href");
    phoneCheckLink.removeAttribute("href");
  }

  async function loadConnectionInfo() {
    const fallback = currentPrivateUrl();
    const controller =
      typeof AbortController === "function" ? new AbortController() : null;
    const timer = window.setTimeout(() => {
      if (controller) controller.abort();
    }, 8000);

    try {
      const response = await fetch(
        "/api/health?build=" + encodeURIComponent(BUILD) + "&from=connect&t=" + Date.now(),
        {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller ? controller.signal : undefined,
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || payload.ok !== true) {
        throw new Error("电脑服务返回 HTTP " + response.status);
      }
      if (payload.build !== BUILD) {
        throw new Error(
          "电脑仍在运行旧版本 " +
            (payload.build || "未知") +
            "，请关闭旧启动窗口并重新双击 start.bat",
        );
      }

      const phoneBase =
        currentPrivateUrl() ||
        trimTrailingSlash(payload.primaryPhoneUrl) ||
        trimTrailingSlash((payload.lanUrls || [])[0]);
      if (!phoneBase) {
        showUnavailable(
          "电脑服务已连通，但没有检测到可用的局域网地址。请确认电脑已连接 Wi-Fi 或以太网，然后刷新本页。",
        );
        return;
      }

      setPhoneLinks(phoneBase);
      setStatus(
        `电脑服务已连通（版本 ${payload.build}）。请把上面的手机地址输入手机浏览器，不要使用旧二维码或旧地址。`,
      );
    } catch (error) {
      if (fallback) {
        setPhoneLinks(fallback);
        setStatus(
          "电脑服务正在响应页面请求，但二次状态检查没有完成。已显示当前页面使用的局域网地址；请直接在手机上打开上面的地址，必要时刷新本页。",
          true,
        );
        return;
      }
      showUnavailable(
        "无法读取电脑当前的局域网地址：" +
          (error && error.message ? error.message : "浏览器没有返回原因") +
          "。请保留启动窗口并重新双击 start.bat，然后刷新本页。",
      );
    } finally {
      window.clearTimeout(timer);
    }
  }

  loadConnectionInfo();
})();
