'use strict';

const Homey = require('homey');

class PollenDriver extends Homey.Driver {

	onInit() {
		this.log('SWEFA pollen driver initiated');
    
	}; // end onInit
	
	onPairListDevices(data, callback) {
		let devices = [
			{ "name": "Pollen",
			  "data": {"id": guid()},
			  "settings": {
				  "pCity": '97'
			  }
			}
		];
		callback(null, devices);
	};

};

module.exports = PollenDriver;

function guid() {
	function s4() {
		return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
	}
	return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
};