import assert from 'node:assert/strict';
import test from 'node:test';
import { checkInMemoryRateLimit } from '../lib/rate-limit.ts';

test('the in-memory limiter enforces a fixed window for local development', () => {
  const request = new Request('http://localhost/api/auth/sign-up');
  const options = { limit: 1, windowMs: 60_000 };
  assert.equal(checkInMemoryRateLimit(request, 'test-local-sign-up', options, 'local-user').allowed, true);
  assert.equal(checkInMemoryRateLimit(request, 'test-local-sign-up', options, 'local-user').allowed, false);
});
