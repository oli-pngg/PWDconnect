import { getAuthenticatedContext } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { rankJobs } from '@/lib/matching';
import { getCandidateSkills, getVisibleJobs } from '@/lib/server-data';

export async function GET(request: Request) {
  const limited = checkRateLimit(request, 'recommendations-read', { limit: 60, windowMs: 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const { data: profile } = await supabase.from('profiles').select('role, location').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'candidate') return jsonError('Recommendations are available to candidate accounts.', 403);
    const [jobs, skills] = await Promise.all([
      getVisibleJobs(supabase, { userId: user.id }),
      getCandidateSkills(supabase, user.id)
    ]);
    const ranked = rankJobs(jobs, skills, profile.location ?? undefined).filter((job) => (job.fit_score ?? 0) >= 40).slice(0, 8);
    const ids = ranked.map((job) => job.id);
    const { data: applications } = ids.length ? await supabase.from('applications').select('job_id, status').eq('candidate_id', user.id).in('job_id', ids) : { data: [] };
    const applicationMap = new Map((applications ?? []).map((application) => [application.job_id, application.status]));
    return jsonOk({ jobs: ranked.map((job) => ({ ...job, application_status: applicationMap.get(job.id) ?? null })) });
  } catch {
    return jsonError('Unable to load recommendations.', 500);
  }
}
