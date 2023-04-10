'use strict';

const { Device } = require('homey');
const fetch = require('node-fetch');
const Feels = require('feels');

class WeatherDevice extends Device {
	
// defining variables
air_pressure = 0;
air_temperature = 0;
horizontal_visibility = 0;
wind_direction = 0;
wind_speed = 0;
relative_humidity = 0;
thunder_probability = 0;
mean_value_of_total_cloud_cover = 0;
mean_value_of_low_level_cloud_cover = 0;
mean_value_of_medium_level_cloud_cover = 0;
mean_value_of_high_level_cloud_cover = 0;
wind_gust_speed = 0;
minimum_precipitation_intensity = 0;
maximum_precipitation_intensity = 0;
percent_of_precipitation_in_frozen_form = 0;
precipitation_category = 0;
mean_precipitation_intensity = 0;
median_precipitation_intensity = 0;
weather_symbol = 0;
weatherData = {
    timeSeries: [],
};

	async onInit() {

		this.log('SMHI weather device initiated');
		this.device = this;

		// registering Flow cards
		this.registerFlowTriggers();
		this.registerFlowConditions();

		// fetch initial data on device initialization
		const settings = this.getSettings();
		this.fetchSMHIData(settings);
		
		// fetch new SMHI data according to pollInterval settings (milliseconds)
		const pollInterval = 3600000;
		this._fetchSMHIData = setInterval(()=> {this.fetchSMHIData(settings);}, pollInterval);

	}; // end onInit

	async registerFlowTriggers() {
		// register Capability Flow Triggers
		this.flowTriggerWeatherSituationChange = this.homey.flow.getDeviceTriggerCard('WeatherSituationChange');
		this.flowTriggerAirTemperatureChange = this.homey.flow.getDeviceTriggerCard('AirTemperatureChange');
		this.flowTriggerWindSpeedChange = this.homey.flow.getDeviceTriggerCard('WindSpeedChange');
		this.flowTriggerWindDirectionHeadingChange = this.homey.flow.getDeviceTriggerCard('WindDirectionHeadingChange');
		this.flowTriggerRelativeHumidityChange = this.homey.flow.getDeviceTriggerCard('RelativeHumidityChange');
		this.flowTriggerAirPressureChange = this.homey.flow.getDeviceTriggerCard('AirPressureChange');
		this.flowTriggerThunderProbabilityChange = this.homey.flow.getDeviceTriggerCard('ThunderProbabilityChange');
		this.flowTriggerPrecipitationSituationChange = this.homey.flow.getDeviceTriggerCard('PrecipitationSituationChange');
		this.flowTriggerMeanValueOfTotalCloudCoverChange = this.homey.flow.getDeviceTriggerCard('MeanValueOfTotalCloudCoverChange');
		// register Function Flow Triggers


	}; // end registerFlowTriggers

