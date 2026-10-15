import { redirect } from 'next/navigation';
import { EmployerVerificationQueue } from '@/components/employer-verification-queue';
import { getAdminAccess } from '@/lib/admin-access';

export const dynamic = 'force-dynamic';

export default async function EmployerVerificationQueuePage() {
  const access = await getAdminAccess();
  if (!access.user) redirect('/login');
  if (access.error || access.role !== 'admin') redirect('/dashboard');
  return <EmployerVerificationQueue />;
}
