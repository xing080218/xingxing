"use strict";

(function () {
  var BUILD = "20261123-02";
  var TIMEOUT_MS = 8000;
  var status = document.getElementById("live-status");
  var button = document.getElementById("check-now");
  var entry = document.getElementById("phone-entry");
  var entryLink = document.getElementById("phone-entry-link");
  var diagnostics = document.getElementById("diagnostics");

  if (!status || !button || !entry || !entryLink || !diagnostics) {
    return;
  }

  var origin =
    window.location.origin ||
    window.location.protocol + "//" + window.location.host;
  var mainUrl = origin + "/?v=" + BUILD;
  entry.textContent = mainUrl;
  entryLink.href = "/?v=" + BUILD;

  function setStatus(message, isError) {
    status.className = isError ? "live-status is-error" : "live-status";
    status.textContent = message;
  }

  function formatTime(value) {
    var date = new Date(value);
    if (isNaN(date.getTime())) {
      return "未知";
    }
    return date.toLocaleTimeString("zh-CN", { hour12: false });
  }

  function errorText(error) {
    if (error && error.message) {
      return error.message;
    }
    return "浏览器没有返回具体原因";
  }

  function finish() {
    button.disabled = false;
    button.textContent = "重新检查当前服务";
  }

  function checkService() {
    var finished = false;
    var controller =
      typeof AbortController === "function" ? new AbortController() : null;
    var timer = window.setTimeout(function () {
      if (finished) {
        return;
      }
      finished = true;
      if (controller) {
        controller.abort();
      }
      setStatus(
        "检查页已经打开，但 8 秒内没有完成电脑服务的二次状态检查。手机到电脑的网页连接已经成功；请刷新本页，或直接从本页打开小手机。若重复出现，再检查 Safari 的本地网络权限和内容拦截器。",
        true
      );
      diagnostics.textContent =
        "当前地址：" +
        window.location.href +
        "\n服务版本：" +
        BUILD +
        "\n状态：同一来源的健康检查超时；这不是 API Key 错误";
      finish();
    }, TIMEOUT_MS);

    setStatus("检查页已经打开，正在确认电脑上的当前服务版本...", false);
    diagnostics.textContent =
      "当前地址：" + window.location.href + "\n期望服务版本：" + BUILD;
    button.disabled = true;
    button.textContent = "正在检查...";

    fetch(
      "/api/health?build=" +
        encodeURIComponent(BUILD) +
        "&from=mobile-check&t=" +
        Date.now(),
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller ? controller.signal : undefined
      }
    )
      .then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok || !payload || payload.ok !== true) {
            throw new Error("电脑服务返回 HTTP " + response.status);
          }
          if (payload.build !== BUILD) {
            throw new Error(
              "电脑仍运行旧版本 " +
                (payload.build || "未知") +
                "，请关闭旧启动窗口并重新双击 start.bat"
            );
          }
          return payload;
        });
      })
      .then(function (payload) {
        if (finished) {
          return;
        }
        finished = true;
        window.clearTimeout(timer);
        var phoneAddress = payload.clientAddress || "已识别到局域网设备";
        setStatus(
          "已连通当前电脑服务，版本 " +
            payload.build +
            "，服务器时间 " +
            formatTime(payload.serverTime) +
            "。",
          false
        );
        diagnostics.textContent =
          "当前地址：" +
          window.location.href +
          "\n服务版本：" +
          payload.build +
          "\n电脑看到的手机地址：" +
          phoneAddress +
          "\n结论：手机到电脑这一段已通，可以进入小手机。";
      })
      .catch(function (error) {
        if (finished) {
          return;
        }
        finished = true;
        window.clearTimeout(timer);
        setStatus(
          "检查页已经打开，但二次检查失败：" +
            errorText(error) +
            "。这不等于整页失败；请刷新本页，或重新双击 start.bat 后再试。",
          true
        );
        diagnostics.textContent =
          "当前地址：" +
          window.location.href +
          "\n期望服务版本：" +
          BUILD +
          "\n状态：" +
          errorText(error) +
          "\n下一步：确认启动窗口仍在运行；关闭内容拦截器后刷新本页。";
      })
      .then(finish, finish);
  }

  button.addEventListener("click", checkService);
  checkService();
})();
