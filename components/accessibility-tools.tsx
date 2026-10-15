'use client';

import { Accessibility, Captions, Eye, Keyboard, Mic, MicOff, RotateCcw, Type } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useAccessibility, type AccessibilityPreferences } from '@/components/accessibility-provider';
import { useLanguage } from '@/components/language-provider';
import { getSpeechRecognition, speechText, type BrowserSpeechRecognition } from '@/lib/speech';
import { announceScreenReaderState } from '@/lib/screen-reader';

type PreferenceKey = keyof AccessibilityPreferences;

function preferenceCommand(text: string): { key: PreferenceKey; value: boolean } | null {
  const t = text.toLowerCase();
  function has(...words: string[]) {
    return words.some((w) => t.includes(w));
  }
  const on = has('on', 'enable', 'start', 'buksan', 'i-on');
  const off = has('off', 'disable', 'stop', 'patayin', 'i-off');
  if (!on && !off) return null;
  const value = on && !off;
  if (has('high contrast', 'contrast', 'malinaw na contrast')) return { key: 'contrast', value };
  if (has('larger text', 'large text', 'big text', 'malaking text')) return { key: 'largeText', value };
  if (has('reduce motion', 'less motion', 'bawasan ang galaw')) return { key: 'reducedMotion', value };
  if (has('dyslexia', 'dyslexia friendly', 'readable font')) return { key: 'dyslexiaFriendly', value };
  if (has('spacing', 'line spacing', 'extra spacing', 'puwang')) return { key: 'extraSpacing', value };
  if (has('underline', 'underline links', 'salungguhit')) return { key: 'underlineLinks', value };
  if (has('focus', 'focus highlight', 'highlight focus')) return { key: 'focusHighlight', value };
  if (has('classic invert', 'classic inversion')) return { key: 'classicInvert', value };
  if (has('live recognition', 'live captions', 'live transcription')) return { key: 'liveRecognition', value };
  if (has('show borders', 'borders')) return { key: 'showBorders', value };
  if (has('reduce transparency', 'transparency')) return { key: 'reduceTransparency', value };
  if (has('reduce white point', 'white point')) return { key: 'reduceWhitePoint', value };
  if (has('smart invert', 'smart inversion')) return { key: 'smartInvert', value };
  if (has('dim flashing', 'flashing lights')) return { key: 'dimFlashingLights', value };
  if (has('hover text')) return { key: 'hoverText', value };
  if (has('hover typing')) return { key: 'hoverTyping', value };
  if (has('space navigation', 'space nav', 'space mode')) return { key: 'spaceNavigation', value };
  if (has('visual alert', 'alert')) return { key: 'visualAlerts', value };
  if (has('caption')) return { key: 'captions', value };
  if (has('text first', 'text-first')) return { key: 'textFirst', value };
  return null;
}

function navigationPath(command: string) {
  const normalized = command.toLowerCase().replace(/[.,!?]/g, ' ').replace(/\s+/g, ' ').trim();
  if (normalized.includes('go back') || normalized === 'back' || normalized.includes('bumalik')) return 'back';
  if (normalized.includes('landing')) return '/landing';
  if (normalized.includes('home')) return '/';
  if (normalized.includes('dashboard') || normalized.includes('overview') || normalized.includes('buod')) return '/dashboard';
  if (normalized.includes('find work') || normalized.includes('browse jobs') || normalized.includes('jobs') || normalized.includes('maghanap ng trabaho')) return '/jobs';
  if (normalized.includes('assessment') || normalized.includes('skills test') || normalized.includes('pagsusuri')) return '/assessment';
  if (normalized.includes('message') || normalized.includes('mensahe') || normalized.includes('inbox')) return '/messages';
  if (normalized.includes('my profile') || normalized === 'profile' || normalized.includes('organization profile') || normalized.includes('aking profile')) return '/profile';
  if (normalized.includes('post an opening') || normalized.includes('new opening') || normalized.includes('mag post')) return '/employer/jobs/new';
  if (normalized.includes('my openings') || normalized.includes('manage openings') || normalized.includes('aking mga opening')) return '/employer/jobs';
  if (normalized.includes('candidate matches') || normalized.includes('candidate pool') || normalized.includes('mga tugma')) return '/employer/candidates';
  return null;
}

