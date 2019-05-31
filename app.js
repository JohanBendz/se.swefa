'use strict';
const Homey = require('homey');

class SWEFA extends Homey.App {

	async onInit() {

		console.log("Collecting geolocation coordinates for this Homey");
		const lat = (Homey.ManagerGeolocation.getLatitude()).toString().slice(0,9);
		const lng = (Homey.ManagerGeolocation.getLongitude()).toString().slice(0,9);
		console.log("latitude:",lat,", longitude:",lng,"\n");

		console.log("Defining SMHI API Url based on Homey goelocation");
		global.DataUrl1 = "https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point";
		global.SMHIdataUrl = DataUrl1+"/lon/"+lng+"/lat/"+lat+"/data.json";
		global.PollenUrl = "https://pollenkoll.se/wp-content/themes/pollenkoll/api/get_all.json";
		global.PollenNoUrl = "https://pollenkontroll.no/api/pollen-count?country=no";

		this.log('Swedish weather forecasting app successfully started.');

	};

}
module.exports = SWEFA;

// Weather and some pollen icons made by Freepik from https://www.flaticon.com/
