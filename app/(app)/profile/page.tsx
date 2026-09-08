import { redirect } from 'next/navigation';
import { ProfileEditor } from '@/components/profile-editor';
import { getAuthenticatedContext } from '@/lib/auth';
import type { UserRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const { supabase, user } = await getAuthenticatedContext();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const params = await searchParams;
  return <ProfileEditor role={(profile?.role ?? 'candidate') as UserRole} isOnboarding={params.setup === '1'} />;
}
