'use client';

import { BriefcaseBusiness, CheckCircle2, Clock3, MapPin, Search, SlidersHorizontal } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { JobListSkeleton } from '@/components/skeleton';
import { StatusPill } from '@/components/status-pill';
import type { Job, UserRole } from '@/lib/types';

function one<T>(value: T | T[] | null | undefined) { return Array.isArray(value) ? value[0] : value; }

function JobCard({ job, canApply, onApply }: { job: Job; canApply: boolean; onApply: (jobId: string) => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const skills = (job.job_skills ?? []).map((jobSkill) => one(jobSkill.skills)).filter(Boolean).slice(0, 5);
  const isApplied = Boolean(job.application_status);

  async function apply() {
    setPending(true);
    setMessage('');
    try {
      await onApply(job.id);
      setMessage('Application submitted.');
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : 'Unable to apply.');
    } finally {
      setPending(false);
    }
  }

  return <article className={`job-card ${job.fit_score && job.fit_score >= 75 ? 'featured' : ''}`}>
    <div className="job-card-header"><div><h2>{job.title}</h2><p className="job-company">{job.organization_name ?? 'PWD Connect employer'}</p><p>{job.description}</p></div>{typeof job.fit_score === 'number' ? <div className="fit-score large" aria-label={`${job.fit_score} percent fit`}>{job.fit_score}%</div> : null}</div>
    <div className="job-tags">{skills.map((skill) => skill ? <span className="tag" key={skill.id}>{skill.name}</span> : null)}{job.accommodations ? <span className="tag verified"><CheckCircle2 size={13} aria-hidden="true" /> Accommodations listed</span> : null}</div>
    {job.match_reason ? <p className="notice"><strong>Why this match:</strong> {job.match_reason}</p> : null}
    <div className="job-footer"><div className="job-details"><span><MapPin size={14} aria-hidden="true" />{job.location}</span><span><BriefcaseBusiness size={14} aria-hidden="true" />{job.work_mode}</span><span><Clock3 size={14} aria-hidden="true" />{job.employment_type}</span></div>{canApply ? <div><div className="sr-status" aria-live="polite">{message}</div>{isApplied ? <StatusPill status={job.application_status!} /> : <button className="button small" type="button" disabled={pending} onClick={apply}>{pending ? 'Submitting...' : 'Apply with my profile'}</button>}</div> : null}</div>
  </article>;
}

export function JobsBrowser({ role }: { role: UserRole }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [workMode, setWorkMode] = useState('All work modes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadJobs() {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ search: submittedSearch, workMode, ...(role === 'employer' ? { mine: 'true' } : {}) });
      try {
        const response = await fetch(`/api/jobs?${params.toString()}`, { cache: 'no-store' });
        const payload = await response.json() as { jobs?: Job[]; error?: string };
        if (!response.ok) throw new Error(payload.error || 'Unable to load jobs.');
        let nextJobs = payload.jobs ?? [];
        if (role === 'candidate') {
          const recommendations = await fetch('/api/recommendations', { cache: 'no-store' });
          if (recommendations.ok) {
            const recommendationPayload = await recommendations.json() as { jobs?: Job[] };
            const byId = new Map((recommendationPayload.jobs ?? []).map((job) => [job.id, job]));
            nextJobs = nextJobs.map((job) => ({ ...job, ...(byId.get(job.id) ?? {}) }));
          }
        }
        setJobs(nextJobs);
      } catch (reason: unknown) {
        setError(reason instanceof Error ? reason.message : 'Unable to load jobs.');
      } finally {
        setLoading(false);
      }
    }
    void loadJobs();
  }, [submittedSearch, workMode, role]);

  async function apply(jobId: string) {
    const response = await fetch(`/api/jobs/${jobId}/apply`, { method: 'POST' });
    const payload = await response.json() as { error?: string };
    if (!response.ok) throw new Error(payload.error || 'Unable to apply.');
    setJobs((current) => current.map((job) => job.id === jobId ? { ...job, application_status: 'submitted' } : job));
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
  }

  const heading = role === 'employer' ? 'Your openings' : 'Find work that fits';
  const description = role === 'employer' ? 'See every opening owned by your authenticated organization.' : 'Search local opportunities ranked by the evidence in your profile.';
  const workModes = useMemo(() => ['All work modes', 'On-site', 'Hybrid', 'Remote', 'Flexible'], []);

  return <>
    <div className="page-heading"><div><p className="eyebrow">{role === 'employer' ? 'Hiring workspace' : 'Opportunity board'}</p><h1>{heading}</h1><p>{description}</p></div>{role === 'employer' ? <a className="button" href="/employer/jobs/new">Post an opening</a> : null}</div>
    <form className="toolbar" onSubmit={submitSearch} role="search"><Search size={18} aria-hidden="true" /><label className="sr-only" htmlFor="job-search">Search job titles</label><input className="input" id="job-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search job titles" /><label className="sr-only" htmlFor="work-mode">Filter by work mode</label><select className="select" id="work-mode" value={workMode} onChange={(event) => setWorkMode(event.target.value)}>{workModes.map((mode) => <option key={mode}>{mode}</option>)}</select><button className="button small" type="submit"><SlidersHorizontal size={15} aria-hidden="true" /> Filter</button></form>
    {error ? <div className="form-error" role="alert">{error}</div> : null}
    {loading ? <JobListSkeleton /> : jobs.length ? <div className="job-list" aria-live="polite">{jobs.map((job) => <JobCard key={job.id} job={job} canApply={role === 'candidate'} onApply={apply} />)}</div> : <div className="empty-state"><h3>{role === 'employer' ? 'No openings match that filter.' : 'No openings match yet.'}</h3><p>{role === 'employer' ? 'Create a draft or publish a new opening to see it here.' : 'Try another search, or complete your profile so future matches have more context.'}</p></div>}
  </>;
}
