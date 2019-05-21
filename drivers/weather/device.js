'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');
const Feels = require('feels');

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
let rainsnow = "";

let forecastFor = "";
let forecastTime = "";
let settings = "";

class WeatherDevice extends Homey.Device {

	onInit() {
		this.log('SMHI weather device initiated');
		
		// get current settings
		settings = this.getSettings();
		forecastTime = parseInt(settings.fcTime);
	
		// fetch SMHI data when app starts
		this.fetchSMHIData()
		.catch( err => {
			this.error( err );
		});
		
		// fetch new SMHI data according to pollInterval settings (milliseconds)
		const pollInterval = 3600000;
		this._fetchSMHIData = setInterval(this.fetchSMHIData.bind(this), pollInterval);

		// register Flow triggers
		this._flowTriggerWeatherSituationChange = new Homey.FlowCardTriggerDevice('WeatherSituationChange').register();
		this._flowTriggerAirTemperatureChange = new Homey.FlowCardTriggerDevice('AirTemperatureChange').register();
		this._flowTriggerWindSpeedChange = new Homey.FlowCardTriggerDevice('WindSpeedChange').register();
		this._flowTriggerWindDirectionHeadingChange = new Homey.FlowCardTriggerDevice('WindDirectionHeadingChange').register();
		this._flowTriggerRelativeHumidityChange = new Homey.FlowCardTriggerDevice('RelativeHumidityChange').register();
		this._flowTriggerAirPressureChange = new Homey.FlowCardTriggerDevice('AirPressureChange').register();
		this._flowTriggerThunderProbabilityChange = new Homey.FlowCardTriggerDevice('ThunderProbabilityChange').register();
		this._flowTriggerMeanValueOfTotalCloudCoverChange = new Homey.FlowCardTriggerDevice('MeanValueOfTotalCloudCoverChange').register();
		
		// Register Flow conditions
		this.weatherSituationStatus = new Homey.FlowCardCondition('measure_weather_situation_cp').register().registerRunListener((args, state) => {
			var result = (weather_situation.replace(/\s+/g, '') == args.weather_situation_condition)
			return Promise.resolve(result);
		});

		this.airTemperatureStatus = new Homey.FlowCardCondition('measure_air_temperature_cp').register().registerRunListener((args, state) => {
			var result = (air_temperature > args.degree)
			return Promise.resolve(result);
		});

		this.windSpeedStatus = new Homey.FlowCardCondition('measure_wind_speed_cp').register().registerRunListener((args, state) => {
			var result = (wind_speed > args.mps)
			return Promise.resolve(result);
		});

		this.windDirectionHeadingStatus = new Homey.FlowCardCondition('measure_wind_direction_heading_cp').register().registerRunListener((args, state) => {
			var result = (wind_direction_heading == args.direction)
			return Promise.resolve(result);
		});

		this.relativeHumidityStatus = new Homey.FlowCardCondition('measure_relative_humidity_cp').register().registerRunListener((args, state) => {
			var result = (relative_humidity > args.percent)
			return Promise.resolve(result);
		});

		this.airPressureStatus = new Homey.FlowCardCondition('measure_air_pressure_cp').register().registerRunListener((args, state) => {
			var result = (air_pressure > args.hpa)
			return Promise.resolve(result);
		});

		this.thunderProbabilityStatus = new Homey.FlowCardCondition('measure_thunder_probability_cp').register().registerRunListener((args, state) => {
			var result = (thunder_probability > args.percent)
			return Promise.resolve(result);
		});

		this.meanValueOfTotalCloudCoverStatus = new Homey.FlowCardCondition('mean_value_of_total_cloud_cover_cp').register().registerRunListener((args, state) => {
			var result = (mean_value_of_total_cloud_cover > args.octas)
			return Promise.resolve(result);
		});

		this.windGustSpeedStatus = new Homey.FlowCardCondition('wind_gust_speed_cp').register().registerRunListener((args, state) => {
			var result = (wind_gust_speed > args.mps)
			return Promise.resolve(result);
		});

		this.horizontalVisibilityStatus = new Homey.FlowCardCondition('horizontal_visibility_cp').register().registerRunListener((args, state) => {
			var result = (horizontal_visibility > args.km)
			return Promise.resolve(result);
		});

		if (precipitation_category == 0){
			rainsnow = "RainSnow";
		} else {
			rainsnow = "";
		}

		this.precipitationSituationStatus = new Homey.FlowCardCondition('measure_precipitation_situation_cp').register().registerRunListener((args, state) => {
			var result = (rainsnow == args.rainsnow)
			return Promise.resolve(result);
		});

		this.meanPrecipitationIntensityStatus = new Homey.FlowCardCondition('mean_precipitation_intensity_cp').register().registerRunListener((args, state) => {
			var result = (mean_precipitation_intensity > args.mmh)
			return Promise.resolve(result);
		});


	}; // end onInit

