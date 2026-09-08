export type SpeechResultEvent = Event & {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

export type SpeechErrorEvent = Event & { error?: string };

export type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

export function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  const browserWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  const Constructor = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
  return Constructor ? new Constructor() : null;
}

export function speechText(event: SpeechResultEvent) {
  const result = event.results[event.resultIndex] ?? event.results[event.results.length - 1];
  return result?.[0]?.transcript?.trim() || '';
}
