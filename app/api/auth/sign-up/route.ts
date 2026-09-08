import { cleanText, jsonError, jsonOk } from '@/lib/http';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const email = cleanText(body?.email, 254).toLowerCase();
  const password = typeof body?.password === 'string' ? body.password : '';
  const fullName = cleanText(body?.fullName, 100);
  const role = body?.role === 'employer' ? 'employer' : 'candidate';
  const limited = checkRateLimit(request, `auth-sign-up:${email || 'unknown'}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  if (!fullName) return jsonError('Enter your name to create the account.');
  if (!email || !email.includes('@')) return jsonError('Enter a valid email address to continue.');
  if (password.length < 12) return jsonError('Use a password with at least 12 characters.');

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } }
    });
    if (error) return jsonError(error.message);
    if (!data.session) return jsonError('Email confirmation is still enabled in Supabase. Turn off Confirm email in Authentication > Providers > Email, then create the account again.');
    return jsonOk({ authenticated: true }, { status: 201 });
  } catch {
    return jsonError('Account creation is temporarily unavailable. Check the site settings and try again.', 500);
  }
}
