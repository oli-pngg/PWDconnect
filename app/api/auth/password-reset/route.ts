import { bodyReadError, cleanText, jsonError, jsonOk, readLimitedJsonObject } from '@/lib/http';
import { getAuthRedirectUrl } from '@/lib/auth-redirect';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const ipLimited = await checkRateLimit(request, 'auth-password-reset-ip', { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!ipLimited.allowed) return rateLimitResponse(ipLimited.retryAfterSeconds);
  const parsedBody = await readLimitedJsonObject(request, 16 * 1024);
  if (!parsedBody.ok) return bodyReadError(parsedBody);
  const email = cleanText(parsedBody.value.email, 254).toLowerCase();
  const accountLimited = await checkRateLimit(request, 'auth-password-reset-account', { limit: 5, windowMs: 60 * 60 * 1000 }, email || 'unknown');
  if (!accountLimited.allowed) return rateLimitResponse(accountLimited.retryAfterSeconds);
  if (!email || !email.includes('@')) return jsonError('Enter a valid email address.');

  let redirectTo: string;
  try {
    redirectTo = getAuthRedirectUrl(request, '/reset-password');
  } catch {
    return jsonError('Password recovery is not configured for this site.', 503);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) console.warn('Supabase password reset request failed', { code: error.code, status: error.status });
    return jsonOk({ sent: true, message: 'If an account exists for this email, password reset instructions will be sent.' });
  } catch {
    return jsonError('Password recovery is temporarily unavailable. Try again shortly.', 503);
  }
}
