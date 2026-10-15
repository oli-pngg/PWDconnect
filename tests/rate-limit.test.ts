import assert from 'node:assert/strict';
import test from 'node:test';
import { checkRateLimit } from '../lib/rate-limit.ts';

test('development bypasses local limits while production still enforces them', () => {
  const env = process.env as Record<string, string | undefined>;
  const previousNodeEnv = env.NODE_ENV;

  try {
    env.NODE_ENV = 'development';
    const request = new Request('http://localhost/api/auth/sign-up');
    const options = { limit: 1, windowMs: 60_000 };
    assert.equal(checkRateLimit(request, 'test-local-sign-up', options, 'local-user').allowed, true);
    assert.equal(checkRateLimit(request, 'test-local-sign-up', options, 'local-user').allowed, true);

    env.NODE_ENV = 'production';
    assert.equal(checkRateLimit(request, 'test-production-sign-up', options, 'user-1').allowed, true);
    assert.equal(checkRateLimit(request, 'test-production-sign-up', options, 'user-1').allowed, false);
  } finally {
    if (previousNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previousNodeEnv;
  }
});
