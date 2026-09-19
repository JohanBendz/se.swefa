'use strict';

const { Driver } = require('homey');
const {
  sortStationsByDistance,
  crossedAbove,
  crossedBelow,
} = require('../../lib/ocean-utils');

class SeaLevelDriver extends Driver {
  async onInit() {
    this.log('SMHI sea-level driver initiated');
    this.registerFlowCards();
  }

  registerFlowCards() {
    this.homey.flow
      .getDeviceTriggerCard('SeaLevelCrossedAbove')
      .registerRunListener(async ({ cm }, state) => crossedAbove(
        state?.previous,
        state?.current,
        cm,
      ));

    this.homey.flow
      .getDeviceTriggerCard('SeaLevelCrossedBelow')
      .registerRunListener(async ({ cm }, state) => crossedBelow(
        state?.previous,
        state?.current,
        cm,
      ));

    this.homey.flow
      .getConditionCard('sea_level_above')
      .registerRunListener(async ({ device, cm }) => device.isSeaLevelAbove(cm));

    this.homey.flow
      .getConditionCard('sea_level_below')
      .registerRunListener(async ({ device, cm }) => device.isSeaLevelBelow(cm));
  }

  async onPairListDevices() {
    const stations = await this.homey.app.getOcobsStations('seaLevelRh2000');
    const ordered = this.sortForHomey(stations);

    return ordered.map(station => ({
      name: this.pairName('Sea Level', station),
      data: {
        id: `sealevel-${station.id}`,
        stationId: station.id,
        stationName: station.name,
        stationOwner: station.owner,
        stationLatitude: station.latitude,
        stationLongitude: station.longitude,
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
      this.error('Unable to sort sea-level stations by Homey location:', error);
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

module.exports = SeaLevelDriver;
