const icons = {
  settings:
    '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  palette:
    '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2a10 10 0 0 0 0 20 2.5 2.5 0 0 0 0-5 2.5 2.5 0 0 1 0-5h2a6 6 0 0 0 6-6c0-2.2-3.6-4-8-4Z"/>',
  smartphone:
    '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  type:
    '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
  'layout-grid':
    '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  'message-square-text':
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 8h8"/><path d="M8 12h5"/>',
  'swatch-book':
    '<path d="M11 17a4 4 0 0 1-8 0V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2Z"/><path d="M17 17a4 4 0 0 1-8 0V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2Z"/><path d="M17 17a4 4 0 0 0 8 0V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2"/>',
  sparkles:
    '<path d="m12 3-1.9 5.1a2 2 0 0 1-1.2 1.2L4 11l4.9 1.7a2 2 0 0 1 1.2 1.2L12 19l1.9-5.1a2 2 0 0 1 1.2-1.2L20 11l-4.9-1.7a2 2 0 0 1-1.2-1.2Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
  'chevron-up': '<path d="m18 15-6-6-6 6"/>',
  'lock-keyhole':
    '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1"/>',
  delete:
    '<path d="M20 5H9l-7 7 7 7h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z"/><path d="m18 9-6 6"/><path d="m12 9 6 6"/>',
  wifi:
    '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><path d="M12 20h.01"/>',
  'arrow-up': '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  'arrow-up-right': '<path d="M7 17 17 7"/><path d="M7 7h10v10"/>',
  'plug-zap':
    '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="12" height="7" x="6" y="6" rx="2"/><path d="m11 16-2 5"/><path d="m13 21 2-5"/><path d="M12 13v8"/>',
  'book-open': '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  'message-circle': '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>',
  'list-checks':
    '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
  'messages-square':
    '<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>',
  'shield-check': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  'sliders-horizontal':
    '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  'circle-help':
    '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'server-cog':
    '<path d="M4 2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="M4 14h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Z"/><path d="M6 6h.01"/><path d="M6 18h.01"/><circle cx="17" cy="18" r="2"/><path d="M17 14v1"/><path d="M17 21v1"/><path d="m20.2 16.2-.9.5"/><path d="m14.7 18.3-.9.5"/><path d="m20.2 19.8-.9-.5"/><path d="m14.7 17.7-.9-.5"/>',
  'link-2': '<path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/>',
  'key-round': '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>',
  eye:
    '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  'eye-off':
    '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.817 10.817 0 0 1-1.441 2.498"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
  box:
    '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  'circle-check': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  lightbulb:
    '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  'mouse-pointer-2': '<path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/>',
  'alert-triangle': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  loader: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
  'pen-line': '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  'user-round': '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  'users-round':
    '<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  'scroll-text':
    '<path d="M8 21h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2"/><path d="M8 8h8"/><path d="M12 12h4"/><path d="M12 16h4"/>',
  'image-plus': '<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><path d="m21 15-5-5L5 21"/><path d="M16 5h6"/><path d="M19 2v6"/>',
  check: '<path d="m20 6-11 11-5-5"/>',
  'rotate-ccw': '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  'refresh-cw':
    '<path d="M21 12a9 9 0 0 0-15.5-6.2L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 15.5 6.2L21 16"/><path d="M16 16h5v5"/>',
  ellipsis:
    '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  'trash-2':
    '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/>',
};

const characterProfile = window.PocketLabCharacterProfile;
const chatListModel = window.PocketLabChatListModel;
const groupChatModel = window.PocketLabGroupChatModel;
const defaultCharacter = {
  ...characterProfile.normalizeCharacter(characterProfile.defaultCharacter),
  avatarUrl: "",
  chatBackgroundUrl: "",
};

const chatBatchLimits = {
  maxMessages: 20,
  maxPromptCharacters: 15800,
};
const apiRequestTimeoutMs = 140000;

const state = {
  activeView: "home",
  connected: false,
  toastTimer: null,
  characters: [],
  groupChats: [],
  worldBooks: [],
  activeCharacterId: defaultCharacter.id,
  character: {
    ...defaultCharacter,
  },
  messages: [],
  isReplying: false,
  isSwitchingCharacter: false,
  replyReveal: {
    messageId: "",
    visibleCount: 0,
    entranceIndex: -1,
  },
  isSavingCharacter: false,
  isChangingLockPassword: false,
  avatarDraftBlob: null,
  avatarDraftUrl: "",
  avatarDraftOwnsUrl: false,
  chatBackgroundDraftBlob: null,
  chatBackgroundDraftUrl: "",
  chatBackgroundDraftOwnsUrl: false,
  characterEditorMode: "edit",
  editingCharacterId: defaultCharacter.id,
  localDataStatusKind: "idle",
  localDataErrorSource: "",
};

const elements = {};
let messageSaveChain = Promise.resolve();
let characterSaveChain = Promise.resolve();
let characterListRenderSequence = 0;

document.addEventListener("DOMContentLoaded", initializeApp);

async function initializeApp() {
  try {
    if (window.PocketLabBootstrap && window.PocketLabBootstrap.stage) {
      window.PocketLabBootstrap.stage("正在初始化聊天界面");
    }
    hydrateIcons();
    cacheElements();
    bindEvents();
    await restoreSettings();
    restoreLockPasswordSettings();
    await restoreChat();
    await window.PocketLabHomeScreenApp.init({
      onError: reportStorageError,
    });
    await window.PocketLabSelfProfileApp.init();
    await window.PocketLabWorldBookApp.init();
    await window.PocketLabGroupChatEditor.init();
    await window.PocketLabBeautify.init({
      onError: reportStorageError,
      onSaved: updateStorageUsage,
    });
    window.PocketLabLockScreen.init({
      backgroundUrl: window.PocketLabBeautify.getBackgroundUrl("lock"),
    });
    updateClock();
    setInterval(updateClock, 1000);
    renderChat();
    showView("home", { initial: true });
    updateStorageUsage();
    hideBootstrapStatus();
  } catch (error) {
    showBootstrapFailure(error);
    console.error("小手机启动失败。", error);
  }
}

function hideBootstrapStatus() {
  if (window.PocketLabBootstrap && window.PocketLabBootstrap.complete) {
    window.PocketLabBootstrap.complete();
    return;
  }
  const status = document.getElementById("bootstrap-status");
  if (!status) return;
  status.classList.add("is-hidden");
  status.setAttribute("aria-hidden", "true");
}

function showBootstrapFailure(error) {
  const failureMessage =
    error && typeof error.message === "string" && error.message.trim()
      ? error.message.trim().slice(0, 220)
      : "页面初始化时发生了未说明的错误。";
  if (window.PocketLabBootstrap && window.PocketLabBootstrap.fail) {
    window.PocketLabBootstrap.fail(
      "小手机没有完成启动",
      failureMessage,
      "请重新加载页面；如果仍然失败，请先打开纯文字检查页，再返回小手机。",
    );
    return;
  }
  const status = document.getElementById("bootstrap-status");
  if (!status) return;
  status.classList.remove("is-hidden");
  status.classList.add("is-error");
  status.removeAttribute("aria-hidden");
  status.textContent = "";

  const title = document.createElement("strong");
  title.textContent = "小手机没有完成启动";
  const message = document.createElement("span");
  message.textContent = `${failureMessage} 请刷新页面重试；如果仍然停在这里，请先打开检查页，再返回小手机。`;
  status.append(title, message);
}

function hydrateIcons() {
  document.querySelectorAll("[data-icon]").forEach((node) => {
    const name = node.dataset.icon;
    if (!icons[name]) return;
    node.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
  });
}

function cacheElements() {
  const ids = [
    "home-view",
    "character-list-view",
    "chat-view",
    "settings-view",
    "beautify-view",
    "world-books-view",
    "self-profile-view",
    "guide-view",
    "status-time",
    "home-date",
    "header-status",
    "character-list-scroll",
    "character-list-back",
    "add-character-from-list",
    "character-list",
    "settings-back",
    "guide-back",
    "guide-go-settings",
    "world-books-back",
    "self-profile-back",
    "open-self-profile-app",
    "chat-header-avatar",
    "chat-character-name",
    "chat-api-status",
    "edit-character-button",
    "chat-connection-warning",
    "chat-open-settings",
    "chat-scroll",
    "chat-empty",
    "chat-empty-avatar",
    "chat-empty-name",
    "chat-empty-description",
    "chat-message-list",
    "chat-form",
    "chat-input",
    "send-chat",
    "chat-pending-actions",
    "pending-reply-count",
    "reply-pending-batch",
    "batch-reply-label",
    "chat-reply-status",
    "chat-reply-label",
    "chat-back",
    "character-modal",
    "character-modal-title",
    "close-character-modal",
    "character-form",
    "character-avatar-preview",
    "avatar-file",
    "clear-avatar",
    "character-name",
    "character-persona",
    "character-world-book",
    "character-self-profile",
    "character-max-messages",
    "character-max-messages-value",
    "character-background-preview",
    "character-chat-background-file",
    "clear-character-background",
    "character-name-error",
    "character-persona-error",
    "cancel-character",
    "save-character",
    "save-character-label",
    "export-backup",
    "import-backup",
    "backup-file",
    "storage-usage",
    "local-data-status",
    "local-data-status-title",
    "local-data-status-message",
    "local-data-status-next",
    "api-form",
    "api-url",
    "api-key",
    "model-name",
    "api-url-error",
    "api-key-error",
    "model-name-error",
    "lock-password-enabled",
    "lock-password-description",
    "lock-password-summary",
    "open-password-change",
    "password-change-form",
    "current-lock-password",
    "new-lock-password",
    "confirm-lock-password",
    "lock-password-form-error",
    "cancel-password-change",
    "save-lock-password",
    "lock-password-status",
    "toggle-key",
    "test-connection",
    "test-result",
    "result-icon",
    "result-kicker",
    "result-title",
    "result-message",
    "result-meta",
    "next-step",
    "next-step-text",
    "toast",
  ];

  ids.forEach((id) => {
    elements[id] = document.getElementById(id);
  });
}

function bindEvents() {
  document.getElementById("open-beautify-app").addEventListener("click", () => showView("beautify"));
  document
    .getElementById("open-chat-app")
    .addEventListener("click", () => showView("characters"));
  document
    .getElementById("open-world-books-app")
    .addEventListener("click", () => showView("world-books"));
  elements["open-self-profile-app"].addEventListener("click", () =>
    showView("self-profile"),
  );
  document.getElementById("open-guide-app").addEventListener("click", () => showView("guide"));
  document.getElementById("open-settings-app").addEventListener("click", () => showView("settings"));
  document.getElementById("beautify-back").addEventListener("click", () => showView("home"));
  elements["character-list-back"].addEventListener("click", () => showView("home"));
  window.addEventListener(
    "pocketlab:request-new-character",
    openNewCharacterEditor,
  );
  elements["character-list"].addEventListener(
    "click",
    handleCharacterListAction,
  );
  elements["settings-back"].addEventListener("click", () => showView("home"));
  elements["guide-back"].addEventListener("click", () => showView("home"));
  elements["guide-go-settings"].addEventListener("click", () => showView("settings"));
  elements["world-books-back"].addEventListener("click", () => showView("home"));
  elements["self-profile-back"].addEventListener("click", () => showView("home"));
  elements["chat-back"].addEventListener("click", () => showView("characters"));
  elements["chat-open-settings"].addEventListener("click", () => showView("settings"));
  elements["edit-character-button"].addEventListener("click", openCharacterEditor);
  elements["close-character-modal"].addEventListener("click", closeCharacterEditor);
  elements["cancel-character"].addEventListener("click", closeCharacterEditor);
  elements["character-modal"].addEventListener("click", (event) => {
    if (event.target === elements["character-modal"]) closeCharacterEditor();
  });
  elements["character-form"].addEventListener("submit", saveCharacter);
  elements["avatar-file"].addEventListener("change", handleAvatarFile);
  elements["clear-avatar"].addEventListener("click", clearAvatarDraft);
  elements["character-chat-background-file"].addEventListener(
    "change",
    handleChatBackgroundFile,
  );
  elements["clear-character-background"].addEventListener(
    "click",
    clearChatBackgroundDraft,
  );
  elements["character-max-messages"].addEventListener(
    "input",
    updateCharacterMaxMessagesPreview,
  );
  elements["export-backup"].addEventListener("click", exportBackup);
  elements["import-backup"].addEventListener("click", () => {
    elements["backup-file"].click();
  });
  elements["backup-file"].addEventListener("change", importBackupFile);
  elements["chat-form"].addEventListener("submit", handleChatSubmit);
  elements["chat-message-list"].addEventListener("click", handleChatMessageAction);
  elements["reply-pending-batch"].addEventListener("click", handleReplyPendingBatch);
  elements["chat-input"].addEventListener("input", () => {
    resizeChatInput();
    updateSendButton();
  });
  elements["chat-input"].addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      elements["chat-form"].requestSubmit();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      document.querySelectorAll("details.message-menu[open]").forEach((menu) => {
        menu.removeAttribute("open");
      });
      if (!elements["character-modal"].classList.contains("is-hidden")) {
        closeCharacterEditor();
      }
    }
  });
  document.addEventListener("click", (event) => {
    document.querySelectorAll("details.message-menu[open]").forEach((menu) => {
      if (!menu.contains(event.target)) menu.removeAttribute("open");
    });
  });

  elements["toggle-key"].addEventListener("click", toggleKeyVisibility);
  elements["api-form"].addEventListener("submit", handleConnectionTest);
  elements["api-url"].addEventListener("input", () => clearFieldError("api-url"));
  elements["api-key"].addEventListener("input", () => clearFieldError("api-key"));
  elements["model-name"].addEventListener("input", () => clearFieldError("model-name"));
  elements["lock-password-enabled"].addEventListener("change", handleLockPasswordToggle);
  elements["open-password-change"].addEventListener("click", openPasswordChangeForm);
  elements["cancel-password-change"].addEventListener("click", () => closePasswordChangeForm());
  elements["password-change-form"].addEventListener("submit", handlePasswordChange);
  [
    elements["current-lock-password"],
    elements["new-lock-password"],
    elements["confirm-lock-password"],
  ].forEach((input) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 4);
      clearPasswordFormError();
    });
  });
  elements["character-name"].addEventListener("input", () => {
    clearFieldError("character-name");
    applyAvatar(
      elements["character-avatar-preview"],
      elements["character-name"].value || state.character.name,
      state.avatarDraftUrl,
    );
  });
  elements["character-persona"].addEventListener("input", () => clearFieldError("character-persona"));
  window.addEventListener("pocketlab:world-books-changed", handleWorldBooksChanged);
  window.addEventListener(
    "pocketlab:group-chats-changed",
    handleGroupChatsChanged,
  );
  window.addEventListener("pocketlab:toast", (event) => {
    const message = String(event?.detail?.message || "").trim();
    if (message) showToast(message);
  });
  window.addEventListener(
    "pocketlab:self-profiles-changed",
    handleSelfProfilesChanged,
  );

}

