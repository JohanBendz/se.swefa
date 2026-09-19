'use strict';

const { Driver } = require('homey');
const {
  sortStationsByDistance,
  crossedAbove,
} = require('../../lib/ocean-utils');

class WavesDriver extends Driver {
  async onInit() {
    this.log('SMHI waves driver initiated');
    this.registerFlowCards();
  }

  registerFlowCards() {
    this.homey.flow
      .getDeviceTriggerCard('SignificantWaveHeightCrossedAbove')
      .registerRunListener(async ({ meters }, state) => crossedAbove(
        state?.previous,
        state?.current,
        meters,
      ));

    this.homey.flow
      .getDeviceTriggerCard('MaximumWaveHeightCrossedAbove')
      .registerRunListener(async ({ meters }, state) => crossedAbove(
        state?.previous,
        state?.current,
        meters,
      ));

    this.homey.flow
      .getConditionCard('significant_wave_height_above')
      .registerRunListener(async ({ device, meters }) => device.isSignificantWaveHeightAbove(meters));

    this.homey.flow
      .getConditionCard('maximum_wave_height_above')
      .registerRunListener(async ({ device, meters }) => device.isMaximumWaveHeightAbove(meters));
  }

  async onPairListDevices() {
    const [
      significantStations,
      maximumStations,
      directionStations,
      periodStations,
    ] = await Promise.all([
      this.homey.app.getOcobsStations('significantWaveHeight'),
      this.homey.app.getOcobsStations('maximumWaveHeight'),
      this.homey.app.getOcobsStations('meanWaveDirection'),
      this.homey.app.getOcobsStations('meanWavePeriod'),
    ]);

    const support = {
      maximum: new Set(maximumStations.map(station => station.id)),
      direction: new Set(directionStations.map(station => station.id)),
      period: new Set(periodStations.map(station => station.id)),
    };

    return this.sortForHomey(significantStations).map(station => ({
      name: this.pairName('Waves', station),
      data: {
        id: `waves-${station.id}`,
      },
      store: {
        stationId: station.id,
        stationName: station.name,
        stationOwner: station.owner,
        stationLatitude: station.latitude,
        stationLongitude: station.longitude,
        supportsMaximumWaveHeight: support.maximum.has(station.id),
        supportsMeanWaveDirection: support.direction.has(station.id),
        supportsMeanWavePeriod: support.period.has(station.id),
      },
    }));
  }

  sortForHomey(stations) {
    try {
      return sortStationsByDistance(
        stations,
        this.homey.geolocation.getLatitude(),
        this.homey.geolocation.getLongitude(),
      );
    } catch (error) {
      this.error('Unable to sort wave stations by Homey location:', error);
      return [...stations].sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  pairName(prefix, station) {
    const distance = Number.isFinite(station.distanceKm)
      ? ` · ${Math.round(station.distanceKm)} km`
      : '';

    return `${prefix} — ${station.name}${distance}`;
  }
}

module.exports = WavesDriver;
