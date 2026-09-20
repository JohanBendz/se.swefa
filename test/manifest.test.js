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
    'drivers/firerisk/driver.flow.compose.json',
    'drivers/firerisk/driver.compose.json',
    'drivers/firerisk/driver.settings.compose.json',
    'drivers/sealevel/driver.flow.compose.json',
    'drivers/sealevel/driver.compose.json',
    'drivers/waves/driver.flow.compose.json',
    'drivers/waves/driver.compose.json',
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

  assert.equal(pkg.version, '0.11.0');
  assert.equal(compose.version, pkg.version);
  assert.equal(app.version, pkg.version);
  assert.equal(compose.category, 'climate');
  assert.equal(app.category, 'climate');
});

test('all Flow Compose cards exist in generated app.json', () => {
  const app = readJson('app.json');
  const appTriggers = new Set((app.flow?.triggers || []).map(card => card.id));
  const appConditions = new Set((app.flow?.conditions || []).map(card => card.id));

  for (const driverId of ['weather', 'warnings', 'firerisk', 'sealevel', 'waves']) {
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
  for (const driverId of ['weather', 'warnings', 'firerisk', 'sealevel', 'waves']) {
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

test('clean working tree guard is wired into npm scripts', () => {
  const pkg = readJson('package.json');

  assert.equal(pkg.scripts?.['clean-check'], 'node scripts/clean-check.js');
  assert.ok(
    fs.existsSync(path.join(__dirname, '..', 'scripts', 'clean-check.js')),
    'missing scripts/clean-check.js',
  );
});

test('warning capabilities use the dedicated warning icon', () => {
  const app = readJson('app.json');
  const iconPath = path.join(__dirname, '..', 'assets', 'icons', 'warning.svg');

  assert.ok(fs.existsSync(iconPath), 'missing warning icon asset');

  for (const id of [
    'smhi_warning_status_cp',
    'smhi_warning_level_cp',
    'smhi_warning_event_cp',
    'smhi_warning_area_cp',
    'smhi_warning_count_cp',
    'smhi_warning_source_cp',
  ]) {
    const compose = readJson(`.homeycompose/capabilities/${id}.json`);
    assert.equal(compose.icon, '/assets/icons/warning.svg', `wrong compose icon for ${id}`);
    assert.equal(app.capabilities[id]?.icon, compose.icon, `generated icon mismatch for ${id}`);
  }
});

test('fire-risk driver is generated with its capabilities and Flow cards', () => {
  const app = readJson('app.json');
  const driver = (app.drivers || []).find(item => item.id === 'firerisk');

  assert.ok(driver, 'missing generated firerisk driver');

  for (const capability of [
    'fire_risk_forecast_for_cp',
    'forest_fire_risk_cp',
    'grass_fire_risk_cp',
    'forest_dryness_cp',
    'fire_risk_approved_cp',
    'fire_risk_source_cp',
  ]) {
    assert.ok(driver.capabilities.includes(capability), `missing fire-risk capability: ${capability}`);
    assert.ok(app.capabilities[capability], `missing generated fire-risk capability definition: ${capability}`);
  }

  const triggerIds = new Set((app.flow?.triggers || []).map(card => card.id));
  const conditionIds = new Set((app.flow?.conditions || []).map(card => card.id));

  for (const id of [
    'ForestFireRiskChangedTo',
    'GrassFireRiskChangedTo',
    'ForestDrynessChangedTo',
  ]) {
    assert.ok(triggerIds.has(id), `missing fire-risk trigger: ${id}`);
  }

  for (const id of [
    'forest_fire_risk_at_least',
    'grass_fire_risk_at_least',
    'forest_dryness_at_least',
  ]) {
    assert.ok(conditionIds.has(id), `missing fire-risk condition: ${id}`);
  }
});

test('fire-risk capabilities use the dedicated fire icon', () => {
  const app = readJson('app.json');
  const iconPath = path.join(__dirname, '..', 'assets', 'icons', 'fire.svg');

  assert.ok(fs.existsSync(iconPath), 'missing fire icon asset');

  for (const id of [
    'forest_fire_risk_cp',
    'grass_fire_risk_cp',
    'forest_dryness_cp',
    'fire_risk_source_cp',
  ]) {
    const compose = readJson(`.homeycompose/capabilities/${id}.json`);
    assert.equal(compose.icon, '/assets/icons/fire.svg', `wrong compose icon for ${id}`);
    assert.equal(app.capabilities[id]?.icon, compose.icon, `generated icon mismatch for ${id}`);
  }
});

test('sea-level and waves drivers are generated with their Flow cards', () => {
  const app = readJson('app.json');

  const seaLevel = (app.drivers || []).find(driver => driver.id === 'sealevel');
  const waves = (app.drivers || []).find(driver => driver.id === 'waves');

  assert.ok(seaLevel, 'missing generated sealevel driver');
  assert.ok(waves, 'missing generated waves driver');

  for (const capability of [
    'sea_level_rh2000_cp',
    'ocean_station_cp',
    'ocean_observed_at_cp',
    'ocean_observation_age_cp',
    'ocean_quality_cp',
    'ocean_source_cp',
  ]) {
    assert.ok(seaLevel.capabilities.includes(capability), `missing sea-level capability: ${capability}`);
    assert.ok(app.capabilities[capability], `missing generated ocean capability: ${capability}`);
  }

  for (const capability of [
    'significant_wave_height_cp',
    'maximum_wave_height_cp',
    'mean_wave_period_cp',
    'mean_wave_direction_cp',
    'mean_wave_direction_heading_cp',
    'ocean_station_cp',
    'ocean_observed_at_cp',
    'ocean_observation_age_cp',
    'ocean_quality_cp',
    'ocean_source_cp',
  ]) {
    assert.ok(waves.capabilities.includes(capability), `missing waves capability: ${capability}`);
    assert.ok(app.capabilities[capability], `missing generated wave capability: ${capability}`);
  }

  const triggerIds = new Set((app.flow?.triggers || []).map(card => card.id));
  const conditionIds = new Set((app.flow?.conditions || []).map(card => card.id));

  for (const id of [
    'SeaLevelCrossedAbove',
    'SeaLevelCrossedBelow',
    'SignificantWaveHeightCrossedAbove',
    'MaximumWaveHeightCrossedAbove',
  ]) {
    assert.ok(triggerIds.has(id), `missing ocean trigger: ${id}`);
  }

  for (const id of [
    'sea_level_above',
    'sea_level_below',
    'significant_wave_height_above',
    'maximum_wave_height_above',
  ]) {
    assert.ok(conditionIds.has(id), `missing ocean condition: ${id}`);
  }
});

test('ocean capabilities use dedicated icons', () => {
  const app = readJson('app.json');

  for (const icon of ['ocean.svg', 'sea-level.svg', 'waves.svg']) {
    assert.ok(
      fs.existsSync(path.join(__dirname, '..', 'assets', 'icons', icon)),
      `missing ocean icon: ${icon}`,
    );
  }

  const expected = {
    ocean_station_cp: '/assets/icons/ocean.svg',
    ocean_quality_cp: '/assets/icons/ocean.svg',
    ocean_source_cp: '/assets/icons/ocean.svg',
    sea_level_rh2000_cp: '/assets/icons/sea-level.svg',
    significant_wave_height_cp: '/assets/icons/waves.svg',
    maximum_wave_height_cp: '/assets/icons/waves.svg',
    mean_wave_period_cp: '/assets/icons/waves.svg',
    mean_wave_direction_cp: '/assets/icons/waves.svg',
    mean_wave_direction_heading_cp: '/assets/icons/waves.svg',
  };

  for (const [id, icon] of Object.entries(expected)) {
    const compose = readJson(`.homeycompose/capabilities/${id}.json`);
    assert.equal(compose.icon, icon, `wrong compose icon for ${id}`);
    assert.equal(app.capabilities[id]?.icon, icon, `generated icon mismatch for ${id}`);
  }
});
