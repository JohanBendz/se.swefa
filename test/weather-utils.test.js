'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  formatCoordinate,
  percentToOctas,
  getWeatherConditionCode,
  getWindDirectionCode,
  getPrecipitationTranslationKey,
  isPrecipitationMatch,
  precipitationAmountToHourlyRate,
  findClosestForecastPoint,
  isSevereWeatherSymbol,
  isAbove,
} = require('../lib/weather-utils');

test('issue #12: "temperature is above" uses the positive comparison', () => {
  assert.equal(isAbove(10, 5), true);
  assert.equal(isAbove(10, 15), false);
  assert.equal(isAbove(10, 10), false);
});

test('coordinates are normalized to six decimals', () => {
  assert.equal(formatCoordinate(18.068581234, 'longitude'), '18.068581');
  assert.throws(() => formatCoordinate('not-a-number', 'longitude'));
});

test('SNOW cloud percentages are converted to legacy oktas', () => {
  assert.equal(percentToOctas(0), 0);
  assert.equal(percentToOctas(12.5), 1);
  assert.equal(percentToOctas(50), 4);
  assert.equal(percentToOctas(100), 8);
});

test('wind direction follows meteorological degrees clockwise from north', () => {
  assert.equal(getWindDirectionCode(0), 'North');
  assert.equal(getWindDirectionCode(45), 'North-East');
  assert.equal(getWindDirectionCode(90), 'East');
  assert.equal(getWindDirectionCode(180), 'South');
  assert.equal(getWindDirectionCode(270), 'West');
  assert.equal(getWindDirectionCode(360), 'North');
});

test('weather symbol IDs remain stable across localization', () => {
  assert.equal(getWeatherConditionCode(1), 'Clearsky');
  assert.equal(getWeatherConditionCode(6), 'Overcast');
  assert.equal(getWeatherConditionCode(27), 'Heavysnowfall');
  assert.equal(getWeatherConditionCode(99), null);
});

test('SNOW precipitation type mapping matches the new code table', () => {
  assert.equal(getPrecipitationTranslationKey(1, 1), 'precipitation_situation3');
  assert.equal(getPrecipitationTranslationKey(5, 1), 'precipitation_situation1');
  assert.equal(getPrecipitationTranslationKey(11, 1), 'precipitation_situation4');
  assert.equal(getPrecipitationTranslationKey(12, 1), 'precipitation_situation6');
  assert.equal(getPrecipitationTranslationKey(10, 1), 'precipitation_situation7');
  assert.equal(getPrecipitationTranslationKey(5, 0), 'precipitation_situation0');
});

test('rain/snow Flow matching uses stable SNOW categories', () => {
  assert.equal(isPrecipitationMatch(1, 'Rain', 1), true);
  assert.equal(isPrecipitationMatch(5, 'Rain', 1), false);
  assert.equal(isPrecipitationMatch(5, 'Snow', 1), true);
  assert.equal(isPrecipitationMatch(7, 'Rain', 1), true);
  assert.equal(isPrecipitationMatch(7, 'Snow', 1), true);
  assert.equal(isPrecipitationMatch(10, 'RainSnow', 1), true);
  assert.equal(isPrecipitationMatch(1, 'Rain', 0), false);
});

test('precipitation amount is normalized to mm/h over multi-hour intervals', () => {
  const point = {
    intervalParametersStartTime: '2026-09-18T00:00:00Z',
    time: '2026-09-18T03:00:00Z',
  };
  assert.equal(precipitationAmountToHourlyRate(6, point), 2);
});

test('point-in-time forecast selection works with irregular SNOW intervals', () => {
  const series = [
    { time: '2026-09-18T00:00:00Z' },
    { time: '2026-09-18T01:00:00Z' },
    { time: '2026-09-18T04:00:00Z' },
    { time: '2026-09-18T10:00:00Z' },
  ];

  const point = findClosestForecastPoint(series, '2026-09-18T05:00:00Z');
  assert.equal(point.time, '2026-09-18T04:00:00Z');
});

test('severe weather trigger is based on weather symbols, not official warnings', () => {
  assert.equal(isSevereWeatherSymbol(11), true);
  assert.equal(isSevereWeatherSymbol(20), true);
  assert.equal(isSevereWeatherSymbol(6), false);
});