const STRINGS = {
  en: {
    panelTitle: 'Make PWD Connect work for you',
    visual: 'Visual',
    highContrast: 'High contrast',
    largerText: 'Larger text',
    dyslexia: 'Dyslexia-friendly reading',
    spacing: 'Extra text spacing',
    underline: 'Always underline links',
    focus: 'Extra-visible focus',
    classicInvert: 'Classic invert',
    colorFilters: 'Color filters',
    colorFilterNone: 'Off',
    colorFilterGray: 'Grayscale',
    colorFilterRedGreen: 'Red-green filter',
    colorFilterGreenRed: 'Green-red filter',
    colorFilterBlueYellow: 'Blue-yellow filter',
    liveRecognition: 'Live recognition',
    showBorders: 'Show borders',
    reduceTransparency: 'Reduce transparency',
    reduceWhitePoint: 'Reduce white point',
    smartInvert: 'Smart invert',
    reduceMotion: 'Reduce motion',
    visualAlerts: 'Emphasize visual alerts',
    hearing: 'Hearing',
    captions: 'Caption reminders',
    screenReader: 'Screen reader',
    screenReaderOn: 'ON',
    screenReaderOff: 'OFF',
    zoom: 'Zoom',
    zoom100: '100%',
    zoom125: '125%',
    zoom150: '150%',
    zoom200: '200%',
    dimFlashingLights: 'Dim flashing lights',
    keyboardVoice: 'Keyboard and voice',
    spaceNav: 'Space navigation mode',
    voiceTitle: 'Voice commands',
    speech: 'Speech and communication',
    speakScreen: 'Speak screen',
    stopSpeaking: 'Stop speaking',
    textFirst: 'Text-first communication',
    shortcuts: 'Keyboard shortcuts',
    reset: 'Reset all accessibility settings',
    resetDone: 'Accessibility settings reset to defaults.',
    listening: 'Listening. Say dashboard, find work, messages, profile, read page, access toggles, or stop voice.',
    stopped: 'Voice commands stopped.',
    notAvailable: 'Voice commands are not available in this browser. Use the keyboard or a screen reader instead.',
    notRecognized: 'Command not recognized. Say dashboard, find work, messages, profile, read page, or stop voice.',
    readingStarted: 'Reading page aloud.',
    prefUpdated: 'Preference updated.'
  },
  tl: {
    panelTitle: 'Iangkop ang PWD Connect sa iyo',
    visual: 'Biswal',
    highContrast: 'High contrast',
    largerText: 'Mas malaking text',
    dyslexia: 'Madaling basahin (dyslexia-friendly)',
    spacing: 'Dagdag na puwang ng text',
    underline: 'Laging salungguhitan ang links',
    focus: 'Mas kitang focus',
    classicInvert: 'Classic invert',
    colorFilters: 'Color filters',
    colorFilterNone: 'Patay',
    colorFilterGray: 'Grayscale',
    colorFilterRedGreen: 'Red-green filter',
    colorFilterGreenRed: 'Green-red filter',
    colorFilterBlueYellow: 'Blue-yellow filter',
    liveRecognition: 'Live recognition',
    showBorders: 'Ipakita ang borders',
    reduceTransparency: 'Bawasan ang transparency',
    reduceWhitePoint: 'Bawasan ang white point',
    smartInvert: 'Smart invert',
    reduceMotion: 'Bawasan ang galaw',
    visualAlerts: 'Bigyang-diin ang visual alerts',
    hearing: 'Pandinig',
    captions: 'Mga paalala ng caption',
    screenReader: 'Screen reader',
    screenReaderOn: 'NAKA-ON',
    screenReaderOff: 'NAKA-OFF',
    zoom: 'Zoom',
    zoom100: '100%',
    zoom125: '125%',
    zoom150: '150%',
    zoom200: '200%',
    dimFlashingLights: 'I-dim ang flashing lights',
    keyboardVoice: 'Keyboard at boses',
    spaceNav: 'Space navigation mode',
    voiceTitle: 'Voice commands',
    speech: 'Pagsasalita at komunikasyon',
    speakScreen: 'Basahin ang screen',
    stopSpeaking: 'Itigil ang pagbasa',
    textFirst: 'Text-first na komunikasyon',
    shortcuts: 'Mga keyboard shortcut',
    reset: 'I-reset ang lahat ng setting',
    resetDone: 'Na-reset na ang mga setting sa default.',
    listening: 'Nakikinig. Sabihin ang dashboard, find work, messages, profile, read page, o stop voice.',
    stopped: 'Huminto ang voice commands.',
    notAvailable: 'Hindi available ang voice commands sa browser na ito. Gamitin ang keyboard o screen reader.',
    notRecognized: 'Hindi nakilala ang utos. Sabihin ang dashboard, find work, messages, profile, o stop voice.',
    readingStarted: 'Binabasa ang pahina.',
    prefUpdated: 'Na-update ang setting.'
  }
} as const;

