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
let SMHIdataUrl = "";

class WeatherDevice extends Homey.Device {

	onInit() {
		this.log('SMHI weather device initiated');

		var settings = this.getSettings();
	
		// fetch SMHI data when app starts
		this.fetchSMHIData(settings)
		.catch( err => {
			this.error( err );
		});
		
		// fetch new SMHI data according to pollInterval settings (milliseconds)
		const pollInterval = 3600000;
		this._fetchSMHIData = setInterval(()=> {this.fetchSMHIData(settings);}, pollInterval);

		// register Flow triggers
		this._flowTriggerWeatherSituationChange = new Homey.FlowCardTriggerDevice('WeatherSituationChange').register();
		this._flowTriggerAirTemperatureChange = new Homey.FlowCardTriggerDevice('AirTemperatureChange').register();
		this._flowTriggerPrecipitationSituationChange = new Homey.FlowCardTriggerDevice('PrecipitationSituationChange').register();
		this._flowTriggerWindSpeedChange = new Homey.FlowCardTriggerDevice('WindSpeedChange').register();
		this._flowTriggerWindDirectionHeadingChange = new Homey.FlowCardTriggerDevice('WindDirectionHeadingChange').register();
		this._flowTriggerRelativeHumidityChange = new Homey.FlowCardTriggerDevice('RelativeHumidityChange').register();
		this._flowTriggerAirPressureChange = new Homey.FlowCardTriggerDevice('AirPressureChange').register();
		this._flowTriggerThunderProbabilityChange = new Homey.FlowCardTriggerDevice('ThunderProbabilityChange').register();
		this._flowTriggerMeanValueOfTotalCloudCoverChange = new Homey.FlowCardTriggerDevice('MeanValueOfTotalCloudCoverChange').register();
		
		// register Flow conditions
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
				rainsnow = "RainSnow";
			} else {
				rainsnow = "";
			}
			var result = (rainsnow == args.rainsnow)
			return Promise.resolve(result);
		});

		this.meanPrecipitationIntensityStatus = new Homey.FlowCardCondition('mean_precipitation_intensity_cp').register().registerRunListener((args, state) => {
			var result = (this.getCapabilityValue('mean_precipitation_intensity_cp') > args.mmh)
			return Promise.resolve(result);
		});

	}; // end onInit

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

	// on changed settings
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

		// define SMHI api endpoint
		let APIUrl = "https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point";
		
		if (settings.usehomeylocation == false) {
			// define full url if lat/long provided
			console.log("Defining SMHI API Url based on entered goelocation");
			SMHIdataUrl = APIUrl+"/lon/"+settings.longitude+"/lat/"+settings.latitude+"/data.json";
			console.log(SMHIdataUrl);
		} else {
			// define full url if lat/long is not provided
			console.log("Collecting geolocation coordinates for this Homey");
			const lat = (Homey.ManagerGeolocation.getLatitude()).toString().slice(0,9);
			const lng = (Homey.ManagerGeolocation.getLongitude()).toString().slice(0,9);
			console.log("Defining SMHI API Url based on Homey goelocation");
			SMHIdataUrl = APIUrl+"/lon/"+lng+"/lat/"+lat+"/data.json";
			console.log(SMHIdataUrl);
		};
		
		console.log("Fetching SMHI weather data");
		const response = await fetch(SMHIdataUrl)
		.catch( err => {
			this.error( err );
		});
		const data = await response.json();
		
		let device = this;

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
		let forecastFor = (fcTimeM+" "+fcTimeO.getDate()+" "+(fcTimeO.toLocaleTimeString().slice(0,-3)));

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
		this.setCapabilityValue('measure_wind_direction_cp', wind_direction);
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

		// updatingFlowTriggers
		if (this.getCapabilityValue('measure_weather_situation_cp') != weather_situation) {
			let state = {"measure_weather_situation_cp": weather_situation};
			let tokens = {"measure_weather_situation_cp": weather_situation};
			this._flowTriggerWeatherSituationChange.trigger(device, tokens, state).catch(this.error)
		};

		if (this.getCapabilityValue('measure_air_temperature_cp') != air_temperature) {
			let state = {"measure_air_temperature_cp": air_temperature};
			let tokens = {"measure_air_temperature_cp": air_temperature};
			this._flowTriggerAirTemperatureChange.trigger(device, tokens, state).catch(this.error)
		};

		if (this.getCapabilityValue('measure_wind_speed_cp') != wind_speed) {
			let state = {"measure_wind_speed_cp": wind_speed};
			let tokens = {"measure_wind_speed_cp": wind_speed};
			this._flowTriggerWindSpeedChange.trigger(device, tokens, state).catch(this.error)
		};

		if (this.getCapabilityValue('measure_wind_direction_heading_cp') != wind_direction_heading) {
			let state = {"measure_wind_direction_heading_cp": wind_direction_heading};
			let tokens = {"measure_wind_direction_heading_cp": wind_direction_heading};
			this._flowTriggerWindDirectionHeadingChange.trigger(device, tokens, state).catch(this.error)
		};

		if (this.getCapabilityValue('measure_relative_humidity_cp') != relative_humidity) {
			let state = {"measure_relative_humidity_cp": relative_humidity};
			let tokens = {"measure_relative_humidity_cp": relative_humidity};
			this._flowTriggerRelativeHumidityChange.trigger(device, tokens, state).catch(this.error)
		};

		if (this.getCapabilityValue('measure_air_pressure_cp') != air_pressure) {
			let state = {"measure_air_pressure_cp": air_pressure};
			let tokens = {"measure_air_pressure_cp": air_pressure};
			this._flowTriggerAirPressureChange.trigger(device, tokens, state).catch(this.error)
		};

		if (this.getCapabilityValue('measure_thunder_probability_cp') != thunder_probability) {
			let state = {"measure_thunder_probability_cp": thunder_probability};
			let tokens = {"measure_thunder_probability_cp": thunder_probability};
			this._flowTriggerThunderProbabilityChange.trigger(device, tokens, state).catch(this.error)
		};

		if (this.getCapabilityValue('measure_precipitation_situation_cp') != precipitation_situation) {
			let state = {"measure_precipitation_situation_cp": precipitation_situation};
			let tokens = {"measure_precipitation_situation_cp": precipitation_situation};
			this._flowTriggerPrecipitationSituationChange.trigger(device, tokens, state).catch(this.error)
		};
		
		if (this.getCapabilityValue('mean_value_of_total_cloud_cover_cp') != mean_value_of_total_cloud_cover) {
			let state = {"mean_value_of_total_cloud_cover_cp": mean_value_of_total_cloud_cover};
			let tokens = {"mean_value_of_total_cloud_cover_cp": mean_value_of_total_cloud_cover};
			this._flowTriggerMeanValueOfTotalCloudCoverChange.trigger(device, tokens, state).catch(this.error)
		};

	}; // end fetchSMHIData
  
	onDeleted() {
		let id = this.getData().id;
		this.log('device deleted:', id);

	}; // end onDeleted

};

module.exports = WeatherDevice;