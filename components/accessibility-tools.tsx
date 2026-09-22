'use client';

import { Accessibility, Captions, Eye, Keyboard, Mic, MicOff, RotateCcw, Type, Volume2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useAccessibility, type AccessibilityPreferences } from '@/components/accessibility-provider';
import { useLanguage } from '@/components/language-provider';
import { getSpeechRecognition, speechText, type BrowserSpeechRecognition } from '@/lib/speech';

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
  if (has('voiceover', 'voice over', 'spoken focus')) return { key: 'voiceOver', value };
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
  if (normalized.includes('home') || normalized.includes('landing')) return '/';
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
    menuHint: 'Press Escape to close.',
    panelTitle: 'Make PWD Connect work for you',
    panelSub: 'These settings stay on this device and apply to every page. They never affect your fit score.',
    visual: 'Visual',
    highContrast: 'High contrast',
    highContrastHint: 'Stronger borders and color separation (WCAG 1.4.3)',
    largerText: 'Larger text',
    largerTextHint: 'Increase reading size across the app (WCAG 1.4.4)',
    dyslexia: 'Dyslexia-friendly reading',
    dyslexiaHint: 'Roomier font, spacing, and line height',
    spacing: 'Extra text spacing',
    spacingHint: 'Wider line, letter, and word spacing (WCAG 1.4.12)',
    underline: 'Always underline links',
    underlineHint: 'Never rely on color alone (WCAG 1.4.1)',
    focus: 'Extra-visible focus',
    focusHint: 'Thicker focus ring on every control (WCAG 2.4.7)',
    classicInvert: 'Classic invert',
    classicInvertHint: 'Invert the whole interface, including images',
    colorFilters: 'Color filters',
    colorFiltersHint: 'Adjust colors for color-vision differences',
    colorFilterNone: 'Off',
    colorFilterGray: 'Grayscale',
    colorFilterRedGreen: 'Red-green filter',
    colorFilterGreenRed: 'Green-red filter',
    colorFilterBlueYellow: 'Blue-yellow filter',
    liveRecognition: 'Live recognition',
    liveRecognitionHint: 'Show live speech-to-text captions from your microphone',
    showBorders: 'Show borders',
    showBordersHint: 'Make controls and regions easier to distinguish',
    reduceTransparency: 'Reduce transparency',
    reduceTransparencyHint: 'Use solid backgrounds instead of transparent effects',
    reduceWhitePoint: 'Reduce white point',
    reduceWhitePointHint: 'Lower the intensity of bright colors',
    smartInvert: 'Smart invert',
    smartInvertHint: 'Invert interface colors while preserving images and video where possible',
    reduceMotion: 'Reduce motion',
    reduceMotionHint: 'Limit animations and transitions (WCAG 2.3.3)',
    visualAlerts: 'Emphasize visual alerts',
    visualAlertsHint: 'Make success and error messages easier to spot',
    hearing: 'Hearing',
    captions: 'Caption reminders',
    captionsHint: 'Show reminders that instructions and feedback are text-based',
    captionsNote: 'PWD Connect does not require audio-only instructions, phone calls, or video interviews.',
    voiceOver: 'VoiceOver focus reading',
    voiceOverHint: 'Read focused controls aloud using browser speech',
    zoom: 'Zoom',
    zoomHint: 'Increase the interface size without changing browser settings',
    zoom100: '100%',
    zoom125: '125%',
    zoom150: '150%',
    zoom200: '200%',
    dimFlashingLights: 'Dim flashing lights',
    dimFlashingLightsHint: 'Stop or soften animated flashing effects',
    keyboardVoice: 'Keyboard and voice',
    spaceNav: 'Space navigation mode',
    spaceNavHint: 'Space = next, Shift+Space = previous, double-Space = select. Text fields stay normal. Enter still activates.',
    voiceTitle: 'Voice commands',
    voiceHint: 'Say "dashboard", "find work", "messages", "profile", "read page", "high contrast on", or "stop voice".',
    speech: 'Speech and communication',
    speakScreen: 'Speak screen',
    speakScreenHint: 'Read the main page content aloud',
    stopSpeaking: 'Stop speaking',
    textFirst: 'Text-first communication',
    textFirstHint: 'Keep communication alternatives visible instead of voice-only steps',
    textFirstNote: 'You can complete every PWD Connect task without speaking.',
    shortcuts: 'Keyboard shortcuts',
    shortcutsList: 'Alt+A opens these controls · Esc closes · Alt+R reads the page aloud · Tab / Shift+Tab moves focus · Enter activates.',
    reset: 'Reset all accessibility settings',
    resetDone: 'Accessibility settings reset to defaults.',
    footer: 'Screen readers, keyboard navigation, captions, and text responses are supported by default.',
    listening: 'Listening. Say dashboard, find work, messages, profile, read page, access toggles, or stop voice.',
    stopped: 'Voice commands stopped.',
    notAvailable: 'Voice commands are not available in this browser. Use the keyboard or a screen reader instead.',
    notRecognized: 'Command not recognized. Say dashboard, find work, messages, profile, read page, or stop voice.',
    readingStarted: 'Reading page aloud.',
    prefUpdated: 'Preference updated.'
  },
  tl: {
    menuHint: 'Pindutin ang Escape para isara.',
    panelTitle: 'Iangkop ang PWD Connect sa iyo',
    panelSub: 'Nananatili ang mga setting sa device na ito at gumagana sa bawat pahina. Hindi nito binabago ang fit score.',
    visual: 'Biswal',
    highContrast: 'High contrast',
    highContrastHint: 'Mas malinaw na border at kulay',
    largerText: 'Mas malaking text',
    largerTextHint: 'Lakihan ang nababasang text sa app',
    dyslexia: 'Madaling basahin (dyslexia-friendly)',
    dyslexiaHint: 'Mas maluwag na font at spacing',
    spacing: 'Dagdag na puwang ng text',
    spacingHint: 'Mas maluwag na line at letter spacing',
    underline: 'Laging salungguhitan ang links',
    underlineHint: 'Huwag umasa sa kulay lamang',
    focus: 'Mas kitang focus',
    focusHint: 'Mas makapal na focus ring sa bawat control',
    classicInvert: 'Classic invert',
    classicInvertHint: 'Baligtarin ang kulay ng buong interface kasama ang images',
    colorFilters: 'Color filters',
    colorFiltersHint: 'Ayusin ang kulay para sa color-vision differences',
    colorFilterNone: 'Patay',
    colorFilterGray: 'Grayscale',
    colorFilterRedGreen: 'Red-green filter',
    colorFilterGreenRed: 'Green-red filter',
    colorFilterBlueYellow: 'Blue-yellow filter',
    liveRecognition: 'Live recognition',
    liveRecognitionHint: 'Ipakita ang live speech-to-text caption mula sa mikropono',
    showBorders: 'Ipakita ang borders',
    showBordersHint: 'Gawing mas malinaw ang mga control at region',
    reduceTransparency: 'Bawasan ang transparency',
    reduceTransparencyHint: 'Gumamit ng solid background sa halip na transparent effects',
    reduceWhitePoint: 'Bawasan ang white point',
    reduceWhitePointHint: 'Bawasan ang liwanag ng maliliwanag na kulay',
    smartInvert: 'Smart invert',
    smartInvertHint: 'Baligtarin ang interface habang pinapanatili ang images at video kung maaari',
    reduceMotion: 'Bawasan ang galaw',
    reduceMotionHint: 'Limitahan ang animation at transition',
    visualAlerts: 'Bigyang-diin ang visual alerts',
    visualAlertsHint: 'Gawing mas halata ang success at error',
    hearing: 'Pandinig',
    captions: 'Mga paalala ng caption',
    captionsHint: 'Ipakita na text-based ang panuto at feedback',
    captionsNote: 'Hindi nangangailangan ang PWD Connect ng audio-only na panuto, tawag, o video interview.',
    voiceOver: 'VoiceOver focus reading',
    voiceOverHint: 'Basahin nang malakas ang naka-focus na control gamit ang browser speech',
    zoom: 'Zoom',
    zoomHint: 'Lakihan ang interface nang hindi binabago ang browser setting',
    zoom100: '100%',
    zoom125: '125%',
    zoom150: '150%',
    zoom200: '200%',
    dimFlashingLights: 'I-dim ang flashing lights',
    dimFlashingLightsHint: 'Itigil o hinaan ang kumikislap na animation',
    keyboardVoice: 'Keyboard at boses',
    spaceNav: 'Space navigation mode',
    spaceNavHint: 'Space = susunod, Shift+Space = nakaraan, dalawang Space = piliin. Normal ang text fields.',
    voiceTitle: 'Voice commands',
    voiceHint: 'Sabihin ang "dashboard", "find work", "messages", "profile", "read page", o "stop voice".',
    speech: 'Pagsasalita at komunikasyon',
    speakScreen: 'Basahin ang screen',
    speakScreenHint: 'Basahin nang malakas ang pangunahing content',
    stopSpeaking: 'Itigil ang pagbasa',
    textFirst: 'Text-first na komunikasyon',
    textFirstHint: 'Panatilihing nakikita ang text na alternatibo',
    textFirstNote: 'Magagawa mo ang bawat gawain nang hindi nagsasalita.',
    shortcuts: 'Mga keyboard shortcut',
    shortcutsList: 'Alt+A para buksan · Esc para isara · Alt+R para basahin ang pahina · Tab / Shift+Tab para lumipat · Enter para pumili.',
    reset: 'I-reset ang lahat ng setting',
    resetDone: 'Na-reset na ang mga setting sa default.',
    footer: 'May suporta bilang default sa screen reader, keyboard navigation, caption, at text response.',
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
  const { preferences, updatePreference, resetPreferences } = useAccessibility();
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
        <summary aria-expanded={menuOpen} aria-controls={panelId} title={s.menuHint}>
          <Accessibility size={17} aria-hidden="true" />
          <span aria-hidden="false">{language === 'tl' ? 'Accessibility' : 'Accessibility'}</span>
        </summary>
        <div id={panelId} className="accessibility-panel" role="group" aria-label={s.panelTitle}>
          <div className="accessibility-panel-header">
            <div>
              <strong>{s.panelTitle}</strong>
              <p>{s.panelSub}</p>
            </div>
          </div>

          <fieldset className="accessibility-group">
            <legend>
              <Eye size={15} aria-hidden="true" /> {s.visual}
            </legend>
            <label className="accessibility-control">
              <span><strong>{s.highContrast}</strong><small>{s.highContrastHint}</small></span>
              <input type="checkbox" checked={preferences.contrast} onChange={(e) => update('contrast', e.target.checked)} />
            </label>
            <label className="accessibility-control">
              <span><strong>{s.largerText}</strong><small>{s.largerTextHint}</small></span>
              <input type="checkbox" checked={preferences.largeText} onChange={(e) => update('largeText', e.target.checked)} />
            </label>
            <label className="accessibility-control">
              <span><strong>{s.dyslexia}</strong><small>{s.dyslexiaHint}</small></span>
              <input type="checkbox" checked={preferences.dyslexiaFriendly} onChange={(e) => update('dyslexiaFriendly', e.target.checked)} />
            </label>
            <label className="accessibility-control">
              <span><strong>{s.spacing}</strong><small>{s.spacingHint}</small></span>
              <input type="checkbox" checked={preferences.extraSpacing} onChange={(e) => update('extraSpacing', e.target.checked)} />
            </label>
            <label className="accessibility-control">
              <span><strong>{s.underline}</strong><small>{s.underlineHint}</small></span>
              <input type="checkbox" checked={preferences.underlineLinks} onChange={(e) => update('underlineLinks', e.target.checked)} />
            </label>
            <label className="accessibility-control">
              <span><strong>{s.focus}</strong><small>{s.focusHint}</small></span>
              <input type="checkbox" checked={preferences.focusHighlight} onChange={(e) => update('focusHighlight', e.target.checked)} />
            </label>
            <label className="accessibility-control">
              <span><strong>{s.classicInvert}</strong><small>{s.classicInvertHint}</small></span>
              <input type="checkbox" checked={preferences.classicInvert} onChange={(e) => update('classicInvert', e.target.checked)} />
            </label>
            <label className="accessibility-control">
              <span><strong>{s.smartInvert}</strong><small>{s.smartInvertHint}</small></span>
              <input type="checkbox" checked={preferences.smartInvert} onChange={(e) => update('smartInvert', e.target.checked)} />
            </label>
            <label className="accessibility-control accessibility-select-control">
              <span><strong>{s.colorFilters}</strong><small>{s.colorFiltersHint}</small></span>
              <select value={preferences.colorFilter} onChange={(e) => update('colorFilter', e.target.value as AccessibilityPreferences['colorFilter'])} aria-label={s.colorFilters}>
                <option value="none">{s.colorFilterNone}</option>
                <option value="grayscale">{s.colorFilterGray}</option>
                <option value="red-green">{s.colorFilterRedGreen}</option>
                <option value="green-red">{s.colorFilterGreenRed}</option>
                <option value="blue-yellow">{s.colorFilterBlueYellow}</option>
              </select>
            </label>
            <label className="accessibility-control">
              <span><strong>{s.showBorders}</strong><small>{s.showBordersHint}</small></span>
              <input type="checkbox" checked={preferences.showBorders} onChange={(e) => update('showBorders', e.target.checked)} />
            </label>
            <label className="accessibility-control">
              <span><strong>{s.reduceTransparency}</strong><small>{s.reduceTransparencyHint}</small></span>
              <input type="checkbox" checked={preferences.reduceTransparency} onChange={(e) => update('reduceTransparency', e.target.checked)} />
            </label>
            <label className="accessibility-control">
              <span><strong>{s.reduceWhitePoint}</strong><small>{s.reduceWhitePointHint}</small></span>
              <input type="checkbox" checked={preferences.reduceWhitePoint} onChange={(e) => update('reduceWhitePoint', e.target.checked)} />
            </label>
            <label className="accessibility-control">
              <span><strong>{s.reduceMotion}</strong><small>{s.reduceMotionHint}</small></span>
              <input type="checkbox" checked={preferences.reducedMotion} onChange={(e) => update('reducedMotion', e.target.checked)} />
            </label>
            <label className="accessibility-control">
              <span><strong>{s.dimFlashingLights}</strong><small>{s.dimFlashingLightsHint}</small></span>
              <input type="checkbox" checked={preferences.dimFlashingLights} onChange={(e) => update('dimFlashingLights', e.target.checked)} />
            </label>
            <label className="accessibility-control accessibility-select-control">
              <span><strong>{s.zoom}</strong><small>{s.zoomHint}</small></span>
              <select value={preferences.zoom} onChange={(e) => update('zoom', e.target.value as AccessibilityPreferences['zoom'])} aria-label={s.zoom}>
                <option value="100">{s.zoom100}</option>
                <option value="125">{s.zoom125}</option>
                <option value="150">{s.zoom150}</option>
                <option value="200">{s.zoom200}</option>
              </select>
            </label>
            <label className="accessibility-control">
              <span><strong>{s.visualAlerts}</strong><small>{s.visualAlertsHint}</small></span>
              <input type="checkbox" checked={preferences.visualAlerts} onChange={(e) => update('visualAlerts', e.target.checked)} />
            </label>
          </fieldset>

          <fieldset className="accessibility-group">
            <legend>
              <Captions size={15} aria-hidden="true" /> {s.hearing}
            </legend>
            <label className="accessibility-control">
              <span><strong>{s.captions}</strong><small>{s.captionsHint}</small></span>
              <input type="checkbox" checked={preferences.captions} onChange={(e) => update('captions', e.target.checked)} />
            </label>
            <label className="accessibility-control">
              <span><strong>{s.liveRecognition}</strong><small>{s.liveRecognitionHint}</small></span>
              <input type="checkbox" checked={preferences.liveRecognition} onChange={(e) => update('liveRecognition', e.target.checked)} />
            </label>
            {preferences.captions ? <p className="accessibility-note">{s.captionsNote}</p> : null}
          </fieldset>

          <fieldset className="accessibility-group">
            <legend>
              <Keyboard size={15} aria-hidden="true" /> {s.keyboardVoice}
            </legend>
            <label className="accessibility-control">
              <span><strong>{s.spaceNav}</strong><small>{s.spaceNavHint}</small></span>
              <input type="checkbox" checked={preferences.spaceNavigation} onChange={(e) => update('spaceNavigation', e.target.checked)} />
            </label>
            <div className="voice-command-control">
              <div>
                <strong>{s.voiceTitle}</strong>
                <small>{s.voiceHint}</small>
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
            <label className="accessibility-control">
              <span><strong>{s.voiceOver}</strong><small>{s.voiceOverHint}</small></span>
              <input type="checkbox" checked={preferences.voiceOver} onChange={(e) => update('voiceOver', e.target.checked)} />
            </label>
            <div className="accessibility-action-row">
              <div><strong>{s.speakScreen}</strong><small>{s.speakScreenHint}</small></div>
              <div className="accessibility-action-buttons">
                <button className="button secondary small" type="button" onClick={speakScreen}>{s.speakScreen}</button>
                <button className="button secondary small" type="button" onClick={stopSpeaking}>{s.stopSpeaking}</button>
              </div>
            </div>
            <label className="accessibility-control">
              <span><strong>{s.textFirst}</strong><small>{s.textFirstHint}</small></span>
              <input type="checkbox" checked={preferences.textFirst} onChange={(e) => update('textFirst', e.target.checked)} />
            </label>
            {preferences.textFirst ? (
              <p className="accessibility-note">
                <Keyboard size={14} aria-hidden="true" /> {s.textFirstNote}
              </p>
            ) : null}
          </fieldset>

          <fieldset className="accessibility-group">
            <legend>
              <Keyboard size={15} aria-hidden="true" /> {s.shortcuts}
            </legend>
            <p className="accessibility-note">{s.shortcutsList}</p>
            <div className="accessibility-reset-row">
              <button className="button secondary small" type="button" onClick={handleReset}>
                <RotateCcw size={14} aria-hidden="true" /> {s.reset}
              </button>
            </div>
          </fieldset>

          <div className="accessibility-panel-footer">
            <Volume2 size={14} aria-hidden="true" />
            <span>{s.footer}</span>
          </div>
        </div>
      </details>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {preferences.captions && preferences.textFirst ? s.textFirstNote : ''}
      </span>
    </div>
  );
}
