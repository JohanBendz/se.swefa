'use strict';

const { Driver } = require('homey');

class WeatherDriver extends Driver {

  async onInit() {
    this.log('SMHI weather driver initiated');

  }

  async onPairListDevices() {
    let devices = [
      {
        "name": "SMHI weather",
        "data": { "id": guid() },
        "settings": {
          "fcTime": "0",
          "latitude": "",
          "longitude": "",
          "usehomeylocation": true
        }
      }
    ];
    return devices;
  }

}

module.exports = WeatherDriver;

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}
