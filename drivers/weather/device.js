'use strict';

const { Device } = require('homey');
const fetch = require('node-fetch');
const Feels = require('feels');
const {
  WIND_DIRECTION_CODES,
  formatCoordinate,
  percentToOctas,
  getWeatherConditionCode,
  getWindDirectionCode,
  getPrecipitationTranslationKey,
  isPrecipitationMatch,
  precipitationAmountToHourlyRate,
  findClosestForecastPoint,
  isSevereWeatherSymbol,
} = require('../../lib/weather-utils');

class WeatherDevice extends Device {
  constructor(...args) {
    super(...args);

    this.weatherData = null;
    this.lastFetchTime = 0;
    this.pollInterval = 1800000;
    this.cacheDuration = 0;

    this._fetchPromise = null;
    this._lastPrecipitationCategory = 0;
    this._lastPrecipitationRate = 0;
    this._lastWeatherSymbol = null;
    this._lastWeatherConditionCode = null;
    this._lastWindDirectionHeadingCode = null;
  }

  async onInit() {
    this.log('SMHI Weather Device initialized');

    this.registerFlowTriggers();
    await this.fetchSMHIData(true);

    this._fetchInterval = this.homey.setInterval(() => {
      this.fetchSMHIData().catch(err => this.error(err));
    }, this.pollInterval);
  }

  registerFlowTriggers() {
    this._flowTriggerWeatherSituationChange = this.homey.flow.getDeviceTriggerCard('WeatherSituationChange');
    this._flowTriggerWeatherSituationChangedTo = this.homey.flow.getDeviceTriggerCard('WeatherSituationChangedTo');
    this._flowTriggerWeatherSituationChangedFromTo = this.homey.flow.getDeviceTriggerCard('WeatherSituationChangedFromTo');
    this._flowTriggerAirTemperatureChange = this.homey.flow.getDeviceTriggerCard('AirTemperatureChange');
    this._flowTriggerPrecipitationSituationChange = this.homey.flow.getDeviceTriggerCard('PrecipitationSituationChange');
    this._flowTriggerWindSpeedChange = this.homey.flow.getDeviceTriggerCard('WindSpeedChange');
    this._flowTriggerWindDirectionHeadingChange = this.homey.flow.getDeviceTriggerCard('WindDirectionHeadingChange');
    this._flowTriggerRelativeHumidityChange = this.homey.flow.getDeviceTriggerCard('RelativeHumidityChange');
    this._flowTriggerAirPressureChange = this.homey.flow.getDeviceTriggerCard('AirPressureChange');
    this._flowTriggerThunderProbabilityChange = this.homey.flow.getDeviceTriggerCard('ThunderProbabilityChange');
    this._flowTriggerMeanValueOfTotalCloudCoverChange = this.homey.flow.getDeviceTriggerCard('MeanValueOfTotalCloudCoverChange');
    this._flowTriggerExtremeWeather = this.homey.flow.getDeviceTriggerCard('extreme_weather');
  }

  async onSettings({ changedKeys }) {
    this.log('Settings changed:', changedKeys);

    if (changedKeys?.length) {
      this.lastFetchTime = 0;
      await this.fetchSMHIData(true);
    }
  }

  async fetchSMHIData(force = false) {
    if (this._fetchPromise) return this._fetchPromise;

    this._fetchPromise = this._fetchSMHIData(force)
      .finally(() => {
        this._fetchPromise = null;
      });

    return this._fetchPromise;
  }

  async _fetchSMHIData(force = false) {
    const currentTime = Date.now();

    if (!force && this.cacheDuration > 0 && currentTime - this.lastFetchTime < this.cacheDuration && this.weatherData) {
      return;
    }

    try {
      const data = await this.getWeatherData();
      this.weatherData = data;
      this.lastFetchTime = currentTime;
      await this.updateCapabilities();
    } catch (error) {
      this.error('Failed to fetch SMHI data:', error);
    }
  }

