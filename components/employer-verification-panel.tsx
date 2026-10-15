'use client';

import { FileCheck2, ShieldCheck, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { StatusPill } from '@/components/status-pill';
import {
  canEmployerSubmitVerification,
  EMPLOYER_BUSINESS_TYPES,
  EMPLOYER_VERIFICATION_DOCUMENT_TYPES,
  requiredFreshEvidence,
  requiredEvidenceTypes,
  validateEmployerVerificationSubmission,
  type EmployerBusinessType,
  type EmployerVerificationDocument,
  type EmployerVerificationDocumentType,
  type EmployerVerificationStatus,
  type EmployerVerificationSubmission
} from '@/lib/employer-verification';

type VerificationDocument = EmployerVerificationDocument & {
  id: string;
  submission_id: string | null;
  content_type: string;
  byte_size: number;
  uploaded_at: string;
  signed_url: string | null;
};

type VerificationData = {
  verification: EmployerVerificationSubmission & {
    status: EmployerVerificationStatus;
    materialChangeRequiresEvidence: boolean;
    evidenceErasureInProgress: boolean;
    employer_feedback: string | null;
    approved_at: string | null;
    last_submitted_at: string | null;
  };
  submissions: Array<{ id: string; submission_number: number; submitted_at: string }>;
  documents: VerificationDocument[];
};

const documentLabels: Record<EmployerVerificationDocumentType, string> = {
  business_registration: 'Business-registration evidence',
  local_permit: 'Local permit',
  representative_authorization: 'Representative authorization',
  other_evidence: 'Other official-source evidence'
};

const businessTypeLabels: Record<EmployerBusinessType, string> = {
  sole_proprietorship: 'Sole proprietorship',
  partnership: 'Partnership',
  corporation: 'Corporation',
  cooperative: 'Cooperative',
  nonprofit: 'Nonprofit organization',
  government: 'Government office or agency',
  other: 'Other / not listed'
};

const initialForm: EmployerVerificationSubmission = {
  registeredBusinessName: '',
  tradingName: '',
  businessType: '',
  registrationAuthority: '',
  registrationNumber: '',
  businessAddress: '',
  contactEmail: '',
  contactPhone: '',
  website: '',
  representativeName: '',
  representativeRole: '',
  representativeIsOwnerOrOfficer: null,
  localPermitApplicable: null
};

function displayDate(value: string | null | undefined) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Not recorded' : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(date);
}

function isRegisteredBusinessType(type: EmployerBusinessType | '') {
  return type !== '' && !['government', 'other'].includes(type);
}

