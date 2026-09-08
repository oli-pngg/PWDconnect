import { getAuthenticatedContext } from '@/lib/auth';
import { cleanText, jsonError, jsonOk } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

function publicQuestions(data: Array<Record<string, unknown>>) {
  return data.map((question) => ({
    id: question.id,
    skill_id: question.skill_id,
    prompt: question.prompt,
    options: Array.isArray(question.options) ? question.options : [],
    points: question.points,
    sort_order: question.sort_order
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
    const { data, error } = await supabase.from('assessment_questions').select('id, skill_id, prompt, options, points, sort_order').eq('active', true).order('sort_order');
    if (error) return jsonError('Unable to load the assessment.', 500);
    const { data: latest } = await supabase.from('assessment_attempts').select('id, score, total_points, completed_at').eq('candidate_id', user.id).order('completed_at', { ascending: false }).limit(1).maybeSingle();
    return jsonOk({ questions: publicQuestions((data ?? []) as Array<Record<string, unknown>>), latestAttempt: latest ?? null });
  } catch {
    return jsonError('Unable to load the assessment.', 500);
  }
}

export async function POST(request: Request) {
  const limited = checkRateLimit(request, 'assessment-write', { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'candidate') return jsonError('Only candidate accounts can submit the assessment.', 403);
    const body = await request.json() as { responses?: unknown; accommodationNotes?: unknown };
    if (!Array.isArray(body.responses) || body.responses.length === 0 || body.responses.length > 50) return jsonError('Submit one response for each assessment question.');

    const responses = body.responses.filter((response): response is { questionId: string; selectedOption: string } => {
      if (!response || typeof response !== 'object') return false;
      const value = response as Record<string, unknown>;
      return typeof value.questionId === 'string' && /^[0-9a-f-]{36}$/i.test(value.questionId) && typeof value.selectedOption === 'string';
    });
    if (responses.length !== body.responses.length) return jsonError('One or more answers are invalid.');
    const questionIds = responses.map((response) => response.questionId);
    if (new Set(questionIds).size !== questionIds.length) return jsonError('Each assessment question can only be answered once.');

    const { data: questions, error: questionError } = await supabase.from('assessment_questions').select('id, skill_id, points, options').eq('active', true).in('id', questionIds);
    if (questionError || !questions || questions.length !== questionIds.length) return jsonError('The assessment has changed. Reload it and try again.');

    // Answer keys are never selected by a browser-visible client. This lookup is
    // server-only and occurs only after the candidate session is authorized.
    const admin = createSupabaseAdminClient();
    const { data: keys, error: keyError } = await admin.from('assessment_answer_keys').select('question_id, correct_option').in('question_id', questionIds);
    if (keyError || !keys || keys.length !== questionIds.length) return jsonError('Assessment scoring is temporarily unavailable.', 500);
    const answerKeys = keys as unknown as Array<{ question_id: string; correct_option: string }>;
    const keyMap = new Map(answerKeys.map((key) => [key.question_id, key.correct_option]));
    const questionMap = new Map(questions.map((question) => [question.id, question]));

    const scored = responses.map((response) => {
      const question = questionMap.get(response.questionId)!;
      const selectedOption = response.selectedOption.trim().slice(0, 500);
      const validOptions = Array.isArray(question.options) ? question.options.filter((option): option is string => typeof option === 'string') : [];
      const safeSelected = validOptions.includes(selectedOption) ? selectedOption : '';
      const isCorrect = safeSelected !== '' && safeSelected === keyMap.get(response.questionId);
      return { ...response, selectedOption: safeSelected, isCorrect, pointsAwarded: isCorrect ? question.points : 0, skillId: question.skill_id };
    });
    if (scored.some((response) => !response.selectedOption)) return jsonError('Select a valid answer for every question.');

    const score = scored.reduce((sum, response) => sum + response.pointsAwarded, 0);
    const totalPoints = questions.reduce((sum, question) => sum + question.points, 0);
    const { data: rawAttempt, error: attemptError } = await admin.from('assessment_attempts').insert({
      candidate_id: user.id,
      score,
      total_points: totalPoints,
      accommodation_notes: cleanText(body.accommodationNotes, 500) || null
    } as never).select('id, score, total_points, completed_at').single();
    const attempt = rawAttempt as unknown as { id: string; score: number; total_points: number; completed_at: string } | null;
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

    const bySkill = new Map<string, { correct: number; total: number }>();
    scored.forEach((response) => {
      const current = bySkill.get(response.skillId) ?? { correct: 0, total: 0 };
      current.total += 1;
      if (response.isCorrect) current.correct += 1;
      bySkill.set(response.skillId, current);
    });
    const skillRows = [...bySkill.entries()].map(([skillId, result]) => ({
      profile_id: user.id,
      skill_id: skillId,
      proficiency: Math.max(1, Math.min(5, Math.round(1 + (result.correct / result.total) * 4))),
      source: 'assessment_verified',
      verified_at: new Date().toISOString()
    }));
    // The database blocks public clients from self-assigning verified status.
    // This server-only write is allowed only after the candidate session above
    // has been authenticated and the answer keys have been scored.
    const { error: skillUpdateError } = await admin.from('profile_skills').upsert(skillRows as never[], { onConflict: 'profile_id,skill_id' });
    if (skillUpdateError) return jsonError('Your result was saved, but verified skills could not be updated. Try again from your profile.', 500);

    return jsonOk({ attempt, skillCount: skillRows.length });
  } catch {
    return jsonError('Unable to submit the assessment.', 500);
  }
}
