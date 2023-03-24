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
let SMHIdataUrl = "";
let longitude = "";
let latitude = "";

class WeatherDevice extends Homey.Device {

	async onInit() {
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
 		this._flowTriggerWeatherSituationChange = this.homey.flow.getDeviceTriggerCard('WeatherSituationChange');
		this._flowTriggerAirTemperatureChange = this.homey.flow.getDeviceTriggerCard('AirTemperatureChange');
		this._flowTriggerPrecipitationSituationChange = this.homey.flow.getDeviceTriggerCard('PrecipitationSituationChange');
		this._flowTriggerWindSpeedChange = this.homey.flow.getDeviceTriggerCard('WindSpeedChange');
		this._flowTriggerWindDirectionHeadingChange = this.homey.flow.getDeviceTriggerCard('WindDirectionHeadingChange');
		this._flowTriggerRelativeHumidityChange = this.homey.flow.getDeviceTriggerCard('RelativeHumidityChange');
		this._flowTriggerAirPressureChange = this.homey.flow.getDeviceTriggerCard('AirPressureChange');
		this._flowTriggerThunderProbabilityChange = this.homey.flow.getDeviceTriggerCard('ThunderProbabilityChange');
		this._flowTriggerMeanValueOfTotalCloudCoverChange = this.homey.flow.getDeviceTriggerCard('MeanValueOfTotalCloudCoverChange');
		
		// register Flow conditions
 		this.weatherSituationStatus = this.homey.flow.getConditionCard('measure_weather_situation_cp').registerRunListener(async (args, state) => {
			var result = (this.getCapabilityValue('measure_weather_situation_cp'.replace(/\s+/g, '')) == args.weather_situation_condition)
			return Promise.resolve(result);
		});

		this.airTemperatureStatus = this.homey.flow.getConditionCard('measure_air_temperature_cp').registerRunListener(async (args, state) => {
			var result = (this.getCapabilityValue('measure_air_temperature_cp') > args.degree)
			return Promise.resolve(result);
		});

		this.windSpeedStatus = this.homey.flow.getConditionCard('measure_wind_speed_cp').registerRunListener(async (args, state) => {
			var result = (this.getCapabilityValue('measure_wind_speed_cp') > args.mps)
			return Promise.resolve(result);
		});

		this.windDirectionHeadingStatus = this.homey.flow.getConditionCard('measure_wind_direction_heading_cp').registerRunListener(async (args, state) => {
			var result = (this.getCapabilityValue('measure_wind_direction_heading_cp') == args.direction)
			return Promise.resolve(result);
		});

		this.windDirectionStatus = this.homey.flow.getConditionCard('measure_wind_direction_cp').registerRunListener(async (args, state) => {
			var result = (this.getCapabilityValue('measure_wind_direction_cp') > args.degree)
			return Promise.resolve(result);
		});

		this.relativeHumidityStatus = this.homey.flow.getConditionCard('measure_relative_humidity_cp').registerRunListener(async (args, state) => {
			var result = (this.getCapabilityValue('measure_relative_humidity_cp') > args.percent)
			return Promise.resolve(result);
		});

		this.airPressureStatus = this.homey.flow.getConditionCard('measure_air_pressure_cp').registerRunListener(async (args, state) => {
			var result = (this.getCapabilityValue('measure_air_pressure_cp') > args.hpa)
			return Promise.resolve(result);
		});

		this.thunderProbabilityStatus = this.homey.flow.getConditionCard('measure_thunder_probability_cp').registerRunListener(async (args, state) => {
			var result = (this.getCapabilityValue('measure_thunder_probability_cp') > args.percent)
			return Promise.resolve(result);
		});

		this.meanValueOfTotalCloudCoverStatus = this.homey.flow.getConditionCard('mean_value_of_total_cloud_cover_cp').registerRunListener(async (args, state) => {
			var result = (this.getCapabilityValue('mean_value_of_total_cloud_cover_cp') > args.octas)
			return Promise.resolve(result);
		});

		this.meanValueOfLowLevelCloudCoverStatus = this.homey.flow.getConditionCard('mean_value_of_low_level_cloud_cover_cp').registerRunListener(async (args, state) => {
			var result = (this.getCapabilityValue('mean_value_of_low_level_cloud_cover_cp') > args.octas)
			return Promise.resolve(result);
		});

		this.meanValueOfMediumLevelCloudCoverStatus = this.homey.flow.getConditionCard('mean_value_of_medium_level_cloud_cover_cp').registerRunListener(async (args, state) => {
			var result = (this.getCapabilityValue('mean_value_of_medium_level_cloud_cover_cp') > args.octas)
			return Promise.resolve(result);
		});

		this.meanValueOfHighLevelCloudCoverStatus = this.homey.flow.getConditionCard('mean_value_of_high_level_cloud_cover_cp').registerRunListener(async (args, state) => {
			var result = (this.getCapabilityValue('mean_value_of_high_level_cloud_cover_cp') > args.octas)
			return Promise.resolve(result);
		});

		this.windGustSpeedStatus = this.homey.flow.getConditionCard('wind_gust_speed_cp').registerRunListener(async (args, state) => {
			var result = (this.getCapabilityValue('wind_gust_speed_cp') > args.mps)
			return Promise.resolve(result);
		});

		this.horizontalVisibilityStatus = this.homey.flow.getConditionCard('horizontal_visibility_cp').registerRunListener(async (args, state) => {
			var result = (this.getCapabilityValue('horizontal_visibility_cp') > args.km)
			return Promise.resolve(result);
		});

		this.precipitationSituationStatus = this.homey.flow.getConditionCard('measure_precipitation_situation_cp').registerRunListener(async (args, state) => {
			if (precipitation_category !== 0){
				var result = true;
			} else {
				var result = false;
			}
			return Promise.resolve(result);
		});

		this.meanPrecipitationIntensityStatus = this.homey.flow.getConditionCard('mean_precipitation_intensity_cp').registerRunListener(async (args, state) => {
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

		function round(value, precision) {
			var multiplier = Math.pow(10, precision || 0);
			return Math.round(value * multiplier) / multiplier;
		}

		// define SMHI api endpoint
		let APIUrl = "https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point";
		
 		if (settings.usehomeylocation == false) {
			// define full url if lat/long provided
			console.log("Defining SMHI API Url based on entered goelocation");
			let long = round(settings.longitude, 6).toFixed(6);
			let lat = round(settings.latitude, 6).toFixed(6);
			SMHIdataUrl = APIUrl+"/lon/"+long+"/lat/"+lat+"/data.json";
			console.log(SMHIdataUrl);
		} else {
			// define full url if lat/long is not provided
			console.log("Collecting geolocation coordinates for this Homey");
			let long = round(this.homey.geolocation.getLongitude(), 6).toFixed(6);
			let lat = round(this.homey.geolocation.getLatitude(), 6).toFixed(6);
			// let long = round(Homey.ManagerGeolocation.getLongitude(), 6).toFixed(6);
			// let lat = round(Homey.ManagerGeolocation.getLatitude(), 6).toFixed(6);
			console.log("Defining SMHI API Url based on Homey goelocation");
			SMHIdataUrl = APIUrl+"/lon/"+long+"/lat/"+lat+"/data.json";
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
		month[0] = this.homey.__("month1");
		month[1] = this.homey.__("month2");
		month[2] = this.homey.__("month3");
		month[3] = this.homey.__("month4");
		month[4] = this.homey.__("month5");
		month[5] = this.homey.__("month6");
		month[6] = this.homey.__("month7");
		month[7] = this.homey.__("month8");
		month[8] = this.homey.__("month9");
		month[9] = this.homey.__("month10");
		month[10] = this.homey.__("month11");
		month[11] = this.homey.__("month12");
		var fcTimeM = month[fcTimeO.getMonth()];
		let forecastFor = (fcTimeM+" "+fcTimeO.getDate()+" "+(fcTimeO.toTimeString().slice(0,5)));
		
		// Weather situation definitions
 		weather_situation = "";
		switch (weather_symbol) {
			case 1: weather_situation = this.homey.__("weather_situation1"); break;
			case 2: weather_situation = this.homey.__("weather_situation2"); break;
			case 3: weather_situation = this.homey.__("weather_situation3"); break;
			case 4: weather_situation = this.homey.__("weather_situation4"); break;
			case 5: weather_situation = this.homey.__("weather_situation5"); break;
			case 6: weather_situation = this.homey.__("weather_situation6"); break;
			case 7: weather_situation = this.homey.__("weather_situation7"); break;
			case 8: weather_situation = this.homey.__("weather_situation8"); break;
			case 9: weather_situation = this.homey.__("weather_situation9"); break;
			case 10: weather_situation = this.homey.__("weather_situation10"); break;
			case 11: weather_situation = this.homey.__("weather_situation11"); break;
			case 12: weather_situation = this.homey.__("weather_situation12"); break;
			case 13: weather_situation = this.homey.__("weather_situation13"); break;
			case 14: weather_situation = this.homey.__("weather_situation14"); break;
			case 15: weather_situation = this.homey.__("weather_situation15"); break;
			case 16: weather_situation = this.homey.__("weather_situation16"); break;
			case 17: weather_situation = this.homey.__("weather_situation17"); break;
			case 18: weather_situation = this.homey.__("weather_situation18"); break;
			case 19: weather_situation = this.homey.__("weather_situation19"); break;
			case 20: weather_situation = this.homey.__("weather_situation20"); break;
			case 21: weather_situation = this.homey.__("weather_situation21"); break;
			case 22: weather_situation = this.homey.__("weather_situation22"); break;
			case 23: weather_situation = this.homey.__("weather_situation23"); break;
			case 24: weather_situation = this.homey.__("weather_situation24"); break;
			case 25: weather_situation = this.homey.__("weather_situation25"); break;
			case 26: weather_situation = this.homey.__("weather_situation26"); break;
			case 27: weather_situation = this.homey.__("weather_situation27"); break;
			default: weather_situation = this.homey.__("weather_situation");
		};

		// switch from number to string
		precipitation_situation = "";
		switch (precipitation_category) {
			case 0: precipitation_situation = this.homey.__("precipitation_situation0"); break;
			case 1: precipitation_situation = this.homey.__("precipitation_situation1"); break;
			case 2: precipitation_situation = this.homey.__("precipitation_situation2"); break;
			case 3: precipitation_situation = this.homey.__("precipitation_situation3"); break;
			case 4: precipitation_situation = this.homey.__("precipitation_situation4"); break;
			case 5: precipitation_situation = this.homey.__("precipitation_situation5"); break;
			case 6: precipitation_situation = this.homey.__("precipitation_situation6"); break;
			default: precipitation_situation = this.homey.__("precipitation_situation");
		};
		
		// convert wind direction from degrees to heading
 		var wind_direction_heading = getDirection(wind_direction);
		function getDirection(angle) {
		//	let directions = ['North', 'North-West', 'West', 'South-West', 'South', 'South-East', 'East', 'North-East'];
		let directions = [this.homey.__("direction1"), this.homey.__("direction2"), this.homey.__("direction3"), this.homey.__("direction4"), this.homey.__("direction5"), this.homey.__("direction6"), this.homey.__("direction7"), this.homey.__("direction8")];
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