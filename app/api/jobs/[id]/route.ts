import { getAuthenticatedContext } from '@/lib/auth';
import { bodyReadError, jsonError, jsonOk, readLimitedJsonObject } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const statuses = new Set(['draft', 'published', 'closed']);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const limited = await checkRateLimit(request, 'job-status-write', { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError('Invalid opening.', 400);
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'employer') return jsonError('Only employers can update openings.', 403);
    const parsedBody = await readLimitedJsonObject(request, 16 * 1024);
    if (!parsedBody.ok) return bodyReadError(parsedBody);
    const body = parsedBody.value as { status?: unknown };
    const status = typeof body.status === 'string' ? body.status : '';
    if (!statuses.has(status)) return jsonError('Choose a valid opening status.');
    if (status === 'published') {
      const { data: verification, error: verificationError } = await supabase.from('employer_verifications').select('status').eq('employer_id', user.id).maybeSingle();
      if (verificationError || !verification) return jsonError('Employer verification setup is missing. Apply migration 018_employer_verification.sql.', 503);
      if (verification.status !== 'approved') return jsonError('Your opening cannot be published until your business verification is approved.', 403);
    }

    const admin = createSupabaseAdminClient();
    const { data: rawJob } = await admin.from('jobs').select('id, employer_id').eq('id', id).maybeSingle();
    const job = rawJob as unknown as { id: string; employer_id: string } | null;
    if (!job || job.employer_id !== user.id) return jsonError('Opening not found.', 404);
    if (status === 'published') {
      const [{ count: skillCount }, { count: questionCount }] = await Promise.all([
        admin.from('job_skills').select('job_id', { count: 'exact', head: true }).eq('job_id', id),
        admin.from('assessment_questions').select('id', { count: 'exact', head: true }).eq('job_id', id).eq('active', true)
      ]);
      if (!skillCount || !questionCount) return jsonError('Add required skills and assessment questions before publishing.');
    }
    const { data, error } = await admin.from('jobs').update({ status } as never).eq('id', id).eq('employer_id', user.id).select('id, status, updated_at').single();
    if (error || !data) return jsonError('Unable to update this opening.', 500);
    return jsonOk({ job: data });
  } catch {
    return jsonError('Unable to update this opening.', 500);
  }
}
