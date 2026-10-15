import { bodyReadError, cleanText, jsonError, jsonOk, readLimitedJsonObject } from '@/lib/http';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const ipLimited = await checkRateLimit(request, 'auth-sign-in-ip', { limit: 30, windowMs: 10 * 60 * 1000 });
  if (!ipLimited.allowed) return rateLimitResponse(ipLimited.retryAfterSeconds);
  const parsedBody = await readLimitedJsonObject(request, 16 * 1024);
  if (!parsedBody.ok) return bodyReadError(parsedBody);
  const email = cleanText(parsedBody.value.email, 254).toLowerCase();
  const password = typeof parsedBody.value.password === 'string' ? parsedBody.value.password : '';
  const accountLimited = await checkRateLimit(request, 'auth-sign-in-account', { limit: 8, windowMs: 10 * 60 * 1000 }, email || 'unknown');
  if (!accountLimited.allowed) return rateLimitResponse(accountLimited.retryAfterSeconds);
  if (!email || !email.includes('@') || !password) return jsonError('Enter a valid email and password.');

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return jsonError('The email or password is incorrect.');
    return jsonOk({ authenticated: true });
  } catch {
    return jsonError('Sign in is temporarily unavailable. Check the site settings and try again.', 500);
  }
}
