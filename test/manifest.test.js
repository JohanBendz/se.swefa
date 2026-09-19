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

  assert.equal(pkg.version, '0.8.1');
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

test('custom capability definitions are all used by the weather driver', () => {
  const composeDir = path.join(__dirname, '..', '.homeycompose', 'capabilities');
  const capabilityFiles = new Set(
    fs.readdirSync(composeDir)
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace(/\.json$/, '')),
  );
  const driver = readJson('drivers/weather/driver.compose.json');
  const driverCapabilities = new Set(driver.capabilities || []);

  assert.deepEqual([...capabilityFiles].sort(), [...driverCapabilities].sort());
});

test('runtime dependency graph stays empty', () => {
  const pkg = readJson('package.json');
  const lock = readJson('package-lock.json');

  assert.deepEqual(pkg.dependencies || {}, {});
  assert.equal(lock.lockfileVersion, 3);
  assert.deepEqual(Object.keys(lock.packages || {}), ['']);
  assert.deepEqual(lock.packages[''].dependencies || {}, {});

  const deviceSource = fs.readFileSync(
    path.join(__dirname, '..', 'drivers', 'weather', 'device.js'),
    'utf8',
  );
  assert.doesNotMatch(deviceSource, /require\(['"](?:node-fetch|feels)['"]\)/);
});
