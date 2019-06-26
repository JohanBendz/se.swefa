'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');

// defining variables
let burotpollen = [];
let bjorkpollen = [];
let gresspollen = [];
let hasselpollen = [];
let salixpollen = [];
let orpollen = [];

//Set Cron parameters
const cronName = "pollenNoCronTask"
const cronInterval = "30 0,5,11,19 * * *"; // 30 0,5,11,19 * * * = every day, 0:30, 5:30, 11:30 and 19:30.

class PollenNoDevice extends Homey.Device {

  async onInit() {
		this.log('SWEFA Pollen Norway device initiated');

		var settings = this.getSettings();

		//Register crontask
		Homey.ManagerCron.getTask(cronName)
			.then(task => {
				this.log("This crontask is already registred: " + cronName);
				task.on('run', () => this.fetchPollenData(settings));
			})
			.catch(err => {
				if (err.code == 404) {
					this.log("This crontask has not been registered yet, registering task: " + cronName);
					Homey.ManagerCron.registerTask(cronName, cronInterval, null)
					.then(task => {
						task.on('run', () => this.fetchPollenData(settings));
					})
					.catch(err => {
						this.log(`problem with registering crontask: ${err.message}`);
					});
				} else {
					this.log(`other cron error: ${err.message}`);
				}
			});

		// register Flow triggers
		this._flowTriggerburot_pollen_0_no_Change = new Homey.FlowCardTriggerDevice('burot_pollen_0_no_Change').register();
		this._flowTriggerburot_pollen_1_no_Change = new Homey.FlowCardTriggerDevice('burot_pollen_1_no_Change').register();

		this._flowTriggerbjork_pollen_0_no_Change = new Homey.FlowCardTriggerDevice('bjork_pollen_0_no_Change').register();
		this._flowTriggerbjork_pollen_1_no_Change = new Homey.FlowCardTriggerDevice('bjork_pollen_1_no_Change').register();

		this._flowTriggergress_pollen_0_no_Change = new Homey.FlowCardTriggerDevice('gress_pollen_0_no_Change').register();
		this._flowTriggergress_pollen_1_no_Change = new Homey.FlowCardTriggerDevice('gress_pollen_1_no_Change').register();

		this._flowTriggerhassel_pollen_0_no_Change = new Homey.FlowCardTriggerDevice('hassel_pollen_0_no_Change').register();
		this._flowTriggerhassel_pollen_1_no_Change = new Homey.FlowCardTriggerDevice('hassel_pollen_1_no_Change').register();
		
		this._flowTriggersalix_pollen_0_no_Change = new Homey.FlowCardTriggerDevice('salix_pollen_0_no_Change').register();
		this._flowTriggersalix_pollen_1_no_Change = new Homey.FlowCardTriggerDevice('salix_pollen_1_no_Change').register();
		
		this._flowTriggeror_pollen_0_no_Change = new Homey.FlowCardTriggerDevice('or_pollen_0_no_Change').register();
		this._flowTriggeror_pollen_1_no_Change = new Homey.FlowCardTriggerDevice('or_pollen_1_no_Change').register();
		
		// register Flow conditions

		this.burotPollen0Status = new Homey.FlowCardCondition('burot_pollen_0_no').register().registerRunListener((args, state) => {
			var result = (burotpollen[3] > args.spredning);
			return Promise.resolve(result);
		});

		this.burotPollen1Status = new Homey.FlowCardCondition('burot_pollen_1_no').register().registerRunListener((args, state) => {
			var result = (burotpollen[4] > args.spredning);
			return Promise.resolve(result);
		});

		this.bjorkPollen0Status = new Homey.FlowCardCondition('bjork_pollen_0_no').register().registerRunListener((args, state) => {
			var result = (bjorkpollen[3] > args.spredning);
			return Promise.resolve(result);
		});

		this.bjorkPollen1Status = new Homey.FlowCardCondition('bjork_pollen_1_no').register().registerRunListener((args, state) => {
			var result = (bjorkpollen[4] > args.spredning);
			return Promise.resolve(result);
		});

		this.gressPollen0Status = new Homey.FlowCardCondition('gress_pollen_0_no').register().registerRunListener((args, state) => {
			var result = (gresspollen[3] > args.spredning);
			return Promise.resolve(result);
		});

		this.gressPollen1Status = new Homey.FlowCardCondition('gress_pollen_1_no').register().registerRunListener((args, state) => {
			var result = (gresspollen[4] > args.spredning);
			return Promise.resolve(result);
		});

		this.hasselPollen0Status = new Homey.FlowCardCondition('hassel_pollen_0_no').register().registerRunListener((args, state) => {
			var result = (hasselpollen[3] > args.spredning);
			return Promise.resolve(result);
		});

		this.hasselPollen1Status = new Homey.FlowCardCondition('hassel_pollen_1_no').register().registerRunListener((args, state) => {
			var result = (hasselpollen[4] > args.spredning);
			return Promise.resolve(result);
		});

		this.salixPollen0Status = new Homey.FlowCardCondition('salix_pollen_0_no').register().registerRunListener((args, state) => {
			var result = (salixpollen[3] > args.spredning); 
			return Promise.resolve(result);
		});

		this.salixPollen1Status = new Homey.FlowCardCondition('salix_pollen_1_no').register().registerRunListener((args, state) => {
			var result = (salixpollen[4] > args.spredning);
			return Promise.resolve(result);
		});

		this.orPollen0Status = new Homey.FlowCardCondition('or_pollen_0_no').register().registerRunListener((args, state) => {
			var result = (orpollen[3] > args.spredning);
			return Promise.resolve(result);
		});

		this.orPollen1Status = new Homey.FlowCardCondition('or_pollen_1_no').register().registerRunListener((args, state) => {
			var result = (orpollen[4] > args.spredning);
			return Promise.resolve(result);
		});

  }; // end onInit

