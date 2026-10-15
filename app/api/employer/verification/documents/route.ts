import { randomUUID } from 'node:crypto';
import { getAuthenticatedContext } from '@/lib/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { bodyReadError, jsonError, jsonOk, readLimitedBody } from '@/lib/http';
import { EMPLOYER_VERIFICATION_DOCUMENT_TYPES, type EmployerVerificationDocumentType } from '@/lib/employer-verification';
import { detectEmployerVerificationContentType, employerVerificationFileExtension, MAX_EMPLOYER_VERIFICATION_FILE_BYTES } from '@/lib/employer-verification-file';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const bucket = 'employer-verification';
const maxRequestBytes = MAX_EMPLOYER_VERIFICATION_FILE_BYTES + 128 * 1024;

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, 'employer-verification-upload', { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);

  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'employer') return jsonError('Only employer accounts can upload verification evidence.', 403);
    const { data: verification, error: verificationError } = await supabase.from('employer_verifications').select('status, evidence_erasure_in_progress').eq('employer_id', user.id).maybeSingle();
    if (verificationError || !verification) return jsonError('Employer verification setup is missing. Apply migration 018_employer_verification.sql.', 503);
    if (verification.evidence_erasure_in_progress) return jsonError('Evidence erasure is in progress. Refresh the verification page before uploading.', 409);
    if (verification.status === 'pending' || verification.status === 'suspended') return jsonError('Evidence uploads are unavailable while this verification is pending or suspended.', 409);

    const body = await readLimitedBody(request, maxRequestBytes);
    if (!body.ok) return bodyReadError(body, 'The evidence upload is too large.');
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().startsWith('multipart/form-data;')) return jsonError('Upload evidence using the provided form.');

    let formData: FormData;
    try {
      formData = await new Response(body.bytes as unknown as BodyInit, { headers: { 'Content-Type': contentType } }).formData();
    } catch {
      return jsonError('Upload a valid evidence form.');
    }
    const file = formData.get('file');
    const documentTypeValue = formData.get('documentType');
    if (!(file instanceof File) || typeof documentTypeValue !== 'string'
        || !EMPLOYER_VERIFICATION_DOCUMENT_TYPES.includes(documentTypeValue as EmployerVerificationDocumentType)) {
      return jsonError('Choose a document type and a file.');
    }
    if (file.size < 1 || file.size > MAX_EMPLOYER_VERIFICATION_FILE_BYTES) return jsonError('Evidence files must be 4 MB or smaller.');
    const signatureBytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const detectedType = detectEmployerVerificationContentType(signatureBytes);
    if (!detectedType || (file.type && file.type !== 'application/octet-stream' && file.type !== detectedType)) {
      return jsonError('The file content does not match an allowed PDF, JPG, PNG, or WebP format.');
    }

    const extension = employerVerificationFileExtension(detectedType);
    if (!extension) return jsonError('The evidence format is not supported.');
    const path = `${user.id}/${randomUUID()}.${extension}`;
    const admin = createSupabaseAdminClient();
    const upload = await admin.storage.from(bucket).upload(path, file, {
      contentType: detectedType,
      cacheControl: '0',
      upsert: false
    });
    if (upload.error) return jsonError('The private evidence file could not be stored.', 500);

    const { data: document, error: documentError } = await admin.from('employer_verification_documents').insert({
      employer_id: user.id,
      submission_id: null,
      document_type: documentTypeValue,
      storage_path: path,
      content_type: detectedType,
      byte_size: file.size,
      uploaded_by: user.id
    } as never).select('id, document_type, content_type, byte_size, uploaded_at').single();
    if (documentError || !document) {
      await admin.storage.from(bucket).remove([path]);
      return jsonError('The evidence file could not be linked to your submission.', 500);
    }
    return jsonOk({ document }, { status: 201 });
  } catch {
    return jsonError('Unable to upload verification evidence.', 500);
  }
}
