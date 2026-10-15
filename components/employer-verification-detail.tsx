'use client';

import { ArrowLeft, Building2, CheckCircle2, FileCheck2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { StatusPill } from '@/components/status-pill';
import { allowedAdminVerificationActions, type EmployerVerificationStatus } from '@/lib/employer-verification';

type VerificationData = {
  employer: { id: string; email: string; full_name: string; organization_name: string | null; created_at: string };
  verification: {
    employer_id: string;
    status: EmployerVerificationStatus;
    revision: number;
    evidence_erasure_in_progress: boolean;
    registered_business_name: string | null;
    trading_name: string | null;
    business_type: string | null;
    registration_authority: string | null;
    registration_number: string | null;
    business_address: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    website: string | null;
    representative_name: string | null;
    representative_role: string | null;
    representative_is_owner_or_officer: boolean | null;
    local_permit_applicable: boolean | null;
    employer_feedback: string | null;
    approved_at: string | null;
    last_submitted_at: string | null;
  };
  submissions: Array<Record<string, unknown> & { id: string; submission_number: number; submitted_at: string }>;
  documents: Array<{ id: string; submission_id: string | null; document_type: string; content_type: string; byte_size: number; uploaded_at: string; signed_url: string | null }>;
  history: Array<{
    id: string;
    event_type: string;
    actor_role: string;
    reviewer_id: string | null;
    previous_status: string | null;
    new_status: string;
    reason: string | null;
    employer_feedback: string | null;
    internal_notes: string | null;
    source_name: string | null;
    source_checked_at: string | null;
    business_check_result: string | null;
    representative_check_method: string | null;
    created_at: string;
  }>;
};

type ReviewAction = 'approve' | 'request_information' | 'reject' | 'suspend';

const actionLabels: Record<ReviewAction, string> = {
  approve: 'Approve',
  request_information: 'Request more information',
  reject: 'Reject',
  suspend: 'Suspend'
};

const documentLabels: Record<string, string> = {
  business_registration: 'Business-registration evidence',
  local_permit: 'Local permit evidence',
  representative_authorization: 'Representative authorization',
  other_evidence: 'Other official-source evidence'
};

function displayDate(value: string | null | undefined) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Not recorded' : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function displayValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : 'Not provided';
}

