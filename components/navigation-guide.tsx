'use client';

import { BrandMark } from '@/components/brand-mark';
import { LanguageSwitcher, useLanguage, type Language } from '@/components/language-provider';
import { ScreenReaderToggle } from '@/components/screen-reader-toggle';
import { continueFromNavigationGuide } from '@/app/actions/navigation-guide';

type GuideRow = {
  label: string;
  description: string;
  keys?: string[];
};

type GuideCopy = {
  eyebrow: string;
  title: string;
  introduction: string;
  keyboardTitle: string;
  pointerTitle: string;
  keyboardRows: GuideRow[];
  pointerRows: GuideRow[];
  accessibilityHint: string;
  continue: string;
  continueHelp: string;
};

const guideCopy: Record<Language, GuideCopy> = {
  en: {
    eyebrow: 'Navigation guide',
    title: 'Welcome to PWD Connect',
    introduction: 'Choose how to move through the site. Use a keyboard, mouse, touch, or your screen reader. Important instructions are available as text, and you can complete tasks without speaking.',
    keyboardTitle: 'Keyboard',
    pointerTitle: 'Mouse, touch, and screen reader',
    keyboardRows: [
      { label: 'Tab and Shift + Tab', keys: ['Tab', 'Shift + Tab'], description: 'Move through PWD Connect controls. Focus stays inside the site.' },
      { label: 'Enter', keys: ['Enter'], description: 'Open a focused link or activate a button.' },
      { label: 'Space', keys: ['Space'], description: 'Activate a focused button or change a checkbox.' },
      { label: 'Escape', keys: ['Esc'], description: 'Close an open menu or accessibility panel.' },
      { label: 'Accessibility controls', keys: ['Alt + A'], description: 'Open the accessibility controls.' },
      { label: 'Screen reader', keys: ['F2'], description: 'Turn the screen reader on or off.' }
    ],
    pointerRows: [
      { label: 'Click or tap', description: 'Open links, activate buttons, and change checkboxes.' },
      { label: 'Scroll', description: 'Move through the page.' },
      { label: 'Screen reader', description: 'Use the bottom-right button or press F2 to toggle reading of focused, labeled controls.' }
    ],
    accessibilityHint: 'Adjust display, hearing, and communication settings before continuing. These controls are available throughout the site.',
    continue: 'Continue',
    continueHelp: 'Press Enter or Space, or click or tap the button to continue.'
  },
  tl: {
    eyebrow: 'Gabay sa nabigasyon',
    title: 'Maligayang pagdating sa PWD Connect',
    introduction: 'Piliin kung paano mag-navigate sa site. Gumamit ng keyboard, mouse, touch, o screen reader. Nakasulat ang mahahalagang panuto at magagawa ang mga gawain nang hindi nagsasalita.',
    keyboardTitle: 'Keyboard',
    pointerTitle: 'Mouse, touch, at screen reader',
    keyboardRows: [
      { label: 'Tab at Shift + Tab', keys: ['Tab', 'Shift + Tab'], description: 'Mag-navigate sa mga control ng PWD Connect. Nananatili sa loob ng site ang focus.' },
      { label: 'Enter', keys: ['Enter'], description: 'Buksan ang naka-focus na link o piliin ang button.' },
      { label: 'Space', keys: ['Space'], description: 'Piliin ang naka-focus na button o baguhin ang checkbox.' },
      { label: 'Escape', keys: ['Esc'], description: 'Isara ang bukas na menu o accessibility panel.' },
      { label: 'Accessibility controls', keys: ['Alt + A'], description: 'Buksan ang accessibility controls.' },
      { label: 'Screen reader', keys: ['F2'], description: 'I-on o i-off ang screen reader.' }
    ],
    pointerRows: [
      { label: 'Click o tap', description: 'Buksan ang link, piliin ang button, at baguhin ang checkbox.' },
      { label: 'Scroll', description: 'Mag-navigate pataas at pababa sa pahina.' },
      { label: 'Screen reader', description: 'Gamitin ang button sa ibabang kanan o pindutin ang F2 para mag-toggle ng pagbasa sa naka-focus na control.' }
    ],
    accessibilityHint: 'Ayusin muna ang display, pandinig, at komunikasyon kung kailangan. Available ang mga control na ito sa buong site.',
    continue: 'Magpatuloy',
    continueHelp: 'Pindutin ang Enter o Space, o i-click o i-tap ang button para magpatuloy.'
  }
};

function InstructionRows({ rows }: { rows: GuideRow[] }) {
  return (
    <dl className="navigation-guide-rows">
      {rows.map((row) => (
        <div className="navigation-guide-row" key={row.label}>
          <dt aria-label={row.label}>
            {row.keys
              ? row.keys.map((key, index) => (
                  <span className="navigation-guide-key" key={key}>
                    {index > 0 ? <span className="navigation-guide-key-separator" aria-hidden="true">or</span> : null}
                    <kbd>{key}</kbd>
                  </span>
                ))
              : row.label}
          </dt>
          <dd>{row.description}</dd>
        </div>
      ))}
    </dl>
  );
}

export function NavigationGuide() {
  const { language } = useLanguage();
  const copy = guideCopy[language];

  return (
    <div className="navigation-guide-screen">
      <header className="navigation-guide-header">
        <BrandMark />
        <LanguageSwitcher />
      </header>

      <main className="navigation-guide-main" id="main-content" tabIndex={-1}>
        <article className="navigation-guide-card" aria-labelledby="navigation-guide-title">
          <p className="navigation-guide-eyebrow">{copy.eyebrow}</p>
          <h1 id="navigation-guide-title">{copy.title}</h1>
          <p className="navigation-guide-introduction">{copy.introduction}</p>

          <div className="navigation-guide-instructions">
            <section aria-labelledby="navigation-guide-keyboard-title">
              <h2 id="navigation-guide-keyboard-title">{copy.keyboardTitle}</h2>
              <InstructionRows rows={copy.keyboardRows} />
            </section>

            <section aria-labelledby="navigation-guide-pointer-title">
              <h2 id="navigation-guide-pointer-title">{copy.pointerTitle}</h2>
              <InstructionRows rows={copy.pointerRows} />
              <ScreenReaderToggle inline enableShortcut={false} />
            </section>
          </div>

          <footer className="navigation-guide-footer">
            <div className="navigation-guide-accessibility">
              <p>{copy.accessibilityHint}</p>
            </div>
            <form className="navigation-guide-continue" action={continueFromNavigationGuide}>
              <button className="button" type="submit">{copy.continue}</button>
              <p>{copy.continueHelp}</p>
            </form>
          </footer>
        </article>
      </main>
    </div>
  );
}
