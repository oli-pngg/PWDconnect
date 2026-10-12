import { getAuthenticatedContext } from '@/lib/auth';
import { bodyTooLarge, cleanText, jsonError, jsonOk } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getProfilePhotoUrl } from '@/lib/profile-photo';

const bucket = 'profile-photos';
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxBytes = 5 * 1024 * 1024;

function extensionFor(type: string) {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}

async function hasImageSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const startsWith = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (file.type === 'image/jpeg') return startsWith(0xff, 0xd8, 0xff);
  if (file.type === 'image/png') return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  return startsWith(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
}

export async function POST(request: Request) {
  if (bodyTooLarge(request, 6 * 1024 * 1024)) return jsonError('Photo upload is too large.', 413);
  const limited = checkRateLimit(request, 'profile-photo-write', { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const formData = await request.formData();
    const file = formData.get('photo');
    if (!(file instanceof File)) return jsonError('Choose a profile photo first.');
    if (!allowedTypes.has(file.type)) return jsonError('Use a JPG, PNG, or WebP image.');
    if (file.size <= 0 || file.size > maxBytes) return jsonError('Your profile photo must be smaller than 5 MB.');
    if (!(await hasImageSignature(file))) return jsonError('The uploaded file is not a valid image.');

    const profileResult = await supabase.from('profiles').select('full_name, organization_name, profile_photo_path').eq('id', user.id).maybeSingle();
    const profileData = profileResult.data as unknown as { full_name: string; organization_name: string | null; profile_photo_path: string | null } | null;
    if (profileResult.error || !profileData) return jsonError('Profile not found.', 404);

    const path = `${user.id}/${crypto.randomUUID()}.${extensionFor(file.type)}`;
    const admin = createSupabaseAdminClient();
    const upload = await admin.storage.from(bucket).upload(path, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false
    });
    if (upload.error) return jsonError('The photo could not be uploaded. Run the profile photo migration, then try again.', 500);

    const fallbackName = profileData.organization_name || profileData.full_name || 'profile';
    const altText = cleanText(formData.get('altText'), 160) || `Profile photo of ${fallbackName}`;
    const { data: profile, error: updateError } = await admin
      .from('profiles')
      .update({ profile_photo_url: null, profile_photo_alt: altText, profile_photo_path: path } as never)
      .eq('id', user.id)
      .select('id, profile_photo_url, profile_photo_alt, profile_photo_path')
      .single();
    if (updateError || !profile) {
      await admin.storage.from(bucket).remove([path]);
      return jsonError('The photo was uploaded but could not be linked to your profile.', 500);
    }

    if (profileData.profile_photo_path) {
      await admin.storage.from(bucket).remove([profileData.profile_photo_path]);
    }
    const savedProfile = profile as unknown as { id: string; profile_photo_url: string | null; profile_photo_alt: string | null; profile_photo_path: string | null };
    return jsonOk({ profile: { ...savedProfile, profile_photo_url: await getProfilePhotoUrl(path) } });
  } catch {
    return jsonError('The profile photo could not be uploaded.', 500);
  }
}

export async function DELETE(request: Request) {
  const limited = checkRateLimit(request, 'profile-photo-delete', { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  try {
    const { user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const admin = createSupabaseAdminClient();
    const { data: rawProfile, error: profileError } = await admin.from('profiles').select('profile_photo_path').eq('id', user.id).maybeSingle();
    const profile = rawProfile as unknown as { profile_photo_path: string | null } | null;
    if (profileError || !profile) return jsonError('Profile not found.', 404);
    if (profile.profile_photo_path) await admin.storage.from(bucket).remove([profile.profile_photo_path]);
    const { error } = await admin.from('profiles').update({ profile_photo_url: null, profile_photo_alt: null, profile_photo_path: null } as never).eq('id', user.id);
    if (error) return jsonError('The profile photo could not be removed.', 500);
    return jsonOk({ removed: true });
  } catch {
    return jsonError('The profile photo could not be removed.', 500);
  }
}
