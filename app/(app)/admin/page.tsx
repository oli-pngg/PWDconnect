import { redirect } from 'next/navigation';
import { AdminVerificationOverview } from '@/components/admin-verification-overview';
import { getAdminAccess } from '@/lib/admin-access';

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  const access = await getAdminAccess();
  if (!access.user) redirect('/login');
  if (access.error || access.role !== 'admin') redirect('/dashboard');
  return <AdminVerificationOverview />;
}
