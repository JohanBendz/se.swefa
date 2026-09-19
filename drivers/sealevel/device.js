'use strict';

const { Device } = require('homey');
const { latestObservation } = require('../../lib/ocean-utils');

const SEA_LEVEL_MAX_AGE_MS = 30 * 60 * 1000;

class SeaLevelDevice extends Device {
  constructor(...args) {
    super(...args);

    this.pollInterval = 5 * 60 * 1000;
    this._refreshPromise = null;
    this._currentObservation = null;
  }

  async onInit() {
    this.log('SMHI Sea Level Device initialized');

    this._crossedAbove = this.homey.flow.getDeviceTriggerCard('SeaLevelCrossedAbove');
    this._crossedBelow = this.homey.flow.getDeviceTriggerCard('SeaLevelCrossedBelow');

    await this.refreshSeaLevel({ resetBaseline: true });

    this._seaLevelInterval = this.homey.setInterval(() => {
      this.refreshSeaLevel().catch(err => this.error(err));
    }, this.pollInterval);
  }

  async refreshSeaLevel({ resetBaseline = false } = {}) {
    if (this._refreshPromise) {
      await this._refreshPromise;
    }

    this._refreshPromise = this._refreshSeaLevel({ resetBaseline }).finally(() => {
      this._refreshPromise = null;
    });

    return this._refreshPromise;
  }

  async _refreshSeaLevel({ resetBaseline }) {
    try {
      const station = this.getStation();
      const payload = await this.homey.app.getOcobsObservation(
        'seaLevelRh2000',
        station.id,
        'latest-hour',
      );
      const observation = latestObservation(payload, {
        maxAgeMs: SEA_LEVEL_MAX_AGE_MS,
      });

      if (!observation) {
        throw new Error('No sufficiently recent RH2000 sea-level observation');
      }

      await this.updateCapabilities(station, observation);

      if (!resetBaseline && this._currentObservation) {
        await this.processChange(station, this._currentObservation, observation);
      }

      this._currentObservation = observation;
      await this.setAvailable();
    } catch (error) {
      this.error('Failed to update SMHI sea level:', error);
      await this.setUnavailable('No recent SMHI sea-level observation').catch(err => this.error(err));
    }
  }

  getStation() {
    const data = this.getData();

    return {
      id: String(data.stationId ?? ''),
      name: String(data.stationName ?? ''),
      owner: String(data.stationOwner ?? ''),
    };
  }

  stationLabel(station) {
    return station.owner ? `${station.name} (${station.owner})` : station.name;
  }

  qualityLabel(code) {
    const key = {
      G: 'ocean_quality_g',
      Y: 'ocean_quality_y',
      O: 'ocean_quality_o',
    }[String(code ?? '').toUpperCase()];

    return key ? this.homey.__(key) : String(code ?? '');
  }

  formatDateTime(timestamp) {
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) return '';

    const locale = {
      en: 'en-GB',
      sv: 'sv-SE',
      no: 'nb-NO',
    }[this.homey.i18n.getLanguage()] ?? 'en-GB';

    return new Intl.DateTimeFormat(locale, {
      timeZone: this.homey.clock.getTimezone(),
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  async updateCapabilities(station, observation) {
    await Promise.all([
      this.setCapabilityValue('sea_level_rh2000_cp', observation.value),
      this.setCapabilityValue('ocean_station_cp', this.stationLabel(station)),
      this.setCapabilityValue('ocean_observed_at_cp', this.formatDateTime(observation.date)),
      this.setCapabilityValue('ocean_observation_age_cp', observation.ageMinutes),
      this.setCapabilityValue('ocean_quality_cp', this.qualityLabel(observation.quality)),
      this.setCapabilityValue('ocean_source_cp', 'SMHI Open Data'),
    ].map(promise => promise.catch(err => this.error(err))));
  }

  async processChange(station, previous, current) {
    if (previous.date === current.date && previous.value === current.value) return;

    const tokens = {
      sea_level: current.value,
      previous_sea_level: previous.value,
      station: this.stationLabel(station),
      observed_at: this.formatDateTime(current.date),
      quality: this.qualityLabel(current.quality),
      source: 'SMHI Open Data',
    };
    const state = {
      previous: previous.value,
      current: current.value,
    };

    await Promise.all([
      this._crossedAbove.trigger(this, tokens, state),
      this._crossedBelow.trigger(this, tokens, state),
    ].map(promise => promise.catch(err => this.error(err))));
  }

  isSeaLevelAbove(threshold) {
    if (!this._currentObservation) return false;
    return this._currentObservation.value > Number(threshold);
  }

  isSeaLevelBelow(threshold) {
    if (!this._currentObservation) return false;
    return this._currentObservation.value < Number(threshold);
  }

  onDeleted() {
    if (this._seaLevelInterval) {
      this.homey.clearInterval(this._seaLevelInterval);
      this._seaLevelInterval = null;
    }
  }
}

module.exports = SeaLevelDevice;
