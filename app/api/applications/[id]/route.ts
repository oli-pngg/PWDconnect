import { getAuthenticatedContext } from '@/lib/auth';
import { bodyReadError, jsonError, jsonOk, readLimitedJsonObject } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const allowedStatuses = new Set(['submitted', 'shortlisted', 'interview', 'rejected', 'hired']);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const limited = await checkRateLimit(request, 'application-status-write', { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError('Invalid application.', 400);
    const parsedBody = await readLimitedJsonObject(request, 16 * 1024);
    if (!parsedBody.ok) return bodyReadError(parsedBody);
    const body = parsedBody.value as { status?: unknown };
    const status = typeof body.status === 'string' ? body.status : '';
    if (!allowedStatuses.has(status)) return jsonError('Invalid application status.');
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'employer') return jsonError('Only employers can update application status.', 403);
    const { data: verification, error: verificationError } = await supabase.from('employer_verifications').select('status').eq('employer_id', user.id).maybeSingle();
    if (verificationError || !verification) return jsonError('Employer verification setup is missing. Apply migration 018_employer_verification.sql.', 503);
    if (verification.status !== 'approved') return jsonError('Only approved employers can access or update applicant recruitment details.', 403);

    const { data: application } = await supabase.from('applications').select('id, job_id, jobs!inner(employer_id)').eq('id', id).maybeSingle();
    const job = application?.jobs as { employer_id?: string } | { employer_id?: string }[] | null;
    const employerId = Array.isArray(job) ? job[0]?.employer_id : job?.employer_id;
    if (!application || employerId !== user.id) return jsonError('Application not found.', 404);
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('applications').update({ status } as never).eq('id', id).eq('job_id', application.job_id).select('id, status, updated_at').single();
    if (error) return jsonError('Unable to update this application.', 500);
    return jsonOk({ application: data });
  } catch {
    return jsonError('Unable to update this application.', 500);
  }
}
