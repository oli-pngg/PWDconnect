import { getAuthenticatedContext } from '@/lib/auth';
import { cleanText, jsonError, jsonOk, readLimitedJsonObject } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requiredFreshEvidence, validateEmployerVerificationSubmission, type EmployerVerificationSubmission, type EmployerVerificationDocument, type ExistingEmployerVerification } from '@/lib/employer-verification';

const bucket = 'employer-verification';

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, 'employer-verification-read', { limit: 30, windowMs: 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const { data: profile, error: profileError } = await supabase.from('profiles').select('role, organization_name').eq('id', user.id).maybeSingle();
    if (profileError) return jsonError('Unable to verify your employer account.', 500);
    if (profile?.role !== 'employer') return jsonError('Only employer accounts can access verification.', 403);

    const [stateResult, submissionsResult, documentsResult] = await Promise.all([
      supabase.from('employer_verifications').select('*').eq('employer_id', user.id).maybeSingle(),
      supabase.from('employer_verification_submissions').select('*').eq('employer_id', user.id).order('submission_number', { ascending: false }).limit(20),
      supabase.from('employer_verification_documents').select('id, submission_id, document_type, content_type, byte_size, uploaded_at, storage_path').eq('employer_id', user.id).order('uploaded_at', { ascending: false }).limit(100)
    ]);
    const missingSchema = [stateResult.error, submissionsResult.error, documentsResult.error].some((error) => ['42P01', 'PGRST202', 'PGRST205'].includes(error?.code ?? ''));
    if (missingSchema) return jsonError('Employer verification is not installed yet. Apply migration 018_employer_verification.sql.', 503);
    if (stateResult.error || submissionsResult.error || documentsResult.error) return jsonError('Unable to load employer verification.', 500);
    if (!stateResult.data) return jsonError('Employer verification setup is missing. Apply migration 018_employer_verification.sql.', 503);

    const admin = createSupabaseAdminClient();
    const documents = await Promise.all((documentsResult.data ?? []).map(async (document) => {
      const { data } = stateResult.data.evidence_erasure_in_progress
        ? { data: null }
        : await admin.storage.from(bucket).createSignedUrl(document.storage_path, 5 * 60);
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

    return jsonOk({
      profile: { organization_name: profile.organization_name },
      verification: {
        status: stateResult.data.status,
        registeredBusinessName: stateResult.data.registered_business_name,
        tradingName: stateResult.data.trading_name ?? profile.organization_name,
        businessType: stateResult.data.business_type,
        registrationAuthority: stateResult.data.registration_authority,
        registrationNumber: stateResult.data.registration_number,
        businessAddress: stateResult.data.business_address,
        contactEmail: stateResult.data.contact_email,
        contactPhone: stateResult.data.contact_phone,
        website: stateResult.data.website,
        representativeName: stateResult.data.representative_name,
        representativeRole: stateResult.data.representative_role,
        representativeIsOwnerOrOfficer: stateResult.data.representative_is_owner_or_officer,
        localPermitApplicable: stateResult.data.local_permit_applicable,
        materialChangeRequiresEvidence: stateResult.data.material_change_requires_evidence,
        evidenceErasureInProgress: stateResult.data.evidence_erasure_in_progress,
        employer_feedback: stateResult.data.employer_feedback,
        approved_at: stateResult.data.approved_at,
        last_submitted_at: stateResult.data.last_submitted_at
      },
      submissions: submissionsResult.data ?? [],
      documents
    });
  } catch {
    return jsonError('Unable to load employer verification.', 500);
  }
}

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, 'employer-verification-submit', { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  const parsed = await readLimitedJsonObject(request, 32 * 1024);
  if (!parsed.ok) return jsonError(parsed.reason === 'too_large' ? 'Verification submission is too large.' : 'Enter valid verification information.', parsed.reason === 'too_large' ? 413 : 400);

  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const { data: profile, error: profileError } = await supabase.from('profiles').select('role, organization_name').eq('id', user.id).maybeSingle();
    if (profileError) return jsonError('Unable to verify your employer account.', 500);
    if (profile?.role !== 'employer') return jsonError('Only employer accounts can submit verification.', 403);

    const body = parsed.value;
    const args = {
      p_registered_business_name: cleanText(body.registeredBusinessName, 200),
      p_trading_name: cleanText(body.tradingName, 200) || null,
      p_business_type: cleanText(body.businessType, 40),
      p_registration_authority: cleanText(body.registrationAuthority, 200),
      p_registration_number: cleanText(body.registrationNumber, 120) || null,
      p_business_address: cleanText(body.businessAddress, 500),
      p_contact_email: cleanText(body.contactEmail, 254).toLowerCase(),
      p_contact_phone: cleanText(body.contactPhone, 40),
      p_website: cleanText(body.website, 2048) || null,
      p_representative_name: cleanText(body.representativeName, 160),
      p_representative_role: cleanText(body.representativeRole, 120),
      p_representative_is_owner_or_officer: typeof body.representativeIsOwnerOrOfficer === 'boolean' ? body.representativeIsOwnerOrOfficer : null,
      p_local_permit_applicable: typeof body.localPermitApplicable === 'boolean' ? body.localPermitApplicable : null
    };
    const [{ data: rawDocuments, error: documentError }, { data: rawCurrentState, error: stateError }] = await Promise.all([
      supabase.from('employer_verification_documents').select('document_type, submission_id').eq('employer_id', user.id),
      supabase.from('employer_verifications').select('*').eq('employer_id', user.id).maybeSingle()
    ]);
    if (documentError || stateError || !rawCurrentState) return jsonError('Unable to validate employer verification data.', 500);
    let documents = (rawDocuments ?? []) as unknown as EmployerVerificationDocument[];
    let currentState = rawCurrentState as unknown as Record<string, unknown>;

    const submission: EmployerVerificationSubmission = {
      registeredBusinessName: args.p_registered_business_name,
      tradingName: args.p_trading_name ?? '',
      businessType: args.p_business_type as EmployerVerificationSubmission['businessType'],
      registrationAuthority: args.p_registration_authority,
      registrationNumber: args.p_registration_number ?? '',
      businessAddress: args.p_business_address,
      contactEmail: args.p_contact_email,
      contactPhone: args.p_contact_phone,
      website: args.p_website ?? '',
      representativeName: args.p_representative_name,
      representativeRole: args.p_representative_role,
      representativeIsOwnerOrOfficer: args.p_representative_is_owner_or_officer,
      localPermitApplicable: args.p_local_permit_applicable
    };
    const toCurrentVerification = (state: Record<string, unknown>): ExistingEmployerVerification => ({
      registeredBusinessName: typeof state.registered_business_name === 'string' ? state.registered_business_name : '',
      tradingName: typeof state.trading_name === 'string' ? state.trading_name : '',
      businessType: typeof state.business_type === 'string' ? state.business_type as ExistingEmployerVerification['businessType'] : '',
      registrationAuthority: typeof state.registration_authority === 'string' ? state.registration_authority : '',
      registrationNumber: typeof state.registration_number === 'string' ? state.registration_number : '',
      businessAddress: typeof state.business_address === 'string' ? state.business_address : '',
      contactEmail: typeof state.contact_email === 'string' ? state.contact_email : '',
      contactPhone: typeof state.contact_phone === 'string' ? state.contact_phone : '',
      website: typeof state.website === 'string' ? state.website : '',
      representativeName: typeof state.representative_name === 'string' ? state.representative_name : '',
      representativeRole: typeof state.representative_role === 'string' ? state.representative_role : '',
      representativeIsOwnerOrOfficer: typeof state.representative_is_owner_or_officer === 'boolean' ? state.representative_is_owner_or_officer : null,
      localPermitApplicable: typeof state.local_permit_applicable === 'boolean' ? state.local_permit_applicable : null,
      status: state.status as ExistingEmployerVerification['status'],
      materialChangeRequiresEvidence: state.material_change_requires_evidence === true
    });
    let errors = validateEmployerVerificationSubmission(submission, documents, requiredFreshEvidence(toCurrentVerification(currentState), submission));
    if (errors.length) return jsonError(errors[0]);

    const organizationName = args.p_trading_name ?? args.p_registered_business_name;
    if (profile.organization_name !== organizationName) {
      const { error: profileUpdateError } = await supabase.from('profiles').update({ organization_name: organizationName }).eq('id', user.id);
      if (profileUpdateError) return jsonError('Unable to save your organization name. Correct the profile and resubmit.', 500);
      const [{ data: refreshedDocuments, error: refreshedDocumentError }, { data: refreshedState, error: refreshedStateError }] = await Promise.all([
        supabase.from('employer_verification_documents').select('document_type, submission_id').eq('employer_id', user.id),
        supabase.from('employer_verifications').select('*').eq('employer_id', user.id).maybeSingle()
      ]);
      if (refreshedDocumentError || refreshedStateError || !refreshedState) return jsonError('The organization name was saved, but verification data could not be reloaded. Refresh before continuing.', 503);
      documents = (refreshedDocuments ?? []) as unknown as EmployerVerificationDocument[];
      currentState = refreshedState as unknown as Record<string, unknown>;
      errors = validateEmployerVerificationSubmission(submission, documents, requiredFreshEvidence(toCurrentVerification(currentState), submission));
      if (errors.length) return jsonError(errors[0]);
    }

    const rpc = supabase as unknown as {
      rpc: (name: string, values: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
    };
    const { data: submissionId, error } = await rpc.rpc('submit_employer_verification', args);
    if (error) {
      if (['PGRST202', '42883', '42P01'].includes(error.code ?? '')) return jsonError('Employer verification database setup is missing. Apply migration 018_employer_verification.sql.', 503);
      if (error.code === '42501') return jsonError('This employer account is not permitted to submit verification.', 403);
      if (error.code === '55000') return jsonError('Verification cannot be submitted while another review is pending or the account is suspended.', 409);
      if (error.code === '22023') return jsonError('Check the required fields and provide evidence appropriate to your business type.', 400);
      return jsonError('Unable to submit verification. Review the entered information and try again.', 500);
    }
    const { data: verification } = await supabase.from('employer_verifications').select('status, employer_feedback').eq('employer_id', user.id).maybeSingle();
    return jsonOk({ submissionId, status: verification?.status ?? 'pending', employerFeedback: verification?.employer_feedback ?? null }, { status: 201 });
  } catch {
    return jsonError('Unable to submit employer verification.', 500);
  }
}
