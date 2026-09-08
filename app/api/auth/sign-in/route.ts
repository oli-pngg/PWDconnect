import { cleanText, jsonError, jsonOk } from '@/lib/http';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const email = cleanText(body?.email, 254).toLowerCase();
  const password = typeof body?.password === 'string' ? body.password : '';
  const limited = checkRateLimit(request, `auth-sign-in:${email || 'unknown'}`, { limit: 8, windowMs: 10 * 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  if (!email || !email.includes('@') || password.length < 12) return jsonError('Enter a valid email and a password with at least 12 characters.');

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return jsonError(error.message);
    return jsonOk({ authenticated: true });
  } catch {
    return jsonError('Sign in is temporarily unavailable. Check the site settings and try again.', 500);
  }
}
