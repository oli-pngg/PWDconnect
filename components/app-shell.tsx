'use client';

import { Accessibility, ClipboardCheck, FilePlus2, LayoutDashboard, ListChecks, Menu, MessageCircle, Search, Settings, UsersRound, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { Profile, UserRole } from '@/lib/types';
import { AccessibilityTools } from '@/components/accessibility-tools';
import { BrandMark } from '@/components/brand-mark';
import { LanguageSwitcher, useLanguage } from '@/components/language-provider';
import { SignOutButton } from '@/components/sign-out-button';

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
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const wasOpen = useRef(false);
  const links = profile.role === 'employer' ? employerLinks : profile.role === 'admin' ? adminLinks : candidateLinks;
  const currentLink = [...links].sort((left, right) => right.href.length - left.href.length).find((link) => pathname === link.href || pathname.startsWith(`${link.href}/`));
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

  // WCAG 2.1.1 / 2.4.3: Escape closes the mobile navigation and returns focus.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      window.requestAnimationFrame(() => sidebarRef.current?.querySelector<HTMLAnchorElement>('a')?.focus());
    } else if (wasOpen.current) {
      window.requestAnimationFrame(() => menuButtonRef.current?.focus());
    }
    wasOpen.current = open;
  }, [open]);

  return (
    <div className="app-layout">
      <div id="primary-navigation" ref={sidebarRef} className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-header">
          <BrandMark href="/dashboard" onClick={() => setOpen(false)} />
          <button
            className="mobile-sidebar-close icon-button"
            type="button"
            aria-label={language === 'tl' ? 'Isara ang nabigasyon' : 'Close navigation'}
            aria-controls="primary-navigation"
            onClick={() => setOpen(false)}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p className="sidebar-role" aria-hidden="false">{roleLabel(profile.role, language)}</p>
        <nav className="sidebar-nav" aria-label={language === 'tl' ? 'Pangunahing nabigasyon ng workspace' : 'Primary workspace navigation'}>
          {links.map(({ href, label, tagalog, icon: Icon }) => {
            const deeperMatch = links.some((item) => item.href !== href && item.href.length > href.length && (pathname === item.href || pathname.startsWith(`${item.href}/`)));
            const active = pathname === href || (!deeperMatch && href !== '/dashboard' && pathname.startsWith(`${href}/`));
            return <Link className={active ? 'active' : ''} href={href} key={href} aria-current={active ? 'page' : undefined} onClick={() => setOpen(false)}><Icon size={17} aria-hidden="true" />{language === 'tl' ? tagalog : label}</Link>;
          })}
        </nav>
        <div className="sidebar-footer">
          <p title={displayName}>{displayName}</p>
          <SignOutButton />
        </div>
      </div>
      {open ? <button className="mobile-sidebar-backdrop" type="button" aria-label={language === 'tl' ? 'Isara ang menu ng nabigasyon' : 'Close navigation menu'} onClick={() => setOpen(false)} /> : null}
      <div className="app-content" inert={open ? true : undefined} aria-hidden={open || undefined}>
        <header className="app-topbar">
          <div className="inline-actions">
            <button ref={menuButtonRef} className="icon-button mobile-menu-button" type="button" aria-expanded={open} aria-controls="primary-navigation" aria-label={open ? (language === 'tl' ? 'Isara ang nabigasyon' : 'Close navigation') : (language === 'tl' ? 'Buksan ang nabigasyon' : 'Open navigation')} onClick={() => setOpen(!open)}>
              {open ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}<span className="sr-only" aria-hidden="true">{open ? 'Close' : 'Open'} navigation</span>
            </button>
            <nav className="breadcrumb" aria-label="Breadcrumb"><ol><li><span aria-hidden="true">{workspaceName}</span></li><li aria-current="page">{language === 'tl' ? currentLink?.tagalog ?? 'Pahina' : currentLink?.label ?? 'Page'}</li></ol></nav>
          </div>
          <div className="topbar-tools">
            <LanguageSwitcher />
            <AccessibilityTools />
          </div>
        </header>
        <main id="main-content" className="page-content" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
