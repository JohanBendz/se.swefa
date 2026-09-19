'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getLevelRank,
  pointInGeometry,
  isWarningActiveNow,
  localizedOfficialText,
  flattenWeatherWarnings,
  getWeatherWarningsForPoint,
  warningSignature,
} = require('../lib/warning-utils');

const square = {
  type: 'Polygon',
  coordinates: [[
    [10, 55],
    [20, 55],
    [20, 65],
    [10, 65],
    [10, 55],
  ]],
};

function payload(levelCode = 'YELLOW') {
  return [{
    id: 100,
    event: {
      sv: 'Testhändelse',
      en: 'Test event',
      code: 'TEST_EVENT',
    },
    warningAreas: [{
      id: 200,
      approximateStart: '2026-09-19T10:00:00Z',
      approximateEnd: '2026-09-20T10:00:00Z',
      published: '2026-09-19T08:00:00Z',
      warningLevel: {
        sv: levelCode === 'YELLOW' ? 'Gul' : levelCode,
        en: levelCode === 'YELLOW' ? 'Yellow' : levelCode,
        code: levelCode,
      },
      eventDescription: {
        sv: 'Officiell text',
        en: 'Official text',
        code: 'TEST_DETAIL',
      },
      areaName: {
        sv: 'Testområde',
        en: 'Test area',
      },
      area: {
        geometry: square,
      },
      descriptions: [],
    }],
  }];
}

test('warning level ranking preserves SMHI severity order', () => {
  assert.ok(getLevelRank('RED') > getLevelRank('ORANGE'));
  assert.ok(getLevelRank('ORANGE') > getLevelRank('YELLOW'));
  assert.ok(getLevelRank('YELLOW') > getLevelRank('MESSAGE'));
});

test('point-in-polygon includes boundary and excludes holes', () => {
  assert.equal(pointInGeometry(15, 60, square), true);
  assert.equal(pointInGeometry(10, 60, square), true);
  assert.equal(pointInGeometry(25, 60, square), false);

  const withHole = {
    type: 'Polygon',
    coordinates: [
      square.coordinates[0],
      [[14, 59], [16, 59], [16, 61], [14, 61], [14, 59]],
    ],
  };

  assert.equal(pointInGeometry(15, 60, withHole), false);
  assert.equal(pointInGeometry(12, 60, withHole), true);
});

test('point-in-geometry supports MultiPolygon', () => {
  const geometry = {
    type: 'MultiPolygon',
    coordinates: [
      square.coordinates,
      [[[30, 55], [31, 55], [31, 56], [30, 56], [30, 55]]],
    ],
  };

  assert.equal(pointInGeometry(30.5, 55.5, geometry), true);
  assert.equal(pointInGeometry(25, 55.5, geometry), false);
});

test('weather warning filtering excludes MESSAGE and expired areas', () => {
  const now = Date.parse('2026-09-19T12:00:00Z');
  assert.equal(flattenWeatherWarnings(payload('MESSAGE'), now).length, 0);
  assert.equal(flattenWeatherWarnings(payload('YELLOW'), now).length, 1);

  const expired = payload('RED');
  expired[0].warningAreas[0].approximateEnd = '2026-09-19T11:59:00Z';
  assert.equal(flattenWeatherWarnings(expired, now).length, 0);
});

test('warning matching uses GeoJSON polygons and sorts highest severity first', () => {
  const now = Date.parse('2026-09-19T12:00:00Z');
  const yellow = payload('YELLOW');
  const red = payload('RED');
  red[0].id = 101;
  red[0].warningAreas[0].id = 201;

  const result = getWeatherWarningsForPoint([...yellow, ...red], 15, 60, now);

  assert.equal(result.length, 2);
  assert.equal(result[0].levelCode, 'RED');
  assert.equal(getWeatherWarningsForPoint([...yellow, ...red], 25, 60, now).length, 0);
});

test('active warning state respects start and end timestamps', () => {
  const warning = flattenWeatherWarnings(payload('YELLOW'), Date.parse('2026-09-19T09:00:00Z'))[0];

  assert.equal(isWarningActiveNow(warning, Date.parse('2026-09-19T09:00:00Z')), false);
  assert.equal(isWarningActiveNow(warning, Date.parse('2026-09-19T12:00:00Z')), true);
  assert.equal(isWarningActiveNow(warning, Date.parse('2026-09-20T11:00:00Z')), false);
});

test('official warning text is never machine-translated', () => {
  const value = { sv: 'Svensk originaltext', en: 'English original text' };

  assert.equal(localizedOfficialText(value, 'sv'), 'Svensk originaltext');
  assert.equal(localizedOfficialText(value, 'en'), 'English original text');
  assert.equal(localizedOfficialText(value, 'no'), 'English original text');
});

test('warning signatures change when the published warning changes', () => {
  const first = flattenWeatherWarnings(payload('YELLOW'), Date.parse('2026-09-19T12:00:00Z'))[0];
  const second = { ...first, published: '2026-09-19T09:00:00Z' };

  assert.notEqual(warningSignature(first), warningSignature(second));
});
