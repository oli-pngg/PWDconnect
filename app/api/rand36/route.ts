import { getAuthenticatedContext } from '@/lib/auth';
import { bodyReadError, jsonError, jsonOk, readLimitedJsonObject } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { scoreRand36 } from '@/lib/rand36';

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, 'rand36-read', { limit: 30, windowMs: 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'candidate') return jsonError('Only applicants can use RAND-36.', 403);

    const [{ data: consent, error: consentError }, { data: attempt, error: attemptError }, { error: responsesSchemaError }, { error: scalesSchemaError }] = await Promise.all([
      supabase.from('user_consent_events').select('id, granted, policy_version, recorded_at').eq('user_id', user.id).eq('purpose', 'rand36_processing').order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('rand36_assessments').select('id, instrument_version, language, scoring_method, completed_at').eq('candidate_id', user.id).order('completed_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('rand36_responses').select('item_number').limit(0),
      supabase.from('rand36_scale_scores').select('scale_code').limit(0)
    ]);
    const schemaError = consentError || attemptError || responsesSchemaError || scalesSchemaError;
    if (schemaError) {
      const code = schemaError.code;
      if (['42P01', 'PGRST204', 'PGRST205'].includes(code ?? '')) {
        return jsonError('RAND-36 database setup is missing. Back up and verify the Supabase project, then apply supabase/migrations/010_rand36_assessments.sql.', 503);
      }
      if (code === '42501') return jsonError('RAND-36 access policies are not ready. Verify the migration and applicant row-level security.', 503);
      console.error('[rand36] storage readiness check failed', { code });
      return jsonError('RAND-36 storage is unavailable. Check the database migration and applicant access policies.', 503);
    }
    const [{ data: scales, error: scaleError }, { data: changeItem, error: changeError }] = attempt ? await Promise.all([
      supabase.from('rand36_scale_scores').select('scale_code, score, answered_items, item_count').eq('attempt_id', attempt.id),
      supabase.from('rand36_responses').select('response_code, recoded_score').eq('attempt_id', attempt.id).eq('item_number', 2).maybeSingle()
    ]) : [{ data: [], error: null }, { data: null, error: null }];
    if (scaleError || changeError) return jsonError('Unable to load RAND-36 results.', 500);

    return jsonOk({
      available: true,
      consentGranted: consent?.granted === true,
      consentVersion: consent?.policy_version ?? null,
      latestAttempt: attempt ? { ...attempt, health_change_response: changeItem?.response_code ?? null, health_change_score: changeItem?.recoded_score ?? null, scales: scales ?? [] } : null
    });
  } catch {
    return jsonError('Unable to load RAND-36.', 500);
  }
}

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, 'rand36-write', { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  const parsedBody = await readLimitedJsonObject(request, 16 * 1024);
  if (!parsedBody.ok) return bodyReadError(parsedBody);
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const accountLimited = await checkRateLimit(request, 'rand36-write-account', { limit: 5, windowMs: 60 * 60 * 1000 }, user.id);
    if (!accountLimited.allowed) return rateLimitResponse(accountLimited.retryAfterSeconds);
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'candidate') return jsonError('Only applicants can submit RAND-36.', 403);

    const body = parsedBody.value as { responses?: unknown };
    if (!body.responses || typeof body.responses !== 'object' || Array.isArray(body.responses)) return jsonError('Submit RAND-36 responses as item choices.');
    let score: ReturnType<typeof scoreRand36>;
    try {
      score = scoreRand36(body.responses as Record<string, unknown>);
    } catch {
      return jsonError('One or more RAND-36 responses are invalid.');
    }
    const { data: consent, error: consentError } = await supabase.from('user_consent_events').select('id, granted').eq('user_id', user.id).eq('purpose', 'rand36_processing').order('recorded_at', { ascending: false }).limit(1).maybeSingle();
    if (consentError) return jsonError('RAND-36 database setup is missing. Back up and verify Supabase, then apply supabase/migrations/010_rand36_assessments.sql.', 503);
    if (!consent?.granted) return jsonError('Consent to process RAND-36 responses before submitting.', 403);

    const admin = createSupabaseAdminClient() as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown | null }>;
    };
    const { data: attemptId, error } = await admin.rpc('submit_rand36_assessment', {
      p_candidate_id: user.id,
      p_consent_event_id: consent.id,
      p_responses: score.responses,
      p_scale_scores: score.scales
    });
    if (error || typeof attemptId !== 'string') {
      const code = (error as { code?: string } | null)?.code;
      if (['PGRST202', '42883', '42P01'].includes(code ?? '')) return jsonError('RAND-36 database setup is missing. Back up and verify Supabase, then apply supabase/migrations/010_rand36_assessments.sql.', 503);
      return jsonError('Unable to save RAND-36 results.', 500);
    }
    return jsonOk({ attemptId }, { status: 201 });
  } catch {
    return jsonError('Unable to submit RAND-36.', 500);
  }
}
