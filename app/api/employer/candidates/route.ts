import { getAuthenticatedContext } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import type { CandidatePreview } from '@/lib/types';

function candidateReference(candidateId: string) {
  return `Candidate ${candidateId.replace(/-/g, '').slice(0, 4).toUpperCase()}`;
}

export async function GET(request: Request) {
  const limited = checkRateLimit(request, 'candidate-pool-read', { limit: 60, windowMs: 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'employer') return jsonError('Only employer accounts can view candidate matches.', 403);

    const { data: jobs, error: jobsError } = await supabase.from('jobs').select('id, title').eq('employer_id', user.id);
    if (jobsError) return jsonError('Unable to load your openings.', 500);
    const jobIds = (jobs ?? []).map((job) => job.id);
    if (!jobIds.length) return jsonOk({ candidates: [] as CandidatePreview[] });
    const jobTitleMap = new Map((jobs ?? []).map((job) => [job.id, job.title]));
    const { data: applications, error } = await supabase.from('applications').select('id, job_id, candidate_id, fit_score, matched_skills, status, created_at').in('job_id', jobIds).order('fit_score', { ascending: false });
    if (error) return jsonError('Unable to load candidate matches.', 500);

    const candidates = (applications ?? []).map((application) => ({
      application_id: application.id,
      job_id: application.job_id,
      job_title: jobTitleMap.get(application.job_id) ?? 'Opening',
      candidate_ref: candidateReference(application.candidate_id),
      fit_score: Number(application.fit_score),
      matched_skills: application.matched_skills ?? [],
      status: application.status,
      created_at: application.created_at
    })) as CandidatePreview[];
    return jsonOk({ candidates });
  } catch {
    return jsonError('Unable to load candidate matches.', 500);
  }
}
