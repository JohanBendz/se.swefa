'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateFeelsLike } = require('../lib/feels-like');

function rounded(value) {
  return Math.round(value * 100) / 100;
}

test('local feels-like implementation preserves prior library outputs', () => {
  assert.equal(rounded(calculateFeelsLike(11.3, 84, 4.3)), 9.99);
  assert.equal(rounded(calculateFeelsLike(12.6, 93, 3.8)), 12.49);
  assert.equal(rounded(calculateFeelsLike(-10, 80, 5)), -17.1);
  assert.equal(rounded(calculateFeelsLike(25, 60, 2)), 27.35);
  assert.equal(rounded(calculateFeelsLike(0, 50, 0)), -1.5);
});

test('feels-like returns null when no valid formula can be applied', () => {
  assert.equal(calculateFeelsLike(10, 0, 2), null);
  assert.equal(calculateFeelsLike(Number.NaN, 80, 2), null);
});
