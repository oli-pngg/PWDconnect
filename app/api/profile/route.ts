import { getAuthenticatedContext } from '@/lib/auth';
import { DISABILITY_VALUES } from '@/lib/disability';
import { cleanAllowedArray, cleanStringArray, cleanText, cleanUuidArray, jsonError, jsonOk, safeInteger } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

const profileSelect = 'id, email, role, full_name, organization_name, headline, bio, disability_description, location, work_mode, availability, years_experience, disability_types, accessibility_needs, profile_photo_url, profile_photo_alt, profile_photo_path, profile_completed, created_at, updated_at';
const setupError = 'Profile setup is not ready. Run supabase/migrations/004_accessible_profiles_and_photos.sql in your Supabase project, then sign out and sign in again.';

function isSetupError(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(error && ['42703', '42P01', 'PGRST204', 'PGRST205'].includes(error.code ?? '')) || Boolean(error?.message?.toLowerCase().includes('profile_completed'));
}

export async function GET(request: Request) {
  const limited = checkRateLimit(request, 'profile-read', { limit: 60, windowMs: 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);

    const [{ data: profile, error: profileError }, { data: profileSkills, error: skillsError }] = await Promise.all([
      supabase.from('profiles').select(profileSelect).eq('id', user.id).maybeSingle(),
      supabase.from('profile_skills').select('skill_id, proficiency, source, skills(id, slug, name, category)').eq('profile_id', user.id)
    ]);
    if (isSetupError(profileError) || isSetupError(skillsError)) return jsonError(setupError, 500);
    if (profileError || skillsError) return jsonError('Unable to load your profile.', 500);
    return jsonOk({ profile, skills: profileSkills ?? [] });
  } catch {
    return jsonError('Unable to load your profile.', 500);
  }
}

export async function PATCH(request: Request) {
  const limited = checkRateLimit(request, 'profile-write', { limit: 20, windowMs: 10 * 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const body = await request.json() as Record<string, unknown>;
    const existing = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (isSetupError(existing.error)) return jsonError(setupError, 500);
    if (existing.error || !existing.data) return jsonError('Profile not found.', 404);

    const role = existing.data.role;
    const fullName = cleanText(body.fullName, 100);
    const organizationName = role === 'employer' ? cleanText(body.organizationName, 140) || null : null;
    const headline = cleanText(body.headline, 160) || null;
    const bio = cleanText(body.bio, 1500) || null;
    const disabilityDescription = role === 'candidate' ? cleanText(body.disabilityDescription, 1000) || null : null;
    const disabilityTypes = cleanAllowedArray(body.disabilityTypes, DISABILITY_VALUES, 6);
    const location = cleanText(body.location, 120) || 'Legazpi City, Albay';
    const workMode = cleanText(body.workMode, 50) || 'Flexible';
    const availability = cleanText(body.availability, 80) || 'Open to opportunities';
    const yearsExperience = Math.max(0, Math.min(safeInteger(body.yearsExperience), 80));
    const accessibilityNeeds = cleanStringArray(body.accessibilityNeeds, 8, 80);
    const profileCompleted = role === 'candidate'
      ? Boolean(fullName && bio && disabilityDescription && disabilityTypes.length && workMode)
      : role === 'employer'
        ? Boolean(fullName && organizationName && bio && workMode)
        : Boolean(fullName && bio);
    if (!fullName || !bio || (role === 'employer' && !organizationName) || (role === 'candidate' && (!disabilityDescription || !disabilityTypes.length))) {
      return jsonError(role === 'candidate'
        ? 'Add your name, profile description, PWD category, and category description before saving.'
        : role === 'employer'
          ? 'Add your contact name, organization name, and organization description before saving.'
          : 'Add your name and profile description before saving.');
    }
    const update = {
      full_name: fullName,
      organization_name: organizationName,
      headline,
      bio,
      disability_description: disabilityDescription,
      location,
      work_mode: workMode,
      availability,
      years_experience: yearsExperience,
      disability_types: disabilityTypes,
      accessibility_needs: accessibilityNeeds,
      profile_photo_alt: cleanText(body.profilePhotoAlt, 160) || null,
      profile_completed: profileCompleted
    };

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .update(update)
      .eq('id', user.id)
      .select(profileSelect)
      .single();
    if (isSetupError(profileError)) return jsonError(setupError, 500);
    if (profileError) return jsonError('Unable to save your profile.', 500);

    const skillIds = cleanUuidArray(body.skillIds, 20);
    const { data: currentSkills, error: currentSkillsError } = await supabase
      .from('profile_skills')
      .select('skill_id, proficiency, source, verified_at')
      .eq('profile_id', user.id);
    if (currentSkillsError) return jsonError('Unable to update skills.', 500);

    const validSkills = skillIds.length
      ? await supabase.from('skills').select('id').in('id', skillIds).eq('is_active', true)
      : { data: [], error: null };
    if (validSkills.error) return jsonError('Unable to validate selected skills.', 500);
    const validIds = new Set((validSkills.data ?? []).map((skill) => skill.id));
    const selectedIds = [...validIds];
    const currentById = new Map((currentSkills ?? []).map((skill) => [skill.skill_id, skill]));

    const selectedSet = new Set(selectedIds);
    const removedIds = (currentSkills ?? []).map((skill) => skill.skill_id).filter((skillId) => !selectedSet.has(skillId));
    const deleteResults = await Promise.all(removedIds.map((skillId) => supabase.from('profile_skills').delete().eq('profile_id', user.id).eq('skill_id', skillId)));
    if (deleteResults.some((result) => result.error)) return jsonError('Unable to update selected skills.', 500);

    if (selectedIds.length) {
      const rows = selectedIds.filter((skillId) => currentById.get(skillId)?.source !== 'assessment_verified').map((skillId) => {
        const current = currentById.get(skillId);
        return {
          profile_id: user.id,
          skill_id: skillId,
          proficiency: current?.proficiency ?? 2,
          source: current?.source ?? 'self_reported',
          verified_at: current?.verified_at ?? null
        };
      });
      const { error: insertError } = await supabase.from('profile_skills').upsert(rows, { onConflict: 'profile_id,skill_id' });
      if (insertError) return jsonError('Unable to save selected skills.', 500);
    }

    return jsonOk({ profile, skills: selectedIds });
  } catch {
    return jsonError('Unable to save your profile.', 500);
  }
}
