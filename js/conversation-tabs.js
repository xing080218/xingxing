"use strict";

((root) => {
  const state = {
    activeTab: "chat",
    initialized: false,
  };
  const elements = {};

  function resolveTab(value) {
    return value === "moments" ? "moments" : "chat";
  }

  function cacheElements() {
    elements.section = root.document.getElementById("character-list-view");
    elements.title = root.document.getElementById("conversation-app-title");
    elements.eyebrow = root.document.getElementById("conversation-app-eyebrow");
    elements.addButton = root.document.getElementById(
      "add-character-from-list",
    );
    elements.publishButton = root.document.getElementById("publish-moment");
    elements.tabs = Array.from(
      root.document.querySelectorAll("[data-conversation-tab]"),
    );
    elements.panels = Array.from(
      root.document.querySelectorAll("[data-conversation-panel]"),
    );
  }

  function init() {
    if (state.initialized) return;
    cacheElements();
    if (
      !elements.section ||
      !elements.tabs.length ||
      elements.panels.length !== 2
    ) {
      throw new Error("对话分组页面没有完成加载。");
    }

    elements.tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        setActiveTab(tab.dataset.conversationTab);
      });
      tab.addEventListener("keydown", handleTabKeydown);
    });

    const initialTab = elements.tabs.find(
      (tab) =>
        tab.getAttribute("aria-selected") === "true" &&
        !tab.classList.contains("is-hidden"),
    );
    setActiveTab(initialTab?.dataset.conversationTab || "chat", {
      emit: false,
    });
    state.initialized = true;
  }

  function handleTabKeydown(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();

    const currentIndex = elements.tabs.indexOf(event.currentTarget);
    let nextIndex = currentIndex;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = elements.tabs.length - 1;
    if (event.key === "ArrowLeft") {
      nextIndex =
        (currentIndex - 1 + elements.tabs.length) % elements.tabs.length;
    }
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % elements.tabs.length;
    }

    const nextTab = elements.tabs[nextIndex];
    if (!nextTab) return;
    setActiveTab(nextTab.dataset.conversationTab);
    nextTab.focus();
  }

  function setActiveTab(value, options = {}) {
    const tabName = resolveTab(value);
    const previousTab = state.activeTab;
    state.activeTab = tabName;

    elements.tabs.forEach((tab) => {
      const isActive = tab.dataset.conversationTab === tabName;
      tab.setAttribute("aria-selected", String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
      tab.classList.toggle("is-active", isActive);
    });

    elements.panels.forEach((panel) => {
      const isActive = panel.dataset.conversationPanel === tabName;
      panel.classList.toggle("is-hidden", !isActive);
      panel.setAttribute("aria-hidden", String(!isActive));
      if (isActive && !options.preserveScroll) {
        const scrollArea = panel.querySelector(
          ".character-list-scroll, .moments-feed-scroll",
        );
        if (scrollArea) scrollArea.scrollTop = 0;
      }
    });

    elements.section.dataset.activeConversationTab = tabName;
    elements.addButton?.classList.toggle("is-hidden", tabName !== "chat");
    elements.publishButton?.classList.toggle("is-hidden", tabName !== "moments");
    if (elements.title) {
      elements.title.textContent = tabName === "moments" ? "朋友圈" : "对话";
    }
    if (elements.eyebrow) {
      elements.eyebrow.textContent =
        tabName === "moments" ? "MOMENTS" : "CHATS";
    }

    if (options.emit !== false && previousTab !== tabName) {
      root.dispatchEvent(
        new CustomEvent("pocketlab:conversation-tab-changed", {
          detail: { tab: tabName },
        }),
      );
    }
  }

  root.PocketLabConversationTabs = Object.freeze({
    init,
    getActiveTab: () => state.activeTab,
    setActiveTab,
  });
})(window);
