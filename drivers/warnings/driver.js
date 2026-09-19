'use strict';

const { Driver } = require('homey');
const { getLevelRank } = require('../../lib/warning-utils');

class WarningDriver extends Driver {
  async onInit() {
    this.log('SMHI weather warning driver initiated');
    this.registerFlowConditions();
  }

  registerFlowConditions() {
    this.homey.flow
      .getConditionCard('smhi_warning_present')
      .registerRunListener(async ({ device }) => device.hasWarning());

    this.homey.flow
      .getConditionCard('smhi_warning_active_now')
      .registerRunListener(async ({ device }) => device.hasActiveWarning());

    this.homey.flow
      .getConditionCard('smhi_warning_level_at_least')
      .registerRunListener(async ({ device, level }) => {
        return device.getHighestWarningRank() >= getLevelRank(level);
      });
  }

  async onPairListDevices() {
    return [
      {
        name: 'SMHI Weather Warnings',
        data: { id: guid() },
        settings: {
          latitude: '',
          longitude: '',
          usehomeylocation: true,
        },
      },
    ];
  }
}

module.exports = WarningDriver;

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }

  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}
