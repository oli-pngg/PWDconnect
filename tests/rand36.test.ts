import assert from 'node:assert/strict';
import test from 'node:test';
import { RAND36_SECTIONS, scoreRand36 } from '../lib/rand36.ts';

test('RAND-36 applies official recodes, averages per scale, and keeps health change separate', () => {
  const result = scoreRand36({ '1': 1, '2': 1, '3': 1, '4': 3, '21': 6, '22': 1, '32': 5 });
  const score = (code: string) => result.scales.find((scale) => scale.scale_code === code);

  assert.equal(score('general_health')?.score, 100);
  assert.equal(score('general_health')?.answered_items, 1);
  assert.equal(score('physical_functioning')?.score, 50);
  assert.equal(score('physical_functioning')?.answered_items, 2);
  assert.equal(score('bodily_pain')?.score, 50);
  assert.equal(score('social_functioning')?.score, 100);
  assert.equal(result.health_change_response, 1);
  assert.equal(result.health_change_score, 100);
  assert.equal('total_score' in result, false);
});

test('RAND-36 rejects invalid item numbers and response codes', () => {
  assert.throws(() => scoreRand36({ '37': 1 }));
  assert.throws(() => scoreRand36({ '1': 6 }));
});

test('RAND-36 has 36 distinct items and eight independently scored scales', () => {
  const itemNumbers = RAND36_SECTIONS.flatMap((section) => section.items.map((item) => item.number));
  assert.equal(itemNumbers.length, 36);
  assert.equal(new Set(itemNumbers).size, 36);

  const favorableResponses: Record<string, number> = {
    '1': 1, '2': 1,
    '3': 3, '4': 3, '5': 3, '6': 3, '7': 3, '8': 3, '9': 3, '10': 3, '11': 3, '12': 3,
    '13': 2, '14': 2, '15': 2, '16': 2,
    '17': 2, '18': 2, '19': 2,
    '20': 1, '21': 1, '22': 1,
    '23': 1, '24': 6, '25': 6, '26': 1, '27': 1, '28': 6, '29': 6, '30': 1, '31': 6,
    '32': 5, '33': 5, '34': 1, '35': 5, '36': 1
  };
  const result = scoreRand36(favorableResponses);

  assert.equal(result.scales.length, 8);
  assert.equal(result.scales.every((scale) => scale.score === 100), true);
  assert.equal(result.health_change_response, 1);
  assert.equal(result.health_change_score, 100);
  assert.equal('total_score' in result, false);
});

test('RAND-36 favorable-end responses produce 100 in each mapped scale', () => {
  const responses: Record<string, number> = { '1': 1, '2': 1 };
  for (let item = 3; item <= 12; item += 1) responses[String(item)] = 3;
  for (let item = 13; item <= 19; item += 1) responses[String(item)] = 2;
  Object.assign(responses, {
    '20': 1, '21': 1, '22': 1, '23': 1, '24': 6, '25': 6, '26': 1, '27': 1,
    '28': 6, '29': 6, '30': 1, '31': 6, '32': 5, '33': 5, '34': 1, '35': 5, '36': 1
  });
  const result = scoreRand36(responses);

  assert.equal(result.scales.every((scale) => scale.score === 100 && scale.answered_items === scale.item_count), true);
  assert.equal(result.health_change_score, 100);
});

test('RAND-36 records eight scales and does not include the health-change item in a scale', () => {
  const result = scoreRand36({ '2': 3 });
  assert.equal(result.scales.length, 8);
  assert.equal(result.scales.every((scale) => scale.score === null), true);
  assert.equal(result.health_change_score, 50);
  assert.deepEqual(result.scales.map((scale) => scale.scale_code), [
    'physical_functioning', 'role_physical', 'role_emotional', 'energy_fatigue',
    'emotional_wellbeing', 'social_functioning', 'bodily_pain', 'general_health'
  ]);
});

test('RAND-36 leaves scales unscored when all item responses are blank', () => {
  const result = scoreRand36({});
  assert.equal(result.responses.length, 0);
  assert.equal(result.scales.length, 8);
  assert.equal(result.scales.every((scale) => scale.score === null && scale.answered_items === 0), true);
  assert.equal(result.health_change_response, null);
  assert.equal(result.health_change_score, null);
});
