"use strict";

(() => {
  const displayMode = window.matchMedia?.("(display-mode: standalone)");
  const standalone =
    window.navigator.standalone === true || displayMode?.matches === true;
  document.documentElement.classList.toggle("pwa-standalone", standalone);
})();
