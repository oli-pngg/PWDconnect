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

  useEffect(() => {
    fetch('/api/jobs?mine=true', { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json() as { jobs?: Job[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to load openings.');
      setJobs(payload.jobs ?? []);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load openings.')).finally(() => setLoading(false));
  }, []);

  return <><div className="page-heading"><div><p className="eyebrow">Employer workspace</p><h1>Openings with intention.</h1><p>Clear, specific requirements help the right candidates recognize themselves in your work.</p></div><Link className="button" href="/employer/jobs/new"><FilePlus2 size={16} aria-hidden="true" /> Post an opening</Link></div>{error ? <div className="form-error" role="alert">{error}</div> : null}{loading ? <JobListSkeleton /> : jobs.length ? <div className="job-list">{jobs.map((job) => <article className="job-card" key={job.id}><div className="job-card-header"><div><h2>{job.title}</h2><p className="job-company"><StatusPill status={job.status} /></p><p>{job.description}</p></div><div className="job-details"><span><MapPin size={14} aria-hidden="true" />{job.location}</span><span>{job.work_mode}</span></div></div><div className="job-footer"><div className="job-details"><span>{job.employment_type}</span><span>{job.job_skills?.length ?? 0} required skills</span></div><Link className="button secondary small" href="/employer/candidates">Review matches</Link></div></article>)}</div> : <div className="empty-state"><h3>You have no openings yet.</h3><p>Create a draft to refine the requirements, or publish it to make it visible to candidates.</p><Link className="button small" href="/employer/jobs/new">Create your first opening</Link></div>}</>;
}
