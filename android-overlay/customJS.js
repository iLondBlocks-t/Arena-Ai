/*
 * Safe, idempotent WebView interaction helpers. No network calls, AI behavior,
 * DOM replacement, polling, or background timers are added here.
 */
(() => {
  'use strict';
  if (window.__arenaAndroidInteractionPatch) return;
  window.__arenaAndroidInteractionPatch = true;

  const root = document.documentElement;
  let viewportFrame = 0;
  const viewport = window.visualViewport;

  const updateViewport = () => {
    if (viewportFrame) return;
    viewportFrame = window.requestAnimationFrame(() => {
      viewportFrame = 0;
      const height = viewport ? viewport.height : window.innerHeight;
      if (height > 0) root.style.setProperty('--arena-visual-viewport-height', `${height}px`);
    });
  };

  updateViewport();
  window.addEventListener('resize', updateViewport, { passive: true });
  if (viewport) {
    viewport.addEventListener('resize', updateViewport, { passive: true });
    viewport.addEventListener('scroll', updateViewport, { passive: true });
  }

  // Only provide press feedback. Clicks are never intercepted or delayed.
  const pressable = 'button, [role="button"], input[type="button"], input[type="submit"]';
  let pressedElement = null;
  let releaseTimer = 0;

  const release = () => {
    if (pressedElement) pressedElement.classList.remove('ai-touch-press');
    pressedElement = null;
    if (releaseTimer) window.clearTimeout(releaseTimer);
    releaseTimer = 0;
  };

  document.addEventListener('pointerdown', (event) => {
    const target = event.target instanceof Element ? event.target.closest(pressable) : null;
    if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true') return;
    release();
    pressedElement = target;
    target.classList.add('ai-touch-press');
    releaseTimer = window.setTimeout(release, 650);
  }, { passive: true });
  document.addEventListener('pointerup', release, { passive: true });
  document.addEventListener('pointercancel', release, { passive: true });
  document.addEventListener('pointerout', (event) => {
    if (pressedElement && event.target === pressedElement) release();
  }, { passive: true });
  window.addEventListener('blur', release, { passive: true });

  // If the keyboard reduces the visual viewport, reveal the focused editor only
  // when it is actually obscured. Do not force global scrolls or steal chat scroll.
  const editorSelector = 'textarea, input:not([type="button"]):not([type="submit"]), [contenteditable="true"]';
  document.addEventListener('focusin', (event) => {
    const editor = event.target instanceof Element ? event.target.closest(editorSelector) : null;
    if (!editor) return;
    window.requestAnimationFrame(() => {
      const rect = editor.getBoundingClientRect();
      const visibleHeight = viewport ? viewport.height : window.innerHeight;
      if (rect.bottom > visibleHeight || rect.top < 0) {
        editor.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      }
    });
  }, true);
})();
