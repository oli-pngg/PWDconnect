import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const bucket = 'profile-photos';
const uuidPattern = '[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}';

export function isOwnedProfilePhotoPath(path: string | null | undefined, ownerId: string): path is string {
  if (!path || !new RegExp(`^${uuidPattern}$`, 'i').test(ownerId)) return false;
  const [pathOwner, filename, extra] = path.split('/');
  return pathOwner?.toLowerCase() === ownerId.toLowerCase()
    && !extra
    && new RegExp(`^${uuidPattern}\\.(?:jpg|png|webp)$`, 'i').test(filename ?? '');
}

export async function getProfilePhotoUrl(path: string | null | undefined, ownerId: string) {
  if (!isOwnedProfilePhotoPath(path, ownerId)) return null;
  const { data } = await createSupabaseAdminClient().storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
