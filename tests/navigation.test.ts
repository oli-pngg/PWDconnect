import assert from 'node:assert/strict';
import test from 'node:test';
import { safeNext } from '../lib/navigation.ts';

test('safeNext preserves internal destinations and rejects external or malformed targets', () => {
  assert.equal(safeNext('/applications/123?tab=messages'), '/applications/123?tab=messages');
  assert.equal(safeNext('https://example.com/phishing'), '/dashboard');
  assert.equal(safeNext('//example.com/phishing'), '/dashboard');
  assert.equal(safeNext('/%5C%5Cexample.com'), '/dashboard');
  assert.equal(safeNext('/dashboard%00'), '/dashboard');
});
