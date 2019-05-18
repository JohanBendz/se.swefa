'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');

// defining variables
let alpollen = [];
let almpollen = [];
let ambrosiapollen = [];
let bjorkpollen = [];
let bokpollen = [];
let ekpollen = [];
let graspollen = [];
let grabopollen = [];
let hasselpollen = [];
let salgvidepollen = [];


let pollenCity = "";
let settings = "";

//Set Cron parameters
const cronName = "pollenCronTask"
const cronInterval = "30 0,5,11,19 * * *"; // 30 0,5,11,19 * * * = every day, 0:30, 5:30, 11:30 and 19:30.

class PollenDevice extends Homey.Device {

  async onInit() {
		this.log('SWEFA pollen device initiated');

		// get current settings
		settings = this.getSettings();
		pollenCity = parseInt(settings.pCity);

		// if settings are blank default to this (97=Stockholm)
		if(!pollenCity) {
			 pollenCity = 97;
		}

		//Register crontask
		Homey.ManagerCron.getTask(cronName)
			.then(task => {
				this.log("This crontask is already registred: " + cronName);
				task.on('run', () => this.GetData());
			})
			.catch(err => {
				if (err.code == 404) {
					this.log("This crontask has not been registered yet, registering task: " + cronName);
					Homey.ManagerCron.registerTask(cronName, cronInterval, null)
					.then(task => {
						task.on('run', () => this.fetchPollenData());
					})
					.catch(err => {
						this.log(`problem with registering crontask: ${err.message}`);
					});
					} else {
						this.log(`other cron error: ${err.message}`);
					}
				});
		
		//Unregister crontask on unload
		Homey
			.on('unload', () => {
				Homey.ManagerCron.unregisterTask(cronName);
			});

		// register Flow triggers
		this._flowTriggeral_pollen_0_Change = new Homey.FlowCardTriggerDevice('al_pollen_0_Change').register();
		this._flowTriggeral_pollen_1_Change = new Homey.FlowCardTriggerDevice('al_pollen_1_Change').register();
		this._flowTriggeral_pollen_2_Change = new Homey.FlowCardTriggerDevice('al_pollen_2_Change').register();

		this._flowTriggeralm_pollen_0_Change = new Homey.FlowCardTriggerDevice('alm_pollen_0_Change').register();
		this._flowTriggeralm_pollen_1_Change = new Homey.FlowCardTriggerDevice('alm_pollen_1_Change').register();
		this._flowTriggeralm_pollen_2_Change = new Homey.FlowCardTriggerDevice('alm_pollen_2_Change').register();
	
		this._flowTriggerambrosia_pollen_0_Change = new Homey.FlowCardTriggerDevice('ambrosia_pollen_0_Change').register();
		this._flowTriggerambrosia_pollen_1_Change = new Homey.FlowCardTriggerDevice('ambrosia_pollen_1_Change').register();
		this._flowTriggerambrosia_pollen_2_Change = new Homey.FlowCardTriggerDevice('ambrosia_pollen_2_Change').register();

		this._flowTriggerbjork_pollen_0_Change = new Homey.FlowCardTriggerDevice('bjork_pollen_0_Change').register();
		this._flowTriggerbjork_pollen_1_Change = new Homey.FlowCardTriggerDevice('bjork_pollen_1_Change').register();
		this._flowTriggerbjork_pollen_2_Change = new Homey.FlowCardTriggerDevice('bjork_pollen_2_Change').register();

		this._flowTriggerbok_pollen_0_Change = new Homey.FlowCardTriggerDevice('bok_pollen_0_Change').register();
		this._flowTriggerbok_pollen_1_Change = new Homey.FlowCardTriggerDevice('bok_pollen_1_Change').register();
		this._flowTriggerbok_pollen_2_Change = new Homey.FlowCardTriggerDevice('bok_pollen_2_Change').register();
	
		this._flowTriggerek_pollen_0_Change = new Homey.FlowCardTriggerDevice('ek_pollen_0_Change').register();
		this._flowTriggerek_pollen_1_Change = new Homey.FlowCardTriggerDevice('ek_pollen_1_Change').register();
		this._flowTriggerek_pollen_2_Change = new Homey.FlowCardTriggerDevice('ek_pollen_2_Change').register();

		this._flowTriggergras_pollen_0_Change = new Homey.FlowCardTriggerDevice('gras_pollen_0_Change').register();
		this._flowTriggergras_pollen_1_Change = new Homey.FlowCardTriggerDevice('gras_pollen_1_Change').register();
		this._flowTriggergras_pollen_2_Change = new Homey.FlowCardTriggerDevice('gras_pollen_2_Change').register();

		this._flowTriggergrabo_pollen_0_Change = new Homey.FlowCardTriggerDevice('grabo_pollen_0_Change').register();
		this._flowTriggergrabo_pollen_1_Change = new Homey.FlowCardTriggerDevice('grabo_pollen_1_Change').register();
		this._flowTriggergrabo_pollen_2_Change = new Homey.FlowCardTriggerDevice('grabo_pollen_2_Change').register();

		this._flowTriggerhassel_pollen_0_Change = new Homey.FlowCardTriggerDevice('hassel_pollen_0_Change').register();
		this._flowTriggerhassel_pollen_1_Change = new Homey.FlowCardTriggerDevice('hassel_pollen_1_Change').register();
		this._flowTriggerhassel_pollen_2_Change = new Homey.FlowCardTriggerDevice('hassel_pollen_2_Change').register();

		this._flowTriggersalg_vide_pollen_0_Change = new Homey.FlowCardTriggerDevice('salg_vide_pollen_0_Change').register();
		this._flowTriggersalg_vide_pollen_1_Change = new Homey.FlowCardTriggerDevice('salg_vide_pollen_1_Change').register();
		this._flowTriggersalg_vide_pollen_2_Change = new Homey.FlowCardTriggerDevice('salg_vide_pollen_2_Change').register();	
		
		
		// Register Flow conditions
		this.alPollen0Status = new Homey.FlowCardCondition('al_pollen_0').register().registerRunListener((args, state) => {
			var result = (alpollen[3] > args.halt);
			return Promise.resolve(result);
		});

		this.alPollen1Status = new Homey.FlowCardCondition('al_pollen_1').register().registerRunListener((args, state) => {
			var result = (alpollen[4] > args.halt);
			return Promise.resolve(result);
		});

		this.alPollen2Status = new Homey.FlowCardCondition('al_pollen_2').register().registerRunListener((args, state) => {
			var result = (alpollen[5] > args.halt);
			return Promise.resolve(result);
		});

		this.almPollen0Status = new Homey.FlowCardCondition('alm_pollen_0').register().registerRunListener((args, state) => {
			var result = (almpollen[3] > args.halt);
			return Promise.resolve(result);
		});

		this.almPollen1Status = new Homey.FlowCardCondition('alm_pollen_1').register().registerRunListener((args, state) => {
			var result = (almpollen[4] > args.halt);
			return Promise.resolve(result);
		});

		this.almPollen2Status = new Homey.FlowCardCondition('alm_pollen_2').register().registerRunListener((args, state) => {
			var result = (almpollen[5] > args.halt);
			return Promise.resolve(result);
		});

		this.ambrosiaPollen0Status = new Homey.FlowCardCondition('ambrosia_pollen_0').register().registerRunListener((args, state) => {
			var result = (ambrosiapollen[3] > args.halt);
			return Promise.resolve(result);
		});

		this.ambrosiaPollen1Status = new Homey.FlowCardCondition('ambrosia_pollen_1').register().registerRunListener((args, state) => {
			var result = (ambrosiapollen[4] > args.halt);
			return Promise.resolve(result);
		});

		this.ambrosiaPollen2Status = new Homey.FlowCardCondition('ambrosia_pollen_2').register().registerRunListener((args, state) => {
			var result = (ambrosiapollen[5] > args.halt);
			return Promise.resolve(result);
		});

		this.bjorkPollen0Status = new Homey.FlowCardCondition('bjork_pollen_0').register().registerRunListener((args, state) => {
			var result = (bjorkpollen[3] > args.halt);
			return Promise.resolve(result);
		});

		this.bjorkPollen1Status = new Homey.FlowCardCondition('bjork_pollen_1').register().registerRunListener((args, state) => {
			var result = (bjorkpollen[4] > args.halt);
			return Promise.resolve(result);
		});

		this.bjorkPollen2Status = new Homey.FlowCardCondition('bjork_pollen_2').register().registerRunListener((args, state) => {
			var result = (bjorkpollen[5] > args.halt);
			return Promise.resolve(result);
		});

		this.bokPollen0Status = new Homey.FlowCardCondition('bok_pollen_0').register().registerRunListener((args, state) => {
			var result = (bokpollen[3] > args.halt);
			return Promise.resolve(result);
		});

		this.bokPollen1Status = new Homey.FlowCardCondition('bok_pollen_1').register().registerRunListener((args, state) => {
			var result = (bokpollen[4] > args.halt);
			return Promise.resolve(result);
		});

		this.bokPollen2Status = new Homey.FlowCardCondition('bok_pollen_2').register().registerRunListener((args, state) => {
			var result = (bokpollen[5] > args.halt);
			return Promise.resolve(result);
		});

		this.ekPollen0Status = new Homey.FlowCardCondition('ek_pollen_0').register().registerRunListener((args, state) => {
			var result = (ekpollen[3] > args.halt);
			return Promise.resolve(result);
		});

		this.ekPollen1Status = new Homey.FlowCardCondition('ek_pollen_1').register().registerRunListener((args, state) => {
			var result = (ekpollen[4] > args.halt);
			return Promise.resolve(result);
		});

		this.ekPollen2Status = new Homey.FlowCardCondition('ek_pollen_2').register().registerRunListener((args, state) => {
			var result = (ekpollen[5] > args.halt);
			return Promise.resolve(result);
		});

		this.grasPollen0Status = new Homey.FlowCardCondition('gras_pollen_0').register().registerRunListener((args, state) => {
			var result = (graspollen[3] > args.halt);
			return Promise.resolve(result);
		});

		this.grasPollen1Status = new Homey.FlowCardCondition('gras_pollen_1').register().registerRunListener((args, state) => {
			var result = (graspollen[4] > args.halt);
			return Promise.resolve(result);
		});

		this.grasPollen2Status = new Homey.FlowCardCondition('gras_pollen_2').register().registerRunListener((args, state) => {
			var result = (graspollen[5] > args.halt);
			return Promise.resolve(result);
		});

		this.graboPollen0Status = new Homey.FlowCardCondition('grabo_pollen_0').register().registerRunListener((args, state) => {
			var result = (grabopollen[3] > args.halt);
			return Promise.resolve(result);
		});

		this.graboPollen1Status = new Homey.FlowCardCondition('grabo_pollen_1').register().registerRunListener((args, state) => {
			var result = (grabopollen[4] > args.halt);
			return Promise.resolve(result);
		});

		this.graboPollen2Status = new Homey.FlowCardCondition('grabo_pollen_2').register().registerRunListener((args, state) => {
			var result = (grabopollen[5] > args.halt);
			return Promise.resolve(result);
		});

		this.hasselPollen0Status = new Homey.FlowCardCondition('hassel_pollen_0').register().registerRunListener((args, state) => {
			var result = (hasselpollen[3] > args.halt);
			return Promise.resolve(result);
		});

		this.hasselPollen1Status = new Homey.FlowCardCondition('hassel_pollen_1').register().registerRunListener((args, state) => {
			var result = (hasselpollen[4] > args.halt);
			return Promise.resolve(result);
		});

		this.hasselPollen2Status = new Homey.FlowCardCondition('hassel_pollen_2').register().registerRunListener((args, state) => {
			var result = (hasselpollen[5] > args.halt);
			return Promise.resolve(result);
		});

		this.salgvidePollen0Status = new Homey.FlowCardCondition('salg_vide_pollen_0').register().registerRunListener((args, state) => {
			var result = (salgvidepollen[3] > args.halt);
			return Promise.resolve(result);
		});

		this.salgvidePollen1Status = new Homey.FlowCardCondition('salg_vide_pollen_1').register().registerRunListener((args, state) => {
			var result = (salgvidepollen[4] > args.halt);
			return Promise.resolve(result);
		});

		this.salgvidePollen2Status = new Homey.FlowCardCondition('salg_vide_pollen_2').register().registerRunListener((args, state) => {
			var result = (salgvidepollen[5] > args.halt);
			return Promise.resolve(result);
		});

  }; // end onInit

