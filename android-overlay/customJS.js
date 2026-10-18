/*
 * Safe, idempotent interaction helpers for the remote Arena page. This layer
 * does not make AI/network requests, replace chat messages, or intercept normal
 * clicks. It adds accessible code-copy actions and keyboard/touch polish only.
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

  // Only provide press feedback. Existing site clicks are never delayed/intercepted.
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

  // If the keyboard reduces the visual viewport, reveal a focused editor only
  // when it is obscured. Do not force global scrolls or steal chat scroll.
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

  const alreadyHasCopyAction = (pre) => {
    const candidates = [...pre.querySelectorAll('button, [role="button"]')];
    if (pre.parentElement) candidates.push(...pre.parentElement.querySelectorAll('button, [role="button"]'));
    return candidates.some((el) => /copy/i.test(`${el.textContent} ${el.getAttribute('aria-label') || ''}`));
  };

  const addCopyAction = (pre) => {
    if (pre.dataset.arenaCopyReady === 'true' || alreadyHasCopyAction(pre)) return;
    pre.dataset.arenaCopyReady = 'true';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'arena-code-copy';
    button.setAttribute('aria-label', 'Copy code');
    button.setAttribute('aria-live', 'polite');
    button.textContent = 'Copy';
    pre.appendChild(button);
  };

  const inspectForCode = (node) => {
    if (!(node instanceof Element)) return;
    if (node.matches('pre')) addCopyAction(node);
    node.querySelectorAll('pre').forEach(addCopyAction);
  };

  const observeCode = () => {
    document.querySelectorAll('pre').forEach(addCopyAction);
    if (!document.body || !window.MutationObserver) return;
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) inspectForCode(node);
      }
    });
    // Observe inserted nodes only; no polling and no scans of the whole chat on
    // every streamed text update.
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.body) observeCode();
  else document.addEventListener('DOMContentLoaded', observeCode, { once: true });

  const fallbackCopy = (text) => {
    const temporary = document.createElement('textarea');
    temporary.value = text;
    temporary.setAttribute('readonly', '');
    temporary.style.position = 'fixed';
    temporary.style.opacity = '0';
    temporary.style.pointerEvents = 'none';
    document.body.appendChild(temporary);
    temporary.select();
    const copied = document.execCommand('copy');
    temporary.remove();
    return copied;
  };

  document.addEventListener('click', async (event) => {
    const button = event.target instanceof Element ? event.target.closest('.arena-code-copy') : null;
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const pre = button.closest('pre');
    const code = pre && (pre.querySelector('code') || pre);
    const text = code ? code.innerText : '';
    if (!text) return;

    let copied = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        copied = true;
      } else {
        copied = fallbackCopy(text);
      }
    } catch (_) {
      try { copied = fallbackCopy(text); } catch (_) { copied = false; }
    }

    button.textContent = copied ? 'Copied' : 'Could not copy';
    button.setAttribute('aria-label', copied ? 'Code copied' : 'Could not copy code');
    if (button._arenaResetTimer) window.clearTimeout(button._arenaResetTimer);
    button._arenaResetTimer = window.setTimeout(() => {
      if (!button.isConnected) return;
      button.textContent = 'Copy';
      button.setAttribute('aria-label', 'Copy code');
      button._arenaResetTimer = 0;
    }, 1400);
  });
})();
