'use client';

import { useEffect, useState } from 'react';

const interactiveSelector = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [role="button"]:not([aria-disabled="true"]), [tabindex]:not([tabindex="-1"])';

function isTypingTarget(element: Element | null) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
  if (element instanceof HTMLInputElement) return !['checkbox', 'radio', 'button', 'submit', 'reset'].includes(element.type);
  return false;
}

function visibleInteractiveElements() {
  return Array.from(document.querySelectorAll<HTMLElement>(interactiveSelector)).filter((element) => {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
  });
}

export function SpaceNavigation() {
  const [status, setStatus] = useState('');

  useEffect(() => {
    const saved = window.localStorage.getItem('pwd-connect-accessibility');
    try {
      const preferences = saved ? JSON.parse(saved) as { spaceNavigation?: boolean } : null;
      document.documentElement.dataset.spaceNavigation = preferences?.spaceNavigation ? 'on' : 'off';
    } catch {
      document.documentElement.dataset.spaceNavigation = 'off';
    }

    let lastSpaceAt = 0;
    function moveOrSelect(event: KeyboardEvent) {
      if (event.key !== ' ' || document.documentElement.dataset.spaceNavigation !== 'on') return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || isTypingTarget(event.target as Element | null)) return;

      const elements = visibleInteractiveElements();
      if (!elements.length) return;
      const active = document.activeElement as HTMLElement | null;
      const activeIndex = active ? elements.indexOf(active) : -1;
      const now = Date.now();
      event.preventDefault();

      if (now - lastSpaceAt < 650 && active && activeIndex >= 0) {
        active.click();
        lastSpaceAt = 0;
        setStatus('Selected.');
        return;
      }

      const next = elements[(activeIndex + 1) % elements.length];
      next.focus();
      lastSpaceAt = now;
      setStatus('Focused the next control. Press Space again to select it.');
    }

    document.addEventListener('keydown', moveOrSelect);
    return () => document.removeEventListener('keydown', moveOrSelect);
  }, []);

  return <span className="sr-only" role="status" aria-live="polite">{status}</span>;
}
