"use strict";

(() => {
  const BUILD = "20261125-12";
  const HEALTH_TIMEOUT_MS = 6500;
  const APP_START_TIMEOUT_MS = 9000;

  const state = {
    health: "pending",
    appReady: false,
    failure: null,
    healthError: null,
    diagnostics: [],
    appStartedAt: 0,
  };

  const elements = {};
  let watchdog = null;
  let initialized = false;

  function byId(id) {
    return document.getElementById(id);
  }

  function safeErrorText(value) {
    const raw =
      value && typeof value === "object" && "message" in value
        ? value.message
        : value;
    const text = String(raw || "没有返回详细原因。")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > 220 ? `${text.slice(0, 217)}...` : text;
  }

  function record(message) {
    const text = String(message || "").trim();
    if (!text || state.diagnostics[state.diagnostics.length - 1] === text) {
      return;
    }
    const stamp = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    state.diagnostics.push(`${stamp} ${text}`);
    if (state.diagnostics.length > 12) {
      state.diagnostics.shift();
    }
    if (elements.details) {
      elements.details.textContent = state.diagnostics.join("\n");
    }
  }

  function setStep(name, status, label) {
    const item = document.querySelector(`[data-bootstrap-step="${name}"]`);
    if (!item) return;
    item.dataset.state = status;
    const marker = item.querySelector(".bootstrap-step-marker");
    const copy = item.querySelector("span:last-child");
    if (marker) marker.textContent = status === "ok" ? "✓" : status === "failed" ? "!" : name === "page" ? "1" : name === "service" ? "2" : "3";
    if (copy && label) copy.textContent = label;
  }

  function setHeadline(title, message, isError = false) {
    if (elements.title) elements.title.textContent = title;
    if (elements.message) elements.message.textContent = message;
    if (!elements.status) return;
    elements.status.classList.toggle("is-error", isError);
    elements.status.classList.remove("is-hidden");
    elements.status.removeAttribute("aria-hidden");
  }

  function showFailure(title, message, nextStep) {
    state.failure = { title, message, nextStep };
    setHeadline(title, `${message} ${nextStep}`, true);
    if (elements.status) {
      elements.status.classList.add("is-error");
    }
    setDetailsVisible(true);
  }

  function setDetailsVisible(visible) {
    if (!elements.details) return;
    elements.details.classList.toggle("is-hidden", !visible);
    if (elements.detailsToggle) {
      elements.detailsToggle.textContent = visible ? "收起诊断信息" : "显示诊断信息";
      elements.detailsToggle.setAttribute("aria-expanded", String(visible));
    }
  }

  function hideOverlay() {
    if (!elements.status) return;
    elements.status.classList.add("is-hidden");
    elements.status.setAttribute("aria-hidden", "true");
    document.documentElement.dataset.pocketLabReady = "true";
  }

  function showHealthWarning(error) {
    if (!elements.healthWarning) return;
    const reason = safeErrorText(error);
    if (elements.healthWarningMessage) {
      elements.healthWarningMessage.textContent =
        `页面和小手机已经启动，但本地状态检查没有及时完成：${reason}`;
    }
    if (elements.healthWarningNext) {
      elements.healthWarningNext.textContent =
        "先继续使用小手机；若反复出现，再重新检查，或打开连接检查页确认手机到电脑这一段。";
    }
    elements.healthWarning.classList.remove("is-hidden");
    elements.healthWarning.removeAttribute("aria-hidden");
  }

  function hideHealthWarning() {
    if (!elements.healthWarning) return;
    elements.healthWarning.classList.add("is-hidden");
    elements.healthWarning.setAttribute("aria-hidden", "true");
  }

  function maybeFinish() {
    if (state.failure || !state.appReady) return;
    setStep("app", "ok", "聊天界面已启动");
    record("聊天界面初始化完成。");
    hideOverlay();
    if (state.health === "failed") {
      showHealthWarning(state.healthError);
    }
  }

  async function checkLocalService(options = {}) {
    if (options.manual) {
      hideHealthWarning();
      if (elements.healthWarningRetry) {
        elements.healthWarningRetry.disabled = true;
        elements.healthWarningRetry.textContent = "检查中";
      }
    }
    state.health = "pending";
    state.healthError = null;
    setStep("service", "running", "正在确认本地服务");
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = window.setTimeout(() => {
      if (controller) controller.abort();
    }, HEALTH_TIMEOUT_MS);

    try {
      const response = await fetch(`/api/health?build=${BUILD}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller ? controller.signal : undefined,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || payload.ok !== true) {
        throw new Error(`本地服务返回 HTTP ${response.status}`);
      }
      state.health = "ok";
      setStep("service", "ok", "本地服务已连通");
      record(`本地服务健康检查通过（${response.status}）。`);
      hideHealthWarning();
    } catch (error) {
      state.health = "failed";
      state.healthError = error;
      setStep("service", "failed", "本地服务没有响应");
      record(`本地服务健康检查失败：${safeErrorText(error)}`);
      if (state.appReady) {
        showHealthWarning(error);
      }
    } finally {
      window.clearTimeout(timer);
      if (elements.healthWarningRetry) {
        elements.healthWarningRetry.disabled = false;
        elements.healthWarningRetry.textContent = "重新检查";
      }
    }
  }

  function bindActions() {
    if (elements.retry) {
      elements.retry.addEventListener("click", () => window.location.reload());
    }
    if (elements.detailsToggle) {
      elements.detailsToggle.addEventListener("click", () => {
        setDetailsVisible(elements.details.classList.contains("is-hidden"));
      });
    }
    if (elements.healthWarningRetry) {
      elements.healthWarningRetry.addEventListener("click", () => {
        checkLocalService({ manual: true });
      });
    }
    if (elements.healthWarningDismiss) {
      elements.healthWarningDismiss.addEventListener("click", hideHealthWarning);
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;
    elements.status = byId("bootstrap-status");
    elements.title = byId("bootstrap-title");
    elements.message = byId("bootstrap-message");
    elements.build = byId("bootstrap-build");
    elements.retry = byId("bootstrap-retry");
    elements.detailsToggle = byId("bootstrap-details-toggle");
    elements.details = byId("bootstrap-details");
    elements.healthWarning = byId("service-warning");
    elements.healthWarningMessage = byId("service-warning-message");
    elements.healthWarningNext = byId("service-warning-next");
    elements.healthWarningRetry = byId("service-warning-retry");
    elements.healthWarningDismiss = byId("service-warning-dismiss");
    state.appStartedAt = Date.now();
    if (elements.build) {
      elements.build.textContent = `启动版本 ${BUILD}`;
    }
    bindActions();
    setStep("page", "ok", "页面文件已接收");
    record(`页面已打开，启动版本 ${BUILD}，地址 ${window.location.origin}。`);
    record(`浏览器 ${navigator.userAgent || "未知"}`);
    checkLocalService();
    watchdog = window.setTimeout(() => {
      if (state.appReady || state.failure) return;
      setStep("app", "failed", "聊天界面没有完成启动");
      record("等待聊天界面初始化超时。");
      showFailure(
        "聊天界面没有完成启动",
        "页面和本地服务已经到了电脑，但聊天程序超过 9 秒仍未准备完成。",
        "请打开纯文字检查页；如果检查页正常，再返回这里重新加载。",
      );
    }, APP_START_TIMEOUT_MS);
  }

  window.PocketLabBootstrap = {
    complete() {
      state.appReady = true;
      window.clearTimeout(watchdog);
      setStep("app", "ok", "聊天界面已启动");
      maybeFinish();
    },
    fail(title, message, nextStep) {
      window.clearTimeout(watchdog);
      setStep("app", "failed", "聊天界面启动失败");
      record(`${title}：${message}`);
      showFailure(
        title || "聊天界面启动失败",
        message || "页面程序没有完成初始化。",
        nextStep || "请重新加载页面；如果仍失败，请把检查页显示的结果告诉维护者。",
      );
    },
    stage(message) {
      setStep("app", "running", message || "正在启动聊天界面");
      record(message || "正在启动聊天界面。");
    },
    get build() {
      return BUILD;
    },
  };

  window.addEventListener(
    "error",
    (event) => {
      const target = event && event.target;
      if (target && target.tagName === "SCRIPT") {
        const src = target.src || "未知脚本";
        record(`脚本加载失败：${src}`);
        window.PocketLabBootstrap.fail(
          "页面脚本没有加载成功",
          "聊天界面需要的脚本文件没有从电脑取回。",
          "请重新加载页面；如果仍失败，先打开纯文字检查页，再换用当前 Wi-Fi 地址重试。",
        );
        return;
      }
      const message = safeErrorText(event && (event.error || event.message));
      record(`运行时错误：${message}`);
      window.PocketLabBootstrap.fail(
        "聊天界面发生错误",
        message,
        "请重新加载页面；如果每次都在同一步失败，请把这里的诊断文字告诉维护者。",
      );
    },
    true,
  );

  window.addEventListener("unhandledrejection", (event) => {
    const message = safeErrorText(event && event.reason);
    record(`未处理的异步错误：${message}`);
    window.PocketLabBootstrap.fail(
      "聊天界面发生异步错误",
      message,
      "请重新加载页面；如果仍失败，请先打开纯文字检查页确认手机到电脑这一段正常。",
    );
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      window.location.reload();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
