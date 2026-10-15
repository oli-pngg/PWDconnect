import { redirect } from 'next/navigation';
import { EvaluationView } from '@/components/evaluation-view';
import { getAdminAccess } from '@/lib/admin-access';

export const dynamic = 'force-dynamic';

export default async function EvaluationPage() {
  const access = await getAdminAccess();
  if (!access.user) redirect('/login');
  if (access.error || access.role !== 'admin') redirect('/dashboard');
  return <EvaluationView />;
}