	onAdded() {
		let id = this.getData().id;
		this.log('device added: ', id);
			
		// working with weather data
		this.fetchSMHIData()
		.catch( err => {
			this.error( err );
		});
			
	}; // end onAdded

	// on changed settings
	async onSettings(oldSettingsObj, newSettingsObj, changedKeysArr) {
		if (changedKeysArr == 'fcTime') {
			this.log('Settings changed from ' + oldSettingsObj.fcTime + ' to ' + newSettingsObj.fcTime) + '. Fetching new forecast.';
			forecastTime = parseInt(newSettingsObj.fcTime);
			this.fetchSMHIData();
		}
	}; // end onSettings

	// working with SMHI weather data here
	async fetchSMHIData(){
		console.log("Fetching SMHI weather data");
		const response = await fetch(SMHIdataUrl)
		.catch( err => {
			this.error( err );
		});
		const data = await response.json();
							
		// working with SMHI json data here
		for (var i=0; i < data.timeSeries[forecastTime].parameters.length; i++){
			if (data.timeSeries[forecastTime].parameters[i]["name"] == "msl"){
				air_pressure = parseFloat(data.timeSeries[forecastTime].parameters[i]["values"]);
			}
			if (data.timeSeries[forecastTime].parameters[i]["name"] == "t"){
				air_temperature = parseFloat(data.timeSeries[forecastTime].parameters[i]["values"]);
			}
			if (data.timeSeries[forecastTime].parameters[i]["name"] == "vis"){
				horizontal_visibility = parseFloat(data.timeSeries[forecastTime].parameters[i]["values"]);
			}
			if (data.timeSeries[forecastTime].parameters[i]["name"] == "wd"){
				wind_direction = parseInt(data.timeSeries[forecastTime].parameters[i]["values"]);
			}
			if (data.timeSeries[forecastTime].parameters[i]["name"] == "ws"){
				wind_speed = parseFloat(data.timeSeries[forecastTime].parameters[i]["values"]);
			}
			if (data.timeSeries[forecastTime].parameters[i]["name"] == "r"){
				relative_humidity = parseInt(data.timeSeries[forecastTime].parameters[i]["values"]);
			}
			if (data.timeSeries[forecastTime].parameters[i]["name"] == "tstm"){
				thunder_probability = parseInt(data.timeSeries[forecastTime].parameters[i]["values"]);
			}
			if (data.timeSeries[forecastTime].parameters[i]["name"] == "tcc_mean"){
				mean_value_of_total_cloud_cover = parseInt(data.timeSeries[forecastTime].parameters[i]["values"]);
			}
			if (data.timeSeries[forecastTime].parameters[i]["name"] == "lcc_mean"){
				mean_value_of_low_level_cloud_cover = parseInt(data.timeSeries[forecastTime].parameters[i]["values"]);
			}
			if (data.timeSeries[forecastTime].parameters[i]["name"] == "mcc_mean"){
				mean_value_of_medium_level_cloud_cover = parseInt(data.timeSeries[forecastTime].parameters[i]["values"]);
			}
			if (data.timeSeries[forecastTime].parameters[i]["name"] == "hcc_mean"){
				mean_value_of_high_level_cloud_cover = parseInt(data.timeSeries[forecastTime].parameters[i]["values"]);
			}
			if (data.timeSeries[forecastTime].parameters[i]["name"] == "gust"){
				wind_gust_speed = parseFloat(data.timeSeries[forecastTime].parameters[i]["values"]);
			}
			if (data.timeSeries[forecastTime].parameters[i]["name"] == "pmin"){
				minimum_precipitation_intensity = parseFloat(data.timeSeries[forecastTime].parameters[i]["values"]);
			}
			if (data.timeSeries[forecastTime].parameters[i]["name"] == "pmax"){
				maximum_precipitation_intensity = parseFloat(data.timeSeries[forecastTime].parameters[i]["values"]);
			}
			if (data.timeSeries[forecastTime].parameters[i]["name"] == "spp"){
				percent_of_precipitation_in_frozen_form = parseInt(data.timeSeries[forecastTime].parameters[i]["values"]);
				if (percent_of_precipitation_in_frozen_form < 0){
					percent_of_precipitation_in_frozen_form = 0;
				}
			}
			if (data.timeSeries[forecastTime].parameters[i]["name"] == "pcat"){
				precipitation_category = parseInt(data.timeSeries[forecastTime].parameters[i]["values"]);
			}
			if (data.timeSeries[forecastTime].parameters[i]["name"] == "pmean"){
				mean_precipitation_intensity = parseFloat(data.timeSeries[forecastTime].parameters[i]["values"]);
			}
			if (data.timeSeries[forecastTime].parameters[i]["name"] == "pmedian"){
				median_precipitation_intensity = parseFloat(data.timeSeries[forecastTime].parameters[i]["values"]);
			}
			if (data.timeSeries[forecastTime].parameters[i]["name"] == "Wsymb2"){
				weather_symbol = parseInt(data.timeSeries[forecastTime].parameters[i]["values"]);
			}
		};

		// setting forecastFor variable based on forecastTime value
		let fcTimeO = new Date(data.timeSeries[forecastTime]["validTime"]);
		var month = [];
		month[0] = "January";
		month[1] = "February";
		month[2] = "March";
		month[3] = "April";
		month[4] = "May";
		month[5] = "June";
		month[6] = "July";
		month[7] = "August";
		month[8] = "September";
		month[9] = "October";
		month[10] = "November";
		month[11] = "December";
		var fcTimeM = month[fcTimeO.getMonth()];
		forecastFor = (fcTimeM+" "+fcTimeO.getDate()+" "+(fcTimeO.toLocaleTimeString().slice(0,-3)));

		// switch from number to string
		weather_situation = "";
		switch (weather_symbol) {
			case 1: weather_situation = "Clear sky"; break;
			case 2: weather_situation = "Nearly clear sky"; break;
			case 3: weather_situation = "Variable cloudiness"; break;
			case 4: weather_situation = "Halfclear sky"; break;
			case 5: weather_situation = "Cloudy sky"; break;
			case 6: weather_situation = "Overcast"; break;
			case 7: weather_situation = "Fog"; break;
			case 8: weather_situation = "Light rain showers"; break;
			case 9: weather_situation = "Moderate rain showers"; break;
			case 10: weather_situation = "Heavy rain showers"; break;
			case 11: weather_situation = "Thunderstorm"; break;
			case 12: weather_situation = "Light sleet showers"; break;
			case 13: weather_situation = "Moderate sleet showers"; break;
			case 14: weather_situation = "Heavy sleet showers"; break;
			case 15: weather_situation = "Light snow showers"; break;
			case 16: weather_situation = "Moderate snow showers"; break;
			case 17: weather_situation = "Heavy snow showers"; break;
			case 18: weather_situation = "Light rain"; break;
			case 19: weather_situation = "Moderate rain"; break;
			case 20: weather_situation = "Heavy rain"; break;
			case 21: weather_situation = "Thunder"; break;
			case 22: weather_situation = "Light sleet"; break;
			case 23: weather_situation = "Moderate sleet"; break;
			case 24: weather_situation = "Heavy sleet"; break;
			case 25: weather_situation = "Light snowfall"; break;
			case 26: weather_situation = "Moderate snowfall"; break;
			case 27: weather_situation = "Heavy snowfall"; break;
			default: weather_situation = "No value found";
		};
		
		// switch from number to string
		precipitation_situation = "";
		switch (precipitation_category) {
			case 0: precipitation_situation = "No precipitation"; break;
			case 1: precipitation_situation = "Snow"; break;
			case 2: precipitation_situation = "Snow and rain"; break;
			case 3: precipitation_situation = "Rain"; break;
			case 4: precipitation_situation = "Drizzle"; break;
			case 5: precipitation_situation = "Freezing rain"; break;
			case 6: precipitation_situation = "Freezing drizzle"; break;
			default: precipitation_situation = "No value found";
		};
		
		// convert wind direction from degrees to heading
		var wind_direction_heading = getDirection(wind_direction);
		function getDirection(angle) {
			let directions = ['North', 'North-West', 'West', 'South-West', 'South', 'South-East', 'East', 'North-East'];
			return directions[Math.round(((angle %= 360) < 0 ? angle + 360 : angle) / 45) % 8];
		};

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
		this.setCapabilityValue('measure_weather_situation_cp', weather_situation);
		this.setCapabilityValue('measure_air_pressure_cp', air_pressure);
		this.setCapabilityValue('measure_air_temperature_cp', air_temperature);
		this.setCapabilityValue('horizontal_visibility_cp', horizontal_visibility);
		this.setCapabilityValue('wind_direction_cp', wind_direction);
		this.setCapabilityValue('measure_wind_speed_cp', wind_speed);
		this.setCapabilityValue('measure_relative_humidity_cp', relative_humidity);
		this.setCapabilityValue('measure_thunder_probability_cp', thunder_probability);
		this.setCapabilityValue('mean_value_of_total_cloud_cover_cp', mean_value_of_total_cloud_cover);
		this.setCapabilityValue('mean_value_of_low_level_cloud_cover_cp', mean_value_of_low_level_cloud_cover);
		this.setCapabilityValue('mean_value_of_medium_level_cloud_cover_cp', mean_value_of_medium_level_cloud_cover);
		this.setCapabilityValue('mean_value_of_high_level_cloud_cover_cp', mean_value_of_high_level_cloud_cover);
		this.setCapabilityValue('wind_gust_speed_cp', wind_gust_speed);
		this.setCapabilityValue('minimum_precipitation_intensity_cp', minimum_precipitation_intensity);
		this.setCapabilityValue('maximum_precipitation_intensity_cp', maximum_precipitation_intensity);
		this.setCapabilityValue('percent_of_precipitation_in_frozen_form_cp', percent_of_precipitation_in_frozen_form);
//		this.setCapabilityValue('precipitation_category_cp', precipitation_category);
		this.setCapabilityValue('mean_precipitation_intensity_cp', mean_precipitation_intensity);
		this.setCapabilityValue('median_precipitation_intensity_cp', median_precipitation_intensity);
//		this.setCapabilityValue('weather_symbol_cp', weather_symbol);
		this.setCapabilityValue('measure_precipitation_situation_cp', precipitation_situation);
		this.setCapabilityValue('measure_wind_direction_heading_cp', wind_direction_heading);
		this.setCapabilityValue('air_temperature_feels_like_cp', feelsLike);
		this.setCapabilityValue('forecast_for_cp', forecastFor);

	}; // end fetchSMHIData
  
