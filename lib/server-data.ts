import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { CandidateSkill, Job } from '@/lib/types';

type QueryClient = SupabaseClient;

const jobSelect = 'id, employer_id, title, description, location, work_mode, employment_type, salary_min, salary_max, accommodations, assessment_category, status, created_at, job_skills(skill_id, required_level, importance, skills(id, slug, name, category))';

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export async function getVisibleJobs(
  supabase: QueryClient,
  options: { userId: string; search?: string; workMode?: string; mine?: boolean }
) {
  let query = supabase.from('jobs').select(jobSelect).order('created_at', { ascending: false }).limit(100);

  if (options.mine) {
    query = query.eq('employer_id', options.userId);
  } else {
    query = query.eq('status', 'published');
  }
  if (options.search) query = query.ilike('title', `%${escapeLike(options.search)}%`);
  if (options.workMode && options.workMode !== 'All work modes') query = query.eq('work_mode', options.workMode);

  const { data, error } = await query;
  if (error) throw error;

  return attachEmployerNames((data ?? []) as unknown as Job[]);
}

export async function getCandidateSkills(supabase: QueryClient, userId: string) {
  const { data, error } = await supabase
    .from('profile_skills')
    .select('skill_id, proficiency, source, skills(id, slug, name, category)')
    .eq('profile_id', userId);

  if (error) throw error;
  return (data ?? []) as unknown as CandidateSkill[];
}

export async function attachEmployerNames(jobs: Job[]) {
  const employerIds = [...new Set(jobs.map((job) => job.employer_id).filter(Boolean))];
  if (!employerIds.length) return jobs;

  const admin = createSupabaseAdminClient();
  const [{ data, error }, { data: verificationData, error: verificationError }] = await Promise.all([
    admin.from('profiles').select('id, organization_name').in('id', employerIds),
    admin.from('employer_verifications').select('employer_id, status, approved_at').in('employer_id', employerIds)
  ]);
  if (error || verificationError) throw error ?? verificationError;

  const profiles = (data ?? []) as unknown as Array<{ id: string; organization_name: string | null }>;
  const verificationRows = (verificationData ?? []) as unknown as Array<{ employer_id: string; status: string; approved_at: string | null }>;
  const verifiedAtByEmployer = new Map(verificationRows
    .filter((verification) => verification.status === 'approved' && verification.approved_at)
    .map((verification) => [verification.employer_id, verification.approved_at]));
  const names = new Map(profiles.map((profile) => [profile.id, profile.organization_name]));
  return jobs.map((job) => ({
    ...job,
    organization_name: names.get(job.employer_id) ?? 'PWD Connect employer',
    employer_verified_at: verifiedAtByEmployer.get(job.employer_id) ?? null
  }));
}

export function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
