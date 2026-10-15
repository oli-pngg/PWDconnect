'use client';

import { ArrowLeft, ArrowRight, Building2, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { StatusPill } from '@/components/status-pill';
import { EMPLOYER_VERIFICATION_STATUSES, type EmployerVerificationStatus } from '@/lib/employer-verification';

type QueueItem = {
  employer_id: string;
  status: EmployerVerificationStatus;
  full_name: string;
  email: string;
  organization_name: string | null;
  registered_business_name: string | null;
  trading_name: string | null;
  business_type: string | null;
  last_submitted_at: string | null;
  updated_at: string;
};

const labels: Record<EmployerVerificationStatus, string> = {
  not_submitted: 'Not submitted',
  pending: 'Pending',
  needs_information: 'Needs information',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended'
};

function businessTypeLabel(value: string | null) {
  return value?.replaceAll('_', ' ') || 'Not submitted';
}

export function EmployerVerificationQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [reloadCount, setReloadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pageSize = 20;

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), search, status });
    fetch(`/api/admin/employers?${query.toString()}`, { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json() as { items?: QueueItem[]; total?: number; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to load the employer-verification queue.');
      if (active) {
        setItems(payload.items ?? []);
        setTotal(payload.total ?? 0);
      }
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to load the employer-verification queue.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, search, status, reloadCount]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    setPage(1);
    setSearch(searchInput.trim());
    setReloadCount((current) => current + 1);
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return <>
    <div className="page-heading"><div><p className="eyebrow">Manual review</p><h1>Employer verification</h1><p>Uploaded documents are evidence for review, not proof of verification by themselves.</p></div><span className="notice"><Building2 size={16} aria-hidden="true" /> {total} records</span></div>
    <section className="panel" aria-labelledby="employer-queue-heading">
      <div className="panel-header"><div><h2 id="employer-queue-heading">Review queue</h2><p>Search business and trading names; filter by the current status.</p></div></div>
      <form className="toolbar" onSubmit={submitSearch} role="search" aria-label="Search employer verification queue">
        <Search size={18} aria-hidden="true" />
        <label className="sr-only" htmlFor="verification-search">Search business name</label>
        <input className="input" id="verification-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search business name" />
        <label className="sr-only" htmlFor="verification-status-filter">Filter verification status</label>
        <select className="select" id="verification-status-filter" value={status} onChange={(event) => { setError(''); setLoading(true); setPage(1); setStatus(event.target.value); setReloadCount((current) => current + 1); }}>
          <option value="">All statuses</option>
          {EMPLOYER_VERIFICATION_STATUSES.map((value) => <option key={value} value={value}>{labels[value]}</option>)}
        </select>
        <button className="button small" type="submit">Search</button>
      </form>
      {error ? <div className="form-error" role="alert">{error}<button className="button secondary small" type="button" onClick={() => { setError(''); setLoading(true); setReloadCount((current) => current + 1); }}>Retry</button></div> : null}
      {loading ? <div className="panel" role="status" aria-live="polite">Loading employers…</div> : !error && !items.length ? <div className="empty-state"><h3>No employers match these filters.</h3><p>Change the search or status filter to see other records.</p></div> : null}
      {!loading && !error && items.length ? <>
        <div className="table-wrap"><table className="data-table"><caption className="sr-only">Employer verification records</caption><thead><tr><th scope="col">Business name</th><th scope="col">Representative</th><th scope="col">Business type</th><th scope="col">Status</th><th scope="col">Last submitted</th><th scope="col"><span className="sr-only">Review</span></th></tr></thead><tbody>
          {items.map((item) => <tr key={item.employer_id}>
            <td data-label="Business name"><strong>{item.registered_business_name || item.trading_name || item.organization_name || 'Not submitted'}</strong>{item.trading_name && item.trading_name !== item.registered_business_name ? <small className="block">Trading as {item.trading_name}</small> : null}</td>
            <td data-label="Representative">{item.full_name}<small className="block">{item.email}</small></td>
            <td data-label="Business type">{businessTypeLabel(item.business_type)}</td>
            <td data-label="Status"><StatusPill status={item.status} /></td>
            <td data-label="Last submitted">{item.last_submitted_at ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(item.last_submitted_at)) : 'Not submitted'}</td>
            <td data-label="Review"><Link className="text-link" href={`/admin/employers/${item.employer_id}`}>Open review</Link></td>
          </tr>)}
        </tbody></table></div>
        <nav className="button-row" aria-label="Employer queue pagination" style={{ justifyContent: 'space-between', marginTop: 18 }}>
          <span className="field-help" aria-live="polite">Page {page} of {pageCount} / {total} employers</span>
          <div className="button-row"><button className="button secondary small" type="button" disabled={page <= 1 || loading} onClick={() => { setError(''); setLoading(true); setPage((current) => Math.max(1, current - 1)); }}><ArrowLeft size={15} aria-hidden="true" /> Previous</button><button className="button secondary small" type="button" disabled={page >= pageCount || loading} onClick={() => { setError(''); setLoading(true); setPage((current) => current + 1); }}>Next <ArrowRight size={15} aria-hidden="true" /></button></div>
        </nav>
      </> : null}
    </section>
  </>;
}
