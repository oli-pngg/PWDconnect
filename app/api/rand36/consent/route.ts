import { getAuthenticatedContext } from '@/lib/auth';
import { bodyReadError, jsonError, jsonOk, readLimitedJsonObject } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const POLICY_VERSION = 'rand36-processing-v1';

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, 'rand36-consent', { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'candidate') return jsonError('Only applicants can change RAND-36 consent.', 403);
    const parsedBody = await readLimitedJsonObject(request, 8 * 1024);
    if (!parsedBody.ok) return bodyReadError(parsedBody);
    const body = parsedBody.value as { granted?: unknown };
    if (typeof body.granted !== 'boolean') return jsonError('Choose whether to consent to RAND-36 processing.');

    const admin = createSupabaseAdminClient() as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown | null }>;
    };
    const { error } = await admin.rpc('set_rand36_processing_consent', {
      p_candidate_id: user.id,
      p_policy_version: POLICY_VERSION,
      p_granted: body.granted
    });
    if (error) {
      const code = (error as { code?: string } | null)?.code;
      if (['PGRST202', '42883', '42P01'].includes(code ?? '')) return jsonError('RAND-36 database setup is missing. Back up and verify Supabase, then apply supabase/migrations/010_rand36_assessments.sql.', 503);
      return jsonError('Unable to save your consent choice.', 500);
    }
    return jsonOk({ granted: body.granted, policyVersion: POLICY_VERSION });
  } catch {
    return jsonError('Unable to save your consent choice.', 500);
  }
}
