'use client';

import { useEffect, useState } from 'react';

const interactiveSelector =
  'a[href], area[href], button, input, select, textarea, summary, [contenteditable="true"], [tabindex]';

function isTypingTarget(element: Element | null) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
  if (element instanceof HTMLInputElement)
    return !['checkbox', 'radio', 'button', 'submit', 'reset'].includes(element.type);
  return false;
}

function visibleInteractiveElements() {
  const appRoot = document.getElementById('pwd-connect-app');
  if (!appRoot) return [];

  const visible = Array.from(appRoot.querySelectorAll<HTMLElement>(interactiveSelector)).filter((element) => {
    if (element.tabIndex < 0 || element.matches(':disabled') || element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
  });

  const tabbable = visible.filter((element) => {
    if (!(element instanceof HTMLInputElement) || element.type !== 'radio' || !element.name) return true;
    const group = visible.filter(
      (candidate) => candidate instanceof HTMLInputElement && candidate.type === 'radio' && candidate.name === element.name && candidate.form === element.form
    );
    const checkedRadio = group.find((radio) => radio instanceof HTMLInputElement && radio.checked);
    return checkedRadio ? element === checkedRadio : element === group[0];
  });

  return tabbable.sort((left, right) => {
    if (left.tabIndex === 0 && right.tabIndex > 0) return 1;
    if (left.tabIndex > 0 && right.tabIndex === 0) return -1;
    if (left.tabIndex > 0 && right.tabIndex > 0) return left.tabIndex - right.tabIndex;
    return 0;
  });
}

function isSpaceNavOn() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.dataset.spaceNavigation === 'on';
}

export function SpaceNavigation() {
  const [status, setStatus] = useState('');
  const [badge, setBadge] = useState({ on: false, label: '', index: 0, total: 0 });

  useEffect(() => {
    // Fallback init so the mode works system-wide even before the provider hydrates.
    try {
      const saved = window.localStorage.getItem('pwd-connect-accessibility');
      const preferences = saved ? (JSON.parse(saved) as { spaceNavigation?: boolean }) : null;
      if (!document.documentElement.dataset.spaceNavigation) {
        document.documentElement.dataset.spaceNavigation = preferences?.spaceNavigation ? 'on' : 'off';
      }
    } catch {
      if (!document.documentElement.dataset.spaceNavigation) document.documentElement.dataset.spaceNavigation = 'off';
    }
    const initTimer = window.setTimeout(() => {
      setBadge((b) => ({ ...b, on: isSpaceNavOn() }));
    }, 0);

    // Observe dataset so the visible indicator follows toggles from ANY toolbar.
    const observer = new MutationObserver(() => {
      setBadge((b) => ({ ...b, on: isSpaceNavOn() }));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-space-navigation'] });

    let lastSpaceAt = 0;
    function moveOrSelect(event: KeyboardEvent) {
      if (event.defaultPrevented) return;

      // Wrap native Tab traversal so focus stays among visible app controls.
      if (event.key === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey) {
        const elements = visibleInteractiveElements();
        if (!elements.length) return;

        const active = document.activeElement as HTMLElement | null;
        const activeIndex = active ? elements.indexOf(active) : -1;
        const atBoundary = event.shiftKey ? activeIndex <= 0 : activeIndex < 0 || activeIndex === elements.length - 1;
        if (atBoundary) {
          event.preventDefault();
          const target = elements[event.shiftKey ? elements.length - 1 : 0];
          target?.focus();
        }
        return;
      }

      if (event.key !== ' ' && event.key !== 'Spacebar') return;
      if (!isSpaceNavOn()) return;
      if (event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target as Element | null)) return;

      const elements = visibleInteractiveElements();
      if (!elements.length) return;
      const active = document.activeElement as HTMLElement | null;
      const activeIndex = active ? elements.indexOf(active) : -1;
      const now = Date.now();
      const backwards = event.shiftKey;
      event.preventDefault();

      // Double-press selects; Enter always activates natively (WCAG 2.1.1 safe).
      if (!backwards && now - lastSpaceAt < 650 && active && activeIndex >= 0) {
        active.click();
        lastSpaceAt = 0;
        setStatus('Selected. Space navigation remains on. Turn it off in Accessibility controls to restore normal Space behavior.');
        return;
      }

      const nextIndex = backwards
        ? (activeIndex <= 0 ? elements.length : activeIndex) - 1
        : (activeIndex + 1) % elements.length;
      const next = elements[nextIndex];
      next.focus();
      lastSpaceAt = now;
      const label =
        next.getAttribute('aria-label') || (next.textContent || '').trim().slice(0, 80) || next.tagName.toLowerCase();
      setBadge({ on: true, label, index: nextIndex + 1, total: elements.length });
      setStatus(
        backwards
          ? `Focused previous control ${nextIndex + 1} of ${elements.length}: ${label}. Quickly press Space again to select, Enter to activate, or Shift+Space to keep going back.`
          : `Focused next control ${nextIndex + 1} of ${elements.length}: ${label}. Quickly press Space again to select, or Enter to activate.`
      );
    }

    document.addEventListener('keydown', moveOrSelect);
    return () => {
      window.clearTimeout(initTimer);
      document.removeEventListener('keydown', moveOrSelect);
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {status}
      </span>
      {badge.on ? (
        <div className="space-nav-badge" role="status" aria-live="polite" aria-atomic="true">
          <strong>Space Nav ON</strong>
          <span>
            {badge.total > 0 ? `${badge.index}/${badge.total} · ` : ''}
            Space next · Shift+Space prev · 2×Space select · Enter activate · Esc is safe
          </span>
          <span className="sr-only">Turn off anytime in Accessibility controls.</span>
        </div>
      ) : null}
    </>
  );
}
