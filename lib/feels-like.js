'use strict';

// Formula selection and coefficients intentionally preserve the behaviour of
// feels@3.0.0, previously used by this app. That package is MIT licensed.
// See THIRD_PARTY_NOTICES.md.

function validHumidity(humidity) {
  return Number.isFinite(humidity) && humidity > 0 && humidity <= 100;
}

function celsiusToFahrenheit(temp) {
  return (temp * 9) / 5 + 32;
}

function fahrenheitToCelsius(temp) {
  return ((temp - 32) * 5) / 9;
}

function waterVapourPressure(temp, humidity) {
  return (humidity / 100) * 6.105 * Math.exp((17.27 * temp) / (237.7 + temp));
}

function heatIndex(temp, humidity) {
  if (temp < 20 || !validHumidity(humidity)) return null;

  const t = celsiusToFahrenheit(temp);
  const h = humidity;
  const value = 16.923 + 0.185212 * t + 5.37941 * h - 0.100254 * t * h
    + 9.41695e-3 * (t ** 2) + 7.28898e-3 * (h ** 2)
    + 3.45372e-4 * (t ** 2) * h - 8.14971e-4 * t * (h ** 2)
    + 1.02102e-5 * (t ** 2) * (h ** 2) - 3.8646e-5 * (t ** 3)
    + 2.91583e-5 * (h ** 3) + 1.42721e-6 * (t ** 3) * h
    + 1.97483e-7 * t * (h ** 3) - 2.18429e-8 * (t ** 3) * (h ** 2)
    + 8.43296e-10 * (t ** 2) * (h ** 3) - 4.81975e-11 * (t ** 3) * (h ** 3);

  return fahrenheitToCelsius(value);
}

function humidex(temp, humidity) {
  if (temp <= 0 || !validHumidity(humidity)) return null;
  return temp + 0.5555 * (waterVapourPressure(temp, humidity) - 10);
}

function apparentTemperature(temp, humidity, speed) {
  if (speed < 0 || !validHumidity(humidity)) return null;
  return temp + 0.33 * waterVapourPressure(temp, humidity) - 0.70 * speed - 4.00;
}

function windChill(temp, speed) {
  if (temp > 0 || speed < 0) return null;

  const speedKph = speed * 3.6;
  if (speedKph >= 5) {
    return 13.12 + 0.6215 * temp - 11.37 * (speedKph ** 0.16)
      + 0.3965 * temp * (speedKph ** 0.16);
  }

  return temp + ((-1.59 + 0.1345 * temp) / 5) * speedKph;
}

function calculateFeelsLike(temp, humidity, speed) {
  if (![temp, humidity, speed].every(Number.isFinite)) return null;

  const candidates = [
    heatIndex(temp, humidity),
    humidex(temp, humidity),
    apparentTemperature(temp, humidity, speed),
    windChill(temp, speed),
  ].filter(Number.isFinite);

  if (candidates.length === 0) return null;
  return candidates.reduce((sum, value) => sum + value, 0) / candidates.length;
}

module.exports = {
  calculateFeelsLike,
};
