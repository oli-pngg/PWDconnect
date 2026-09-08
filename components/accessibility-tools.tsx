'use client';

import { Accessibility, Captions, Eye, Keyboard, Mic, MicOff, Type, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/components/language-provider';
import { getSpeechRecognition, speechText, type BrowserSpeechRecognition } from '@/lib/speech';

type Preferences = {
  contrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  visualAlerts: boolean;
  captions: boolean;
  textFirst: boolean;
  spaceNavigation: boolean;
};

const defaultPreferences: Preferences = {
  contrast: false,
  largeText: false,
  reducedMotion: false,
  visualAlerts: true,
  captions: true,
  textFirst: true,
  spaceNavigation: false
};

function navigationPath(command: string) {
  const normalized = command.toLowerCase().replace(/[.,!?]/g, ' ').replace(/\s+/g, ' ').trim();
  if (normalized.includes('go back') || normalized === 'back') return 'back';
  if (normalized.includes('dashboard') || normalized.includes('overview') || normalized.includes('buod')) return '/dashboard';
  if (normalized.includes('find work') || normalized.includes('browse jobs') || normalized.includes('jobs') || normalized.includes('maghanap ng trabaho')) return '/jobs';
  if (normalized.includes('assessment') || normalized.includes('skills test') || normalized.includes('pagsusuri')) return '/assessment';
  if (normalized.includes('my profile') || normalized === 'profile' || normalized.includes('organization profile') || normalized.includes('aking profile')) return '/profile';
  if (normalized.includes('post an opening') || normalized.includes('new opening') || normalized.includes('mag post')) return '/employer/jobs/new';
  if (normalized.includes('my openings') || normalized.includes('manage openings') || normalized.includes('aking mga opening')) return '/employer/jobs';
  if (normalized.includes('candidate matches') || normalized.includes('candidate pool') || normalized.includes('mga tugma')) return '/employer/candidates';
  return null;
}

export function AccessibilityTools() {
  const { language, t } = useLanguage();
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const loadedPreferences = useRef(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem('pwd-connect-accessibility');
      let nextPreferences = defaultPreferences;
      try {
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<Preferences>;
          nextPreferences = Object.keys(defaultPreferences).reduce((result, key) => {
            const preference = key as keyof Preferences;
            return typeof parsed[preference] === 'boolean' ? { ...result, [preference]: parsed[preference] } : result;
          }, defaultPreferences);
        }
      } catch {
        window.localStorage.removeItem('pwd-connect-accessibility');
      }
      loadedPreferences.current = true;
      setPreferences(nextPreferences);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loadedPreferences.current) return;
    const root = document.documentElement;
    root.dataset.contrast = preferences.contrast ? 'high' : 'normal';
    root.dataset.textSize = preferences.largeText ? 'large' : 'normal';
    root.dataset.reducedMotion = preferences.reducedMotion ? 'true' : 'false';
    root.dataset.visualAlerts = preferences.visualAlerts ? 'on' : 'off';
    root.dataset.captions = preferences.captions ? 'on' : 'off';
    root.dataset.textFirst = preferences.textFirst ? 'on' : 'off';
    root.dataset.spaceNavigation = preferences.spaceNavigation ? 'on' : 'off';
    window.localStorage.setItem('pwd-connect-accessibility', JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  function update(key: keyof Preferences, value: boolean) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  function stopVoice() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setVoiceListening(false);
  }

  function startVoice() {
    const recognition = getSpeechRecognition();
    if (!recognition) {
      setVoiceStatus('Voice commands are not available in this browser. Use the keyboard or a screen reader instead.');
      return;
    }
    recognition.lang = language === 'tl' ? 'fil-PH' : 'en-US';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = speechText(event);
      const path = navigationPath(transcript);
      if (transcript.toLowerCase().includes('stop voice') || transcript.toLowerCase() === 'stop') {
        stopVoice();
        setVoiceStatus('Voice commands stopped.');
      } else if (path === 'back') {
        window.history.back();
        setVoiceStatus('Going back.');
      } else if (path) {
        setVoiceStatus(`Opening ${path === '/dashboard' ? 'dashboard' : path.replace('/employer/', '').replace('/', '')}.`);
        window.location.assign(path);
      } else {
        setVoiceStatus('Command not recognized. Say dashboard, find work, assessment, profile, or stop voice.');
      }
    };
    recognition.onerror = (event) => {
      setVoiceListening(false);
      setVoiceStatus(event.error === 'not-allowed' ? 'Microphone access was not allowed. Use the keyboard or a screen reader instead.' : 'Voice commands stopped. Try again or use the keyboard.');
    };
    recognition.onend = () => setVoiceListening(false);
    recognitionRef.current = recognition;
    setVoiceListening(true);
    setVoiceStatus('Listening. Say dashboard, find work, assessment, profile, or stop voice.');
    try {
      recognition.start();
    } catch {
      setVoiceListening(false);
      setVoiceStatus('Voice commands could not start. Use the keyboard or a screen reader instead.');
    }
  }

  return (
    <div className="accessibility-tools">
      <details className="accessibility-menu">
        <summary><Accessibility size={17} aria-hidden="true" /><span>{t('accessibility')}</span></summary>
        <div className="accessibility-panel" role="group" aria-label="Accessibility controls">
          <div className="accessibility-panel-header"><div><strong>{language === 'tl' ? 'Iangkop ang PWD Connect sa iyo' : 'Make PWD Connect work for you'}</strong><p>{language === 'tl' ? 'Nananatili ang mga setting sa device na ito. Hindi nito binabago ang fit score.' : 'These settings stay on this device. They never affect your fit score.'}</p></div></div>
          <fieldset className="accessibility-group">
            <legend><Eye size={15} aria-hidden="true" /> {language === 'tl' ? 'Biswal' : 'Visual'}</legend>
            <label className="accessibility-control"><span><strong>High contrast</strong><small>Stronger borders and color separation</small></span><input type="checkbox" checked={preferences.contrast} onChange={(event) => update('contrast', event.target.checked)} /></label>
            <label className="accessibility-control"><span><strong>Larger text</strong><small>Increase the reading size across the app</small></span><input type="checkbox" checked={preferences.largeText} onChange={(event) => update('largeText', event.target.checked)} /></label>
            <label className="accessibility-control"><span><strong>Reduce motion</strong><small>Limit animations and transitions</small></span><input type="checkbox" checked={preferences.reducedMotion} onChange={(event) => update('reducedMotion', event.target.checked)} /></label>
            <label className="accessibility-control"><span><strong>Emphasize visual alerts</strong><small>Make success and error messages easier to spot</small></span><input type="checkbox" checked={preferences.visualAlerts} onChange={(event) => update('visualAlerts', event.target.checked)} /></label>
          </fieldset>
          <fieldset className="accessibility-group">
            <legend><Captions size={15} aria-hidden="true" /> {language === 'tl' ? 'Pandinig' : 'Hearing'}</legend>
            <label className="accessibility-control"><span><strong>Caption reminders</strong><small>Show reminders that instructions and feedback are text-based</small></span><input type="checkbox" checked={preferences.captions} onChange={(event) => update('captions', event.target.checked)} /></label>
            {preferences.captions ? <p className="accessibility-note">PWD Connect does not require audio-only instructions, phone calls, or video interviews.</p> : null}
          </fieldset>
          <fieldset className="accessibility-group">
            <legend><Keyboard size={15} aria-hidden="true" /> {language === 'tl' ? 'Keyboard at boses' : 'Keyboard and voice'}</legend>
            <label className="accessibility-control"><span><strong>Space navigation mode</strong><small>Press Space once for the next control and twice to select it. Text fields stay normal.</small></span><input type="checkbox" checked={preferences.spaceNavigation} onChange={(event) => update('spaceNavigation', event.target.checked)} /></label>
            <div className="voice-command-control">
              <div><strong>Voice commands</strong><small>Say &quot;dashboard&quot;, &quot;find work&quot;, &quot;profile&quot;, &quot;assessment&quot;, or &quot;stop voice&quot;.</small></div>
              <button className="button secondary small" type="button" onClick={voiceListening ? stopVoice : startVoice} aria-pressed={voiceListening}>
                {voiceListening ? <MicOff size={14} aria-hidden="true" /> : <Mic size={14} aria-hidden="true" />}
                {voiceListening ? 'Stop voice' : 'Start voice'}
              </button>
            </div>
            <p className="sr-status" role="status" aria-live="polite">{voiceStatus}</p>
          </fieldset>
          <fieldset className="accessibility-group">
            <legend><Type size={15} aria-hidden="true" /> {language === 'tl' ? 'Pagsasalita at komunikasyon' : 'Speech and communication'}</legend>
            <label className="accessibility-control"><span><strong>Text-first communication</strong><small>Keep communication alternatives visible instead of voice-only steps</small></span><input type="checkbox" checked={preferences.textFirst} onChange={(event) => update('textFirst', event.target.checked)} /></label>
            {preferences.textFirst ? <p className="accessibility-note"><Keyboard size={14} aria-hidden="true" /> You can complete every PWD Connect task without speaking.</p> : null}
          </fieldset>
          <div className="accessibility-panel-footer"><Volume2 size={14} aria-hidden="true" /><span>{language === 'tl' ? 'May suporta bilang default sa screen reader, keyboard navigation, caption, at text response.' : 'Screen readers, keyboard navigation, captions, and text responses are supported by default.'}</span></div>
        </div>
      </details>
      <span className="sr-only" aria-live="polite">{preferences.captions && preferences.textFirst ? 'Text instructions and communication alternatives are enabled.' : ''}</span>
    </div>
  );
}
