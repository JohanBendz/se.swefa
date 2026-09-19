'use strict';

const Homey = require('homey');
const { requestJson } = require('./lib/http-json');

const SMHI_WARNING_URL = 'https://opendata-download-warnings.smhi.se/ibww/api/version/1/warning.json';
const WARNING_CACHE_MS = 10 * 60 * 1000;
const FIRE_RISK_BASE_URL = 'https://opendata-download-metfcst.smhi.se/api/category/fwif1g/version/1/daily';
const FIRE_RISK_CACHE_MS = 30 * 60 * 1000;

class SWEFA extends Homey.App {
  async onInit() {
    this._warningCache = null;
    this._warningCacheTime = 0;
    this._warningFetchPromise = null;
    this._fireRiskCache = new Map();

    this.log('SMHI weather forecasting app successfully started.');
  }

  async getSmhiWarnings() {
    const now = Date.now();

    if (this._warningCache && now - this._warningCacheTime < WARNING_CACHE_MS) {
      return this._warningCache;
    }

    if (this._warningFetchPromise) {
      return this._warningFetchPromise;
    }

    this._warningFetchPromise = this._fetchSmhiWarnings()
      .then((data) => {
        this._warningCache = data;
        this._warningCacheTime = Date.now();
        return data;
      })
      .finally(() => {
        this._warningFetchPromise = null;
      });

    return this._warningFetchPromise;
  }

  async getSmhiFireRisk(longitude, latitude) {
    const key = `${longitude},${latitude}`;
    const now = Date.now();
    const cached = this._fireRiskCache.get(key);

    if (cached?.data && now - cached.time < FIRE_RISK_CACHE_MS) {
      return cached.data;
    }

    if (cached?.promise) {
      return cached.promise;
    }

    const url = `${FIRE_RISK_BASE_URL}/geotype/point/lon/${longitude}/lat/${latitude}/data.json`;
    const promise = this._fetchJsonWithRetry(url, {
      label: 'SMHI fire risk',
      maxBytes: 4 * 1024 * 1024,
    })
      .then((data) => {
        if (!data || !Array.isArray(data.timeSeries)) {
          throw new Error('SMHI fire risk response has no timeSeries');
        }

        this._fireRiskCache.set(key, {
          data,
          time: Date.now(),
          promise: null,
        });

        return data;
      })
      .catch((error) => {
        this._fireRiskCache.delete(key);
        throw error;
      });

    this._fireRiskCache.set(key, {
      data: cached?.data ?? null,
      time: cached?.time ?? 0,
      promise,
    });

    return promise;
  }

  async _fetchSmhiWarnings() {
    const data = await this._fetchJsonWithRetry(SMHI_WARNING_URL, {
      label: 'SMHI warning',
      maxBytes: 8 * 1024 * 1024,
    });

    if (!Array.isArray(data)) {
      throw new Error('SMHI warning response was not an array');
    }

    return data;
  }

  async _fetchJsonWithRetry(url, {
    label = 'SMHI',
    maxBytes = 2 * 1024 * 1024,
  } = {}) {
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await requestJson(url, {
          timeoutMs: 10000,
          maxBytes,
        });
      } catch (error) {
        lastError = error;

        if (attempt < 3) {
          await new Promise(resolve => this.homey.setTimeout(
            resolve,
            300 * (2 ** (attempt - 1)),
          ));
        }
      }
    }

    throw lastError ?? new Error(`${label} request failed`);
  }
}

module.exports = SWEFA;

// Some weather icons made by Freepik @ https://www.flaticon.com/
