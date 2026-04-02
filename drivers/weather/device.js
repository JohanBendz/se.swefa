'use strict';

const { Device } = require('homey');
const fetch = require('node-fetch');
const Feels = require('feels');

class WeatherDevice extends Device {
  constructor(...args) {
    super(...args);
    this.weatherData = null;
    this.approvedTime = null;
    this.pollInterval = 3600000; // 1 hour in milliseconds
    this.cacheDuration = 600000; // 10 minutes in milliseconds
    this.lastFetchTime = 0;
  }

  async onInit() {
    this.log('SMHI Weather Device initialized');

    // Register Flow cards
    this.registerFlowTriggers();
    this.registerFlowConditions();

    // Fetch initial data
    await this.fetchSMHIData();

    // Set interval to fetch new data
    this._fetchInterval = setInterval(() => {
      this.fetchSMHIData();
    }, this.pollInterval);

    // Schedule regular updates of aggregated data
    this.updateAggregatedCapabilities();
    this._aggregatedDataInterval = setInterval(() => {
      this.updateAggregatedCapabilities();
    }, 1800000); // Every 30 minutes
  }

  // Register Flow Triggers
  registerFlowTriggers() {
    this.flowTriggerExtremeWeather = this.homey.flow.getDeviceTriggerCard('extreme_weather');
    // Add more triggers as needed
  }

  // Register Flow Conditions
  registerFlowConditions() {
    // Condition: Will it rain within the next X hours
    this.flowConditionWillRain = this.homey.flow.getConditionCard('will_rain_in_next_hours')
      .registerRunListener(async (args) => {
        const hours = args.hours;
        const willRain = await this.willItRainInNextHours(hours);
        return willRain;
      });

    // Condition: Max wind speed exceeds X m/s in next X hours
    this.flowConditionMaxWindSpeed = this.homey.flow.getConditionCard('max_wind_speed_exceeds')
      .registerRunListener(async (args) => {
        const hours = args.hours;
        const threshold = args.windSpeed;
        const maxWindSpeed = await this.getMaxWindSpeedInNextHours(hours);
        return maxWindSpeed > threshold;
      });

    // Add more conditions as needed
  }

  // Fetch SMHI data
  async fetchSMHIData() {
    const currentTime = Date.now();
    if (currentTime - this.lastFetchTime < this.cacheDuration && this.weatherData) {
      return; // Use cached data
    }

    try {
      const approvedTime = await this.getApprovedTime();
      if (approvedTime !== this.approvedTime) {
        this.approvedTime = approvedTime;
        this.weatherData = await this.getWeatherData();
        this.lastFetchTime = currentTime;
        await this.updateCapabilities();
      }
    } catch (error) {
      this.error('Failed to fetch SMHI data:', error);
    }
  }

  // Get the latest approved time
  async getApprovedTime() {
    const url = 'https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/approvedtime.json';
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.approvedTime[0];
  }

  // Get weather data
  async getWeatherData() {
    const settings = this.getSettings();
    const longitude = settings.usehomeylocation ? this.homey.geolocation.getLongitude() : parseFloat(settings.longitude);
    const latitude = settings.usehomeylocation ? this.homey.geolocation.getLatitude() : parseFloat(settings.latitude);
    const url = `https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point/lon/${longitude.toFixed(6)}/lat/${latitude.toFixed(6)}/data.json`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  }

  // Update device capabilities for point-in-time forecast
  async updateCapabilities() {
    const settings = this.getSettings();
    const forecastHoursAhead = parseInt(settings.fcTime, 10) || 0; // Default to 0 if not set
    const targetTime = new Date(Date.now() + forecastHoursAhead * 3600 * 1000);

    // Find the closest forecast time
    const closestDataPoint = this.findClosestForecastDataPoint(targetTime);
    if (!closestDataPoint) {
      this.error('No forecast data available for the specified time.');
      return;
    }

    await this.processForecastData(closestDataPoint);
  }

  // Find the closest forecast data point to the target time
  findClosestForecastDataPoint(targetTime) {
    let closestDataPoint = null;
    let smallestTimeDiff = Infinity;

    for (const dataPoint of this.weatherData.timeSeries) {
      const validTime = new Date(dataPoint.validTime);
      const timeDiff = Math.abs(validTime - targetTime);

      if (timeDiff < smallestTimeDiff) {
        smallestTimeDiff = timeDiff;
        closestDataPoint = dataPoint;
      }
    }

    return closestDataPoint;
  }

