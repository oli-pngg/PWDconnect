'use client';

import { Pause, Play, Square, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/components/language-provider';

export function TextToSpeechControls() {
  const { language } = useLanguage();
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  function readPage() {
    if (!('speechSynthesis' in window)) {
      setStatus('Text to speech is not available in this browser.');
      return;
    }

    const main = document.getElementById('main-content') ?? document.body;
    const text = (main.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 14000);
    if (!text) {
      setStatus('There is no page text available to read.');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'tl' ? 'tl-PH' : 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onstart = () => {
      setSpeaking(true);
      setPaused(false);
      setStatus('Reading page.');
    };
    utterance.onend = () => {
      setSpeaking(false);
      setPaused(false);
      setStatus('Finished reading page.');
    };
    utterance.onerror = () => {
      setSpeaking(false);
      setPaused(false);
      setStatus('Text to speech could not read this page.');
    };
    window.speechSynthesis.speak(utterance);
  }

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
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
    setStatus('Reading stopped.');
  }

  return (
    <div className="speech-controls" aria-label="Text to speech controls">
      <button className="button secondary small" type="button" onClick={readPage} aria-label="Read page aloud">
        <Volume2 size={15} aria-hidden="true" /><span>Read page</span>
      </button>
      <button className="button secondary small" type="button" onClick={togglePause} disabled={!speaking} aria-label={paused ? 'Resume reading' : 'Pause reading'}>
        {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}<span>{paused ? 'Resume' : 'Pause'}</span>
      </button>
      <button className="button secondary small" type="button" onClick={stopReading} disabled={!speaking} aria-label="Stop reading">
        <Square size={14} aria-hidden="true" /><span>Stop</span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">{status}</span>
    </div>
  );
}
