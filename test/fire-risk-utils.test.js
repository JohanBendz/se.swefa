'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeClassCode,
  externalClassCode,
  parameterCode,
  dateKeyInTimezone,
  targetDateKey,
  selectDailyFireRiskPoint,
  parseApprovedTime,
  isRiskAtLeast,
  diffFireRisk,
} = require('../lib/fire-risk-utils');

function point(validTime, fwiindex, grassfire, forestdry) {
  return {
    validTime,
    parameters: [
      { name: 'fwiindex', values: [fwiindex] },
      { name: 'grassfire', values: [grassfire] },
      { name: 'forestdry', values: [forestdry] },
    ],
  };
}

test('fire-risk class codes accept SMHI classes and reject unsupported values', () => {
  for (const value of [-1, 1, 2, 3, 4, 5, 6]) {
    assert.equal(normalizeClassCode(value), value);
  }

  assert.equal(normalizeClassCode(0), null);
  assert.equal(normalizeClassCode(7), null);
  assert.equal(normalizeClassCode('bad'), null);
});

test('FWI and forest dryness expose class 6 as official 5E', () => {
  assert.equal(externalClassCode(6, 'forest'), '5E');
  assert.equal(externalClassCode(6, 'dryness'), '5E');
  assert.equal(externalClassCode(6, 'grass'), '6');
  assert.equal(externalClassCode(5, 'forest'), '5');
  assert.equal(externalClassCode(-1, 'forest'), '');
});

test('parameter extraction returns the first class value', () => {
  const sample = point('2026-09-20T12:00:00Z', 4, 3, 5);

  assert.equal(parameterCode(sample, 'fwiindex'), 4);
  assert.equal(parameterCode(sample, 'grassfire'), 3);
  assert.equal(parameterCode(sample, 'forestdry'), 5);
  assert.equal(parameterCode(sample, 'missing'), null);
});

test('date selection uses local calendar days and supports 0-5 day offsets', () => {
  const now = new Date('2026-09-19T22:30:00Z');

  assert.equal(dateKeyInTimezone(now, 'Europe/Stockholm'), '2026-09-20');
  assert.equal(targetDateKey(now, 0, 'Europe/Stockholm'), '2026-09-20');
  assert.equal(targetDateKey(now, 5, 'Europe/Stockholm'), '2026-09-25');
  assert.equal(targetDateKey(now, 6, 'Europe/Stockholm'), null);
});

test('daily fire-risk selection picks the requested local forecast day', () => {
  const payload = {
    timeSeries: [
      point('2026-09-20T12:00:00Z', 2, 2, 3),
      point('2026-09-21T12:00:00Z', 4, 3, 5),
      point('2026-09-22T12:00:00Z', 5, 4, 6),
    ],
  };

  const selected = selectDailyFireRiskPoint(
    payload,
    1,
    new Date('2026-09-20T08:00:00Z'),
    'Europe/Stockholm',
  );

  assert.deepEqual(selected, {
    validTime: '2026-09-21T12:00:00Z',
    forestFireRiskCode: 4,
    grassFireRiskCode: 3,
    forestDrynessCode: 5,
  });
});

test('daily selection preserves SMHI no-data/off-season code', () => {
  const payload = {
    timeSeries: [point('2026-09-20T12:00:00Z', -1, -1, -1)],
  };

  const selected = selectDailyFireRiskPoint(
    payload,
    0,
    new Date('2026-09-20T08:00:00Z'),
    'Europe/Stockholm',
  );

  assert.equal(selected.forestFireRiskCode, -1);
  assert.equal(selected.grassFireRiskCode, -1);
  assert.equal(selected.forestDrynessCode, -1);
});

test('approvedTime freshness rejects stale and implausibly future data', () => {
  const now = Date.parse('2026-09-20T12:00:00Z');

  assert.equal(
    parseApprovedTime({ approvedTime: '2026-09-20T08:00:00Z' }, now),
    '2026-09-20T08:00:00Z',
  );

  assert.throws(
    () => parseApprovedTime({ approvedTime: '2026-09-19T10:00:00Z' }, now),
    /stale/,
  );

  assert.throws(
    () => parseApprovedTime({ approvedTime: '2026-09-20T13:00:00Z' }, now),
    /future/,
  );
});

test('risk threshold comparisons never treat no-data as low risk', () => {
  assert.equal(isRiskAtLeast(-1, 1), false);
  assert.equal(isRiskAtLeast(null, 1), false);
  assert.equal(isRiskAtLeast(4, 3), true);
  assert.equal(isRiskAtLeast(3, 4), false);
  assert.equal(isRiskAtLeast(6, 6), true);
});

test('fire-risk diff reports only changed model classes', () => {
  const previous = {
    forestFireRiskCode: 3,
    grassFireRiskCode: 2,
    forestDrynessCode: 4,
  };
  const next = {
    forestFireRiskCode: 4,
    grassFireRiskCode: 2,
    forestDrynessCode: 5,
  };

  assert.deepEqual(diffFireRisk(previous, next), [
    { type: 'forest', from: 3, to: 4 },
    { type: 'dryness', from: 4, to: 5 },
  ]);
});
