# SMHI Weather Forecast for Homey

Weather forecasts from SMHI for Homey, using the current **SNOW1gv1** forecast API.

## Features

- Create multiple weather devices with independent settings.
- Use Homey's geolocation or a custom latitude/longitude.
- Select forecast offsets from **now up to 36 hours**.
- Weather, temperature and feels-like temperature.
- Wind direction, wind speed and gust speed.
- Relative humidity, air pressure and visibility.
- Thunderstorm probability.
- Total, low, medium and high cloud cover.
- Precipitation type and precipitation statistics.
- Flow triggers for weather changes and selected sensor changes.
- Flow conditions for weather, temperature, wind, cloud cover and precipitation.
- Forecast-oriented conditions such as rain, maximum wind speed and minimum temperature within the next hours.

The app is intended for locations within SMHI's SNOW forecast area and is primarily presented for Sweden, Norway, Denmark and Finland.

## Flow cards

Existing Flow card IDs and capability IDs are preserved for backwards compatibility. v0.8.0 also adds:

- **Weather changes to ...**
- **Weather changes from ... to ...**
- Forecast conditions for rain, maximum wind speed and minimum temperature in the coming hours.
- A **Severe weather condition** trigger based on forecast symbols. This is an app-level condition and **not an official SMHI weather warning**.

## Important upgrade note for v0.8.0

v0.8.0 corrects several interpretation problems introduced during the v0.7.0 migration to SNOW1gv1, including wind heading and precipitation classification.

If you changed a Flow to compensate for incorrect values in v0.7.0, review that Flow after upgrading. For example, a wind direction that was previously shown with the wrong compass heading is now mapped correctly.

## Data source and update behavior

Weather data is fetched from SMHI's SNOW1gv1 point forecast API. Each device refreshes automatically and also refreshes immediately when its forecast time or location settings change.

Transient API/network failures are retried. If a fetch fails completely, the app keeps the last successfully received capability values and logs the error.

## Dependency policy

The app has **zero third-party runtime dependencies**. Network access uses Node's built-in HTTPS module and the feels-like calculation is implemented locally with regression tests.

`package-lock.json` is intentionally kept even with zero dependencies so CI can verify the dependency graph deterministically. `.npmrc` uses `save-exact=true` so any future dependency must be added explicitly and pinned.

## Development

Before switching branches or starting a new test cycle, verify that the local working tree is clean:

```bash
npm run clean-check
```

Then prepare npm metadata and run the regression tests:

```bash
npm ci
npm test
```

Run the app on a connected Homey:

```bash
homey app run
```

## Feedback

- Community discussion: [Swedish Weather Forecast](https://community.athom.com/t/swedish-weather-forecast/)
- Bugs and feature requests: [GitHub Issues](https://github.com/JohanBendz/se.swefa/issues)

## Change log

### v0.8.1

- Removed all third-party runtime dependencies.
- Replaced `node-fetch` with Node's built-in HTTPS module.
- Replaced `feels` with a local implementation that preserves the previous formulas and outputs.
- Added regression coverage for feels-like calculations and a CI guard enforcing zero runtime dependencies.
- Updated to npm lockfile version 3 and added exact-version policy for any future dependencies.

### v0.8.0

- Stabilized the SNOW1gv1 migration.
- Corrected wind direction headings and precipitation type handling.
- Corrected cloud-cover handling.
- Fixed forecast settings being applied one change late.
- Completed previously declared forecast Flow conditions and severe-weather trigger.
- Added weather changed-to and changed-from/to triggers.
- Improved retry, timeout, timer and timezone handling.
- Added regression tests and GitHub Actions CI.
- Removed committed dependencies from the repository.
- **Compatibility note:** Flows created to compensate for incorrect v0.7.0 wind headings or precipitation classification may need review.

### v0.7.0

- Migrated the weather backend from the retired PMP3gv2 API to SMHI SNOW1gv1.

### Earlier releases

See the Git history and Homey changelog for older release notes.
