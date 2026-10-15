import { getApplicationAccess } from '@/lib/application-access';
import { getAuthenticatedContext } from '@/lib/auth';
import { bodyReadError, cleanText, jsonError, jsonOk, readLimitedJsonObject } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

function validUuid(value: string) {
  return /^[0-9a-f-]{36}$/i.test(value);
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const limited = await checkRateLimit(request, 'application-offer-write', { limit: 10, windowMs: 60 * 60 * 1000 }, user.id);
    if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
    const { id } = await context.params;
    if (!validUuid(id)) return jsonError('Invalid application.', 400);
    const access = await getApplicationAccess(user.id, id);
    if (!access) return jsonError('Application not found.', 404);
    if (access.participantRole !== 'employer') return jsonError('Only the employer can send an offer.', 403);
    if (access.applicationStatus === 'rejected' || access.applicationStatus === 'hired') return jsonError('This application is no longer available for a new offer.', 409);

    const parsedBody = await readLimitedJsonObject(request, 16 * 1024);
    if (!parsedBody.ok) return bodyReadError(parsedBody, 'Offer is too large.');
    const body = parsedBody.value as { message?: unknown; compensation?: unknown; startDate?: unknown };
    const message = cleanText(body.message, 4000);
    const compensation = cleanText(body.compensation, 200) || null;
    const startDate = cleanText(body.startDate, 10) || null;
    if (!message) return jsonError('Add a message to the offer.');
    if (startDate && !validDate(startDate)) return jsonError('Enter a valid start date.');

    const admin = createSupabaseAdminClient();
    const { data: existing } = await admin.from('job_offers').select('id, status').eq('application_id', id).maybeSingle();
    if (existing) return jsonError('An offer already exists for this application.', 409);
    const { data, error } = await admin
      .from('job_offers')
      .insert({ application_id: id, job_id: access.jobId, employer_id: access.employerId, candidate_id: access.candidateId, message, compensation, start_date: startDate } as never)
      .select('id, application_id, job_id, employer_id, candidate_id, message, compensation, start_date, status, created_at, responded_at')
      .single();
    if (error) {
      if (error.code === '23505') return jsonError('An offer already exists for this application.', 409);
      return jsonError('Unable to send the job offer.', 500);
    }
    return jsonOk({ offer: data }, { status: 201 });
  } catch {
    return jsonError('Unable to send the job offer.', 500);
  }
}
