import { getAuthenticatedContext } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

const allowedStatuses = new Set(['submitted', 'shortlisted', 'interview', 'rejected', 'hired']);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const limited = checkRateLimit(request, 'application-status-write', { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError('Invalid application.', 400);
    const body = await request.json() as { status?: unknown };
    const status = typeof body.status === 'string' ? body.status : '';
    if (!allowedStatuses.has(status)) return jsonError('Invalid application status.');
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'employer') return jsonError('Only employers can update application status.', 403);

    const { data: application } = await supabase.from('applications').select('id, job_id, jobs!inner(employer_id)').eq('id', id).maybeSingle();
    const job = application?.jobs as { employer_id?: string } | { employer_id?: string }[] | null;
    const employerId = Array.isArray(job) ? job[0]?.employer_id : job?.employer_id;
    if (!application || employerId !== user.id) return jsonError('Application not found.', 404);
    const { data, error } = await supabase.from('applications').update({ status }).eq('id', id).eq('job_id', application.job_id).select('id, status, updated_at').single();
    if (error) return jsonError('Unable to update this application.', 500);
    return jsonOk({ application: data });
  } catch {
    return jsonError('Unable to update this application.', 500);
  }
}
