'use strict';

const Homey = require('homey');

class PollenNoDriver extends Homey.Driver {

	onInit() {
		this.log('SWEFA Pollen Norway driver initiated');
    
	}; // end onInit
	
	onPairListDevices(data, callback) {
		let devices = [
			{ "name": "Pollen Norway",
			  "data": {"id": guid()},
			  "settings": {
				  "pCity": '126'
			  }
			}
		];
		callback(null, devices);
	};

};

module.exports = PollenNoDriver;

function guid() {
	function s4() {
		return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
	}
	return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
};