'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';

export type Language = 'en' | 'tl';

const translations = {
  en: {
    accessibility: 'Accessibility',
    howItWorks: 'How it works',
    standards: 'Accessibility',
    signIn: 'Sign in',
    createAccount: 'Create account',
    startProfile: 'Start your profile',
    alreadyAccount: 'I already have an account',
    language: 'Language',
    english: 'English',
    tagalog: 'Tagalog',
    heroBefore: 'A fairer way to find',
    heroEmphasis: 'your fit.',
    heroDescription: 'PWD Connect pairs persons with visual, hearing, and speech disabilities with employers through verified skills, accessible assessments, and clear recommendations.',
    blindMatching: '',
    method: 'The PWD Connect method',
    strengths: 'Built around what you can do.',
    methodDescription: 'No resume filter. No inaccessible timed test. Just a clear route from your strengths to an opportunity.',
    showStrengths: 'Show your strengths',
    showStrengthsDescription: 'Complete an accessible task assessment with keyboard-friendly controls, clear instructions, and support options.',
    seeReasoning: 'See the reasoning',
    seeReasoningDescription: 'Every recommendation includes a fit score and the skill overlap behind it.',
    chooseNext: 'Choose your next step',
    chooseNextDescription: 'Browse openings, apply when ready, and let employers see a skills-first preview.',
    accessStarting: 'Accessibility is the starting line.',
    languageHelp: 'Choose English or Tagalog. Your choice stays on this device.'
  },
  tl: {
    accessibility: 'Accessibility',
    howItWorks: 'Paano ito gumagana',
    standards: 'Accessibility',
    signIn: 'Mag-sign in',
    createAccount: 'Gumawa ng account',
    startProfile: 'Simulan ang profile',
    alreadyAccount: 'May account na ako',
    language: 'Wika',
    english: 'English',
    tagalog: 'Tagalog',
    heroBefore: 'Mas patas na paraan para mahanap',
    heroEmphasis: 'ang angkop sa iyo.',
    heroDescription: 'Ikinokonekta ng PWD Connect ang mga taong may kapansanan sa paningin, pandinig, o pagsasalita sa mga employer gamit ang napatunayang kasanayan at malinaw na rekomendasyon.',
    blindMatching: 'Hindi kasama ang detalye ng kapansanan sa unang screening.',
    method: 'Paraan ng PWD Connect',
    strengths: 'Nakabatay sa kaya mong gawin.',
    methodDescription: 'Walang filter sa resume. Walang mahirap na may takdang oras. Malinaw na daan mula sa iyong lakas papunta sa trabaho.',
    showStrengths: 'Ipakita ang iyong lakas',
    showStrengthsDescription: 'Sagutan ang accessible na gawain gamit ang keyboard, malinaw na panuto, at mga opsyon sa suporta.',
    seeReasoning: 'Alamin ang dahilan',
    seeReasoningDescription: 'May score at paliwanag sa bawat rekomendasyon.',
    chooseNext: 'Piliin ang susunod na hakbang',
    chooseNextDescription: 'Maghanap ng trabaho, mag-apply kapag handa, at ipakita sa employer ang iyong kasanayan.',
    accessStarting: 'Accessibility ang panimulang kailangan.',
    languageHelp: 'Pumili ng English o Tagalog. Nananatili ang iyong pinili sa device na ito.'
  }
} as const;

type TranslationKey = keyof typeof translations.en;

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [language, setLanguageState] = useState<Language>('en');
  const loadedLanguage = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem('pwd-connect-language');
      loadedLanguage.current = true;
      if (saved === 'en' || saved === 'tl') setLanguageState(saved);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loadedLanguage.current) return;
    document.documentElement.lang = language === 'tl' ? 'tl' : 'en';
    window.localStorage.setItem('pwd-connect-language', language);
  }, [language]);

  function setLanguage(nextLanguage: Language) {
    setLanguageState(nextLanguage);
  }

  return <LanguageContext.Provider value={{ language, setLanguage, t: (key) => translations[language][key] }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider.');
  return context;
}

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  return <label className="language-switcher"><span>{t('language')}</span><select aria-label={t('language')} value={language} onChange={(event) => setLanguage(event.target.value as Language)}><option value="en">{t('english')}</option><option value="tl">{t('tagalog')}</option></select></label>;
}
