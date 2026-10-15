import { getAuthenticatedContext } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { ApplicationStatus, ConversationSummary, JobOffer, Message } from '@/lib/types';

type ApplicationRow = {
  id: string;
  job_id: string;
  candidate_id: string;
  status: ApplicationStatus;
  created_at: string;
  jobs: { id: string; title: string; employer_id: string } | Array<{ id: string; title: string; employer_id: string }> | null;
};

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function candidateReference(candidateId: string) {
  return `Candidate ${candidateId.replace(/-/g, '').slice(0, 4).toUpperCase()}`;
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'candidate' && profile?.role !== 'employer') return jsonError('Only candidate and employer accounts can use messages.', 403);
    if (profile.role === 'employer') {
      const { data: verification, error: verificationError } = await supabase.from('employer_verifications').select('status').eq('employer_id', user.id).maybeSingle();
      if (verificationError || !verification) return jsonError('Employer verification setup is missing. Apply migration 018_employer_verification.sql.', 503);
      if (verification.status !== 'approved') return jsonError('Applicant conversations are available after employer verification is approved.', 403);
    }
    const limited = await checkRateLimit(request, 'messages-read', { limit: 60, windowMs: 60 * 1000 }, user.id);
    if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);

    const admin = createSupabaseAdminClient();
    let applicationsQuery = admin
      .from('applications')
      .select('id, job_id, candidate_id, status, created_at, jobs!inner(id, title, employer_id)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (profile.role === 'candidate') {
      applicationsQuery = applicationsQuery.eq('candidate_id', user.id);
    } else {
      const jobsResult = await admin.from('jobs').select('id').eq('employer_id', user.id);
      if (jobsResult.error) return jsonError('Unable to load your openings.', 500);
      const jobs = (jobsResult.data ?? []) as unknown as Array<{ id: string }>;
      const jobIds = jobs.map((job) => job.id);
      if (!jobIds.length) return jsonOk({ conversations: [] as ConversationSummary[] });
      applicationsQuery = applicationsQuery.in('job_id', jobIds);
    }

    const { data, error } = await applicationsQuery;
    if (error) return jsonError('Unable to load your conversations.', 500);
    const applications = (data ?? []) as unknown as ApplicationRow[];
    if (!applications.length) return jsonOk({ conversations: [] as ConversationSummary[] });

    const applicationIds = applications.map((application) => application.id);
    const employerIds = [...new Set(applications.map((application) => one(application.jobs)?.employer_id).filter(Boolean))] as string[];
    const [{ data: messages, error: messagesError }, { data: offers, error: offersError }, { data: employers }] = await Promise.all([
      admin.from('messages').select('id, application_id, sender_id, body, read_at, created_at').in('application_id', applicationIds).order('created_at', { ascending: false }).limit(1000),
      admin.from('job_offers').select('id, application_id, job_id, employer_id, candidate_id, message, compensation, start_date, status, created_at, responded_at').in('application_id', applicationIds),
      employerIds.length ? admin.from('profiles').select('id, organization_name').in('id', employerIds) : Promise.resolve({ data: [] })
    ]);
    if (messagesError || offersError) return jsonError('Unable to load your conversations.', 500);

    const messagesByApplication = new Map<string, Message>();
    const unreadByApplication = new Map<string, number>();
    for (const rawMessage of (messages ?? []) as unknown as Message[]) {
      if (!messagesByApplication.has(rawMessage.application_id)) messagesByApplication.set(rawMessage.application_id, rawMessage);
      if (rawMessage.sender_id !== user.id && !rawMessage.read_at) unreadByApplication.set(rawMessage.application_id, (unreadByApplication.get(rawMessage.application_id) ?? 0) + 1);
    }
    const offerRows = (offers ?? []) as unknown as JobOffer[];
    const employerRows = (employers ?? []) as unknown as Array<{ id: string; organization_name: string | null }>;
    const offersByApplication = new Map(offerRows.map((offer) => [offer.application_id, offer]));
    const employerNames = new Map(employerRows.map((employer) => [employer.id, employer.organization_name]));

    const conversations = applications.map((application) => {
      const job = one(application.jobs);
      const employerId = job?.employer_id ?? '';
      return {
        application_id: application.id,
        job_id: application.job_id,
        job_title: job?.title ?? 'Opening',
        participant_label: profile.role === 'candidate' ? employerNames.get(employerId) || 'PWD Connect employer' : candidateReference(application.candidate_id),
        application_status: application.status,
        last_message: messagesByApplication.get(application.id) ?? null,
        unread_count: unreadByApplication.get(application.id) ?? 0,
        offer_status: offersByApplication.get(application.id)?.status ?? null
      } satisfies ConversationSummary;
    });

    conversations.sort((left, right) => {
      const leftDate = left.last_message?.created_at ?? applications.find((application) => application.id === left.application_id)?.created_at ?? '';
      const rightDate = right.last_message?.created_at ?? applications.find((application) => application.id === right.application_id)?.created_at ?? '';
      return rightDate.localeCompare(leftDate);
    });
    return jsonOk({ conversations });
  } catch {
    return jsonError('Unable to load your conversations.', 500);
  }
}
