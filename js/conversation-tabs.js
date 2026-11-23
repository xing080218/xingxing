"use strict";

(() => {
  const tabCopy = {
    chat: {
      eyebrow: "CHARACTERS",
      title: "人物列表",
    },
    moments: {
      eyebrow: "MOMENTS",
      title: "朋友圈",
    },
  };

  let elements = null;
  let activeTab = "chat";

  function cacheElements() {
    const tablist = document.querySelector(".conversation-bottom-tabs");
    if (!tablist) return null;

    return {
      tablist,
      tabs: Array.from(tablist.querySelectorAll("[data-conversation-tab]")),
      panels: {
        chat: document.getElementById("conversation-chat-panel"),
        moments: document.getElementById("conversation-moments-panel"),
      },
      title: document.getElementById("conversation-app-title"),
      eyebrow: document.getElementById("conversation-app-eyebrow"),
      view: document.getElementById("character-list-view"),
      addControl: document.querySelector(
        "#character-list-view .character-add-control",
      ),
    };
  }

  function activateTab(tabName, options = {}) {
    if (!elements || !tabCopy[tabName] || tabName === activeTab) {
      if (options.focus) {
        elements?.tabs.find((tab) => tab.dataset.conversationTab === tabName)?.focus();
      }
      return;
    }

    activeTab = tabName;
    const copy = tabCopy[tabName];

    elements.tabs.forEach((tab) => {
      const isActive = tab.dataset.conversationTab === tabName;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
      if (isActive && options.focus) {
        tab.focus();
      }
    });

    Object.entries(elements.panels).forEach(([name, panel]) => {
      if (!panel) return;
      const isActive = name === tabName;
      panel.hidden = !isActive;
      panel.classList.toggle("is-active", isActive);
      panel.setAttribute("aria-hidden", String(!isActive));
    });

    if (elements.title) {
      elements.title.textContent = copy.title;
    }
    if (elements.eyebrow) {
      elements.eyebrow.textContent = copy.eyebrow;
    }
    if (elements.view) {
      elements.view.setAttribute("aria-label", copy.title);
    }
    if (elements.addControl) {
      elements.addControl.hidden = tabName !== "chat";
    }

    window.dispatchEvent(
      new CustomEvent("pocketlab:conversation-tab-changed", {
        detail: { tab: tabName },
      }),
    );
  }

  function handleTabClick(event) {
    const target =
      event.target instanceof Element
        ? event.target
        : event.target?.parentElement;
    const tab = target?.closest("[data-conversation-tab]");
    if (!tab || !elements.tablist.contains(tab)) return;
    activateTab(tab.dataset.conversationTab);
  }

  function handleTabKeydown(event) {
    const currentIndex = elements.tabs.indexOf(event.target);
    if (currentIndex < 0) return;

    let nextIndex = currentIndex;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + elements.tabs.length) % elements.tabs.length;
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % elements.tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = elements.tabs.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    activateTab(elements.tabs[nextIndex].dataset.conversationTab, {
      focus: true,
    });
  }

  function initialize() {
    elements = cacheElements();
    if (!elements) return;

    elements.panels.chat?.classList.add("is-active");
    elements.panels.chat?.setAttribute("aria-hidden", "false");
    elements.panels.moments?.classList.remove("is-active");
    elements.panels.moments?.setAttribute("aria-hidden", "true");
    if (elements.addControl) {
      elements.addControl.hidden = false;
    }

    elements.tablist.addEventListener("click", handleTabClick);
    elements.tablist.addEventListener("keydown", handleTabKeydown);
  }

  window.PocketLabConversationTabs = {
    reset() {
      activateTab("chat");
    },
    getActiveTab() {
      return activeTab;
    },
  };

  document.addEventListener("DOMContentLoaded", initialize);
})();
