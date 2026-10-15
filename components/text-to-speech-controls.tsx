'use client';

import { Pause, Play, Square, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useLanguage } from '@/components/language-provider';

function pageText(): string {
  const selection = window.getSelection()?.toString().replace(/\s+/g, ' ').trim();
  if (selection && selection.length > 1) return selection.slice(0, 14000);
  const main = document.getElementById('main-content') ?? document.body;
  return (main.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 14000);
}

export function TextToSpeechControls({ showControls = true }: { showControls?: boolean }) {
  const { language } = useLanguage();
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rate, setRate] = useState(0.95);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState('');
  const [status, setStatus] = useState('');
  const [expanded, setExpanded] = useState(false);
  const rateId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const voiceId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const statusRef = useRef(false);

  const stopSilent = useCallback(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
  }, []);

  useEffect(() => {
    statusRef.current = true;
    function loadVoices() {
      if (!('speechSynthesis' in window)) return;
      const all = window.speechSynthesis.getVoices();
      const wanted = language === 'tl' ? 'tl' : 'en';
      const ranked = [...all].sort((a, b) => {
        const aScore = a.lang.toLowerCase().startsWith(wanted) ? 0 : a.lang.toLowerCase().startsWith('en') ? 1 : 2;
        const bScore = b.lang.toLowerCase().startsWith(wanted) ? 0 : b.lang.toLowerCase().startsWith('en') ? 1 : 2;
        return aScore - bScore || a.name.localeCompare(b.name);
      });
      setVoices(ranked.slice(0, 12));
    }
    loadVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      statusRef.current = false;
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, [language]);

  const readPage = useCallback(() => {
    if (!('speechSynthesis' in window)) {
      setStatus('Text to speech is not available in this browser.');
      return;
    }
    const text = pageText();
    if (!text) {
      setStatus('There is no page text available to read.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'tl' ? 'tl-PH' : 'en-US';
    utterance.rate = rate;
    utterance.pitch = 1;
    const chosen = voices.find((v) => v.voiceURI === voiceURI);
    if (chosen) utterance.voice = chosen;
    utterance.onstart = () => {
      setSpeaking(true);
      setPaused(false);
      setStatus(text === window.getSelection()?.toString().trim() ? 'Reading selected text.' : 'Reading page. Select text first to read only that part.');
    };
    utterance.onend = () => {
      setSpeaking(false);
      setPaused(false);
      setStatus('Finished reading.');
    };
    utterance.onerror = () => {
      setSpeaking(false);
      setPaused(false);
      setStatus('Text to speech could not read this page.');
    };
    window.speechSynthesis.speak(utterance);
  }, [language, rate, voices, voiceURI]);

  // System-wide voice + keyboard control: Alt+R reads, custom events from
  // AccessibilityTools voice commands start/stop reading on any page.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      if (typing) return;
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        readPage();
      }
    }
    function onRead() {
      readPage();
    }
    function onStop() {
      stopSilent();
      setStatus('Reading stopped.');
    }
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('pwd-read-page', onRead);
    window.addEventListener('pwd-stop-reading', onStop);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pwd-read-page', onRead);
      window.removeEventListener('pwd-stop-reading', onStop);
    };
  }, [readPage, stopSilent]);

  function togglePause() {
    if (!('speechSynthesis' in window) || !speaking) return;
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setPaused(false);
      setStatus('Reading page.');
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
      setStatus('Reading paused.');
    }
  }

  function stopReading() {
    stopSilent();
    setStatus('Reading stopped.');
  }

  if (!showControls) {
    return (
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {status}
      </span>
    );
  }

  return (
    <div className="speech-controls" role="group" aria-label={language === 'tl' ? 'Mga kontrol sa pagbasa ng pahina' : 'Text to speech controls'}>
      <button className="button secondary small" type="button" onClick={readPage} aria-label={language === 'tl' ? 'Basahin ang pahina nang malakas (Alt+R)' : 'Read page aloud (Alt+R)'} title="Alt+R · reads selection if any, else the page">
        <Volume2 size={15} aria-hidden="true" />
        <span>Read page</span>
      </button>
      <button className="button secondary small" type="button" onClick={togglePause} disabled={!speaking} aria-label={paused ? 'Resume reading' : 'Pause reading'} aria-disabled={!speaking}>
        {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
        <span>{paused ? 'Resume' : 'Pause'}</span>
      </button>
      <button className="button secondary small" type="button" onClick={stopReading} disabled={!speaking} aria-label="Stop reading" aria-disabled={!speaking}>
        <Square size={14} aria-hidden="true" />
        <span>Stop</span>
      </button>
      <button
        className="button secondary small speech-more"
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={`tts-options-${rateId}`}
        title={language === 'tl' ? 'Bilis at boses' : 'Speed and voice'}
      >
        <span aria-hidden="true">···</span>
        <span className="sr-only">{expanded ? 'Hide voice options' : 'Show voice speed and voice options'}</span>
      </button>
      {expanded ? (
        <span className="tts-options" id={`tts-options-${rateId}`} role="group" aria-label="Voice speed and voice">
          <label htmlFor={`tts-rate-${rateId}`}>
            Speed <output htmlFor={`tts-rate-${rateId}`}>{rate.toFixed(2)}×</output>
          </label>
          <input
            id={`tts-rate-${rateId}`}
            type="range"
            min={0.6}
            max={1.4}
            step={0.05}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            aria-valuetext={`${rate.toFixed(2)} times speed`}
          />
          <label htmlFor={`tts-voice-${voiceId}`}>Voice</label>
          <select id={`tts-voice-${voiceId}`} value={voiceURI} onChange={(e) => setVoiceURI(e.target.value)}>
            <option value="">Auto ({language === 'tl' ? 'tl-PH' : 'en-US'})</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} · {v.lang}
              </option>
            ))}
          </select>
        </span>
      ) : null}
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {status}
      </span>
    </div>
  );
}
