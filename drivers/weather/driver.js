'use strict';

const Homey = require('homey');

class WeatherDriver extends Homey.Driver {

  onInit() {
	this.log('SMHI weather driver initiated');

  };

  onPairListDevices(data, callback) {
	let devices = [
	{ "name": "SMHI weather",
		"data": {"id": guid()},
		"settings": {
			"fcTime": "1"
		}
	}
	];
	callback(null, devices);
  };

};

module.exports = WeatherDriver;

function guid() {
  function s4() {
	return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
};