import { getAuthenticatedContext } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { rankJobs } from '@/lib/matching';
import { getCandidateSkills, getVisibleJobs } from '@/lib/server-data';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  const limited = checkRateLimit(request, 'dashboard-read', { limit: 60, windowMs: 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const { data: profile, error: profileError } = await supabase.from('profiles').select('id, role, full_name, organization_name, location, headline, availability, years_experience').eq('id', user.id).maybeSingle();
    if (profileError || !profile) return jsonError('Profile not found.', 404);

    if (profile.role === 'candidate') {
      const [jobs, skills, applicationsResult, attemptResult] = await Promise.all([
        getVisibleJobs(supabase, { userId: user.id }),
        getCandidateSkills(supabase, user.id),
        supabase.from('applications').select('id, job_id, status, fit_score, created_at, jobs(title)').eq('candidate_id', user.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('assessment_attempts').select('score, total_points, completed_at').eq('candidate_id', user.id).order('completed_at', { ascending: false }).limit(1).maybeSingle()
      ]);
      const ranked = rankJobs(jobs, skills, profile.location ?? undefined).filter((job) => (job.fit_score ?? 0) >= 40).slice(0, 4);
      const ids = ranked.map((job) => job.id);
      const { data: existingApplications } = ids.length ? await supabase.from('applications').select('job_id, status').eq('candidate_id', user.id).in('job_id', ids) : { data: [] };
      const applicationMap = new Map((existingApplications ?? []).map((application) => [application.job_id, application.status]));
      return jsonOk({
        role: 'candidate',
        profile,
        stats: { skills: skills.length, applications: (applicationsResult.data ?? []).length, assessment: attemptResult.data?.total_points ? Math.round((attemptResult.data.score / attemptResult.data.total_points) * 100) : 0, matches: ranked.length },
        recommendations: ranked.map((job) => ({ ...job, application_status: applicationMap.get(job.id) ?? null })),
        applications: applicationsResult.data ?? [],
        latestAssessment: attemptResult.data ?? null
      });
    }

    if (profile.role === 'admin') {
      const admin = createSupabaseAdminClient();
      const [users, jobs, applications, assessments] = await Promise.all([
        admin.from('profiles').select('id', { count: 'exact', head: true }),
        admin.from('jobs').select('id', { count: 'exact', head: true }),
        admin.from('applications').select('id', { count: 'exact', head: true }),
        admin.from('assessment_attempts').select('id', { count: 'exact', head: true })
      ]);
      if (users.error || jobs.error || applications.error || assessments.error) return jsonError('Unable to load research dashboard.', 500);
      return jsonOk({ role: 'admin', profile, stats: { users: users.count ?? 0, jobs: jobs.count ?? 0, applications: applications.count ?? 0, assessments: assessments.count ?? 0 } });
    }

    const { data: jobs, error: jobsError } = await supabase.from('jobs').select('id, title, status, created_at').eq('employer_id', user.id).order('created_at', { ascending: false });
    if (jobsError) return jsonError('Unable to load employer dashboard.', 500);
    const jobIds = (jobs ?? []).map((job) => job.id);
    const { data: applications } = jobIds.length ? await supabase.from('applications').select('id, job_id, fit_score, status, matched_skills, created_at').in('job_id', jobIds).order('fit_score', { ascending: false }).limit(12) : { data: [] };
    return jsonOk({
      role: profile.role,
      profile,
      stats: { jobs: jobs?.length ?? 0, published: (jobs ?? []).filter((job) => job.status === 'published').length, applicants: applications?.length ?? 0, shortlisted: (applications ?? []).filter((application) => application.status === 'shortlisted' || application.status === 'interview').length },
      jobs: jobs ?? [],
      applications: applications ?? []
    });
  } catch {
    return jsonError('Unable to load the dashboard.', 500);
  }
}
