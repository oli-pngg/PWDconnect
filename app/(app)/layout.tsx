import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getAuthenticatedContext } from '@/lib/auth';
import type { Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';

const shellProfileSelect = 'id, email, role, full_name, organization_name, headline, bio, disability_description, location, work_mode, availability, years_experience, disability_types, accessibility_needs, profile_photo_url, profile_photo_alt, profile_photo_path, profile_completed, created_at, updated_at';

export default async function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { supabase, user } = await getAuthenticatedContext();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select(shellProfileSelect)
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    const requestedRole = user.user_metadata?.role === 'employer' ? 'employer' : 'candidate';
    const { data: createdProfile } = await supabase
      .from('profiles')
      .insert({ id: user.id, email: user.email ?? '', full_name: user.user_metadata?.full_name ?? '', role: requestedRole })
      .select(shellProfileSelect)
      .single();

    if (createdProfile) return <AppShell profile={createdProfile as Profile}>{children}</AppShell>;

    // Keep an authenticated user out of a redirect loop if the profile trigger
    // or a pending migration has not completed yet. API screens will show the
    // actionable data/setup error instead of pretending the session is absent.
    const fallbackProfile: Profile = {
      id: user.id,
      email: user.email ?? '',
      role: requestedRole,
      full_name: user.user_metadata?.full_name ?? '',
      organization_name: null,
      headline: null,
      bio: null,
      disability_description: null,
      location: 'Legazpi City, Albay',
      work_mode: 'Flexible',
      availability: 'Open to opportunities',
      years_experience: 0,
      disability_types: [],
      accessibility_needs: [],
      profile_photo_url: null,
      profile_photo_alt: null,
      profile_completed: false
    };
    return <AppShell profile={fallbackProfile}>{children}</AppShell>;
  }

  return <AppShell profile={profile as Profile}>{children}</AppShell>;
}
