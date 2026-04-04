'use strict';

const { Driver } = require('homey');

class WeatherDriver extends Driver {
  async onInit() {
    this.log('SMHI weather driver initiated');
    this.registerFlowConditions();
  }

  registerFlowConditions() {
    this.homey.flow
      .getConditionCard('will_rain_within_hours')
      .registerRunListener(async ({ device, hours }) => {
        return device.willItRainInNextHours(hours);
      });

    this.homey.flow
      .getConditionCard('measure_weather_situation_cp')
      .registerRunListener(async ({ device, weather_situation_condition }) => {
        return device.getCapabilityValue('measure_weather_situation_cp') === weather_situation_condition;
      });

    this.homey.flow
      .getConditionCard('measure_air_temperature_cp')
      .registerRunListener(async ({ device, degree }) => {
        return device.getCapabilityValue('measure_air_temperature_cp') > degree;
      });

    this.homey.flow
      .getConditionCard('measure_wind_speed_cp')
      .registerRunListener(async ({ device, mps }) => {
        return device.getCapabilityValue('measure_wind_speed_cp') > mps;
      });

    this.homey.flow
      .getConditionCard('measure_wind_direction_heading_cp')
      .registerRunListener(async ({ device, direction }) => {
        return device.getCapabilityValue('measure_wind_direction_heading_cp') === direction;
      });

    this.homey.flow
      .getConditionCard('measure_wind_direction_cp')
      .registerRunListener(async ({ device, degree }) => {
        return device.getCapabilityValue('measure_wind_direction_cp') > degree;
      });

    this.homey.flow
      .getConditionCard('measure_relative_humidity_cp')
      .registerRunListener(async ({ device, percent }) => {
        return device.getCapabilityValue('measure_relative_humidity_cp') > percent;
      });

    this.homey.flow
      .getConditionCard('measure_air_pressure_cp')
      .registerRunListener(async ({ device, hpa }) => {
        return device.getCapabilityValue('measure_air_pressure_cp') > hpa;
      });

    this.homey.flow
      .getConditionCard('measure_thunder_probability_cp')
      .registerRunListener(async ({ device, percent }) => {
        return device.getCapabilityValue('measure_thunder_probability_cp') > percent;
      });

    this.homey.flow
      .getConditionCard('mean_value_of_total_cloud_cover_cp')
      .registerRunListener(async ({ device, octas }) => {
        return device.getCapabilityValue('mean_value_of_total_cloud_cover_cp') > octas;
      });

    this.homey.flow
      .getConditionCard('mean_value_of_low_level_cloud_cover_cp')
      .registerRunListener(async ({ device, octas }) => {
        return device.getCapabilityValue('mean_value_of_low_level_cloud_cover_cp') > octas;
      });

    this.homey.flow
      .getConditionCard('mean_value_of_medium_level_cloud_cover_cp')
      .registerRunListener(async ({ device, octas }) => {
        return device.getCapabilityValue('mean_value_of_medium_level_cloud_cover_cp') > octas;
      });

    this.homey.flow
      .getConditionCard('mean_value_of_high_level_cloud_cover_cp')
      .registerRunListener(async ({ device, octas }) => {
        return device.getCapabilityValue('mean_value_of_high_level_cloud_cover_cp') > octas;
      });

    this.homey.flow
      .getConditionCard('wind_gust_speed_cp')
      .registerRunListener(async ({ device, mps }) => {
        return device.getCapabilityValue('wind_gust_speed_cp') > mps;
      });

    this.homey.flow
      .getConditionCard('horizontal_visibility_cp')
      .registerRunListener(async ({ device, km }) => {
        return device.getCapabilityValue('horizontal_visibility_cp') > km;
      });

    this.homey.flow
      .getConditionCard('measure_precipitation_situation_cp')
      .registerRunListener(async ({ device, precipitation }) => {
        const category = device._lastPrecipitationCategory ?? 0;

        if (precipitation === 'RainSnow') return category > 0;
        if (precipitation === 'Snow') return [1, 2].includes(category);
        if (precipitation === 'Rain') return [2, 3, 4, 5, 6].includes(category);

        return false;
      });

    this.homey.flow
      .getConditionCard('mean_precipitation_intensity_cp')
      .registerRunListener(async ({ device, mmh }) => {
        return device.getCapabilityValue('mean_precipitation_intensity_cp') > mmh;
      });
  }

  async onPairListDevices() {
    return [
      {
        name: 'SMHI weather',
        data: { id: guid() },
        settings: {
          fcTime: '0',
          latitude: '',
          longitude: '',
          usehomeylocation: true,
        },
      },
    ];
  }
}

module.exports = WeatherDriver;

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }

  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}