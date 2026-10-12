import { bodyTooLarge, cleanText, jsonError, jsonOk } from '@/lib/http';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

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
    if (error) return jsonError('Unable to create the account. Check the details and try again.');
    return jsonOk({ authenticated: Boolean(data.session), confirmationRequired: !data.session }, { status: 201 });
  } catch {
    return jsonError('Account creation is temporarily unavailable. Check the site settings and try again.', 500);
  }
}
