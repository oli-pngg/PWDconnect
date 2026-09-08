'use client';

import { ArrowUpRight, Eye, ShieldCheck, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StatusPill } from '@/components/status-pill';
import type { ApplicationStatus, CandidatePreview } from '@/lib/types';

const statuses: ApplicationStatus[] = ['submitted', 'shortlisted', 'interview', 'rejected', 'hired'];

export function CandidatePool() {
  const [candidates, setCandidates] = useState<CandidatePreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/employer/candidates', { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json() as { candidates?: CandidatePreview[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to load candidates.');
      setCandidates(payload.candidates ?? []);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load candidates.')).finally(() => setLoading(false));
  }, []);

  async function changeStatus(applicationId: string, status: ApplicationStatus) {
    setError('');
    setMessage('');
    const response = await fetch(`/api/applications/${applicationId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    const payload = await response.json() as { error?: string };
    if (!response.ok) setError(payload.error || 'Unable to update status.');
    else {
      setCandidates((current) => current.map((candidate) => candidate.application_id === applicationId ? { ...candidate, status } : candidate));
      setMessage('Candidate status updated.');
    }
  }

  return <>
    <div className="page-heading"><div><p className="eyebrow">Blind candidate review</p><h1>Meet the evidence first.</h1><p>Initial previews use a pseudonymous reference, verified skills, and fit reasoning. Personal details stay protected until your workflow advances.</p></div><div className="notice"><ShieldCheck size={16} aria-hidden="true" /> Bias-aware review</div></div>
    <div className="panel panel-accent" style={{ marginBottom: 18 }}><div className="inline-actions"><Eye size={18} aria-hidden="true" /><strong>What you see is intentionally limited</strong></div><p className="muted" style={{ marginBottom: 0 }}>Names, disability type, and contact details are not returned by the initial candidate endpoint. This is an access-control rule, not just a visual hiding technique.</p></div>
    {message ? <div className="form-success" role="status">{message}</div> : null}
    {error ? <div className="form-error" role="alert">{error}</div> : null}
    {loading ? <div className="skeleton-card"><span className="skeleton skeleton-title" /><span className="skeleton skeleton-line" /></div> : candidates.length ? <section className="panel" aria-labelledby="candidate-list-heading"><div className="panel-header"><div><h2 id="candidate-list-heading">Candidate matches</h2><p>Sorted by computed fit score. Status changes are authorized against your own job only.</p></div><UsersRound size={20} aria-hidden="true" /></div><div className="candidate-list">{candidates.map((candidate) => <div className="candidate-row" key={candidate.application_id}><div><h3>{candidate.candidate_ref}</h3><p><strong>{candidate.job_title}</strong> / {candidate.matched_skills.length ? candidate.matched_skills.join(', ') : 'No direct skill overlap recorded'}</p></div><div className="fit-score" aria-label={`${candidate.fit_score} percent fit`}>{candidate.fit_score}%</div><div className="candidate-actions"><label className="sr-only" htmlFor={`status-${candidate.application_id}`}>Update status for {candidate.candidate_ref}</label><select className="select" id={`status-${candidate.application_id}`} value={candidate.status} onChange={(event) => void changeStatus(candidate.application_id, event.target.value as ApplicationStatus)}>{statuses.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select><Link className="button secondary small" href={`/applications/${candidate.application_id}`}>Message / offer <ArrowUpRight size={15} aria-hidden="true" /></Link><StatusPill status={candidate.status} /></div></div>)}</div></section> : <div className="empty-state panel"><h2>No candidate matches yet.</h2><p>Publish an opening to receive skills-first applications.</p></div>}
  </>;
}
