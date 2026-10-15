import { bodyReadError, cleanText, jsonError, jsonOk, readLimitedJsonObject } from '@/lib/http';
import { getAuthRedirectUrl } from '@/lib/auth-redirect';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

function isDuplicateAccountError(error: { code?: string; message?: string }) {
  const code = error.code?.toLowerCase() ?? '';
  const message = error.message?.toLowerCase() ?? '';
  return ['user_already_exists', 'email_exists'].includes(code) || /already (registered|exists)/.test(message);
}

function signUpErrorMessage(error: { code?: string; message?: string }) {
  const code = error.code?.toLowerCase() ?? '';
  const message = error.message?.toLowerCase() ?? '';

  if (code.includes('rate_limit') || message.includes('rate limit') || message.includes('too many')) {
    return 'Too many sign-up attempts or confirmation emails were sent. Wait a few minutes and try again.';
  }
  if (code === 'weak_password' || message.includes('weak password')) {
    return 'This password does not meet the security requirements. Use at least 12 characters and try a stronger password.';
  }
  if (code === 'email_address_invalid' || message.includes('invalid email')) {
    return 'Check the email address and try again.';
  }
  return 'Unable to create the account. Check the details and try again.';
}

export async function POST(request: Request) {
  const ipLimited = await checkRateLimit(request, 'auth-sign-up-ip', { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!ipLimited.allowed) return rateLimitResponse(ipLimited.retryAfterSeconds);
  const parsedBody = await readLimitedJsonObject(request, 16 * 1024);
  if (!parsedBody.ok) return bodyReadError(parsedBody);
  const email = cleanText(parsedBody.value.email, 254).toLowerCase();
  const password = typeof parsedBody.value.password === 'string' ? parsedBody.value.password : '';
  const role = parsedBody.value.role === 'employer' ? 'employer' : 'candidate';
  const accountLimited = await checkRateLimit(request, 'auth-sign-up-account', { limit: 5, windowMs: 60 * 60 * 1000 }, email || 'unknown');
  if (!accountLimited.allowed) return rateLimitResponse(accountLimited.retryAfterSeconds);
  if (!email || !email.includes('@')) return jsonError('Enter a valid email address to continue.');
  if (password.length < 12) return jsonError('Use a password with at least 12 characters.');

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role }, emailRedirectTo: getAuthRedirectUrl(request, '/auth/continue') }
    });
    if (error) {
      console.warn('Supabase sign-up rejected', { code: error.code, status: error.status });
      if (isDuplicateAccountError(error)) {
        return jsonOk({ authenticated: false, confirmationRequired: true }, { status: 201 });
      }
      return jsonError(signUpErrorMessage(error), error.status && error.status >= 400 && error.status < 500 ? error.status : 400);
    }
    return jsonOk({ authenticated: Boolean(data.session), confirmationRequired: !data.session }, { status: 201 });
  } catch {
    return jsonError('Account creation is temporarily unavailable. Check the site settings and try again.', 500);
  }
}
