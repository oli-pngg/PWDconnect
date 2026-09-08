import { getApplicationAccess } from '@/lib/application-access';
import { getAuthenticatedContext } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const statuses = new Set(['accepted', 'declined', 'withdrawn']);

function validUuid(value: string) {
  return /^[0-9a-f-]{36}$/i.test(value);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const { id } = await context.params;
    if (!validUuid(id)) return jsonError('Invalid offer.', 400);
    const body = await request.json() as { status?: unknown };
    const status = typeof body.status === 'string' ? body.status : '';
    if (!statuses.has(status)) return jsonError('Invalid offer response.');

    const admin = createSupabaseAdminClient();
    const { data: rawOffer, error: offerError } = await admin.from('job_offers').select('id, application_id, status').eq('id', id).maybeSingle();
    const offer = rawOffer as unknown as { id: string; application_id: string; status: string } | null;
    if (offerError || !offer) return jsonError('Offer not found.', 404);
    const access = await getApplicationAccess(user.id, offer.application_id);
    if (!access) return jsonError('Offer not found.', 404);
    if (status !== 'withdrawn' && access.participantRole !== 'candidate') return jsonError('Only the candidate can respond to this offer.', 403);
    if (status === 'withdrawn' && access.participantRole !== 'employer') return jsonError('Only the employer can withdraw this offer.', 403);
    if (offer.status !== 'pending') return jsonError('This offer has already been resolved.', 409);
    if (status === 'accepted' && !['submitted', 'shortlisted', 'interview'].includes(access.applicationStatus)) return jsonError('This application is no longer available for acceptance.', 409);

    const { data, error } = await admin
      .from('job_offers')
      .update({ status, responded_at: new Date().toISOString() } as never)
      .eq('id', id)
      .eq('status', 'pending')
      .select('id, application_id, job_id, employer_id, candidate_id, message, compensation, start_date, status, created_at, responded_at')
      .maybeSingle();
    if (error || !data) return jsonError('This offer was already resolved. Refresh and try again.', 409);

    if (status === 'accepted') {
      const { data: application, error: applicationError } = await admin.from('applications').update({ status: 'hired' } as never).eq('id', access.applicationId).in('status', ['submitted', 'shortlisted', 'interview']).select('id, status').maybeSingle();
      if (applicationError || !application) return jsonError('The offer was accepted, but the application status could not be updated.', 500);
    }
    return jsonOk({ offer: data, applicationStatus: status === 'accepted' ? 'hired' : access.applicationStatus });
  } catch {
    return jsonError('Unable to update this offer.', 500);
  }
}
