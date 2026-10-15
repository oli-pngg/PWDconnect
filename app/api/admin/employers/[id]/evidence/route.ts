import { getAdminAccess } from '@/lib/admin-access';
import { cleanText, jsonError, jsonOk, readLimitedJsonObject } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const bucket = 'employer-verification';

function validUuid(value: string) {
  return /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = await readLimitedJsonObject(request, 8 * 1024);
  if (!parsed.ok) return jsonError(parsed.reason === 'too_large' ? 'Request is too large.' : 'Invalid erasure request.', parsed.reason === 'too_large' ? 413 : 400);
  try {
    const access = await getAdminAccess();
    if (!access.user) return jsonError('Authentication required.', 401);
    if (access.error) return jsonError('Unable to verify administrator access.', 500);
    if (access.role !== 'admin') return jsonError('Administrator access required.', 403);
    const limited = await checkRateLimit(request, 'admin-employer-evidence-erasure', { limit: 5, windowMs: 60 * 60 * 1000 }, access.user.id);
    if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
    const { id } = await context.params;
    if (!validUuid(id)) return jsonError('Invalid employer.', 400);
    const reason = cleanText(parsed.value.reason, 1000);
    const expectedRevision = Number(parsed.value.expectedRevision);
    if (!reason) return jsonError('Enter the approved erasure reason.');
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) return jsonError('Reload the employer record before erasing evidence.', 409);

    const rpc = access.supabase as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string } | null }>;
    };
    const { error: beginError } = await rpc.rpc('admin_begin_employer_evidence_erasure', {
      p_employer_id: id,
      p_expected_revision: expectedRevision,
      p_reason: reason
    });
    if (beginError) {
      if (beginError.code === '42501') return jsonError('Administrator access required.', 403);
      if (['PGRST202', '42883', '42P01'].includes(beginError.code ?? '')) return jsonError('Employer verification database setup is missing. Apply migration 018_employer_verification.sql.', 503);
      if (['40001', '55000', 'P0002'].includes(beginError.code ?? '')) return jsonError('The verification record changed or cannot be erased in its current state. Reload and retry.', 409);
      return jsonError('The evidence-erasure process could not start.', 500);
    }

    const admin = createSupabaseAdminClient();
    const { data: documents, error: documentsError } = await admin.from('employer_verification_documents').select('storage_path').eq('employer_id', id);
    if (documentsError) return jsonError('Unable to load evidence for erasure.', 500);
    const paths = ((documents ?? []) as unknown as Array<{ storage_path: string }>).map((document) => document.storage_path);
    for (let offset = 0; offset < paths.length; offset += 100) {
      const { error } = await admin.storage.from(bucket).remove(paths.slice(offset, offset + 100));
      if (error) return jsonError('Evidence erasure is in progress but some private files remain. Retry after refreshing this record.', 500);
    }

    const adminRpc = createSupabaseAdminClient() as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string } | null }>;
    };
    const { data, error } = await adminRpc.rpc('admin_complete_employer_evidence_erasure', {
      p_admin_id: access.user.id,
      p_employer_id: id
    });
    if (error) {
      if (['PGRST202', '42883', '42P01'].includes(error.code ?? '')) return jsonError('Employer verification database setup is missing. Apply migration 018_employer_verification.sql.', 503);
      return jsonError('Private files were removed but the erasure record could not be finalized. Refresh and retry before deleting the account.', 500);
    }
    return jsonOk({ deleted: Number(data) || 0 });
  } catch {
    return jsonError('Unable to erase employer evidence.', 500);
  }
}