function showView(viewName, options = {}) {
  if (
    viewName !== "home" &&
    window.PocketLabHomeScreenApp &&
    window.PocketLabHomeScreenApp.isEditing()
  ) {
    window.PocketLabHomeScreenApp.exitEditMode();
  }
  state.activeView = viewName;
  const views = {
    home: elements["home-view"],
    characters: elements["character-list-view"],
    chat: elements["chat-view"],
    settings: elements["settings-view"],
    beautify: elements["beautify-view"],
    "world-books": elements["world-books-view"],
    "self-profile": elements["self-profile-view"],
    guide: elements["guide-view"],
  };

  Object.entries(views).forEach(([name, view]) => {
    view.classList.toggle("is-active", name === viewName);
    view.setAttribute("aria-hidden", String(name !== viewName));
  });

  if (!options.initial) {
    const scrollArea = views[viewName].querySelector(
      ".character-list-scroll, .settings-scroll, .guide-scroll, .chat-scroll, .beautify-scroll, .world-book-scroll, .self-profile-scroll",
    );
    if (scrollArea) scrollArea.scrollTop = 0;
  }

  if (viewName === "characters") {
    renderCharacterList();
  }

  if (
    viewName === "home" &&
    window.PocketLabHomeScreenApp &&
    !options.initial
  ) {
    window.PocketLabHomeScreenApp.refresh({ silent: true });
  }

  if (viewName === "beautify" && window.PocketLabBeautify) {
    window.PocketLabBeautify.refresh();
  }

  if (viewName === "world-books" && window.PocketLabWorldBookApp) {
    window.PocketLabWorldBookApp.refresh({ silent: true });
  }

  if (viewName === "self-profile" && window.PocketLabSelfProfileApp) {
    window.PocketLabSelfProfileApp.refresh({ silent: true });
  }

  if (viewName === "chat") {
    updateChatConnectionUI();
    renderChat();
    window.setTimeout(() => elements["chat-input"].focus(), 180);
  }
}

function handleWorldBooksChanged(event) {
  if (Array.isArray(event?.detail?.worldBooks)) {
    state.worldBooks = event.detail.worldBooks;
  }

  const modal = elements["character-modal"];
  if (modal && !modal.classList.contains("is-hidden")) {
    populateCharacterWorldBookOptions(elements["character-world-book"].value);
  }
}

function handleGroupChatsChanged(event) {
  if (Array.isArray(event?.detail?.groupChats)) {
    state.groupChats = event.detail.groupChats;
  }
  if (state.activeView === "characters") {
    renderCharacterList();
  }
}

function populateCharacterWorldBookOptions(selectedId = "") {
  const select = elements["character-world-book"];
  if (!select) return;

  const unboundOption = document.createElement("option");
  unboundOption.value = "";
  unboundOption.textContent = "不绑定世界书";
  const options = state.worldBooks.map((worldBook) => {
    const option = document.createElement("option");
    option.value = worldBook.id;
    option.textContent = `${worldBook.name} · ${worldBook.category}`;
    return option;
  });

  const normalizedSelectedId = String(selectedId || "").trim();
  if (
    normalizedSelectedId &&
    !state.worldBooks.some((worldBook) => worldBook.id === normalizedSelectedId)
  ) {
    const missingOption = document.createElement("option");
    missingOption.value = normalizedSelectedId;
    missingOption.textContent = "原绑定世界书已不存在，请重新选择";
    missingOption.disabled = true;
    options.push(missingOption);
  }

  select.replaceChildren(unboundOption, ...options);
  select.value = normalizedSelectedId;
}

function handleSelfProfilesChanged() {
  const modal = elements["character-modal"];
  if (!modal || modal.classList.contains("is-hidden")) return;
  populateCharacterSelfProfileOptions(elements["character-self-profile"].value);
}

function populateCharacterSelfProfileOptions(selectedId = "") {
  const select = elements["character-self-profile"];
  if (!select) return;

  const profiles =
    window.PocketLabSelfProfileApp?.getProfiles?.() || [];
  const activeProfile =
    window.PocketLabSelfProfileApp?.getActiveProfile?.();
  const followOption = document.createElement("option");
  followOption.value = "";
  followOption.textContent = profiles.length
    ? "跟随“我”App 当前人设"
    : "跟随“我”App 当前人设（暂无资料）";

  const options = profiles.map((profile) => {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent =
      profile.id === activeProfile?.id
        ? `${profile.name}（当前）`
        : profile.name;
    return option;
  });
  const normalizedSelectedId = characterProfile.normalizeStableId(selectedId);
  if (
    normalizedSelectedId &&
    !profiles.some((profile) => profile.id === normalizedSelectedId)
  ) {
    const missingOption = document.createElement("option");
    missingOption.value = normalizedSelectedId;
    missingOption.textContent = "原人设已不存在，将跟随当前人设";
    missingOption.disabled = true;
    options.push(missingOption);
  }

  select.replaceChildren(followOption, ...options);
  select.value = normalizedSelectedId;
}

function updateClock() {
  const now = new Date();
  elements["status-time"].textContent = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  elements["home-date"].textContent = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
  }).format(now);
}

async function restoreSettings() {
  const settings = window.PocketLabSettings.readApiSettings();
  elements["api-url"].value = settings.apiUrl;
  elements["model-name"].value = settings.modelName;
  elements["api-key"].value = settings.apiKey;
  state.connected =
    settings.connected && Boolean(settings.apiUrl && settings.modelName && settings.apiKey);
  if (!state.connected && settings.connected) {
    window.PocketLabSettings.setConnected(false);
  }
  updateConnectionUI();
}

function restoreLockPasswordSettings() {
  const store = window.PocketLabLockPassword;
  if (!store) {
    elements["lock-password-enabled"].disabled = true;
    elements["open-password-change"].disabled = true;
    elements["lock-password-summary"].textContent = "密码组件未加载。";
    setLockPasswordStatus(
      "锁屏密码设置无法读取。下一步：刷新页面；仍然失败时请检查浏览器是否拦截了项目脚本。",
      "error",
    );
    return;
  }

  try {
    updateLockPasswordUi(store.isEnabled(), store.hasCustomPassword());
    setLockPasswordStatus("");
  } catch (error) {
    elements["lock-password-enabled"].disabled = true;
    elements["open-password-change"].disabled = true;
    setLockPasswordStatus(
      describeLockPasswordError(error, "读取锁屏密码设置"),
      "error",
    );
  }
}

function updateLockPasswordUi(enabled, hasCustomPassword) {
  elements["lock-password-enabled"].checked = enabled;
  elements["lock-password-description"].textContent = enabled
    ? "开启后，向上滑动需要输入四位密码才能进入主屏幕。"
    : "已关闭密码验证，向上滑动后直接进入主屏幕。";

  if (enabled) {
    elements["lock-password-summary"].textContent = hasCustomPassword
      ? "已开启，当前使用自定义四位密码。"
      : "已开启，当前使用初始密码 1234。";
    return;
  }

  elements["lock-password-summary"].textContent = hasCustomPassword
    ? "已关闭；重新开启后继续使用原来的四位密码。"
    : "已关闭；重新开启后使用初始密码 1234。";
}

function handleLockPasswordToggle() {
  const store = window.PocketLabLockPassword;
  const toggle = elements["lock-password-enabled"];
  if (!store || toggle.disabled) return;

  const nextEnabled = toggle.checked;
  const saveError = store.setEnabled(nextEnabled);
  if (saveError) {
    toggle.checked = !nextEnabled;
    setLockPasswordStatus(
      describeLockPasswordError(saveError, "保存锁屏密码开关"),
      "error",
    );
    return;
  }

  updateLockPasswordUi(nextEnabled, store.hasCustomPassword());
  setLockPasswordStatus(
    nextEnabled
      ? "锁屏密码已开启。下次解锁需要输入四位密码。"
      : "锁屏密码已关闭。下次向上滑动会直接进入主屏幕。",
    "success",
  );
  closePasswordChangeForm(false);
}

function openPasswordChangeForm() {
  const form = elements["password-change-form"];
  if (!form || !form.classList.contains("is-hidden") || state.isChangingLockPassword) return;

  form.classList.remove("is-hidden");
  elements["open-password-change"].setAttribute("aria-expanded", "true");
  clearPasswordFormError();
  elements["lock-password-status"].textContent = "";
  elements["lock-password-status"].className = "lock-password-status";
  window.setTimeout(() => elements["current-lock-password"].focus(), 0);
}

function closePasswordChangeForm(shouldFocus = true) {
  const form = elements["password-change-form"];
  if (!form || state.isChangingLockPassword) return;

  form.classList.add("is-hidden");
  elements["open-password-change"].setAttribute("aria-expanded", "false");
  [
    elements["current-lock-password"],
    elements["new-lock-password"],
    elements["confirm-lock-password"],
  ].forEach((input) => {
    input.value = "";
  });
  clearPasswordFormError();
  if (shouldFocus) elements["open-password-change"].focus();
}

function clearPasswordFormError() {
  [
    elements["current-lock-password"],
    elements["new-lock-password"],
    elements["confirm-lock-password"],
  ].forEach((input) => {
    const field = input.closest(".field");
    if (field) field.classList.remove("has-error");
  });
  elements["lock-password-form-error"].textContent = "";
}

function showPasswordFormError(message, input) {
  clearPasswordFormError();
  elements["lock-password-form-error"].textContent = message;
  if (input) {
    const field = input.closest(".field");
    if (field) field.classList.add("has-error");
    input.focus();
  }
}

function setPasswordChangeBusy(isBusy) {
  state.isChangingLockPassword = isBusy;
  const form = elements["password-change-form"];
  const saveButton = elements["save-lock-password"];
  form.setAttribute("aria-busy", String(isBusy));
  form.querySelectorAll("input, button").forEach((control) => {
    control.disabled = isBusy;
  });
  saveButton.classList.toggle("is-loading", isBusy);
}

function describeLockPasswordError(error, action) {
  const detail =
    error && typeof error.message === "string" && error.message.trim()
      ? ` 浏览器返回：${error.message.trim().slice(0, 180)}`
      : "";
  return `${action}失败，可能是站点存储权限被限制或浏览器空间不足。${detail} 下一步：允许此网站保存本地数据，退出无痕模式并刷新后重试。`;
}

function setLockPasswordStatus(message, kind = "") {
  const status = elements["lock-password-status"];
  if (!status) return;
  status.textContent = message;
  status.className = "lock-password-status";
  if (kind) status.classList.add(`is-${kind}`);
}

