'use client';

import { ArrowUpRight, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { AccessibilityTools } from '@/components/accessibility-tools';
import { BrandMark } from '@/components/brand-mark';
import { LanguageSwitcher, useLanguage } from '@/components/language-provider';

export function LandingPage() {
  const { language, t } = useLanguage();

  return (
    <div className="landing">
      <header className="site-header">
        <BrandMark href="/landing" />
        <nav className="site-nav" aria-label={language === 'tl' ? 'Pangunahing nabigasyon' : 'Main navigation'}>
          <a href="#how-it-works">{t('howItWorks')}</a>
          <a href="#standards">{t('standards')}</a>
        </nav>
        <div className="header-actions">
          <LanguageSwitcher />
          <AccessibilityTools />
          <Link className="button secondary small" href="/">{t('navigationGuide')}</Link>
          <Link className="button secondary small header-sign-in" href="/login">{t('signIn')}</Link>
          <Link className="button small" href="/register">{t('createAccount')} <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="hero" aria-labelledby="hero-title">
          <div className="page-width hero-layout">
            <div>
              <h1 className="display" id="hero-title">{t('heroBefore')} <em>{t('heroEmphasis')}</em></h1>
              <p className="lede">{t('heroDescription')}</p>
              <div className="hero-actions">
                <Link className="button" href="/register">{t('startProfile')} <ChevronRight size={17} aria-hidden="true" /></Link>
                <Link className="button secondary" href="/login">{t('alreadyAccount')}</Link>
              </div>

            </div>
            <div className="hero-visual" role="img" aria-label={language === 'tl' ? 'Ilustrasyon ng magkakaibang taong nagtutulungan sa accessible na trabaho' : 'Illustration of diverse people collaborating in accessible, skills-first work'}>
              <Image className="hero-graphic-image" src="/graph new.png" alt="" width={1536} height={1024} sizes="(max-width: 650px) calc(100vw - 28px), (max-width: 960px) 520px, 50vw" priority />
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
             <div><p className="eyebrow"></p><h2 id="standards-heading">{t('accessStarting')}</h2><p>Keyboard, screen reader, captions, high contrast, and reduced motion support.</p></div>
            <div className="standard-list" role="list" aria-label="Accessibility commitments">
               <div className="standard-row" role="listitem"><strong>Visible</strong><span>Clear text, headings, and contrast.</span></div>
               <div className="standard-row" role="listitem"><strong>Operable</strong><span>Keyboard support and no forced timer.</span></div>
               <div className="standard-row" role="listitem"><strong>Clear</strong><span>Short labels and helpful errors.</span></div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