  onAdded() {
    let id = this.getData().id;
		this.log('device added: ', id);

		// working with pollen data
    this.fetchPollenData();

	}; // end onAdded

	// on changed city settings
	async onSettings(oldSettingsObj, newSettingsObj, changedKeysArr) {
		if (changedKeysArr == 'pCity') {
			this.log('Settings changed for selected pollen city from ' + oldSettingsObj.pCity + ' to ' + newSettingsObj.pCity) + '. Fetching pollen levels for new city.';
//			await this.setSettings('pollenCity', newSettingsObj.pCity);
			pollenCity = parseInt(newSettingsObj.pCity);
			this.fetchPollenData();
		}
  }; // end onSettings
	
	// working with Pollen json data here
  async fetchPollenData(){
		console.log("Fetching Pollen data");
		const res = await fetch(PollenUrl);
		const pollenData = await res.json();
			
		// populating pollen variables
		for (var i=0; i < pollenData[0].CitiesData.length; i++){
			if (pollenData[0].CitiesData[i]["cityid"] == pollenCity){
					alpollen[0] = (pollenData[0].CitiesData[i].pollen[0]["day0_desc"]);
					almpollen[0] = (pollenData[0].CitiesData[i].pollen[1]["day0_desc"]);
					ambrosiapollen[0] = (pollenData[0].CitiesData[i].pollen[2]["day0_desc"]);
					bjorkpollen[0] = (pollenData[0].CitiesData[i].pollen[3]["day0_desc"]);
					bokpollen[0] = (pollenData[0].CitiesData[i].pollen[4]["day0_desc"]);
					ekpollen[0] = (pollenData[0].CitiesData[i].pollen[5]["day0_desc"]);
					graspollen[0] = (pollenData[0].CitiesData[i].pollen[6]["day0_desc"]);
					grabopollen[0] = (pollenData[0].CitiesData[i].pollen[7]["day0_desc"]);
					hasselpollen[0] = (pollenData[0].CitiesData[i].pollen[8]["day0_desc"]);
					salgvidepollen[0] = (pollenData[0].CitiesData[i].pollen[9]["day0_desc"]);

					alpollen[1] = (pollenData[0].CitiesData[i].pollen[0]["day1_desc"]);
					almpollen[1] = (pollenData[0].CitiesData[i].pollen[1]["day1_desc"]);
					ambrosiapollen[1] = (pollenData[0].CitiesData[i].pollen[2]["day1_desc"]);
					bjorkpollen[1] = (pollenData[0].CitiesData[i].pollen[3]["day1_desc"]);
					bokpollen[1] = (pollenData[0].CitiesData[i].pollen[4]["day1_desc"]);
					ekpollen[1] = (pollenData[0].CitiesData[i].pollen[5]["day1_desc"]);
					graspollen[1] = (pollenData[0].CitiesData[i].pollen[6]["day1_desc"]);
					grabopollen[1] = (pollenData[0].CitiesData[i].pollen[7]["day1_desc"]);
					hasselpollen[1] = (pollenData[0].CitiesData[i].pollen[8]["day1_desc"]);
					salgvidepollen[1] = (pollenData[0].CitiesData[i].pollen[9]["day1_desc"]);

					alpollen[2] = (pollenData[0].CitiesData[i].pollen[0]["day2_desc"]);
					almpollen[2] = (pollenData[0].CitiesData[i].pollen[1]["day2_desc"]);
					ambrosiapollen[2] = (pollenData[0].CitiesData[i].pollen[2]["day2_desc"]);
					bjorkpollen[2] = (pollenData[0].CitiesData[i].pollen[3]["day2_desc"]);
					bokpollen[2] = (pollenData[0].CitiesData[i].pollen[4]["day2_desc"]);
					ekpollen[2] = (pollenData[0].CitiesData[i].pollen[5]["day2_desc"]);
					graspollen[2] = (pollenData[0].CitiesData[i].pollen[6]["day2_desc"]);
					grabopollen[2] = (pollenData[0].CitiesData[i].pollen[7]["day2_desc"]);
					hasselpollen[2] = (pollenData[0].CitiesData[i].pollen[8]["day2_desc"]);
					salgvidepollen[2] = (pollenData[0].CitiesData[i].pollen[9]["day2_desc"]);
					
			break;
			}
		}

		// setting device capabilities
		this.setCapabilityValue('al_pollen_0', alpollen[0]);
		this.setCapabilityValue('alm_pollen_0', almpollen[0]);
		this.setCapabilityValue('ambrosia_pollen_0', ambrosiapollen[0]);
		this.setCapabilityValue('bjork_pollen_0', bjorkpollen[0]);
		this.setCapabilityValue('bok_pollen_0', bokpollen[0]);
		this.setCapabilityValue('ek_pollen_0', ekpollen[0]);
		this.setCapabilityValue('gras_pollen_0', graspollen[0]);
		this.setCapabilityValue('grabo_pollen_0', grabopollen[0]);
		this.setCapabilityValue('hassel_pollen_0', hasselpollen[0]);
		this.setCapabilityValue('salg_vide_pollen_0', salgvidepollen[0]);

		this.setCapabilityValue('al_pollen_1', alpollen[1]);
		this.setCapabilityValue('alm_pollen_1', almpollen[1]);
		this.setCapabilityValue('ambrosia_pollen_1', ambrosiapollen[1]);
		this.setCapabilityValue('bjork_pollen_1', bjorkpollen[1]);
		this.setCapabilityValue('bok_pollen_1', bokpollen[1]);
		this.setCapabilityValue('ek_pollen_1', ekpollen[1]);
		this.setCapabilityValue('gras_pollen_1', graspollen[1]);
		this.setCapabilityValue('grabo_pollen_1', grabopollen[1]);
		this.setCapabilityValue('hassel_pollen_1', hasselpollen[1]);
		this.setCapabilityValue('salg_vide_pollen_1', salgvidepollen[1]);

		this.setCapabilityValue('al_pollen_2', alpollen[2]);
		this.setCapabilityValue('alm_pollen_2', almpollen[2]);
		this.setCapabilityValue('ambrosia_pollen_2', ambrosiapollen[2]);
		this.setCapabilityValue('bjork_pollen_2', bjorkpollen[2]);
		this.setCapabilityValue('bok_pollen_2', bokpollen[2]);
		this.setCapabilityValue('ek_pollen_2', ekpollen[2]);
		this.setCapabilityValue('gras_pollen_2', graspollen[2]);
		this.setCapabilityValue('grabo_pollen_2', grabopollen[2]);
		this.setCapabilityValue('hassel_pollen_2', hasselpollen[2]);
		this.setCapabilityValue('salg_vide_pollen_2', salgvidepollen[2]);
			
		// switch from strings to numbers
		for (var i=0; i<2; i++) {
			var x=i+3;
			switch (alpollen[i]) {
				case "inga halter": alpollen[x] = 0; break;
				case "låga halter": alpollen[x] = 1; break;
				case "låga-måttliga halter": alpollen[x] = 2; break;
				case "måttliga halter": alpollen[x] = 3; break;
				case "måttliga-höga halter": alpollen[x] = 4; break;
				case "höga halter": alpollen[x] = 5; break;
				case "mycket höga halter": alpollen[x] = 6; break;
				default: alpollen[x] = 0;
			};
			switch (almpollen[i]) {
				case "inga halter": almpollen[x] = 0; break;
				case "låga halter": almpollen[x] = 1; break;
				case "låga-måttliga halter": almpollen[x] = 2; break;
				case "måttliga halter": almpollen[x] = 3; break;
				case "måttliga-höga halter": almpollen[x] = 4; break;
				case "höga halter": almpollen[x] = 5; break;
				case "mycket höga halter": almpollen[x] = 6; break;
				default: almpollen[x] = 0;
			};
			switch (ambrosiapollen[i]) {
				case "inga halter": ambrosiapollen[x] = 0; break;
				case "låga halter": ambrosiapollen[x] = 1; break;
				case "låga-måttliga halter": ambrosiapollen[x] = 2; break;
				case "måttliga halter": ambrosiapollen[x] = 3; break;
				case "måttliga-höga halter": ambrosiapollen[x] = 4; break;
				case "höga halter": ambrosiapollen[x] = 5; break;
				case "mycket höga halter": ambrosiapollen[x] = 6; break;
				default: ambrosiapollen[x] = 0;
			};
			switch (bjorkpollen[i]) {
				case "inga halter": bjorkpollen[x] = 0; break;
				case "låga halter": bjorkpollen[x] = 1; break;
				case "låga-måttliga halter": bjorkpollen[x] = 2; break;
				case "måttliga halter": bjorkpollen[x] = 3; break;
				case "måttliga-höga halter": bjorkpollen[x] = 4; break;
				case "höga halter": bjorkpollen[x] = 5; break;
				case "mycket höga halter": bjorkpollen[x] = 6; break;
				default: bjorkpollen[x] = 0;
			};
			switch (bokpollen[i]) {
				case "inga halter": bokpollen[x] = 0; break;
				case "låga halter": bokpollen[x] = 1; break;
				case "låga-måttliga halter": bokpollen[x] = 2; break;
				case "måttliga halter": bokpollen[x] = 3; break;
				case "måttliga-höga halter": bokpollen[x] = 4; break;
				case "höga halter": bokpollen[x] = 5; break;
				case "mycket höga halter": bokpollen[x] = 6; break;
				default: bokpollen[x] = 0;
			};
			switch (ekpollen[i]) {
				case "inga halter": ekpollen[x] = 0; break;
				case "låga halter": ekpollen[x] = 1; break;
				case "låga-måttliga halter": ekpollen[x] = 2; break;
				case "måttliga halter": ekpollen[x] = 3; break;
				case "måttliga-höga halter": ekpollen[x] = 4; break;
				case "höga halter": ekpollen[x] = 5; break;
				case "mycket höga halter": ekpollen[x] = 6; break;
				default: ekpollen[x] = 0;
			};
			switch (graspollen[i]) {
				case "inga halter": graspollen[x] = 0; break;
				case "låga halter": graspollen[x] = 1; break;
				case "låga-måttliga halter": graspollen[x] = 2; break;
				case "måttliga halter": graspollen[x] = 3; break;
				case "måttliga-höga halter": graspollen[x] = 4; break;
				case "höga halter": graspollen[x] = 5; break;
				case "mycket höga halter": graspollen[x] = 6; break;
				default: graspollen[x] = 0;
			};
			switch (grabopollen[i]) {
				case "inga halter": grabopollen[x] = 0; break;
				case "låga halter": grabopollen[x] = 1; break;
				case "låga-måttliga halter": grabopollen[x] = 2; break;
				case "måttliga halter": grabopollen[x] = 3; break;
				case "måttliga-höga halter": grabopollen[x] = 4; break;
				case "höga halter": grabopollen[x] = 5; break;
				case "mycket höga halter": grabopollen[x] = 6; break;
				default: grabopollen[x] = 0;
			};
			switch (hasselpollen[i]) {
				case "inga halter": hasselpollen[x] = 0; break;
				case "låga halter": hasselpollen[x] = 1; break;
				case "låga-måttliga halter": hasselpollen[x] = 2; break;
				case "måttliga halter": hasselpollen[x] = 3; break;
				case "måttliga-höga halter": hasselpollen[x] = 4; break;
				case "höga halter": hasselpollen[x] = 5; break;
				case "mycket höga halter": alhasselpollenollen[x] = 6; break;
				default: hasselpollen[x] = 0;
			};
			switch (salgvidepollen[i]) {
				case "inga halter": salgvidepollen[x] = 0; break;
				case "låga halter": salgvidepollen[x] = 1; break;
				case "låga-måttliga halter": salgvidepollen[x] = 2; break;
				case "måttliga halter": salgvidepollen[x] = 3; break;
				case "måttliga-höga halter": salgvidepollen[x] = 4; break;
				case "höga halter": salgvidepollen[x] = 5; break;
				case "mycket höga halter": salgvidepollen[x] = 6; break;
				default: salgvidepollen[x] = 0;
			};

		};

	}; // end fetchPollenData

