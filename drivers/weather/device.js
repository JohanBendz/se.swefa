'use strict';

const { Device } = require('homey');
const fetch = require('node-fetch');
const Feels = require('feels');

class WeatherDevice extends Device {
  constructor(...args) {
    super(...args);

    this.weatherData = null;
    this.lastFetchTime = 0;

    this.pollInterval = 1800000; // 30 minutes
    this.cacheDuration = 0;      // Always fetch fresh point data on poll/settings
    this._lastPrecipitationCategory = 0;
  }

  async onInit() {
    this.log('SMHI Weather Device initialized');

    this.registerFlowTriggers();

    await this.fetchSMHIData(true);

    this._fetchInterval = setInterval(() => {
      this.fetchSMHIData().catch(err => this.error(err));
    }, this.pollInterval);
  }

  registerFlowTriggers() {
    this._flowTriggerWeatherSituationChange = this.homey.flow.getDeviceTriggerCard('WeatherSituationChange');
    this._flowTriggerAirTemperatureChange = this.homey.flow.getDeviceTriggerCard('AirTemperatureChange');
    this._flowTriggerPrecipitationSituationChange = this.homey.flow.getDeviceTriggerCard('PrecipitationSituationChange');
    this._flowTriggerWindSpeedChange = this.homey.flow.getDeviceTriggerCard('WindSpeedChange');
    this._flowTriggerWindDirectionHeadingChange = this.homey.flow.getDeviceTriggerCard('WindDirectionHeadingChange');
    this._flowTriggerRelativeHumidityChange = this.homey.flow.getDeviceTriggerCard('RelativeHumidityChange');
    this._flowTriggerAirPressureChange = this.homey.flow.getDeviceTriggerCard('AirPressureChange');
    this._flowTriggerThunderProbabilityChange = this.homey.flow.getDeviceTriggerCard('ThunderProbabilityChange');
    this._flowTriggerMeanValueOfTotalCloudCoverChange = this.homey.flow.getDeviceTriggerCard('MeanValueOfTotalCloudCoverChange');
  }

  async onSettings({ changedKeys }) {
    this.log('Settings changed:', changedKeys);

    if (changedKeys && changedKeys.length) {
      this.lastFetchTime = 0;

      try {
        await this.fetchSMHIData(true);
      } catch (error) {
        this.error('Failed to refresh weather data after settings change:', error);
      }
    }
  }

  async fetchSMHIData(force = false) {
    const currentTime = Date.now();

    if (!force && this.cacheDuration > 0 && currentTime - this.lastFetchTime < this.cacheDuration && this.weatherData) {
      return;
    }

    try {
      this.weatherData = await this.getWeatherData();
      this.lastFetchTime = currentTime;
      await this.updateCapabilities();
    } catch (error) {
      this.error('Failed to fetch SMHI data:', error);
    }
  }

