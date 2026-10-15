import { getApplicationAccess } from '@/lib/application-access';
import { getAuthenticatedContext } from '@/lib/auth';
import { bodyReadError, cleanText, jsonError, jsonOk, readLimitedJsonObject } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

function validUuid(value: string) {
  return /^[0-9a-f-]{36}$/i.test(value);
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const limited = await checkRateLimit(_request, 'application-messages-read', { limit: 60, windowMs: 60 * 1000 }, user.id);
    if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
    const { id } = await context.params;
    if (!validUuid(id)) return jsonError('Invalid application.', 400);

    const access = await getApplicationAccess(user.id, id);
    if (!access) return jsonError('Application not found.', 404);

    const admin = createSupabaseAdminClient();
    await admin.from('messages').update({ read_at: new Date().toISOString() } as never).eq('application_id', id).neq('sender_id', user.id).is('read_at', null);
    const [{ data: messages, error: messagesError }, { data: offer, error: offerError }] = await Promise.all([
      admin.from('messages').select('id, application_id, sender_id, body, read_at, created_at').eq('application_id', id).order('created_at', { ascending: false }).limit(200),
      admin.from('job_offers').select('id, application_id, job_id, employer_id, candidate_id, message, compensation, start_date, status, created_at, responded_at').eq('application_id', id).maybeSingle()
    ]);
    if (messagesError || offerError) return jsonError('Unable to load this conversation.', 500);

    return jsonOk({
      viewerId: user.id,
      participantRole: access.participantRole,
      application: {
        id: access.applicationId,
        jobId: access.jobId,
        jobTitle: access.jobTitle,
        status: access.applicationStatus,
        participantLabel: access.participantLabel
      },
      messages: [...(messages ?? [])].reverse(),
      offer: offer ?? null
    });
  } catch {
    return jsonError('Unable to load this conversation.', 500);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const limited = await checkRateLimit(request, 'application-messages-write', { limit: 20, windowMs: 10 * 60 * 1000 }, user.id);
    if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
    const { id } = await context.params;
    if (!validUuid(id)) return jsonError('Invalid application.', 400);
    const access = await getApplicationAccess(user.id, id);
    if (!access) return jsonError('Application not found.', 404);

    const parsedBody = await readLimitedJsonObject(request, 16 * 1024);
    if (!parsedBody.ok) return bodyReadError(parsedBody, 'Message is too large.');
    const body = parsedBody.value as { message?: unknown };
    const message = cleanText(body.message, 4000);
    if (!message) return jsonError('Write a message before sending.');

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('messages')
      .insert({ application_id: id, sender_id: user.id, employer_id: access.employerId, candidate_id: access.candidateId, body: message } as never)
      .select('id, application_id, sender_id, body, read_at, created_at')
      .single();
    if (error) return jsonError('Unable to send your message.', 500);
    return jsonOk({ message: data }, { status: 201 });
  } catch {
    return jsonError('Unable to send your message.', 500);
  }
}