  onDeleted() {
    let id = this.getData().id;
    this.log('device deleted:', id);

	}; // end onDeleted
	
// flow triggers
triggeral_pollen_0_ChangeFlow(device, tokens, state) {
this._flowTriggeral_pollen_0_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggeralm_pollen_0_ChangeFlow(device, tokens, state) {
this._flowTriggeral_pollen_1_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggerambrosia_pollen_0_ChangeFlow(device, tokens, state) {
this._flowTriggeral_pollen_2_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggerbjork_pollen_0_ChangeFlow(device, tokens, state) {
this._flowTriggeralm_pollen_0_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggerbok_pollen_0_ChangeFlow(device, tokens, state) {
this._flowTriggeralm_pollen_1_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggerek_pollen_0_ChangeFlow(device, tokens, state) {
this._flowTriggeralm_pollen_2_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggergras_pollen_0_ChangeFlow(device, tokens, state) {
this._flowTriggerambrosia_pollen_0_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggergrabo_pollen_0_ChangeFlow(device, tokens, state) {
this._flowTriggerambrosia_pollen_1_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggerhassel_pollen_0_ChangeFlow(device, tokens, state) {
this._flowTriggerambrosia_pollen_2_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggersalg_vide_pollen_0_ChangeFlow(device, tokens, state) {
this._flowTriggerbjork_pollen_0_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggeral_pollen_1_ChangeFlow(device, tokens, state) {
this._flowTriggerbjork_pollen_1_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggeralm_pollen_1_ChangeFlow(device, tokens, state) {
this._flowTriggerbjork_pollen_2_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggerambrosia_pollen_1_ChangeFlow(device, tokens, state) {
this._flowTriggerbok_pollen_0_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggerbjork_pollen_1_ChangeFlow(device, tokens, state) {
this._flowTriggerbok_pollen_1_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggerbok_pollen_1_ChangeFlow(device, tokens, state) {
this._flowTriggerbok_pollen_2_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggerek_pollen_1_ChangeFlow(device, tokens, state) {
this._flowTriggerek_pollen_0_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggergras_pollen_1_ChangeFlow(device, tokens, state) {
this._flowTriggerek_pollen_1_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggergrabo_pollen_1_ChangeFlow(device, tokens, state) {
this._flowTriggerek_pollen_2_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggerhassel_pollen_1_ChangeFlow(device, tokens, state) {
this._flowTriggergras_pollen_0_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggersalg_vide_pollen_1_ChangeFlow(device, tokens, state) {
this._flowTriggergras_pollen_1_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggeral_pollen_2_ChangeFlow(device, tokens, state) {
this._flowTriggergras_pollen_2_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggeralm_pollen_2_ChangeFlow(device, tokens, state) {
this._flowTriggergrabo_pollen_0_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggerambrosia_pollen_2_ChangeFlow(device, tokens, state) {
this._flowTriggergrabo_pollen_1_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggerbjork_pollen_2_ChangeFlow(device, tokens, state) {
this._flowTriggergrabo_pollen_2_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggerbok_pollen_2_ChangeFlow(device, tokens, state) {
this._flowTriggerhassel_pollen_0_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggerek_pollen_2_ChangeFlow(device, tokens, state) {
this._flowTriggerhassel_pollen_1_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggergras_pollen_2_ChangeFlow(device, tokens, state) {
this._flowTriggerhassel_pollen_2_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggergrabo_pollen_2_ChangeFlow(device, tokens, state) {
this._flowTriggersalg_vide_pollen_0_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggerhassel_pollen_2_ChangeFlow(device, tokens, state) {
this._flowTriggersalg_vide_pollen_1_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

triggersalg_vide_pollen_2_ChangeFlow(device, tokens, state) {
this._flowTriggersalg_vide_pollen_2_Change
	.trigger(device, tokens, state)
	.then(this.log)
	.catch(this.error)
};

};

module.exports = PollenDevice;