async function handlePasswordChange(event) {
  event.preventDefault();
  if (state.isChangingLockPassword) return;

  const store = window.PocketLabLockPassword;
  const currentInput = elements["current-lock-password"];
  const newInput = elements["new-lock-password"];
  const confirmInput = elements["confirm-lock-password"];
  const currentPassword = currentInput.value;
  const newPassword = newInput.value;
  const confirmPassword = confirmInput.value;

  clearPasswordFormError();
  if (!store) {
    showPasswordFormError("密码组件未加载，请刷新页面后再试。");
    return;
  }
  if (!/^\d{4}$/.test(currentPassword)) {
    showPasswordFormError("请输入当前的四位数字密码。", currentInput);
    return;
  }
  if (!/^\d{4}$/.test(newPassword)) {
    showPasswordFormError("新密码必须是四位数字。", newInput);
    return;
  }
  if (newPassword !== confirmPassword) {
    showPasswordFormError("两次输入的新密码不一致，请重新确认。", confirmInput);
    return;
  }

  let focusAfterSave = currentInput;
  let closeFormAfterSave = false;
  setPasswordChangeBusy(true);
  try {
    let currentIsValid = false;
    try {
      currentIsValid = await store.verifyPassword(currentPassword);
    } catch (error) {
      showPasswordFormError(
        describeLockPasswordError(error, "验证当前密码"),
        currentInput,
      );
      return;
    }

    if (!currentIsValid) {
      showPasswordFormError("当前密码不正确，请重新输入。", currentInput);
      return;
    }

    let saveError = null;
    try {
      saveError = await store.setPassword(newPassword);
    } catch (error) {
      saveError = error;
    }
    if (saveError) {
      focusAfterSave = newInput;
      showPasswordFormError(
        describeLockPasswordError(saveError, "保存新密码"),
        newInput,
      );
      return;
    }

    updateLockPasswordUi(store.isEnabled(), true);
    setLockPasswordStatus(
      "新密码已保存。下次解锁请使用新的四位数字密码。",
      "success",
    );
    showToast("锁屏密码已更新。");
    focusAfterSave = null;
    closeFormAfterSave = true;
  } finally {
    setPasswordChangeBusy(false);
    if (closeFormAfterSave) {
      closePasswordChangeForm(false);
    }
    if (
      focusAfterSave &&
      !elements["password-change-form"].classList.contains("is-hidden")
    ) {
      focusAfterSave.focus();
    }
  }
}

function saveSettings() {
  const error = window.PocketLabSettings.saveApiSettings({
    apiUrl: elements["api-url"].value,
    modelName: elements["model-name"].value,
    apiKey: elements["api-key"].value,
  });
  if (!error) return true;

  reportStorageError(error, "保存 API 设置", "settings");
  return false;
}

async function restoreChat() {
  let migrationError = null;
  let cleanupError = null;
  let migrationSucceeded = false;
  let migrationResult = null;
  let legacyPresent = false;

  try {
    setLocalDataStatus(
      "working",
      "正在检查本机数据",
      "正在打开 IndexedDB，并检查旧版角色与聊天记录。",
      "请不要关闭页面。",
    );
    await window.PocketLabStorage.open();

    const legacyCharacterText = window.PocketLabSettings.readLegacyValue(
      window.PocketLabSettings.legacyKeys.character,
    );
    const legacyMessagesText = window.PocketLabSettings.readLegacyValue(
      window.PocketLabSettings.legacyKeys.messages,
    );
    legacyPresent = Boolean(legacyCharacterText || legacyMessagesText);
    let legacyCharacter = null;
    let legacyMessages = [];
    let avatarBlob = null;

    try {
      if (legacyCharacterText) {
        legacyCharacter = normalizeLegacyCharacter(JSON.parse(legacyCharacterText));
        if (legacyCharacter.avatar) {
          avatarBlob = window.PocketLabMedia.dataUrlToBlob(legacyCharacter.avatar);
        }
      }
      if (legacyMessagesText) {
        const parsedMessages = JSON.parse(legacyMessagesText);
        if (!Array.isArray(parsedMessages)) {
          throw new Error("旧版聊天记录不是列表格式。");
        }
        legacyMessages = parsedMessages.map((message, index) =>
          normalizeStoredMessage(message, {
            strict: true,
            label: `旧版聊天记录第 ${index + 1} 条`,
          }),
        );
      }
    } catch (error) {
      throw new Error(`旧版本机数据无法完整读取：${error.message}`);
    }

    if (legacyPresent) {
      migrationResult = await window.PocketLabStorage.migrateLegacyData({
        character: legacyCharacter
          ? { name: legacyCharacter.name, persona: legacyCharacter.persona }
          : null,
        messages: legacyMessages,
        avatarBlob,
      });
      migrationSucceeded = true;
    }
  } catch (error) {
    migrationError = error;
  }

  try {
    await loadChatFromDatabase();
  } catch (error) {
    if (!migrationError) migrationError = error;
    releaseCharacterAvatar();
    state.character = createDefaultCharacter();
    state.messages = [];
  }

  if (migrationError) {
    reportStorageError(
      migrationError,
      legacyPresent ? "迁移旧版本机数据" : "读取本机数据",
      "migration",
    );
    if (legacyPresent) {
      elements["local-data-status-message"].textContent +=
        " 旧版记录尚未删除；在问题解决前请勿清理浏览器站点数据。";
    }
    return;
  }

  if (migrationSucceeded && legacyPresent) {
    const removeCharacterError = window.PocketLabSettings.removeLegacyValue(
      window.PocketLabSettings.legacyKeys.character,
    );
    const removeMessagesError = window.PocketLabSettings.removeLegacyValue(
      window.PocketLabSettings.legacyKeys.messages,
    );
    if (removeCharacterError || removeMessagesError) {
      cleanupError =
        removeCharacterError ||
        removeMessagesError ||
        new Error("旧版记录清理失败。");
    }
  }

  if (cleanupError) {
    reportStorageError(cleanupError, "清理旧版本机数据", "migration");
    elements["local-data-status-message"].textContent +=
      " IndexedDB 中的新数据已经验证；未清理成功的旧版记录仍会保留。";
    return;
  }

  if (migrationSucceeded && legacyPresent) {
    const parts = [];
    if (migrationResult.characterMigrated) parts.push("角色");
    if (migrationResult.avatarMigrated) parts.push("头像");
    if (migrationResult.messagesMigrated) {
      parts.push(`${migrationResult.messagesMigrated} 条聊天记录`);
    }
    setLocalDataStatus(
      "success",
      "旧数据已迁移",
      parts.length ? `已验证并迁移：${parts.join("、")}。` : "旧数据已确认存在，无需重复写入。",
      "旧版记录只在读回验证成功后清理。",
    );
    showToast("旧版角色和聊天数据已迁移到 IndexedDB。");
    return;
  }

  setLocalDataStatus(
    "success",
    "本机数据已准备",
    "角色、聊天、记忆和 App 存档使用 IndexedDB；图片以 Blob 保存。",
    "可在需要时导出包含文字和图片的备份。",
  );
}

async function loadChatFromDatabase() {
  let savedCharacters = await window.PocketLabStorage.listCharacters();
  const worldBooks = await window.PocketLabStorage.listWorldBooks();
  if (!savedCharacters.length) {
    const defaultRecord = await window.PocketLabStorage.saveCharacter(
      createDefaultCharacter(),
    );
    savedCharacters = [defaultRecord];
  }

  const characters = await Promise.all(savedCharacters.map(hydrateCharacter));
  const storedActiveId = window.PocketLabSettings.readActiveCharacterId();
  const nextActiveCharacter =
    characters.find((character) => character.id === storedActiveId) ||
    characters.find(
      (character) =>
        character.id === window.PocketLabStorage.primaryCharacterId,
    ) ||
    characters[0];
  const savedMessages = await window.PocketLabStorage.getMessages(
    nextActiveCharacter.id,
  );

  releaseCharacterMedia();
  state.characters = characters;
  state.worldBooks = worldBooks;
  state.activeCharacterId = nextActiveCharacter.id;
  state.character = nextActiveCharacter;
  state.messages = (Array.isArray(savedMessages) ? savedMessages : [])
    .map((message, index) =>
      normalizeStoredMessage(message, {
        strict: true,
        requireId: true,
        characterId: nextActiveCharacter.id,
        label: `本机聊天记录第 ${index + 1} 条`,
      }),
    )
    .slice(-300);
  ensureMessageTurns();
  window.PocketLabSettings.saveActiveCharacterId(nextActiveCharacter.id);
  applyCharacterChatBackground();
}

async function hydrateCharacter(record) {
  const character = normalizeCharacter(record);
  let avatarUrl = "";
  let chatBackgroundUrl = "";

  try {
    if (character.avatarId) {
      const avatarBlob = await window.PocketLabStorage.getImageBlob(
        character.avatarId,
      );
      if (!(avatarBlob instanceof Blob) || !avatarBlob.size) {
        throw new Error(
          `角色头像 ${character.avatarId} 在 IndexedDB 中不存在或图片内容为空。`,
        );
      }
      avatarUrl = window.PocketLabMedia.createObjectUrl(avatarBlob);
      if (!avatarUrl) {
        throw new Error("角色头像已经保存，但浏览器无法生成本地预览。");
      }
    }

    if (character.chatBackgroundImageId) {
      const backgroundBlob = await window.PocketLabStorage.getImageBlob(
        character.chatBackgroundImageId,
      );
      if (!(backgroundBlob instanceof Blob) || !backgroundBlob.size) {
        throw new Error(
          `角色聊天背景 ${character.chatBackgroundImageId} 在 IndexedDB 中不存在或图片内容为空。`,
        );
      }
      chatBackgroundUrl =
        window.PocketLabMedia.createObjectUrl(backgroundBlob);
      if (!chatBackgroundUrl) {
        throw new Error("角色聊天背景已经保存，但浏览器无法生成本地预览。");
      }
    }

    return {
      ...character,
      avatarUrl,
      chatBackgroundUrl,
    };
  } catch (error) {
    window.PocketLabMedia.revokeObjectUrl(avatarUrl);
    window.PocketLabMedia.revokeObjectUrl(chatBackgroundUrl);
    throw error;
  }
}

function createDefaultCharacter() {
  return normalizeCharacter({
    ...defaultCharacter,
    id: window.PocketLabStorage.primaryCharacterId,
  });
}

function releaseCharacterMedia() {
  const releasedUrls = new Set();
  [...state.characters, state.character].filter(Boolean).forEach((character) => {
    [
      character.avatarUrl,
      character.chatBackgroundUrl,
    ].forEach((url) => {
      if (!url || releasedUrls.has(url)) return;
      releasedUrls.add(url);
      window.PocketLabMedia.revokeObjectUrl(url);
    });
  });
}

function releaseCharacterAvatar() {
  releaseCharacterMedia();
}

function normalizeLegacyCharacter(value) {
  const source = value && typeof value === "object" ? value : {};
  const name =
    typeof source.name === "string" && source.name.trim()
      ? source.name.trim().slice(0, 24)
      : defaultCharacter.name;
  const persona =
    typeof source.persona === "string" && source.persona.trim()
      ? source.persona.trim().slice(0, 4000)
      : defaultCharacter.persona;
  const avatar =
    typeof source.avatar === "string" && source.avatar.trim()
      ? source.avatar.trim()
      : "";

  if (avatar && !/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(avatar)) {
    throw new Error("旧版头像不是受支持的 Base64 图片。");
  }

  return { name, persona, avatar };
}

function normalizeCharacter(value) {
  return {
    ...characterProfile.normalizeCharacter(value),
    avatarUrl: "",
    chatBackgroundUrl: "",
  };
}

function normalizeStoredMessage(value, options = {}) {
  const label = options.label || "聊天记录";
  const invalid = (reason) => {
    if (options.strict) throw new Error(`${label}${reason}`);
    return null;
  };

  if (!value || typeof value !== "object") {
    return invalid("格式不正确。");
  }
  if (value.role !== "user" && value.role !== "assistant") {
    return invalid("的角色无效。");
  }
  if (typeof value.content !== "string" || !value.content.trim()) {
    return invalid("的内容为空或格式不正确。");
  }

  const storedId =
    typeof value.id === "string" && value.id.trim() ? value.id.trim() : "";
  if (!storedId && options.requireId) {
    return invalid("缺少稳定编号。");
  }
  if (storedId.length > 200) {
    return invalid("的编号过长。");
  }
  const id = storedId || createId();
  const pendingReply = value.role === "user" && value.pendingReply === true;
  const storedBatchId =
    typeof value.batchId === "string" && value.batchId.trim()
      ? value.batchId.trim().slice(0, 120)
      : "";
  const storedBatchIndex = Number(value.batchIndex);
  const storedTurnId =
    typeof value.turnId === "string" && value.turnId.trim()
      ? value.turnId.trim().slice(0, 160)
      : "";
  const retracted = value.retracted === true;
  const storedMaxConsecutiveMessages = Number(value.maxConsecutiveMessages);
  const hasConsecutiveSnapshot =
    value.role === "assistant" &&
    Number.isInteger(storedMaxConsecutiveMessages) &&
    storedMaxConsecutiveMessages >= characterProfile.MIN_CONSECUTIVE_MESSAGES &&
    storedMaxConsecutiveMessages <= characterProfile.MAX_CONSECUTIVE_MESSAGES;
  const storedReplyLines = Array.isArray(value.replyLines)
    ? characterProfile.normalizeReplyLines(value.replyLines)
    : [];
  const message = {
    id,
    characterId: characterProfile.normalizeMessageCharacterId(
      value.characterId,
      options.characterId || state.activeCharacterId,
    ),
    role: value.role,
    content: value.content,
    createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : Date.now(),
    failed: value.role === "user" && value.failed === true,
    pendingReply,
    batchId:
      value.role === "user"
        ? storedBatchId || (pendingReply ? `batch-${id}` : "")
        : "",
    batchIndex:
      value.role === "user" && Number.isInteger(storedBatchIndex) && storedBatchIndex > 0
        ? storedBatchIndex
        : 0,
    turnId: storedTurnId,
    retracted,
    retractedMode:
      retracted && value.retractedMode === "reply"
        ? "reply"
        : retracted
          ? "turn"
          : "",
  };

  if (hasConsecutiveSnapshot) {
    message.maxConsecutiveMessages = storedMaxConsecutiveMessages;
  }
  if (value.role === "assistant" && storedReplyLines.length) {
    message.replyLines = hasConsecutiveSnapshot
      ? characterProfile.limitReplyLines(
          storedReplyLines,
          storedMaxConsecutiveMessages,
        )
      : storedReplyLines;
  }

  if (message.failed && value.error && typeof value.error === "object") {
    message.error = {
      title: String(value.error.title || "回复失败").slice(0, 160),
      message: String(value.error.message || "服务商没有返回可用的回复。").slice(0, 1200),
      nextStep: String(value.error.nextStep || "检查 API 设置后再重试。").slice(0, 1200),
      status: Number(value.error.status) || 0,
    };
  }

  return message;
}

