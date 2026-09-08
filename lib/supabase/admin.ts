import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { getServerSupabaseEnv } from '@/lib/env';

let client: ReturnType<typeof createClient> | undefined;

/**
 * The service-role client is intentionally isolated to server-only modules.
 * Every caller must authenticate the request and perform an ownership/role
 * check before using it because this client bypasses RLS.
 */
export function createSupabaseAdminClient() {
  if (client) return client;

  const { url, serviceRoleKey } = getServerSupabaseEnv();
  client = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  return client;
}
