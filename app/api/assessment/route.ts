import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAuthenticatedContext } from '@/lib/auth';
import { bodyTooLarge, cleanText, jsonError, jsonOk } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { QUESTIONS_PER_ATTEMPT } from '@/lib/assessment-rules';

const VERIFIED_RATIO = 0.5;

type AssessmentRow = {
  id: string;
  job_id: string | null;
  assessment_category: string;
  skill_id: string;
  prompt: string;
  options: unknown;
  points: number;
  sort_order: number;
};

type AssessmentJob = {
  id: string;
  title: string;
  assessment_category: string;
};

type AssessmentToken = {
  userId: string;
  jobId: string | null;
  category: string;
  questionIds: string[];
  expiresAt: number;
};

function categoryKey(value: string) {
  return value.trim().toLocaleLowerCase();
}

function assessmentSecret() {
  return process.env.ASSESSMENT_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

function signAssessmentToken(payload: AssessmentToken) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', assessmentSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyAssessmentToken(value: unknown) {
  if (typeof value !== 'string' || !assessmentSecret()) return null;
  const [encoded, signature] = value.split('.');
  if (!encoded || !signature) return null;
  const expected = createHmac('sha256', assessmentSecret()).update(encoded).digest('base64url');
  const receivedBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (receivedBytes.length !== expectedBytes.length || !timingSafeEqual(receivedBytes, expectedBytes)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as AssessmentToken;
    return payload.expiresAt > Date.now() && Array.isArray(payload.questionIds) ? payload : null;
  } catch {
    return null;
  }
}

function shuffle<T>(values: T[]) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

async function loadAvailableQuestions(supabase: SupabaseClient) {
  const query = supabase
    .from('assessment_questions')
    .select('id, job_id, assessment_category, skill_id, prompt, options, points, sort_order')
    .eq('active', true)
    .limit(1000);
  const { data, error } = await query;
  if (error) throw error;

  const questions = (data ?? []) as unknown as AssessmentRow[];
  const jobIds = [...new Set(questions.map((question) => question.job_id).filter((id): id is string => Boolean(id)))];
  const publishedJobIds = new Set<string>();
  if (jobIds.length) {
    const { data: jobs, error: jobError } = await supabase.from('jobs').select('id').eq('status', 'published').in('id', jobIds);
    if (jobError) throw jobError;
    (jobs ?? []).forEach((job) => publishedJobIds.add(job.id));
  }

  return questions.filter((question) => !question.job_id || publishedJobIds.has(question.job_id));
}

async function loadAssessmentJobs(supabase: SupabaseClient, questions: AssessmentRow[]) {
  const jobIds = [...new Set(questions.map((question) => question.job_id).filter((id): id is string => Boolean(id)))];
  if (!jobIds.length) return [] as AssessmentJob[];
  const { data, error } = await supabase.from('jobs').select('id, title, assessment_category').eq('status', 'published').in('id', jobIds);
  if (error) throw error;
  return (data ?? []) as unknown as AssessmentJob[];
}

function publicQuestions(data: AssessmentRow[]) {
  return data.map((question) => ({
    id: question.id,
    skill_id: question.skill_id,
    prompt: question.prompt,
    options: Array.isArray(question.options) ? question.options : [],
    points: question.points,
    sort_order: question.sort_order,
    assessment_category: question.assessment_category
  }));
}

