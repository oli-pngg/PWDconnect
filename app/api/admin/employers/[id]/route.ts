import { getAdminAccess } from '@/lib/admin-access';
import { jsonError, jsonOk } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const bucket = 'employer-verification';

function validUuid(value: string) {
  return /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await getAdminAccess();
    if (!access.user) return jsonError('Authentication required.', 401);
    if (access.error) return jsonError('Unable to verify administrator access.', 500);
    if (access.role !== 'admin') return jsonError('Administrator access required.', 403);
    const limited = await checkRateLimit(_request, 'admin-employer-verification-detail', { limit: 60, windowMs: 60 * 1000 }, access.user.id);
    if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
    const { id } = await context.params;
    if (!validUuid(id)) return jsonError('Invalid employer.', 400);

    const admin = createSupabaseAdminClient();
    const [{ data: profile, error: profileError }, { data: verification, error: verificationError }, { data: submissions, error: submissionsError }, { data: documents, error: documentsError }, { data: events, error: eventsError }] = await Promise.all([
      admin.from('profiles').select('id, email, role, full_name, organization_name, created_at').eq('id', id).eq('role', 'employer').maybeSingle(),
      admin.from('employer_verifications').select('*').eq('employer_id', id).maybeSingle(),
      admin.from('employer_verification_submissions').select('*').eq('employer_id', id).order('submission_number', { ascending: false }).limit(50),
      admin.from('employer_verification_documents').select('id, submission_id, document_type, content_type, byte_size, uploaded_at, storage_path').eq('employer_id', id).order('uploaded_at', { ascending: false }).limit(200),
      admin.from('employer_verification_events').select('*').eq('employer_id', id).order('created_at', { ascending: false }).limit(100)
    ]);
    if (profileError) return jsonError('Unable to load employer profile.', 500);
    if (!profile) return jsonError('Employer not found.', 404);
    const schemaError = [verificationError, submissionsError, documentsError, eventsError].some((error) => ['42P01', 'PGRST202', 'PGRST205'].includes(error?.code ?? ''));
    if (schemaError) return jsonError('Employer verification database setup is missing. Apply migration 018_employer_verification.sql.', 503);
    if (profileError || verificationError || submissionsError || documentsError || eventsError || !verification) return jsonError('Unable to load this employer review.', 500);

    const documentRows = (documents ?? []) as unknown as Array<{ id: string; submission_id: string | null; document_type: string; content_type: string; byte_size: number; uploaded_at: string; storage_path: string }>;
    const signedDocuments = await Promise.all(documentRows.map(async (document) => {
      const { data } = await admin.storage.from(bucket).createSignedUrl(document.storage_path, 5 * 60);
      return {
        id: document.id,
        submission_id: document.submission_id,
        document_type: document.document_type,
        content_type: document.content_type,
        byte_size: document.byte_size,
        uploaded_at: document.uploaded_at,
        signed_url: data?.signedUrl ?? null
      };
    }));

    return jsonOk({ employer: profile, verification, submissions: submissions ?? [], documents: signedDocuments, history: events ?? [] });
  } catch {
    return jsonError('Unable to load this employer review.', 500);
  }
}
