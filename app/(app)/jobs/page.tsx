import { redirect } from 'next/navigation';
import { JobsBrowser } from '@/components/jobs-browser';
import { getAuthenticatedContext } from '@/lib/auth';
import type { UserRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function JobsPage() {
  const { supabase, user } = await getAuthenticatedContext();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = (profile?.role ?? 'candidate') as UserRole;
  return <JobsBrowser role={role} />;
}