  async fetchJsonWithRetry(url, { retries = 3, timeoutMs = 10000 } = {}) {
    let lastError = null;

    for (let attempt = 1; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = this.homey.setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          throw new Error(`SMHI request failed: ${response.status} ${response.statusText} ${body.slice(0, 300)}`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('json')) {
          const body = await response.text().catch(() => '');
          throw new Error(`SMHI returned non-JSON: ${contentType} ${body.slice(0, 300)}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error;

        if (attempt < retries) {
          this.log(`SMHI request attempt ${attempt} failed; retrying`);
          await new Promise(resolve => this.homey.setTimeout(resolve, 300 * (2 ** (attempt - 1))));
        }
      } finally {
        this.homey.clearTimeout(timeout);
      }
    }

    throw lastError ?? new Error('SMHI request failed');
  }

  normalizeCoordinate(value, label) {
    return formatCoordinate(value, label);
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

    const data = await this.fetchJsonWithRetry(url);

    if (!data || !Array.isArray(data.timeSeries)) {
      throw new Error('SMHI response did not contain timeSeries');
    }

    if (data.timeSeries.length === 0) {
      throw new Error('SMHI response contained empty timeSeries');
    }

    return data;
  }

  async updateCapabilities() {
    const settings = this.getSettings();
    const forecastHoursAhead = Number.parseInt(settings.fcTime, 10) || 0;
    const targetTime = new Date(Date.now() + forecastHoursAhead * 3600000);

    const closestDataPoint = findClosestForecastPoint(this.weatherData?.timeSeries, targetTime);
    if (!closestDataPoint) {
      this.error('No forecast data available for the specified time.');
      return;
    }

    await this.processForecastData(closestDataPoint);
  }

  indexParameters(forecastData) {
    if (!forecastData || typeof forecastData.data !== 'object' || forecastData.data === null) {
      return {};
    }

    return forecastData.data;
  }

  pick(parameters, names, fallback = null) {
    for (const name of names) {
      const value = parameters[name];
      if (value !== undefined && value !== null && value !== 9999) {
        return value;
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

    const totalCloud = percentToOctas(this.pick(parameters, ['cloud_area_fraction'], null));
    const lowCloud = percentToOctas(this.pick(parameters, ['low_type_cloud_area_fraction'], null));
    const mediumCloud = percentToOctas(this.pick(parameters, ['medium_type_cloud_area_fraction'], null));
    const highCloud = percentToOctas(this.pick(parameters, ['high_type_cloud_area_fraction'], null));

    const windGust = this.pick(parameters, ['wind_speed_of_gust'], null);

    const pmin = precipitationAmountToHourlyRate(
      this.pick(parameters, ['precipitation_amount_min'], 0),
      forecastData,
    );
    const pmax = precipitationAmountToHourlyRate(
      this.pick(parameters, ['precipitation_amount_max'], 0),
      forecastData,
    );
    const pmean = precipitationAmountToHourlyRate(
      this.pick(parameters, ['precipitation_amount_mean'], 0),
      forecastData,
    );
    const pmedian = precipitationAmountToHourlyRate(
      this.pick(parameters, ['precipitation_amount_median'], 0),
      forecastData,
    );

    const frozenPartRaw = this.pick(parameters, ['precipitation_frozen_part'], 0);
    const frozenPart = typeof frozenPartRaw === 'number' && frozenPartRaw > 0 ? frozenPartRaw : 0;

    const precipitationCategory = this.pick(parameters, ['predominant_precipitation_type_at_surface'], 0);
    const weatherSymbol = this.pick(parameters, ['symbol_code'], null);

    const previousWeatherConditionCode = this._lastWeatherConditionCode;

    const weatherConditionCode = getWeatherConditionCode(weatherSymbol);
    const windDirectionHeadingCode = getWindDirectionCode(windDirection);

    this._lastPrecipitationCategory = precipitationCategory;
    this._lastPrecipitationRate = pmean;
    this._lastWeatherSymbol = weatherSymbol;
    this._lastWeatherConditionCode = weatherConditionCode;
    this._lastWindDirectionHeadingCode = windDirectionHeadingCode;

    let feelsLike = null;
    if (
      typeof airTemperature === 'number'
      && typeof relativeHumidity === 'number'
      && typeof windSpeed === 'number'
    ) {
      const config = {
        temp: airTemperature,
        humidity: relativeHumidity,
        speed: windSpeed,
        units: { temp: 'c', speed: 'mps' },
      };

      feelsLike = Math.round(new Feels(config).like() * 100) / 100;
    }

    const forecastFor = this.formatForecastTime(forecastData.time);
    const weatherSituation = this.getWeatherSituation(weatherSymbol);
    const precipitationSituation = this.getPrecipitationSituationFromSnow({
      precipitationCategory,
      pmean,
    });
    const windDirectionHeading = this.getWindDirectionHeading(windDirection);

    await this.updateLegacyCapabilities({
      forecastFor,
      weatherSituation,
      weatherConditionCode,
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
    }, {
      previousWeatherConditionCode,
    });
  }

  getPrecipitationSituationFromSnow({ precipitationCategory, pmean }) {
    const translationKey = getPrecipitationTranslationKey(precipitationCategory, pmean);
    return this.homey.__(translationKey);
  }

  async updateLegacyCapabilities(values, previousCodes) {
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

    const weatherCodeChanged = previousCodes.previousWeatherConditionCode !== null
      && previousCodes.previousWeatherConditionCode !== values.weatherConditionCode;

    if (weatherCodeChanged) {
      const tokens = {
        measure_weather_situation_cp: values.weatherSituation,
        previous_weather_situation: previous.weatherSituation ?? '',
        weather_situation_code: values.weatherConditionCode ?? '',
        previous_weather_situation_code: previousCodes.previousWeatherConditionCode ?? '',
      };
      const state = {
        fromCode: previousCodes.previousWeatherConditionCode,
        toCode: values.weatherConditionCode,
      };

      await this._flowTriggerWeatherSituationChange.trigger(this, tokens, state).catch(err => this.error(err));
      await this._flowTriggerWeatherSituationChangedTo.trigger(this, tokens, state).catch(err => this.error(err));
      await this._flowTriggerWeatherSituationChangedFromTo.trigger(this, tokens, state).catch(err => this.error(err));

      if (isSevereWeatherSymbol(this._lastWeatherSymbol)) {
        await this._flowTriggerExtremeWeather
          .trigger(this, {
            weather_condition: values.weatherSituation,
            weather_condition_code: values.weatherConditionCode ?? '',
          }, state)
          .catch(err => this.error(err));
      }
    }

    if (previous.airTemperature !== null && previous.airTemperature !== values.airTemperature) {
      await this._flowTriggerAirTemperatureChange
        .trigger(this, { measure_air_temperature_cp: values.airTemperature }, {})
        .catch(err => this.error(err));
    }

    if (previous.windSpeed !== null && previous.windSpeed !== values.windSpeed) {
      await this._flowTriggerWindSpeedChange
        .trigger(this, { measure_wind_speed_cp: values.windSpeed }, {})
        .catch(err => this.error(err));
    }

    if (previous.windDirectionHeading !== null && previous.windDirectionHeading !== values.windDirectionHeading) {
      await this._flowTriggerWindDirectionHeadingChange
        .trigger(this, {
          measure_wind_direction_heading_cp: values.windDirectionHeading,
          measure_wind_direction_cp: values.windDirection,
        }, {})
        .catch(err => this.error(err));
    }

    if (previous.relativeHumidity !== null && previous.relativeHumidity !== values.relativeHumidity) {
      await this._flowTriggerRelativeHumidityChange
        .trigger(this, { measure_relative_humidity_cp: values.relativeHumidity }, {})
        .catch(err => this.error(err));
    }

    if (previous.airPressure !== null && previous.airPressure !== values.airPressure) {
      await this._flowTriggerAirPressureChange
        .trigger(this, { measure_air_pressure_cp: values.airPressure }, {})
        .catch(err => this.error(err));
    }

    if (previous.thunderProbability !== null && previous.thunderProbability !== values.thunderProbability) {
      await this._flowTriggerThunderProbabilityChange
        .trigger(this, { measure_thunder_probability_cp: values.thunderProbability }, {})
        .catch(err => this.error(err));
    }

    if (previous.precipitationSituation !== null && previous.precipitationSituation !== values.precipitationSituation) {
      await this._flowTriggerPrecipitationSituationChange
        .trigger(this, { measure_precipitation_situation_cp: values.precipitationSituation }, {})
        .catch(err => this.error(err));
    }

    if (previous.totalCloud !== null && previous.totalCloud !== values.totalCloud) {
      await this._flowTriggerMeanValueOfTotalCloudCoverChange
        .trigger(this, { mean_value_of_total_cloud_cover_cp: values.totalCloud }, {})
        .catch(err => this.error(err));
    }
  }

  async getForecastDataForNextHours(hoursAhead) {
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + Number(hoursAhead) * 3600000);

    if (!this.weatherData) {
      await this.fetchSMHIData();
    }

    if (!this.weatherData || !Array.isArray(this.weatherData.timeSeries)) {
      return [];
    }

    return this.weatherData.timeSeries.filter((dataPoint) => {
      const forecastTime = new Date(dataPoint.time);
      return forecastTime >= startTime && forecastTime <= endTime;
    });
  }

  async willItPrecipitateInNextHours(hoursAhead) {
    const forecastData = await this.getForecastDataForNextHours(hoursAhead);

    return forecastData.some((dataPoint) => {
      const parameters = this.indexParameters(dataPoint);
      const pmean = this.pick(parameters, ['precipitation_amount_mean'], 0);
      return Number(pmean) > 0;
    });
  }

  async willItRainInNextHours(hoursAhead) {
    const forecastData = await this.getForecastDataForNextHours(hoursAhead);

    return forecastData.some((dataPoint) => {
      const parameters = this.indexParameters(dataPoint);
      const amount = this.pick(parameters, ['precipitation_amount_mean'], 0);
      const category = this.pick(parameters, ['predominant_precipitation_type_at_surface'], 0);
      return isPrecipitationMatch(category, 'Rain', amount);
    });
  }

  async getMaxWindSpeedInNextHours(hoursAhead) {
    const forecastData = await this.getForecastDataForNextHours(hoursAhead);
    const values = forecastData
      .map(point => this.pick(this.indexParameters(point), ['wind_speed'], null))
      .filter(value => typeof value === 'number');

    return values.length ? Math.max(...values) : null;
  }

  async getMinTemperatureInNextHours(hoursAhead) {
    const forecastData = await this.getForecastDataForNextHours(hoursAhead);
    const values = forecastData
      .map(point => this.pick(this.indexParameters(point), ['air_temperature'], null))
      .filter(value => typeof value === 'number');

    return values.length ? Math.min(...values) : null;
  }

  matchesWeatherCondition(conditionCode) {
    return this._lastWeatherConditionCode === conditionCode;
  }

  matchesWindDirection(directionCode) {
    return this._lastWindDirectionHeadingCode === directionCode;
  }

  matchesPrecipitation(selection) {
    return isPrecipitationMatch(
      this._lastPrecipitationCategory,
      selection,
      this._lastPrecipitationRate,
    );
  }

  formatForecastTime(time) {
    const date = new Date(time);
    const language = this.homey.i18n.getLanguage();
    const locale = { en: 'en-GB', sv: 'sv-SE', no: 'nb-NO' }[language] ?? 'en-GB';

    return new Intl.DateTimeFormat(locale, {
      timeZone: this.homey.clock.getTimezone(),
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  getWeatherSituation(weatherSymbol) {
    if (typeof weatherSymbol === 'number' && weatherSymbol >= 1 && weatherSymbol <= 27) {
      return this.homey.__(`weather_situation${weatherSymbol}`);
    }

    return this.homey.__('weather_situation');
  }

  getWindDirectionHeading(angle) {
    const code = getWindDirectionCode(angle);
    if (!code) return null;

    const index = WIND_DIRECTION_CODES.indexOf(code);
    return this.homey.__(`direction${index + 1}`);
  }

  onDeleted() {
    this.log('Device deleted');

    if (this._fetchInterval) {
      this.homey.clearInterval(this._fetchInterval);
      this._fetchInterval = null;
    }
  }
}

module.exports = WeatherDevice;
