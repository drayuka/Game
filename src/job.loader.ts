
var utils = require('utils');
import { GoalClass } from "./goal";
import { JobClass } from "./job";
import { CreepClass } from "./creep";
import { MissionJobClass } from "./mission.job"
import { Mission } from "./mission.job"
import { MissionGenerators } from "./mission.job"
import { missionResults } from "./mission.job"



type container = StructureStorage | StructureTerminal | StructureContainer;
type energyUser = StructureTower | StructureSpawn | StructureExtension | StructureLink;
type bag = container | energyUser |  StructureLab | StructurePowerSpawn | StructurePowerBank | StructureNuker;

export class LoaderJob extends MissionJobClass {
	_loaderCarry: number;
	execute () {
		var self = this;
		self.generateMissions();
		self.assignMissions();
		self.updateRequisitions();
		self.runMissions();
	}
	//returns the max size of the creep for this parent claim room, maxes out at
	//500 for sub lvl 7 rooms and 1000 for 7+
	loaderCarry () {
		var self = this;
		if(self._loaderCarry) {
			return self._loaderCarry;
		}
		var room = Game.rooms[self.parentClaim];
		if(!room) {
			return 0;
		}
		var maxSize = 500;
		if(room.controller && room.controller.level >= 7) {
			maxSize = 1000;
		}
		self._loaderCarry = Math.min(maxSize, self.jobs.spawn.powerForCost('transporter', room.energyCapacityAvailable));
		return self._loaderCarry;
	}
	isTargetEmpty(target: bag, resourceType: ResourceConstant) : boolean {
		var self = this;
		if(target instanceof StructureStorage || target instanceof StructureTerminal || target instanceof StructureContainer) {
			var resourceAmount = target.store[resourceType];
			if(resourceAmount) {
				return resourceAmount > 0;
			}
		} else if(target instanceof StructureSpawn || target instanceof StructureExtension || target instanceof StructureTower || target instanceof StructureLink) {
			if(resourceType == RESOURCE_ENERGY) {
				return target.energy > 0;
			}
		} else if(target instanceof StructureNuker) {
			if(resourceType == RESOURCE_ENERGY) {
				return target.energy > 0;
			} else if(resourceType == RESOURCE_GHODIUM) {
				return target.ghodium > 0;
			}
		} else if(target instanceof StructureLab) {
			if(resourceType == RESOURCE_ENERGY) {
				return target.energy > 0;
			} else if(target.mineralType == resourceType && target.mineralAmount > 0) {
				return true;
			}
		} else if(target instanceof StructurePowerSpawn) {
			if(resourceType == RESOURCE_ENERGY) {
				return target.energy > 0;
			} else if(resourceType == RESOURCE_POWER) {
				return target.power > 0;
			}
		} else if(target instanceof StructurePowerBank) {
			if(resourceType == RESOURCE_POWER) {
				return target.power > 0;
			}
		}
		return false;
	}
	isTargetFull(target: bag, resourceType?: ResourceConstant) : boolean {
		var self = this;
		// full of a specific resource doesn't mean anything for contianers, 
		// so if they are actually full, they return true, otherwise false
		if(target instanceof StructureStorage || target instanceof StructureTerminal || target instanceof StructureContainer) {
			return _.sum(target.store) > target.storeCapacity;
		} else if(target instanceof StructureSpawn || target instanceof StructureExtension || target instanceof StructureTower || target instanceof StructureLink) {
			if(resourceType == RESOURCE_ENERGY) {
				return target.energy == target.energyCapacity;
			}
		} else if(target instanceof StructureNuker) {
			if(resourceType == RESOURCE_ENERGY) {
				return target.energy == target.energyCapacity;
			} else if(resourceType == RESOURCE_GHODIUM) {
				return target.ghodium == target.ghodiumCapacity;
			}
		} else if(target instanceof StructureLab) {
			if(resourceType == RESOURCE_ENERGY) {
				return target.energy == target.energyCapacity;
			} else if(resourceType == target.mineralType && target.mineralAmount == target.mineralCapacity) {
				return true;
			}
		} else if(target instanceof StructurePowerSpawn) {
			if(resourceType == RESOURCE_ENERGY) {
				return target.energy == target.energyCapacity;
			} else if(resourceType == RESOURCE_POWER) {
				return target.power == target.powerCapacity;
			}
		} else if(target instanceof StructurePowerBank) {
			//this doesn't make any sense, but if we're asked this, this is probably the best response
			if(resourceType == RESOURCE_POWER) {
				return true;
			}
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
							var containers : energyUser[] = room.find(FIND_MY_STRUCTURES, {filter: function (struct : OwnedStructure) {
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
							var missingEnergy = _.reduce(containers, function ( total: number, container : energyUser) {
								return total + (container.energyCapacity - container.energy);
							}, 0);
							var range = Game.map.getRoomLinearDistance(roomName, self.parentClaim);
							var closestStorage = <StructureStorage> _.find(self.jobs.logistics.getStoragesAtRange(roomName, range), function (storage: StructureStorage){
								if(storage.store[RESOURCE_ENERGY] != 0) {
									return true;
								}
							});
							if(!closestStorage) {
								return true;
							}

							var maxWorkers = Math.ceil(missingEnergy / self.loaderCarry());
							var containerList = _.map(containers, function (container) { return container.id });
							newMissions.push({
								missionName: 'containerReplenish',
								maxWorkers: maxWorkers,
								runner: 'runMission',
								missionInit: 'creepMissionInit',
								creeps: [],
								//indexes being what they are i'd rather not deal with 0 == false
								priority: typePriority + 1,
								other: {
									from: [closestStorage.id],
									type: 'fill',
									to: containerList,
									roomName: roomName,
									resourceType: RESOURCE_ENERGY,
									//signifies this mission was created by the generator
									generated: true
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
					if(!mission.other.generated) {
						return;
					}
					_.forEach(mission.other.containers, function (containerid) {
						delete missionMem.missions[mission.other.roomName][containerid];
					});
				},
				creepMissionInit: function (creep: CreepClass) {
					creep.memory.missionStatus = {
						gettingResource : false,
						state: 'emptying',
						target: undefined,
						extraResources: []
					}
				},
				runMission: function (mission: Mission, creeps: CreepClass[]) : missionResults {
					var doneCreeps: string[] = [];
					var removeFromSites: string[] = [];
					var removeToSites: string[] = [];
					//mission end due to repository being empty
					
					_.forEach(creeps, function (creep) {
						var state = creep.memory.missionStatus.state;
						if(!creep.memory.missionStatus.target || state == 'emptying') {
							return true;
						}
						var targetObj = <bag>Game.getObjectById(creep.memory.missionStatus.target);

						if(state == 'delivery' && self.isTargetFull(targetObj, mission.other.resourceType)) {
							removeToSites.push(targetObj.id);
							creep.memory.missionStatus.target = undefined;
						} else if(state == 'pickup' && self.isTargetEmpty(targetObj, mission.other.resourceType)) {
							removeFromSites.push(targetObj.id);
							creep.memory.missionStatus.target = undefined;
						}
					});
					//figure out if the mission is over, and whether or not it has succeeded.
					mission.other.to = _.difference(mission.other.to, removeToSites);
					mission.other.from = _.difference(mission.other.from, removeFromSites);
					if(mission.other.type == 'fill') {
						if(mission.other.to.length == 0) {
							return {continue: false, result: 'success'};
							//didn't have any of the required resource in the spaces mentioned
						} else if (mission.other.from.length == 0) {
							return {continue: false, result: 'failure'};
						}
					} else if(mission.other.type == 'empty') {
						if(mission.other.from.length == 0) {
							return {continue: false, result: 'success'};
							//we were trying to empty, but ran out of empty space, go figure
						} else if(mission.other.to.length == 0) {
							return {continue: false, result: 'failure'};
						}
					}

					//figure out the targets already taken by other creeps working this mission
					var takenSites : string[] = [];
					if(mission.other.type == 'fill') {
						takenSites = _.reduce(creeps, function (list, creep) {
							if(creep.memory.missionStatus.state == 'delivery') {
								list.push(creep.memory.missionStatus.target);
							}
							return list;
						}, takenSites);
					} else if(mission.other.type == 'empty') {
						takenSites = _.reduce(creeps, function (list, creep) {
							if(creep.memory.missionStatus.state == 'pickup') {
								list.push(creep.memory.missionStatus.target);
							}
							return list;
						}, takenSites);
					}

					//creep control
					_.forEach(creeps, function (creep) {
						var state = creep.memory.missionStatus.state;
						// creep has resources which need to be removed before it can act on this mission;
						if(state == 'emptying') {
							var resourceCarried = creep.carry[<ResourceConstant>mission.other.resourceType] || 0;
							if(_.sum(creep.carry) > resourceCarried) {
								//we are carrying something that isn't part of this mission
								if(!creep.memory.missionStatus.target) {
									var range = Game.map.getRoomLinearDistance(mission.other.roomName, self.parentClaim);
									var closestStorage = <StructureStorage> _.find(self.jobs.logistics.getStoragesAtRange(mission.other.roomName, range), function (storage: StructureStorage){
										if(storage.store[RESOURCE_ENERGY] != 0) {
											return true;
										}
									});
									if(!closestStorage) {
										return true;
									}
									creep.memory.missionStatus.extraResources = _.difference(_.keys(creep.carry), [mission.other.resourceType]);
								}

								if(creep.arrived()) {
									var container = <container>Game.getObjectById(creep.memory.missionStatus.target);
									_.forEach(creep.memory.missionStatus.extraResources, function (resourceType) {
										creep.transfer(container, resourceType);
									});
								} else {
									creep.navigate();
								}
							} else {
								creep.memory.missionStatus.state = '';
								return true;
							}
						// creep is picking up or delivering
						} else if(state == 'pickup' || state == 'delivery') {
							if(!creep.memory.missionStatus.target) {
								var sites : string[] = [];
								var spread = false;
								if(state == 'pickup') {
									sites = mission.other.from;
									if(mission.other.type == 'empty') {
										spread = true;
									} else if(mission.other.type == 'fill') {
										spread = false;
									}
								} else if(state == 'delivery') {
									sites = mission.other.to;
									if(mission.other.type == 'empty') {
										spread = false;
									} else if(mission.other.type == 'fill') {
										spread = true;
									}
								}
								var available = sites;
								if(spread) {
									available = _.difference(sites, takenSites);
								}
								if(available.length == 0) {
									available = sites;
								}
								var closest = _.min(available, function (siteid : string) {
									var obj = <bag>Game.getObjectById(siteid);
									return obj.pos.getRangeTo(creep.pos);
								});
								creep.memory.missionStatus.target = closest;
								var obj = <bag>Game.getObjectById(closest);
								var roomName = obj ? obj.pos.roomName : mission.other.roomName;
								creep.goal = new GoalClass(undefined, roomName, closest, {halts: false, range: 1});
							}
						
							if(creep.arrived()) {
								var target : bag = <bag>Game.getObjectById(creep.memory.missionStatus.target);
								if(creep.memory.missionStatus.state == 'pickup') {
									creep.withdraw(target, mission.other.resourceType);
								} else if(creep.memory.missionStatus.state == 'delivery') {
									creep.transfer(target, mission.other.resourceType);
								}
							}

							var carrying = creep.carry[<ResourceConstant>mission.other.resourceType] || 0;
							//once we are out of the resource we picked up, we should 
							if(carrying == creep.carryCapacity && state == 'pickup') {
								creep.memory.missionStatus.state = 'delivery';
							} else if(carrying == 0 && state == 'delivery') {
								doneCreeps.push(creep.name);
							}
						//need to figure out what to do with this creep
						} else {
							var carried = creep.carry[<ResourceConstant>mission.other.resourceType] || 0;
							if(carried == creep.carryCapacity) {
								creep.memory.missionStatus.state = 'delivery';
							} else if(creep.carryCapacity == _.sum(creep.carry)) {
								creep.memory.missionStatus.state = 'empty';
							} else {
								creep.memory.missionStatus.state = 'pickup';
							}
						}
					});
					return {
						creepsToGiveBack: doneCreeps,
						continue: true
					};
				}
			}
		}
	}
	addCreep(creepName: string) {
		var self = this;
		super.addCreep(creepName);
		var roomName = self.creeps[creepName].memory.goal;
		self.creeps[creepName].memory.baseRoom = roomName;
	}
	updateRequisitions () {
		var self = this;
		var roomsNeedingLoaders : string[] = [];
		_.forEach(self.memory.missions, function (missions, priority) {
			_.forEach(missions, function (mission) {
				var roomName = mission.other.roomName;
				if(!roomName) {
					return true;
				}
				var room = Game.rooms[roomName];
				if(room && room.controller && room.controller.my) {
					roomsNeedingLoaders.push(roomName);
				}
			});
		});
		var currentLoaders = _.groupBy(self.creeps, function (creep) {
			return creep.memory.baseRoom;
		});
		var requisitions : creepDescription[] = [];
		_.forEach(roomsNeedingLoaders, function (roomName) {
			var room = Game.rooms[roomName];
			if(!room) {
				return true;
			}
			var requiredLoaders = 1;
			if(self.parentClaim == roomName) {
				requiredLoaders++;
			}
			if(room.controller && room.controller.level >= 7) {
				requiredLoaders++;
			}

			if(currentLoaders[roomName].length <= requiredLoaders) {
				return true;
			}
			var power = self.loaderCarry() / 50;

			requisitions.push({
				power: power,
				type: 'transporter',
				memory: {},
				id: roomName,
				jobName: self.name,
				parentClaim: self.parentClaim,
				waitingSince: Game.time,
				newClaim: undefined
			});
		});
		self.jobs.spawn.addRequisition(requisitions);
	}
	assignMissions() {
		var self = this;
		var freeWorkers = self.getFreeWorkers();
		var groupedFreeWorkers = _.groupBy(freeWorkers, function (creep) {
			return creep.memory.baseRoom;
		});
		var priorities = _.keys(self.memory.missions).sort();
		_.forEach(priorities, function (priority) {
			var freeWorkers = self.getFreeWorkers();
			if(freeWorkers.length == 0) {
				return false;
			}
			var priorityMissions = self.memory.missions[priority];
			if(priorityMissions.length == 0) {
				return true;
			}
			_.forEach(priorityMissions, function (mission: Mission){
				var roomName = mission.other.roomName || self.parentClaim;
				var workersAvailable = groupedFreeWorkers[roomName];
				if(mission.maxWorkers <= mission.creeps.length) {
					return true;
				} else if(workersAvailable.length == 0) {
					return true;
				} else if(mission.maxWorkers > mission.creeps.length + workersAvailable.length) {
					//all remaining creeps can be assigned to this mission
					mission.creeps.push(..._.map(workersAvailable, function (creep) {
						creep.cleanup([]);
						self.missionGenerators[mission.missionName][mission.missionInit](creep);
						creep.memory.onMission = true;
						return creep.name;
					}));
					groupedFreeWorkers[roomName] = [];
					return false;
				} else {
					// assign some creeps to this mission
					var neededWorkers = mission.maxWorkers - mission.creeps.length;
					mission.creeps.push(..._.map(_.take(workersAvailable, neededWorkers), function (creep) {
						creep.cleanup([]);
						self.missionGenerators[mission.missionName][mission.missionInit](creep);
						creep.memory.onMission = true;
						return creep.name;
					}));
					groupedFreeWorkers[roomName] = _.takeRight(workersAvailable, workersAvailable.length - neededWorkers);
					return true;
				}
			});
		});
	}
}