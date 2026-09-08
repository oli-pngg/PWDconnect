import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';

export default function RegisterPage() {
  return <Suspense fallback={<AuthLoading />}><AuthForm mode="register" /></Suspense>;
}

function AuthLoading() {
  return <div className="auth-page"><div className="auth-aside" /><main className="auth-main" id="main-content"><div className="auth-card" role="status" aria-live="polite">Loading secure registration...</div></main></div>;
}
