'use client';

import { useEffect, useState } from 'react';
import { useAccessibility } from '@/components/accessibility-provider';
import { getSpeechRecognition, speechText } from '@/lib/speech';

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
    element.matches('a,button,input,select,textarea,[role="button"],[tabindex]')
  );
}

export function AccessibilityOverlays() {
  const { preferences } = useAccessibility();
  const [liveText, setLiveText] = useState('');
  const [liveStatus, setLiveStatus] = useState('');
  const [hoverText, setHoverText] = useState<{ text: string; x: number; y: number } | null>(null);
  const [typingText, setTypingText] = useState('');

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
    if (!preferences.voiceOver) return;
    function speakFocus(event: FocusEvent) {
      const element = event.target as HTMLElement | null;
      if (!element || !isUsefulTarget(element) || !('speechSynthesis' in window)) return;
      const name = readableName(element);
      if (!name) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(name);
      utterance.lang = document.documentElement.lang === 'tl' ? 'tl-PH' : 'en-US';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
    document.addEventListener('focusin', speakFocus);
    return () => document.removeEventListener('focusin', speakFocus);
  }, [preferences.voiceOver]);

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
        <div className="live-recognition-overlay" role="status" aria-live="polite" aria-atomic="true">
          <strong>Live recognition</strong>
          <span>{liveText || liveStatus || 'Listening'}</span>
        </div>
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