  // Process and update capabilities based on forecast data
  async processForecastData(forecastData) {
    const parameters = {};
    forecastData.parameters.forEach((param) => {
      parameters[param.name] = param.values[0];
    });

    // Calculate "feels like" temperature
    const feelsLikeConfig = {
      temp: parameters.t,
      humidity: parameters.r,
      speed: parameters.ws,
      units: { temp: 'c', speed: 'mps' },
    };
    const feelsLike = Math.round(new Feels(feelsLikeConfig).like() * 100) / 100;

    // Map SMHI parameters to device capabilities
    const capabilityMapping = {
      measure_temperature: parameters.t,
      measure_pressure: parameters.msl,
      measure_humidity: parameters.r,
      measure_wind_speed: parameters.ws,
      measure_wind_angle: parameters.wd,
      measure_rain: parameters.pmean,
      measure_snow: parameters.spp >= 0 ? parameters.spp : 0,
      measure_cloudiness: parameters.tcc_mean,
      measure_feels_like: feelsLike,
      // Add more mappings as needed
    };

    // Update capabilities
    for (const [capability, value] of Object.entries(capabilityMapping)) {
      await this.setCapabilityValue(capability, value).catch(this.error);
    }
  }

  // Update aggregated capabilities for the next X hours
  async updateAggregatedCapabilities() {
    const settings = this.getSettings();
    const hoursAhead = parseInt(settings.forecastHoursAhead, 10) || 6; // Default to 6 hours
    const forecastData = await this.getForecastDataForNextHours(hoursAhead);

    if (forecastData.length === 0) {
      this.error('No forecast data available for the specified time range.');
      return;
    }

    // Analyze the data
    const willRain = forecastData.some(dataPoint => {
      const pcatParam = dataPoint.parameters.find(param => param.name === 'pcat');
      return pcatParam && pcatParam.values[0] > 0;
    });

    let maxWindSpeed = 0;
    let minTemperature = Infinity;

    for (const dataPoint of forecastData) {
      const wsParam = dataPoint.parameters.find(param => param.name === 'ws');
      const tempParam = dataPoint.parameters.find(param => param.name === 't');

      if (wsParam) {
        const windSpeed = wsParam.values[0];
        if (windSpeed > maxWindSpeed) {
          maxWindSpeed = windSpeed;
        }
      }

      if (tempParam) {
        const temperature = tempParam.values[0];
        if (temperature < minTemperature) {
          minTemperature = temperature;
        }
      }
    }

    // Update capabilities
    await this.setCapabilityValue('will_rain_next_hours', willRain).catch(this.error);
    await this.setCapabilityValue('measure_max_wind_speed_next_hours', maxWindSpeed).catch(this.error);
    await this.setCapabilityValue('measure_min_temperature_next_hours', minTemperature).catch(this.error);

    this.log(`Aggregated weather data updated for the next ${hoursAhead} hours.`);
  }

  // Get forecast data for the next X hours
  async getForecastDataForNextHours(hoursAhead) {
    const endTime = new Date(Date.now() + hoursAhead * 3600 * 1000);

    // Ensure weatherData is up to date
    if (!this.weatherData) {
      await this.fetchSMHIData();
    }

    // Filter timeSeries for data points within the next X hours
    const forecastData = this.weatherData.timeSeries.filter((dataPoint) => {
      const validTime = new Date(dataPoint.validTime);
      return validTime >= new Date() && validTime <= endTime;
    });

    return forecastData;
  }

  // Check if it will rain within the next X hours
  async willItRainInNextHours(hoursAhead) {
    const forecastData = await this.getForecastDataForNextHours(hoursAhead);

    if (forecastData.length === 0) {
      this.error('No forecast data available for the specified time range.');
      return false;
    }

    return forecastData.some(dataPoint => {
      const pcatParam = dataPoint.parameters.find(param => param.name === 'pcat');
      return pcatParam && pcatParam.values[0] > 0;
    });
  }

  // Get maximum wind speed in the next X hours
  async getMaxWindSpeedInNextHours(hoursAhead) {
    const forecastData = await this.getForecastDataForNextHours(hoursAhead);

    if (forecastData.length === 0) {
      this.error('No forecast data available for the specified time range.');
      return 0;
    }

    let maxWindSpeed = 0;

    for (const dataPoint of forecastData) {
      const wsParam = dataPoint.parameters.find(param => param.name === 'ws');
      if (wsParam) {
        const windSpeed = wsParam.values[0];
        if (windSpeed > maxWindSpeed) {
          maxWindSpeed = windSpeed;
        }
      }
    }

    return maxWindSpeed;
  }

  // Get minimum temperature in the next X hours
  async getMinTemperatureInNextHours(hoursAhead) {
    const forecastData = await this.getForecastDataForNextHours(hoursAhead);

    if (forecastData.length === 0) {
      this.error('No forecast data available for the specified time range.');
      return null;
    }

    let minTemperature = Infinity;

    for (const dataPoint of forecastData) {
      const tempParam = dataPoint.parameters.find(param => param.name === 't');
      if (tempParam) {
        const temperature = tempParam.values[0];
        if (temperature < minTemperature) {
          minTemperature = temperature;
        }
      }
    }

    return minTemperature;
  }

  // Convert wind angle to direction
  getWindDirection(angle) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(((angle % 360) / 45)) % 8;
    return directions[index];
  }

  onDeleted() {
    this.log('Device deleted');
    clearInterval(this._fetchInterval);
    clearInterval(this._aggregatedDataInterval);
  }
}

module.exports = WeatherDevice;
