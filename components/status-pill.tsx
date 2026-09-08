import type { ApplicationStatus, JobStatus } from '@/lib/types';

export function StatusPill({ status }: { status: ApplicationStatus | JobStatus | string }) {
  return <span className={`status-pill ${status}`}>{status.replace('_', ' ')}</span>;
}
