import { getAuthenticatedContext } from '@/lib/auth';
import { bodyReadError, cleanStringArray, cleanText, cleanUuidArray, jsonError, jsonOk, readLimitedJsonObject, safeInteger } from '@/lib/http';
import { calculateFitScore } from '@/lib/matching';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { getCandidateSkills, getVisibleJobs } from '@/lib/server-data';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isValidOccupationalQuestionCount, MIN_OCCUPATIONAL_QUESTIONS } from '@/lib/assessment-rules';
import { MAX_REQUIRED_JOB_SKILLS } from '@/lib/skill-rules';

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, 'jobs-read', { limit: 120, windowMs: 60 * 1000 });
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
    const assessmentRequiredByJob = new Map<string, boolean>();
    if (ids.length && url.searchParams.get('mine') !== 'true') {
      const { data: applications } = await supabase.from('applications').select('job_id, status').eq('candidate_id', user.id).in('job_id', ids);
      applicationMap = new Map((applications ?? []).map((application) => [application.job_id, application.status]));
      const skills = await getCandidateSkills(supabase, user.id);
      jobs.forEach((job) => assessmentRequiredByJob.set(job.id, !calculateFitScore(job, skills).hasVerifiedEvidence));
    }
    return jsonOk({ jobs: jobs.map((job) => ({ ...job, assessment_required: assessmentRequiredByJob.get(job.id) ?? false, application_status: (applicationMap.get(job.id) ?? null) })) });
  } catch {
    return jsonError('Unable to load jobs.', 500);
  }
}

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, 'jobs-write', { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  const parsedBody = await readLimitedJsonObject(request, 192 * 1024);
  if (!parsedBody.ok) return bodyReadError(parsedBody);
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profileError) {
      console.error('[jobs] employer profile lookup failed', { code: profileError.code, message: profileError.message });
      return jsonError('Your employer profile could not be verified. Run all Supabase migrations, then sign out and sign in again.', 500);
    }
    if (profile?.role !== 'employer') return jsonError('Only employer accounts can post openings.', 403);
    const { data: verification, error: verificationError } = await supabase.from('employer_verifications').select('status').eq('employer_id', user.id).maybeSingle();
    if (verificationError || !verification) return jsonError('Employer verification setup is missing. Apply migration 018_employer_verification.sql.', 503);

    const body = parsedBody.value;
    const title = cleanText(body.title, 120);
    const description = cleanText(body.description, 5000);
    const requestedSkillIds = Array.isArray(body.skillIds) ? body.skillIds : [];
    if (requestedSkillIds.length > MAX_REQUIRED_JOB_SKILLS) return jsonError(`Select no more than ${MAX_REQUIRED_JOB_SKILLS} required skills.`);
    const skillIds = cleanUuidArray(requestedSkillIds, MAX_REQUIRED_JOB_SKILLS);
    const assessmentCategory = cleanText(body.assessmentCategory, 80);
    const rawQuestions = Array.isArray(body.assessmentQuestions) ? body.assessmentQuestions : [];
    const assessmentQuestions = rawQuestions.map((question) => {
      if (!question || typeof question !== 'object') return null;
      const value = question as Record<string, unknown>;
      const options = cleanStringArray(value.options, 6, 300);
      const correctOption = cleanText(value.correctOption, 300);
      const points = safeInteger(value.points, 1);
      return {
        prompt: cleanText(value.prompt, 1000),
        options,
        correctOption,
        points: Math.max(1, Math.min(points, 10)),
        skillId: typeof value.skillId === 'string' ? value.skillId : ''
      };
    });
    if (title.length < 3 || description.length < 20 || skillIds.length === 0 || assessmentCategory.length < 2) return jsonError('Add a title, a description of at least 20 characters, one required skill, and an assessment category.');
    if (!isValidOccupationalQuestionCount(assessmentQuestions.length) || assessmentQuestions.some((question) => !question || question.prompt.length < 3 || question.options.length < 2 || new Set(question.options).size !== question.options.length || !question.options.includes(question.correctOption) || !skillIds.includes(question.skillId))) {
      return jsonError(`Add at least ${MIN_OCCUPATIONAL_QUESTIONS} complete assessment questions, each with a valid answer and required skill.`);
    }

    const status = body.status === 'published' ? 'published' : 'draft';
    if (status === 'published' && verification.status !== 'approved') {
      return jsonError('Your opening is saved only as a draft until your business verification is approved.', 403);
    }
    const { data: validSkills, error: skillError } = await supabase.from('skills').select('id').in('id', skillIds).eq('is_active', true);
    if (skillError) {
      console.error('[jobs] skill validation failed', { code: skillError.code, message: skillError.message });
      return jsonError('Required skills could not be verified. Run the database migration that seeds skills, then reload this page.', 500);
    }
    if ((validSkills ?? []).length !== skillIds.length) return jsonError('One or more selected skills are invalid. Reload the page and select the skills again.');

    const salaryMin = safeInteger(body.salaryMin, 0);
    const salaryMax = safeInteger(body.salaryMax, 0);
    if (salaryMin < 0 || salaryMax < 0 || (salaryMin > 0 && salaryMax > 0 && salaryMin > salaryMax)) return jsonError('Check the salary range before saving.');
    // The request is authenticated and the employer role was verified above.
    // Use the server-only client for this two-table write so a stale RLS/schema
    // cache cannot reject a legitimate employer action. The owner ID is never
    // accepted from the request body.
    const admin = createSupabaseAdminClient();
    const { data: rawJob, error: jobError } = await admin.from('jobs').insert({
      employer_id: user.id,
      title,
      description,
      assessment_category: assessmentCategory,
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

    if (assessmentQuestions.length) {
      const { data: rawQuestions, error: questionError } = await admin.from('assessment_questions').insert(assessmentQuestions.map((question, index) => ({
        job_id: job.id,
        slug: `assessment-${job.id.slice(0, 8)}-${index + 1}`,
        assessment_category: assessmentCategory,
        skill_id: question!.skillId,
        prompt: question!.prompt,
        options: question!.options,
        points: question!.points,
        sort_order: index + 1,
        active: true
      })) as never[]).select('id');
      const insertedQuestions = rawQuestions as unknown as Array<{ id: string }> | null;
      if (questionError || !insertedQuestions || insertedQuestions.length !== assessmentQuestions.length) {
        console.error('[jobs] assessment question insert failed', {
          code: questionError?.code,
          message: questionError?.message,
          details: questionError?.details,
          hint: questionError?.hint
        });
        await admin.from('jobs').delete().eq('id', job.id).eq('employer_id', user.id);
        if (questionError?.code === '42703' || questionError?.code === '42P01' || questionError?.code === 'PGRST204') return jsonError('The assessment question database is not ready. Run supabase/migrations/006_assessment_categories.sql, then reload the app.', 500);
        if (questionError?.code === '23514') return jsonError('The assessment question does not meet the database rules. Check its prompt, options, points, and skill.', 400);
        return jsonError('Unable to save the assessment questions.', 500);
      }

      const { error: keyError } = await admin.from('assessment_answer_keys').insert(insertedQuestions.map((question, index) => ({
        question_id: question.id,
        correct_option: assessmentQuestions[index]!.correctOption
      })) as never[]);
      if (keyError) {
        await admin.from('jobs').delete().eq('id', job.id).eq('employer_id', user.id);
        return jsonError('Unable to save the assessment answer keys.', 500);
      }
    }

    return jsonOk({ jobId: job.id }, { status: 201 });
  } catch (error) {
    console.error('[jobs] unexpected opening error', error);
    return jsonError('The opening could not be saved. Check your connection and try again.', 500);
  }
}
