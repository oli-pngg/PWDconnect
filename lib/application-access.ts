import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { ApplicationStatus } from '@/lib/types';

type ApplicationRow = {
  id: string;
  job_id: string;
  candidate_id: string;
  status: ApplicationStatus;
  jobs: { id: string; title: string; employer_id: string } | Array<{ id: string; title: string; employer_id: string }> | null;
};

export type ApplicationAccess = {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  candidateId: string;
  employerId: string;
  applicationStatus: ApplicationStatus;
  participantRole: 'candidate' | 'employer';
  participantLabel: string;
};

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function candidateReference(candidateId: string) {
  return `Candidate ${candidateId.replace(/-/g, '').slice(0, 4).toUpperCase()}`;
}

export async function getApplicationAccess(userId: string, applicationId: string): Promise<ApplicationAccess | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('applications')
    .select('id, job_id, candidate_id, status, jobs!inner(id, title, employer_id)')
    .eq('id', applicationId)
    .maybeSingle();

  if (error) throw error;
  const application = data as unknown as ApplicationRow | null;
  const job = one(application?.jobs);
  if (!application || !job) return null;

  const participantRole = application.candidate_id === userId
    ? 'candidate'
    : job.employer_id === userId
      ? 'employer'
      : null;
  if (!participantRole) return null;

  let participantLabel = candidateReference(application.candidate_id);
  if (participantRole === 'candidate') {
    const { data: rawEmployer } = await admin
      .from('profiles')
      .select('organization_name')
      .eq('id', job.employer_id)
      .maybeSingle();
    const employer = rawEmployer as unknown as { organization_name: string | null } | null;
    participantLabel = employer?.organization_name || 'PWD Connect employer';
  }

  return {
    applicationId: application.id,
    jobId: application.job_id,
    jobTitle: job.title,
    candidateId: application.candidate_id,
    employerId: job.employer_id,
    applicationStatus: application.status,
    participantRole,
    participantLabel
  };
}