function ensureMessageTurns() {
  let currentTurnId = "";
  const turnsByBatchId = new Map();

  state.messages.forEach((message) => {
    if (message.turnId) {
      currentTurnId = message.turnId;
      if (message.batchId) turnsByBatchId.set(message.batchId, message.turnId);
      return;
    }

    if (message.role === "user") {
      const batchTurnId = message.batchId ? turnsByBatchId.get(message.batchId) : "";
      message.turnId = batchTurnId || `turn-${message.id}`;
      currentTurnId = message.turnId;
      if (message.batchId) turnsByBatchId.set(message.batchId, message.turnId);
      return;
    }

    message.turnId = currentTurnId || `turn-${message.id}`;
  });
}

function getTurnId(message) {
  return (message && message.turnId) || "";
}

function getTurnMessages(turnId) {
  return state.messages.filter((message) => getTurnId(message) === turnId);
}

function getLatestTurnId() {
  for (let index = state.messages.length - 1; index >= 0; index -= 1) {
    const turnId = getTurnId(state.messages[index]);
    if (turnId) return turnId;
  }
  return "";
}

function getRetractionState(turnId) {
  const turnMessages = getTurnMessages(turnId);
  const retractedMessages = turnMessages.filter((message) => message.retracted);
  if (!retractedMessages.length) return null;

  return {
    mode: retractedMessages.some((message) => message.retractedMode === "turn")
      ? "turn"
      : "reply",
    messages: retractedMessages,
  };
}

function isLatestTurn(turnId) {
  return Boolean(turnId) && turnId === getLatestTurnId();
}

function persistMessages() {
  const characterId = state.activeCharacterId;
  const snapshot = state.messages.slice(-300).map((message) => ({
    ...message,
    characterId,
    ...(message.error ? { error: { ...message.error } } : {}),
  }));
  const operation = messageSaveChain.then(() =>
    window.PocketLabStorage.saveMessagesForCharacter(characterId, snapshot),
  );
  messageSaveChain = operation
    .then(() => {
      if (
        state.localDataStatusKind === "error" &&
        state.localDataErrorSource === "messages"
      ) {
        setLocalDataStatus(
          "success",
          "本机保存已恢复",
          "最新聊天记录已经重新写入 IndexedDB。",
          "刷新页面后仍可恢复。",
        );
      }
      return true;
    })
    .catch((error) => {
      reportStorageError(error, "保存聊天记录", "messages");
      return false;
    });
  return messageSaveChain;
}

function setLocalDataStatus(kind, title, message, nextStep = "", source = "") {
  state.localDataStatusKind = kind;
  state.localDataErrorSource = kind === "error" ? source : "";
  if (!elements["local-data-status"]) return;
  elements["local-data-status"].classList.toggle("is-error", kind === "error");
  elements["local-data-status"].classList.toggle("is-success", kind === "success");
  elements["local-data-status-title"].textContent = title;
  elements["local-data-status-message"].textContent = message;
  elements["local-data-status-next"].textContent = nextStep;
}

function reportStorageError(error, action = "保存本机数据", source = "") {
  const description = window.PocketLabStorage.describeError(error, action);
  setLocalDataStatus(
    "error",
    description.title,
    description.message,
    description.nextStep,
    source,
  );
  showToast(`${description.title}。请查看设置页的“本机数据”提示。`);
  updateStorageUsage();
}

async function updateStorageUsage() {
  if (!elements["storage-usage"]) return;
  const estimate = await window.PocketLabStorage.storageEstimate();
  if (!estimate || !Number.isFinite(Number(estimate.usage))) {
    elements["storage-usage"].textContent = "浏览器未提供额度";
    return;
  }
  const usage = formatByteSize(estimate.usage);
  const quota = Number(estimate.quota);
  elements["storage-usage"].textContent = quota
    ? `已用 ${usage} / ${formatByteSize(quota)}`
    : `已用 ${usage}`;
}

function formatByteSize(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const amount = bytes / 1024 ** index;
  return `${amount >= 10 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
}

function setBackupBusy(button, isBusy) {
  if (!button) return;
  button.disabled = isBusy;
  button.setAttribute("aria-busy", String(isBusy));
}

async function exportBackup() {
  const button = elements["export-backup"];
  if (!button || button.disabled) return;
  setBackupBusy(button, true);
  setLocalDataStatus(
    "working",
    "正在生成备份",
    "正在读取角色、聊天、记忆、App 存档和图片。",
    "图片会转换为 Base64 写入 JSON；API Key 不会写入备份。",
  );

  let objectUrl = "";
  try {
    await waitForPendingLocalSaves();
    const json = await window.PocketLabBackup.createJson();
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.href = objectUrl;
    link.download = `pocket-lab-backup-${stamp}.json`;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setLocalDataStatus(
      "success",
      "备份已导出",
      "备份包含文字记录和图片；API Key 没有写入文件。",
      "请把 JSON 文件保存到你信任的位置。",
    );
    await updateStorageUsage();
  } catch (error) {
    reportStorageError(error, "导出备份");
  } finally {
    setBackupBusy(button, false);
    if (objectUrl) {
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    }
  }
}

async function importBackupFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const button = elements["import-backup"];
  setBackupBusy(button, true);
  setLocalDataStatus(
    "working",
    "正在导入备份",
    `正在读取 ${file.name || "备份文件"}，并校验格式和图片。`,
    "导入失败时不会清空当前本机数据。",
  );

  try {
    await waitForPendingLocalSaves();
    const text =
      typeof file.text === "function"
        ? await file.text()
        : await readFileAsText(file);
    const result = await window.PocketLabBackup.importJson(text);
    await loadChatFromDatabase();
    await window.PocketLabWorldBookApp.refresh({ silent: true });
    await window.PocketLabGroupChatEditor.refresh();
    state.groupChats = await window.PocketLabStorage.listGroupChats();
    await window.PocketLabBeautify.reload();
    renderChat();
    await updateStorageUsage();
    setLocalDataStatus(
      "success",
      "备份导入完成",
      `已导入 ${result.characters || 0} 个角色、${result.groupChats || 0} 个群聊、${result.worldBooks || 0} 本世界书、${result.messages || 0} 条聊天、${result.memories || 0} 条记忆、${result.images || 0} 张图片。`,
      "刷新页面后仍会保留；API Key 没有从备份恢复。",
    );
    showToast("备份已导入，本机数据已刷新。");
  } catch (error) {
    reportStorageError(error, "导入备份");
  } finally {
    setBackupBusy(button, false);
    event.target.value = "";
  }
}

async function waitForPendingLocalSaves() {
  const appearanceSave =
    window.PocketLabBeautify && typeof window.PocketLabBeautify.flush === "function"
      ? window.PocketLabBeautify.flush()
      : Promise.resolve();
  await Promise.all([messageSaveChain, characterSaveChain, appearanceSave]);
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("备份文件读取失败。"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsText(file);
  });
}

function updateCharacterUI() {
  const { name, avatarUrl } = state.character;
  elements["chat-character-name"].textContent = name;
  elements["chat-empty-name"].textContent = name;
  applyAvatar(elements["chat-header-avatar"], name, avatarUrl);
  applyAvatar(elements["chat-empty-avatar"], name, avatarUrl);
}

function applyAvatar(element, name, avatar) {
  if (!element) return;
  const hasAvatar = Boolean(avatar);
  element.classList.toggle("has-image", hasAvatar);
  element.style.backgroundImage = hasAvatar ? `url("${avatar}")` : "";
  element.textContent = hasAvatar ? "" : getInitial(name);
}

function getInitial(name) {
  const characters = Array.from(String(name || "").trim());
  return characters.length > 0 ? characters[0] : "?";
}

function getPendingMessages(batchId = "") {
  return state.messages.filter(
    (message) =>
      message.role === "user" &&
      message.pendingReply &&
      !message.retracted &&
      (!batchId || message.batchId === batchId),
  );
}

function isChatInteractionLocked() {
  return (
    state.isReplying ||
    state.isSwitchingCharacter ||
    state.isSavingCharacter
  );
}

function updateBatchControls() {
  const pendingMessages = getPendingMessages();
  const hasPending = pendingMessages.length > 0;
  const hasFailedGroup = pendingMessages.some((message) => message.failed);

  elements["chat-pending-actions"].classList.toggle("is-hidden", !hasPending);
  elements["pending-reply-count"].textContent = `${pendingMessages.length} 条消息待总结`;
  elements["reply-pending-batch"].disabled =
    isChatInteractionLocked() || !state.connected;
  elements["batch-reply-label"].textContent = state.isReplying
    ? "正在总结并回复"
    : hasFailedGroup
      ? "重新总结并回复"
      : "总结并回复";
}

function updateChatConnectionUI() {
  if (!elements["chat-api-status"]) return;

  elements["chat-api-status"].classList.toggle("is-connected", state.connected);
  elements["chat-api-status"].innerHTML = state.connected
    ? '<span class="status-dot"></span>API 已连接'
    : '<span class="status-dot"></span>API 未连接';
  elements["chat-connection-warning"].classList.toggle("is-hidden", state.connected);
  updateBatchControls();
  updateSendButton();
}

function renderChat() {
  updateCharacterUI();
  applyCharacterChatBackground();

  const messageHtml = buildMessageListHtml();
  const typingHtml = state.isReplying
    ? `
      <div class="chat-typing-row">
        <div class="message-avatar" data-assistant-avatar></div>
        <div class="typing-bubble" aria-label="正在回复">
          <span></span><span></span><span></span>
        </div>
      </div>
    `
    : "";

  elements["chat-message-list"].innerHTML = messageHtml + typingHtml;
  elements["chat-message-list"].querySelectorAll("[data-assistant-avatar]").forEach((node) => {
    applyAvatar(node, state.character.name, state.character.avatarUrl);
  });
  elements["chat-empty"].classList.toggle("is-hidden", state.messages.length > 0);
  elements["chat-reply-status"].classList.toggle("is-hidden", !state.isReplying);
  elements["chat-reply-label"].textContent = state.replyReveal.messageId
    ? "正在回复"
    : "正在总结并回复";
  updateBatchControls();
  updateSendButton();
  hydrateIcons();

  if (state.activeView === "chat") {
    window.requestAnimationFrame(scrollChatToBottom);
  }
}

function buildMessageHtml(message) {
  const isUser = message.role === "user";
  const time = formatMessageTime(message.createdAt);
  const failureHtml = isUser ? buildMessageFailureHtml(message) : "";
  const turnId = getTurnId(message);
  const canEdit = isLatestTurn(turnId);
  const menuHtml = buildMessageMenuHtml(message, canEdit);

  if (isUser) {
    return `
      <div class="message-row message-row-user" data-message-id="${escapeHtml(message.id)}" data-turn-id="${escapeHtml(turnId)}">
        <div class="message-body">
          <div class="message-bubble user-bubble">${escapeHtml(message.content)}</div>
          <div class="message-meta">
            <span class="message-time">${escapeHtml(time)}</span>
            ${menuHtml}
          </div>
        </div>
      </div>
      ${failureHtml}
    `;
  }

  const reveal = state.replyReveal;
  const isRevealing = reveal.messageId === message.id;
  const storedLines = characterProfile.normalizeReplyLines(message.replyLines);
  const allLines = storedLines.length
    ? storedLines
    : splitReplyLines(message.content);
  const visibleLines = isRevealing ? allLines.slice(0, reveal.visibleCount) : allLines;
  const bubbles = visibleLines
    .map((line, index) => {
      const enteringClass =
        isRevealing && index === reveal.entranceIndex ? " is-entering" : "";
      return `<div class="message-bubble assistant-bubble${enteringClass}">${escapeHtml(line)}</div>`;
    })
    .join("");
  const metaHtml = isRevealing
    ? ""
    : `
        <div class="message-meta">
          <span class="message-time">${escapeHtml(time)}</span>
          ${menuHtml}
        </div>
      `;

  return `
    <div class="message-row message-row-assistant" data-message-id="${escapeHtml(message.id)}" data-turn-id="${escapeHtml(turnId)}">
      <div class="message-avatar" data-assistant-avatar></div>
      <div class="message-body">
        <div class="assistant-bubbles">${bubbles}</div>
        ${metaHtml}
      </div>
    </div>
  `;
}

function buildMessageListHtml() {
  const lastIndexByTurn = new Map();
  state.messages.forEach((message, index) => {
    lastIndexByTurn.set(getTurnId(message), index);
  });

  return state.messages
    .map((message, index) => {
      const turnId = getTurnId(message);
      let html = "";
      if (!message.retracted) {
        html = buildMessageHtml(message);
      }

      if (lastIndexByTurn.get(turnId) === index) {
        const retraction = getRetractionState(turnId);
        if (retraction) {
          html += buildRetractionNoticeHtml(turnId, retraction);
        }
      }

      return html;
    })
    .join("");
}

function buildMessageMenuHtml(message, canEdit) {
  if (!canEdit || state.isReplying) return "";

  const deleteReplyHtml =
    message.role === "assistant"
      ? `
        <button class="message-menu-item" type="button" data-delete-reply-id="${escapeHtml(message.id)}">
          <span data-icon="trash-2"></span>
          删除回复
        </button>
      `
      : "";

  return `
    <details class="message-menu">
      <summary aria-label="消息操作" title="消息操作">
        <span data-icon="ellipsis"></span>
      </summary>
      <div class="message-menu-panel">
        ${deleteReplyHtml}
        <button class="message-menu-item" type="button" data-retract-turn-id="${escapeHtml(getTurnId(message))}">
          <span data-icon="rotate-ccw"></span>
          撤回本轮
        </button>
      </div>
    </details>
  `;
}

function buildRetractionNoticeHtml(turnId, retraction) {
  const isWholeTurn = retraction.mode === "turn";
  const title = isWholeTurn ? "本次对话已撤回" : "回复已撤回";
  const description = isWholeTurn
    ? "这轮的提问和回复都已收起，可以重新生成或彻底删除。"
    : "你的提问还在，可以重新生成角色回复或彻底删除这轮对话。";
  const regenerateLabel = isWholeTurn ? "重新生成本轮" : "重新生成回复";

  return `
    <div class="chat-retraction-notice" data-retraction-notice="${escapeHtml(turnId)}" role="status">
      <span class="retraction-icon" data-icon="rotate-ccw"></span>
      <div class="retraction-copy">
        <strong>${title}</strong>
        <p>${description}</p>
        <div class="retraction-actions">
          <button class="regenerate-button" type="button" data-regenerate-turn-id="${escapeHtml(turnId)}" ${state.isReplying ? "disabled" : ""}>
            <span data-icon="refresh-cw"></span>
            ${regenerateLabel}
          </button>
          <button class="delete-turn-button" type="button" data-delete-turn-id="${escapeHtml(turnId)}" ${state.isReplying ? "disabled" : ""}>
            <span data-icon="trash-2"></span>
            彻底删除
          </button>
        </div>
      </div>
    </div>
  `;
}

function buildMessageFailureHtml(message) {
  if (!message.failed || !message.error) return "";
  const isSummaryFailure = Boolean(message.batchId && message.pendingReply);
  return `
    <div class="message-failure">
      <div class="failure-copy">
        <strong>${escapeHtml(message.error.title)}</strong>
        <p>${escapeHtml(message.error.message)}</p>
        <small>${escapeHtml(message.error.nextStep)}</small>
      </div>
      <button class="retry-button" type="button" data-retry-message-id="${escapeHtml(message.id)}">
        <span data-icon="rotate-ccw"></span>
        ${isSummaryFailure ? "重试总结" : "重试"}
      </button>
    </div>
  `;
}

function splitReplyLines(content) {
  return window.PocketLabChatSummary.splitMessages(content);
}

async function revealAssistantReply(message, lines) {
  if (!message || !Array.isArray(lines) || !lines.length) return;

  const messageId = message.id;
  await window.PocketLabReplyReveal.runSequentially(lines, {
    onShow(_line, index) {
      state.replyReveal = {
        messageId,
        visibleCount: index + 1,
        entranceIndex: index,
      };
      renderChat();
    },
    onComplete() {
      if (state.replyReveal.messageId !== messageId) return;
      state.replyReveal = {
        messageId: "",
        visibleCount: 0,
        entranceIndex: -1,
      };
    },
  });
}

function formatMessageTime(timestamp) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

function scrollChatToBottom() {
  elements["chat-scroll"].scrollTop = elements["chat-scroll"].scrollHeight;
}

function resizeChatInput() {
  const input = elements["chat-input"];
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 104)}px`;
}