  onAdded() {
    let id = this.getData().id;
	this.log('device added: ', id);

	var settings = this.getSettings();

	// working with pollen data
	this.fetchPollenData(settings)
	.catch( err => {
		this.error( err );
	});

	}; // end onAdded

  // on changed city settings
  async onSettings(oldSettings, newSettings, changedKeys) {
	if (changedKeys && changedKeys.length) {

		for (var i=0; i<changedKeys.length;i++){

			if (changedKeys == 'pCity') {
				this.log('Settings changed for selected pollen city from ' + oldSettings.pCity + ' to ' + newSettings.pCity + '. Fetching pollen levels for new city.');
			}

		}

		this.fetchPollenData(newSettings)
		.catch( err => {
			this.error( err );
		});

	}

  }; // end onSettings
	
  // working with Pollen json data here
  async fetchPollenData(settings){
		console.log("Fetching Pollen data");
		const res = await fetch(PollenNoUrl)
		.catch( err => {
			this.error( err );
		});
		const pollenData = await res.json();

		let pollenCity = parseInt(settings.pCity);
		let device = this;

		// populating pollen variables
		for (var i=0; i < pollenData.cities.length; i++){
			if (pollenData.cities[i]["id"] == pollenCity){

				for (var x=0; x < pollenData.cities[i].days[0].allergens.length; x++ ) {
					if (pollenData.cities[i].days[0].allergens[x]["type"] == "Burot"){
						burotpollen[0] = (pollenData.cities[i].days[0].allergens[x]["level_description"]);
						burotpollen[1] = (pollenData.cities[i].days[1].allergens[x]["level_description"]);
						burotpollen[2] = (pollenData.cities[i].days[0].allergens[x]["level_number"]);
						burotpollen[3] = (pollenData.cities[i].days[1].allergens[x]["level_number"]);
					}
					if (pollenData.cities[i].days[0].allergens[x]["type"] == "Bjørk"){
						bjorkpollen[0] = (pollenData.cities[i].days[0].allergens[x]["level_description"]);
						bjorkpollen[1] = (pollenData.cities[i].days[1].allergens[x]["level_description"]);
						bjorkpollen[2] = (pollenData.cities[i].days[0].allergens[x]["level_number"]);
						bjorkpollen[3] = (pollenData.cities[i].days[1].allergens[x]["level_number"]);
					}
					if (pollenData.cities[i].days[0].allergens[x]["type"] == "Gress"){
						gresspollen[0] = (pollenData.cities[i].days[0].allergens[x]["level_description"]);
						gresspollen[1] = (pollenData.cities[i].days[1].allergens[x]["level_description"]);
						gresspollen[2] = (pollenData.cities[i].days[0].allergens[x]["level_number"]);
						gresspollen[3] = (pollenData.cities[i].days[1].allergens[x]["level_number"]);
					}
					if (pollenData.cities[i].days[0].allergens[x]["type"] == "Hassel"){
						hasselpollen[0] = (pollenData.cities[i].days[0].allergens[x]["level_description"]);
						hasselpollen[1] = (pollenData.cities[i].days[1].allergens[x]["level_description"]);
						hasselpollen[2] = (pollenData.cities[i].days[0].allergens[x]["level_number"]);
						hasselpollen[3] = (pollenData.cities[i].days[1].allergens[x]["level_number"]);
					}
					if (pollenData.cities[i].days[0].allergens[x]["type"] == "Or"){
						orpollen[0] = (pollenData.cities[i].days[0].allergens[x]["level_description"]);
						orpollen[1] = (pollenData.cities[i].days[1].allergens[x]["level_description"]);
						orpollen[2] = (pollenData.cities[i].days[0].allergens[x]["level_number"]);
						orpollen[3] = (pollenData.cities[i].days[1].allergens[x]["level_number"]);
					}
					if (pollenData.cities[i].days[0].allergens[x]["type"] == "Salix"){
						salixpollen[0] = (pollenData.cities[i].days[0].allergens[x]["level_description"]);
						salixpollen[1] = (pollenData.cities[i].days[1].allergens[x]["level_description"]);
						salixpollen[2] = (pollenData.cities[i].days[0].allergens[x]["level_number"]);
						salixpollen[3] = (pollenData.cities[i].days[1].allergens[x]["level_number"]);
					}
				}
			break;
			}
		}

		// setting device capabilities
		this.setCapabilityValue('bjork_pollen_0_no', bjorkpollen[0]);
		this.setCapabilityValue('burot_pollen_0_no', burotpollen[0]);
		this.setCapabilityValue('gress_pollen_0_no', gresspollen[0]);
		this.setCapabilityValue('hassel_pollen_0_no', hasselpollen[0]);
		this.setCapabilityValue('or_pollen_0_no', orpollen[0]);
		this.setCapabilityValue('salix_pollen_0_no', salixpollen[0]);

		this.setCapabilityValue('bjork_pollen_1_no', bjorkpollen[1]);
		this.setCapabilityValue('burot_pollen_1_no', burotpollen[1]);
		this.setCapabilityValue('gress_pollen_1_no', gresspollen[1]);
		this.setCapabilityValue('hassel_pollen_1_no', hasselpollen[1]);
		this.setCapabilityValue('or_pollen_1_no', orpollen[1]);
		this.setCapabilityValue('salix_pollen_1_no', salixpollen[1]);

		// updatingFlowTriggers
		if (this.getCapabilityValue('bjork_pollen_0_no') != bjorkpollen[0]) {
			let state = {"bjork_pollen_0_no": bjorkpollen[0]};
			let tokens = {"bjork_pollen_0_no": bjorkpollen[0]};
			this._flowTriggerbjork_pollen_0_no_Change.trigger(device, tokens, state).catch(this.error)
		};
		if (this.getCapabilityValue('bjork_pollen_1_no') != bjorkpollen[1]) {
			let state = {"bjork_pollen_1_no": bjorkpollen[1]};
			let tokens = {"bjork_pollen_1_no": bjorkpollen[1]};
			this._flowTriggerbjork_pollen_1_no_Change.trigger(device, tokens, state).catch(this.error)
		};

		if (this.getCapabilityValue('burot_pollen_0_no') != burotpollen[0]) {
			let state = {"burot_pollen_0_no": burotpollen[0]};
			let tokens = {"burot_pollen_0_no": burotpollen[0]};
			this._flowTriggerburot_pollen_0_no_Change.trigger(device, tokens, state).catch(this.error)
		};
		if (this.getCapabilityValue('burot_pollen_1_no') != burotpollen[1]) {
			let state = {"burot_pollen_1_no": burotpollen[1]};
			let tokens = {"burot_pollen_1_no": burotpollen[1]};
			this._flowTriggerburot_pollen_1_no_Change.trigger(device, tokens, state).catch(this.error)
		};

		if (this.getCapabilityValue('gress_pollen_0_no') != gresspollen[0]) {
			let state = {"gress_pollen_0_no": gresspollen[0]};
			let tokens = {"gress_pollen_0_no": gresspollen[0]};
			this._flowTriggergress_pollen_0_no_Change.trigger(device, tokens, state).catch(this.error)
		};
		if (this.getCapabilityValue('gress_pollen_1_no') != gresspollen[1]) {
			let state = {"gress_pollen_1_no": gresspollen[1]};
			let tokens = {"gress_pollen_1_no": gresspollen[1]};
			this._flowTriggergress_pollen_1_no_Change.trigger(device, tokens, state).catch(this.error)
		};

		if (this.getCapabilityValue('hassel_pollen_0_no') != hasselpollen[0]) {
			let state = {"hassel_pollen_0_no": hasselpollen[0]};
			let tokens = {"hassel_pollen_0_no": hasselpollen[0]};
			this._flowTriggerhassel_pollen_0_no_Change.trigger(device, tokens, state).catch(this.error)
		};
		if (this.getCapabilityValue('hassel_pollen_1_no') != hasselpollen[1]) {
			let state = {"hassel_pollen_1_no": hasselpollen[1]};
			let tokens = {"hassel_pollen_1_no": hasselpollen[1]};
			this._flowTriggerhassel_pollen_1_no_Change.trigger(device, tokens, state).catch(this.error)
		};

		if (this.getCapabilityValue('or_pollen_0_no') != orpollen[0]) {
			let state = {"or_pollen_0_no": orpollen[0]};
			let tokens = {"or_pollen_0_no": orpollen[0]};
			this._flowTriggeror_pollen_0_no_Change.trigger(device, tokens, state).catch(this.error)
		};
		if (this.getCapabilityValue('or_pollen_1_no') != orpollen[1]) {
			let state = {"or_pollen_1_no": orpollen[1]};
			let tokens = {"or_pollen_1_no": orpollen[1]};
			this._flowTriggeror_pollen_1_no_Change.trigger(device, tokens, state).catch(this.error)
		};

		if (this.getCapabilityValue('salix_pollen_0_no') != salixpollen[0]) {
			let state = {"salix_pollen_0_no": salixpollen[0]};
			let tokens = {"salix_pollen_0_no": salixpollen[0]};
			this._flowTriggersalix_pollen_0_no_Change.trigger(device, tokens, state).catch(this.error)
		};
		if (this.getCapabilityValue('salix_pollen_1_no') != salixpollen[1]) {
			let state = {"salix_pollen_1_no": salixpollen[1]};
			let tokens = {"salix_pollen_1_no": salixpollen[1]};
			this._flowTriggersalix_pollen_1_no_Change.trigger(device, tokens, state).catch(this.error)
		};

  }; // end fetchPollenData

  onDeleted() {
    let id = this.getData().id;
		this.log('device deleted:', id);
	
		//Unregister crontask on unload
		Homey
		.on('unload', () => {
			Homey.ManagerCron.unregisterTask(cronName);
		});

	}; // end onDeleted

};

module.exports = PollenNoDevice;