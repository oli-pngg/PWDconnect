import { getAuthenticatedContext } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { calculateFitScore } from '@/lib/matching';
import { getCandidateSkills } from '@/lib/server-data';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Job } from '@/lib/types';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const limited = checkRateLimit(_request, 'job-application-write', { limit: 15, windowMs: 60 * 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError('Invalid opening.', 400);
    const { data: profile } = await supabase.from('profiles').select('role, location').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'candidate') return jsonError('Only candidate accounts can apply.', 403);

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, employer_id, title, description, location, work_mode, employment_type, salary_min, salary_max, accommodations, status, created_at, job_skills(skill_id, required_level, importance, skills(id, slug, name, category))')
      .eq('id', id)
      .eq('status', 'published')
      .maybeSingle();
    if (jobError || !job) return jsonError('This opening is no longer available.', 404);

    const skills = await getCandidateSkills(supabase, user.id);
    const fit = calculateFitScore(job as unknown as Job, skills, profile.location ?? undefined);
    const admin = createSupabaseAdminClient();
    const { data: application, error: applicationError } = await admin.from('applications').insert({
      job_id: id,
      candidate_id: user.id,
      fit_score: fit.score,
      matched_skills: fit.matched
    } as never).select('id, status, fit_score').single();
    if (applicationError) {
      if (applicationError.code === '23505') return jsonError('You already applied to this opening.', 409);
      return jsonError('Unable to submit your application.', 500);
    }
    return jsonOk({ application, reason: fit.reason }, { status: 201 });
  } catch {
    return jsonError('Unable to submit your application.', 500);
  }
}
