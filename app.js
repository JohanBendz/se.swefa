'use strict';
const Homey = require('homey');

class SWEFA extends Homey.App {

	async onInit() {


		global.PollenUrl = "https://pollenkoll.se/wp-content/themes/pollenkoll/api/get_all.json";
		global.PollenNoUrl = "https://pollenkontroll.no/api/pollen-count?country=no";

		this.log('Swedish weather forecasting app successfully started.');

	};

}
module.exports = SWEFA;

// Weather and some pollen icons made by Freepik from https://www.flaticon.com/
