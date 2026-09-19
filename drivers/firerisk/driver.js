'use strict';

const { Driver } = require('homey');

class FireRiskDriver extends Driver {
  async onInit() {
    this.log('SMHI fire-risk driver initiated');
    this.registerFlowTriggers();
    this.registerFlowConditions();
  }

  registerFlowTriggers() {
    this.homey.flow
      .getDeviceTriggerCard('ForestFireRiskChangedTo')
      .registerRunListener(async ({ risk_level }, state) => {
        return state?.toCode === Number(risk_level);
      });

    this.homey.flow
      .getDeviceTriggerCard('GrassFireRiskChangedTo')
      .registerRunListener(async ({ risk_level }, state) => {
        return state?.toCode === Number(risk_level);
      });

    this.homey.flow
      .getDeviceTriggerCard('ForestDrynessChangedTo')
      .registerRunListener(async ({ dryness_level }, state) => {
        return state?.toCode === Number(dryness_level);
      });
  }

  registerFlowConditions() {
    this.homey.flow
      .getConditionCard('forest_fire_risk_at_least')
      .registerRunListener(async ({ device, risk_level }) => {
        return device.isForestFireRiskAtLeast(risk_level);
      });

    this.homey.flow
      .getConditionCard('grass_fire_risk_at_least')
      .registerRunListener(async ({ device, risk_level }) => {
        return device.isGrassFireRiskAtLeast(risk_level);
      });

    this.homey.flow
      .getConditionCard('forest_dryness_at_least')
      .registerRunListener(async ({ device, dryness_level }) => {
        return device.isForestDrynessAtLeast(dryness_level);
      });
  }

  async onPairListDevices() {
    return [{
      name: 'SMHI Fire Risk',
      data: { id: guid() },
      settings: {
        forecastDay: '0',
        latitude: '',
        longitude: '',
        usehomeylocation: true,
      },
    }];
  }
}

module.exports = FireRiskDriver;

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }

  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}