export async function GET(request: Request) {
  const limited = checkRateLimit(request, 'assessment-read', { limit: 60, windowMs: 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'candidate') return jsonError('Only candidate accounts can take the assessment.', 403);

    const available = await loadAvailableQuestions(supabase);
    const jobs = await loadAssessmentJobs(supabase, available);
    const categoryLabels = new Map<string, string>();
    available.forEach((question) => {
      const label = cleanText(question.assessment_category, 80) || 'General';
      categoryLabels.set(categoryKey(label), label);
    });
    const url = new URL(request.url);
    const requestedJobId = cleanText(url.searchParams.get('jobId'), 40);
    const selectedJob = jobs.find((job) => job.id === requestedJobId) ?? null;
    const requestedCategory = cleanText(url.searchParams.get('category'), 80);
    const selectedCategory = selectedJob?.assessment_category
      ?? (requestedCategory ? categoryLabels.get(categoryKey(requestedCategory)) ?? null : null);
    const selectedQuestions = selectedJob
      ? shuffle(available.filter((question) => question.job_id === selectedJob.id)).slice(0, QUESTIONS_PER_ATTEMPT)
      : selectedCategory
        ? shuffle(available.filter((question) => !question.job_id && categoryKey(question.assessment_category) === categoryKey(selectedCategory))).slice(0, QUESTIONS_PER_ATTEMPT)
        : [];
    const assessmentToken = selectedCategory && selectedQuestions.length
      ? signAssessmentToken({ userId: user.id, jobId: selectedJob?.id ?? null, category: selectedCategory, questionIds: selectedQuestions.map((question) => question.id), expiresAt: Date.now() + 30 * 60 * 1000 })
      : null;
    const { data: latest } = await supabase.from('assessment_attempts').select('id, score, total_points, completed_at, assessment_category, job_id').eq('candidate_id', user.id).order('completed_at', { ascending: false }).limit(1).maybeSingle();
    return jsonOk({ jobs, categories: [...categoryLabels.values()], selectedJob, selectedCategory, assessmentToken, questions: publicQuestions(selectedQuestions), latestAttempt: latest ?? null });
  } catch {
    return jsonError('Unable to load the assessment.', 500);
  }
}

