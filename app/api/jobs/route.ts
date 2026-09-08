import { getAuthenticatedContext } from '@/lib/auth';
import { cleanText, cleanUuidArray, jsonError, jsonOk, safeInteger } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { getVisibleJobs } from '@/lib/server-data';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  const limited = checkRateLimit(request, 'jobs-read', { limit: 120, windowMs: 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const url = new URL(request.url);
    const jobs = await getVisibleJobs(supabase, {
      userId: user.id,
      search: cleanText(url.searchParams.get('search'), 100),
      workMode: cleanText(url.searchParams.get('workMode'), 50),
      mine: url.searchParams.get('mine') === 'true'
    });

    const ids = jobs.map((job) => job.id);
    let applicationMap = new Map<string, string>();
    if (ids.length && url.searchParams.get('mine') !== 'true') {
      const { data: applications } = await supabase.from('applications').select('job_id, status').eq('candidate_id', user.id).in('job_id', ids);
      applicationMap = new Map((applications ?? []).map((application) => [application.job_id, application.status]));
    }
    return jsonOk({ jobs: jobs.map((job) => ({ ...job, application_status: (applicationMap.get(job.id) ?? null) })) });
  } catch {
    return jsonError('Unable to load jobs.', 500);
  }
}

export async function POST(request: Request) {
  const limited = checkRateLimit(request, 'jobs-write', { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profileError) {
      console.error('[jobs] employer profile lookup failed', { code: profileError.code, message: profileError.message });
      return jsonError('Your employer profile could not be verified. Run all Supabase migrations, then sign out and sign in again.', 500);
    }
    if (profile?.role !== 'employer') return jsonError('Only employer accounts can post openings.', 403);

    const body = await request.json() as Record<string, unknown>;
    const title = cleanText(body.title, 120);
    const description = cleanText(body.description, 5000);
    const skillIds = cleanUuidArray(body.skillIds, 20);
    if (title.length < 3 || description.length < 20 || skillIds.length === 0) return jsonError('Add a title, a description of at least 20 characters, and one required skill.');

    const status = body.status === 'published' ? 'published' : 'draft';
    const { data: validSkills, error: skillError } = await supabase.from('skills').select('id').in('id', skillIds).eq('is_active', true);
    if (skillError) {
      console.error('[jobs] skill validation failed', { code: skillError.code, message: skillError.message });
      return jsonError('Required skills could not be verified. Run the database migration that seeds skills, then reload this page.', 500);
    }
    if ((validSkills ?? []).length !== skillIds.length) return jsonError('One or more selected skills are invalid. Reload the page and select the skills again.');

    const salaryMin = safeInteger(body.salaryMin, 0);
    const salaryMax = safeInteger(body.salaryMax, 0);
    // The request is authenticated and the employer role was verified above.
    // Use the server-only client for this two-table write so a stale RLS/schema
    // cache cannot reject a legitimate employer action. The owner ID is never
    // accepted from the request body.
    const admin = createSupabaseAdminClient();
    const { data: rawJob, error: jobError } = await admin.from('jobs').insert({
      employer_id: user.id,
      title,
      description,
      location: cleanText(body.location, 120) || 'Legazpi City, Albay',
      work_mode: cleanText(body.workMode, 50) || 'Flexible',
      employment_type: cleanText(body.employmentType, 50) || 'Full-time',
      salary_min: salaryMin > 0 ? salaryMin : null,
      salary_max: salaryMax > 0 ? salaryMax : null,
      accommodations: cleanText(body.accommodations, 1000) || null,
      status
    } as never).select('id').single();
    const job = rawJob as unknown as { id: string } | null;
    if (jobError || !job) {
      console.error('[jobs] opening insert failed', { code: jobError?.code, message: jobError?.message });
      if (jobError?.code === '42501') return jsonError('Your employer account is not authorized to create openings. Sign out, sign in again, and confirm your profile role is employer.', 403);
      if (jobError?.code === '42703' || jobError?.code === '42P01') return jsonError('The jobs database is missing required fields. Run all Supabase migrations, then try again.', 500);
      if (jobError?.code === '23514') return jsonError('Some opening details do not meet the database rules. Check the title, description, and salary range.');
      return jsonError('The opening could not be saved. Check your connection and try again.', 500);
    }

    const { error: jobSkillsError } = await admin.from('job_skills').insert(skillIds.map((skillId) => ({ job_id: job.id, skill_id: skillId, required_level: 3, importance: 1 })) as never[]);
    if (jobSkillsError) {
      console.error('[jobs] required skills insert failed', { code: jobSkillsError.code, message: jobSkillsError.message });
      await admin.from('jobs').delete().eq('id', job.id).eq('employer_id', user.id);
      if (jobSkillsError.code === '42501') return jsonError('Your employer account cannot attach required skills. Run all Supabase migrations, then sign in again.', 403);
      if (jobSkillsError.code === '42703' || jobSkillsError.code === '42P01') return jsonError('The job skills database is not ready. Run all Supabase migrations, then try again.', 500);
      return jsonError('Unable to save the required skills.', 500);
    }

    return jsonOk({ jobId: job.id }, { status: 201 });
  } catch (error) {
    console.error('[jobs] unexpected opening error', error);
    return jsonError('The opening could not be saved. Check your connection and try again.', 500);
  }
}