export function EmployerVerificationDetail({ employerId }: { employerId: string }) {
  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [action, setAction] = useState<ReviewAction>('approve');
  const [reason, setReason] = useState('');
  const [employerFeedback, setEmployerFeedback] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [sourceCheckedAt, setSourceCheckedAt] = useState('');
  const [businessCheckResult, setBusinessCheckResult] = useState('');
  const [representativeCheckMethod, setRepresentativeCheckMethod] = useState('');
  const [pending, setPending] = useState(false);
  const [eraseReason, setEraseReason] = useState('');
  const [eraseConfirmed, setEraseConfirmed] = useState(false);
  const [erasing, setErasing] = useState(false);

  async function load() {
    setError('');
    const response = await fetch(`/api/admin/employers/${employerId}`, { cache: 'no-store' });
    const payload = await response.json() as VerificationData & { error?: string };
    if (!response.ok) throw new Error(payload.error || 'Unable to load this employer review.');
    setData(payload);
  }

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/employers/${employerId}`, { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json() as VerificationData & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to load this employer review.');
      if (active) setData(payload);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Unable to load this employer review.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [employerId]);

  async function submitDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (action !== 'approve' && !reason.trim()) { setError('Enter the reason for this decision.'); return; }
    if (action !== 'approve' && !employerFeedback.trim()) { setError('Enter the feedback the employer will receive.'); return; }
    if (action === 'approve' && (!sourceName.trim() || !sourceCheckedAt || !businessCheckResult || !representativeCheckMethod.trim())) {
      setError('Before approval, record the official source, check time, result, and representative-authorization method.');
      return;
    }
    const expectedRevision = data?.verification.revision;
    if (expectedRevision === undefined) { setError('Reload the employer record before making a decision.'); return; }
    setPending(true);
    try {
      const response = await fetch(`/api/admin/employers/${employerId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          expectedRevision,
          reason,
          employerFeedback,
          internalNotes,
          sourceName,
          sourceCheckedAt: sourceCheckedAt ? new Date(sourceCheckedAt).toISOString() : '',
          businessCheckResult,
          representativeCheckMethod
        })
      });
      const result = await response.json() as { status?: string; error?: string };
      if (!response.ok) throw new Error(result.error || 'The review decision could not be saved.');
      setMessage(`Decision saved. Current status: ${result.status?.replaceAll('_', ' ') ?? 'updated'}.`);
      setReason('');
      setEmployerFeedback('');
      setInternalNotes('');
      setSourceName('');
      setSourceCheckedAt('');
      setBusinessCheckResult('');
      setRepresentativeCheckMethod('');
      await load();
    } catch (cause: unknown) {
      const failure = cause instanceof Error ? cause.message : 'The review decision could not be saved.';
      if (failure.includes('Another reviewer changed this record')) await load().catch(() => undefined);
      setError(failure);
    } finally {
      setPending(false);
    }
  }

  async function eraseEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!eraseConfirmed || !eraseReason.trim()) { setError('Confirm the erasure and enter its reason.'); return; }
    const expectedRevision = data?.verification.revision;
    if (expectedRevision === undefined) { setError('Reload the employer record before erasing evidence.'); return; }
    setErasing(true);
    try {
      const response = await fetch(`/api/admin/employers/${employerId}/evidence`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: eraseReason, expectedRevision })
      });
      const result = await response.json() as { deleted?: number; error?: string };
      if (!response.ok) throw new Error(result.error || 'Evidence could not be erased.');
      setMessage(`${result.deleted ?? 0} evidence file(s) erased; the review history remains.`);
      setEraseReason('');
      setEraseConfirmed(false);
      await load();
    } catch (cause: unknown) {
      const failure = cause instanceof Error ? cause.message : 'Evidence could not be erased.';
      await load().catch(() => undefined);
      setError(failure);
    } finally {
      setErasing(false);
    }
  }

  if (loading) return <div className="panel" role="status" aria-live="polite">Loading employer review…</div>;
  if (error && !data) return <div className="form-error" role="alert">{error} <button className="button secondary small" type="button" onClick={() => { setLoading(true); void load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load this employer review.')).finally(() => setLoading(false)); }}>Retry</button></div>;
  if (!data) return null;

  const verification = data.verification;
  const actions = allowedAdminVerificationActions(verification.status) as readonly ReviewAction[];
  const formDisabled = pending || verification.evidence_erasure_in_progress || !actions.includes(action);

  return <>
    <div className="page-heading">
      <div><p className="eyebrow">Employer verification review</p><h1>{verification.registered_business_name || data.employer.organization_name || data.employer.full_name}</h1><p>{data.employer.full_name} / {data.employer.email}</p></div>
      <Link className="button secondary small" href="/admin/employers"><ArrowLeft size={15} aria-hidden="true" /> Back to queue</Link>
    </div>
    {message ? <div className="form-success" role="status" aria-live="polite">{message}</div> : null}
    {error ? <div className="form-error" role="alert">{error}</div> : null}
    {verification.evidence_erasure_in_progress ? <div className="notice" role="status">Evidence erasure is in progress. Review decisions are blocked until cleanup finishes; retry the erasure after storage is available.</div> : null}
    <div className="notice"><ShieldCheck size={17} aria-hidden="true" /><span>Manual review only. Uploading a document does not establish that it is authentic or officially verified.</span></div>
    <section className="panel" aria-labelledby="verification-status-heading" style={{ marginTop: 18 }}>
      <div className="panel-header"><div><h2 id="verification-status-heading">Current status</h2><p>Submitted {displayDate(verification.last_submitted_at)} / approved {displayDate(verification.approved_at)}</p></div><StatusPill status={verification.status} /></div>
      {verification.employer_feedback ? <div className="notice" role="note"><strong>Feedback visible to employer:</strong> {verification.employer_feedback}</div> : <p className="muted">No employer-visible feedback is recorded.</p>}
    </section>
    <section className="panel" aria-labelledby="business-details-heading" style={{ marginTop: 18 }}>
      <div className="panel-header"><div><h2 id="business-details-heading">Submitted business information</h2><p>Business and representative details from the current record.</p></div><Building2 size={20} aria-hidden="true" /></div>
      <dl className="verification-detail-grid">
        <div><dt>Registered business name</dt><dd>{displayValue(verification.registered_business_name)}</dd></div>
        <div><dt>Trading name</dt><dd>{displayValue(verification.trading_name)}</dd></div>
        <div><dt>Business type</dt><dd>{displayValue(verification.business_type?.replaceAll('_', ' '))}</dd></div>
        <div><dt>Registration authority / official source</dt><dd>{displayValue(verification.registration_authority)}</dd></div>
        <div><dt>Registration or record number</dt><dd>{displayValue(verification.registration_number)}</dd></div>
        <div><dt>Business address</dt><dd>{displayValue(verification.business_address)}</dd></div>
        <div><dt>Company contact email</dt><dd>{displayValue(verification.contact_email)}</dd></div>
        <div><dt>Company contact phone</dt><dd>{displayValue(verification.contact_phone)}</dd></div>
        <div><dt>Website</dt><dd>{verification.website ? <a className="text-link" href={verification.website} target="_blank" rel="noreferrer">{verification.website}</a> : 'Not provided'}</dd></div>
        <div><dt>Representative</dt><dd>{displayValue(verification.representative_name)} / {displayValue(verification.representative_role)}</dd></div>
        <div><dt>Owner or recorded officer</dt><dd>{verification.representative_is_owner_or_officer ? 'Yes' : 'No'}</dd></div>
        <div><dt>Local permit applicable</dt><dd>{verification.local_permit_applicable === null ? 'Not recorded' : verification.local_permit_applicable ? 'Yes' : 'No / not applicable'}</dd></div>
      </dl>
    </section>
    <section className="panel" aria-labelledby="evidence-heading" style={{ marginTop: 18 }}>
      <div className="panel-header"><div><h2 id="evidence-heading">Private supporting documents</h2><p>Signed download links expire after five minutes. Do not copy document contents into notes.</p></div><FileCheck2 size={20} aria-hidden="true" /></div>
      {data.documents.length ? <ul className="mini-list">{data.documents.map((document) => {
        const submission = data.submissions.find((item) => item.id === document.submission_id);
        return <li key={document.id}><FileCheck2 size={17} aria-hidden="true" /><div><strong>{documentLabels[document.document_type] ?? 'Supporting evidence'}</strong><span>{document.submission_id ? `Submission ${submission?.submission_number ?? ''}` : 'Not submitted yet'} / {Math.ceil(document.byte_size / 1024)} KB / uploaded {displayDate(document.uploaded_at)}</span></div>{document.signed_url ? <a className="text-link" href={document.signed_url} target="_blank" rel="noreferrer">Open private file</a> : <span className="field-help">Temporary link unavailable</span>}</li>;
      })}</ul> : <div className="empty-state"><h3>No evidence uploaded.</h3><p>Review may request evidence appropriate to the employer’s business type.</p></div>}
    </section>
    <section className="panel" aria-labelledby="submissions-heading" style={{ marginTop: 18 }}>
      <div className="panel-header"><div><h2 id="submissions-heading">Submission history</h2><p>Each employer resubmission is retained as a separate snapshot.</p></div></div>
      {data.submissions.length ? <div className="data-stack">{data.submissions.map((submission) => <details className="verification-history-item" key={submission.id}><summary>Submission {submission.submission_number} / {displayDate(submission.submitted_at)}</summary><dl className="verification-detail-grid"><div><dt>Registered business</dt><dd>{displayValue(submission.registered_business_name)}</dd></div><div><dt>Trading name</dt><dd>{displayValue(submission.trading_name)}</dd></div><div><dt>Business type</dt><dd>{displayValue(typeof submission.business_type === 'string' ? submission.business_type.replaceAll('_', ' ') : null)}</dd></div><div><dt>Authority</dt><dd>{displayValue(submission.registration_authority)}</dd></div><div><dt>Registration number</dt><dd>{displayValue(submission.registration_number)}</dd></div><div><dt>Representative</dt><dd>{displayValue(submission.representative_name)} / {displayValue(submission.representative_role)}</dd></div></dl></details>)}</div> : <p className="muted">No submissions yet.</p>}
    </section>
    <section className="panel" aria-labelledby="review-history-heading" style={{ marginTop: 18 }}>
      <div className="panel-header"><div><h2 id="review-history-heading">Review and audit history</h2><p>Internal reviewer notes are visible only in this admin interface.</p></div></div>
      {data.history.length ? <div className="data-stack">{data.history.map((event) => <article className="verification-history-item" key={event.id}><div className="panel-header"><div><h3>{event.event_type.replaceAll('_', ' ')}</h3><p>{displayDate(event.created_at)} / {event.actor_role}{event.reviewer_id ? ` / reviewer ${event.reviewer_id}` : ''}</p></div><StatusPill status={event.new_status} /></div>{event.previous_status ? <p>Transition: {event.previous_status.replaceAll('_', ' ')} → {event.new_status.replaceAll('_', ' ')}</p> : null}{event.reason ? <p><strong>Reason:</strong> {event.reason}</p> : null}{event.employer_feedback ? <p><strong>Employer-visible feedback:</strong> {event.employer_feedback}</p> : null}{event.internal_notes ? <p><strong>Internal notes:</strong> {event.internal_notes}</p> : null}{event.source_name ? <p><strong>Official source:</strong> {event.source_name} / checked {displayDate(event.source_checked_at)}</p> : null}{event.business_check_result ? <p><strong>Business-information result:</strong> {event.business_check_result}</p> : null}{event.representative_check_method ? <p><strong>Representative authorization check:</strong> {event.representative_check_method}</p> : null}</article>)}</div> : <p className="muted">No review decisions have been recorded.</p>}
    </section>
    {actions.length ? <section className="panel" aria-labelledby="decision-heading" style={{ marginTop: 18 }}>
      <div className="panel-header"><div><h2 id="decision-heading">Record a review decision</h2><p>Approval requires recording the official source and how the business and representative were checked.</p></div><CheckCircle2 size={20} aria-hidden="true" /></div>
      <div className="button-row" role="group" aria-label="Choose a verification action">{actions.map((value) => <button className={action === value ? 'button' : 'button secondary'} key={value} type="button" disabled={pending || verification.evidence_erasure_in_progress} aria-pressed={action === value} onClick={() => setAction(value)}>{actionLabels[value]}</button>)}</div>
      <form className="form-stack" onSubmit={submitDecision} aria-describedby="manual-review-guidance">
        <p className="field-help" id="manual-review-guidance">Review is manual. Do not describe uploaded files as officially verified unless you checked them against an appropriate source.</p>
        {action === 'approve' ? <>
          <label className="field" htmlFor="review-source"><span>Official source or issuing authority</span><input className="input" id="review-source" value={sourceName} onChange={(event) => setSourceName(event.target.value)} maxLength={500} required placeholder="Authority name, public registry, or official URL" /></label>
          <label className="field" htmlFor="source-checked-at"><span>When was it checked?</span><input className="input" id="source-checked-at" type="datetime-local" value={sourceCheckedAt} onChange={(event) => setSourceCheckedAt(event.target.value)} required /></label>
          <label className="field" htmlFor="business-check-result"><span>Business-information check result</span><select className="select" id="business-check-result" value={businessCheckResult} onChange={(event) => setBusinessCheckResult(event.target.value)} required><option value="">Choose a result</option><option value="matched">Matched the submitted information</option><option value="not_matched">Did not match</option><option value="inconclusive">Inconclusive</option></select><small>Only a matched result allows approval.</small></label>
          <label className="field" htmlFor="representative-check-method"><span>How was representative authorization checked?</span><textarea className="textarea" id="representative-check-method" value={representativeCheckMethod} onChange={(event) => setRepresentativeCheckMethod(event.target.value)} maxLength={1000} required placeholder="Describe the official record or authorization evidence reviewed." /></label>
          <label className="field" htmlFor="approval-reason"><span>Decision reason <small>(optional)</small></span><textarea className="textarea" id="approval-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} /></label>
        </> : <>
          <label className="field" htmlFor="decision-reason"><span>Reason <small>(required)</small></span><textarea className="textarea" id="decision-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} required /></label>
          <label className="field" htmlFor="employer-feedback"><span>Feedback for the employer <small>(required)</small></span><textarea className="textarea" id="employer-feedback" value={employerFeedback} onChange={(event) => setEmployerFeedback(event.target.value)} maxLength={2000} required /></label>
        </>}
        {action === 'approve' ? <label className="field" htmlFor="employer-feedback"><span>Feedback for the employer <small>(optional)</small></span><textarea className="textarea" id="employer-feedback" value={employerFeedback} onChange={(event) => setEmployerFeedback(event.target.value)} maxLength={2000} /></label> : null}
        <label className="field" htmlFor="internal-notes"><span>Internal reviewer notes <small>(admin only)</small></span><textarea className="textarea" id="internal-notes" value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} maxLength={2000} /><small>Do not enter government ID numbers or document contents.</small></label>
        <button className="button" type="submit" disabled={pending || formDisabled}>{pending ? 'Saving decision…' : `${actionLabels[action]} employer`}</button>
      </form>
    </section> : null}
    <details className="panel" style={{ marginTop: 18 }}>
      <summary>Erase uploaded evidence</summary>
      <p className="field-help">Use only for an approved erasure request or before account deletion. This removes stored files and their metadata, but keeps the decision/audit history while the account remains active.</p>
      <form className="form-stack" onSubmit={eraseEvidence}>
        <label className="field" htmlFor="erasure-reason"><span>Erasure reason</span><textarea className="textarea" id="erasure-reason" value={eraseReason} onChange={(event) => setEraseReason(event.target.value)} maxLength={1000} required /></label>
        <label className="checkbox-line"><input type="checkbox" checked={eraseConfirmed} onChange={(event) => setEraseConfirmed(event.target.checked)} /><span>I confirm this evidence erasure is authorized.</span></label>
        <button className="button secondary" type="submit" disabled={erasing || !eraseConfirmed || !eraseReason.trim()}>{erasing ? 'Erasing evidence…' : verification.evidence_erasure_in_progress ? 'Retry evidence erasure' : 'Erase all evidence files'}</button>
      </form>
    </details>
  </>;
}