export async function POST(request: Request) {
  if (bodyTooLarge(request, 64 * 1024)) return jsonError('Request is too large.', 413);
  const limited = checkRateLimit(request, 'assessment-write', { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const accountLimited = checkRateLimit(request, 'assessment-write-account', { limit: 5, windowMs: 60 * 60 * 1000 }, user.id);
    if (!accountLimited.allowed) return rateLimitResponse(accountLimited.retryAfterSeconds);
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'candidate') return jsonError('Only candidate accounts can submit the assessment.', 403);
    const body = await request.json() as { responses?: unknown; assessmentCategory?: unknown; jobId?: unknown; assessmentToken?: unknown; accommodationNotes?: unknown };
    let category = cleanText(body.assessmentCategory, 80);
    const jobId = cleanText(body.jobId, 40);
    if (jobId && !/^[0-9a-f-]{36}$/i.test(jobId)) return jsonError('Select a valid opening for the assessment.');
    if ((!jobId && !category) || !Array.isArray(body.responses) || body.responses.length === 0 || body.responses.length > QUESTIONS_PER_ATTEMPT) return jsonError('Select an opening or assessment category and submit every randomized question.');

    const responses = body.responses.filter((response): response is { questionId: string; selectedOption: string } => {
      if (!response || typeof response !== 'object') return false;
      const value = response as Record<string, unknown>;
      return typeof value.questionId === 'string' && /^[0-9a-f-]{36}$/i.test(value.questionId) && typeof value.selectedOption === 'string';
    });
    if (responses.length !== body.responses.length) return jsonError('One or more answers are invalid.');
    const questionIds = responses.map((response) => response.questionId);
    if (new Set(questionIds).size !== questionIds.length) return jsonError('Each assessment question can only be answered once.');
    const token = verifyAssessmentToken(body.assessmentToken);
    const available = await loadAvailableQuestions(supabase);
    let categoryQuestions: AssessmentRow[];
    if (jobId) {
      const { data: job } = await supabase.from('jobs').select('id, assessment_category').eq('id', jobId).eq('status', 'published').maybeSingle();
      if (!job) return jsonError('This opening is no longer available for assessment.', 404);
      category = cleanText(job.assessment_category, 80);
      categoryQuestions = available.filter((question) => question.job_id === jobId);
    } else {
      categoryQuestions = available.filter((question) => !question.job_id && categoryKey(question.assessment_category) === categoryKey(category));
    }
    if (!token || token.userId !== user.id || token.jobId !== (jobId || null) || categoryKey(token.category) !== categoryKey(category) || token.questionIds.length !== questionIds.length || token.questionIds.some((questionId) => !questionIds.includes(questionId))) {
      return jsonError('This assessment session expired. Reload the questions and try again.', 409);
    }
    const expectedCount = Math.min(QUESTIONS_PER_ATTEMPT, categoryQuestions.length);
    const questionMap = new Map(categoryQuestions.map((question) => [question.id, question]));
    const questions = questionIds.map((questionId) => questionMap.get(questionId)).filter((question): question is AssessmentRow => Boolean(question));
    if (!categoryQuestions.length || responses.length !== expectedCount || questions.length !== questionIds.length || token.questionIds.some((questionId) => !questionMap.has(questionId))) return jsonError('The assessment has changed. Reload it and try again.');

    // Answer keys are never selected by a browser-visible client. This lookup is
    // server-only and occurs only after the candidate session is authorized.
    const admin = createSupabaseAdminClient();
    const { data: keys, error: keyError } = await admin.from('assessment_answer_keys').select('question_id, correct_option').in('question_id', questionIds);
    if (keyError || !keys || keys.length !== questionIds.length) return jsonError('Assessment scoring is temporarily unavailable.', 500);
    const answerKeys = keys as unknown as Array<{ question_id: string; correct_option: string }>;
    const keyMap = new Map(answerKeys.map((key) => [key.question_id, key.correct_option]));

    const scored = responses.map((response) => {
      const question = questionMap.get(response.questionId)!;
      const selectedOption = response.selectedOption.trim().slice(0, 500);
      const validOptions = Array.isArray(question.options) ? question.options.filter((option): option is string => typeof option === 'string') : [];
      const safeSelected = validOptions.includes(selectedOption) ? selectedOption : '';
      const isCorrect = safeSelected !== '' && safeSelected === keyMap.get(response.questionId);
      return { ...response, selectedOption: safeSelected, isCorrect, pointsAwarded: isCorrect ? question.points : 0, questionPoints: question.points, skillId: question.skill_id };
    });
    if (scored.some((response) => !response.selectedOption)) return jsonError('Select a valid answer for every question.');

    const score = scored.reduce((sum, response) => sum + response.pointsAwarded, 0);
    const totalPoints = questions.reduce((sum, question) => sum + question.points, 0);
    const { data: rawAttempt, error: attemptError } = await admin.from('assessment_attempts').insert({
      candidate_id: user.id,
      score,
      total_points: totalPoints,
      assessment_category: category,
      job_id: jobId || null,
      accommodation_notes: cleanText(body.accommodationNotes, 500) || null
    } as never).select('id, score, total_points, completed_at, assessment_category, job_id').single();
    const attempt = rawAttempt as unknown as { id: string; score: number; total_points: number; completed_at: string; assessment_category: string; job_id: string | null } | null;
    if (attemptError || !attempt) return jsonError('Unable to save your assessment result.', 500);

    const { error: responseError } = await admin.from('assessment_responses').insert(scored.map((response) => ({
      attempt_id: attempt.id,
      question_id: response.questionId,
      selected_option: response.selectedOption,
      is_correct: response.isCorrect,
      points_awarded: response.pointsAwarded
    })) as never[]);
    if (responseError) {
      await admin.from('assessment_attempts').delete().eq('id', attempt.id).eq('candidate_id', user.id);
      return jsonError('Unable to save your assessment answers.', 500);
    }

    const bySkill = new Map<string, { correctPoints: number; totalPoints: number }>();
    scored.forEach((response) => {
      const current = bySkill.get(response.skillId) ?? { correctPoints: 0, totalPoints: 0 };
      current.totalPoints += response.questionPoints;
      current.correctPoints += response.pointsAwarded;
      bySkill.set(response.skillId, current);
    });
    const skillRows = [...bySkill.entries()]
      .filter(([, result]) => result.correctPoints / result.totalPoints >= VERIFIED_RATIO)
      .map(([skillId, result]) => ({
        profile_id: user.id,
        skill_id: skillId,
        proficiency: Math.max(1, Math.min(5, Math.round(1 + (result.correctPoints / result.totalPoints) * 4))),
        source: 'assessment_verified',
        verified_at: new Date().toISOString()
      }));
    // The database blocks public clients from self-assigning verified status.
    // This server-only write is allowed only after the candidate session above
    // has been authenticated and the answer keys have been scored.
    if (skillRows.length) {
      const { error: skillUpdateError } = await admin.from('profile_skills').upsert(skillRows as never[], { onConflict: 'profile_id,skill_id' });
      if (skillUpdateError) return jsonError('Your result was saved, but verified skills could not be updated. Try again from your profile.', 500);
    }

    return jsonOk({ attempt, verifiedSkillCount: skillRows.length });
  } catch {
    return jsonError('Unable to submit the assessment.', 500);
  }
}
