'use client';

import { ArrowUpRight, Check, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { AccessibilityTools } from '@/components/accessibility-tools';
import { BrandMark } from '@/components/brand-mark';
import { LanguageSwitcher, useLanguage } from '@/components/language-provider';
import { TextToSpeechControls } from '@/components/text-to-speech-controls';

export default function HomePage() {
  const { language, t } = useLanguage();

  return (
    <div className="landing">
      <header className="site-header">
        <BrandMark />
        <nav className="site-nav" aria-label={language === 'tl' ? 'Pangunahing nabigasyon' : 'Main navigation'}>
          <a href="#how-it-works">{t('howItWorks')}</a>
          <a href="#standards">{t('standards')}</a>
        </nav>
        <div className="header-actions">
          <LanguageSwitcher />
          <AccessibilityTools />
          <TextToSpeechControls />
          <Link className="button secondary small header-sign-in" href="/login">{t('signIn')}</Link>
          <Link className="button small" href="/register">{t('createAccount')} <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </div>
      </header>

      <main id="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <div className="page-width hero-layout">
            <div>
              <p className="kicker">Legazpi City / skills-first employment</p>
              <h1 className="display" id="hero-title">{t('heroBefore')} <em>{t('heroEmphasis')}</em></h1>
              <p className="lede">{t('heroDescription')}</p>
              <div className="hero-actions">
                <Link className="button" href="/register">{t('startProfile')} <ChevronRight size={17} aria-hidden="true" /></Link>
                <Link className="button secondary" href="/login">{t('alreadyAccount')}</Link>
              </div>

            </div>
            <div className="hero-visual" aria-label={language === 'tl' ? 'Imahen ng patas na pagtutugma ng kasanayan sa trabaho' : 'Illustration showing skills-based matching results'} role="img">
              <div className="visual-card tag">Your skills are more than a job title.</div>
              <div className="visual-card main">
                <div className="visual-title"><strong>Match snapshot</strong><small>94%</small></div>
                <div className="meter" aria-hidden="true"><span style={{ width: '94%' }} /></div>
                <div className="skill-line"><span>Data entry</span><strong className="skill-score">verified</strong></div>
                <div className="skill-line"><span>Written communication</span><strong className="skill-score">verified</strong></div>
                <div className="skill-line"><span>Spreadsheets</span><strong className="skill-score">strong</strong></div>
              </div>
              <div className="visual-card secondary">
                <div className="visual-title"><strong>Good work, on your terms.</strong></div>
                <div className="skill-line"><span>Flexible schedule</span><Check size={16} aria-hidden="true" /></div>
                <div className="skill-line"><span>Accessible process</span><Check size={16} aria-hidden="true" /></div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="how-it-works" aria-labelledby="method-heading">
          <div className="page-width">
            <div className="section-heading">
              <div><p className="eyebrow">{t('method')}</p><h2 id="method-heading">{t('strengths')}</h2></div>
              <p>{t('methodDescription')}</p>
            </div>
            <div className="feature-grid">
              <article className="feature-card"><span className="feature-number">01</span><h3>{t('showStrengths')}</h3><p>{t('showStrengthsDescription')}</p></article>
              <article className="feature-card"><span className="feature-number">02</span><h3>{t('seeReasoning')}</h3><p>{t('seeReasoningDescription')}</p></article>
              <article className="feature-card"><span className="feature-number">03</span><h3>{t('chooseNext')}</h3><p>{t('chooseNextDescription')}</p></article>
            </div>
          </div>
        </section>

        <section className="section dark" id="standards" aria-labelledby="standards-heading">
          <div className="page-width standards-grid">
            <div><p className="eyebrow"></p><h2 id="standards-heading">{t('accessStarting')}</h2><p>PWD Connect works with screen readers and keyboards. You can use larger text, high contrast, captions, and less motion. Clear messages help you fix errors.</p></div>
            <div className="standard-list" role="list" aria-label="Accessibility commitments">
              <div className="standard-row" role="listitem"><strong>Easy to notice</strong><span>Important information is available as text, with clear headings and good color contrast.</span></div>
              <div className="standard-row" role="listitem"><strong>Easy to use</strong><span>You can use every part with a keyboard. Buttons are clear and there are no forced time limits.</span></div>
              <div className="standard-row" role="listitem"><strong>Easy to understand</strong><span>We use plain words, clear labels, helpful instructions, and simple error messages.</span></div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
