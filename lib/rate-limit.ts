import { NextResponse } from 'next/server';

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

// This dependency-free limiter protects a single app process. Use a shared
// edge or Redis limiter when the deployment has more than one instance.

function requestAddress(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'local-client';
}

function removeExpired(now: number) {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function checkRateLimit(request: Request, scope: string, options: RateLimitOptions) {
  const now = Date.now();
  removeExpired(now);
  const key = `${scope}:${requestAddress(request)}`;
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

export function rateLimitResponse(retryAfterSeconds: number) {
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
