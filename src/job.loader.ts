
var utils = require('utils');
var goal = require('goal');

interface missionResults {
	continue: boolean,
	creepsToGiveBack: string[] | undefined
}


type container = StructureTower | StructureSpawn | StructureExtension | StructureNuker;
type bag = container | StructureLab | StructurePowerSpawn | StructurePowerBank;

class Loader extends JobClass {
	execute () {
		var self = this;

	}
	loaderCarry () {
		var self = this;
		var room = Game.rooms[self.parentClaim];
		if(!room) {
			return 0;
		}
		return self.jobs.spawn.powerForCost('transporter', room.energyCapacityAvailable);
	}
	getEnergy(creep: CreepClass) {
    var self = this;
    if(creep.carry[RESOURCE_ENERGY] == creep.carryCapacity) {
      return true;
    }
    if(!creep.memory.navigatingToEnergy) {
      creep.memory.arrived = false;
      var closestStorage = <Structure>_.find(self.jobs.logistics.getStoragesAtRange(creep.goal.roomName, 3), function (storage: StructureStorage) {
        if(storage.store[RESOURCE_ENERGY] != 0) {
          return true;
        }
        return false;
      });

      if(!closestStorage) {
        throw new Error('cant find a storage in range of room ' + creep.goal.roomName);
      }
      creep.memory.navigatingToEnergy = true;
      creep.goal = self.jobs.logistics.goals[closestStorage.id];
    }

    if(!creep.arrived()) {
      creep.navigate();
    } else {
      creep.withdraw(<Structure>creep.goal.target, RESOURCE_ENERGY);
      creep.memory.navigatingToEnergy = false;
    }
    return false;
	}
	get missionGenerators() : MissionGenerators {
		var self = this;
		return {
			containerReplenish: {
				init: function (missionMem: any) {
					missionMem.missions = {};
				},
				new: function (missionMem: any, rooms: string[]) : Mission[] {
					var newMissions : Mission[] = [];
					var typeList : string[][] = [[STRUCTURE_TOWER],[STRUCTURE_SPAWN,STRUCTURE_EXTENSION],[],[STRUCTURE_LAB],[STRUCTURE_NUKER]];
					_.forEach(typeList, function (types : string[], typePriority : number) {
						if(types.length == 0) {
							return true;
						}
						_.forEach(rooms, function (roomName) {
							var room = Game.rooms[roomName];
							if(!room) {
								return true;
							}
							// dont fill up nukers if we have less than 200k sitting in the bank
							if(types[0] == STRUCTURE_NUKER) {
								var parentClaimRoom = Game.rooms[self.parentClaim];
								if(parentClaimRoom && parentClaimRoom.storage && parentClaimRoom.storage.store[RESOURCE_ENERGY] < 200000) {
									return true;
								}
							}
							if(!(room.controller && room.controller.owner && room.controller.owner.username == global.username)) {
								return true;
							}
							var containers : container[] = room.find(FIND_MY_STRUCTURES, {filter: function (struct : OwnedStructure) {
								return _.contains(types, struct.structureType);
							}});
							containers = _.filter(containers, function (container) {
								if(missionMem.missions[container.id]) {
									return false;
								}
								if(container.energy < container.energyCapacity) {
									return false;
								}
								return true;
							});

							if(containers.length == 0) {
								return true;
							}
							var missingEnergy = _.reduce(containers, function ( total: number, container : container) {
								return total + (container.energyCapacity - container.energy);
							}, 0);
							var maxWorkers = Math.ceil(missingEnergy / self.loaderCarry());
							var containerList = _.map(containers, function (container) { return container.id })
							newMissions.push({
								missionName: 'containerReplenish',
								maxWorkers: maxWorkers,
								runner: 'runMission',
								missionInit: 'creepMissionInit',
								creeps: [],
								//indexes being what they are i'd rather not deal with 0 == false
								priority: typePriority + 1,
								other: {
									containers: containerList,
									roomName: roomName,
									resourceType: RESOURCE_ENERGY
								}
							});
							_.forEach(containers, function (container) {
								_.set(missionMem.missions, roomName + '.' + container.id + '.' + RESOURCE_ENERGY, true);
							});
						});
					});
					return newMissions;
				},
				remove: function (missionMem: any, mission: Mission) {
					_.forEach(mission.other.containers, function (containerid) {
						delete missionMem.missions[mission.other.roomName][containerid][mission.other.resourceType];
					});
				},
				creepMissionInit: function (creep: CreepClass) {
					creep.memory.missionStatus = {
						gettingResource : false,
						delivering: false,
						target: undefined,
					}
				},
				runMission: function (mission: Mission, creeps: CreepClass[]) : missionResults {
					var doneCreeps: string[] = [];
					var removeSites: string[] = [];
					_.forEach(creeps, function (creep) {
						if(!creep.memory.missionStatus.target) {
							return true;
						}
						var containerObj = <bag>Game.getObjectById(creep.memory.missionStatus.target);

						if(containerObj instanceof StructureLab) {

						} else if(containerObj instanceof StructurePowerBank) {

						} else if(containerObj instanceof StructurePowerSpawn) {

						} else if(containerObj instanceof StructureTower) {

						} else 
						//subtracting tower energy cost deals with 
						//the possibility that the tower might be
						//actively firing on targets
						if(towerObj && towerObj.energy > towerObj.energyCapacity - TOWER_ENERGY_COST) {
							removeSites.push(towerObj.id);
							creep.memory.missionStatus.target = undefined;
						}
					});
					// if we have refilled all of the towers then we should remove this mission
					mission.other.towers = _.difference(mission.other.towers, removeSites);
					if(mission.other.towers.length == 0) {
						return {continue: false, creepsToGiveBack: undefined};
					}
					var takenTowers : string[] = [];
					takenTowers = _.reduce(creeps, function (list, creep) {
						list.push(creep.memory.missionStatus.target);
						return list;
					}, takenTowers);
					_.forEach(creeps, function (creep) {
						if(creep.memory.missionStatus.gettingEnergy) {
							if(self.getEnergy(creep)) {
								creep.memory.missionStatus.gettingEnergy = false;
							}
						} else if(creep.memory.missionStatus.delivering) {
							if(!creep.memory.missionStatus.target) {
								var availableSites = _.difference(mission.other.towers, takenTowers);
								if(availableSites.length == 0) {
									doneCreeps.push(creep.name);
									return true;
								}
								var closestSite = _.min(availableSites, function (site) {
									var tower = <StructureTower>Game.getObjectById(site);
									return tower.pos.getRangeTo(creep.pos);
								});
								creep.memory.missionStatus.target = closestSite;
								creep.goal = new GoalClass(undefined, mission.other.roomName, closestSite, {halts: false, range: 1});
								takenTowers.push(closestSite);
							}
							if(creep.arrived()) {
								var tower = <StructureTower>Game.getObjectById(creep.memory.missionStatus.target);
								creep.transfer(tower, RESOURCE_ENERGY);
							} else {
								creep.navigate();
							}
							
							if(creep.carry[RESOURCE_ENERGY] == 0) {
								doneCreeps.push(creep.name);
							}
						} else {
							if(creep.carry[RESOURCE_ENERGY] == creep.carryCapacity) {
								creep.memory.missionStatus.delivering = true;
							} else {
								creep.memory.missionStatus.gettingEnergy = true;
							}
						}
					});
					return {
						creepsToGiveBack: doneCreeps,
						continue: true
					};
				}
			},
			spawnReplenish: {
				init: function (missionMem: any) : void {
					missionMem.missions = {};
				},
				new: function (missionMem: any, rooms: string[]) : Mission[] {
					var newMissions : Mission[] = [];
					_.forEach(rooms, function (roomName) {
						var room = Game.rooms[roomName];
						if(!room) {
							return true;
						}
						if(!room.controller || !room.controller.my) {
							return true;
						}
						var containers : (StructureSpawn | StructureExtension)[] = room.find(FIND_MY_STRUCTURES, {filter: function (struct : OwnedStructure) {
							if(struct.structureType != STRUCTURE_SPAWN && struct.structureType != STRUCTURE_EXTENSION) {
								return false;
							}
							var container : StructureSpawn | StructureExtension = <StructureSpawn|StructureExtension>struct;
							if(container.energy == container.energyCapacity) {
								return false;
							}
							var exists = _.get(missionMem.missions, roomName + '.' + container.id, false);
							if(exists) {
								return false;
							}
							return true;
						}});
						if(containers.length == 0) {
							return true;
						}
						var neededEnergy = _.reduce(containers, function(total, container) {
							return (total + (container.energyCapacity - container.energy));
						}, 0);
						var maxWorkers = Math.ceil(neededEnergy / self.loaderCarry());
						var containerList = _.map(containers, function (container) { return container.id});
						newMissions.push({
							missionName: 'spawnReplenish',
							maxWorkers: maxWorkers,
							runner: 'runMission',
							missionInit: 'creepMissionInit',
							creeps: [],
							priority: 1,
							other: {
								roomName: roomName,
								containers: containerList
							}
						});
						_.forEach(containerList, function (containerid) {
							_.set(missionMem.missions, roomName + '.' + containerid, true);
						});
					});
					return newMissions;
				},
				remove: function (missionMem: any, mission: Mission) : void {
					_.forEach(mission.other.containers, function (containerid) {
						delete missionMem.missions[mission.other.roomName][containerid];
					});
				},
				creepMissionInit: function (creep : CreepClass) : void {
					creep.memory.missionStatus = {
						gettingEnergy: false,
						delivery: false,
						target: undefined,
					}
				},
				runMission:  function (mission: Mission, creeps: CreepClass[]) : missionResults {
					var doneCreeps : string[] = [];
					var removeSites : string[] = [];
					_.forEach(creeps, function (creep) {
						if(!creep.memory.missionStatus.target) {
							return true;
						}
						var container = <StructureSpawn | StructureExtension>Game.getObjectById(creep.memory.missionStatus.target);
						if(container.energy == container.energyCapacity || !container) {
							removeSites.push(creep.memory.missionStatus.target);
							creep.memory.missionStatus.target = undefined;
						}
					});
					mission.other.containers = _.difference(mission.other.containers, removeSites);
					if(mission.other.containers.length == 0) {
						return {continue: false, creepsToGiveBack: undefined};
					}
					var takenSites : string[] = [];
					takenSites = _.reduce(creeps, function(list, creep) {
						list.push(creep.memory.missionStatus.target);
						return list;
					}, takenSites);
					_.forEach(creeps, function (creep) {
						if(creep.memory.missionStatus.gettingEnergy) {
							if(self.getEnergy(creep)) {
								creep.memory.missionStatus.gettingEnergy = false;
							}
						} else if(creep.memory.missionStatus.delivery) {
							if(!creep.memory.missionStatus.target) {
								var availableSites = _.difference(mission.other.containers, takenSites);
								if(availableSites.length == 0) {
									doneCreeps.push(creep.name);
								}
								var closestSite = _.min(availableSites, function (siteid) {
									var container = <Structure>Game.getObjectById(siteid);
									return container.pos.getRangeTo(creep.pos);
								});
							}


							if(creep.carry[RESOURCE_ENERGY] == 0) {
								doneCreeps.push(creep.name);
							}
						} else {
							if(creep.carry[RESOURCE_ENERGY] == creep.carryCapacity) {
								creep.memory.missionStatus.delivery = true;
							} else {
								creep.memory.missionStatus.gettingEnergy = true;
							}
						}
						
					});
					return {
						continue: true, 
						creepsToGiveBack: doneCreeps
					};
				}
			}
		}
	}

}