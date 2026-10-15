'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAccessibility } from '@/components/accessibility-provider';
import { useLanguage } from '@/components/language-provider';
import { getSpeechRecognition, speechText } from '@/lib/speech';
import { speakScreenReaderText } from '@/lib/screen-reader';

function readableName(element: HTMLElement) {
  const labelledBy = element.getAttribute('aria-labelledby');
  const labelledText = labelledBy
    ? labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ')
    : '';
  const label = element.getAttribute('aria-label') || labelledText || element.getAttribute('title');
  if (label) return label.trim();
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    const associatedLabel = element.labels?.[0]?.textContent;
    if (associatedLabel) return associatedLabel.trim();
    if ('placeholder' in element && element.placeholder) return element.placeholder;
  }
  return (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160);
}

function isUsefulTarget(element: HTMLElement) {
  return Boolean(
    element.closest('#pwd-connect-app') &&
    element.matches('a[href],button,input:not([type="hidden"]),select,textarea,summary,legend[tabindex="0"],h2#question-heading,[role="button"],[role="checkbox"],[role="radio"],[role="switch"],[role="textbox"]')
  );
}

function assessmentQuestionContext(element: HTMLElement) {
  const assessmentCard = element.closest('.assessment-card');
  const questionHeading = assessmentCard?.querySelector<HTMLElement>('#question-heading');
  if (questionHeading) {
    const progress = assessmentCard?.querySelector('.assessment-progress > span')?.textContent?.trim();
    const prompt = questionHeading.textContent?.replace(/\s+/g, ' ').trim();
    return [progress, prompt].filter(Boolean).join('. ');
  }

  return element.closest('fieldset.rand36-item')?.querySelector('legend')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function focusedControlAnnouncement(element: HTMLElement) {
  const name = readableName(element);
  if (!name) return '';

  const isTagalog = document.documentElement.lang === 'tl';
  const terms = isTagalog
    ? { button: 'button', link: 'link', textField: 'text field', passwordField: 'password field', checkbox: 'checkbox', checked: 'may check', notChecked: 'walang check', mixed: 'mixed', radio: 'radio button', selected: 'selected', expanded: 'expanded', collapsed: 'collapsed', pressed: 'pressed', notPressed: 'not pressed' }
    : { button: 'button', link: 'link', textField: 'text field', passwordField: 'password field', checkbox: 'checkbox', checked: 'checked', notChecked: 'not checked', mixed: 'mixed', radio: 'radio button', selected: 'selected', expanded: 'expanded', collapsed: 'collapsed', pressed: 'pressed', notPressed: 'not pressed' };

  if (element.matches('h2#question-heading')) {
    const context = assessmentQuestionContext(element);
    return context ? `${context}.` : `${name}, question.`;
  }

  if (element instanceof HTMLInputElement) {
    const questionContext = assessmentQuestionContext(element);
    const prefix = questionContext ? `${questionContext}. ` : '';
    if (element.type === 'checkbox') {
      return `${prefix}${name}, ${terms.checkbox}, ${element.checked ? terms.checked : terms.notChecked}.`;
    }
    if (element.type === 'radio') {
      return `${prefix}${name}, ${terms.radio}, ${element.checked ? terms.selected : terms.notChecked}.`;
    }
    if (element.type === 'password') return `${name}, ${terms.passwordField}.`;
    if (['button', 'image', 'reset', 'submit'].includes(element.type)) return `${name}, ${terms.button}.`;
    return `${name}, ${terms.textField}.`;
  }

  if (element.getAttribute('role') === 'checkbox') {
    const questionContext = assessmentQuestionContext(element);
    const checked = element.getAttribute('aria-checked');
    const state = checked === 'mixed' ? terms.mixed : checked === 'true' ? terms.checked : terms.notChecked;
    return `${questionContext ? `${questionContext}. ` : ''}${name}, ${terms.checkbox}, ${state}.`;
  }
  if (element.getAttribute('role') === 'radio') {
    const questionContext = assessmentQuestionContext(element);
    const state = element.getAttribute('aria-checked') === 'true' ? terms.selected : terms.notChecked;
    return `${questionContext ? `${questionContext}. ` : ''}${name}, ${terms.radio}, ${state}.`;
  }
  if (element.getAttribute('role') === 'switch') {
    const state = element.getAttribute('aria-checked') === 'true' ? terms.checked : terms.notChecked;
    return `${name}, switch, ${state}.`;
  }
  if (element.getAttribute('role') === 'textbox') return `${name}, ${terms.textField}.`;

  if (element instanceof HTMLTextAreaElement) return `${name}, ${terms.textField}.`;
  if (element instanceof HTMLSelectElement) {
    const selected = element.selectedOptions[0]?.textContent?.trim();
    return `${name}${selected ? `, ${selected}` : ''}.`;
  }

  if (element instanceof HTMLButtonElement || element.getAttribute('role') === 'button') {
    const state = element.getAttribute('aria-pressed');
    const expanded = element.getAttribute('aria-expanded');
    const details = [state === null ? '' : state === 'true' ? terms.pressed : terms.notPressed, expanded === null ? '' : expanded === 'true' ? terms.expanded : terms.collapsed].filter(Boolean);
    return `${name}, ${terms.button}${details.length ? `, ${details.join(', ')}` : ''}.`;
  }

  if (element.tagName === 'SUMMARY') {
    const open = element.parentElement instanceof HTMLDetailsElement && element.parentElement.open;
    return `${name}, ${terms.button}, ${open ? terms.expanded : terms.collapsed}.`;
  }

  if (element instanceof HTMLAnchorElement) return `${name}, ${terms.link}.`;
  return name;
}

export function AccessibilityOverlays() {
  const { preferences, updatePreference, screenReaderEnabled } = useAccessibility();
  const { language } = useLanguage();
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const [liveText, setLiveText] = useState('');
  const [liveStatus, setLiveStatus] = useState('');
  const [hoverText, setHoverText] = useState<{ text: string; x: number; y: number } | null>(null);
  const [typingText, setTypingText] = useState('');

  function stopLiveRecognition() {
    updatePreference('liveRecognition', false);
    window.requestAnimationFrame(() => {
      const controls = Array.from(document.querySelectorAll<HTMLElement>('.accessibility-menu summary'));
      controls.find((control) => control.getClientRects().length > 0)?.focus();
    });
  }

  useEffect(() => {
    if (!preferences.liveRecognition) return;
    const recognition = getSpeechRecognition();
    if (!recognition) {
      const timer = window.setTimeout(() => setLiveStatus('Live recognition is not available in this browser.'), 0);
      return () => window.clearTimeout(timer);
    }

    recognition.lang = document.documentElement.lang === 'tl' ? 'fil-PH' : 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      setLiveText(speechText(event));
      setLiveStatus('Listening');
    };
    recognition.onerror = (event) => {
      setLiveStatus(event.error === 'not-allowed' ? 'Microphone access was not allowed.' : 'Live recognition stopped.');
    };
    recognition.onend = () => setLiveStatus('Live recognition stopped.');
    let initialStatusTimer: number;
    try {
      recognition.start();
      initialStatusTimer = window.setTimeout(() => setLiveStatus('Listening'), 0);
    } catch {
      initialStatusTimer = window.setTimeout(() => setLiveStatus('Live recognition could not start.'), 0);
    }
    return () => {
      window.clearTimeout(initialStatusTimer);
      recognition.abort();
    };
  }, [preferences.liveRecognition]);

  useEffect(() => {
    if (!screenReaderEnabled) return;

    function speakFocus(event: FocusEvent) {
      const element = event.target as HTMLElement | null;
      if (!element || element.closest('[data-native-screen-reader]') || !isUsefulTarget(element) || !('speechSynthesis' in window)) return;
      const announcement = focusedControlAnnouncement(element);
      if (!announcement) return;
      speakScreenReaderText(announcement, language);
    }

    function speakActivation(event: KeyboardEvent) {
      if (event.key !== 'Enter') return;
      const element = document.activeElement as HTMLElement | null;
      if (!element || element.closest('[data-native-screen-reader]') || !isUsefulTarget(element)) return;
      const activates = element instanceof HTMLButtonElement
        || element instanceof HTMLAnchorElement
        || element.getAttribute('role') === 'button'
        || (element instanceof HTMLInputElement && ['button', 'image', 'reset', 'submit'].includes(element.type));
      if (!activates) return;
      speakScreenReaderText(`Activating: ${readableName(element)}`, language);
    }

    document.addEventListener('focusin', speakFocus);
    document.addEventListener('keyup', speakActivation);
    return () => {
      document.removeEventListener('focusin', speakFocus);
      document.removeEventListener('keyup', speakActivation);
    };
  }, [language, screenReaderEnabled]);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    if (!screenReaderEnabled) return;

    const frame = window.requestAnimationFrame(() => {
      const appRoot = document.getElementById('pwd-connect-app');
      const heading = appRoot?.querySelector<HTMLElement>('main h1, h1');
      if (!appRoot || !heading) return;

      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body || !appRoot.contains(active)) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
      speakScreenReaderText(heading.textContent?.replace(/\s+/g, ' ').trim() || 'Page loaded.', language);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [language, pathname, screenReaderEnabled]);

  useEffect(() => {
    if (!preferences.hoverText) return;
    function show(event: Event) {
      const element = event.target as HTMLElement | null;
      if (!element || !isUsefulTarget(element)) return;
      const text = readableName(element);
      if (!text) return;
      const pointer = event instanceof PointerEvent ? { x: event.clientX, y: event.clientY } : { x: 24, y: 24 };
      setHoverText({ text, x: pointer.x, y: pointer.y });
    }
    function move(event: PointerEvent) {
      if (!hoverText) return;
      setHoverText((current) => current ? { ...current, x: event.clientX, y: event.clientY } : current);
    }
    function clear() {
      setHoverText(null);
    }
    document.addEventListener('pointerover', show);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerout', clear);
    document.addEventListener('focusin', show);
    document.addEventListener('focusout', clear);
    return () => {
      document.removeEventListener('pointerover', show);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerout', clear);
      document.removeEventListener('focusin', show);
      document.removeEventListener('focusout', clear);
    };
  }, [preferences.hoverText, hoverText]);

  useEffect(() => {
    if (!preferences.hoverTyping) return;
    function update(event: Event) {
      const element = event.target as HTMLInputElement | HTMLTextAreaElement | null;
      if (!element || !(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return;
      setTypingText(element.type === 'password' ? '•'.repeat(element.value.length) : element.value || element.placeholder);
    }
    function clear(event: Event) {
      const element = event.target as HTMLElement | null;
      if (element?.matches('input,textarea')) setTypingText('');
    }
    document.addEventListener('focusin', update);
    document.addEventListener('input', update);
    document.addEventListener('focusout', clear);
    return () => {
      document.removeEventListener('focusin', update);
      document.removeEventListener('input', update);
      document.removeEventListener('focusout', clear);
    };
  }, [preferences.hoverTyping]);

  return (
    <>
      {preferences.liveRecognition ? (
        <section className="live-recognition-overlay" aria-label={language === 'tl' ? 'Live na pagkilala sa pagsasalita' : 'Live speech recognition'}>
          <div className="live-recognition-status" role="status" aria-live="polite" aria-atomic="true">
            <strong>Live recognition</strong>
            <span>{liveText || liveStatus || 'Listening'}</span>
          </div>
          <button className="button secondary small live-recognition-stop" type="button" onClick={stopLiveRecognition}>
            {language === 'tl' ? 'Itigil ang live recognition' : 'Stop live recognition'}
          </button>
        </section>
      ) : null}
      {preferences.hoverText && hoverText ? (
        <div className="hover-text-overlay" role="tooltip" style={{ left: hoverText.x + 14, top: hoverText.y + 14 }}>
          {hoverText.text}
        </div>
      ) : null}
      {preferences.hoverTyping && typingText ? (
        <div className="hover-typing-overlay" role="status" aria-live="polite" aria-atomic="true">
          {typingText}
        </div>
      ) : null}
    </>
  );
}
