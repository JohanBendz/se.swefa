'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OCOBS_PARAMETERS,
  titleMatches,
  resolveParameterKey,
  validateParameterMetadata,
  normalizeStations,
  distanceKm,
  sortStationsByDistance,
  parseObservationDate,
  latestObservation,
  compassDirection,
  crossedAbove,
  crossedBelow,
} = require('../lib/ocean-utils');

test('ocean parameter resolver prefers the catalog title over fallback IDs', () => {
  const catalog = {
    resource: [
      { key: '99', title: 'Havsvattenstånd RH2000, minutvärde' },
      { key: '42', title: 'Våghöjd, signifikant 30 min' },
    ],
  };

  assert.equal(resolveParameterKey(catalog, OCOBS_PARAMETERS.seaLevelRh2000), '99');
  assert.equal(resolveParameterKey(catalog, OCOBS_PARAMETERS.significantWaveHeight), '42');
});

test('fallback parameter metadata must match the expected semantic title', () => {
  assert.equal(
    validateParameterMetadata(
      { key: '13', title: 'Havsvattenstånd RH2000, minutvärde' },
      OCOBS_PARAMETERS.seaLevelRh2000,
    ),
    true,
  );

  assert.equal(
    validateParameterMetadata(
      { key: '13', title: 'Något helt annat' },
      OCOBS_PARAMETERS.seaLevelRh2000,
    ),
    false,
  );
});

test('title matching is case- and whitespace-tolerant', () => {
  assert.equal(
    titleMatches('  VÅGHÖJD,   Signifikant 30 min ', ['våghöjd', 'signifikant']),
    true,
  );
});

test('station normalization keeps active stations with valid coordinates', () => {
  const stations = normalizeStations({
    station: [
      { id: 1, name: 'A', owner: 'SMHI', latitude: 59, longitude: 18, active: true },
      { id: 2, name: 'B', latitude: 60, longitude: 19, active: false },
      { id: 3, name: 'C', latitude: 'bad', longitude: 19, active: true },
    ],
  });

  assert.deepEqual(stations, [{
    id: '1',
    name: 'A',
    owner: 'SMHI',
    latitude: 59,
    longitude: 18,
    updated: null,
  }]);
});

test('station sorting orders by great-circle distance', () => {
  const stations = [
    { id: 'far', name: 'Far', latitude: 60, longitude: 18 },
    { id: 'near', name: 'Near', latitude: 59.1, longitude: 18 },
  ];

  const sorted = sortStationsByDistance(stations, 59, 18);

  assert.equal(sorted[0].id, 'near');
  assert.ok(sorted[0].distanceKm < sorted[1].distanceKm);
  assert.ok(distanceKm(59, 18, 59, 18) < 0.001);
});

test('observation timestamps accept epoch milliseconds, epoch seconds and ISO', () => {
  assert.equal(parseObservationDate(1_700_000_000_000), 1_700_000_000_000);
  assert.equal(parseObservationDate(1_700_000_000), 1_700_000_000_000);
  assert.equal(
    parseObservationDate('2026-09-20T00:00:00Z'),
    Date.parse('2026-09-20T00:00:00Z'),
  );
});

test('latest observation selects newest numeric value and reports age', () => {
  const now = Date.parse('2026-09-20T00:30:00Z');
  const payload = {
    value: [
      { date: Date.parse('2026-09-20T00:00:00Z'), value: '12.3', quality: 'G' },
      { date: Date.parse('2026-09-20T00:20:00Z'), value: '13.1', quality: 'O' },
      { date: Date.parse('2026-09-20T00:25:00Z'), value: 'bad', quality: 'O' },
    ],
  };

  assert.deepEqual(latestObservation(payload, { now, maxAgeMs: 60 * 60 * 1000 }), {
    date: Date.parse('2026-09-20T00:20:00Z'),
    value: 13.1,
    quality: 'O',
    depth: null,
    ageMs: 10 * 60 * 1000,
    ageMinutes: 10,
  });
});

test('stale and implausibly future observations are rejected', () => {
  const now = Date.parse('2026-09-20T00:30:00Z');

  assert.equal(latestObservation({
    value: [{ date: Date.parse('2026-09-19T20:00:00Z'), value: '1.2' }],
  }, { now, maxAgeMs: 2 * 60 * 60 * 1000 }), null);

  assert.equal(latestObservation({
    value: [{ date: Date.parse('2026-09-20T02:00:00Z'), value: '1.2' }],
  }, { now }), null);
});

test('wave direction follows meteorological/ocean convention from which waves come', () => {
  assert.equal(compassDirection(0), 'North');
  assert.equal(compassDirection(90), 'East');
  assert.equal(compassDirection(180), 'South');
  assert.equal(compassDirection(270), 'West');
});

test('threshold crossing helpers only fire on actual crossings', () => {
  assert.equal(crossedAbove(20, 31, 30), true);
  assert.equal(crossedAbove(31, 32, 30), false);
  assert.equal(crossedBelow(20, 9, 10), true);
  assert.equal(crossedBelow(9, 8, 10), false);
});
