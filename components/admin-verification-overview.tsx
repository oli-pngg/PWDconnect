'use client';

import { Accessibility, ArrowUpRight, Building2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/skeleton';
import { StatusPill } from '@/components/status-pill';
import { EMPLOYER_VERIFICATION_STATUSES, type EmployerVerificationStatus } from '@/lib/employer-verification';

const statusLabels: Record<EmployerVerificationStatus, string> = {
  not_submitted: 'Not submitted',
  pending: 'Pending',
  needs_information: 'Needs information',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended'
};

export function AdminVerificationOverview() {
  const [counts, setCounts] = useState<Record<EmployerVerificationStatus, number> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/admin/employers/stats', { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json() as { counts?: Record<EmployerVerificationStatus, number>; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to load verification counts.');
      if (active) setCounts(payload.counts ?? null);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to load verification counts.');
    });
    return () => { active = false; };
  }, []);

  return <>
    <div className="page-heading">
      <div><p className="eyebrow">Research workspace</p><h1>Admin overview</h1><p>Review employer submissions and access existing platform evaluation.</p></div>
      <span className="notice">Admin-only</span>
    </div>
    <section className="panel" aria-labelledby="verification-counts-heading">
      <div className="panel-header"><div><h2 id="verification-counts-heading">Employer verification status</h2><p>Live counts from employer verification records.</p></div><Building2 size={20} aria-hidden="true" /></div>
      {error ? <div className="form-error" role="alert">{error}</div> : counts ? <div className="stat-grid">{EMPLOYER_VERIFICATION_STATUSES.map((status) => <article className="stat-card" key={status}><span><StatusPill status={status} /></span><strong>{counts[status] ?? 0}</strong><small>{statusLabels[status]} employers</small></article>)}</div> : <div className="stat-grid" aria-label="Loading verification counts">{EMPLOYER_VERIFICATION_STATUSES.slice(0, 3).map((status) => <div className="stat-card" key={status}><Skeleton className="skeleton-line short" /><Skeleton className="skeleton-title" /></div>)}</div>}
    </section>
    <div className="content-grid equal" style={{ marginTop: 18 }}>
      <section className="panel panel-accent"><div className="panel-header"><div><p className="eyebrow">Manual review</p><h2>Employer verification</h2></div><Building2 size={21} aria-hidden="true" /></div><p className="muted">Review business information, relevant evidence, representative authorization, and prior decisions.</p><Link className="button" href="/admin/employers">Open verification queue <ArrowUpRight size={16} aria-hidden="true" /></Link></section>
      <section className="panel"><div className="panel-header"><div><p className="eyebrow">Existing feature</p><h2>Platform evaluation</h2></div><Accessibility size={21} aria-hidden="true" /></div><p className="muted">Review the existing functional suitability, performance efficiency, and interaction capability metrics.</p><Link className="button secondary" href="/admin/evaluation">Open evaluation <ArrowUpRight size={16} aria-hidden="true" /></Link></section>
    </div>
  </>;
}
