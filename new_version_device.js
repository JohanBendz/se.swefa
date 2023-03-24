'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');
const Feels = require('feels');

// defining variables
let air_pressure,
	air_temperature,
	horizontal_visibility,
	wind_direction,
	wind_speed,
	relative_humidity,
	thunder_probability,
	mean_value_of_total_cloud_cover,
	mean_value_of_low_level_cloud_cover,
	mean_value_of_medium_level_cloud_cover,
	mean_value_of_high_level_cloud_cover,
	wind_gust_speed,
	minimum_precipitation_intensity,
	maximum_precipitation_intensity,
	percent_of_precipitation_in_frozen_form,
	precipitation_category,
	mean_precipitation_intensity,
	median_precipitation_intensity,
	weather_symbol,
	weather_situation,
	precipitation_situation,
	SMHIdataUrl,
	longitude,
	latitude;

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
		this.log("register Flow triggers");
		const triggerNames = [
			'WeatherSituationChange',
			'AirTemperatureChange',
			'PrecipitationSituationChange',
			'WindSpeedChange',
			'WindDirectionHeadingChange',
			'RelativeHumidityChange',
			'AirPressureChange',
			'ThunderProbabilityChange',
			'MeanValueOfTotalCloudCoverChange'
		];
		const flowTriggerCards = {};
		triggerNames.forEach(name => {
			flowTriggerCards[name] = this.homey.flow.getDeviceTriggerCard(name);
		});
		
		// register Flow conditions
		const registerConditionCard = (cardName, callback) => {
			const card = this.homey.flow.getConditionCard(cardName);
			card.registerRunListener(async (args, state) => {
				try {
				const result = await callback(args);
				return Promise.resolve(result);
				} catch (err) {
				return Promise.reject(err);
				}
			});
		};
		  
		registerConditionCard('measure_weather_situation_cp', args => {
			return this.getCapabilityValue('measure_weather_situation_cp'.replace(/\s+/g, '')) === args.weather_situation_condition;
		});
		
		registerConditionCard('measure_air_temperature_cp', args => {
			return this.getCapabilityValue('measure_air_temperature_cp') > args.degree;
		});
		
		registerConditionCard('measure_wind_speed_cp', args => {
			return this.getCapabilityValue('measure_wind_speed_cp') > args.mps;
		});
		
		registerConditionCard('measure_wind_direction_heading_cp', args => {
			return this.getCapabilityValue('measure_wind_direction_heading_cp') === args.direction;
		});
		
		registerConditionCard('measure_wind_direction_cp', args => {
			return this.getCapabilityValue('measure_wind_direction_cp') > args.degree;
		});
		
		registerConditionCard('measure_relative_humidity_cp', args => {
			return this.getCapabilityValue('measure_relative_humidity_cp') > args.percent;
		});
		
		registerConditionCard('measure_air_pressure_cp', args => {
			return this.getCapabilityValue('measure_air_pressure_cp') > args.hpa;
		});
		
		registerConditionCard('measure_thunder_probability_cp', args => {
			return this.getCapabilityValue('measure_thunder_probability_cp') > args.percent;
		});
		
		registerConditionCard('mean_value_of_total_cloud_cover_cp', args => {
			return this.getCapabilityValue('mean_value_of_total_cloud_cover_cp') > args.octas;
		});
		
		registerConditionCard('mean_value_of_low_level_cloud_cover_cp', args => {
			return this.getCapabilityValue('mean_value_of_low_level_cloud_cover_cp') > args.octas;
		});
		
		registerConditionCard('mean_value_of_medium_level_cloud_cover_cp', args => {
			return this.getCapabilityValue('mean_value_of_medium_level_cloud_cover_cp') > args.octas;
		});
		
		registerConditionCard('mean_value_of_high_level_cloud_cover_cp', args => {
			return this.getCapabilityValue('mean_value_of_high_level_cloud_cover_cp') > args.octas;
		});
		
		registerConditionCard('wind_gust_speed_cp', args => {
			return this.getCapabilityValue('wind_gust_speed_cp') > args.mps;
		});
		
		registerConditionCard('horizontal_visibility_cp', args => {
			return this.getCapabilityValue('horizontal_visibility_cp') > args.km;
		});
		
		registerConditionCard('measure_precipitation_situation_cp', args => {
			const precipitation_category = this.getCapabilityValue('precipitation_category_cp');
			return precipitation_category !== 0;
		});
		
		registerConditionCard('mean_precipitation_intensity_cp', args => {
			return this.getCapabilityValue('mean_precipitation_intensity_cp') > args.mmh;
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
		if (!changedKeys || !changedKeys.length) {
		  return;
		}
	  
		const settingsChanged = {
		  fcTime: 'Offset',
		  latitude: 'Latitude',
		  longitude: 'Longitude',
		  usehomeylocation: 'Setting for use of Homey geolocation'
		};
	  
		for (const key of changedKeys) {
		  if (settingsChanged[key]) {
			this.log(`${settingsChanged[key]} changed from ${oldSettings[key]} to ${newSettings[key]}. Fetching new forecast.`);
		  }
		}
	  
		try {
		  await this.fetchSMHIData(newSettings);
		} catch (err) {
		  this.error(err);
		}
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
		
		if (settings.usehomeylocation) {
			// Use Homey's geolocation coordinates
			console.log("Collecting geolocation coordinates for this Homey");
			longitude = round(this.homey.geolocation.getLongitude(), 6).toFixed(6);
			latitude = round(this.homey.geolocation.getLatitude(), 6).toFixed(6);
		  } else {
			// Use provided latitude and longitude
			console.log("Defining SMHI API Url based on entered geolocation");
			longitude = round(settings.longitude, 6).toFixed(6);
			latitude = round(settings.latitude, 6).toFixed(6);
		  }
		  
		  SMHIdataUrl = APIUrl + "/lon/" + longitude + "/lat/" + latitude + "/data.json";
		  console.log(SMHIdataUrl);
		
		console.log("Fetching SMHI weather data");
		const response = await fetch(SMHIdataUrl)
		.catch( err => {
			this.error( err );
		});
		const data = await response.json();
		
		let device = this;

		// working with SMHI json data here
		const parameterNames = {
			msl: 'air_pressure',
			t: 'air_temperature',
			vis: 'horizontal_visibility',
			wd: 'wind_direction',
			ws: 'wind_speed',
			r: 'relative_humidity',
			tstm: 'thunder_probability',
			tcc_mean: 'mean_value_of_total_cloud_cover',
			lcc_mean: 'mean_value_of_low_level_cloud_cover',
			mcc_mean: 'mean_value_of_medium_level_cloud_cover',
			hcc_mean: 'mean_value_of_high_level_cloud_cover',
			gust: 'wind_gust_speed',
			pmin: 'minimum_precipitation_intensity',
			pmax: 'maximum_precipitation_intensity',
			spp: 'percent_of_precipitation_in_frozen_form',
			pcat: 'precipitation_category',
			pmean: 'mean_precipitation_intensity',
			pmedian: 'median_precipitation_intensity',
			Wsymb2: 'weather_symbol'
		};
		  
		for (const parameter of data.timeSeries[forecastTime].parameters) {
			const parameterName = parameter.name;
			if (parameterNames[parameterName]) {
				const variableName = parameterNames[parameterName];
				const value = Number(parameter.values);
				if (!isNaN(value)) {
					this[variableName] = value;
				}
			}
		};

		// setting forecastFor variable based on forecastTime value
		const fcTimeO = new Date(data.timeSeries[forecastTime]["validTime"]);
		const months = [
			this.homey.__("month1"),
			this.homey.__("month2"),
			this.homey.__("month3"),
			this.homey.__("month4"),
			this.homey.__("month5"),
			this.homey.__("month6"),
			this.homey.__("month7"),
			this.homey.__("month8"),
			this.homey.__("month9"),
			this.homey.__("month10"),
			this.homey.__("month11"),
			this.homey.__("month12"),
		];
		const fcTimeM = months[fcTimeO.getMonth()];
		const forecastFor = `${fcTimeM} ${fcTimeO.getDate()} ${fcTimeO.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
		
		// Weather situation definitions
		const weather_situations = {
			1: this.homey.__("weather_situation1"),
			2: this.homey.__("weather_situation2"),
			3: this.homey.__("weather_situation3"),
			4: this.homey.__("weather_situation4"),
			5: this.homey.__("weather_situation5"),
			6: this.homey.__("weather_situation6"),
			7: this.homey.__("weather_situation7"),
			8: this.homey.__("weather_situation8"),
			9: this.homey.__("weather_situation9"),
			10: this.homey.__("weather_situation10"),
			11: this.homey.__("weather_situation11"),
			12: this.homey.__("weather_situation12"),
			13: this.homey.__("weather_situation13"),
			14: this.homey.__("weather_situation14"),
			15: this.homey.__("weather_situation15"),
			16: this.homey.__("weather_situation16"),
			17: this.homey.__("weather_situation17"),
			18: this.homey.__("weather_situation18"),
			19: this.homey.__("weather_situation19"),
			20: this.homey.__("weather_situation20"),
			21: this.homey.__("weather_situation21"),
			22: this.homey.__("weather_situation22"),
			23: this.homey.__("weather_situation23"),
			24: this.homey.__("weather_situation24"),
			25: this.homey.__("weather_situation25"),
			26: this.homey.__("weather_situation26"),
			27: this.homey.__("weather_situation27"),
			default: this.homey.__("weather_situation")
		};
		weather_situation = weather_situations[weather_symbol] || weather_situations.default;

		// switch from number to string
		const precipitationSituations = {
			0: this.homey.__("precipitation_situation0"),
			1: this.homey.__("precipitation_situation1"),
			2: this.homey.__("precipitation_situation2"),
			3: this.homey.__("precipitation_situation3"),
			4: this.homey.__("precipitation_situation4"),
			5: this.homey.__("precipitation_situation5"),
			6: this.homey.__("precipitation_situation6"),
		};
		precipitation_situation = precipitationSituations[precipitation_category] || this.homey.__("precipitation_situation");

		// convert wind direction from degrees to heading
		const DIRECTIONS = {
			0: this.homey.__("direction1"),
			45: this.homey.__("direction2"),
			90: this.homey.__("direction3"),
			135: this.homey.__("direction4"),
			180: this.homey.__("direction5"),
			225: this.homey.__("direction6"),
			270: this.homey.__("direction7"),
			315: this.homey.__("direction8"),
		};
		
		var wind_direction_heading = getDirection(wind_direction);
		
		function getDirection(angle) {
			angle %= 360;
			if (angle < 0) {
				angle += 360;
			}
			const closest = Object.keys(DIRECTIONS).reduce((a, b) => {
				return Math.abs(b - angle) < Math.abs(a - angle) ? b : a;
			});
			return DIRECTIONS[closest];
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
		const capabilityData = {
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
		  
		  for (const [key, value] of Object.entries(capabilityData)) {
			this.setCapabilityValue(key, value);
		  }

		// updatingFlowTriggers
		function handleCapabilityChange(capability, value, flowTrigger) {
			if (this.getCapabilityValue(capability) !== value) {
			  let state = {[capability]: value};
			  let tokens = {[capability]: value};
			  flowTrigger.trigger(device, tokens, state).catch(this.error);
			}
		}		
		handleCapabilityChange('measure_weather_situation_cp', weather_situation, this._flowTriggerWeatherSituationChange);
		handleCapabilityChange('measure_air_temperature_cp', air_temperature, this._flowTriggerAirTemperatureChange);
		handleCapabilityChange('measure_wind_speed_cp', wind_speed, this._flowTriggerWindSpeedChange);
		handleCapabilityChange('measure_wind_direction_heading_cp', wind_direction_heading, this._flowTriggerWindDirectionHeadingChange);
		handleCapabilityChange('measure_relative_humidity_cp', relative_humidity, this._flowTriggerRelativeHumidityChange);
		handleCapabilityChange('measure_air_pressure_cp', air_pressure, this._flowTriggerAirPressureChange);
		handleCapabilityChange('measure_thunder_probability_cp', thunder_probability, this._flowTriggerThunderProbabilityChange);
		handleCapabilityChange('measure_precipitation_situation_cp', precipitation_situation, this._flowTriggerPrecipitationSituationChange);
		handleCapabilityChange('mean_value_of_total_cloud_cover_cp', mean_value_of_total_cloud_cover, this._flowTriggerMeanValueOfTotalCloudCoverChange);

	}; // end fetchSMHIData
  
	onDeleted() {
		let id = this.getData().id;
		this.log('device deleted:', id);

	}; // end onDeleted

};

module.exports = WeatherDevice;