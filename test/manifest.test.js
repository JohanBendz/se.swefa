'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { builtinModules } = require('node:module');

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
    'drivers/warnings/driver.flow.compose.json',
    'drivers/warnings/driver.compose.json',
    'drivers/warnings/driver.settings.compose.json',
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
  const app = readJson('app.json');
  const appTriggers = new Set((app.flow?.triggers || []).map(card => card.id));
  const appConditions = new Set((app.flow?.conditions || []).map(card => card.id));

  for (const driverId of ['weather', 'warnings']) {
    const compose = readJson(`drivers/${driverId}/driver.flow.compose.json`);

    for (const trigger of compose.triggers || []) {
      assert.ok(appTriggers.has(trigger.id), `missing generated trigger: ${trigger.id}`);
    }

    for (const condition of compose.conditions || []) {
      assert.ok(appConditions.has(condition.id), `missing generated condition: ${condition.id}`);
    }
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

test('custom capability definitions are used by at least one driver', () => {
  const composeDir = path.join(__dirname, '..', '.homeycompose', 'capabilities');
  const capabilityFiles = new Set(
    fs.readdirSync(composeDir)
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace(/\.json$/, '')),
  );

  const driverCapabilities = new Set();
  for (const driverId of ['weather', 'warnings']) {
    const driver = readJson(`drivers/${driverId}/driver.compose.json`);
    for (const capability of driver.capabilities || []) {
      driverCapabilities.add(capability);
    }
  }

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

test('runtime code imports only Node built-ins, Homey, or local modules', () => {
  const allowedExternal = new Set([
    ...builtinModules,
    ...builtinModules.map(name => `node:${name}`),
    'homey',
  ]);

  const roots = [
    path.join(__dirname, '..', 'app.js'),
    path.join(__dirname, '..', 'drivers'),
    path.join(__dirname, '..', 'lib'),
  ];

  const files = [];
  const walk = (entry) => {
    const stat = fs.statSync(entry);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(entry)) walk(path.join(entry, child));
    } else if (entry.endsWith('.js')) {
      files.push(entry);
    }
  };
  roots.forEach(walk);

  const externalImports = [];
  const requirePattern = /require\(['"]([^'"]+)['"]\)/g;

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = requirePattern.exec(source)) !== null) {
      const specifier = match[1];
      if (!specifier.startsWith('.') && !allowedExternal.has(specifier)) {
        externalImports.push(`${path.relative(path.join(__dirname, '..'), file)} -> ${specifier}`);
      }
    }
  }

  assert.deepEqual(externalImports, []);
});

test('warning driver is generated with its capabilities and Flow cards', () => {
  const app = readJson('app.json');
  const warningDriver = (app.drivers || []).find(driver => driver.id === 'warnings');

  assert.ok(warningDriver, 'missing generated warnings driver');

  for (const capability of [
    'smhi_warning_status_cp',
    'smhi_warning_level_cp',
    'smhi_warning_event_cp',
    'smhi_warning_area_cp',
    'smhi_warning_valid_from_cp',
    'smhi_warning_valid_to_cp',
    'smhi_warning_count_cp',
    'smhi_warning_source_cp',
  ]) {
    assert.ok(warningDriver.capabilities.includes(capability), `missing warning capability: ${capability}`);
    assert.ok(app.capabilities[capability], `missing generated warning capability definition: ${capability}`);
  }

  const triggerIds = new Set((app.flow?.triggers || []).map(card => card.id));
  const conditionIds = new Set((app.flow?.conditions || []).map(card => card.id));

  for (const id of ['SmhiWarningIssued', 'SmhiWarningUpdated', 'SmhiWarningEnded']) {
    assert.ok(triggerIds.has(id), `missing warning trigger: ${id}`);
  }

  for (const id of ['smhi_warning_present', 'smhi_warning_active_now', 'smhi_warning_level_at_least']) {
    assert.ok(conditionIds.has(id), `missing warning condition: ${id}`);
  }
});

test('runtime JavaScript parses without syntax errors', () => {
  const vm = require('node:vm');
  const roots = [
    path.join(__dirname, '..', 'app.js'),
    path.join(__dirname, '..', 'drivers'),
    path.join(__dirname, '..', 'lib'),
  ];

  const files = [];
  const walk = (entry) => {
    const stat = fs.statSync(entry);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(entry)) walk(path.join(entry, child));
    } else if (entry.endsWith('.js')) {
      files.push(entry);
    }
  };
  roots.forEach(walk);

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotThrow(
      () => new vm.Script(source, { filename: file }),
      path.relative(path.join(__dirname, '..'), file),
    );
  }
});