	onDeleted() {
		let id = this.getData().id;
		this.log('device deleted:', id);

	}; // end onDeleted
	
	// flow triggers
	triggerWeatherSituationChangeFlow(device, tokens, state) {
	this._flowTriggerWeatherSituationChange
	  .trigger(device, tokens, state)
	  .then(this.log)
	  .catch(this.error)
	};
	triggerAirTemperatureChangeFlow(device, tokens, state) {
	this._flowTriggerAirTemperatureChange
	  .trigger(device, tokens, state)
	  .then(this.log)
	  .catch(this.error)
	};
	triggerWindSpeedChangeFlow(device, tokens, state) {
	this._flowTriggerWindSpeedChange
	  .trigger(device, tokens, state)
	  .then(this.log)
	  .catch(this.error)
	};
	triggerWindDirectionHeadingChangeFlow(device, tokens, state) {
	this._flowTriggerWindDirectionHeadingChange
	  .trigger(device, tokens, state)
	  .then(this.log)
	  .catch(this.error)
	};
	triggerRelativeHumidityChangeFlow(device, tokens, state) {
	this._flowTriggerRelativeHumidityChange
	  .trigger(device, tokens, state)
	  .then(this.log)
	  .catch(this.error)
	};
	triggerAirPressureChangeFlow(device, tokens, state) {
	this._flowTriggerAirPressureChange
	  .trigger(device, tokens, state)
	  .then(this.log)
	  .catch(this.error)
	};
	triggerThunderProbabilityChangeFlow(device, tokens, state) {
	this._flowTriggerThunderProbabilityChange
	  .trigger(device, tokens, state)
	  .then(this.log)
	  .catch(this.error)
	};

};

module.exports = WeatherDevice;