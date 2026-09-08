'use client';

import { Mic, MicOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getSpeechRecognition, speechText, type BrowserSpeechRecognition } from '@/lib/speech';

type VoiceSignupControlsProps = {
  onName: (value: string) => void;
  onEmail: (value: string) => void;
  onRole: (value: 'candidate' | 'employer') => void;
};

type VoiceStep = 'name' | 'email' | 'role';

function cleanSpokenEmail(value: string) {
  return value.toLowerCase()
    .replace(/\s+at\s+/g, '@')
    .replace(/\s+(dot|period)\s+/g, '.')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9@._%+\-]/g, '');
}

function removePrompt(value: string, words: string[]) {
  const pattern = new RegExp(`^(${words.join('|')})\\s*`, 'i');
  return value.replace(pattern, '').trim();
}

export function VoiceSignupControls({ onName, onEmail, onRole }: VoiceSignupControlsProps) {
  const [listening, setListening] = useState(false);
  const [step, setStep] = useState<VoiceStep>('name');
  const [status, setStatus] = useState('');
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const stepRef = useRef<VoiceStep>('name');

  useEffect(() => () => recognitionRef.current?.abort(), []);

  function stop() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }

  function processTranscript(transcript: string) {
    const spoken = transcript.trim();
    const normalized = spoken.toLowerCase();
    if (!spoken) return;
    if (normalized.includes('stop voice') || normalized === 'stop') {
      stop();
      setStatus('Voice sign-up stopped.');
      return;
    }

    if (normalized.includes('employer') || normalized.includes('hire inclusively') || normalized.includes('organization') || normalized.includes('organisasyon')) {
      onRole('employer');
      stepRef.current = 'role';
      setStep('role');
      setStatus('Employer account selected. Say your name or email, or stop voice input. Your password stays text-only.');
      return;
    }
    if (normalized.includes('job seeker') || normalized.includes('candidate') || normalized.includes('find work') || normalized.includes('naghahanap ng trabaho')) {
      onRole('candidate');
      stepRef.current = 'role';
      setStep('role');
      setStatus('Job seeker account selected. Say your name or email, or stop voice input. Your password stays text-only.');
      return;
    }

    if (stepRef.current === 'name') {
      const name = removePrompt(spoken, ['my name is', 'name is', 'name']);
      onName(name);
      stepRef.current = 'email';
      setStep('email');
      setStatus('Name added. Say your email address. You can say "at" and "dot".');
      return;
    }
    if (stepRef.current === 'email') {
      const email = cleanSpokenEmail(removePrompt(spoken, ['my email is', 'email is', 'email']));
      onEmail(email);
      stepRef.current = 'role';
      setStep('role');
      setStatus('Email added. Say "job seeker" or "employer". Do not speak your password.');
      return;
    }

    setStatus('Say job seeker or employer. Your password must be entered by text.');
  }

  function start() {
    const recognition = getSpeechRecognition();
    if (!recognition) {
      setStatus('Voice input is not available in this browser. You can complete the form with the keyboard.');
      return;
    }
    recognition.lang = document.documentElement.lang === 'tl' ? 'fil-PH' : 'en-US';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => processTranscript(speechText(event));
    recognition.onerror = (event) => {
      setListening(false);
      setStatus(event.error === 'not-allowed' ? 'Microphone access was not allowed. Use the keyboard instead.' : 'Voice input stopped. Try again or use the keyboard.');
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    stepRef.current = 'name';
    setStep('name');
    setListening(true);
    setStatus('Listening. Say your name first. Voice input does not collect your password.');
    try {
      recognition.start();
    } catch {
      setListening(false);
      setStatus('Voice input could not start. Use the keyboard instead.');
    }
  }

  return <div className="voice-signup">
    <button className="button secondary small" type="button" onClick={listening ? stop : start} aria-pressed={listening}>
      {listening ? <MicOff size={15} aria-hidden="true" /> : <Mic size={15} aria-hidden="true" />}
      {listening ? 'Stop voice fill' : 'Fill form by voice'}
    </button>
    <p className="field-help">{listening ? `Step ${step}: name, email, then account type.` : 'Optional. Your browser will ask for microphone permission.'}</p>
    <p className="sr-status" role="status" aria-live="polite">{status}</p>
  </div>;
}
