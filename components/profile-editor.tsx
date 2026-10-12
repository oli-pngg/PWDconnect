'use client';

import { CheckCircle2, Eye, Keyboard, Save, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
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

function splitFullName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? '',
    middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : '',
    lastName: parts.length > 1 ? parts[parts.length - 1] : ''
  };
}

export function ProfileEditor({ role, isOnboarding = false }: { role: UserRole; isOnboarding?: boolean }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [disabilityTypes, setDisabilityTypes] = useState<string[]>([]);
  const [needs, setNeeds] = useState<string[]>([]);
  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    organizationName: '',
    headline: '',
    bio: '',
    disabilityDescription: '',
    location: 'Legazpi City, Albay',
    workMode: 'Flexible',
    availability: 'Open to opportunities',
    yearsExperience: '0'
  });
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
      const name = splitFullName(current.full_name ?? '');
      setForm({
        ...name,
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
    setDisabilityTypes((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function toggleSkill(skillId: string) {
    setSelectedSkills((current) => current.includes(skillId) ? current.filter((id) => id !== skillId) : [...current, skillId]);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fullName = [form.firstName, form.middleName, form.lastName].filter(Boolean).join(' ').trim();
    if (!form.firstName.trim() || !form.lastName.trim() || (role === 'employer' && !form.organizationName.trim()) || !form.bio.trim() || (role === 'candidate' && (!disabilityTypes.length || !form.disabilityDescription.trim()))) {
      setError(role === 'candidate'
        ? 'Add your name, profile description, PWD category, and category description before saving.'
        : 'Add your contact name, organization name, and organization description before saving.');
      return;
    }
    setPending(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          fullName,
          yearsExperience: Number(form.yearsExperience),
          disabilityTypes,
          disabilityDescription: form.disabilityDescription,
          accessibilityNeeds: needs,
           skillIds: selectedSkills
        })
      });
      const payload = await response.json() as { profile?: Profile; error?: string };
      if (!response.ok) {
        setError(payload.error || 'Unable to save profile.');
        return;
      }
      const savedProfile = payload.profile ?? profile;
      if (!savedProfile) {
        setError('Profile details were saved, but the updated profile could not be loaded.');
        return;
      }
      setProfile(savedProfile);
      setMessage(savedProfile.profile_completed ? 'Profile saved.' : 'Add the required details to finish setup.');
    } catch {
      setError('The profile could not be saved. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  if (loading) return <div className="profile-layout"><div className="skeleton-card"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line short" /></div><div className="panel"><div className="skeleton-stack"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line short" /></div></div></div>;
  if (error && !profile) return <div className="form-error" role="alert">{error} <button className="button secondary small" type="button" onClick={() => window.location.reload()}>Retry</button></div>;

  const displayName = form.organizationName || [form.firstName, form.middleName, form.lastName].filter(Boolean).join(' ') || 'Your profile';

  return <>
    <div className="page-heading">
       <div><p className="eyebrow">{isOnboarding ? 'Setup' : 'Profile'}</p><h1>{isOnboarding ? 'Set up your profile.' : 'Your profile.'}</h1></div>
       <div className="notice"><CheckCircle2 size={15} aria-hidden="true" /> {isOnboarding ? 'Required' : 'Private'}</div>
    </div>
    {isOnboarding ? <div className="notice onboarding-note" role="note"><strong>Complete required fields to continue.</strong><span>Edit anytime.</span></div> : null}
     <form className="panel profile-frame form-stack" onSubmit={save} noValidate>
       <div className="profile-frame-header">
         <div className="profile-frame-identity">
            <div className="profile-avatar" aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</div>
           <div><h2>{displayName}</h2><p>{form.headline || (role === 'employer' ? 'Organization profile' : 'Skills-first profile')}</p></div>
         </div>
         <div className="profile-frame-facts"><span>{form.location || 'Location not set'}</span><span>{form.workMode}</span><span>{selectedSkills.length} skills</span></div>
       </div>
       <div className="panel-header"><div><h2>{role === 'employer' ? 'Organization' : 'About you'}</h2><p>Used for matching.</p></div><Save size={20} aria-hidden="true" /></div>
        <div className="field-grid two">
           <div className="field-grid three name-fields"><label className="field" htmlFor="profile-first-name"><span>First name</span><input className="input" id="profile-first-name" autoComplete="given-name" value={form.firstName} onChange={(event) => updateField('firstName', event.target.value)} maxLength={40} required /></label><label className="field" htmlFor="profile-middle-name"><span>Middle name</span><input className="input" id="profile-middle-name" autoComplete="additional-name" value={form.middleName} onChange={(event) => updateField('middleName', event.target.value)} maxLength={40} /></label><label className="field" htmlFor="profile-last-name"><span>Last name</span><input className="input" id="profile-last-name" autoComplete="family-name" value={form.lastName} onChange={(event) => updateField('lastName', event.target.value)} maxLength={40} required /></label></div>
          {role === 'employer' ? <label className="field" htmlFor="organization-name"><span>Organization name</span><input className="input" id="organization-name" value={form.organizationName} onChange={(event) => updateField('organizationName', event.target.value)} maxLength={140} required /></label> : <label className="field" htmlFor="headline"><span>Professional headline</span><input className="input" id="headline" value={form.headline} onChange={(event) => updateField('headline', event.target.value)} maxLength={160} placeholder="For example: Reliable remote support specialist" /></label>}
        </div>
        {role === 'employer' ? <label className="field" htmlFor="headline"><span>Organization headline</span><input className="input" id="headline" value={form.headline} onChange={(event) => updateField('headline', event.target.value)} maxLength={160} placeholder="What kind of work does your organization offer?" /></label> : null}
          <label className="field" htmlFor="bio"><span>{role === 'employer' ? 'About the organization' : 'Profile description'} <small>(required)</small></span><textarea className="textarea" id="bio" value={form.bio} onChange={(event) => updateField('bio', event.target.value)} maxLength={1500} required aria-describedby="bio-help" placeholder={role === 'employer' ? 'Team, work, and inclusive hiring.' : 'Work you enjoy, tools, and strengths.'} /><small id="bio-help">Focus on skills, tasks, and goals.</small></label>
           {role === 'candidate' ? <div className="profile-access-block"><div className="profile-access-heading"><strong>PWD details</strong><span>Required</span></div><label className="field" htmlFor="disability-description"><span>Access description</span><textarea className="textarea" id="disability-description" value={form.disabilityDescription} onChange={(event) => updateField('disabilityDescription', event.target.value)} maxLength={1000} required aria-describedby="disability-description-help" placeholder="Example: I prefer written instructions and captions." /><small id="disability-description-help">Private. Used to provide access.</small></label>
        <div className="field-grid two">
          <label className="field" htmlFor="location"><span>Preferred location</span><input className="input" id="location" value={form.location} onChange={(event) => updateField('location', event.target.value)} maxLength={120} /></label>
          <label className="field" htmlFor="work-mode"><span>Work mode</span><select className="select" id="work-mode" value={form.workMode} onChange={(event) => updateField('workMode', event.target.value)}><option>Flexible</option><option>On-site</option><option>Hybrid</option><option>Remote</option></select></label>
        </div>
        <div className="field-grid two">
          <label className="field" htmlFor="availability"><span>Availability</span><select className="select" id="availability" value={form.availability} onChange={(event) => updateField('availability', event.target.value)}><option>Open to opportunities</option><option>Available now</option><option>Available within 30 days</option><option>Exploring options</option></select></label>
          {role === 'candidate' ? <label className="field" htmlFor="years-experience"><span>Years of experience <small>(required)</small></span><input className="input" id="years-experience" type="number" min="0" max="80" value={form.yearsExperience} onChange={(event) => updateField('yearsExperience', event.target.value)} required /></label> : <div />}
        </div>
           <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }} aria-describedby="profile-disability-help"><legend>PWD category</legend><p className="field-help" id="profile-disability-help">Choose at least one.</p><div className="disability-picker">{DISABILITY_OPTIONS.map((option) => <label className="disability-option" key={option.value}><input type="checkbox" checked={disabilityTypes.includes(option.value)} onChange={() => toggleDisability(option.value)} /><span><strong>{option.label}</strong><small>{option.description}</small></span></label>)}</div></fieldset></div> : null}
         {role === 'candidate' ? <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}><legend>Skills to match</legend><p className="field-help">Verified skills rank higher.</p><div className="skill-picker">{Object.entries(groupedSkills).map(([category, categorySkills]) => categorySkills.map((skill) => <label key={skill.id} title={category}><input type="checkbox" checked={selectedSkills.includes(skill.id)} onChange={() => toggleSkill(skill.id)} /> <span>{skill.name}</span></label>))}</div></fieldset> : null}
         {role === 'candidate' ? <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}><legend>Access preferences</legend><p className="field-help">These do not change your score.</p><div className="skill-picker">{needOptions.map((need) => <label key={need}><input type="checkbox" checked={needs.includes(need)} onChange={() => toggleNeed(need)} /> <span>{need}</span></label>)}</div></fieldset> : null}
         {role === 'candidate' ? <div className="notice"><div className="inline-actions"><Eye size={16} aria-hidden="true" /><strong>Blind matching</strong></div><span className="small-text">Employers see skills and a candidate reference first.</span></div> : null}
        {error ? <div className="form-error" role="alert">{error}</div> : null}
         {message ? <div className="form-success" role="status"><span>{message}</span>{isOnboarding && profile?.profile_completed ? <Link className="button secondary small" href="/dashboard">Continue to workspace</Link> : null}</div> : null}
        <div className="button-row"><button className="button" type="submit" disabled={pending}>{pending ? 'Saving...' : 'Save profile'} <Save size={16} aria-hidden="true" /></button>{role === 'candidate' ? <span className="field-help"><Keyboard size={14} aria-hidden="true" /> All fields work with the keyboard.</span> : <span className="field-help"><Volume2 size={14} aria-hidden="true" /> Use clear accommodation language in job posts.</span>}</div>
     </form>
  </>;
}
