"use strict";

((root) => {
  const OPEN_CLASS = "is-app-opening";
  const OPEN_ANIMATION = "app-open-zoom";
  const CLEANUP_FALLBACK_MS = 1100;

  let activeTransition = null;

  function release(transition) {
    if (!transition) return;
    root.clearTimeout(transition.timer);
    transition.view.removeEventListener("animationend", transition.onAnimationEnd);
    transition.view.classList.remove(OPEN_CLASS);
    if (activeTransition === transition) activeTransition = null;
  }

  function cancel() {
    release(activeTransition);
  }

  function play(view) {
    if (!view) return;
    cancel();

    const transition = {
      view,
      timer: 0,
      onAnimationEnd: null,
    };

    transition.onAnimationEnd = (event) => {
      if (
        event.target !== view ||
        event.animationName !== OPEN_ANIMATION
      ) {
        return;
      }
      release(transition);
    };

    activeTransition = transition;
    view.classList.remove(OPEN_CLASS);
    void view.offsetWidth;
    view.addEventListener("animationend", transition.onAnimationEnd);
    view.classList.add(OPEN_CLASS);
    transition.timer = root.setTimeout(
      () => release(transition),
      CLEANUP_FALLBACK_MS,
    );
  }

  root.PocketLabAppTransition = Object.freeze({
    play,
    cancel,
  });
})(window);