	registerFlowConditions() { // register Flow condition cards

		this.conditionWillRainWithinHours = this.homey.flow.getConditionCard('will_rain_within_hours')
		.registerRunListener(async (args, state) => {
			var result = await this.willItRainWithin(args.hours);
			return Promise.resolve(result);
		});

		this.weatherSituationStatus = this.homey.flow.getConditionCard('measure_weather_situation_cp')
		.registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('measure_weather_situation_cp'.replace(/\s+/g, '')) == args.weather_situation_condition)
			return Promise.resolve(result);
		});

		this.airTemperatureStatus = this.homey.flow.getConditionCard('measure_air_temperature_cp')
		.registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('measure_air_temperature_cp') > args.degree)
			return Promise.resolve(result);
		});

		this.windSpeedStatus = this.homey.flow.getConditionCard('measure_wind_speed_cp')
		.registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('measure_wind_speed_cp') > args.mps)
			return Promise.resolve(result);
		});

		this.windDirectionHeadingStatus = this.homey.flow.getConditionCard('measure_wind_direction_heading_cp')
		.registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('measure_wind_direction_heading_cp') == args.direction)
			return Promise.resolve(result);
		});

		this.windDirectionStatus = this.homey.flow.getConditionCard('measure_wind_direction_cp')
		.registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('measure_wind_direction_cp') > args.degree)
			return Promise.resolve(result);
		});

		this.relativeHumidityStatus = this.homey.flow.getConditionCard('measure_relative_humidity_cp')
		.registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('measure_relative_humidity_cp') > args.percent)
			return Promise.resolve(result);
		});

		this.airPressureStatus = this.homey.flow.getConditionCard('measure_air_pressure_cp')
		.registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('measure_air_pressure_cp') > args.hpa)
			return Promise.resolve(result);
		});

		this.thunderProbabilityStatus = this.homey.flow.getConditionCard('measure_thunder_probability_cp')
		.registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('measure_thunder_probability_cp') > args.percent)
			return Promise.resolve(result);
		});

		this.meanValueOfTotalCloudCoverStatus = this.homey.flow.getConditionCard('mean_value_of_total_cloud_cover_cp')
		.registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('mean_value_of_total_cloud_cover_cp') > args.octas)
			return Promise.resolve(result);
		});

		this.meanValueOfLowLevelCloudCoverStatus = this.homey.flow.getConditionCard('mean_value_of_low_level_cloud_cover_cp')
		.registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('mean_value_of_low_level_cloud_cover_cp') > args.octas)
			return Promise.resolve(result);
		});

		this.meanValueOfMediumLevelCloudCoverStatus = this.homey.flow.getConditionCard('mean_value_of_medium_level_cloud_cover_cp')
		.registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('mean_value_of_medium_level_cloud_cover_cp') > args.octas)
			return Promise.resolve(result);
		});

		this.meanValueOfHighLevelCloudCoverStatus = this.homey.flow.getConditionCard('mean_value_of_high_level_cloud_cover_cp')
		.registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('mean_value_of_high_level_cloud_cover_cp') > args.octas)
			return Promise.resolve(result);
		});

		this.windGustSpeedStatus = this.homey.flow.getConditionCard('wind_gust_speed_cp')
		.registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('wind_gust_speed_cp') > args.mps)
			return Promise.resolve(result);
		});

		this.horizontalVisibilityStatus = this.homey.flow.getConditionCard('horizontal_visibility_cp')
		.registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('horizontal_visibility_cp') > args.km)
			return Promise.resolve(result);
		});

		this.precipitationSituationStatus = this.homey.flow.getConditionCard('measure_precipitation_situation_cp')
		.registerRunListener((args, state) => {
			if (precipitation_category !== 0){
				var result = true;
			} else {
				var result = false;
			}
			return Promise.resolve(result);
		});

		this.meanPrecipitationIntensityStatus = this.homey.flow.getConditionCard('mean_precipitation_intensity_cp')
		.registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('mean_precipitation_intensity_cp') > args.mmh)
			return Promise.resolve(result);
		});

	}; // end registerFlowConditions
  
	// convert wind direction from degrees to heading
	getDirection(angle) {
		let directions = [
			this.homey.__("direction1"),
			this.homey.__("direction2"),
			this.homey.__("direction3"),
			this.homey.__("direction4"),
			this.homey.__("direction5"),
			this.homey.__("direction6"),
			this.homey.__("direction7"),
			this.homey.__("direction8")
		];
		let correctedAngle = 360 - angle;
		console.log("Reported direction: ", directions[Math.round(((correctedAngle %= 360) < 0 ? correctedAngle + 360 : correctedAngle) / 45) % 8]);
		return directions[Math.round(((correctedAngle %= 360) < 0 ? correctedAngle + 360 : correctedAngle) / 45) % 8];
	};

	// stuff that happen when a device is added
	onAdded() {

		let id = this.getData().id;
		this.log('device added: ', id);
		var settings = this.getSettings();

		// working with weather data
		this.fetchSMHIData(settings)
		.catch( err => {
			this.error( err );
		});

	}; // end onAdded

	// when settings change
	async onSettings({oldSettings, newSettings, changedKeys}) {

		this.fetchSMHIData(newSettings)
		.catch( err => {
			this.error( err );
		});

	}; // end onSettings

	// working with SMHI weather data here
	async fetchSMHIData(settings){

		console.log("Settings:", settings);
		var forecastTime = parseInt(settings.fcTime);

		// define SMHI api endpoint
		let APIUrl = "https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point";
		console.log(settings.usehomeylocation ? "Collecting geolocation coordinates for this Homey" : "Defining SMHI API Url based on entered geolocation");
		const roundTo = (num, decimals) => Number(Math.round(num + 'e' + decimals) + 'e-' + decimals);
		const long = settings.usehomeylocation ? roundTo(this.homey.geolocation.getLongitude(), 6) : roundTo(settings.longitude, 6);
		const lat = settings.usehomeylocation ? roundTo(this.homey.geolocation.getLatitude(), 6) : roundTo(settings.latitude, 6);
		var SMHIdataUrl = APIUrl + "/lon/" + long.toFixed(6) + "/lat/" + lat.toFixed(6) + "/data.json";
		console.log("SMHI API Url:", SMHIdataUrl);

		// collecting data
		console.log("Fetching SMHI weather data");
		const response = await fetch(SMHIdataUrl)
		.catch( err => {
			this.error( err );
		});
		this.weatherData = await response.json();

		// defining parameters
		const parameterHandlers = {
			msl: value => this.air_pressure = parseFloat(value),
			t: value => this.air_temperature = parseFloat(value),
			vis: value => this.horizontal_visibility = parseFloat(value),
			wd: value => this.wind_direction = parseInt(value),
			ws: value => this.wind_speed = parseFloat(value),
			r: value => this.relative_humidity = parseInt(value),
			tstm: value => this.thunder_probability = parseInt(value),
			tcc_mean: value => this.mean_value_of_total_cloud_cover = parseInt(value),
			lcc_mean: value => this.mean_value_of_low_level_cloud_cover = parseInt(value),
			mcc_mean: value => this.mean_value_of_medium_level_cloud_cover = parseInt(value),
			hcc_mean: value => this.mean_value_of_high_level_cloud_cover = parseInt(value),
			gust: value => this.wind_gust_speed = parseFloat(value),
			pmin: value => this.minimum_precipitation_intensity = parseFloat(value),
			pmax: value => this.maximum_precipitation_intensity = parseFloat(value),
			spp: value => {
				this.percent_of_precipitation_in_frozen_form = parseInt(value);
			  if (this.percent_of_precipitation_in_frozen_form < 0) {
				this.percent_of_precipitation_in_frozen_form = 0;
			  }
			},
			pcat: value => this.precipitation_category = parseInt(value),
			pmean: value => this.mean_precipitation_intensity = parseFloat(value),
			pmedian: value => this.median_precipitation_intensity = parseFloat(value),
			Wsymb2: value => this.weather_symbol = parseInt(value),
		};

		const parameters = this.weatherData.timeSeries[forecastTime].parameters;
		for (const { name, values } of parameters) {
			if (parameterHandlers.hasOwnProperty(name)) {
				parameterHandlers[name](values);
			}
		};

		// setting forecastFor variable based on forecastTime value
		const fcTimeO = new Date(this.weatherData.timeSeries[forecastTime].validTime);
		const options = { month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: false, timeZone: this.homey.clock.getTimezone() };
		const forecastFor = fcTimeO.toLocaleString(this.homey.locale, options);

		const weatherSituations = Array.from({ length: 27 }, (_, i) => this.homey.__(`weather_situation${i + 1}`));
		const weather_situation = weatherSituations[this.weather_symbol - 1] || this.homey.__("weather_situation");

		// defining precipitation situation based on reported number
		const precipitationSituations = {
			0: this.homey.__("precipitation_situation0"),
			1: this.homey.__("precipitation_situation1"),
			2: this.homey.__("precipitation_situation2"),
			3: this.homey.__("precipitation_situation3"),
			4: this.homey.__("precipitation_situation4"),
			5: this.homey.__("precipitation_situation5"),
			6: this.homey.__("precipitation_situation6"),
		};
		const precipitation_situation = precipitationSituations[this.precipitation_category] || this.homey.__("precipitation_situation");
				
		// defining wind direction
		var wind_direction_heading = this.getDirection(this.wind_direction);

		// calculating "feels like"
		const config = {
		 temp: this.air_temperature,
		 humidity: this.relative_humidity,
		 speed: this.wind_speed,
		 units: {
		  temp: 'c',
		  speed: 'mps'
  		 }
		};
		const feelsLike = Math.round(new Feels(config).like()*100)/100; 

		// setting device capabilities
		const capabilityMapping = {
			measure_weather_situation_cp: weather_situation,
			measure_air_pressure_cp: this.air_pressure,
			measure_air_temperature_cp: this.air_temperature,
			horizontal_visibility_cp: this.horizontal_visibility,
			measure_wind_direction_cp: this.wind_direction,
			measure_wind_speed_cp: this.wind_speed,
			measure_relative_humidity_cp: this.relative_humidity,
			measure_thunder_probability_cp: this.thunder_probability,
			mean_value_of_total_cloud_cover_cp: this.mean_value_of_total_cloud_cover,
			mean_value_of_low_level_cloud_cover_cp: this.mean_value_of_low_level_cloud_cover,
			mean_value_of_medium_level_cloud_cover_cp: this.mean_value_of_medium_level_cloud_cover,
			mean_value_of_high_level_cloud_cover_cp: this.mean_value_of_high_level_cloud_cover,
			wind_gust_speed_cp: this.wind_gust_speed,
			minimum_precipitation_intensity_cp: this.minimum_precipitation_intensity,
			maximum_precipitation_intensity_cp: this.maximum_precipitation_intensity,
			percent_of_precipitation_in_frozen_form_cp: this.percent_of_precipitation_in_frozen_form,
			mean_precipitation_intensity_cp: this.mean_precipitation_intensity,
			median_precipitation_intensity_cp: this.median_precipitation_intensity,
			measure_precipitation_situation_cp: precipitation_situation,
			measure_wind_direction_heading_cp: wind_direction_heading,
			air_temperature_feels_like_cp: feelsLike,
			forecast_for_cp: forecastFor
		};

		// creating flow triggers
		const flowTriggers = {
			measure_weather_situation_cp: this.flowTriggerWeatherSituationChange,
			measure_air_temperature_cp: this.flowTriggerAirTemperatureChange,
			measure_wind_speed_cp: this.flowTriggerWindSpeedChange,
			measure_wind_direction_heading_cp: this.flowTriggerWindDirectionHeadingChange,
			measure_relative_humidity_cp: this.flowTriggerRelativeHumidityChange,
			measure_air_pressure_cp: this.flowTriggerAirPressureChange,
			measure_thunder_probability_cp: this.flowTriggerThunderProbabilityChange,
			measure_precipitation_situation_cp: this.flowTriggerPrecipitationSituationChange,
			mean_value_of_total_cloud_cover_cp: this.flowTriggerMeanValueOfTotalCloudCoverChange,
		};
		
		// triggers the appropriate Homey Flow for the provided capability and value. If the capability is measure_wind_direction_heading_cp, it also includes the wind direction value in the tokens and state.
		const triggerFlow = async (capability, value) => {
			if (flowTriggers[capability]) {
				let state = { [capability]: value };
				let tokens = {};
		
				if (capability === 'measure_wind_direction_heading_cp') {
					tokens = {
						measure_wind_direction_heading_cp: value,
						measure_wind_direction_cp: this.getCapabilityValue('measure_wind_direction_cp'),
					};
		
					state.measure_wind_direction_cp = this.getCapabilityValue('measure_wind_direction_cp');
				} else {
					tokens = { [capability]: value };
				}
		
				await flowTriggers[capability].trigger(this.device, tokens, state).catch(this.error);
			}
		};
		
		// iterates through the entries of the capabilityMapping object. On changed values the capability value are updated and trigger the corresponding Homey Flow.
		for (const [capability, value] of Object.entries(capabilityMapping)) {
			if (this.getCapabilityValue(capability) !== value) {
			  this.setCapabilityValue(capability, value)
				.then(() => {
				  triggerFlow(capability, value);
				})
				.catch(this.error);
			}
		};

	}; // end fetchSMHIData

	// check if it will rain or snow within given number of hours
	async willItRainWithin(hours) {
		const settings = this.getSettings();
		const forecastTime = parseInt(settings.fcTime);
		const currentTime = new Date(this.weatherData.timeSeries[forecastTime].validTime);
		const endTime = new Date(currentTime.getTime() + (hours * 60 * 60 * 1000));
		const timeSeries = this.weatherData.timeSeries.filter((data) => {
		  const validTime = new Date(data.validTime);
		  return validTime >= currentTime && validTime <= endTime;
		});
		let willRain = false;
		for (const data of timeSeries) {
		  const precipitationCategory = data.parameters.find((param) => param.name === "pcat");
		  if (precipitationCategory && precipitationCategory.values[0] > 0) {
			willRain = true;
			break;
		  }
		}
		return willRain;
	};
  
	// Stuff that happens when the device is removed
	onDeleted() {
		let id = this.getData().id;
		this.log('device deleted:', id);
		clearInterval(this._fetchSMHIData);
	}; // end onDeleted

};

module.exports = WeatherDevice;