'use client';

import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { AccessibilityTools } from '@/components/accessibility-tools';
import { BrandMark } from '@/components/brand-mark';
import { LanguageSwitcher, useLanguage } from '@/components/language-provider';
import { TextToSpeechControls } from '@/components/text-to-speech-controls';
import { VoiceSignupControls } from '@/components/voice-signup-controls';
import { isSupabaseConfigured } from '@/lib/env';
import { DISABILITY_OPTIONS } from '@/lib/disability';
import { safeNext } from '@/lib/navigation';

type AuthMode = 'login' | 'register';
type Role = 'candidate' | 'employer';
type AccountStep = 'type' | 'category' | 'credentials';
type RegisterStep = AccountStep | 'profile';
type ProfileStep = 'identity' | 'work' | 'support';

const signupDisabilityOptions = DISABILITY_OPTIONS.slice(0, 3);

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
  const [registerStep, setRegisterStep] = useState<RegisterStep>('type');
  const [profileStep, setProfileStep] = useState<ProfileStep>('identity');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<Role>('candidate');
  const [organizationName, setOrganizationName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [disabilityTypes, setDisabilityTypes] = useState<string[]>([]);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [location, setLocation] = useState('Legazpi City, Albay');
  const [workMode, setWorkMode] = useState('Flexible');
  const [availability, setAvailability] = useState('Open to opportunities');
  const [yearsExperience, setYearsExperience] = useState('0');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [profileSaveFailed, setProfileSaveFailed] = useState(false);
  const [pending, setPending] = useState(false);

  const isLogin = mode === 'login';
  const isProfileStep = !isLogin && registerStep === 'profile';
  const isCredentialsStep = !isLogin && registerStep === 'credentials';
  const profileSteps: ProfileStep[] = ['identity', 'work', 'support'];
  const profileStepIndex = Math.max(0, profileSteps.indexOf(profileStep));
  const isLastProfileStep = profileStepIndex === profileSteps.length - 1;
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim();



  function setVoiceName(value: string) {
    const parts = value.trim().split(/\s+/).filter(Boolean);
    setFirstName(parts[0] ?? '');
    setMiddleName(parts.length > 2 ? parts.slice(1, -1).join(' ') : '');
    setLastName(parts.length > 1 ? parts[parts.length - 1] : '');
  }

  function validateAccount() {
    if (!isLogin && registerStep === 'category' && !disabilityTypes.length) return 'Choose a PWD category.';
    if (!isLogin && registerStep !== 'credentials') return '';
    if (!email.trim() || !email.includes('@')) return 'Enter a valid email address to continue.';
    if (password.length < 12) return 'Use a password with at least 12 characters.';
    return '';
  }

  function validateProfile() {
    if (!firstName.trim() || !lastName.trim() || !bio.trim()) return role === 'candidate' ? 'Add your name and profile description.' : 'Add your contact name and organization description.';
    if (role === 'employer' && !organizationName.trim()) return 'Add your organization name.';
    if (role === 'candidate' && !disabilityTypes.length) return 'Choose a PWD category.';
    return '';
  }

  function validateCurrentProfileStep() {

    if (profileStep === 'identity' && (!firstName.trim() || !lastName.trim() || !bio.trim())) return 'Add your first name, last name, and profile description.';
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
        disabilityTypes,
        location,
        workMode,
        availability,
        yearsExperience: Number(yearsExperience),
        skillIds: []
      })
    });
    const profilePayload = await profileResponse.json() as { error?: string };
    if (!profileResponse.ok) throw new Error(profilePayload.error || 'Unable to save your profile.');

  }

  async function uploadProfilePhoto() {
    if (!profilePhoto) return;
    const formData = new FormData();
    formData.append('photo', profilePhoto);
    const response = await fetch('/api/profile/photo', { method: 'POST', body: formData });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || 'Unable to upload your profile photo.');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    setProfileSaveFailed(false);

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
      if (registerStep === 'type' && role === 'candidate') {
        setRegisterStep('category');
        return;
      }
      if (registerStep === 'type' && role === 'employer') {
        setRegisterStep('credentials');
        return;
      }
      if (registerStep === 'category') {
        setRegisterStep('credentials');
        return;
      }
      setRegisterStep('profile');
      setProfileStep('identity');
      return;
    }


    if (!isLogin && !isLastProfileStep) {
      const stepError = validateCurrentProfileStep();
      if (stepError) {
        setError(stepError);
        return;
      }
      setProfileStep(profileSteps[profileStepIndex + 1]);
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
        body: JSON.stringify({ email: email.trim(), password, firstName, middleName, lastName, fullName, role })
      });
      const result = await response.json() as { error?: string; confirmationRequired?: boolean };
      if (!response.ok) {
        setError(friendlyAuthError(result.error || 'Unable to access your account.'));
        setPending(false);
        return;
      }

      if (!isLogin && result.confirmationRequired) {
        setNotice('Check your email to confirm your account, then sign in.');
        setPending(false);
        return;
      }

      if (!isLogin) {
        try {
          await saveProfile();
          await uploadProfilePhoto();
        } catch (profileSaveError: unknown) {
          setError(profileSaveError instanceof Error ? profileSaveError.message : 'Your account was created, but the profile could not be saved.');
          setProfileSaveFailed(true);
          setPending(false);
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

  function backAccountStep() {
    setError('');
    if (registerStep === 'credentials') setRegisterStep(role === 'candidate' ? 'category' : 'type');
    else if (registerStep === 'category') setRegisterStep('type');
  }

  function backProfileStep() {
    if (profileStepIndex === 0) setRegisterStep('credentials');
    else setProfileStep(profileSteps[profileStepIndex - 1]);
  }

  return (
    <div className={`auth-page auth-centered-page ${isLogin ? 'login-page' : 'register-page'} ${isProfileStep ? 'profile-step-page' : ''}`} data-role={role}>
      <aside className="auth-aside">
        <BrandMark />
        <div className="auth-copy">
          <p className="eyebrow">{isLogin ? 'Welcome back' : 'A place to begin'}</p>
          <h1>{isLogin ? 'Pick up where your skills left off.' : 'Bring your strengths into focus.'}</h1>
           <p>{isLogin ? 'Your work progress stays in your account.' : 'Create an account and build your profile.'}</p>
          <ul className="auth-points">
             <li><CheckCircle2 size={17} aria-hidden="true" /> Private account data</li>
             <li><CheckCircle2 size={17} aria-hidden="true" /> Skills-first employer view</li>
             <li><CheckCircle2 size={17} aria-hidden="true" /> Keyboard-friendly controls</li>
          </ul>
        </div>
      </aside>
      <main className="auth-main" id="main-content" tabIndex={-1} aria-label={isLogin ? 'Sign in' : 'Create account'}>
        <div className="auth-main-inner">
          <div className="register-brand"><BrandMark href="/" /></div>
          <div className="auth-accessibility"><LanguageSwitcher /><AccessibilityTools /><TextToSpeechControls /></div>
           <section className={`auth-card ${isProfileStep ? 'profile-registration-card' : ''}`} aria-labelledby="auth-title">
            <nav className="auth-switch" aria-label="Account actions">
              <Link className={isLogin ? 'active' : ''} href="/login" aria-current={isLogin ? 'page' : undefined}>{t('signIn')}</Link>
              <Link className={!isLogin ? 'active' : ''} href="/register" aria-current={!isLogin ? 'page' : undefined}>{t('createAccount')}</Link>
            </nav>
            {isLogin ? <p className="eyebrow auth-card-eyebrow">Welcome back</p> : null}
             <h1 id="auth-title" tabIndex={-1}>{isProfileStep ? 'Build your profile' : isLogin ? t('signIn') : t('createAccount')}</h1>
              <p id="auth-description">{isProfileStep ? 'Add your work details.' : isLogin ? (language === 'tl' ? 'Ilagay ang email at password para magpatuloy.' : 'Enter your email and password to continue.') : registerStep === 'type' ? 'Choose the account type that fits you.' : registerStep === 'category' ? 'Choose the PWD category that applies.' : 'Enter your account details.'}</p>
              {!isLogin && isCredentialsStep ? <VoiceSignupControls onName={setVoiceName} onEmail={setEmail} onRole={setRole} /> : null}
              <form className="form-stack" onSubmit={submit} noValidate aria-describedby={`auth-description${error ? ' auth-error' : ''}`}>
               {!isProfileStep ? <>
                  {!isLogin && registerStep === 'type' ? <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}><legend>{language === 'tl' ? 'Uri ng account' : 'Account type'}</legend><div className="role-grid"><div className="role-option"><input id="role-candidate" name="role" type="radio" value="candidate" checked={role === 'candidate'} onChange={() => setRole('candidate')} /><label htmlFor="role-candidate"><strong>{language === 'tl' ? 'Maghanap ng trabaho' : 'Applicant'}</strong><span>{language === 'tl' ? 'Ako ay naghahanap ng trabaho.' : 'I am a job seeker.'}</span></label></div><div className="role-option"><input id="role-employer" name="role" type="radio" value="employer" checked={role === 'employer'} onChange={() => setRole('employer')} /><label htmlFor="role-employer"><strong>{language === 'tl' ? 'Mag-hire nang patas' : 'Employer'}</strong><span>{language === 'tl' ? 'Kumakatawan ako sa isang organisasyon.' : 'I represent an organization.'}</span></label></div></div></fieldset> : null}
                  {!isLogin && registerStep === 'category' ? <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}><legend>PWD category</legend><p className="field-help">Choose one to continue.</p><div className="disability-picker">{signupDisabilityOptions.map((option) => <label className="disability-option" key={option.value}><input type="radio" name="signup-disability" checked={disabilityTypes[0] === option.value} onChange={() => setDisabilityTypes([option.value])} /><span><strong>{option.label}</strong><small>{option.description}</small></span></label>)}</div></fieldset> : null}
                  {isCredentialsStep || isLogin ? <div className="field"><label htmlFor="email">Email address</label><input className="input" id="email" name="email" type="email" autoComplete="email" inputMode="email" autoFocus={isLogin} required value={email} onChange={(event) => setEmail(event.target.value)} /></div> : null}
                  {isCredentialsStep || isLogin ? <div className="field"><label htmlFor="password">Password</label><div style={{ position: 'relative' }}><input className="input" style={{ paddingRight: 48 }} id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={isLogin ? 'current-password' : 'new-password'} minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} /><button className="icon-button" style={{ position: 'absolute', top: 2, right: 2, width: 42, height: 42, border: 0 }} type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}</button></div><small>{language === 'tl' ? 'Hindi bababa sa 12 character. Huwag gamitin muli ang work password.' : 'At least 12 characters.'}</small></div> : null}
                 </> : <>

                 <div className="profile-step-indicator" data-step-count={profileSteps.length} role="group" aria-label="Profile setup progress"><span>Step {profileStepIndex + 1} of {profileSteps.length}</span><div className="profile-step-list">{profileSteps.map((step, index) => <span className={index === profileStepIndex ? 'active' : index < profileStepIndex ? 'complete' : ''} aria-label={`Step ${index + 1}: ${step === 'identity' ? 'Identity' : step === 'work' ? 'Work' : 'Support'}`} aria-current={index === profileStepIndex ? 'step' : undefined} key={step}>{index + 1}</span>)}</div></div>

                 {profileStep === 'identity' ? <><div className="notice profile-account-banner"><strong>{role === 'candidate' ? 'Job seeker' : 'Employer'}</strong><span>{email}</span></div><div className="field-grid three name-fields"><label className="field" htmlFor="profile-first-name"><span>First name</span><input className="input" id="profile-first-name" autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={40} required /></label><label className="field" htmlFor="profile-middle-name"><span>Middle name</span><input className="input" id="profile-middle-name" autoComplete="additional-name" value={middleName} onChange={(event) => setMiddleName(event.target.value)} maxLength={40} /></label><label className="field" htmlFor="profile-last-name"><span>Last name</span><input className="input" id="profile-last-name" autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={40} required /></label></div>{role === 'employer' ? <label className="field" htmlFor="organization-name"><span>Organization name <small>(required)</small></span><input className="input" id="organization-name" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} maxLength={140} required /></label> : <label className="field" htmlFor="academic-level"><span>Academic level</span><select className="select" id="academic-level" value={headline} onChange={(event) => setHeadline(event.target.value)}><option value="">Select academic level</option><option>High school</option><option>Vocational/Technical</option><option>Associate degree</option><option>Bachelor&apos;s degree</option><option>Master&apos;s degree</option><option>Doctorate</option><option>Other</option></select></label>}{role === 'employer' ? <label className="field" htmlFor="profile-headline"><span>Organization headline</span><input className="input" id="profile-headline" value={headline} onChange={(event) => setHeadline(event.target.value)} maxLength={160} placeholder="What kind of work does your organization offer?" /></label> : null}<label className="field profile-long-field" htmlFor="profile-bio"><span>{role === 'employer' ? 'Organization description' : 'Profile description'} <small>(required)</small></span><textarea className="textarea" id="profile-bio" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={1500} required placeholder={role === 'employer' ? 'Describe your team, work, and inclusive hiring approach.' : 'Describe the work you enjoy, tools you use, or strengths you want employers to see.'} /></label></> : null}
                 {profileStep === 'work' ? <><div className="field-grid two"><label className="field" htmlFor="signup-location"><span>Preferred location</span><input className="input" id="signup-location" value={location} onChange={(event) => setLocation(event.target.value)} maxLength={120} /></label><label className="field" htmlFor="signup-work-mode"><span>Work mode</span><select className="select" id="signup-work-mode" value={workMode} onChange={(event) => setWorkMode(event.target.value)}><option>Flexible</option><option>On-site</option><option>Hybrid</option><option>Remote</option></select></label></div><div className="field-grid two"><label className="field" htmlFor="signup-availability"><span>Availability</span><select className="select" id="signup-availability" value={availability} onChange={(event) => setAvailability(event.target.value)}><option>Open to opportunities</option><option>Available now</option><option>Available within 30 days</option><option>Exploring options</option></select></label><label className="field" htmlFor="signup-years"><span>Years of experience</span><input className="input" id="signup-years" type="number" min="0" max="80" value={yearsExperience} onChange={(event) => setYearsExperience(event.target.value)} /></label></div></> : null}
                  {profileStep === 'support' ? <label className="field" htmlFor="profile-photo"><span>Profile picture</span><input className="input" id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setProfilePhoto(event.target.files?.[0] ?? null)} /><small>JPG, PNG, or WebP. Maximum 5 MB.</small></label> : null}
               </>}
               {error ? <div className="form-error" id="auth-error" role="alert">{error}{profileSaveFailed ? <Link className="text-link" href="/profile?setup=1">Open profile setup</Link> : null}</div> : null}
               {notice ? <div className="form-success" role="status">{notice}</div> : null}
                <div className="button-row">{!isLogin && !isProfileStep && registerStep !== 'type' ? <button className="button secondary" type="button" onClick={backAccountStep} disabled={pending}><ArrowLeft size={16} aria-hidden="true" /> Back</button> : null}{isProfileStep ? <button className="button secondary" type="button" onClick={backProfileStep} disabled={pending}><ArrowLeft size={16} aria-hidden="true" /> Back</button> : null}<button className="button" type="submit" disabled={pending}>{pending ? (language === 'tl' ? 'Sandali...' : 'Working...') : isProfileStep ? isLastProfileStep ? 'Create account and profile' : 'Continue' : isLogin ? t('signIn') : isCredentialsStep ? 'Continue to profile' : 'Continue'} {isProfileStep ? isLastProfileStep ? <CheckCircle2 size={16} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}</button></div>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
