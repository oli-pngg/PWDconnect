import { getAuthenticatedContext } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import { calculateFitScore } from '@/lib/matching';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { getVisibleJobs } from '@/lib/server-data';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { CandidatePreview, CandidateSkill, Job } from '@/lib/types';

function candidateReference(candidateId: string) {
  return `Candidate ${candidateId.replace(/-/g, '').slice(0, 4).toUpperCase()}`;
}

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, 'candidate-pool-read', { limit: 60, windowMs: 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'employer') return jsonError('Only employer accounts can view candidate matches.', 403);
    const { data: verification, error: verificationError } = await supabase.from('employer_verifications').select('status').eq('employer_id', user.id).maybeSingle();
    if (verificationError || !verification) return jsonError('Employer verification setup is missing. Apply migration 018_employer_verification.sql.', 503);
    if (verification.status !== 'approved') return jsonError('Candidate recruitment details are available after employer verification is approved.', 403);

    const jobs = await getVisibleJobs(supabase, { userId: user.id, mine: true });
    const jobIds = jobs.map((job) => job.id);
    if (!jobIds.length) return jsonOk({ candidates: [] as CandidatePreview[] });
    const jobMap = new Map(jobs.map((job) => [job.id, job]));
    const { data: applications, error } = await supabase.from('applications').select('id, job_id, candidate_id, fit_score, matched_skills, status, created_at').in('job_id', jobIds).order('fit_score', { ascending: false }).limit(200);
    if (error) return jsonError('Unable to load candidate matches.', 500);
    if (!applications?.length) return jsonOk({ candidates: [] as CandidatePreview[] });

    const candidateIds = [...new Set(applications.map((application) => application.candidate_id))];
    const admin = createSupabaseAdminClient();
    const [{ data: profiles, error: profileError }, { data: rawSkills, error: skillError }] = await Promise.all([
      admin.from('profiles').select('id, location').in('id', candidateIds),
      admin.from('profile_skills').select('profile_id, skill_id, proficiency, source, skills(id, slug, name, category)').in('profile_id', candidateIds)
    ]);
    if (profileError || skillError) return jsonError('Unable to refresh candidate skill evidence.', 500);
    const profileRows = (profiles ?? []) as unknown as Array<{ id: string; location: string | null }>;
    const locationMap = new Map(profileRows.map((profile) => [profile.id, profile.location]));
    const skillsMap = new Map<string, CandidateSkill[]>();
    (rawSkills ?? []).forEach((row) => {
      const value = row as unknown as CandidateSkill & { profile_id: string };
      const current = skillsMap.get(value.profile_id) ?? [];
      current.push(value);
      skillsMap.set(value.profile_id, current);
    });

    const candidates = (applications ?? []).map((application) => ({
      ...(() => {
        const job = jobMap.get(application.job_id) as Job | undefined;
        const fit = job ? calculateFitScore(job, skillsMap.get(application.candidate_id) ?? [], locationMap.get(application.candidate_id) ?? undefined) : null;
        return {
          application_id: application.id,
          job_id: application.job_id,
          job_title: job?.title ?? 'Opening',
          candidate_ref: candidateReference(application.candidate_id),
          fit_score: fit?.score ?? Number(application.fit_score),
          matched_skills: fit?.matched ?? application.matched_skills ?? [],
          missing_skills: fit?.missing ?? [],
          verified_skills: fit?.verified ?? [],
          has_verified_evidence: fit?.hasVerifiedEvidence ?? false,
          match_reason: fit?.reason,
          status: application.status,
          created_at: application.created_at
        };
      })()
    })) as CandidatePreview[];
    candidates.sort((a, b) => b.fit_score - a.fit_score);
    return jsonOk({ candidates });
  } catch {
    return jsonError('Unable to load candidate matches.', 500);
  }
}
