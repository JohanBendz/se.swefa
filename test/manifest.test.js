'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8'));
}

test('all JSON manifests and locales parse', () => {
  for (const file of [
    'app.json',
    '.homeycompose/app.json',
    'drivers/weather/driver.flow.compose.json',
    'drivers/weather/driver.compose.json',
    'drivers/weather/driver.settings.compose.json',
    'locales/en.json',
    'locales/sv.json',
    'locales/no.json',
    'package.json',
    'package-lock.json',
    '.homeychangelog.json',
  ]) {
    assert.doesNotThrow(() => readJson(file), file);
  }
});

test('package, compose and generated app versions stay aligned', () => {
  const pkg = readJson('package.json');
  const compose = readJson('.homeycompose/app.json');
  const app = readJson('app.json');

  assert.equal(pkg.version, '0.7.1');
  assert.equal(compose.version, pkg.version);
  assert.equal(app.version, pkg.version);
  assert.equal(compose.category, 'climate');
  assert.equal(app.category, 'climate');
});

test('all Flow Compose cards exist in generated app.json', () => {
  const compose = readJson('drivers/weather/driver.flow.compose.json');
  const app = readJson('app.json');

  const appTriggers = new Set((app.flow?.triggers || []).map(card => card.id));
  const appConditions = new Set((app.flow?.conditions || []).map(card => card.id));

  for (const trigger of compose.triggers || []) {
    assert.ok(appTriggers.has(trigger.id), `missing generated trigger: ${trigger.id}`);
  }

  for (const condition of compose.conditions || []) {
    assert.ok(appConditions.has(condition.id), `missing generated condition: ${condition.id}`);
  }
});

test('stabilization Flow cards are present', () => {
  const compose = readJson('drivers/weather/driver.flow.compose.json');
  const triggerIds = new Set((compose.triggers || []).map(card => card.id));
  const conditionIds = new Set((compose.conditions || []).map(card => card.id));

  for (const id of [
    'WeatherSituationChangedTo',
    'WeatherSituationChangedFromTo',
    'extreme_weather',
  ]) {
    assert.ok(triggerIds.has(id), `missing trigger: ${id}`);
  }

  for (const id of [
    'will_rain_in_next_hours',
    'max_wind_speed_exceeds',
    'min_temperature_below',
  ]) {
    assert.ok(conditionIds.has(id), `missing condition: ${id}`);
  }
});
