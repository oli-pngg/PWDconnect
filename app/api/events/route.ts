import { getAuthenticatedContext } from '@/lib/auth';
import { bodyReadError, cleanText, jsonError, jsonOk, readLimitedJsonObject, safeInteger } from '@/lib/http';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

const allowedEvents = new Set(['dashboard_load', 'jobs_load', 'assessment_load', 'profile_load']);

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, 'performance-event-write', { limit: 120, windowMs: 60 * 1000 });
  if (!limited.allowed) return rateLimitResponse(limited.retryAfterSeconds);
  const parsedBody = await readLimitedJsonObject(request, 8 * 1024);
  if (!parsedBody.ok) return bodyReadError(parsedBody);
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return jsonError('Authentication required.', 401);
    const body = parsedBody.value as { eventName?: unknown; durationMs?: unknown };
    const eventName = cleanText(body.eventName, 40);
    const durationMs = safeInteger(body.durationMs, -1);
    if (!allowedEvents.has(eventName) || durationMs < 0 || durationMs > 120000) return jsonError('Invalid performance event.');
    const { error } = await supabase.from('platform_events').insert({ actor_id: user.id, event_name: eventName, duration_ms: durationMs });
    if (error) return jsonError('Unable to record performance event.', 500);
    return jsonOk({ recorded: true });
  } catch {
    return jsonError('Unable to record performance event.', 500);
  }
}
