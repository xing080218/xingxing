"use strict";

(() => {
  const DEFAULT_PASSWORD = "1234";
  const HASH_SALT = "yingxingyu-lock-screen-v1:";
  const keys = Object.freeze({
    enabled: "pocket-lab-lock-password-enabled",
    passwordHash: "pocket-lab-lock-password-hash",
  });

  function read(key) {
    try {
      return window.localStorage.getItem(key) || "";
    } catch {
      return "";
    }
  }

  function write(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return null;
    } catch (error) {
      return error;
    }
  }

  function normalizePin(value) {
    const pin = String(value || "");
    return /^\d{4}$/.test(pin) ? pin : "";
  }

  async function digestPin(pin) {
    const source = `${HASH_SALT}${pin}`;

    if (window.crypto && window.crypto.subtle && typeof window.TextEncoder === "function") {
      const bytes = new window.TextEncoder().encode(source);
      const digest = await window.crypto.subtle.digest("SHA-256", bytes);
      return `sha256:${Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("")}`;
    }

    let hash = 0x811c9dc5;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  function isEnabled() {
    return read(keys.enabled) !== "false";
  }

  function setEnabled(enabled) {
    return write(keys.enabled, enabled ? "true" : "false");
  }

  function hasCustomPassword() {
    return Boolean(read(keys.passwordHash));
  }

  async function verifyPassword(value) {
    const pin = normalizePin(value);
    if (!pin) return false;

    const storedHash = read(keys.passwordHash);
    if (!storedHash) return pin === DEFAULT_PASSWORD;
    return (await digestPin(pin)) === storedHash;
  }

  async function setPassword(value) {
    const pin = normalizePin(value);
    if (!pin) {
      throw new Error("锁屏密码必须是四位数字。");
    }

    const passwordHash = await digestPin(pin);
    return write(keys.passwordHash, passwordHash);
  }

  window.PocketLabLockPassword = {
    keys,
    DEFAULT_PASSWORD,
    isEnabled,
    setEnabled,
    hasCustomPassword,
    verifyPassword,
    setPassword,
  };
})();
