import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const bucket = 'profile-photos';

export async function getProfilePhotoUrl(path: string | null | undefined) {
  if (!path) return null;
  const { data } = await createSupabaseAdminClient().storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
