import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidOccupationalQuestionCount } from '../lib/assessment-rules.ts';

test('occupational question bank requires five to fifty questions', () => {
  assert.equal(isValidOccupationalQuestionCount(4), false);
  assert.equal(isValidOccupationalQuestionCount(5), true);
  assert.equal(isValidOccupationalQuestionCount(50), true);
  assert.equal(isValidOccupationalQuestionCount(51), false);
});
