import { getAuthenticatedContext } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(request: Request) {
  const limited = checkRateLimit(request, 'skills-read', { limit: 60, windowMs: 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const { data, error } = await supabase.from('skills').select('id, slug, name, category').eq('is_active', true).order('category').order('name');
    if (error) return jsonError('Unable to load skills.', 500);
    return jsonOk({ skills: data ?? [] });
  } catch {
    return jsonError('Unable to load skills.', 500);
  }
}
