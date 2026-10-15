import { redirect } from 'next/navigation';
import { EmployerVerificationDetail } from '@/components/employer-verification-detail';
import { getAdminAccess } from '@/lib/admin-access';

export const dynamic = 'force-dynamic';

export default async function EmployerVerificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await getAdminAccess();
  if (!access.user) redirect('/login');
  if (access.error || access.role !== 'admin') redirect('/dashboard');
  const { id } = await params;
  return <EmployerVerificationDetail key={id} employerId={id} />;
}