  async getCreatedTime() {
    const url = 'https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/createdtime.json';
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`SMHI createdtime failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return (
      data.createdTime?.[0] ??
      data.createdTime ??
      data.createdtime?.[0] ??
      data.createdtime ??
      null
    );
  }

  normalizeCoordinate(value, label) {
    const num = Number(value);

    if (!Number.isFinite(num)) {
      throw new Error(`Invalid ${label}: ${value}`);
    }

    return num.toFixed(6);
  }

  getCoordinatesFromSettings() {
    const settings = this.getSettings();

    const longitude = settings.usehomeylocation
      ? this.homey.geolocation.getLongitude()
      : parseFloat(settings.longitude);

    const latitude = settings.usehomeylocation
      ? this.homey.geolocation.getLatitude()
      : parseFloat(settings.latitude);

    return {
      lon: this.normalizeCoordinate(longitude, 'longitude'),
      lat: this.normalizeCoordinate(latitude, 'latitude'),
    };
  }

  async getWeatherData() {
    const { lon, lat } = this.getCoordinatesFromSettings();

    const url = `https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/${lon}/lat/${lat}/data.json`;

    this.log(`Fetching SMHI data from: ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`SMHI point failed: ${response.status} ${response.statusText} ${body.slice(0, 300)}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('json')) {
      const body = await response.text().catch(() => '');
      throw new Error(`SMHI point returned non-JSON: ${contentType} ${body.slice(0, 300)}`);
    }

    const data = await response.json();

    if (!data || !Array.isArray(data.timeSeries)) {
      this.error('SMHI response keys:', data ? Object.keys(data) : null);
      throw new Error('SMHI response did not contain timeSeries');
    }

    if (data.timeSeries.length === 0) {
      this.error('SMHI returned empty timeSeries for URL:', url);
      throw new Error('SMHI response contained empty timeSeries');
    }

    this.log(`SMHI returned ${data.timeSeries.length} forecast entries`);
    this.log(`First forecast time: ${data.timeSeries[0]?.time}`);

    return data;
  }

  async updateCapabilities() {
    const settings = this.getSettings();
    const forecastHoursAhead = parseInt(settings.fcTime, 10) || 0;
    const now = new Date();
    const targetTime = new Date(now.getTime() + forecastHoursAhead * 3600 * 1000);

    this.log(`fcTime setting: ${settings.fcTime}`);
    this.log(`Now local: ${now.toString()}`);
    this.log(`Now ISO: ${now.toISOString()}`);
    this.log(`Target local: ${targetTime.toString()}`);
    this.log(`Target ISO: ${targetTime.toISOString()}`);

    const closestDataPoint = this.findClosestForecastDataPoint(targetTime);

    if (!closestDataPoint) {
      this.error('No forecast data available for the specified time.');
      return;
    }

    this.log(`Chosen forecast time: ${closestDataPoint.time}`);

    await this.processForecastData(closestDataPoint);
  }

  findClosestForecastDataPoint(targetTime) {
    if (!this.weatherData || !Array.isArray(this.weatherData.timeSeries) || this.weatherData.timeSeries.length === 0) {
      return null;
    }

    let closestDataPoint = null;
    let smallestTimeDiff = Infinity;

    for (const dataPoint of this.weatherData.timeSeries) {
      const forecastTime = new Date(dataPoint.time);
      const timeDiff = Math.abs(forecastTime.getTime() - targetTime.getTime());

      if (!Number.isNaN(timeDiff) && timeDiff < smallestTimeDiff) {
        smallestTimeDiff = timeDiff;
        closestDataPoint = dataPoint;
      }
    }

    if (closestDataPoint) {
      this.log(`Closest forecast diff hours: ${(smallestTimeDiff / 3600000).toFixed(2)}`);
    }

    return closestDataPoint;
  }

  indexParameters(forecastData) {
    if (!forecastData || typeof forecastData.data !== 'object' || forecastData.data === null) {
      return {};
    }

    return forecastData.data;
  }

  pick(parameters, names, fallback = null) {
    for (const name of names) {
      if (parameters[name] !== undefined && parameters[name] !== null && parameters[name] !== 9999) {
        return parameters[name];
      }
    }

    return fallback;
  }

  async processForecastData(forecastData) {
    const parameters = this.indexParameters(forecastData);

    const airPressure = this.pick(parameters, ['air_pressure_at_mean_sea_level'], null);
    const airTemperature = this.pick(parameters, ['air_temperature'], null);
    const horizontalVisibility = this.pick(parameters, ['visibility_in_air'], null);
    const windDirection = this.pick(parameters, ['wind_from_direction'], null);
    const windSpeed = this.pick(parameters, ['wind_speed'], null);
    const relativeHumidity = this.pick(parameters, ['relative_humidity'], null);
    const thunderProbability = this.pick(parameters, ['thunderstorm_probability'], 0);
    const totalCloud = this.pick(parameters, ['cloud_area_fraction'], null);
    const lowCloud = this.pick(parameters, ['low_type_cloud_area_fraction'], null);
    const mediumCloud = this.pick(parameters, ['medium_type_cloud_area_fraction'], null);
    const highCloud = this.pick(parameters, ['high_type_cloud_area_fraction'], null);
    const windGust = this.pick(parameters, ['wind_speed_of_gust'], null);

    const pmin = this.pick(parameters, ['precipitation_amount_min'], 0);
    const pmax = this.pick(parameters, ['precipitation_amount_max'], 0);
    const pmean = this.pick(parameters, ['precipitation_amount_mean'], 0);
    const pmedian = this.pick(parameters, ['precipitation_amount_median'], 0);

    const frozenPartRaw = this.pick(parameters, ['precipitation_frozen_part'], 0);
    const frozenPart = frozenPartRaw < 0 ? 0 : frozenPartRaw;

    const precipitationCategory = this.pick(parameters, ['predominant_precipitation_type_at_surface'], 0);
    const weatherSymbol = this.pick(parameters, ['symbol_code'], null);

    this._lastPrecipitationCategory = precipitationCategory;

    let feelsLike = null;
    if (
      typeof airTemperature === 'number'
      && typeof relativeHumidity === 'number'
      && typeof windSpeed === 'number'
    ) {
      const feelsLikeConfig = {
        temp: airTemperature,
        humidity: relativeHumidity,
        speed: windSpeed,
        units: {
          temp: 'c',
          speed: 'mps',
        },
      };

      feelsLike = Math.round(new Feels(feelsLikeConfig).like() * 100) / 100;
    }

    const forecastFor = this.formatForecastTime(forecastData.time);
    const weatherSituation = this.getWeatherSituation(weatherSymbol);
    const precipitationSituation = this.getPrecipitationSituationFromSnow({
      precipitationCategory,
      pmean,
      frozenPart,
    });
    const windDirectionHeading = this.getWindDirectionHeading(windDirection);

    await this.updateLegacyCapabilities({
      forecastFor,
      weatherSituation,
      airPressure,
      airTemperature,
      horizontalVisibility,
      windDirection,
      windDirectionHeading,
      windSpeed,
      relativeHumidity,
      thunderProbability,
      totalCloud,
      lowCloud,
      mediumCloud,
      highCloud,
      windGust,
      pmin,
      pmax,
      frozenPart,
      pmean,
      pmedian,
      precipitationSituation,
      feelsLike,
    });
  }

  getPrecipitationSituationFromSnow({ precipitationCategory, pmean, frozenPart }) {
    if (!pmean || pmean <= 0) {
      return this.homey.__('precipitation_situation0'); // No precipitation
    }

    if (frozenPart >= 80) {
      return this.homey.__('precipitation_situation1'); // Snow
    }

    if (frozenPart > 0 && frozenPart < 80) {
      return this.homey.__('precipitation_situation2'); // Snow and rain
    }

    // Liquid precipitation fallback
    // SNOW's predominant_precipitation_type_at_surface does not map 1:1 to old pcat semantics
    if ([5, 6].includes(precipitationCategory)) {
      return this.homey.__('precipitation_situation5'); // Freezing rain
    }

    return this.homey.__('precipitation_situation3'); // Rain
  }

  async updateLegacyCapabilities(values) {
    const previous = {
      weatherSituation: this.getCapabilityValue('measure_weather_situation_cp'),
      airTemperature: this.getCapabilityValue('measure_air_temperature_cp'),
      windSpeed: this.getCapabilityValue('measure_wind_speed_cp'),
      windDirectionHeading: this.getCapabilityValue('measure_wind_direction_heading_cp'),
      relativeHumidity: this.getCapabilityValue('measure_relative_humidity_cp'),
      airPressure: this.getCapabilityValue('measure_air_pressure_cp'),
      thunderProbability: this.getCapabilityValue('measure_thunder_probability_cp'),
      precipitationSituation: this.getCapabilityValue('measure_precipitation_situation_cp'),
      totalCloud: this.getCapabilityValue('mean_value_of_total_cloud_cover_cp'),
    };

    await this.setCapabilityValue('forecast_for_cp', values.forecastFor).catch(err => this.error(err));
    await this.setCapabilityValue('measure_weather_situation_cp', values.weatherSituation).catch(err => this.error(err));
    await this.setCapabilityValue('measure_air_pressure_cp', values.airPressure).catch(err => this.error(err));
    await this.setCapabilityValue('measure_air_temperature_cp', values.airTemperature).catch(err => this.error(err));
    await this.setCapabilityValue('horizontal_visibility_cp', values.horizontalVisibility).catch(err => this.error(err));
    await this.setCapabilityValue('measure_wind_direction_cp', values.windDirection).catch(err => this.error(err));
    await this.setCapabilityValue('measure_wind_direction_heading_cp', values.windDirectionHeading).catch(err => this.error(err));
    await this.setCapabilityValue('measure_wind_speed_cp', values.windSpeed).catch(err => this.error(err));
    await this.setCapabilityValue('measure_relative_humidity_cp', values.relativeHumidity).catch(err => this.error(err));
    await this.setCapabilityValue('measure_thunder_probability_cp', values.thunderProbability).catch(err => this.error(err));
    await this.setCapabilityValue('mean_value_of_total_cloud_cover_cp', values.totalCloud).catch(err => this.error(err));
    await this.setCapabilityValue('mean_value_of_low_level_cloud_cover_cp', values.lowCloud).catch(err => this.error(err));
    await this.setCapabilityValue('mean_value_of_medium_level_cloud_cover_cp', values.mediumCloud).catch(err => this.error(err));
    await this.setCapabilityValue('mean_value_of_high_level_cloud_cover_cp', values.highCloud).catch(err => this.error(err));
    await this.setCapabilityValue('wind_gust_speed_cp', values.windGust).catch(err => this.error(err));
    await this.setCapabilityValue('minimum_precipitation_intensity_cp', values.pmin).catch(err => this.error(err));
    await this.setCapabilityValue('maximum_precipitation_intensity_cp', values.pmax).catch(err => this.error(err));
    await this.setCapabilityValue('percent_of_precipitation_in_frozen_form_cp', values.frozenPart).catch(err => this.error(err));
    await this.setCapabilityValue('mean_precipitation_intensity_cp', values.pmean).catch(err => this.error(err));
    await this.setCapabilityValue('median_precipitation_intensity_cp', values.pmedian).catch(err => this.error(err));
    await this.setCapabilityValue('measure_precipitation_situation_cp', values.precipitationSituation).catch(err => this.error(err));
    await this.setCapabilityValue('air_temperature_feels_like_cp', values.feelsLike).catch(err => this.error(err));

    if (previous.weatherSituation !== values.weatherSituation) {
      await this._flowTriggerWeatherSituationChange
        .trigger(this, { measure_weather_situation_cp: values.weatherSituation }, { measure_weather_situation_cp: values.weatherSituation })
        .catch(err => this.error(err));
    }

    if (previous.airTemperature !== values.airTemperature) {
      await this._flowTriggerAirTemperatureChange
        .trigger(this, { measure_air_temperature_cp: values.airTemperature }, { measure_air_temperature_cp: values.airTemperature })
        .catch(err => this.error(err));
    }

    if (previous.windSpeed !== values.windSpeed) {
      await this._flowTriggerWindSpeedChange
        .trigger(this, { measure_wind_speed_cp: values.windSpeed }, { measure_wind_speed_cp: values.windSpeed })
        .catch(err => this.error(err));
    }

    if (previous.windDirectionHeading !== values.windDirectionHeading) {
      await this._flowTriggerWindDirectionHeadingChange
        .trigger(this, {
          measure_wind_direction_heading_cp: values.windDirectionHeading,
          measure_wind_direction_cp: values.windDirection,
        }, {
          measure_wind_direction_heading_cp: values.windDirectionHeading,
          measure_wind_direction_cp: values.windDirection,
        })
        .catch(err => this.error(err));
    }

    if (previous.relativeHumidity !== values.relativeHumidity) {
      await this._flowTriggerRelativeHumidityChange
        .trigger(this, { measure_relative_humidity_cp: values.relativeHumidity }, { measure_relative_humidity_cp: values.relativeHumidity })
        .catch(err => this.error(err));
    }

    if (previous.airPressure !== values.airPressure) {
      await this._flowTriggerAirPressureChange
        .trigger(this, { measure_air_pressure_cp: values.airPressure }, { measure_air_pressure_cp: values.airPressure })
        .catch(err => this.error(err));
    }

    if (previous.thunderProbability !== values.thunderProbability) {
      await this._flowTriggerThunderProbabilityChange
        .trigger(this, { measure_thunder_probability_cp: values.thunderProbability }, { measure_thunder_probability_cp: values.thunderProbability })
        .catch(err => this.error(err));
    }

    if (previous.precipitationSituation !== values.precipitationSituation) {
      await this._flowTriggerPrecipitationSituationChange
        .trigger(this, { measure_precipitation_situation_cp: values.precipitationSituation }, { measure_precipitation_situation_cp: values.precipitationSituation })
        .catch(err => this.error(err));
    }

    if (previous.totalCloud !== values.totalCloud) {
      await this._flowTriggerMeanValueOfTotalCloudCoverChange
        .trigger(this, { mean_value_of_total_cloud_cover_cp: values.totalCloud }, { mean_value_of_total_cloud_cover_cp: values.totalCloud })
        .catch(err => this.error(err));
    }
  }

  async getForecastDataForNextHours(hoursAhead) {
    const endTime = new Date(Date.now() + hoursAhead * 3600 * 1000);

    if (!this.weatherData) {
      await this.fetchSMHIData();
    }

    if (!this.weatherData || !Array.isArray(this.weatherData.timeSeries)) {
      return [];
    }

    return this.weatherData.timeSeries.filter((dataPoint) => {
      const forecastTime = new Date(dataPoint.time);
      return forecastTime >= new Date() && forecastTime <= endTime;
    });
  }

  async willItRainInNextHours(hoursAhead) {
    const forecastData = await this.getForecastDataForNextHours(hoursAhead);

    if (forecastData.length === 0) {
      this.error('No forecast data available for the specified time range.');
      return false;
    }

    return forecastData.some((dataPoint) => {
      const parameters = this.indexParameters(dataPoint);
      const pmean = this.pick(parameters, ['precipitation_amount_mean'], 0);
      return pmean > 0;
    });
  }

  formatForecastTime(time) {
    const date = new Date(time);

    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Stockholm',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);

    const monthText = parts.find(p => p.type === 'month')?.value ?? '';
    const day = parts.find(p => p.type === 'day')?.value ?? '';
    const hour = parts.find(p => p.type === 'hour')?.value ?? '00';
    const minute = parts.find(p => p.type === 'minute')?.value ?? '00';

    const monthMap = {
      Jan: this.homey.__('month1'),
      Feb: this.homey.__('month2'),
      Mar: this.homey.__('month3'),
      Apr: this.homey.__('month4'),
      May: this.homey.__('month5'),
      Jun: this.homey.__('month6'),
      Jul: this.homey.__('month7'),
      Aug: this.homey.__('month8'),
      Sept: this.homey.__('month9'),
      Sep: this.homey.__('month9'),
      Oct: this.homey.__('month10'),
      Nov: this.homey.__('month11'),
      Dec: this.homey.__('month12'),
    };

    const month = monthMap[monthText] || monthText;

    return `${month} ${day} ${hour}:${minute}`;
  }

  getWeatherSituation(weatherSymbol) {
    if (typeof weatherSymbol === 'number') {
      return this.homey.__(`weather_situation${weatherSymbol}`) || this.homey.__('weather_situation');
    }

    this.log('Unhandled weather symbol format from SNOW:', weatherSymbol);
    return this.homey.__('weather_situation');
  }

  getWindDirectionHeading(angle) {
    if (typeof angle !== 'number') {
      return null;
    }

    const directions = [
      this.homey.__('direction1'),
      this.homey.__('direction2'),
      this.homey.__('direction3'),
      this.homey.__('direction4'),
      this.homey.__('direction5'),
      this.homey.__('direction6'),
      this.homey.__('direction7'),
      this.homey.__('direction8'),
    ];

    return directions[Math.round((((angle % 360) < 0 ? angle + 360 : angle) / 45)) % 8];
  }

  onDeleted() {
    this.log('Device deleted');

    if (this._fetchInterval) {
      clearInterval(this._fetchInterval);
      this._fetchInterval = null;
    }
  }
}

module.exports = WeatherDevice;