export function EmployerVerificationPanel() {
  const [data, setData] = useState<VerificationData | null>(null);
  const [form, setForm] = useState<EmployerVerificationSubmission>(initialForm);
  const [documentType, setDocumentType] = useState<EmployerVerificationDocumentType>('business_registration');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadVerification() {
    const response = await fetch('/api/employer/verification', { cache: 'no-store' });
    const payload = await response.json() as VerificationData & { error?: string };
    if (!response.ok) throw new Error(payload.error || 'Unable to load employer verification.');
    setData(payload);
    const verification = payload.verification;
    setForm({
      registeredBusinessName: verification.registeredBusinessName ?? '',
      tradingName: verification.tradingName ?? '',
      businessType: verification.businessType ?? '',
      registrationAuthority: verification.registrationAuthority ?? '',
      registrationNumber: verification.registrationNumber ?? '',
      businessAddress: verification.businessAddress ?? '',
      contactEmail: verification.contactEmail ?? '',
      contactPhone: verification.contactPhone ?? '',
      website: verification.website ?? '',
      representativeName: verification.representativeName ?? '',
      representativeRole: verification.representativeRole ?? '',
      representativeIsOwnerOrOfficer: verification.representativeIsOwnerOrOfficer ?? null,
      localPermitApplicable: typeof verification.localPermitApplicable === 'boolean' ? verification.localPermitApplicable : null
    });
  }

  useEffect(() => {
    let active = true;
    fetch('/api/employer/verification', { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json() as VerificationData & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to load employer verification.');
      if (!active) return;
      setData(payload);
      const verification = payload.verification;
      setForm({
        registeredBusinessName: verification.registeredBusinessName ?? '',
        tradingName: verification.tradingName ?? '',
        businessType: verification.businessType ?? '',
        registrationAuthority: verification.registrationAuthority ?? '',
        registrationNumber: verification.registrationNumber ?? '',
        businessAddress: verification.businessAddress ?? '',
        contactEmail: verification.contactEmail ?? '',
        contactPhone: verification.contactPhone ?? '',
        website: verification.website ?? '',
        representativeName: verification.representativeName ?? '',
        representativeRole: verification.representativeRole ?? '',
        representativeIsOwnerOrOfficer: verification.representativeIsOwnerOrOfficer ?? null,
        localPermitApplicable: typeof verification.localPermitApplicable === 'boolean' ? verification.localPermitApplicable : null
      });
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Unable to load employer verification.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const status = data?.verification.status ?? 'not_submitted';
  const canEdit = canEmployerSubmitVerification(status) && !data?.verification.evidenceErasureInProgress;
  const registeredType = isRegisteredBusinessType(form.businessType);
  const requiredEvidence = useMemo(
    () => form.businessType ? requiredEvidenceTypes(form.businessType, form.representativeIsOwnerOrOfficer, form.localPermitApplicable) : [],
    [form.businessType, form.representativeIsOwnerOrOfficer, form.localPermitApplicable]
  );
  const freshEvidence = data ? requiredFreshEvidence(data.verification, form) : { businessRecord: false, localPermit: false, representativeAuthorization: false };
  function hasRequiredEvidence(type: EmployerVerificationDocumentType) {
    const documents = data?.documents ?? [];
    if (type === 'other_evidence') return documents.some((document) => document.document_type === 'other_evidence' || document.document_type === 'business_registration');
    return documents.some((document) => document.document_type === type);
  }

  function updateField<K extends keyof EmployerVerificationSubmission>(field: K, value: EmployerVerificationSubmission[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function uploadEvidence() {
    setError('');
    setMessage('');
    if (!file) { setError('Choose a file to upload.'); return; }
    if (file.size < 1 || file.size > 4 * 1024 * 1024) { setError('Evidence files must be 4 MB or smaller.'); return; }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('documentType', documentType);
      body.append('file', file);
      const response = await fetch('/api/employer/verification/documents', { method: 'POST', body });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to upload evidence.');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setMessage('Evidence uploaded privately. It will be attached to your next submission.');
      await loadVerification();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Unable to upload evidence.');
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!canEdit) { setError('This verification cannot be edited in its current status.'); return; }
    const errors = data
      ? validateEmployerVerificationSubmission(form, data.documents, requiredFreshEvidence(data.verification, form))
      : ['Verification data is not loaded. Reload and try again.'];
    if (errors.length) { setError(errors[0]); return; }
    setPending(true);
    try {
      const response = await fetch('/api/employer/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const payload = await response.json() as { status?: EmployerVerificationStatus; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to submit verification.');
      setMessage('Verification submitted. PWDconnect will review the information and evidence manually.');
      await loadVerification();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Unable to submit verification. Your entered information has been kept.');
    } finally {
      setPending(false);
    }
  }

  if (loading) return <section className="panel" aria-labelledby="employer-verification-heading"><div className="panel-header"><div><h2 id="employer-verification-heading">Business verification</h2><p role="status" aria-live="polite">Loading verification status…</p></div></div></section>;
  if (!data && error) return <section className="panel" aria-labelledby="employer-verification-heading"><div className="panel-header"><div><h2 id="employer-verification-heading">Business verification</h2></div></div><div className="form-error" role="alert">{error}</div><button className="button secondary small" type="button" onClick={() => { setLoading(true); setError(''); void loadVerification().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load employer verification.')).finally(() => setLoading(false)); }}>Retry</button></section>;

  return <section className="panel employer-verification-panel" aria-labelledby="employer-verification-heading">
    <div className="panel-header"><div><p className="eyebrow">Employer onboarding</p><h2 id="employer-verification-heading">Business verification</h2><p>Verification helps candidates understand which business and representative submitted an opening.</p></div><StatusPill status={status} /></div>
    <div className="notice" role="note"><ShieldCheck size={18} aria-hidden="true" /><div><strong>Private evidence and manual review</strong><p>Only you and authorized PWDconnect administrators can access these details and files. Applicants and other employers cannot view them. We do not request government IDs by default. Uploads are not automatically verified; a reviewer checks the appropriate source manually.</p></div></div>
    {status === 'needs_information' && data?.verification.employer_feedback ? <div className="form-error" role="status"><strong>More information requested:</strong> {data.verification.employer_feedback}</div> : null}
    {status === 'rejected' && data?.verification.employer_feedback ? <div className="notice" role="status"><strong>Review feedback:</strong> {data.verification.employer_feedback}</div> : null}
    {status === 'suspended' ? <div className="form-error" role="status">Verification is suspended. Contact PWDconnect support before submitting further changes.</div> : null}
    {data?.verification.evidenceErasureInProgress ? <div className="notice" role="status">An administrator is erasing stored evidence. Upload and submission are temporarily disabled.</div> : null}
    {status === 'pending' ? <div className="notice" role="status">Your submission is awaiting manual review. You can still prepare draft openings; publishing and applicant details remain unavailable until approval.</div> : null}
    {status === 'approved' ? <div className="form-success" role="status">Approved {displayDate(data?.verification.approved_at)}. Material business or representative changes will require a new review.</div> : null}
    {error ? <div className="form-error" role="alert">{error}</div> : null}
    {message ? <div className="form-success" role="status" aria-live="polite">{message}</div> : null}

    <form className="form-stack" onSubmit={submit} noValidate>
      <div className="panel-header"><div><h3>Business information</h3><p>Required fields depend on the organization type and whether a permit or separate representative authorization applies.</p></div></div>
      <div className="field-grid two">
        <label className="field" htmlFor="verification-registered-name"><span>{form.businessType === 'government' ? 'Official agency or unit name' : form.businessType === 'other' ? 'Registered or operating name' : 'Registered business name'}</span><input className="input" id="verification-registered-name" value={form.registeredBusinessName} onChange={(event) => updateField('registeredBusinessName', event.target.value)} maxLength={200} required disabled={!canEdit} /></label>
        <label className="field" htmlFor="verification-trading-name"><span>Trading name <small>(if different)</small></span><input className="input" id="verification-trading-name" value={form.tradingName} onChange={(event) => updateField('tradingName', event.target.value)} maxLength={200} disabled={!canEdit} /></label>
      </div>
      <label className="field" htmlFor="verification-business-type"><span>Business type</span><select className="select" id="verification-business-type" value={form.businessType} onChange={(event) => updateField('businessType', event.target.value as EmployerVerificationSubmission['businessType'])} required disabled={!canEdit}><option value="">Choose a business type</option>{EMPLOYER_BUSINESS_TYPES.map((type) => <option key={type} value={type}>{businessTypeLabels[type]}</option>)}</select></label>
      <div className="field-grid two">
        <label className="field" htmlFor="verification-authority"><span>{registeredType ? 'Registration authority' : 'Registration authority or official source'}</span><input className="input" id="verification-authority" value={form.registrationAuthority} onChange={(event) => updateField('registrationAuthority', event.target.value)} maxLength={200} required disabled={!canEdit} placeholder="For example, the issuing registry or government directory" /></label>
        <label className="field" htmlFor="verification-number"><span>Registration / record number {registeredType ? <small>(required for this type)</small> : <small>(if available)</small>}</span><input className="input" id="verification-number" value={form.registrationNumber} onChange={(event) => updateField('registrationNumber', event.target.value)} maxLength={120} required={registeredType} disabled={!canEdit} /></label>
      </div>
      <label className="field" htmlFor="verification-address"><span>Business address</span><textarea className="textarea" id="verification-address" value={form.businessAddress} onChange={(event) => updateField('businessAddress', event.target.value)} maxLength={500} required disabled={!canEdit} /></label>
      <div className="field-grid two">
        <label className="field" htmlFor="verification-contact-email"><span>Company contact email</span><input className="input" id="verification-contact-email" type="email" autoComplete="email" value={form.contactEmail} onChange={(event) => updateField('contactEmail', event.target.value)} maxLength={254} required disabled={!canEdit} /></label>
        <label className="field" htmlFor="verification-contact-phone"><span>Company contact phone</span><input className="input" id="verification-contact-phone" type="tel" autoComplete="tel" value={form.contactPhone} onChange={(event) => updateField('contactPhone', event.target.value)} maxLength={40} required disabled={!canEdit} /></label>
      </div>
      <label className="field" htmlFor="verification-website"><span>Website <small>(if available)</small></span><input className="input" id="verification-website" type="url" value={form.website} onChange={(event) => updateField('website', event.target.value)} maxLength={2048} disabled={!canEdit} placeholder="https://" /></label>
      <div className="field-grid two">
        <label className="field" htmlFor="verification-representative"><span>Representative name</span><input className="input" id="verification-representative" value={form.representativeName} onChange={(event) => updateField('representativeName', event.target.value)} maxLength={160} required disabled={!canEdit} /></label>
        <label className="field" htmlFor="verification-representative-role"><span>Representative role</span><input className="input" id="verification-representative-role" value={form.representativeRole} onChange={(event) => updateField('representativeRole', event.target.value)} maxLength={120} required disabled={!canEdit} placeholder="Owner, director, authorized contact…" /></label>
      </div>
      <label className="field" htmlFor="verification-representative-is-owner"><span>Is the representative the owner or a recorded officer?</span><select className="select" id="verification-representative-is-owner" value={form.representativeIsOwnerOrOfficer === null ? '' : String(form.representativeIsOwnerOrOfficer)} onChange={(event) => updateField('representativeIsOwnerOrOfficer', event.target.value === '' ? null : event.target.value === 'true')} disabled={!canEdit} required><option value="">Choose an answer</option><option value="true">Yes</option><option value="false">No</option></select></label>
      {form.representativeIsOwnerOrOfficer === false ? <p className="field-help">Representative-authorization evidence is required because the representative is not the owner or a recorded officer.</p> : null}
      <label className="field" htmlFor="verification-permit-applicable"><span>Does a local permit apply to this business type and location?</span><select className="select" id="verification-permit-applicable" value={form.localPermitApplicable === null ? '' : String(form.localPermitApplicable)} onChange={(event) => updateField('localPermitApplicable', event.target.value === '' ? null : event.target.value === 'true')} disabled={!canEdit} required><option value="">Choose an answer</option><option value="true">Yes</option><option value="false">No / not applicable</option></select></label>
      {form.localPermitApplicable === true ? <p className="field-help">Upload the applicable permit evidence.</p> : null}

      <div className="panel-header"><div><h3>Supporting evidence</h3><p>For registered business types, provide a relevant registration record. Government offices and other entities may provide equivalent official-source evidence. Permit and representative documents are conditional as shown above.</p></div></div>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend>Evidence documents</legend>
        <ul className="mini-list">{requiredEvidence.length ? requiredEvidence.map((type) => <li key={type}><FileCheck2 size={16} aria-hidden="true" /><span>{documentLabels[type]} <strong>({hasRequiredEvidence(type) ? 'uploaded' : 'required'})</strong></span></li>) : <li>Choose a business type to see the relevant evidence requirements.</li>}
          {freshEvidence.businessRecord ? <li><FileCheck2 size={16} aria-hidden="true" /><span>New business-registration or official-source evidence for this identity change <strong>(required)</strong></span></li> : null}
          {freshEvidence.localPermit ? <li><FileCheck2 size={16} aria-hidden="true" /><span>Current local permit for this change <strong>(required)</strong></span></li> : null}
          {freshEvidence.representativeAuthorization ? <li><FileCheck2 size={16} aria-hidden="true" /><span>Current representative authorization for this change <strong>(required)</strong></span></li> : null}
        </ul>
        <div className="field-grid two">
          <label className="field" htmlFor="verification-document-type"><span>Document type</span><select className="select" id="verification-document-type" value={documentType} onChange={(event) => setDocumentType(event.target.value as EmployerVerificationDocumentType)} disabled={!canEdit}>{EMPLOYER_VERIFICATION_DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{documentLabels[type]}</option>)}</select></label>
          <label className="field" htmlFor="verification-document-file"><span>Choose a file</span><input ref={fileInputRef} className="input" id="verification-document-file" type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} disabled={!canEdit} /><small>PDF, JPG, PNG, or WebP; maximum 4 MB. Do not upload government IDs.</small></label>
        </div>
        <button className="button secondary small" type="button" onClick={() => void uploadEvidence()} disabled={!canEdit || uploading || !file}><Upload size={15} aria-hidden="true" /> {uploading ? 'Uploading privately…' : 'Upload evidence'}</button>
      </fieldset>
      {data?.documents.length ? <div><h3>Uploaded documents</h3><ul className="mini-list">{data.documents.map((document) => <li key={document.id}><FileCheck2 size={16} aria-hidden="true" /><div><strong>{documentLabels[document.document_type]}</strong><span>{Math.ceil(document.byte_size / 1024)} KB / {displayDate(document.uploaded_at)}{document.submission_id ? ' / submitted' : ' / ready to submit'}</span></div>{document.signed_url ? <a className="text-link" href={document.signed_url} target="_blank" rel="noreferrer">Open private file</a> : <span className="field-help">Refresh to request a new short-lived link.</span>}</li>)}</ul></div> : <p className="field-help">No files uploaded yet.</p>}
      {status === 'approved' ? <p className="field-help">Changes to business identity, registration, address, representative, or submitted evidence trigger re-review and close published jobs. Contact and website changes retain approval.</p> : null}
      {canEdit ? <button className="button" type="submit" disabled={pending}>{pending ? 'Saving…' : status === 'approved' ? 'Save verification changes' : status === 'rejected' ? 'Correct information and resubmit' : 'Submit for review'}</button> : null}
    </form>
    {data?.submissions.length ? <div className="field-help">Submission history: {data.submissions.map((submission) => `#${submission.submission_number} (${displayDate(submission.submitted_at)})`).join(' / ')}</div> : null}
  </section>;
}
