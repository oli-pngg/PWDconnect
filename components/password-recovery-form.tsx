'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { AccessibilityTools } from '@/components/accessibility-tools';
import { BrandMark } from '@/components/brand-mark';
import { LanguageSwitcher } from '@/components/language-provider';

type RecoveryMode = 'request' | 'update';

export function PasswordRecoveryForm({ mode }: { mode: RecoveryMode }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const isUpdate = mode === 'update';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (isUpdate && password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }

    setPending(true);
    try {
      const response = await fetch(isUpdate ? '/api/auth/password-update' : '/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isUpdate ? { password, confirmation } : { email: email.trim() })
      });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) {
        setError(result.error || 'Unable to continue. Try again.');
        setPending(false);
        return;
      }
      if (isUpdate) {
        setNotice('Your password has been updated. You can now sign in with the new password.');
        setPassword('');
        setConfirmation('');
      } else {
        setNotice(result.message || 'If an account exists for this email, password reset instructions will be sent.');
      }
    } catch {
      setError('The server could not be reached. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-page auth-centered-page login-page">
      <aside className="auth-aside">
        <BrandMark />
        <div className="auth-copy">
          <p className="eyebrow">Account security</p>
          <h1>{isUpdate ? 'Choose a new password.' : 'Get back into your account.'}</h1>
          <p>{isUpdate ? 'Use a strong password that you do not use for another account.' : 'We will send a secure reset link if an account matches your email.'}</p>
        </div>
      </aside>
      <main className="auth-main" id="main-content" tabIndex={-1} aria-label={isUpdate ? 'Choose a new password' : 'Reset your password'}>
        <div className="auth-main-inner">
          <div className="register-brand"><BrandMark href="/" /></div>
          <div className="auth-accessibility"><LanguageSwitcher /><AccessibilityTools /></div>
          <section className="auth-card" aria-labelledby="recovery-title">
            <nav className="auth-switch" aria-label="Account actions">
              <Link href="/login">Sign in</Link>
              <Link href="/register">Create account</Link>
            </nav>
            <p className="eyebrow auth-card-eyebrow">{isUpdate ? 'Secure reset' : 'Password recovery'}</p>
            <h1 id="recovery-title">{isUpdate ? 'Set a new password' : 'Forgot your password?'}</h1>
            <p id="recovery-description">
              {isUpdate
                ? 'Enter a new password with at least 12 characters.'
                : 'Enter the email address associated with your account. The response will not reveal whether an account exists.'}
            </p>
            <form className="form-stack" onSubmit={submit} noValidate aria-describedby={`recovery-description${error ? ' recovery-error' : ''}`}>
              {isUpdate ? <>
                <label className="field" htmlFor="new-password">
                  <span>New password</span>
                  <input className="input" id="new-password" name="new-password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} />
                </label>
                <label className="field" htmlFor="confirm-password">
                  <span>Confirm new password</span>
                  <input className="input" id="confirm-password" name="confirm-password" type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
                </label>
              </> : <label className="field" htmlFor="recovery-email">
                <span>Email address</span>
                <input className="input" id="recovery-email" name="email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>}
              {error ? <div className="form-error" id="recovery-error" role="alert">{error}</div> : null}
              {notice ? <div className="form-success" role="status">{notice}</div> : null}
              <button className="button" type="submit" disabled={pending}>
                {pending ? 'Working...' : isUpdate ? 'Update password' : 'Send reset link'}
              </button>
            </form>
            <p className="field-help"><Link className="text-link" href="/login">Return to sign in</Link></p>
          </section>
        </div>
      </main>
    </div>
  );
}
