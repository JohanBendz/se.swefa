'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');
const Feels = require('feels');

let data = "";

class WeatherDevice extends Homey.Device {

	async onInit() {

		this.log('SMHI weather device initiated');

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

	// register Flow trigger cards
	registerFlowTriggers() {
		this._flowTriggerWeatherSituationChange = new Homey.FlowCardTriggerDevice('WeatherSituationChange').register();
		this._flowTriggerAirTemperatureChange = new Homey.FlowCardTriggerDevice('AirTemperatureChange').register();
		this._flowTriggerWindSpeedChange = new Homey.FlowCardTriggerDevice('WindSpeedChange').register();
		this._flowTriggerWindDirectionHeadingChange = new Homey.FlowCardTriggerDevice('WindDirectionHeadingChange').register();
		this._flowTriggerRelativeHumidityChange = new Homey.FlowCardTriggerDevice('RelativeHumidityChange').register();
		this._flowTriggerAirPressureChange = new Homey.FlowCardTriggerDevice('AirPressureChange').register();
		this._flowTriggerThunderProbabilityChange = new Homey.FlowCardTriggerDevice('ThunderProbabilityChange').register();
		this._flowTriggerPrecipitationSituationChange = new Homey.FlowCardTriggerDevice('PrecipitationSituationChange').register();
		this._flowTriggerMeanValueOfTotalCloudCoverChange = new Homey.FlowCardTriggerDevice('MeanValueOfTotalCloudCoverChange').register();
	}; // end registerFlowTriggers

	// register Flow condition cards
	registerFlowConditions() {

		this.conditionWillRainWithinHours = new Homey.FlowCardCondition('will_rain_within_hours').register().registerRunListener(async (args, state) => {
			var result = await this.willItRainWithin(data, args.hours);
			return Promise.resolve(result);
		});

		this.weatherSituationStatus = new Homey.FlowCardCondition('measure_weather_situation_cp').register().registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('measure_weather_situation_cp'.replace(/\s+/g, '')) == args.weather_situation_condition)
			return Promise.resolve(result);
		});

		this.airTemperatureStatus = new Homey.FlowCardCondition('measure_air_temperature_cp').register().registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('measure_air_temperature_cp') > args.degree)
			return Promise.resolve(result);
		});

		this.windSpeedStatus = new Homey.FlowCardCondition('measure_wind_speed_cp').register().registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('measure_wind_speed_cp') > args.mps)
			return Promise.resolve(result);
		});

		this.windDirectionHeadingStatus = new Homey.FlowCardCondition('measure_wind_direction_heading_cp').register().registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('measure_wind_direction_heading_cp') == args.direction)
			return Promise.resolve(result);
		});

		this.windDirectionStatus = new Homey.FlowCardCondition('measure_wind_direction_cp').register().registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('measure_wind_direction_cp') > args.degree)
			return Promise.resolve(result);
		});

		this.relativeHumidityStatus = new Homey.FlowCardCondition('measure_relative_humidity_cp').register().registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('measure_relative_humidity_cp') > args.percent)
			return Promise.resolve(result);
		});

		this.airPressureStatus = new Homey.FlowCardCondition('measure_air_pressure_cp').register().registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('measure_air_pressure_cp') > args.hpa)
			return Promise.resolve(result);
		});

		this.thunderProbabilityStatus = new Homey.FlowCardCondition('measure_thunder_probability_cp').register().registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('measure_thunder_probability_cp') > args.percent)
			return Promise.resolve(result);
		});

		this.meanValueOfTotalCloudCoverStatus = new Homey.FlowCardCondition('mean_value_of_total_cloud_cover_cp').register().registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('mean_value_of_total_cloud_cover_cp') > args.octas)
			return Promise.resolve(result);
		});

		this.meanValueOfLowLevelCloudCoverStatus = new Homey.FlowCardCondition('mean_value_of_low_level_cloud_cover_cp').register().registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('mean_value_of_low_level_cloud_cover_cp') > args.octas)
			return Promise.resolve(result);
		});

		this.meanValueOfMediumLevelCloudCoverStatus = new Homey.FlowCardCondition('mean_value_of_medium_level_cloud_cover_cp').register().registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('mean_value_of_medium_level_cloud_cover_cp') > args.octas)
			return Promise.resolve(result);
		});

		this.meanValueOfHighLevelCloudCoverStatus = new Homey.FlowCardCondition('mean_value_of_high_level_cloud_cover_cp').register().registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('mean_value_of_high_level_cloud_cover_cp') > args.octas)
			return Promise.resolve(result);
		});

		this.windGustSpeedStatus = new Homey.FlowCardCondition('wind_gust_speed_cp').register().registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('wind_gust_speed_cp') > args.mps)
			return Promise.resolve(result);
		});

		this.horizontalVisibilityStatus = new Homey.FlowCardCondition('horizontal_visibility_cp').register().registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('horizontal_visibility_cp') > args.km)
			return Promise.resolve(result);
		});

		this.precipitationSituationStatus = new Homey.FlowCardCondition('measure_precipitation_situation_cp').register().registerRunListener((args, state) => {
			if (precipitation_category !== 0){
				var result = true;
			} else {
				var result = false;
			}
			return Promise.resolve(result);
		});

		this.meanPrecipitationIntensityStatus = new Homey.FlowCardCondition('mean_precipitation_intensity_cp').register().registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('mean_precipitation_intensity_cp') > args.mmh)
			return Promise.resolve(result);
		});

	}; // end registerFlowConditions

	// checking if there will be precipitation within given number of hours
	willItRainWithin = (weatherData, hours) =>{
		const timeSeries = weatherData.timeSeries;
		const currentTime = new Date(weatherData.referenceTime);
		const targetTime = new Date(currentTime.getTime() + hours * 60 * 60 * 1000);
		
		for (const timePoint of timeSeries) {
			const validTime = new Date(timePoint.validTime);
			if (validTime > targetTime) break;
		
			for (const param of timePoint.parameters) {
			if (param.name === 'pcat' && param.values[0] > 0) {
				return true;
			}
			}
		}
		return false;
	}

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
	async onSettings(oldSettings, newSettings, changedKeys) {

		// check and update settings
		if (changedKeys && changedKeys.length) {
	
			for (var i=0; i<changedKeys.length;i++){
					
				if (changedKeys[i] == 'fcTime') {
					this.log('Offset changed from ' + oldSettings.fcTime + ' to ' + newSettings.fcTime + '. Fetching new forecast.');
				}
						
				if (changedKeys[i] == 'latitude') {
					this.log('Latitude changed from ' + oldSettings.latitude + ' to ' + newSettings.latitude + '. Fetching new forecast.');
				}
						
				if (changedKeys[i] == 'longitude') {
					this.log('Longitude changed from ' + oldSettings.longitude + ' to ' + newSettings.longitude + '. Fetching new forecast.');
				}
						
				if (changedKeys[i] == 'usehomeylocation') {
					this.log('Setting for use of Homey geolocation changed from ' + oldSettings.usehomeylocation + ' to ' + newSettings.usehomeylocation + '. Fetching new forecast.');
				}
			}
		}

		this.fetchSMHIData(newSettings)
		.catch( err => {
			this.error( err );
		});

	}; // end onSettings

	// working with SMHI weather data here
	async fetchSMHIData(settings){

		console.log(settings);
		var forecastTime = parseInt(settings.fcTime);

		function round(value, precision) {
			var multiplier = Math.pow(10, precision || 0);
			return Math.round(value * multiplier) / multiplier;
		}

		// define SMHI api endpoint
		let APIUrl = "https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point";
		console.log(settings.usehomeylocation ? "Collecting geolocation coordinates for this Homey" : "Defining SMHI API Url based on entered geolocation");
		const roundTo = (num, decimals) => Number(Math.round(num + 'e' + decimals) + 'e-' + decimals);
		const long = settings.usehomeylocation ? roundTo(Homey.ManagerGeolocation.getLongitude(), 6) : roundTo(settings.longitude, 6);
		const lat = settings.usehomeylocation ? roundTo(Homey.ManagerGeolocation.getLatitude(), 6) : roundTo(settings.latitude, 6);
		var SMHIdataUrl = APIUrl + "/lon/" + long.toFixed(6) + "/lat/" + lat.toFixed(6) + "/data.json";
		console.log("SMHI API Url:", SMHIdataUrl);

		// collecting data
		console.log("Fetching SMHI weather data");
		const response = await fetch(SMHIdataUrl)
		.catch( err => {
			this.error( err );
		});
		data = await response.json();
		let device = this;

		// defining variables
		let air_pressure = "";
		let air_temperature = "";
		let horizontal_visibility = "";
		let wind_direction = "";
		let wind_speed = "";
		let relative_humidity = "";
		let thunder_probability = "";
		let mean_value_of_total_cloud_cover = "";
		let mean_value_of_low_level_cloud_cover = "";
		let mean_value_of_medium_level_cloud_cover = "";
		let mean_value_of_high_level_cloud_cover = "";
		let wind_gust_speed = "";
		let minimum_precipitation_intensity = "";
		let maximum_precipitation_intensity = "";
		let percent_of_precipitation_in_frozen_form = "";
		let precipitation_category = "";
		let mean_precipitation_intensity = "";
		let median_precipitation_intensity = "";
		let weather_symbol = "";
		let weather_situation = "";
		let precipitation_situation = "";

		// defining parameters
		const parameterHandlers = {
			msl: value => air_pressure = parseFloat(value),
			t: value => air_temperature = parseFloat(value),
			vis: value => horizontal_visibility = parseFloat(value),
			wd: value => wind_direction = parseInt(value),
			ws: value => wind_speed = parseFloat(value),
			r: value => relative_humidity = parseInt(value),
			tstm: value => thunder_probability = parseInt(value),
			tcc_mean: value => mean_value_of_total_cloud_cover = parseInt(value),
			lcc_mean: value => mean_value_of_low_level_cloud_cover = parseInt(value),
			mcc_mean: value => mean_value_of_medium_level_cloud_cover = parseInt(value),
			hcc_mean: value => mean_value_of_high_level_cloud_cover = parseInt(value),
			gust: value => wind_gust_speed = parseFloat(value),
			pmin: value => minimum_precipitation_intensity = parseFloat(value),
			pmax: value => maximum_precipitation_intensity = parseFloat(value),
			spp: value => {
			  percent_of_precipitation_in_frozen_form = parseInt(value);
			  if (percent_of_precipitation_in_frozen_form < 0) {
				percent_of_precipitation_in_frozen_form = 0;
			  }
			},
			pcat: value => precipitation_category = parseInt(value),
			pmean: value => mean_precipitation_intensity = parseFloat(value),
			pmedian: value => median_precipitation_intensity = parseFloat(value),
			Wsymb2: value => weather_symbol = parseInt(value),
		};
		const parameters = data.timeSeries[forecastTime].parameters;
		for (let i = 0; i < parameters.length; i++) {
			const parameterName = parameters[i]["name"];
			const parameterValue = parameters[i]["values"];
			if (parameterHandlers.hasOwnProperty(parameterName)) {
				parameterHandlers[parameterName](parameterValue);
			}
		};		  

		// setting forecastFor variable based on forecastTime value
		let fcTimeO = new Date(data.timeSeries[forecastTime]["validTime"]);
		const months = Array.from({ length: 12 }, (_, i) => Homey.__(`month${i + 1}`));
		const fcTimeM = months[fcTimeO.getMonth()];
		const forecastFor = `${fcTimeM} ${fcTimeO.getDate()} ${fcTimeO.toTimeString().slice(0, 5)}`;

		const weatherSituations = Array.from({ length: 27 }, (_, i) => Homey.__(`weather_situation${i + 1}`));
		weather_situation = weatherSituations[weather_symbol - 1] || Homey.__("weather_situation");

		// defining precipitation situation based on reported number
		const precipitationSituations = {
			0: Homey.__("precipitation_situation0"),
			1: Homey.__("precipitation_situation1"),
			2: Homey.__("precipitation_situation2"),
			3: Homey.__("precipitation_situation3"),
			4: Homey.__("precipitation_situation4"),
			5: Homey.__("precipitation_situation5"),
			6: Homey.__("precipitation_situation6"),
		};
		precipitation_situation = precipitationSituations[precipitation_category] || Homey.__("precipitation_situation");
				
		// convert wind direction from degrees to heading
		function getDirection(angle) {
			let directions = [
				Homey.__("direction1"),
				Homey.__("direction2"),
				Homey.__("direction3"),
				Homey.__("direction4"),
				Homey.__("direction5"),
				Homey.__("direction6"),
				Homey.__("direction7"),
				Homey.__("direction8")
			];
			let correctedAngle = 360 - angle;
			return directions[Math.round(((correctedAngle %= 360) < 0 ? correctedAngle + 360 : correctedAngle) / 45) % 8];
		  }
		var wind_direction_heading = getDirection(wind_direction);

		// calculating "feels like"
		const config = {
		 temp: air_temperature,
		 humidity: relative_humidity,
		 speed: wind_speed,
		 units: {
		  temp: 'c',
		  speed: 'mps'
  		 }
		};
		const feelsLike = Math.round(new Feels(config).like()*100)/100; 

		// setting device capabilities
		const capabilityMapping = {
			measure_weather_situation_cp: weather_situation,
			measure_air_pressure_cp: air_pressure,
			measure_air_temperature_cp: air_temperature,
			horizontal_visibility_cp: horizontal_visibility,
			measure_wind_direction_cp: wind_direction,
			measure_wind_speed_cp: wind_speed,
			measure_relative_humidity_cp: relative_humidity,
			measure_thunder_probability_cp: thunder_probability,
			mean_value_of_total_cloud_cover_cp: mean_value_of_total_cloud_cover,
			mean_value_of_low_level_cloud_cover_cp: mean_value_of_low_level_cloud_cover,
			mean_value_of_medium_level_cloud_cover_cp: mean_value_of_medium_level_cloud_cover,
			mean_value_of_high_level_cloud_cover_cp: mean_value_of_high_level_cloud_cover,
			wind_gust_speed_cp: wind_gust_speed,
			minimum_precipitation_intensity_cp: minimum_precipitation_intensity,
			maximum_precipitation_intensity_cp: maximum_precipitation_intensity,
			percent_of_precipitation_in_frozen_form_cp: percent_of_precipitation_in_frozen_form,
			mean_precipitation_intensity_cp: mean_precipitation_intensity,
			median_precipitation_intensity_cp: median_precipitation_intensity,
			measure_precipitation_situation_cp: precipitation_situation,
			measure_wind_direction_heading_cp: wind_direction_heading,
			air_temperature_feels_like_cp: feelsLike,
			forecast_for_cp: forecastFor
		};
		// creating flow triggers
		const flowTriggers = {
			measure_weather_situation_cp: this._flowTriggerWeatherSituationChange,
			measure_air_temperature_cp: this._flowTriggerAirTemperatureChange,
			measure_wind_speed_cp: this._flowTriggerWindSpeedChange,
			measure_wind_direction_heading_cp: this._flowTriggerWindDirectionHeadingChange,
			measure_relative_humidity_cp: this._flowTriggerRelativeHumidityChange,
			measure_air_pressure_cp: this._flowTriggerAirPressureChange,
			measure_thunder_probability_cp: this._flowTriggerThunderProbabilityChange,
			measure_precipitation_situation_cp: this._flowTriggerPrecipitationSituationChange,
			mean_value_of_total_cloud_cover_cp: this._flowTriggerMeanValueOfTotalCloudCoverChange
		};
		for (const [capability, value] of Object.entries(capabilityMapping)) {
			this.setCapabilityValue(capability, value);
			if (flowTriggers[capability] && this.getCapabilityValue(capability) !== value) {
				let state = { [capability]: value };
				let tokens = { [capability]: value };
				flowTriggers[capability].trigger(device, tokens, state).catch(this.error);
			}
		}

	}; // end fetchSMHIData
  
	// Stuff that happens when the device is removed
	onDeleted() {
		let id = this.getData().id;
		this.log('device deleted:', id);
		clearInterval(this._fetchSMHIData);
	}; // end onDeleted

};

module.exports = WeatherDevice;