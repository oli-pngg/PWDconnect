'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getPublicSupabaseEnv } from '@/lib/env';

let client: ReturnType<typeof createBrowserClient> | undefined;

export function createSupabaseBrowserClient() {
  if (client) return client;

  const { url, anonKey } = getPublicSupabaseEnv();
  client = createBrowserClient(url, anonKey);
  return client;
}
