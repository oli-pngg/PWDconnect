import { MessageInbox } from '@/components/message-inbox';
import { getAuthenticatedContext } from '@/lib/auth';
import type { UserRole } from '@/lib/types';
import { redirect } from 'next/navigation';

export default async function MessagesPage() {
  const { supabase, user } = await getAuthenticatedContext();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  return <MessageInbox role={(profile?.role ?? 'candidate') as UserRole} />;
}