export function AccessibilityTools({ enableGlobalShortcut = false }: { enableGlobalShortcut?: boolean }) {
  const { language } = useLanguage();
  const s = STRINGS[language];
  // System-wide preferences — every instance shares this state.
  const { preferences, updatePreference, resetPreferences, screenReaderEnabled, setScreenReaderEnabled } = useAccessibility();
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const panelId = `accessibility-controls-panel-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const statusId = `accessibility-voice-status-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  useEffect(() => () => recognitionRef.current?.abort(), []);

  // Escape closes + focus return; outside pointer closes (WCAG 2.1.1 / 2.4.3).
  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenuOpen(false);
        window.requestAnimationFrame(() => {
          detailsRef.current?.querySelector('summary')?.focus();
        });
      }
    }
    function onPointerDown(event: PointerEvent) {
      const root = detailsRef.current;
      if (root && !root.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [menuOpen]);

  // Alt+A toggles the floating (system-wide) menu without stealing typing.
  useEffect(() => {
    if (!enableGlobalShortcut) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      if (typing) return;
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setMenuOpen((open) => !open);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enableGlobalShortcut]);

  function update<K extends PreferenceKey>(key: K, value: AccessibilityPreferences[K]) {
    updatePreference(key, value);
  }

  function speakScreen() {
    if (!('speechSynthesis' in window)) {
      setVoiceStatus('Text to speech is not available in this browser.');
      return;
    }
    const main = document.getElementById('main-content') ?? document.body;
    const text = (main.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 14000);
    if (!text) {
      setVoiceStatus('There is no page text available to read.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'tl' ? 'tl-PH' : 'en-US';
    utterance.rate = 0.95;
    utterance.onstart = () => setVoiceStatus(s.readingStarted);
    utterance.onend = () => setVoiceStatus('Finished reading.');
    utterance.onerror = () => setVoiceStatus('Text to speech could not read this page.');
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setVoiceStatus(s.stopped);
  }

  function stopVoice() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setVoiceListening(false);
  }

  function startVoice() {
    const recognition = getSpeechRecognition();
    if (!recognition) {
      setVoiceStatus(s.notAvailable);
      return;
    }
    recognition.lang = language === 'tl' ? 'fil-PH' : 'en-US';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = speechText(event);
      const lower = transcript.toLowerCase();
      if (lower.includes('stop voice') || lower === 'stop' || lower.includes('huminto')) {
        stopVoice();
        setVoiceStatus(s.stopped);
        return;
      }
      // Voice-controlled reading (system-wide via custom events consumed by TTS).
      if (lower.includes('read page') || lower.includes('basahin')) {
        window.dispatchEvent(new CustomEvent('pwd-read-page'));
        setVoiceStatus(s.readingStarted);
        return;
      }
      if (lower.includes('stop reading') || lower.includes('tigil basa')) {
        window.dispatchEvent(new CustomEvent('pwd-stop-reading'));
        setVoiceStatus(s.stopped);
        return;
      }
      const pref = preferenceCommand(transcript);
      if (pref) {
        updatePreference(pref.key, pref.value);
        setVoiceStatus(s.prefUpdated);
        return;
      }
      const path = navigationPath(transcript);
      if (path === 'back') {
        window.history.back();
        setVoiceStatus(s.stopped);
      } else if (path) {
        setVoiceStatus(s.readingStarted);
        window.location.assign(path);
      } else {
        setVoiceStatus(s.notRecognized);
      }
    };
    recognition.onerror = (event) => {
      setVoiceListening(false);
      setVoiceStatus(
        event.error === 'not-allowed' ? s.notAvailable : s.notRecognized
      );
    };
    recognition.onend = () => setVoiceListening(false);
    recognitionRef.current = recognition;
    setVoiceListening(true);
    setVoiceStatus(s.listening);
    try {
      recognition.start();
    } catch {
      setVoiceListening(false);
      setVoiceStatus(s.notAvailable);
    }
  }

  function handleReset() {
    resetPreferences();
    setVoiceStatus(s.resetDone);
  }

  return (
    <div className="accessibility-tools">
      <details
        ref={detailsRef}
        className="accessibility-menu"
        open={menuOpen}
        onToggle={(event) => setMenuOpen((event.target as HTMLDetailsElement).open)}
      >
        <summary aria-expanded={menuOpen} aria-controls={panelId}>
          <Accessibility size={17} aria-hidden="true" />
          <span aria-hidden="false">{language === 'tl' ? 'Accessibility' : 'Accessibility'}</span>
        </summary>
        <div id={panelId} className="accessibility-panel" role="group" aria-label={s.panelTitle}>
          <div className="accessibility-panel-header">
            <div>
              <strong>{s.panelTitle}</strong>
            </div>
          </div>

          <fieldset className="accessibility-group">
            <legend>
              <Eye size={15} aria-hidden="true" /> {s.visual}
            </legend>
            <label className="accessibility-control">
              <span><strong>{s.highContrast}</strong></span>
              <input type="checkbox" checked={preferences.contrast} onChange={(e) => update('contrast', e.target.checked)} />
            </label>
            <label className="accessibility-control">
              <span><strong>{s.largerText}</strong></span>
              <input type="checkbox" checked={preferences.largeText} onChange={(e) => update('largeText', e.target.checked)} />
            </label>
            <label className="accessibility-control">
              <span><strong>{s.dyslexia}</strong></span>
              <input type="checkbox" checked={preferences.dyslexiaFriendly} onChange={(e) => update('dyslexiaFriendly', e.target.checked)} />
            </label>
            <label className="accessibility-control">
              <span><strong>{s.spacing}</strong></span>
              <input type="checkbox" checked={preferences.extraSpacing} onChange={(e) => update('extraSpacing', e.target.checked)} />
            </label>
            <label className="accessibility-control">
              <span><strong>{s.underline}</strong></span>
              <input type="checkbox" checked={preferences.underlineLinks} onChange={(e) => update('underlineLinks', e.target.checked)} />
            </label>
            <label className="accessibility-control">
              <span><strong>{s.focus}</strong></span>
              <input type="checkbox" checked={preferences.focusHighlight} onChange={(e) => update('focusHighlight', e.target.checked)} />
            </label>
            <label className="accessibility-control">
              <span><strong>{s.classicInvert}</strong></span>
              <input type="checkbox" checked={preferences.classicInvert} onChange={(e) => update('classicInvert', e.target.checked)} />
            </label>
            <label className="accessibility-control">
              <span><strong>{s.smartInvert}</strong></span>
              <input type="checkbox" checked={preferences.smartInvert} onChange={(e) => update('smartInvert', e.target.checked)} />
            </label>
            <label className="accessibility-control accessibility-select-control">
              <span><strong>{s.colorFilters}</strong></span>
              <select value={preferences.colorFilter} onChange={(e) => update('colorFilter', e.target.value as AccessibilityPreferences['colorFilter'])} aria-label={s.colorFilters}>
                <option value="none">{s.colorFilterNone}</option>
                <option value="grayscale">{s.colorFilterGray}</option>
                <option value="red-green">{s.colorFilterRedGreen}</option>
                <option value="green-red">{s.colorFilterGreenRed}</option>
                <option value="blue-yellow">{s.colorFilterBlueYellow}</option>
              </select>
            </label>
            <label className="accessibility-control">
              <span><strong>{s.showBorders}</strong></span>
              <input type="checkbox" checked={preferences.showBorders} onChange={(e) => update('showBorders', e.target.checked)} />
            </label>
            <label className="accessibility-control">
              <span><strong>{s.reduceTransparency}</strong></span>
              <input type="checkbox" checked={preferences.reduceTransparency} onChange={(e) => update('reduceTransparency', e.target.checked)} />
            </label>
            <label className="accessibility-control">
              <span><strong>{s.reduceWhitePoint}</strong></span>
              <input type="checkbox" checked={preferences.reduceWhitePoint} onChange={(e) => update('reduceWhitePoint', e.target.checked)} />
            </label>
            <label className="accessibility-control">
              <span><strong>{s.reduceMotion}</strong></span>
              <input type="checkbox" checked={preferences.reducedMotion} onChange={(e) => update('reducedMotion', e.target.checked)} />
            </label>
            <label className="accessibility-control">
              <span><strong>{s.dimFlashingLights}</strong></span>
              <input type="checkbox" checked={preferences.dimFlashingLights} onChange={(e) => update('dimFlashingLights', e.target.checked)} />
            </label>
            <label className="accessibility-control accessibility-select-control">
              <span><strong>{s.zoom}</strong></span>
              <select value={preferences.zoom} onChange={(e) => update('zoom', e.target.value as AccessibilityPreferences['zoom'])} aria-label={s.zoom}>
                <option value="100">{s.zoom100}</option>
                <option value="125">{s.zoom125}</option>
                <option value="150">{s.zoom150}</option>
                <option value="200">{s.zoom200}</option>
              </select>
            </label>
            <label className="accessibility-control">
              <span><strong>{s.visualAlerts}</strong></span>
              <input type="checkbox" checked={preferences.visualAlerts} onChange={(e) => update('visualAlerts', e.target.checked)} />
            </label>
          </fieldset>

          <fieldset className="accessibility-group">
            <legend>
              <Captions size={15} aria-hidden="true" /> {s.hearing}
            </legend>
            <label className="accessibility-control">
              <span><strong>{s.captions}</strong></span>
              <input type="checkbox" checked={preferences.captions} onChange={(e) => update('captions', e.target.checked)} />
            </label>
            <label className="accessibility-control">
              <span><strong>{s.liveRecognition}</strong></span>
              <input type="checkbox" checked={preferences.liveRecognition} onChange={(e) => update('liveRecognition', e.target.checked)} />
            </label>
          </fieldset>

          <fieldset className="accessibility-group">
            <legend>
              <Keyboard size={15} aria-hidden="true" /> {s.keyboardVoice}
            </legend>
            <label className="accessibility-control">
              <span><strong>{s.spaceNav}</strong></span>
              <input type="checkbox" checked={preferences.spaceNavigation} onChange={(e) => update('spaceNavigation', e.target.checked)} />
            </label>
            <div className="voice-command-control">
              <div>
                <strong>{s.voiceTitle}</strong>
              </div>
              <button
                className="button secondary small"
                type="button"
                onClick={voiceListening ? stopVoice : startVoice}
                aria-pressed={voiceListening}
                aria-describedby={statusId}
              >
                {voiceListening ? <MicOff size={14} aria-hidden="true" /> : <Mic size={14} aria-hidden="true" />}
                {voiceListening ? 'Stop voice' : 'Start voice'}
              </button>
            </div>
            <p id={statusId} className="sr-status" role="status" aria-live="polite" aria-atomic="true">
              {voiceStatus}
            </p>
          </fieldset>

          <fieldset className="accessibility-group">
            <legend>
              <Type size={15} aria-hidden="true" /> {s.speech}
            </legend>
            <div className="accessibility-action-row">
              <div><strong>{s.screenReader}</strong></div>
              <button
                className="button secondary small"
                type="button"
                aria-pressed={screenReaderEnabled}
                aria-keyshortcuts="F2"
                aria-label={`${s.screenReader}: ${screenReaderEnabled ? s.screenReaderOn : s.screenReaderOff}`}
                onClick={() => {
                  const next = !screenReaderEnabled;
                  setScreenReaderEnabled(next);
                  announceScreenReaderState(next, language);
                }}
              >
                {screenReaderEnabled ? s.screenReaderOn : s.screenReaderOff}
              </button>
            </div>
            <div className="accessibility-action-row">
              <div><strong>{s.speakScreen}</strong></div>
              <div className="accessibility-action-buttons">
                <button className="button secondary small" type="button" onClick={speakScreen}>{s.speakScreen}</button>
                <button className="button secondary small" type="button" onClick={stopSpeaking}>{s.stopSpeaking}</button>
              </div>
            </div>
            <label className="accessibility-control">
              <span><strong>{s.textFirst}</strong></span>
              <input type="checkbox" checked={preferences.textFirst} onChange={(e) => update('textFirst', e.target.checked)} />
            </label>
          </fieldset>

          <fieldset className="accessibility-group">
            <legend>
              <Keyboard size={15} aria-hidden="true" /> {s.shortcuts}
            </legend>
            <div className="accessibility-reset-row">
              <button className="button secondary small" type="button" onClick={handleReset}>
                <RotateCcw size={14} aria-hidden="true" /> {s.reset}
              </button>
            </div>
          </fieldset>

        </div>
      </details>
    </div>
  );
}
