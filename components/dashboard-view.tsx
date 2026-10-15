'use client';

import { ArrowUpRight, BriefcaseBusiness, CheckCircle2, FileText, MapPin, Sparkles, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DashboardSkeleton } from '@/components/skeleton';
import { StatusPill } from '@/components/status-pill';
import { RAND36_SCALES } from '@/lib/rand36';
import type { Job } from '@/lib/types';

type DashboardData = {
  role: 'candidate' | 'employer' | 'admin';
  profile: { full_name: string; organization_name?: string | null; location?: string | null };
  stats: Record<string, number>;
  recommendations?: Job[];
  applications?: Array<{ id: string; job_id?: string; status: string; fit_score: number; created_at: string; jobs?: { title?: string } | null; matched_skills?: string[] }>;
  latestAssessment?: { score: number; total_points: number; completed_at: string } | null;
  jobs?: Array<{ id: string; title: string; status: string; created_at: string }>;
};

type Rand36Summary = {
  consentGranted?: boolean;
  latestAttempt?: {
    health_change_response: number | null;
    health_change_score: number | null;
    scales: Array<{ scale_code: string; score: number | null; answered_items: number; item_count: number }>;
  } | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function StatCard({ label, value, note }: { label: string; value: number | string; note: string }) {
  return <article className="stat-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function CandidateDashboard({ data, rand36, rand36Unavailable }: { data: DashboardData; rand36: Rand36Summary | null; rand36Unavailable: boolean }) {
  const profileName = data.profile.full_name || 'there';
  const recommendations = data.recommendations ?? [];
  const applications = data.applications ?? [];
  return (
    <>
       <div className="page-heading"><div><p className="eyebrow">Workspace</p><h1>Welcome back, {profileName.split(' ')[0]}.</h1></div><Link className="button" href="/jobs">Find work <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
      <div className="stat-grid">
        <StatCard label="Recommended fits" value={data.stats.matches ?? 0} note="based on your current skills" />
        <StatCard label="Verified skills" value={data.stats.skills ?? 0} note="assessment evidence" />
        <StatCard label="Applications" value={data.stats.applications ?? 0} note="recent applications" />
        <StatCard label="Occupational quiz" value={`${data.stats.assessment ?? 0}%`} note={data.latestAssessment ? 'latest attempt' : 'not completed'} />
      </div>
       <div className="content-grid">
         <section className="panel" aria-labelledby="recommendations-heading"><div className="panel-header"><div><h2 id="recommendations-heading">Recommended for your strengths</h2><p>Ranked by skill overlap, verification, and location preference.</p></div><Link className="text-link" href="/jobs">View all</Link></div>{recommendations.length ? <div className="match-list">{recommendations.map((job) => <div className="match-item" key={job.id}><div><h3>{job.title}</h3><p>{job.organization_name ?? 'PWD Connect employer'} / {job.work_mode}</p><div className="match-meta"><span>{job.matched_skills?.slice(0, 3).join(', ') || 'Skill profile needed'}</span><span>{job.application_status ? <StatusPill status={job.application_status} /> : 'Open to applications'}</span></div></div><div className="fit-score" aria-label={`${job.fit_score ?? 0} percent fit`}>{job.fit_score ?? 0}%</div></div>)}</div> : <div className="empty-state"><h3>Your first recommendations are waiting.</h3><p>Complete the accessible skill assessment to unlock evidence-based matches.</p><Link className="button small" href="/assessment">Take assessment</Link></div>}</section>
         <aside className="panel panel-accent" aria-labelledby="next-step-heading"><div className="panel-header"><div><p className="eyebrow">Next step</p><h2 id="next-step-heading">Strengthen your match.</h2></div><Sparkles size={22} aria-hidden="true" /></div><p className="muted">Verified skills improve job matches.</p><ul className="mini-list"><li><CheckCircle2 size={17} aria-hidden="true" /><div><strong>Assessment</strong><span>{data.latestAssessment ? `Last: ${formatDate(data.latestAssessment.completed_at)}` : 'No timer'}</span></div></li><li><MapPin size={17} aria-hidden="true" /><div><strong>{data.profile.location || 'Set location'}</strong><span>Local matches</span></div></li><li><FileText size={17} aria-hidden="true" /><div><strong>Profile</strong><span>Work conditions</span></div></li></ul><Link className="button secondary" href={data.latestAssessment ? '/profile' : '/assessment'}>{data.latestAssessment ? 'Review profile' : 'Take assessment'} <ArrowUpRight size={15} aria-hidden="true" /></Link></aside>
       </div>
       <section className="panel" style={{ marginTop: 18 }} aria-labelledby="rand36-overview-heading">
         <div className="panel-header"><div><h2 id="rand36-overview-heading">RAND-36 health scales</h2><p>Separate health-related quality-of-life results. Not used to rank jobs.</p></div><Link className="text-link" href="/assessment">Open assessments</Link></div>
          {rand36Unavailable ? <p className="notice" role="status">RAND-36 results are unavailable until the database migration is applied.</p> : rand36?.latestAttempt ? <><div className="table-wrap"><table className="data-table"><caption className="sr-only">RAND-36 Version 1.0 scale scores, with higher values indicating more favorable health status</caption><thead><tr><th scope="col">Scale</th><th scope="col">Score / 100</th><th scope="col">Items answered</th></tr></thead><tbody>{rand36.latestAttempt.scales.map((scale) => <tr key={scale.scale_code}><th scope="row">{RAND36_SCALES.find((item) => item.code === scale.scale_code)?.label ?? scale.scale_code}</th><td data-label="Score / 100">{scale.score == null ? 'Not scored' : Number(scale.score).toFixed(2)}</td><td data-label="Items answered">{scale.answered_items} / {scale.item_count}</td></tr>)}</tbody></table></div><p className="field-help">Health change compared with one year ago: {rand36.latestAttempt.health_change_score == null ? 'Not answered' : `${Number(rand36.latestAttempt.health_change_score).toFixed(2)} / 100 (separate item)`}. No overall score is calculated.</p></> : <div className="empty-state"><h3>No RAND-36 result yet.</h3><p>This voluntary health survey is separate from occupational skills.</p><Link className="button secondary small" href="/assessment">Review assessments</Link></div>}
       </section>
         <section className="panel" style={{ marginTop: 18 }} aria-labelledby="applications-heading"><div className="panel-header"><div><h2 id="applications-heading">Recent applications</h2><p>Only you can access the details of your applications.</p></div><BriefcaseBusiness size={20} aria-hidden="true" /></div>{applications.length ? <div className="table-wrap"><table className="data-table" aria-label="Recent applications"><thead><tr><th scope="col">Opening</th><th scope="col">Fit</th><th scope="col">Status</th><th scope="col">Applied</th><th scope="col"><span className="sr-only">Conversation</span></th></tr></thead><tbody>{applications.map((application) => <tr key={application.id}><td data-label="Opening"><strong>{application.jobs?.title ?? 'Opening'}</strong></td><td data-label="Fit">{Math.round(Number(application.fit_score))}%</td><td data-label="Status"><StatusPill status={application.status} /></td><td data-label="Applied">{formatDate(application.created_at)}</td><td data-label="Messages"><Link className="text-link" href={`/applications/${application.id}`}>Open messages</Link></td></tr>)}</tbody></table></div> : <div className="empty-state"><h3>No applications yet.</h3><p>Your application history will appear here after you apply to an opening.</p><Link className="button secondary small" href="/jobs">Browse jobs</Link></div>}</section>
    </>
  );
}

function EmployerDashboard({ data }: { data: DashboardData }) {
  const jobs = data.jobs ?? [];
  const applications = data.applications ?? [];
  return (
    <>
      <div className="page-heading"><div><p className="eyebrow">Employer workspace</p><h1>Make room for better fits.</h1></div><Link className="button" href="/employer/jobs/new">Post an opening <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
      <div className="stat-grid"><StatCard label="Your openings" value={data.stats.jobs ?? 0} note="draft and published" /><StatCard label="Published" value={data.stats.published ?? 0} note="visible to candidates" /><StatCard label="Candidate matches" value={data.stats.applicants ?? 0} note="skills-first previews" /><StatCard label="In progress" value={data.stats.shortlisted ?? 0} note="shortlisted or interview" /></div>
      <div className="content-grid">
        <section className="panel" aria-labelledby="openings-heading"><div className="panel-header"><div><h2 id="openings-heading">Your openings</h2><p>Keep requirements specific and accommodation-ready.</p></div><Link className="text-link" href="/employer/jobs">Manage all</Link></div>{jobs.length ? <ul className="mini-list">{jobs.slice(0, 5).map((job) => <li key={job.id}><BriefcaseBusiness size={17} aria-hidden="true" /><div><strong>{job.title}</strong><span><StatusPill status={job.status} /> / posted {formatDate(job.created_at)}</span></div></li>)}</ul> : <div className="empty-state"><h3>Your first opening starts here.</h3><p>Describe the work, the skills, and the accommodations that make success possible.</p><Link className="button small" href="/employer/jobs/new">Create opening</Link></div>}</section>
        <section className="panel panel-accent" aria-labelledby="fair-hiring-heading"><div className="panel-header"><div><p className="eyebrow">Fair hiring cue</p><h2 id="fair-hiring-heading">Start with evidence, not assumptions.</h2></div><UsersRound size={22} aria-hidden="true" /></div><p className="muted">Initial candidate previews hide names and disability information. Review verified skills and the fit explanation before deciding whether to reveal more.</p><Link className="button secondary" href="/employer/candidates">Review candidates <ArrowUpRight size={15} aria-hidden="true" /></Link></section>
      </div>
      <section className="panel" style={{ marginTop: 18 }} aria-labelledby="employer-applications-heading"><div className="panel-header"><div><h2 id="employer-applications-heading">Latest candidate signals</h2><p>Candidate references remain pseudonymous during initial screening.</p></div><Link className="text-link" href="/employer/candidates">Open candidate pool</Link></div>{applications.length ? <div className="candidate-list">{applications.slice(0, 6).map((application) => <div className="candidate-row" key={application.id}><div><h3>Candidate preview / {Math.round(Number(application.fit_score))}% fit</h3><p>{application.matched_skills?.slice(0, 4).join(', ') || 'Skills profile available'} / received {formatDate(application.created_at)}</p></div><StatusPill status={application.status} /><Link className="button secondary small" href="/employer/candidates">Review</Link></div>)}</div> : <div className="empty-state"><h3>No candidate activity yet.</h3><p>Publish an opening and the skills-first application pool will appear here.</p></div>}</section>
    </>
  );
}

function AdminDashboard({ data }: { data: DashboardData }) {
  return <><div className="page-heading"><div><p className="eyebrow">Research workspace</p><h1>Keep the pilot accountable.</h1><p>Review the platform against functional suitability, performance efficiency, and interaction capability.</p></div><Link className="button" href="/admin/evaluation">Open evaluation <ArrowUpRight size={16} aria-hidden="true" /></Link></div><div className="stat-grid"><StatCard label="Users" value={data.stats.users ?? 0} note="all account roles" /><StatCard label="Jobs" value={data.stats.jobs ?? 0} note="platform records" /><StatCard label="Applications" value={data.stats.applications ?? 0} note="matching outcomes" /><StatCard label="Assessments" value={data.stats.assessments ?? 0} note="completed attempts" /></div><section className="panel panel-accent"><div className="panel-header"><div><p className="eyebrow">Evaluation loop</p><h2>Measure, test with users, improve.</h2></div><Sparkles size={22} aria-hidden="true" /></div><p className="muted">Automated metrics are a starting point. Use the evaluation workspace alongside keyboard-only checks, screen-reader sessions, and feedback from PWD participants.</p><Link className="button secondary" href="/admin/evaluation">Review ISO 25010 signals <ArrowUpRight size={15} aria-hidden="true" /></Link></section></>;
}

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [rand36, setRand36] = useState<Rand36Summary | null>(null);
  const [rand36Unavailable, setRand36Unavailable] = useState(false);

  useEffect(() => {
    let active = true;
    const startedAt = performance.now();
    fetch('/api/dashboard', { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json() as DashboardData & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to load dashboard.');
      void fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventName: 'dashboard_load', durationMs: Math.round(performance.now() - startedAt) }) });
      if (active) setData(payload);
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load dashboard.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (data?.role !== 'candidate') return;
    let active = true;
    fetch('/api/rand36', { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json() as Rand36Summary & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'RAND-36 unavailable.');
      if (active) setRand36(payload);
    }).catch(() => {
      if (active) setRand36Unavailable(true);
    });
    return () => { active = false; };
  }, [data?.role]);

  if (error) return <div className="form-error" role="alert">{error}</div>;
  if (!data) return <DashboardSkeleton />;
  return data.role === 'candidate' ? <CandidateDashboard data={data} rand36={rand36} rand36Unavailable={rand36Unavailable} /> : data.role === 'admin' ? <AdminDashboard data={data} /> : <EmployerDashboard data={data} />;
}
