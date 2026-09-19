'use strict';

const { Device } = require('homey');
const { formatCoordinate } = require('../../lib/weather-utils');
const {
  externalClassCode,
  selectDailyFireRiskPoint,
  parseApprovedTime,
  isRiskAtLeast,
  diffFireRisk,
} = require('../../lib/fire-risk-utils');

class FireRiskDevice extends Device {
  constructor(...args) {
    super(...args);

    this.pollInterval = 60 * 60 * 1000;
    this._refreshPromise = null;
    this._currentPoint = null;
    this._baselineEstablished = false;
  }

  async onInit() {
    this.log('SMHI Fire Risk Device initialized');

    this._forestTrigger = this.homey.flow.getDeviceTriggerCard('ForestFireRiskChangedTo');
    this._grassTrigger = this.homey.flow.getDeviceTriggerCard('GrassFireRiskChangedTo');
    this._drynessTrigger = this.homey.flow.getDeviceTriggerCard('ForestDrynessChangedTo');

    await this.refreshFireRisk({ resetBaseline: true });

    this._fireRiskInterval = this.homey.setInterval(() => {
      this.refreshFireRisk().catch(err => this.error(err));
    }, this.pollInterval);
  }

  async onSettings({ newSettings, changedKeys }) {
    if (changedKeys?.length) {
      await this.refreshFireRisk({
        settingsOverride: newSettings,
        resetBaseline: true,
      });
    }
  }

  async refreshFireRisk({
    settingsOverride = null,
    resetBaseline = false,
  } = {}) {
    if (this._refreshPromise) {
      await this._refreshPromise;
    }

    this._refreshPromise = this._refreshFireRisk({
      settingsOverride,
      resetBaseline,
    }).finally(() => {
      this._refreshPromise = null;
    });

    return this._refreshPromise;
  }

  async _refreshFireRisk({ settingsOverride, resetBaseline }) {
    try {
      const settings = settingsOverride || this.getSettings();
      const { longitude, latitude } = this.getCoordinatesFromSettings(settings);
      const dayOffset = Number(settings.forecastDay ?? 0);
      const timeZone = this.homey.clock.getTimezone() || 'Europe/Stockholm';
      const payload = await this.homey.app.getSmhiFireRisk(longitude, latitude);
      const approvedTime = parseApprovedTime(payload);

      const selected = selectDailyFireRiskPoint(
        payload,
        dayOffset,
        new Date(),
        timeZone,
      );

      if (!selected) {
        throw new Error('No SMHI fire-risk forecast found for the selected day');
      }

      const current = {
        ...selected,
        approvedTime,
        forecastFor: this.formatDate(selected.validTime, timeZone),
      };

      await this.updateCapabilities(current, timeZone);
      await this.processChanges(current, { resetBaseline });

      this._currentPoint = current;
      await this.setAvailable();
    } catch (error) {
      this._currentPoint = null;
      this.error('Failed to update SMHI fire risk:', error);
      await this.setUnavailable('Unable to update SMHI fire-risk forecast').catch(err => this.error(err));
    }
  }

  getCoordinatesFromSettings(settings) {
    const longitude = settings.usehomeylocation
      ? this.homey.geolocation.getLongitude()
      : Number.parseFloat(settings.longitude);

    const latitude = settings.usehomeylocation
      ? this.homey.geolocation.getLatitude()
      : Number.parseFloat(settings.latitude);

    return {
      longitude: Number(formatCoordinate(longitude, 'longitude')),
      latitude: Number(formatCoordinate(latitude, 'latitude')),
    };
  }

  getLocale() {
    return {
      en: 'en-GB',
      sv: 'sv-SE',
      no: 'nb-NO',
    }[this.homey.i18n.getLanguage()] ?? 'en-GB';
  }

  formatDate(value, timeZone = this.homey.clock.getTimezone()) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';

    return new Intl.DateTimeFormat(this.getLocale(), {
      timeZone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  }

  formatDateTime(value, timeZone = this.homey.clock.getTimezone()) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';

    return new Intl.DateTimeFormat(this.getLocale(), {
      timeZone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  labelFor(type, code) {
    if (code === null || code === -1) {
      return this.homey.__('fire_risk_no_data');
    }

    const key = {
      forest: `fire_risk_forest_${code}`,
      grass: `fire_risk_grass_${code}`,
      dryness: `fire_risk_dryness_${code}`,
    }[type];

    const text = key ? this.homey.__(key) : this.homey.__('fire_risk_no_data');
    const displayCode = externalClassCode(code, type);

    return displayCode ? `${displayCode} – ${text}` : text;
  }

  async updateCapabilities(current, timeZone) {
    const values = {
      forecastFor: current.forecastFor,
      forest: this.labelFor('forest', current.forestFireRiskCode),
      grass: this.labelFor('grass', current.grassFireRiskCode),
      dryness: this.labelFor('dryness', current.forestDrynessCode),
      approved: this.formatDateTime(current.approvedTime, timeZone),
      source: 'SMHI',
    };

    await Promise.all([
      this.setCapabilityValue('fire_risk_forecast_for_cp', values.forecastFor),
      this.setCapabilityValue('forest_fire_risk_cp', values.forest),
      this.setCapabilityValue('grass_fire_risk_cp', values.grass),
      this.setCapabilityValue('forest_dryness_cp', values.dryness),
      this.setCapabilityValue('fire_risk_approved_cp', values.approved),
      this.setCapabilityValue('fire_risk_source_cp', values.source),
    ].map(promise => promise.catch(err => this.error(err))));
  }

  async processChanges(current, { resetBaseline = false } = {}) {
    if (resetBaseline || !this._baselineEstablished || !this._currentPoint) {
      this._baselineEstablished = true;
      return;
    }

    for (const change of diffFireRisk(this._currentPoint, current)) {
      await this.triggerChange(change, current);
    }
  }

  async triggerChange(change, current) {
    let card;
    let tokens;

    if (change.type === 'forest') {
      card = this._forestTrigger;
      tokens = {
        risk_level_text: this.labelFor('forest', change.to),
        risk_code: externalClassCode(change.to, 'forest') || 'N/A',
        forecast_for: current.forecastFor,
        source: 'SMHI',
      };
    } else if (change.type === 'grass') {
      card = this._grassTrigger;
      tokens = {
        risk_level_text: this.labelFor('grass', change.to),
        risk_code: externalClassCode(change.to, 'grass') || 'N/A',
        forecast_for: current.forecastFor,
        source: 'SMHI',
      };
    } else {
      card = this._drynessTrigger;
      tokens = {
        dryness_level_text: this.labelFor('dryness', change.to),
        risk_code: externalClassCode(change.to, 'dryness') || 'N/A',
        forecast_for: current.forecastFor,
        source: 'SMHI',
      };
    }

    await card.trigger(this, tokens, { toCode: change.to }).catch(err => this.error(err));
  }

  isForestFireRiskAtLeast(threshold) {
    return isRiskAtLeast(this._currentPoint?.forestFireRiskCode, threshold);
  }

  isGrassFireRiskAtLeast(threshold) {
    return isRiskAtLeast(this._currentPoint?.grassFireRiskCode, threshold);
  }

  isForestDrynessAtLeast(threshold) {
    return isRiskAtLeast(this._currentPoint?.forestDrynessCode, threshold);
  }

  onDeleted() {
    this.log('SMHI Fire Risk Device deleted');

    if (this._fireRiskInterval) {
      this.homey.clearInterval(this._fireRiskInterval);
      this._fireRiskInterval = null;
    }
  }
}

module.exports = FireRiskDevice;
