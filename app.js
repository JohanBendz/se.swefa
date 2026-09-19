'use strict';

const Homey = require('homey');
const { requestJson } = require('./lib/http-json');

const SMHI_WARNING_URL = 'https://opendata-download-warnings.smhi.se/ibww/api/version/1/warning.json';
const WARNING_CACHE_MS = 10 * 60 * 1000;

class SWEFA extends Homey.App {
  async onInit() {
    this._warningCache = null;
    this._warningCacheTime = 0;
    this._warningFetchPromise = null;

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

  async _fetchSmhiWarnings() {
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const data = await requestJson(SMHI_WARNING_URL, {
          timeoutMs: 10000,
          maxBytes: 8 * 1024 * 1024,
        });

        if (!Array.isArray(data)) {
          throw new Error('SMHI warning response was not an array');
        }

        return data;
      } catch (error) {
        lastError = error;

        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 300 * (2 ** (attempt - 1))));
        }
      }
    }

    throw lastError ?? new Error('SMHI warning request failed');
  }
}

module.exports = SWEFA;

// Some weather icons made by Freepik @ https://www.flaticon.com/
