export type ScreenReaderLanguage = 'en' | 'tl';

export function speakScreenReaderText(text: string, language: ScreenReaderLanguage) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) return;

  const synthesis = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text.trim());
  const voices = synthesis.getVoices();
  const preferredPrefixes = language === 'tl' ? ['tl', 'fil'] : ['en'];
  const voice = voices.find((candidate) => preferredPrefixes.some((prefix) => candidate.lang.toLowerCase().startsWith(prefix)))
    ?? voices.find((candidate) => candidate.lang.toLowerCase().startsWith('en'))
    ?? voices[0];

  utterance.lang = voice?.lang ?? (language === 'tl' ? 'fil-PH' : 'en-US');
  if (voice) utterance.voice = voice;
  utterance.rate = 0.95;

  synthesis.cancel();
  synthesis.resume();
  synthesis.speak(utterance);
}

export function announceScreenReaderState(enabled: boolean, language: ScreenReaderLanguage) {
  const message = language === 'tl'
    ? enabled
      ? 'Naka-on ang screen reader. Gamitin ang Tab para mag-navigate, Enter para pumili, at F2 para i-off.'
      : 'Naka-off ang screen reader.'
    : enabled
      ? 'Screen reader on. Use Tab to navigate, Enter to activate, and F2 to turn it off.'
      : 'Screen reader off.';

  speakScreenReaderText(message, language);
}
