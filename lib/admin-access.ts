import 'server-only';

import { getAuthenticatedContext } from '@/lib/auth';

export async function getAdminAccess() {
  const { supabase, user } = await getAuthenticatedContext();
  if (!user) return { supabase, user: null, role: null, error: null };

  const { data: profile, error } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  return { supabase, user, role: profile?.role ?? null, error };
}
