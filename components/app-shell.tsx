'use client';

import { Accessibility, ClipboardCheck, FilePlus2, LayoutDashboard, ListChecks, Menu, MessageCircle, Search, Settings, UsersRound, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Profile, UserRole } from '@/lib/types';
import { AccessibilityTools } from '@/components/accessibility-tools';
import { BrandMark } from '@/components/brand-mark';
import { LanguageSwitcher, useLanguage } from '@/components/language-provider';
import { SignOutButton } from '@/components/sign-out-button';
import { TextToSpeechControls } from '@/components/text-to-speech-controls';

const candidateLinks = [
  { href: '/dashboard', label: 'Overview', tagalog: 'Buod', icon: LayoutDashboard },
  { href: '/jobs', label: 'Find work', tagalog: 'Maghanap ng trabaho', icon: Search },
  { href: '/assessment', label: 'Skill assessment', tagalog: 'Pagsusuri ng kasanayan', icon: ClipboardCheck },
  { href: '/messages', label: 'Messages', tagalog: 'Mga mensahe', icon: MessageCircle },
  { href: '/profile', label: 'My profile', tagalog: 'Aking profile', icon: Settings }
];

const employerLinks = [
  { href: '/dashboard', label: 'Overview', tagalog: 'Buod', icon: LayoutDashboard },
  { href: '/employer/jobs', label: 'My openings', tagalog: 'Aking mga opening', icon: ListChecks },
  { href: '/employer/jobs/new', label: 'Post an opening', tagalog: 'Mag-post ng opening', icon: FilePlus2 },
  { href: '/employer/candidates', label: 'Candidate matches', tagalog: 'Mga tugma na kandidato', icon: UsersRound },
  { href: '/messages', label: 'Messages', tagalog: 'Mga mensahe', icon: MessageCircle },
  { href: '/profile', label: 'Organization profile', tagalog: 'Profile ng organisasyon', icon: Settings }
];

const adminLinks = [
  { href: '/dashboard', label: 'Overview', tagalog: 'Buod', icon: LayoutDashboard },
  { href: '/admin/evaluation', label: 'Evaluation', tagalog: 'Pagsusuri', icon: Accessibility },
  { href: '/profile', label: 'My profile', tagalog: 'Aking profile', icon: Settings }
];

function roleLabel(role: UserRole, language: 'en' | 'tl' = 'en') {
  if (role === 'employer') return language === 'tl' ? 'Workspace ng employer' : 'Employer workspace';
  if (role === 'admin') return language === 'tl' ? 'Workspace ng pananaliksik' : 'Research workspace';
  return language === 'tl' ? 'Workspace ng kandidato' : 'Candidate workspace';
}

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const pathname = usePathname();
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const links = profile.role === 'employer' ? employerLinks : profile.role === 'admin' ? adminLinks : candidateLinks;
  const displayName = profile.organization_name || profile.full_name || profile.email;
  const workspaceName = language === 'tl'
    ? profile.role === 'employer' ? 'Employer' : profile.role === 'admin' ? 'Pananaliksik' : 'Kandidato'
    : roleLabel(profile.role).replace(' workspace', '');

  useEffect(() => {
    const main = document.getElementById('main-content');
    if (!main) return;
    const frame = window.requestAnimationFrame(() => main.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return (
    <div className="app-layout">
      <aside id="primary-navigation" className={`sidebar ${open ? 'open' : ''}`} aria-label="Primary navigation">
        <BrandMark href="/dashboard" />
        <p className="sidebar-role">{roleLabel(profile.role, language)}</p>
        <nav className="sidebar-nav" aria-label="Workspace navigation">
          {links.map(({ href, label, tagalog, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
            return <Link className={active ? 'active' : ''} href={href} key={href} aria-current={active ? 'page' : undefined} onClick={() => setOpen(false)}><Icon size={17} aria-hidden="true" />{language === 'tl' ? tagalog : label}</Link>;
          })}
        </nav>
        <div className="sidebar-footer">
          <p title={displayName}>{displayName}</p>
          <SignOutButton />
        </div>
      </aside>
      <div className="app-content">
        <header className="app-topbar">
          <div className="inline-actions">
            <button className="icon-button mobile-menu-button" type="button" aria-expanded={open} aria-controls="primary-navigation" onClick={() => setOpen(!open)}>
              {open ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}<span className="sr-only">{open ? 'Close' : 'Open'} navigation</span>
            </button>
            <span className="breadcrumb">PWD Connect / {workspaceName}</span>
          </div>
          <div className="topbar-tools">
            <LanguageSwitcher />
            <AccessibilityTools />
            <TextToSpeechControls key={pathname} />
            <span className="status-pill shortlisted"><span aria-hidden="true">●</span> Secure session</span>
          </div>
        </header>
        <main id="main-content" className="page-content" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
