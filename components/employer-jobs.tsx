'use client';

import { FilePlus2, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { JobListSkeleton } from '@/components/skeleton';
import { StatusPill } from '@/components/status-pill';
import type { Job } from '@/lib/types';

export function EmployerJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    fetch('/api/jobs?mine=true', { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json() as { jobs?: Job[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to load openings.');
      setJobs(payload.jobs ?? []);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load openings.')).finally(() => setLoading(false));
  }, []);

  async function updateStatus(id: string, status: 'published' | 'closed') {
    setBusyId(id);
    setError('');
    try {
      const response = await fetch(`/api/jobs/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      const payload = await response.json() as { job?: { status: Job['status'] }; error?: string };
      if (!response.ok || !payload.job) throw new Error(payload.error || 'Unable to update opening.');
      setJobs((current) => current.map((job) => job.id === id ? { ...job, status: payload.job!.status } : job));
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Unable to update opening.');
    } finally {
      setBusyId('');
    }
  }

  return <><div className="page-heading"><div><p className="eyebrow">Employer workspace</p><h1>Openings</h1></div><Link className="button" href="/employer/jobs/new"><FilePlus2 size={16} aria-hidden="true" /> Post opening</Link></div>{error ? <div className="form-error" role="alert">{error}</div> : null}{loading ? <JobListSkeleton /> : jobs.length ? <div className="job-list">{jobs.map((job) => <article className="job-card" key={job.id}><div className="job-card-header"><div><h2>{job.title}</h2><p className="job-company"><StatusPill status={job.status} /></p><p>{job.description}</p></div><div className="job-details"><span><MapPin size={14} aria-hidden="true" />{job.location}</span><span>{job.work_mode}</span></div></div><div className="job-footer"><div className="job-details"><span>{job.employment_type}</span><span>{job.assessment_category} assessment</span><span>{job.job_skills?.length ?? 0} skills</span></div><div className="button-row"><Link className="button secondary small" href="/employer/candidates">Matches</Link>{job.status === 'draft' ? <button className="button small" type="button" disabled={busyId === job.id} onClick={() => void updateStatus(job.id, 'published')}>{busyId === job.id ? 'Publishing...' : 'Publish'}</button> : job.status === 'published' ? <button className="button secondary small" type="button" disabled={busyId === job.id} onClick={() => void updateStatus(job.id, 'closed')}>{busyId === job.id ? 'Closing...' : 'Close'}</button> : null}</div></div></article>)}</div> : <div className="empty-state"><h3>No openings yet.</h3><p>Post a role with required skills and an accessible assessment.</p><Link className="button small" href="/employer/jobs/new">Post opening</Link></div>}</>;
}
