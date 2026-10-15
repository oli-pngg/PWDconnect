'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { useAccessibility } from '@/components/accessibility-provider';
import { useLanguage } from '@/components/language-provider';
import { announceScreenReaderState } from '@/lib/screen-reader';

const labels = {
  en: {
    name: 'Screen reader',
    on: 'ON',
    off: 'OFF',
    turnOn: 'Turn the screen reader on. Press F2 to toggle.',
    turnOff: 'Turn the screen reader off. Press F2 to toggle.'
  },
  tl: {
    name: 'Screen reader',
    on: 'NAKA-ON',
    off: 'NAKA-OFF',
    turnOn: 'I-on ang screen reader. Pindutin ang F2 para mag-toggle.',
    turnOff: 'I-off ang screen reader. Pindutin ang F2 para mag-toggle.'
  }
} as const;

export function ScreenReaderToggle({ inline = false, enableShortcut = true }: { inline?: boolean; enableShortcut?: boolean } = {}) {
  const { screenReaderEnabled, setScreenReaderEnabled } = useAccessibility();
  const { language } = useLanguage();
  const copy = labels[language];

  const toggle = useCallback(() => {
    const next = !screenReaderEnabled;
    setScreenReaderEnabled(next);
    announceScreenReaderState(next, language);
  }, [language, screenReaderEnabled, setScreenReaderEnabled]);

  useEffect(() => {
    if (!enableShortcut) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'F2' || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      toggle();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enableShortcut, toggle]);

  return (
    <div className={`screen-reader-toggle-bar ${inline ? 'screen-reader-toggle-inline' : 'screen-reader-toggle-floating'}`}>
      <button
        className="screen-reader-toggle"
        type="button"
        aria-pressed={screenReaderEnabled}
        aria-keyshortcuts="F2"
        aria-label={`${copy.name}: ${screenReaderEnabled ? copy.on : copy.off}. ${screenReaderEnabled ? copy.turnOff : copy.turnOn}`}
        onClick={toggle}
      >
        {screenReaderEnabled ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}
        <span>{copy.name}: {screenReaderEnabled ? copy.on : copy.off}</span>
        <kbd aria-hidden="true">F2</kbd>
      </button>
    </div>
  );
}
