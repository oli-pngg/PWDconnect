import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function getAuthenticatedContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null };
  }

  return { supabase, user };
}

export async function getOwnProfile(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, role, full_name, organization_name, headline, bio, disability_description, location, work_mode, availability, years_experience, disability_types, accessibility_needs, profile_photo_url, profile_photo_alt, profile_photo_path, profile_completed, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
