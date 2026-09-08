'use client';

import { CheckCircle2, Eye, ImagePlus, Keyboard, Save, Volume2, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { DISABILITY_OPTIONS } from '@/lib/disability';
import { Skeleton } from '@/components/skeleton';
import type { Profile, Skill, UserRole } from '@/lib/types';

const needOptions = [
  'Screen reader support',
  'Keyboard-only navigation',
  'Captions or transcripts',
  'Flexible timing',
  'High contrast',
  'Plain-language instructions'
];

type ProfilePayload = {
  profile: Profile;
  skills: Array<{ skill_id: string; proficiency: number; source: string; skills?: Skill | Skill[] | null }>;
};

export function ProfileEditor({ role, isOnboarding = false }: { role: UserRole; isOnboarding?: boolean }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [disabilityTypes, setDisabilityTypes] = useState<string[]>([]);
  const [needs, setNeeds] = useState<string[]>([]);
  const [form, setForm] = useState({
    fullName: '',
    organizationName: '',
    headline: '',
    bio: '',
    disabilityDescription: '',
    location: 'Legazpi City, Albay',
    workMode: 'Flexible',
    availability: 'Open to opportunities',
    yearsExperience: '0'
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/profile', { cache: 'no-store' }),
      fetch('/api/skills', { cache: 'no-store' })
    ]).then(async ([profileResponse, skillsResponse]) => {
      const profilePayload = await profileResponse.json() as ProfilePayload & { error?: string };
      const skillsPayload = await skillsResponse.json() as { skills?: Skill[]; error?: string };
      if (!profileResponse.ok) throw new Error(profilePayload.error || 'Unable to load profile.');
      if (!skillsResponse.ok) throw new Error(skillsPayload.error || 'Unable to load skills.');

      const current = profilePayload.profile;
      if (!current) throw new Error('Your profile is not ready yet. Sign out, sign in again, and try once more.');
      setProfile(current);
      setForm({
        fullName: current.full_name ?? '',
        organizationName: current.organization_name ?? '',
        headline: current.headline ?? '',
        bio: current.bio ?? '',
        disabilityDescription: current.disability_description ?? '',
        location: current.location ?? 'Legazpi City, Albay',
        workMode: current.work_mode ?? 'Flexible',
        availability: current.availability ?? 'Open to opportunities',
        yearsExperience: String(current.years_experience ?? 0)
      });
      setDisabilityTypes(current.disability_types ?? []);
      setNeeds(current.accessibility_needs ?? []);
      setSelectedSkills((profilePayload.skills ?? []).map((skill) => skill.skill_id));
      setSkills(skillsPayload.skills ?? []);
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'Unable to load profile.');
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const groupedSkills = useMemo(() => skills.reduce<Record<string, Skill[]>>((groups, skill) => {
    (groups[skill.category] ??= []).push(skill);
    return groups;
  }, {}), [skills]);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleNeed(need: string) {
    setNeeds((current) => current.includes(need) ? current.filter((value) => value !== need) : [...current, need]);
  }

  function toggleDisability(value: string) {
    setDisabilityTypes((current) => {
      if (value === 'prefer_not_to_say') return current.includes(value) ? [] : [value];
      const withoutPrivateOption = current.filter((item) => item !== 'prefer_not_to_say');
      return withoutPrivateOption.includes(value) ? withoutPrivateOption.filter((item) => item !== value) : [...withoutPrivateOption, value];
    });
  }

  function toggleSkill(skillId: string) {
    setSelectedSkills((current) => current.includes(skillId) ? current.filter((id) => id !== skillId) : [...current, skillId]);
  }

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Use a JPG, PNG, or WebP image for your profile photo.');
      event.currentTarget.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Your profile photo must be smaller than 5 MB.');
      event.currentTarget.value = '';
      return;
    }
    setError('');
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function removePhoto() {
    if (photoFile) {
      setPhotoFile(null);
      setPhotoPreview('');
      return;
    }
    if (!profile?.profile_photo_url) return;
    setPending(true);
    setError('');
    const response = await fetch('/api/profile/photo', { method: 'DELETE' });
    const payload = await response.json() as { error?: string };
    if (!response.ok) setError(payload.error || 'Unable to remove your profile photo.');
    else {
      setProfile((current) => current ? { ...current, profile_photo_url: null, profile_photo_alt: null, profile_photo_path: null } : current);
      setMessage('Profile photo removed.');
    }
    setPending(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.fullName.trim() || (role === 'employer' && !form.organizationName.trim()) || !form.bio.trim() || (role === 'candidate' && (!disabilityTypes.length || !form.disabilityDescription.trim()))) {
      setError(role === 'candidate'
        ? 'Add your name, profile description, PWD category, and category description before saving.'
        : 'Add your contact name, organization name, and organization description before saving.');
      return;
    }
    setPending(true);
    setError('');
    setMessage('');
    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        yearsExperience: Number(form.yearsExperience),
        disabilityTypes,
        disabilityDescription: form.disabilityDescription,
        accessibilityNeeds: needs,
        skillIds: selectedSkills
      })
    });
    const payload = await response.json() as { profile?: Profile; error?: string };
    if (!response.ok) setError(payload.error || 'Unable to save profile.');
    else {
      let savedProfile = payload.profile ?? profile;
      if (!savedProfile) {
        setError('Profile details were saved, but the updated profile could not be loaded.');
        setPending(false);
        return;
      }
      if (photoFile) {
        const photoData = new FormData();
        photoData.append('photo', photoFile);
        photoData.append('altText', `Profile photo of ${displayName}`);
        const photoResponse = await fetch('/api/profile/photo', { method: 'POST', body: photoData });
        const photoPayload = await photoResponse.json() as { profile?: Pick<Profile, 'profile_photo_url' | 'profile_photo_alt' | 'profile_photo_path'>; error?: string };
        if (!photoResponse.ok) {
          setError(photoPayload.error || 'Profile details were saved, but the photo could not be uploaded.');
          setProfile(savedProfile);
          setPending(false);
          return;
        }
        savedProfile = { ...savedProfile, ...photoPayload.profile };
        setPhotoFile(null);
        setPhotoPreview('');
      }
      setProfile(savedProfile);
      setMessage(savedProfile?.profile_completed ? 'Profile saved. Your account setup is complete.' : 'Profile saved. Add the required details to finish setup.');
    }
    setPending(false);
  }

  if (loading) return <div className="profile-layout"><div className="skeleton-card"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line short" /></div><div className="panel"><div className="skeleton-stack"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line short" /></div></div></div>;
  if (error && !profile) return <div className="form-error" role="alert">{error}</div>;

  const displayName = form.organizationName || form.fullName || 'Your profile';
  const currentPhoto = photoPreview || profile?.profile_photo_url || '';
  const photoAlt = profile?.profile_photo_alt || `Profile photo of ${displayName}`;

  return <>
    <div className="page-heading">
      <div><p className="eyebrow">{isOnboarding ? 'Profile setup' : 'Profile and preferences'}</p><h1>{isOnboarding ? 'Set up your profile.' : 'Make your signal clear.'}</h1><p>Use short, clear details about your work. {role === 'candidate' ? 'Your PWD category and access description stay private.' : 'Your organization details help candidates understand the work.'}</p></div>
      <div className="notice"><CheckCircle2 size={15} aria-hidden="true" /> {isOnboarding ? 'Required after sign in' : 'Private by default'}</div>
    </div>
    {isOnboarding ? <div className="notice onboarding-note" role="note"><strong>Complete this form to continue.</strong><span>Fields marked required help us build a useful profile. You can edit these details at any time.</span></div> : null}
    <div className="profile-layout">
      <aside className="profile-card">
        {currentPhoto ? <Image className="profile-photo" src={currentPhoto} alt={photoAlt} width={96} height={96} unoptimized /> : <div className="profile-avatar" role="img" aria-label={`${displayName} profile photo placeholder`}>{displayName.slice(0, 1).toUpperCase()}</div>}
        <h2>{displayName}</h2>
        <p>{form.headline || (role === 'employer' ? 'Inclusive organization profile' : 'Your skills-first profile')}</p>
        <div className="profile-details">
          <div><span>Location</span><strong>{form.location || 'Not set'}</strong></div>
          <div><span>Work mode</span><strong>{form.workMode}</strong></div>
          {role === 'candidate' ? <div><span>Access profile</span><strong>{disabilityTypes.length} preference option{disabilityTypes.length === 1 ? '' : 's'} listed</strong></div> : null}
          <div><span>Selected skills</span><strong>{selectedSkills.length} skills in your profile</strong></div>
        </div>
      </aside>
      <form className="panel form-stack" onSubmit={save} noValidate>
        <div className="panel-header"><div><h2>{role === 'employer' ? 'Organization details' : 'About you'}</h2><p>Fields marked with guidance are used for matching.</p></div><Save size={20} aria-hidden="true" /></div>
        <div className="photo-field">
          <div className="photo-field-preview">{currentPhoto ? <Image src={currentPhoto} alt={`Preview: ${photoAlt}`} width={76} height={76} unoptimized /> : <ImagePlus size={22} aria-hidden="true" />}</div>
          <div className="photo-field-controls">
            <label className="field" htmlFor="profile-photo"><span>Profile photo <small>(optional)</small></span><input className="input" id="profile-photo" name="profilePhoto" type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} aria-describedby="profile-photo-help" /></label>
            <p className="field-help" id="profile-photo-help">Use a clear JPG, PNG, or WebP image smaller than 5 MB. A short description is added automatically for screen readers.</p>
            {currentPhoto ? <button className="button danger small" type="button" onClick={removePhoto} disabled={pending}><X size={14} aria-hidden="true" /> Remove photo</button> : null}
          </div>
        </div>
        <div className="field-grid two">
          <label className="field" htmlFor="profile-name"><span>{role === 'employer' ? 'Contact name' : 'Full name'}</span><input className="input" id="profile-name" value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} maxLength={100} required /></label>
          {role === 'employer' ? <label className="field" htmlFor="organization-name"><span>Organization name</span><input className="input" id="organization-name" value={form.organizationName} onChange={(event) => updateField('organizationName', event.target.value)} maxLength={140} required /></label> : <label className="field" htmlFor="headline"><span>Professional headline</span><input className="input" id="headline" value={form.headline} onChange={(event) => updateField('headline', event.target.value)} maxLength={160} placeholder="For example: Reliable remote support specialist" /></label>}
        </div>
        {role === 'employer' ? <label className="field" htmlFor="headline"><span>Organization headline</span><input className="input" id="headline" value={form.headline} onChange={(event) => updateField('headline', event.target.value)} maxLength={160} placeholder="What kind of work does your organization offer?" /></label> : null}
         <label className="field" htmlFor="bio"><span>{role === 'employer' ? 'About the organization' : 'Profile description'} <small>(required)</small></span><textarea className="textarea" id="bio" value={form.bio} onChange={(event) => updateField('bio', event.target.value)} maxLength={1500} required aria-describedby="bio-help" placeholder={role === 'employer' ? 'Describe your team, work culture, and inclusive hiring approach.' : 'Describe the work you enjoy, tools you use, or strengths you want employers to see.'} /><small id="bio-help">Use simple words and focus on skills, tasks, and goals.</small></label>
          {role === 'candidate' ? <label className="field" htmlFor="disability-description"><span>PWD category description <small>(required)</small></span><textarea className="textarea" id="disability-description" value={form.disabilityDescription} onChange={(event) => updateField('disabilityDescription', event.target.value)} maxLength={1000} required aria-describedby="disability-description-help" placeholder="Example: I prefer written instructions and captions. If you prefer privacy, write: Prefer not to say." /><small id="disability-description-help">This is private. Share only what helps us provide access. You may write &quot;Prefer not to say.&quot;</small></label> : null}
        <div className="field-grid two">
          <label className="field" htmlFor="location"><span>Preferred location</span><input className="input" id="location" value={form.location} onChange={(event) => updateField('location', event.target.value)} maxLength={120} /></label>
          <label className="field" htmlFor="work-mode"><span>Work mode</span><select className="select" id="work-mode" value={form.workMode} onChange={(event) => updateField('workMode', event.target.value)}><option>Flexible</option><option>On-site</option><option>Hybrid</option><option>Remote</option></select></label>
        </div>
        <div className="field-grid two">
          <label className="field" htmlFor="availability"><span>Availability</span><select className="select" id="availability" value={form.availability} onChange={(event) => updateField('availability', event.target.value)}><option>Open to opportunities</option><option>Available now</option><option>Available within 30 days</option><option>Exploring options</option></select></label>
          {role === 'candidate' ? <label className="field" htmlFor="years-experience"><span>Years of experience <small>(required)</small></span><input className="input" id="years-experience" type="number" min="0" max="80" value={form.yearsExperience} onChange={(event) => updateField('yearsExperience', event.target.value)} required /></label> : <div />}
        </div>
          {role === 'candidate' ? <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }} aria-describedby="profile-disability-help"><legend>PWD category <small>(required)</small></legend><p className="field-help" id="profile-disability-help">Choose at least one. This information is private and is not shown in initial employer matching.</p><div className="disability-picker">{DISABILITY_OPTIONS.map((option) => <label className="disability-option" key={option.value}><input type="checkbox" checked={disabilityTypes.includes(option.value)} onChange={() => toggleDisability(option.value)} /><span><strong>{option.label}</strong><small>{option.description}</small></span></label>)}</div></fieldset> : null}
        {role === 'candidate' ? <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}><legend>Skills you want matched</legend><p className="field-help">Choose all that apply. Assessment-verified skills receive stronger ranking weight.</p><div className="skill-picker">{Object.entries(groupedSkills).map(([category, categorySkills]) => categorySkills.map((skill) => <label key={skill.id} title={category}><input type="checkbox" checked={selectedSkills.includes(skill.id)} onChange={() => toggleSkill(skill.id)} /> <span>{skill.name}</span></label>))}</div></fieldset> : null}
        {role === 'candidate' ? <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}><legend>Interaction preferences</legend><p className="field-help">These preferences tailor the experience. They are not used to lower your fit score.</p><div className="skill-picker">{needOptions.map((need) => <label key={need}><input type="checkbox" checked={needs.includes(need)} onChange={() => toggleNeed(need)} /> <span>{need}</span></label>)}</div></fieldset> : null}
        {role === 'candidate' ? <div className="notice"><div className="inline-actions"><Eye size={16} aria-hidden="true" /><strong>Blind matching is on</strong></div><span className="small-text">Initial employer previews use skills, verification, fit score, and a candidate reference. Your name, disability types, and interaction preferences stay out of that first view.</span></div> : null}
        {error ? <div className="form-error" role="alert">{error}</div> : null}
         {message ? <div className="form-success" role="status"><span>{message}</span>{isOnboarding && profile?.profile_completed ? <Link className="button secondary small" href="/dashboard">Continue to workspace</Link> : null}</div> : null}
        <div className="button-row"><button className="button" type="submit" disabled={pending}>{pending ? 'Saving...' : 'Save profile'} <Save size={16} aria-hidden="true" /></button>{role === 'candidate' ? <span className="field-help"><Keyboard size={14} aria-hidden="true" /> All fields work with the keyboard.</span> : <span className="field-help"><Volume2 size={14} aria-hidden="true" /> Use clear accommodation language in job posts.</span>}</div>
      </form>
    </div>
  </>;
}
