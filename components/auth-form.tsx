'use client';

import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, ImagePlus, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { AccessibilityTools } from '@/components/accessibility-tools';
import { BrandMark } from '@/components/brand-mark';
import { LanguageSwitcher, useLanguage } from '@/components/language-provider';
import { TextToSpeechControls } from '@/components/text-to-speech-controls';
import { VoiceSignupControls } from '@/components/voice-signup-controls';
import { isSupabaseConfigured } from '@/lib/env';
import { DISABILITY_OPTIONS } from '@/lib/disability';

type AuthMode = 'login' | 'register';
type Role = 'candidate' | 'employer';
type RegisterStep = 'account' | 'profile';

const profileNeedOptions = [
  'Screen reader support',
  'Keyboard-only navigation',
  'Captions or transcripts',
  'Flexible timing',
  'High contrast',
  'Plain-language instructions'
];

function safeNext(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';
}

function friendlyAuthError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('rate limit') || normalized.includes('too many') || normalized.includes('email rate')) {
    return 'Too many attempts were made from this device. Please wait a few minutes, then try again. This safety limit protects every PWD Connect account.';
  }
  if (normalized.includes('invalid login credentials')) {
    return 'The email or password is incorrect. Check both fields and try again.';
  }
  if (normalized.includes('user already registered')) {
    return 'This email already has an account. Choose Sign in instead.';
  }
  return message;
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { language, t } = useLanguage();
  const [registerStep, setRegisterStep] = useState<RegisterStep>('account');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('candidate');
  const [organizationName, setOrganizationName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [disabilityDescription, setDisabilityDescription] = useState('');
  const [disabilityTypes, setDisabilityTypes] = useState<string[]>([]);
  const [accessibilityNeeds, setAccessibilityNeeds] = useState<string[]>([]);
  const [location, setLocation] = useState('Legazpi City, Albay');
  const [workMode, setWorkMode] = useState('Flexible');
  const [availability, setAvailability] = useState('Open to opportunities');
  const [yearsExperience, setYearsExperience] = useState('0');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const isLogin = mode === 'login';
  const isProfileStep = !isLogin && registerStep === 'profile';
  const profileName = organizationName || fullName || 'your profile';

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  function toggleDisability(value: string) {
    setDisabilityTypes((current) => {
      if (value === 'prefer_not_to_say') return current.includes(value) ? [] : [value];
      const withoutPrivateOption = current.filter((item) => item !== 'prefer_not_to_say');
      return withoutPrivateOption.includes(value) ? withoutPrivateOption.filter((item) => item !== value) : [...withoutPrivateOption, value];
    });
  }

  function toggleNeed(value: string) {
    setAccessibilityNeeds((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
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

  function validateAccount() {
    if (!isLogin && !fullName.trim()) return 'Enter your name to create the account.';
    if (!email.trim() || !email.includes('@')) return 'Enter a valid email address to continue.';
    if (password.length < 12) return 'Use a password with at least 12 characters.';
    return '';
  }

  function validateProfile() {
    if (!fullName.trim() || !bio.trim()) return role === 'candidate' ? 'Add your name and profile description.' : 'Add your contact name and organization description.';
    if (role === 'employer' && !organizationName.trim()) return 'Add your organization name.';
    if (role === 'candidate' && (!disabilityTypes.length || !disabilityDescription.trim())) return 'Choose a PWD category and add a short category description.';
    return '';
  }

  async function saveProfile() {
    const profileResponse = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName,
        organizationName,
        headline,
        bio,
        disabilityDescription,
        disabilityTypes,
        accessibilityNeeds,
        location,
        workMode,
        availability,
        yearsExperience: Number(yearsExperience),
        skillIds: []
      })
    });
    const profilePayload = await profileResponse.json() as { error?: string };
    if (!profileResponse.ok) throw new Error(profilePayload.error || 'Unable to save your profile.');

    if (photoFile) {
      const photoData = new FormData();
      photoData.append('photo', photoFile);
      photoData.append('altText', `Profile photo of ${profileName}`);
      const photoResponse = await fetch('/api/profile/photo', { method: 'POST', body: photoData });
      const photoPayload = await photoResponse.json() as { error?: string };
      if (!photoResponse.ok) throw new Error(photoPayload.error || 'Your profile was saved, but the photo could not be uploaded.');
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!isSupabaseConfigured()) {
      setError('This deployment is not connected to Supabase yet. Add the public environment variables from .env.example, then try again.');
      return;
    }

    const accountError = validateAccount();
    if (accountError) {
      setError(accountError);
      return;
    }
    if (!isLogin && !isProfileStep) {
      setRegisterStep('profile');
      return;
    }

    const profileError = !isLogin ? validateProfile() : '';
    if (profileError) {
      setError(profileError);
      return;
    }

    setPending(true);
    try {
      const response = await fetch(isLogin ? '/api/auth/sign-in' : '/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, fullName: fullName.trim(), role })
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(friendlyAuthError(result.error || 'Unable to access your account.'));
        setPending(false);
        return;
      }

      if (!isLogin) {
        try {
          await saveProfile();
        } catch (profileSaveError: unknown) {
          setError(profileSaveError instanceof Error ? profileSaveError.message : 'Your account was created, but the profile could not be saved.');
          setPending(false);
          router.replace('/profile?setup=1');
          return;
        }
      }

      const next = encodeURIComponent(safeNext(searchParams.get('next')));
      router.replace(`/auth/continue?next=${next}`);
    } catch {
      setError('The server could not be reached. Check your connection and try again.');
      setPending(false);
    }
  }

  function backToAccount() {
    setError('');
    setRegisterStep('account');
  }

  return (
    <div className={`auth-page auth-centered-page ${isLogin ? 'login-page' : 'register-page'}`}>
      <aside className="auth-aside">
        <BrandMark />
        <div className="auth-copy">
          <p className="eyebrow">{isLogin ? 'Welcome back' : 'A place to begin'}</p>
          <h1>{isLogin ? 'Pick up where your skills left off.' : 'Bring your strengths into focus.'}</h1>
          <p>{isLogin ? 'Your recommendations, applications, and progress stay in your account.' : 'Create an account and build your profile in the same guided flow.'}</p>
          <ul className="auth-points">
            <li><CheckCircle2 size={17} aria-hidden="true" /> Your account data is scoped to your authenticated user.</li>
            <li><CheckCircle2 size={17} aria-hidden="true" /> Employers receive skills-first previews before personal details.</li>
            <li><CheckCircle2 size={17} aria-hidden="true" /> Keyboard navigation and visible focus are built in.</li>
          </ul>
        </div>
      </aside>
      <main className="auth-main" id="main-content">
        <div className="auth-main-inner">
          <div className="register-brand"><BrandMark href="/" /></div>
          <div className="auth-accessibility"><LanguageSwitcher /><AccessibilityTools /><TextToSpeechControls /></div>
          <section className="auth-card" aria-labelledby="auth-title">
            <div className="auth-switch" aria-label="Account actions">
              <Link className={isLogin ? 'active' : ''} href="/login">{t('signIn')}</Link>
              <Link className={!isLogin ? 'active' : ''} href="/register">{t('createAccount')}</Link>
            </div>
            {isLogin ? <p className="eyebrow auth-card-eyebrow">Welcome back</p> : null}
            <h1 id="auth-title" tabIndex={-1}>{isProfileStep ? 'Build your profile' : isLogin ? t('signIn') : t('createAccount')}</h1>
            <p id="auth-description">{isProfileStep ? 'Add the details employers need to understand your work. You can edit them later.' : isLogin ? (language === 'tl' ? 'Ilagay ang email at password para magpatuloy.' : 'Enter your email and password to continue.') : (language === 'tl' ? 'Ilagay muna ang account details. Susunod ang profile builder.' : 'Enter your account details first.')}</p>
            {!isLogin && !isProfileStep ? <VoiceSignupControls onName={setFullName} onEmail={setEmail} onRole={setRole} /> : null}
            <form className="form-stack" onSubmit={submit} noValidate aria-describedby="auth-description">
              {!isProfileStep ? <>
                {!isLogin ? <div className="field"><label htmlFor="full-name">{language === 'tl' ? 'Pangalan' : 'Your name'}</label><input className="input" id="full-name" name="fullName" autoComplete="name" autoFocus required value={fullName} onChange={(event) => setFullName(event.target.value)} /></div> : null}
                {!isLogin ? <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}><legend>{language === 'tl' ? 'Uri ng account' : 'Account type'}</legend><div className="role-grid"><div className="role-option"><input id="role-candidate" name="role" type="radio" value="candidate" checked={role === 'candidate'} onChange={() => setRole('candidate')} /><label htmlFor="role-candidate"><strong>{language === 'tl' ? 'Maghanap ng trabaho' : 'Find work'}</strong><span>{language === 'tl' ? 'Ako ay naghahanap ng trabaho.' : 'I am a job seeker.'}</span></label></div><div className="role-option"><input id="role-employer" name="role" type="radio" value="employer" checked={role === 'employer'} onChange={() => setRole('employer')} /><label htmlFor="role-employer"><strong>{language === 'tl' ? 'Mag-hire nang patas' : 'Hire inclusively'}</strong><span>{language === 'tl' ? 'Kumakatawan ako sa isang organisasyon.' : 'I represent an organization.'}</span></label></div></div></fieldset> : null}
                <div className="field"><label htmlFor="email">Email address</label><input className="input" id="email" name="email" type="email" autoComplete="email" inputMode="email" autoFocus={isLogin} required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
                <div className="field"><label htmlFor="password">Password</label><div style={{ position: 'relative' }}><input className="input" style={{ paddingRight: 48 }} id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={isLogin ? 'current-password' : 'new-password'} minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} /><button className="icon-button" style={{ position: 'absolute', top: 2, right: 2, width: 42, height: 42, border: 0 }} type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}</button></div><small>{language === 'tl' ? 'Hindi bababa sa 12 character. Huwag gamitin muli ang work password.' : 'At least 12 characters.'}</small></div>
              </> : <>
                <div className="notice"><strong>{role === 'candidate' ? 'Job seeker profile' : 'Employer profile'}</strong><span>Account: {email}</span></div>
                <div className="field-grid two">
                  <label className="field" htmlFor="profile-name"><span>{role === 'employer' ? 'Contact name' : 'Full name'} <small>(required)</small></span><input className="input" id="profile-name" value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={100} required /></label>
                  {role === 'employer' ? <label className="field" htmlFor="organization-name"><span>Organization name <small>(required)</small></span><input className="input" id="organization-name" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} maxLength={140} required /></label> : <label className="field" htmlFor="profile-headline"><span>Professional headline</span><input className="input" id="profile-headline" value={headline} onChange={(event) => setHeadline(event.target.value)} maxLength={160} placeholder="For example: Remote support specialist" /></label>}
                </div>
                {role === 'employer' ? <label className="field" htmlFor="profile-headline"><span>Organization headline</span><input className="input" id="profile-headline" value={headline} onChange={(event) => setHeadline(event.target.value)} maxLength={160} placeholder="What kind of work does your organization offer?" /></label> : null}
                <label className="field" htmlFor="profile-bio"><span>{role === 'employer' ? 'Organization description' : 'Profile description'} <small>(required)</small></span><textarea className="textarea" id="profile-bio" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={1500} required placeholder={role === 'employer' ? 'Describe your team, work, and inclusive hiring approach.' : 'Describe the work you enjoy, tools you use, or strengths you want employers to see.'} /></label>
                {role === 'candidate' ? <label className="field" htmlFor="signup-disability-description"><span>PWD category description <small>(required)</small></span><textarea className="textarea" id="signup-disability-description" value={disabilityDescription} onChange={(event) => setDisabilityDescription(event.target.value)} maxLength={1000} required placeholder="Example: I prefer written instructions and captions. You may write: Prefer not to say." /><small>This information is private. Share only what helps us provide access.</small></label> : null}
                <div className="field-grid two">
                  <label className="field" htmlFor="signup-location"><span>Preferred location</span><input className="input" id="signup-location" value={location} onChange={(event) => setLocation(event.target.value)} maxLength={120} /></label>
                  <label className="field" htmlFor="signup-work-mode"><span>Work mode <small>(required)</small></span><select className="select" id="signup-work-mode" value={workMode} onChange={(event) => setWorkMode(event.target.value)}><option>Flexible</option><option>On-site</option><option>Hybrid</option><option>Remote</option></select></label>
                </div>
                <div className="field-grid two">
                  <label className="field" htmlFor="signup-availability"><span>Availability</span><select className="select" id="signup-availability" value={availability} onChange={(event) => setAvailability(event.target.value)}><option>Open to opportunities</option><option>Available now</option><option>Available within 30 days</option><option>Exploring options</option></select></label>
                  {role === 'candidate' ? <label className="field" htmlFor="signup-years"><span>Years of experience <small>(required)</small></span><input className="input" id="signup-years" type="number" min="0" max="80" value={yearsExperience} onChange={(event) => setYearsExperience(event.target.value)} required /></label> : <div />}
                </div>
                {role === 'candidate' ? <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}><legend>PWD category <small>(required)</small></legend><p className="field-help">Choose at least one. This information is private.</p><div className="disability-picker">{DISABILITY_OPTIONS.map((option) => <label className="disability-option" key={option.value}><input type="checkbox" checked={disabilityTypes.includes(option.value)} onChange={() => toggleDisability(option.value)} /><span><strong>{option.label}</strong><small>{option.description}</small></span></label>)}</div></fieldset> : null}
                {role === 'candidate' ? <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}><legend>Interaction preferences</legend><p className="field-help">Choose any support that helps you use the site.</p><div className="skill-picker">{profileNeedOptions.map((need) => <label key={need}><input type="checkbox" checked={accessibilityNeeds.includes(need)} onChange={() => toggleNeed(need)} /> <span>{need}</span></label>)}</div></fieldset> : null}
                <div className="photo-field"><div className="photo-field-preview">{photoPreview ? <Image src={photoPreview} alt={`Preview of profile photo for ${profileName}`} width={76} height={76} unoptimized /> : <ImagePlus size={22} aria-hidden="true" />}</div><div className="photo-field-controls"><label className="field" htmlFor="signup-photo"><span>Profile photo <small>(optional)</small></span><input className="input" id="signup-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} /></label><p className="field-help">Use a clear JPG, PNG, or WebP image smaller than 5 MB. A short alt text is added automatically.</p>{photoPreview ? <button className="button danger small" type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(''); }}><X size={14} aria-hidden="true" /> Remove photo</button> : null}</div></div>
              </>}
              {error ? <div className="form-error" id="auth-error" role="alert">{error}</div> : null}
              <div className="button-row">{isProfileStep ? <button className="button secondary" type="button" onClick={backToAccount} disabled={pending}><ArrowLeft size={16} aria-hidden="true" /> Back</button> : null}<button className="button" type="submit" disabled={pending}>{pending ? (language === 'tl' ? 'Sandali...' : 'Working...') : isProfileStep ? 'Create account and profile' : isLogin ? t('signIn') : 'Continue to profile'} {isProfileStep ? <CheckCircle2 size={16} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}</button></div>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