function updateSendButton() {
  if (!elements["send-chat"]) return;
  const hasText = Boolean(elements["chat-input"].value.trim());
  const pendingMessages = getPendingMessages();
  const groupIsFull = pendingMessages.length >= chatBatchLimits.maxMessages;
  const interactionLocked = isChatInteractionLocked();
  const disabled =
    !state.connected || interactionLocked || !hasText || groupIsFull;
  elements["send-chat"].disabled = disabled;
  elements["chat-input"].disabled = interactionLocked;
  elements["send-chat"].classList.toggle(
    "is-loading",
    state.isReplying || state.isSwitchingCharacter,
  );
  elements["send-chat"].setAttribute(
    "aria-label",
    state.isReplying ? "正在总结并回复" : "发送消息",
  );
  const iconName =
    state.isReplying || state.isSwitchingCharacter ? "loader" : "arrow-up";
  if (elements["send-chat"].dataset.iconState !== iconName) {
    elements["send-chat"].innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[iconName]}</svg>`;
    elements["send-chat"].dataset.iconState = iconName;
  }
  elements["add-character-from-list"].disabled = interactionLocked;
  elements["edit-character-button"].disabled = interactionLocked;
}

function openCharacterEditor() {
  if (isChatInteractionLocked()) {
    showToast("请等待当前回复或保存完成后再编辑角色。");
    return;
  }
  showCharacterEditor(state.character, "edit");
}

function openNewCharacterEditor() {
  if (isChatInteractionLocked()) {
    showToast("请等待当前回复或保存完成后再新建角色。");
    return;
  }
  showCharacterEditor(
    normalizeCharacter({
      id: `character-${createId()}`,
      name: "新角色",
      persona: "",
      maxConsecutiveMessages: characterProfile.DEFAULT_MAX_CONSECUTIVE_MESSAGES,
    }),
    "new",
    {
      blankFields: true,
    },
  );
}

function showCharacterEditor(character, mode, options = {}) {
  releaseAvatarDraft();
  releaseChatBackgroundDraft();
  const isNew = mode === "new";
  state.characterEditorMode = isNew ? "new" : "edit";
  state.editingCharacterId = character.id;
  state.avatarDraftBlob = null;
  state.avatarDraftUrl = isNew ? "" : character.avatarUrl;
  state.avatarDraftOwnsUrl = false;
  state.chatBackgroundDraftBlob = null;
  state.chatBackgroundDraftUrl =
    isNew || options.blankFields ? "" : character.chatBackgroundUrl;
  state.chatBackgroundDraftOwnsUrl = false;

  elements["character-modal-title"].textContent = isNew
    ? "添加新角色"
    : "编辑角色";
  elements["save-character-label"].textContent = isNew
    ? "创建并开始聊天"
    : "保存角色";
  elements["character-name"].value = options.blankFields ? "" : character.name;
  elements["character-persona"].value = options.blankFields
    ? ""
    : character.persona;
  populateCharacterWorldBookOptions(character.worldBookId || "");
  populateCharacterSelfProfileOptions(character.selfProfileId || "");
  elements["character-max-messages"].value =
    characterProfile.normalizeMaxConsecutiveMessages(
      character.maxConsecutiveMessages,
    );
  updateCharacterMaxMessagesPreview();
  elements["avatar-file"].value = "";
  elements["character-chat-background-file"].value = "";
  clearFieldError("character-name");
  clearFieldError("character-persona");
  applyAvatar(
    elements["character-avatar-preview"],
    options.blankFields ? "新角色" : character.name,
    state.avatarDraftUrl,
  );
  updateCharacterBackgroundPreview();
  elements["character-modal"].classList.remove("is-hidden");
  window.setTimeout(() => elements["character-name"].focus(), 60);
}

function closeCharacterEditor(shouldFocus = true) {
  releaseAvatarDraft();
  releaseChatBackgroundDraft();
  elements["character-modal"].classList.add("is-hidden");
  if (!shouldFocus) return;
  const focusTarget =
    state.characterEditorMode === "new"
      ? elements["add-character-from-list"]
      : elements["edit-character-button"];
  if (focusTarget) focusTarget.focus();
}

function releaseAvatarDraft() {
  if (state.avatarDraftOwnsUrl) {
    window.PocketLabMedia.revokeObjectUrl(state.avatarDraftUrl);
  }
  state.avatarDraftBlob = null;
  state.avatarDraftUrl = "";
  state.avatarDraftOwnsUrl = false;
}

function releaseChatBackgroundDraft() {
  if (state.chatBackgroundDraftOwnsUrl) {
    window.PocketLabMedia.revokeObjectUrl(state.chatBackgroundDraftUrl);
  }
  state.chatBackgroundDraftBlob = null;
  state.chatBackgroundDraftUrl = "";
  state.chatBackgroundDraftOwnsUrl = false;
}

function queueCharacterSave(
  record,
  avatarBlob = null,
  chatBackgroundBlob = null,
) {
  const operation = characterSaveChain.then(() =>
    window.PocketLabStorage.saveCharacter(
      record,
      avatarBlob,
      chatBackgroundBlob,
    ),
  );
  characterSaveChain = operation.catch(() => undefined);
  return operation;
}

async function renderCharacterList() {
  const list = elements["character-list"];
  if (!list) return;
  const renderSequence = ++characterListRenderSequence;

  const characters = state.characters.slice();
  const loadingRows = characters.map((character) => ({
    kind: "character",
    character,
    preview: chatListModel.LOADING_PREVIEW,
    timeLabel: "",
    timestamp: 0,
  }));
  list.setAttribute("aria-busy", "true");
  list.innerHTML = loadingRows.length
    ? buildCharacterListRowsHtml(loadingRows)
    : `
      <div class="character-list-empty" role="status">
        <strong>正在读取对话</strong>
        <p>正在读取角色和群聊，请稍等。</p>
      </div>
    `;
  applyCharacterListAvatars(list, characters);

  try {
    await messageSaveChain;
    const [messageSets, groupChats] = await Promise.all([
      Promise.all(
        characters.map((character) =>
          window.PocketLabStorage.getMessages(character.id),
        ),
      ),
      window.PocketLabStorage.listGroupChats(),
    ]);
    if (
      renderSequence !== characterListRenderSequence ||
      state.activeView !== "characters"
    ) {
      return;
    }

    state.groupChats = groupChats;
    const characterRows = chatListModel.buildCharacterRows(
      characters.map((character, index) => ({
        character,
        messages: messageSets[index],
      })),
    ).map((row) => ({ ...row, kind: "character" }));
    const rows = mergeConversationListRows(
      characterRows,
      buildGroupChatListRows(groupChats),
    );
    if (!rows.length) {
      list.innerHTML = `
        <div class="character-list-empty" role="status">
          <strong>还没有角色或群聊</strong>
          <p>点右上角的加号，创建角色或群聊。</p>
        </div>
      `;
      list.removeAttribute("aria-busy");
      return;
    }
    list.innerHTML = buildCharacterListRowsHtml(rows);
    applyCharacterListAvatars(list, characters);
    list.removeAttribute("aria-busy");
  } catch (error) {
    if (
      renderSequence !== characterListRenderSequence ||
      state.activeView !== "characters"
    ) {
      return;
    }
    const description = window.PocketLabStorage.describeError(
      error,
      "读取人物列表",
    );
    list.removeAttribute("aria-busy");
    list.innerHTML = `
      <div class="character-list-empty character-list-error" role="alert">
        <strong>${escapeHtml(description.title)}</strong>
        <p>${escapeHtml(description.message)}</p>
        <p>${escapeHtml(description.nextStep)}</p>
        <button type="button" data-retry-character-list>重新读取</button>
      </div>
    `;
    reportStorageError(error, "读取人物列表", "messages");
  }
}

function buildGroupChatListRows(groupChats, nowValue = Date.now()) {
  return (Array.isArray(groupChats) ? groupChats : []).map(
    (groupChat, originalIndex) => {
      const timestamp = Math.max(
        Number(groupChat.updatedAt) || 0,
        Number(groupChat.createdAt) || 0,
      );
      return {
        kind: "group",
        groupChat,
        preview: groupChatModel.getPreview(groupChat),
        timeLabel: timestamp
          ? chatListModel.formatListTime(timestamp, nowValue)
          : "",
        timestamp,
        originalIndex,
      };
    },
  );
}

function mergeConversationListRows(characterRows, groupRows) {
  return [...characterRows, ...groupRows]
    .map((row, sortIndex) => ({ ...row, sortIndex }))
    .sort((left, right) => {
      if (left.timestamp && right.timestamp) {
        return (
          right.timestamp - left.timestamp ||
          left.sortIndex - right.sortIndex
        );
      }
      if (left.timestamp) return -1;
      if (right.timestamp) return 1;
      return left.sortIndex - right.sortIndex;
    });
}

function buildCharacterListRowsHtml(rows) {
  return rows
    .map((row) => {
      const timestamp = Number(row.timestamp) || 0;
      const dateTime = timestamp
        ? new Date(timestamp).toISOString()
        : "";
      const timeHtml = row.timeLabel
        ? `<time class="character-list-time" datetime="${escapeHtml(dateTime)}">${escapeHtml(row.timeLabel)}</time>`
        : "";
      if (row.kind === "group") {
        const groupChat = row.groupChat;
        return `
          <div class="character-list-row" role="listitem">
            <button
              class="character-list-item"
              type="button"
              data-group-chat-id="${escapeHtml(groupChat.id)}"
              aria-label="编辑群聊 ${escapeHtml(groupChat.name)}"
            >
              <span class="group-chat-list-avatar character-list-avatar" aria-hidden="true">
                <svg viewBox="0 0 24 24">${icons["users-round"]}</svg>
              </span>
              <span class="character-list-copy">
                <span class="character-list-name-row">
                  <strong>${escapeHtml(groupChat.name)}</strong>
                  ${timeHtml}
                </span>
                <span class="character-list-preview" title="${escapeHtml(row.preview)}">${escapeHtml(row.preview)}</span>
              </span>
            </button>
          </div>
        `;
      }

      const character = row.character;
      return `
        <div class="character-list-row" role="listitem">
          <button
            class="character-list-item"
            type="button"
            data-character-id="${escapeHtml(character.id)}"
          >
            <span class="chat-avatar character-list-avatar" data-list-avatar="${escapeHtml(character.id)}" aria-hidden="true"></span>
            <span class="character-list-copy">
              <span class="character-list-name-row">
                <strong>${escapeHtml(character.name)}</strong>
                ${timeHtml}
              </span>
              <span class="character-list-preview" title="${escapeHtml(row.preview)}">${escapeHtml(row.preview)}</span>
            </span>
          </button>
        </div>
      `;
    })
    .join("");
}

function applyCharacterListAvatars(list, characters) {
  const characterById = new Map(
    characters.map((character) => [character.id, character]),
  );
  list.querySelectorAll("[data-list-avatar]").forEach((node) => {
    const character = characterById.get(node.dataset.listAvatar);
    if (!character) return;
    applyAvatar(node, character.name, character.avatarUrl);
  });
}

function handleCharacterListAction(event) {
  if (state.isSwitchingCharacter) return;
  const eventTarget = event.target;
  const target =
    eventTarget instanceof Element
      ? eventTarget
      : eventTarget && eventTarget.parentElement;
  if (target && target.closest("[data-retry-character-list]")) {
    renderCharacterList();
    return;
  }
  const groupChatItem = target && target.closest("[data-group-chat-id]");
  if (
    groupChatItem &&
    elements["character-list"].contains(groupChatItem)
  ) {
    window.PocketLabGroupChatEditor.openEdit(
      groupChatItem.dataset.groupChatId,
    );
    return;
  }
  const item = target && target.closest("[data-character-id]");
  if (!item || !elements["character-list"].contains(item)) return;
  switchCharacter(item.dataset.characterId, { openChat: true });
}

async function switchCharacter(characterId, options = {}) {
  if (isChatInteractionLocked()) {
    showToast("请等待当前回复或保存完成后再切换角色。");
    return;
  }
  const nextCharacter = state.characters.find(
    (character) => character.id === characterId,
  );
  if (!nextCharacter) {
    showToast("这个角色已经不存在，请刷新页面后重试。");
    return;
  }

  state.isSwitchingCharacter = true;
  updateBatchControls();
  updateSendButton();
  try {
    await messageSaveChain;
    const savedMessages = await window.PocketLabStorage.getMessages(characterId);
    state.replyReveal = {
      messageId: "",
      visibleCount: 0,
      entranceIndex: -1,
    };
    state.messages = (Array.isArray(savedMessages) ? savedMessages : [])
      .map((message, index) =>
        normalizeStoredMessage(message, {
          strict: true,
          requireId: true,
          characterId,
          label: `角色聊天记录第 ${index + 1} 条`,
        }),
      )
      .slice(-300);
    ensureMessageTurns();
    state.activeCharacterId = characterId;
    state.character = nextCharacter;
    window.PocketLabSettings.saveActiveCharacterId(characterId);
    elements["chat-input"].value = "";
    resizeChatInput();
    applyCharacterChatBackground();
    renderChat();
    if (options.openChat !== false) {
      showView("chat");
    }
    showToast(`已切换到 ${nextCharacter.name}。`);
    window.setTimeout(() => elements["chat-input"].focus(), 80);
  } catch (error) {
    reportStorageError(error, "切换角色", "messages");
  } finally {
    state.isSwitchingCharacter = false;
    updateBatchControls();
    updateSendButton();
  }
}

async function saveCharacter(event) {
  event.preventDefault();
  if (state.isSwitchingCharacter || state.isSavingCharacter) return;
  clearFieldError("character-name");
  clearFieldError("character-persona");

  const name = elements["character-name"].value.trim();
  const persona = elements["character-persona"].value.trim();
  let isValid = true;

  if (!name) {
    setFieldError("character-name", "请填写角色名字。");
    isValid = false;
  }
  if (!persona) {
    setFieldError("character-persona", "请填写角色人设。");
    isValid = false;
  }
  if (!isValid) return;

  const isNew = state.characterEditorMode === "new";
  const previousCharacter = isNew
    ? null
    : state.characters.find(
        (character) => character.id === state.editingCharacterId,
      ) || state.character;
  const characterId =
    previousCharacter?.id ||
    state.editingCharacterId ||
    `character-${createId()}`;
  const avatarBlob = state.avatarDraftBlob;
  const chatBackgroundBlob = state.chatBackgroundDraftBlob;
  const hasAvatar = Boolean(state.avatarDraftUrl);
  const hasChatBackground = Boolean(state.chatBackgroundDraftUrl);
  let saveSucceeded = false;
  let savedCharacter = null;
  state.isSavingCharacter = true;
  elements["save-character"].disabled = true;
  elements["save-character"].setAttribute("aria-busy", "true");
  updateBatchControls();
  updateSendButton();

  try {
    const savedRecord = await queueCharacterSave(
      {
        id: characterId,
        name: name.slice(0, 24),
        persona: persona.slice(0, 4000),
        avatarId: hasAvatar ? previousCharacter?.avatarId || "" : "",
        chatBackgroundImageId: hasChatBackground
          ? previousCharacter?.chatBackgroundImageId || ""
          : "",
        worldBookId: elements["character-world-book"].value,
        selfProfileId: elements["character-self-profile"].value,
        maxConsecutiveMessages:
          characterProfile.normalizeMaxConsecutiveMessages(
            elements["character-max-messages"].value,
          ),
        createdAt: previousCharacter?.createdAt || Date.now(),
      },
      avatarBlob,
      chatBackgroundBlob,
    );
    const nextCharacter = normalizeCharacter(savedRecord);
    savedCharacter = nextCharacter;

    let nextAvatarUrl = "";
    if (avatarBlob) {
      nextAvatarUrl = state.avatarDraftUrl;
      state.avatarDraftOwnsUrl = false;
      state.avatarDraftUrl = "";
    } else if (
      previousCharacter &&
      savedRecord.avatarId === previousCharacter.avatarId
    ) {
      nextAvatarUrl = previousCharacter.avatarUrl;
    } else if (savedRecord.avatarId) {
      const savedBlob = await window.PocketLabStorage.getImageBlob(savedRecord.avatarId);
      nextAvatarUrl = window.PocketLabMedia.createObjectUrl(savedBlob);
    }

    let nextChatBackgroundUrl = "";
    if (chatBackgroundBlob) {
      nextChatBackgroundUrl = state.chatBackgroundDraftUrl;
      state.chatBackgroundDraftOwnsUrl = false;
      state.chatBackgroundDraftUrl = "";
    } else if (
      previousCharacter &&
      savedRecord.chatBackgroundImageId ===
        previousCharacter.chatBackgroundImageId
    ) {
      nextChatBackgroundUrl = previousCharacter.chatBackgroundUrl;
    } else if (savedRecord.chatBackgroundImageId) {
      const savedBlob = await window.PocketLabStorage.getImageBlob(
        savedRecord.chatBackgroundImageId,
      );
      nextChatBackgroundUrl = window.PocketLabMedia.createObjectUrl(savedBlob);
    }

    if (
      previousCharacter?.avatarUrl &&
      previousCharacter.avatarUrl !== nextAvatarUrl
    ) {
      window.PocketLabMedia.revokeObjectUrl(previousCharacter.avatarUrl);
    }
    if (
      previousCharacter?.chatBackgroundUrl &&
      previousCharacter.chatBackgroundUrl !== nextChatBackgroundUrl
    ) {
      window.PocketLabMedia.revokeObjectUrl(
        previousCharacter.chatBackgroundUrl,
      );
    }

    nextCharacter.avatarUrl = nextAvatarUrl;
    nextCharacter.chatBackgroundUrl = nextChatBackgroundUrl;
    state.avatarDraftBlob = null;
    state.chatBackgroundDraftBlob = null;

    const existingIndex = state.characters.findIndex(
      (character) => character.id === nextCharacter.id,
    );
    if (existingIndex >= 0) {
      state.characters.splice(existingIndex, 1, nextCharacter);
    } else {
      state.characters.push(nextCharacter);
    }
    state.activeCharacterId = nextCharacter.id;
    state.character = nextCharacter;
    window.PocketLabSettings.saveActiveCharacterId(nextCharacter.id);
    await window.PocketLabWorldBookApp.refresh({ silent: true });

    if (isNew) {
      state.messages = [];
      await window.PocketLabStorage.saveMessagesForCharacter(
        nextCharacter.id,
        [],
      );
    }

    const staleImageIds = new Set();
    if (
      previousCharacter?.avatarId &&
      previousCharacter.avatarId !== nextCharacter.avatarId
    ) {
      staleImageIds.add(previousCharacter.avatarId);
    }
    if (
      previousCharacter?.chatBackgroundImageId &&
      previousCharacter.chatBackgroundImageId !==
        nextCharacter.chatBackgroundImageId
    ) {
      staleImageIds.add(previousCharacter.chatBackgroundImageId);
    }
    await Promise.all(
      [...staleImageIds].map((imageId) =>
        window.PocketLabStorage.deleteImageIfUnused(imageId).catch(
          () => undefined,
        ),
      ),
    );

    setLocalDataStatus(
      "success",
      isNew ? "新角色已创建" : "角色资料已保存",
      "名字、人设、世界书绑定、指定本人设、头像、最大连发数和聊天背景已经写入 IndexedDB。",
      "角色聊天记录独立保存，刷新页面后仍会恢复。",
    );
    applyCharacterChatBackground();
    renderChat();
    updateStorageUsage();
    saveSucceeded = true;
  } catch (error) {
    reportStorageError(error, "保存角色资料");
  } finally {
    state.isSavingCharacter = false;
    elements["save-character"].disabled = false;
    elements["save-character"].removeAttribute("aria-busy");
    updateBatchControls();
    updateSendButton();
    if (saveSucceeded && savedCharacter) {
      closeCharacterEditor(false);
      if (isNew) {
        showView("chat");
      }
      showToast(
        isNew
          ? `已创建 ${savedCharacter.name}。`
          : "角色资料已保存在本机。",
      );
      window.setTimeout(
        () =>
          (isNew
            ? elements["chat-input"]
            : elements["edit-character-button"]
          ).focus(),
        80,
      );
    }
  }
}

async function handleAvatarFile(event) {
  const files = event.target && event.target.files;
  const file = files && files[0];
  if (!file) return;

  if (!/^image\/(?:png|jpeg|webp)$/i.test(file.type)) {
    showToast("请选择 PNG、JPG 或 WebP 图片。");
    event.target.value = "";
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    showToast("头像文件不能超过 8 MB。");
    event.target.value = "";
    return;
  }

  try {
    const avatarBlob = await window.PocketLabMedia.resizeImageToBlob(file, {
      maxSize: 256,
      quality: 0.84,
    });
    if (state.avatarDraftOwnsUrl) {
      window.PocketLabMedia.revokeObjectUrl(state.avatarDraftUrl);
    }
    state.avatarDraftBlob = avatarBlob;
    state.avatarDraftUrl = window.PocketLabMedia.createObjectUrl(avatarBlob);
    state.avatarDraftOwnsUrl = Boolean(state.avatarDraftUrl);
    if (!state.avatarDraftUrl) {
      throw new Error("浏览器无法生成头像预览。");
    }
    applyAvatar(
      elements["character-avatar-preview"],
      elements["character-name"].value || state.character.name,
      state.avatarDraftUrl,
    );
  } catch (error) {
    state.avatarDraftBlob = null;
    state.avatarDraftUrl = getCharacterEditorBase()?.avatarUrl || "";
    state.avatarDraftOwnsUrl = false;
    reportStorageError(error, "读取头像图片");
  } finally {
    event.target.value = "";
  }
}

function clearAvatarDraft() {
  if (state.avatarDraftOwnsUrl) {
    window.PocketLabMedia.revokeObjectUrl(state.avatarDraftUrl);
  }
  state.avatarDraftBlob = null;
  state.avatarDraftUrl = "";
  state.avatarDraftOwnsUrl = false;
  elements["avatar-file"].value = "";
  applyAvatar(
    elements["character-avatar-preview"],
    elements["character-name"].value || "新角色",
    "",
  );
}

function getCharacterEditorBase() {
  if (state.characterEditorMode !== "edit") return null;
  return (
    state.characters.find(
      (character) => character.id === state.editingCharacterId,
    ) || state.character
  );
}

function updateCharacterMaxMessagesPreview() {
  const input = elements["character-max-messages"];
  const value = characterProfile.normalizeMaxConsecutiveMessages(input.value);
  input.value = String(value);
  elements["character-max-messages-value"].textContent = `${value} 条`;
  input.setAttribute("aria-valuetext", `${value} 条连续消息`);
}

function updateCharacterBackgroundPreview() {
  const preview = elements["character-background-preview"];
  const url = state.chatBackgroundDraftUrl;
  preview.classList.toggle("has-image", Boolean(url));
  preview.style.backgroundImage = url ? `url("${url}")` : "";
  preview.querySelector("span").textContent = url
    ? "这个角色会使用独立聊天背景"
    : "使用全局聊天背景";
}

async function handleChatBackgroundFile(event) {
  const files = event.target && event.target.files;
  const file = files && files[0];
  if (!file) return;

  if (!/^image\/(?:png|jpeg|webp)$/i.test(file.type)) {
    showToast("聊天背景请选择 PNG、JPG 或 WebP 图片。");
    event.target.value = "";
    return;
  }
  if (file.size > 16 * 1024 * 1024) {
    showToast("聊天背景文件不能超过 16 MB。");
    event.target.value = "";
    return;
  }

  try {
    const backgroundBlob = await window.PocketLabMedia.resizeWallpaperToBlob(
      file,
      {
        maxDimension: 1600,
        quality: 0.82,
      },
    );
    if (state.chatBackgroundDraftOwnsUrl) {
      window.PocketLabMedia.revokeObjectUrl(state.chatBackgroundDraftUrl);
    }
    state.chatBackgroundDraftBlob = backgroundBlob;
    state.chatBackgroundDraftUrl =
      window.PocketLabMedia.createObjectUrl(backgroundBlob);
    state.chatBackgroundDraftOwnsUrl = Boolean(
      state.chatBackgroundDraftUrl,
    );
    if (!state.chatBackgroundDraftUrl) {
      throw new Error("浏览器无法生成聊天背景预览。");
    }
    updateCharacterBackgroundPreview();
  } catch (error) {
    state.chatBackgroundDraftBlob = null;
    state.chatBackgroundDraftUrl =
      getCharacterEditorBase()?.chatBackgroundUrl || "";
    state.chatBackgroundDraftOwnsUrl = false;
    updateCharacterBackgroundPreview();
    reportStorageError(error, "读取聊天背景图片");
  } finally {
    event.target.value = "";
  }
}

function clearChatBackgroundDraft() {
  if (state.chatBackgroundDraftOwnsUrl) {
    window.PocketLabMedia.revokeObjectUrl(state.chatBackgroundDraftUrl);
  }
  state.chatBackgroundDraftBlob = null;
  state.chatBackgroundDraftUrl = "";
  state.chatBackgroundDraftOwnsUrl = false;
  elements["character-chat-background-file"].value = "";
  updateCharacterBackgroundPreview();
}

function applyCharacterChatBackground() {
  const chatView = elements["chat-view"];
  if (!chatView) return;
  const url = state.character?.chatBackgroundUrl || "";
  chatView.style.setProperty(
    "--character-chat-background-image",
    url ? `url("${url}")` : "none",
  );
  chatView.classList.toggle("has-character-background", Boolean(url));
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function ensureConnectedForChat() {
  const { apiUrl, modelName, apiKey } = window.PocketLabSettings.readApiSettings();

  if (state.connected && apiUrl && modelName && apiKey) {
    return { apiUrl, modelName, apiKey };
  }

  state.connected = false;
  window.PocketLabSettings.setConnected(false);
  updateConnectionUI();
  showToast("请先在设置页完成 API 连接。");
  showView("settings");
  window.setTimeout(() => elements["api-url"].focus(), 200);
  return null;
}

function discardPendingRetractionsBeforeNewTurn() {
  const retractedTurnIds = new Set(
    state.messages
      .filter((message) => message.retracted)
      .map((message) => getTurnId(message))
      .filter(Boolean),
  );
  if (!retractedTurnIds.size) return false;

  state.messages = state.messages.filter((message) => {
    if (!retractedTurnIds.has(getTurnId(message))) return true;
    return message.role === "user" && !message.retracted;
  });
  return true;
}

function handleChatSubmit(event) {
  event.preventDefault();
  if (isChatInteractionLocked()) return;

  const content = elements["chat-input"].value.trim();
  if (!content) return;

  const config = ensureConnectedForChat();
  if (!config) return;

  const pendingMessages = getPendingMessages();
  const nextBatchIndex = pendingMessages.length + 1;

  if (nextBatchIndex > chatBatchLimits.maxMessages) {
    showToast(`这一组最多 ${chatBatchLimits.maxMessages} 条，请先点击“总结并回复”。`);
    return;
  }

  const nextContent = content.slice(0, 4000);
  const message = {
    id: createId(),
    characterId: state.activeCharacterId,
    role: "user",
    content: nextContent,
    createdAt: Date.now(),
    turnId: (pendingMessages[0] && pendingMessages[0].turnId) || `turn-${createId()}`,
    failed: false,
    retracted: false,
    retractedMode: "",
    pendingReply: true,
    batchId: (pendingMessages[0] && pendingMessages[0].batchId) || `batch-${createId()}`,
    batchIndex: nextBatchIndex,
  };

  if (
    window.PocketLabChatSummary.buildPrompt([...pendingMessages, message]).length >
      chatBatchLimits.maxPromptCharacters
  ) {
    showToast("这一组消息总字数过长，请先点击“总结并回复”。");
    return;
  }

  discardPendingRetractionsBeforeNewTurn();
  state.messages.push(message);
  elements["chat-input"].value = "";
  resizeChatInput();
  persistMessages();
  renderChat();
  window.setTimeout(() => elements["chat-input"].focus(), 40);
}

function buildProviderMessages(requestInput) {
  const currentMessages = (Array.isArray(requestInput) ? requestInput : [requestInput]).filter(
    Boolean,
  );
  if (!currentMessages.length) return [];

  const firstMessage = currentMessages[0];
  const currentIds = new Set(currentMessages.map((message) => message.id));
  const currentIndex = state.messages.findIndex((message) => message.id === firstMessage.id);
  const sourceHistory = state.messages.slice(0, Math.max(0, currentIndex));
  const recentHistory = sourceHistory
    .filter((message) => !currentIds.has(message.id))
    .filter((message) => message.role === "user" || message.role === "assistant")
    .filter((message) => !message.retracted)
    .filter((message) => !message.failed && !message.pendingReply)
    .slice(-20)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));

  const summaryPrompt = window.PocketLabChatSummary.buildPrompt(currentMessages);
  if (!summaryPrompt) return [];

  return [
    ...recentHistory,
    {
      role: "user",
      content: summaryPrompt,
    },
  ];
}

function handleReplyPendingBatch() {
  if (isChatInteractionLocked()) return;

  const pendingMessages = getPendingMessages();
  if (!pendingMessages.length) return;

  const config = ensureConnectedForChat();
  if (config) requestSummaryReply(pendingMessages, config);
}

function handleChatMessageAction(event) {
  if (state.isSwitchingCharacter) return;
  const eventTarget = event.target;
  const target =
    eventTarget instanceof Element ? eventTarget : eventTarget && eventTarget.parentElement;
  if (!target) return;

  const retryButton = target.closest("[data-retry-message-id]");
  if (retryButton) {
    const message = state.messages.find(
      (item) => item.id === retryButton.dataset.retryMessageId,
    );
    if (!message || message.retracted || state.isReplying) return;
    const config = ensureConnectedForChat();
    if (!config) return;

    const groupMessages = message.batchId
      ? getPendingMessages(message.batchId)
      : [message];
    requestSummaryReply(groupMessages.length ? groupMessages : [message], config);
    return;
  }

  const deleteReplyButton = target.closest("[data-delete-reply-id]");
  if (deleteReplyButton) {
    deleteMessageReply(deleteReplyButton.dataset.deleteReplyId);
    return;
  }

  const retractButton = target.closest("[data-retract-turn-id]");
  if (retractButton) {
    retractTurn(retractButton.dataset.retractTurnId);
    return;
  }

  const regenerateButton = target.closest("[data-regenerate-turn-id]");
  if (regenerateButton) {
    regenerateTurn(regenerateButton.dataset.regenerateTurnId);
    return;
  }

  const deleteTurnButton = target.closest("[data-delete-turn-id]");
  if (deleteTurnButton) {
    deleteTurn(deleteTurnButton.dataset.deleteTurnId);
    return;
  }
}

function canEditTurn(turnId) {
  if (isChatInteractionLocked()) return false;
  if (isLatestTurn(turnId)) return true;
  showToast("为避免打乱后续上下文，目前只能撤回最近一轮对话。");
  return false;
}

function deleteMessageReply(messageId) {
  if (isChatInteractionLocked()) return;
  const message = state.messages.find((item) => item.id === messageId);
  if (!message || message.role !== "assistant" || message.retracted) return;

  const turnId = getTurnId(message);
  if (!canEditTurn(turnId)) return;

  getTurnMessages(turnId)
    .filter((item) => item.role === "assistant")
    .forEach((item) => {
      item.retracted = true;
      item.retractedMode = "reply";
    });
  persistMessages();
  renderChat();
  showToast("回复已撤回，可以重新生成。");
}

function retractTurn(turnId) {
  if (isChatInteractionLocked()) return;
  const turnMessages = getTurnMessages(turnId);
  if (!turnMessages.length || !canEditTurn(turnId)) return;

  turnMessages.forEach((message) => {
    message.retracted = true;
    message.retractedMode = "turn";
    if (message.role === "user") message.pendingReply = false;
  });
  persistMessages();
  renderChat();
  showToast("本轮对话已撤回，可以重新生成或彻底删除。");
}

function deleteTurn(turnId) {
  if (isChatInteractionLocked()) return;
  if (!isLatestTurn(turnId)) {
    showToast("目前只能删除最近一轮对话。");
    return;
  }

  state.messages = state.messages.filter((message) => getTurnId(message) !== turnId);
  persistMessages();
  renderChat();
  showToast("本轮对话已彻底删除。");
}

async function regenerateTurn(turnId) {
  if (!canEditTurn(turnId)) return;

  const config = ensureConnectedForChat();
  if (!config) return;

  const turnMessages = getTurnMessages(turnId);
  const userMessages = turnMessages.filter(
    (message) => message.role === "user" && message.content.trim(),
  );
  if (!userMessages.length) {
    showToast("这一轮没有可以重新发送的提问。");
    return;
  }

  userMessages.forEach((message) => {
    message.retracted = false;
    message.retractedMode = "";
    message.failed = false;
    message.error = null;
  });
  state.messages = state.messages.filter(
    (message) => !(getTurnId(message) === turnId && message.role === "assistant"),
  );
  persistMessages();

  await requestSummaryReply(userMessages, config);
}

async function requestSummaryReply(messages, config) {
  if (isChatInteractionLocked()) return;

  const requestMessages = messages.filter(
    (message) =>
      message &&
      message.role === "user" &&
      typeof message.content === "string" &&
      !message.retracted,
  );
  if (!requestMessages.length) return;

  const requestCharacter = { ...state.character };
  const requestCharacterId = requestCharacter.id;
  state.isReplying = true;
  requestMessages.forEach((message) => {
    message.failed = false;
    message.error = null;
    message.pendingReply = true;
  });
  persistMessages();
  renderChat();

  let boundWorldBook = null;
  let assistantReplyLines = [];
  let assistantMessage = null;
  let failure = null;

  if (requestCharacter.worldBookId) {
    try {
      boundWorldBook = await window.PocketLabStorage.getWorldBook(
        requestCharacter.worldBookId,
      );
    } catch (error) {
      failure = {
        title: "无法读取角色世界书",
        message: error?.message || "本机世界书数据库没有响应。",
        nextStep: "刷新页面后重试；如果仍然失败，请重新选择角色绑定的世界书。",
        status: 0,
      };
    }
    if (!boundWorldBook && !failure) {
      failure = {
        title: "角色绑定的世界书不存在",
        message: "这个角色原绑定的世界书已经找不到，本次请求没有发送。",
        nextStep: "打开角色编辑，重新选择一本世界书或改为“不绑定世界书”，然后重试。",
        status: 0,
      };
    }
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), apiRequestTimeoutMs);

  try {
    if (!failure) {
      const requestBody = {
        apiUrl: config.apiUrl,
        apiKey: config.apiKey,
        modelName: config.modelName,
        characterName: requestCharacter.name,
        persona: requestCharacter.persona,
        messages: buildProviderMessages(requestMessages),
      };
      if (boundWorldBook) {
        requestBody.worldBook = {
          name: boundWorldBook.name,
          content: boundWorldBook.content,
        };
      }
      const selectedSelfProfileId = characterProfile.normalizeStableId(
        requestCharacter.selfProfileId,
      );
      const selectedSelfProfile = selectedSelfProfileId
        ? window.PocketLabSelfProfileApp?.getProfileById?.(
            selectedSelfProfileId,
          )
        : null;
      const activeSelfProfile =
        window.PocketLabSelfProfileApp?.getActiveProfile?.();
      const conversationSelfProfile =
        selectedSelfProfile || activeSelfProfile;
      if (
        conversationSelfProfile?.name &&
        conversationSelfProfile?.persona
      ) {
        requestBody.userProfile = {
          name: conversationSelfProfile.name,
          persona: conversationSelfProfile.persona,
        };
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => null);
      if (!payload) {
        throw new Error("本地聊天服务返回了无法识别的结果。");
      }

      if (!response.ok || !payload.ok) {
        failure = normalizeChatError(payload.error, response.status);
      } else {
        const reply = String(payload.reply || "").trim();
        const normalizedReply =
          window.PocketLabChatSummary.normalizeReply(reply);
        const replyLines = characterProfile.limitReplyLines(
          splitReplyLines(normalizedReply),
          requestCharacter.maxConsecutiveMessages,
        );
        if (!replyLines.length) {
          failure = {
            title: "模型没有返回文字",
            message: "服务商完成了请求，但回复内容为空。",
            nextStep:
              "点击“重试总结”再试；如果连续出现，换用普通对话模型。",
            status: Number(payload.status) || 0,
          };
        } else {
          assistantReplyLines = replyLines;
        }
      }
    }
  } catch (error) {
    if (error.name === "AbortError") {
      failure = {
        title: "回复超时",
        message: `本地服务等待模型服务商超过约 ${Math.round(
          apiRequestTimeoutMs / 1000,
        )} 秒，没有返回完整回复。`,
        nextStep: "先检查网络和服务商状态，然后点击“重试总结”。",
        status: 0,
      };
    } else {
      failure = {
        title: "无法连接本地聊天服务",
        message: error.message || "本地服务没有响应。",
        nextStep: `确认启动窗口仍在运行，再刷新 ${window.location.origin} 后重试。`,
        status: 0,
      };
    }
  } finally {
    window.clearTimeout(timeout);
  }

  if (assistantReplyLines.length) {
    requestMessages.forEach((message) => {
      message.pendingReply = false;
      message.failed = false;
      message.error = null;
    });
    assistantMessage = {
      id: createId(),
      characterId: requestCharacterId,
      role: "assistant",
      content: assistantReplyLines.join("\n"),
      replyLines: assistantReplyLines,
      maxConsecutiveMessages: characterProfile.normalizeMaxConsecutiveMessages(
        requestCharacter.maxConsecutiveMessages,
      ),
      createdAt: Date.now(),
      turnId: requestMessages[0].turnId,
      failed: false,
      retracted: false,
      retractedMode: "",
    };
    state.messages.push(assistantMessage);
    persistMessages();
  } else {
    const failedMessage = requestMessages[requestMessages.length - 1];
    requestMessages.forEach((message) => {
      message.failed = false;
      message.error = null;
      message.pendingReply = true;
    });
    failedMessage.failed = true;
    failedMessage.error = failure || normalizeChatError(
      {
        title: "回复失败",
        message: "没有收到模型回复。",
        nextStep: "检查 API 设置后再重试。",
      },
      0,
    );
  }

  if (assistantMessage) {
    await revealAssistantReply(assistantMessage, assistantReplyLines);
  }

  state.isReplying = false;
  persistMessages();
  renderChat();
  window.setTimeout(() => elements["chat-input"].focus(), 80);
}

function normalizeChatError(rawError, fallbackStatus) {
  const error = normalizeConnectionError(rawError || {});
  return {
    title: error.title,
    message: error.message,
    nextStep: error.nextStep,
    status: Number(rawError && rawError.status) || Number(fallbackStatus) || 0,
  };
}

function updateConnectionUI() {
  elements["header-status"].classList.toggle("is-connected", state.connected);
  elements["header-status"].innerHTML = state.connected
    ? '<span class="status-dot"></span>已连接'
    : '<span class="status-dot"></span>未连接';

  updateChatConnectionUI();
}

function toggleKeyVisibility() {
  const isPassword = elements["api-key"].type === "password";
  elements["api-key"].type = isPassword ? "text" : "password";
  elements["toggle-key"].setAttribute("aria-label", isPassword ? "隐藏 API Key" : "显示 API Key");
  elements["toggle-key"].innerHTML = `<span data-icon="${isPassword ? "eye-off" : "eye"}"></span>`;
  hydrateIcons();
}

function clearFieldError(fieldId) {
  const input = document.getElementById(fieldId);
  const error = document.getElementById(`${fieldId}-error`);
  input.closest(".field").classList.remove("has-error");
  error.textContent = "";
}

function setFieldError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const error = document.getElementById(`${fieldId}-error`);
  input.closest(".field").classList.add("has-error");
  error.textContent = message;
}

function validateSettings() {
  let isValid = true;
  const apiUrl = elements["api-url"].value.trim();
  const apiKey = elements["api-key"].value.trim();
  const modelName = elements["model-name"].value.trim();

  ["api-url", "api-key", "model-name"].forEach(clearFieldError);

  if (!apiUrl) {
    setFieldError("api-url", "请填写接口地址。");
    isValid = false;
  } else if (!isHttpUrl(apiUrl)) {
    setFieldError("api-url", "接口地址需要以 http:// 或 https:// 开头。");
    isValid = false;
  }

  if (!apiKey) {
    setFieldError("api-key", "请填写 API Key。");
    isValid = false;
  }

  if (!modelName) {
    setFieldError("model-name", "请填写服务商提供的模型 ID。");
    isValid = false;
  }

  return isValid;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeConnectionError(error) {
  const raw = error || {};
  const message = String(raw.message || "系统没有返回错误详情。");
  const isWindowsTlsCredentialError =
    raw.code === "windows_tls_credentials" ||
    /安全包中没有可用的凭证|security package has no credentials?|no credentials are available in the security package|SEC_E_NO_CREDENTIALS|0x8009030e/i.test(
      message,
    );

  if (isWindowsTlsCredentialError) {
    return {
      title: "正在运行旧版连接组件",
      message: `当前页面收到了旧版 Windows HTTPS 组件的错误：${message}`,
      nextStep:
        "关闭所有旧的启动窗口，再到项目文件夹双击 start.bat，等新服务启动后强制刷新本页面，再点一次“连接测试”。新版本只使用 Node/OpenSSL，不再调用 Windows Schannel。这不是 API Key、模型名或接口地址内容错误。",
    };
  }

  const isSocketPermissionError =
    /以一种访问权限不允许的方式做了一个访问套接字的尝试|An attempt was made to access a socket in a way forbidden by its access permissions|10013.*socket|socket.*10013|访问套接字/i.test(
      message,
    );
  if (isSocketPermissionError) {
    return {
      title: "本机网络权限阻止了连接",
      message: `Windows 阻止了本地服务访问接口地址：${message}`,
      nextStep:
        "先刷新页面再测试。若仍然出现，请关闭原来的黑色启动窗口，再到项目文件夹双击 start.bat，从普通 Windows 桌面重新启动；并在防火墙或安全软件中允许 PowerShell 访问网络。这不是 API Key 错误。",
    };
  }

  const isStructuredTransportError =
    raw.code &&
    !["network", "request_incomplete", "tls_transport"].includes(raw.code);
  const isTlsError =
    /\bSSL\b|\bTLS\b|secure channel|安全通道|Schannel|SEC_E_|0x800903|authentication failed/i.test(message);
  if (isTlsError && !isStructuredTransportError) {
    return {
      title: "本机无法建立 HTTPS 连接",
      message: `Windows 在建立加密连接时返回：${message}`,
      nextStep:
        "先用浏览器打开服务商官网，确认当前网络能正常访问；再检查 VPN、代理、公司网络或安全软件是否拦截 HTTPS。这不是 API Key 错误。",
    };
  }

  if (raw.code === "connection_reset") {
    const hasLocalServiceContext =
      /页面已经连接到电脑上的本地服务|浏览器到电脑/.test(message);
    return {
      title: "电脑无法连接模型服务商",
      message: hasLocalServiceContext
        ? message
        : `页面已经连接到电脑上的本地服务，说明浏览器到电脑这一段正常；失败发生在电脑到模型服务商这一段。${message}`,
      nextStep:
        raw.nextStep ||
        "先关闭 Radmin VPN、其他 VPN 或代理，再点一次“连接测试”。如果仍然失败，请把电脑网络切换到手机热点后再测试。此阶段不要先修改 API Key。",
    };
  }

  if (
    raw.code === "timeout" ||
    raw.code === "api_proxy_timeout" ||
    /接口地址在 \d+ 秒内没有响应|连接超时|响应超时/.test(message)
  ) {
    return {
      title: "连接超时",
      message:
        raw.code === "api_proxy_timeout"
          ? "页面已经连接到电脑上的本地服务，但本地服务等待模型服务商时超时。失败发生在电脑到模型服务商这一段，不是手机 Wi-Fi 或 API Key 格式问题。"
          : message,
      nextStep:
        raw.nextStep ||
        "先用电脑浏览器打开服务商控制台，确认当前网络能访问；再退出 Radmin VPN、其他 VPN 和代理后重试。若仍超时，可把电脑网络切换到手机热点，或换用响应更快的普通对话模型。",
    };
  }

  if (raw.code === "api_proxy_unavailable" || raw.code === "transport_internal") {
    return {
      title: "本地 API 服务没有响应",
      message,
      nextStep:
        raw.nextStep ||
        "关闭旧的启动窗口，重新双击 start.bat，看到电脑与手机地址后再刷新页面测试。",
    };
  }

  return {
    title: raw.title || "连接失败",
    message,
    nextStep: raw.nextStep || "请核对接口地址、API Key 和模型名后重试。",
  };
}

async function handleConnectionTest(event) {
  event.preventDefault();
  if (!validateSettings()) {
    showResultError("配置还没填完整", "请先检查表单里标红的内容。", "补齐必填项后再点一次“连接测试”。");
    return;
  }

  const apiUrl = elements["api-url"].value.trim();
  const apiKey = elements["api-key"].value.trim();
  const modelName = elements["model-name"].value.trim();
  saveSettings();
  setLoading(true);
  showTestingResult();

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), apiRequestTimeoutMs);

  try {
    const response = await fetch("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiUrl, apiKey, modelName }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null);
    if (!payload) {
      throw new Error(`本地测试服务返回了无法识别的结果（HTTP ${response.status}）。`);
    }

    if (response.ok && payload.ok) {
      state.connected = true;
      window.PocketLabSettings.setConnected(true);
      updateConnectionUI();
      showResultSuccess(payload);
    } else {
      state.connected = false;
      window.PocketLabSettings.setConnected(false);
      updateConnectionUI();
      const error = normalizeConnectionError(payload.error);
      showResultError(
        error.title,
        error.message,
        error.nextStep,
        response.status,
      );
    }
  } catch (error) {
    state.connected = false;
    window.PocketLabSettings.setConnected(false);
    updateConnectionUI();
    if (error.name === "AbortError") {
      showResultError(
        "连接超时",
        "页面已连接到电脑上的本地服务，但等待模型服务商超过约 120 秒。失败发生在电脑到模型服务商这一段，不是手机 Wi-Fi 问题。",
        "先检查电脑能否打开服务商控制台；再退出 Radmin VPN、其他 VPN 和代理后重试。若仍超时，可切换到手机热点或换用响应更快的普通对话模型。",
        504,
      );
    } else {
      showResultError(
        "无法连接本地测试服务",
        error.message || "本地服务没有响应。",
        `确认启动窗口仍在运行，再刷新 ${window.location.origin} 重试。`,
      );
    }
  } finally {
    window.clearTimeout(timeout);
    setLoading(false);
  }
}

function setLoading(isLoading) {
  elements["test-connection"].disabled = isLoading;
  elements["test-connection"].classList.toggle("is-loading", isLoading);
  elements["test-connection"].setAttribute("aria-busy", String(isLoading));
}

function showTestingResult() {
  const result = elements["test-result"];
  result.className = "test-result";
  elements["result-icon"].innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true" class="result-spinner">' + icons.loader + "</svg>";
  elements["result-kicker"].textContent = "正在测试";
  elements["result-title"].textContent = "正在请求模型服务";
  elements["result-message"].textContent = "通常需要几秒，请保持当前页面打开。";
  elements["result-meta"].innerHTML = "";
  elements["next-step"].classList.add("is-hidden");
}

function showResultSuccess(payload) {
  const result = elements["test-result"];
  result.className = "test-result is-success";
  elements["result-icon"].innerHTML = `<span data-icon="circle-check"></span>`;
  elements["result-kicker"].textContent = "连接成功";
  elements["result-title"].textContent = "API 已可用";
  elements["result-message"].textContent = payload.reply
    ? `模型回复：“${truncate(payload.reply, 160)}”`
    : "服务商已接受请求并返回有效响应。";

  const metaItems = [
    ["状态", `HTTP ${payload.status || 200}`],
    ["模型", payload.model || elements["model-name"].value.trim()],
    ["耗时", `${payload.latencyMs || 0} ms`],
    ["测试端点", payload.endpoint || "chat/completions"],
  ];
  elements["result-meta"].innerHTML = metaItems
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd title="${escapeHtml(value)}">${escapeHtml(value)}</dd></div>`)
    .join("");
  elements["next-step"].classList.add("is-hidden");
  hydrateIcons();
  result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  showToast("连接成功，API 配置已可用。");
}

function showResultError(title, message, nextStep, status) {
  const result = elements["test-result"];
  result.className = "test-result is-error";
  elements["result-icon"].innerHTML = `<span data-icon="alert-triangle"></span>`;
  elements["result-kicker"].textContent = status ? `连接失败 · HTTP ${status}` : "连接失败";
  elements["result-title"].textContent = title;
  elements["result-message"].textContent = message;
  elements["result-meta"].innerHTML = "";
  elements["next-step"].classList.remove("is-hidden");
  elements["next-step-text"].textContent = nextStep;
  hydrateIcons();
  result.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function showToast(message) {
  window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  state.toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2800);
}

function truncate(value, maxLength) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
