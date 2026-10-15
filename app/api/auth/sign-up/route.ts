import { bodyTooLarge, cleanText, jsonError, jsonOk } from '@/lib/http';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

function signUpErrorMessage(error: { code?: string; message?: string }) {
  const code = error.code?.toLowerCase() ?? '';
  const message = error.message?.toLowerCase() ?? '';

  if (['user_already_exists', 'email_exists'].includes(code) || message.includes('already registered')) {
    return 'This email may already have an account. Choose Sign in or use a different email.';
  }
  if (code.includes('rate_limit') || message.includes('rate limit') || message.includes('too many')) {
    return 'Too many sign-up attempts or confirmation emails were sent. Wait a few minutes and try again.';
  }
  if (code === 'weak_password' || message.includes('weak password')) {
    return 'This password does not meet the security requirements. Use at least 12 characters and try a stronger password.';
  }
  if (code === 'email_address_invalid' || message.includes('invalid email')) {
    return 'Check the email address and try again.';
  }
  return 'Unable to create the account. Check the details or sign in if you already have an account.';
}

export async function POST(request: Request) {
  if (bodyTooLarge(request, 16 * 1024)) return jsonError('Request is too large.', 413);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const email = cleanText(body?.email, 254).toLowerCase();
  const password = typeof body?.password === 'string' ? body.password : '';
  const role = body?.role === 'employer' ? 'employer' : 'candidate';
  const limited = checkRateLimit(request, `auth-sign-up:${email || 'unknown'}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  if (!email || !email.includes('@')) return jsonError('Enter a valid email address to continue.');
  if (password.length < 12) return jsonError('Use a password with at least 12 characters.');

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role } }
    });
    if (error) {
      console.warn('Supabase sign-up rejected', { code: error.code, status: error.status });
      return jsonError(signUpErrorMessage(error), error.status && error.status >= 400 && error.status < 500 ? error.status : 400);
    }
    return jsonOk({ authenticated: Boolean(data.session), confirmationRequired: !data.session }, { status: 201 });
  } catch {
    return jsonError('Account creation is temporarily unavailable. Check the site settings and try again.', 500);
  }
}
