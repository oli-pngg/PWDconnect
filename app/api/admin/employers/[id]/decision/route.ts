import { getAdminAccess } from '@/lib/admin-access';
import { bodyReadError, cleanText, jsonError, jsonOk, readLimitedJsonObject } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

const actions = new Set(['approve', 'request_information', 'reject', 'suspend']);
const businessResults = new Set(['matched', 'not_matched', 'inconclusive']);

function validUuid(value: string) {
  return /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = await readLimitedJsonObject(request, 24 * 1024);
  if (!parsed.ok) return bodyReadError(parsed);
  try {
    const access = await getAdminAccess();
    if (!access.user) return jsonError('Authentication required.', 401);
    if (access.error) return jsonError('Unable to verify administrator access.', 500);
    if (access.role !== 'admin') return jsonError('Administrator access required.', 403);
    const limited = await checkRateLimit(request, 'admin-employer-verification-decision', { limit: 30, windowMs: 60 * 60 * 1000 }, access.user.id);
    if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
    const { id } = await context.params;
    if (!validUuid(id)) return jsonError('Invalid employer.', 400);
    const expectedRevision = Number(parsed.value.expectedRevision);
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) return jsonError('Reload the employer record before making a decision.', 409);

    const action = cleanText(parsed.value.action, 32);
    const reason = cleanText(parsed.value.reason, 1000);
    const employerFeedback = cleanText(parsed.value.employerFeedback, 2000);
    const internalNotes = cleanText(parsed.value.internalNotes, 2000);
    const sourceName = cleanText(parsed.value.sourceName, 500);
    const sourceCheckedAt = cleanText(parsed.value.sourceCheckedAt, 64) || null;
    const businessCheckResult = cleanText(parsed.value.businessCheckResult, 32) || null;
    const representativeCheckMethod = cleanText(parsed.value.representativeCheckMethod, 1000);
    if (!actions.has(action)) return jsonError('Choose a valid review action.');
    if (action !== 'approve' && !reason) return jsonError('Enter the reason for this decision.');
    if (action !== 'approve' && !employerFeedback) return jsonError('Enter the feedback the employer will receive.');
    if (action === 'approve') {
      if (!sourceName || !sourceCheckedAt || !representativeCheckMethod || !businessCheckResult || !businessResults.has(businessCheckResult)) {
        return jsonError('Approval requires the official source, check time, business-check result, and representative-check method.');
      }
      if (businessCheckResult !== 'matched') return jsonError('Approval requires a matched business-information result.');
      if (!Number.isFinite(Date.parse(sourceCheckedAt)) || Date.parse(sourceCheckedAt) > Date.now()) return jsonError('Enter a valid source-check date and time.');
    }

    const rpc = access.supabase as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string } | null }>;
    };
    const { data, error } = await rpc.rpc('review_employer_verification', {
      p_employer_id: id,
      p_expected_revision: expectedRevision,
      p_action: action,
      p_reason: reason || null,
      p_employer_feedback: employerFeedback || null,
      p_internal_notes: internalNotes || null,
      p_source_name: sourceName || null,
      p_source_checked_at: sourceCheckedAt,
      p_business_check_result: businessCheckResult,
      p_representative_check_method: representativeCheckMethod || null
    });
    if (error) {
      if (error.code === '42501') return jsonError('Administrator access required.', 403);
      if (['PGRST202', '42883', '42P01'].includes(error.code ?? '')) return jsonError('Employer verification database setup is missing. Apply migration 018_employer_verification.sql.', 503);
      if (['22023', '40001', '55000', 'P0002'].includes(error.code ?? '')) return jsonError(error.code === '40001' ? 'Another reviewer changed this record. Reload the review before deciding.' : 'This decision is not allowed for the employer’s current state or has missing review information.', 409);
      return jsonError('The review decision could not be saved.', 500);
    }
    return jsonOk({ status: data });
  } catch {
    return jsonError('The review decision could not be saved.', 500);
  }
}
