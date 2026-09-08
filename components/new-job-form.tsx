'use client';

import { ArrowLeft, CheckCircle2, FilePlus2 } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import type { Skill } from '@/lib/types';

export function NewJobForm() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [form, setForm] = useState({ title: '', description: '', location: 'Legazpi City, Albay', workMode: 'Flexible', employmentType: 'Full-time', salaryMin: '', salaryMax: '', accommodations: '', status: 'draft' });
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetch('/api/skills', { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json() as { skills?: Skill[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to load skills.');
      setSkills(payload.skills ?? []);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load skills.')).finally(() => setLoading(false));
  }, []);

  function setField(field: keyof typeof form, value: string) { setForm((current) => ({ ...current, [field]: value })); }
  function toggleSkill(id: string) { setSelectedSkills((current) => current.includes(id) ? current.filter((skillId) => skillId !== id) : [...current, id]); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!form.title.trim() || form.title.trim().length < 3) { setError('Enter a job title with at least 3 characters.'); return; }
    if (!form.description.trim() || form.description.trim().length < 20) { setError('Add a description with at least 20 characters.'); return; }
    if (!selectedSkills.length) { setError('Select at least one required skill.'); return; }
    if (form.salaryMin && form.salaryMax && Number(form.salaryMin) > Number(form.salaryMax)) { setError('The minimum salary cannot be greater than the maximum salary.'); return; }
    setPending(true);
    try {
      const response = await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, salaryMin: Number(form.salaryMin), salaryMax: Number(form.salaryMax), skillIds: selectedSkills }) });
      const payload = await response.json() as { jobId?: string; error?: string };
      if (!response.ok) setError(payload.error || 'Unable to create opening.');
      else { setSuccess(form.status === 'published' ? 'Opening published. Candidates can now discover it.' : 'Draft saved. You can publish it when the requirements are ready.'); setForm((current) => ({ ...current, title: '', description: '', accommodations: '' })); setSelectedSkills([]); }
    } catch {
      setError('The server could not be reached. Check that the development server is running, then try again.');
    } finally {
      setPending(false);
    }
  }

  if (loading) return <div className="panel"><span className="skeleton skeleton-title" /></div>;
  return <><div className="page-heading"><div><p className="eyebrow">New opening</p><h1>Describe the work, clearly.</h1><p>Specific skills and accommodations help the matching system stay fair and useful.</p></div><Link className="button secondary small" href="/employer/jobs"><ArrowLeft size={15} aria-hidden="true" /> Back to openings</Link></div><form className="panel form-stack" onSubmit={submit} noValidate><div className="panel-header"><div><h2>Opening details</h2><p>Keep the focus on tasks, outcomes, and support.</p></div><FilePlus2 size={20} aria-hidden="true" /></div><div className="field-grid two"><label className="field" htmlFor="job-title"><span>Job title</span><input className="input" id="job-title" value={form.title} onChange={(event) => setField('title', event.target.value)} maxLength={120} minLength={3} required placeholder="For example: Customer support assistant" /></label><label className="field" htmlFor="employment-type"><span>Employment type</span><select className="select" id="employment-type" value={form.employmentType} onChange={(event) => setField('employmentType', event.target.value)}><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option></select></label></div><label className="field" htmlFor="job-description"><span>What will this person do?</span><textarea className="textarea" id="job-description" value={form.description} onChange={(event) => setField('description', event.target.value)} minLength={20} maxLength={5000} required placeholder="List the regular tasks, expected outcomes, and tools. Avoid requirements that are not needed for the work." /></label><div className="field-grid two"><label className="field" htmlFor="job-location"><span>Location</span><input className="input" id="job-location" value={form.location} onChange={(event) => setField('location', event.target.value)} maxLength={120} /></label><label className="field" htmlFor="job-work-mode"><span>Work mode</span><select className="select" id="job-work-mode" value={form.workMode} onChange={(event) => setField('workMode', event.target.value)}><option>Flexible</option><option>On-site</option><option>Hybrid</option><option>Remote</option></select></label></div><fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}><legend>Required skills</legend><p className="field-help">These skills power the transparent fit score. Select only skills that are genuinely needed.</p><div className="skill-picker">{skills.map((skill) => <label key={skill.id} title={skill.category}><input type="checkbox" checked={selectedSkills.includes(skill.id)} onChange={() => toggleSkill(skill.id)} /> <span>{skill.name}</span></label>)}</div></fieldset><label className="field" htmlFor="job-accommodations"><span>Accommodations and accessible process</span><textarea className="textarea" id="job-accommodations" value={form.accommodations} onChange={(event) => setField('accommodations', event.target.value)} maxLength={1000} placeholder="For example: captions provided, keyboard-friendly tools, flexible interview format, or extra response time." /></label><div className="field-grid two"><label className="field" htmlFor="salary-min"><span>Minimum monthly pay <small>(optional)</small></span><input className="input" id="salary-min" type="number" min="0" value={form.salaryMin} onChange={(event) => setField('salaryMin', event.target.value)} /></label><label className="field" htmlFor="salary-max"><span>Maximum monthly pay <small>(optional)</small></span><input className="input" id="salary-max" type="number" min="0" value={form.salaryMax} onChange={(event) => setField('salaryMax', event.target.value)} /></label></div><fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}><legend>Publishing status</legend><div className="role-grid"><div className="role-option"><input id="job-draft" type="radio" name="status" value="draft" checked={form.status === 'draft'} onChange={(event) => setField('status', event.target.value)} /><label htmlFor="job-draft"><strong>Save draft</strong><span>Only your organization can see it.</span></label></div><div className="role-option"><input id="job-published" type="radio" name="status" value="published" checked={form.status === 'published'} onChange={(event) => setField('status', event.target.value)} /><label htmlFor="job-published"><strong>Publish now</strong><span>Make it visible to candidates.</span></label></div></div></fieldset>{error ? <div className="form-error" role="alert">{error}</div> : null}{success ? <div className="form-success" role="status"><CheckCircle2 size={16} aria-hidden="true" /> {success}</div> : null}<div className="button-row"><button className="button" type="submit" disabled={pending}>{pending ? 'Saving...' : form.status === 'published' ? 'Publish opening' : 'Save draft'} <FilePlus2 size={16} aria-hidden="true" /></button><span className="field-help">You can update requirements later through your database admin or a future edit flow.</span></div></form></>;
}
