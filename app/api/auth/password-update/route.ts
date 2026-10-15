import { getAuthenticatedContext } from '@/lib/auth';
import { bodyReadError, jsonError, jsonOk, readLimitedJsonObject } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const ipLimited = await checkRateLimit(request, 'auth-password-update-ip', { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!ipLimited.allowed) return rateLimitResponse(ipLimited.retryAfterSeconds);
  const parsedBody = await readLimitedJsonObject(request, 16 * 1024);
  if (!parsedBody.ok) return bodyReadError(parsedBody);
  const password = typeof parsedBody.value.password === 'string' ? parsedBody.value.password : '';
  const confirmation = typeof parsedBody.value.confirmation === 'string' ? parsedBody.value.confirmation : '';
  if (password.length < 12) return jsonError('Use a password with at least 12 characters.');
  if (password !== confirmation) return jsonError('The passwords do not match.');

  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Open the latest password reset link from your email, then try again.', 401);
    const limited = await checkRateLimit(request, 'auth-password-update', { limit: 5, windowMs: 60 * 60 * 1000 }, user.id);
    if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      console.warn('Supabase password update failed', { code: error.code, status: error.status });
      return jsonError('Unable to update the password. Open a fresh reset link and try again.');
    }
    return jsonOk({ updated: true });
  } catch {
    return jsonError('Password recovery is temporarily unavailable. Try again shortly.', 503);
  }
}
