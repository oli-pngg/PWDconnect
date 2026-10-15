import assert from 'node:assert/strict';
import test from 'node:test';
import { readLimitedJsonObject } from '../lib/http.ts';

test('limited JSON body accepts valid objects and rejects invalid JSON shapes', async () => {
  const validRequest = new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'hello' })
  });
  const valid = await readLimitedJsonObject(validRequest, 1024);
  assert.equal(valid.ok, true);
  if (valid.ok) assert.deepEqual(valid.value, { message: 'hello' });

  const arrayRequest = new Request('http://localhost/api/test', { method: 'POST', body: '[]' });
  const arrayBody = await readLimitedJsonObject(arrayRequest, 1024);
  assert.deepEqual(arrayBody, { ok: false, reason: 'invalid' });

  const malformedRequest = new Request('http://localhost/api/test', { method: 'POST', body: '{' });
  const malformed = await readLimitedJsonObject(malformedRequest, 1024);
  assert.deepEqual(malformed, { ok: false, reason: 'invalid' });
});

test('limited JSON body stops reading once a streamed body exceeds its byte limit', async () => {
  const oversizedRequest = new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'x'.repeat(4096)
  });
  const result = await readLimitedJsonObject(oversizedRequest, 128);
  assert.deepEqual(result, { ok: false, reason: 'too_large' });
});
