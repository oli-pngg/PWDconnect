import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server.js';

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
let sharedLimiterWarningLogged = false;

function requestAddress(request: Request) {
  const realIp = request.headers.get('x-real-ip')?.trim();
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (realIp || forwarded || 'unknown-client').slice(0, 128);
}

function removeExpired(now: number) {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function checkLocalBucket(key: string, options: RateLimitOptions) {
  const now = Date.now();
  removeExpired(now);
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + options.windowMs }
    : current;
  bucket.count += 1;
  buckets.set(key, bucket);
  return {
    allowed: bucket.count <= options.limit,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
  };
}

export function checkInMemoryRateLimit(request: Request, scope: string, options: RateLimitOptions, identity?: string) {
  return checkLocalBucket(`${scope}:${identity || requestAddress(request)}`, options);
}

export async function checkRateLimit(request: Request, scope: string, options: RateLimitOptions, identity?: string) {
  // Local development stays usable for repeated manual auth flows. Unit tests
  // exercise the deterministic in-memory helper; deployed instances share
  // counters through Supabase Postgres so scaling cannot reset the limit.
  if (process.env.NODE_ENV === 'development') {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (process.env.NODE_ENV !== 'production') {
    return checkInMemoryRateLimit(request, scope, options, identity);
  }

  const key = `${scope}:${identity || requestAddress(request)}`;
  const bucketKey = createHash('sha256').update(key).digest('hex');
  try {
    const { createSupabaseAdminClient } = await import('@/lib/supabase/admin');
    const admin = createSupabaseAdminClient() as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{
        data: unknown;
        error: { code?: string } | null;
      }>;
    };
    const { data: rawData, error } = await admin.rpc('consume_api_rate_limit', {
      p_bucket_key: bucketKey,
      p_limit: options.limit,
      p_window_seconds: Math.max(1, Math.ceil(options.windowMs / 1000))
    });
    const decision = (Array.isArray(rawData) ? rawData[0] : rawData) as {
      allowed?: unknown;
      retry_after_seconds?: unknown;
    } | null;
    if (error || !decision || typeof decision.allowed !== 'boolean') {
      if (!sharedLimiterWarningLogged) {
        sharedLimiterWarningLogged = true;
        console.error('[rate-limit] shared rate-limit storage is unavailable', { code: error?.code });
      }
      return { allowed: false, retryAfterSeconds: 0 };
    }
    return {
      allowed: decision.allowed,
      retryAfterSeconds: Math.max(1, Number(decision.retry_after_seconds) || 1)
    };
  } catch (error) {
    if (!sharedLimiterWarningLogged) {
      sharedLimiterWarningLogged = true;
      console.error('[rate-limit] shared rate-limit storage is unavailable', {
        errorName: error instanceof Error ? error.name : 'unknown'
      });
    }
    return { allowed: false, retryAfterSeconds: 0 };
  }
}

export function rateLimitResponse(retryAfterSeconds: number) {
  if (retryAfterSeconds <= 0) {
    return NextResponse.json(
      { error: 'The request limit service is temporarily unavailable. Please try again shortly.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  return NextResponse.json(
    { error: `Too many requests. Please wait ${retryAfterSeconds} seconds and try again.` },
    {
      status: 429,
      headers: {
        'Cache-Control': 'no-store',
        'Retry-After': String(retryAfterSeconds)
      }
    }
  );
}
