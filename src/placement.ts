import {Utils as utils} from "./utils";
import {modelBuildPlan as buildPlan} from "./BuildPlan";

export interface location {
	pos: [number, number, string],
	type: structurePlacement
}

export type BuildStage = {
	[key in placementTypes]?: location[]
}
export type stages = 
	'init'|
	'rcl2'|
	'rcl3'|
	'rcl4'|
	'rcl5'|
	'rcl6'|
	'rcl7'|
	'rcl8'|
	'final';

export interface BuildPlan {
	stages: {
		[K in stages]?: BuildStage
	}
	roomName: string,
	buildingPlacementStage: stages,
}

export type structurePlacement = 
	'deliverySpace' |
	'openSpace' | 
	StructureConstant;

export type placementTypes = 
	'storage' | 
	'spawn' | 
	'source' | 
	'upgrade' | 
	'extension' | 
	'upgradelink' |
	'storagelink' |
	'tower' |
	'terminal' |
	'extractor' |
	'sourcelink' |
	'nuker' |
	'observer' |
	'lab' | 
	'deliveryRoad' |
	'travelRoad';

export type placementStage = {
	[key in placementTypes]?: number
};
export type placementPlan = {
	[key in stages]: placementStage
}

var buildingPlacement : placementPlan = {
	init: {
		storage: 1,
		spawn: 1,
		source: 0,
		upgrade:0,
		travelRoad: 0
	},
	rcl2: {
		extension: 5, // new
		storage: 1,
		spawn: 1,
		source: 0,
		upgrade: 0,
		travelRoad: 0
	},
	rcl3: {
		extension: 10, //more
		storage: 1,
		spawn: 1,
		source: 0,
		upgrade: 0,
		travelRoad: 0
	},
	rcl4: {
		extension: 20, // more
		storage: 1, // is now actual storage
		spawn: 1,
		source: 0,
		upgrade: 0,
		travelRoad: 0
	},
	rcl5: {
		extension: 30, // more
		upgradelink: 1, // new
		storagelink: 1,
		tower: 2, // new
		storage: 1,
		spawn: 1,
		source: 0,
		travelRoad: 0
	},
	rcl6: {
		extension: 40, // more
		terminal: 1, // new
		extractor: 1, // new
		upgradelink: 1, // more
		storagelink: 2,
		tower: 2,
		storage: 1,
		spawn: 1,
		source: 0,
		travelRoad: 0
	},
	rcl7: {
		extension: 50, // more
		spawn: 2, // more
		terminal: 1,
		extractor: 1,
		upgradelink: 1, // more
		storagelink: 3,
		tower: 2,
		storage: 1,
		source: 0,
		travelRoad: 0
	},
	rcl8: {
		extension: 60, // more
		spawn: 1,// more
		terminal: 1,
		extractor: 1,
		sourcelink: 0, // new, as many as the room needs
		storagelink: 1,
		storage: 1,
		source: 0,
		tower: 6, // more
		travelRoad: 0
	},
	final: {
		nuker: 1, // new
		observer: 1, // new
		lab: 10, // new
		extension: 60, 
		spawn: 3,
		terminal: 1,
		extractor: 1,
		sourcelink:0, 
		storage: 1,
		source: 0,
		tower: 6,
		travelRoad: 0
	}
}


export class Placement {
	get placementFunctions (): {[key in placementTypes] : (plan: BuildPlan, roomName: string) => void} {
		var self = this;
		return {
			storage: function (plan: BuildPlan, roomName: string) {
				//assume this is either the first building being placed, or that a hooman has placed
				//a starter building (probably the spawn) and we should base our placement off of that.
				//also assumes that no plan for init has occurred before this.
				var room = Game.rooms[roomName];
				var stage = plan.stages[plan.buildingPlacementStage]

				if(!stage) {
					return;
				}
				if(!room || !room.controller) {
					return;
				}

				var existingSpawns = stage[STRUCTURE_SPAWN];
				var existingSpawn;
				if(existingSpawns && existingSpawns.length > 0) {
					existingSpawn = existingSpawns[0];
				}
				var positionsToCheck: RoomPosition[];
				if(existingSpawn) {
					positionsToCheck = utils.openPositionsAround([{pos: utils.unfreezePos(existingSpawn.pos), minRange: 2, maxRange: 3}]);
				} else {
					positionsToCheck = utils.openPositionsAround([{pos: room.controller.pos, minRange: 5, maxRange: 10}])
				}
				
				var minPos : RoomPosition = positionsToCheck[0];
				var minDistance = 50;
				_.forEach(positionsToCheck, function (pos) {
					if(pos.x < 5 || pos.x > 45 || pos.y < 5 || pos.y > 45) {
						return true;
					}
					var distance = 0;
					var visited = new Set([pos.x + '|' + pos.y]);
					var positions: RoomPosition [] = [pos];
					
					var newPositions : RoomPosition[] = [];
					while(visited.size <= 100) {
						distance++;
						if(distance > minDistance) {
							break;
						}
						_.forEach(positions, function (newPos) {

							visited.add(newPos.x + '|' + newPos.y);
							let surrounding = utils.openPositionsAround([{pos: newPos, minRange: 1, maxRange: 1}]);
							for(let i = 0; i < surrounding.length; i++) {
								if(!visited.has(surrounding[i].x + '|' + surrounding[i].y)) {
									newPositions.push(surrounding[i]);
								}
							}
						});

						positions = newPositions;
						newPositions = [];
					}
					if(minDistance > distance) {
						minDistance = distance;
						minPos = pos;
					}
				});
				
				stage[STRUCTURE_STORAGE] = [{pos:utils.freezePos(minPos), type: STRUCTURE_SPAWN}];

				//road around storage placement
				
			},
			spawn: function (plan: BuildPlan, roomName: string) {
				var room = Game.rooms[roomName];
				if(!room || !room.controller) {
					return;
				}
				
				var stage = plan.stages[plan.buildingPlacementStage];
				
				if(!stage) {
					return;
				}

				var placedSpawns = stage['spawn'];

				if(!placedSpawns) {

				} else {
					// must be rcl 7 or 8, don't worry about this for now
					// probably want to do somehting so they aren't all positioned in the same place
				}
				


			},
			source: function (plan: BuildPlan, roomName: string) {

			},
			upgrade: function (plan: BuildPlan, roomName: string) {

			},
			extension: function (plan: BuildPlan, roomName: string) {

			},
			upgradelink: function (plan: BuildPlan, roomName: string) {

			},
			sourcelink: function (plan: BuildPlan, roomName: string) {

			},
			storagelink: function (plan: BuildPlan, roomName: string) {

			},
			tower: function (plan: BuildPlan, roomName: string) {

			},
			terminal: function (plan: BuildPlan, roomName: string) {

			},
			extractor: function (plan: BuildPlan, roomName: string) {

			},
			nuker: function (plan: BuildPlan, roomName: string) {

			},
			observer: function (plan: BuildPlan, roomName: string) {

			},
			lab: function (plan: BuildPlan, roomName: string) {

			},
			deliveryRoad: function (plan: BuildPlan, roomName: string) {
				// the goal of this should be to add road in a semi-predicatable branching manner such that we don't have too
				// many roads, but also occasionally branch roads in a manner which allows for filling space closer to storage/spawn
				// maybe also needs to develop it's own repair positions, unless we change roomworker
				// to no longer need to stop to repair road

				var room = Game.rooms[roomName];
				if(!room || !room.controller) {
					return;
				}

				var stage = plan.stages[plan.buildingPlacementStage];
				if(!stage) {
					return;
				}

				//TODO: fix this is that delivery can work without any road to start with
				// maybe have travel road always called first?

/*				var delivery = stage['deliveryRoad'];
				if(!delivery || delivery.length == 0) {
					var deliveryPositions = utils.openPositionsAround([{pos: minPos, minRange: 1, maxRange: 1}]);

					var deliveryPosition = _.sortBy(deliveryPositions, function (pos) {
						var x = pos.x - 25;
						var y = pos.y - 25;
						var distance = Math.sqrt(Math.abs(x) ^ 2 + Math.abs(y) ^ 2);
						return distance;
					})[0];

					delivery = [{pos: utils.freezePos(deliveryPosition), type: STRUCTURE_ROAD}];

					var deliveryRangePositions = _.remove(utils.openPositionsAround([{pos:deliveryPosition, minRange: 1, maxRange: 1}]), function (pos) {
						if(pos.x == minPos.x && pos.y == minPos.y) {
							return true;
						}
					});

					_.forEach(deliveryRangePositions, function (pos) {
						delivery!.push({pos: utils.freezePos(pos), type: 'deliverySpace'});
					});

					stage['deliveryRoad'] = delivery;
				
				}
*/
				var deliveryRoads : RoomPosition[] = [];
				var deliveryRanges : RoomPosition[] = [];

				var delivery = stage['deliveryRoad'];
				var sites = new Set();
				if(!delivery) {
					return;
				}
				_.forEach(delivery, function (site) {
					var pos = utils.unfreezePos(site.pos);
					if(site.type == 'deliverySpace') {
						deliveryRanges.push(pos);

					} else {
						deliveryRoads.push(pos);
					}
					sites.add(pos.x + 'y' + pos.y);
				});

				var count = deliveryRanges.length;
				var storages = stage['storage'];
				if(!storages) {
					return;
				}

				var storage : location = storages[0];

				var sortedDeliveryRanges = _.sortBy(deliveryRanges, function(pos) {
					return pos.getRangeTo(utils.unfreezePos(storage.pos));
				});

				_.forEach(sortedDeliveryRanges, function (pos) {
					var positionsAround = utils.openPositionsAround([{pos: pos, minRange: 1, maxRange: 1}]);
					var newSites = _.remove(positionsAround, function (pos) {
						if(!sites.has(pos.x + 'y' + pos.y)) {
							return true;
						}
						return false;
					});
					if(newSites.length > 3) {
						_.remove(delivery!, function (location: location) {
							if(location.pos[0] == pos.x && location.pos[1] == pos.y) {
								return true;
							}
							return false;
						});
						delivery!.push({pos: utils.freezePos(pos), type: STRUCTURE_ROAD});
						_.forEach(newSites, function (newPos) {
							delivery!.push({pos:utils.freezePos(newPos), type: 'deliverySpace'});
						})
						deliveryRanges.push(...newSites);
					}
					// stop once we have 10 more ranges
					if(deliveryRanges.length >= count + 10) {
						return false;
					}
				});
			},
			// we want this to create roads from the storage to every exit, this should be a
			// relatively straightforward path from the nearest road to a storage and any of the exits in the room.
			travelRoad: function (plan: BuildPlan, roomName: string) {
				var room = Game.rooms[roomName];
				if(!room || !room.controller) {
					return;
				}

				var stage = plan.stages[plan.buildingPlacementStage];
				if(!stage) {
					return;
				}

				var storages = stage.storage;
				if(!storages) {
					return;
				}
				var storage = storages[0];

				var roadsAroundStorage = _.remove(utils.openPositionsAround([{pos: utils.unfreezePos(storage.pos), minRange: 1, maxRange: 1}]),function (pos: RoomPosition) {
					
				});
			}
		}
	}
	getRoads(stage: BuildStage) {
		var self = this;

	}
	execute () {
		var self = this;
		self.developBuildPlan();
		self.visualizeBuildPlan();
	}
	timeLeft (placementStage: placementStage, buildPlan: BuildPlan) {
		return true;
	}
	doneWithStage(stage: placementStage, plan: BuildPlan) : boolean {
		var self = this;
		if(!self.findNextStep(stage, plan)) {
			return true;
		}
		return false;
	}
	findNextStep(stage: placementStage, plan: BuildPlan) : placementTypes | undefined {
		var self = this;
		var roomLevel = self.getRoomLevelFromStage(plan.buildingPlacementStage);
		var curStage = <BuildStage>plan.stages[plan.buildingPlacementStage];
		if(!curStage) {
			curStage = {};
		}


		return <placementTypes | undefined>_.findKey(stage, function (count, placementType : placementTypes) {
			var current = curStage[placementType];
			
			switch(placementType) {
				case 'source':
					//assume that if we've done one source, we've done them all
					if(current && current.length > 0) {
						return false;
					}
					return true;
					break;
				case 'storage':
				case 'spawn':
				case 'tower':
				case 'terminal':
				case 'extractor':
				case 'nuker':
				case 'observer':
				case 'lab':
				case 'extension':
					if(current && current.length == count) {
						return false;
					}
					return true;
					break;
				case 'upgrade':
					// upgrade only counts for non upgrade links, assume if we've done anything here it's been done fully
					if(current  && current.length > 0) {
						return false;
					}
					return true;
					break;
				case 'upgradelink':
				case 'sourcelink':
				case 'storagelink':
					var required = 0;
					var upgrade = stage['upgradelink'];
					var source = stage['sourcelink'];
					var storage = stage['storagelink'];
					if(upgrade) {
						required += upgrade;
					}
					if(source) {
						required += source;
					}
					if(storage) {
						required += storage;
					}
					if(current && current.length == required) {
						return false;
					}
					return true;
					break;
				case 'deliveryRoad':
					return false;
				case 'travelRoad':
					return false;
				break;
			}
		});
	}
	getRoomLevelFromStage(stage: stages) : number {
		var self = this;
		var level = {
			'init': 1,
			'rcl2': 2,
			'rcl3': 3,
			'rcl4': 4,
			'rcl5': 5,
			'rcl6': 6,
			'rcl7': 7,
			'rcl8': 8,
			'final': 8
		}
		return level[stage]
	}
	developBuildPlan() {
		var self = this;
		// if the current room get doesnt' have anything to pull off of the queue, then we can skip working on the build plan.
		if(!self.currentRoom) {
			return;
		}
		var buildPlan = self.buildPlans[self.currentRoom];
		if(!buildPlan) {
			buildPlan = {
				buildingPlacementStage: 'init',
				stages: {init: {}},
				roomName: self.currentRoom
			}
			self.buildPlans[self.currentRoom] = buildPlan;
		}

		var buildStage = buildingPlacement[buildPlan.buildingPlacementStage];

		while(!self.doneWithStage(buildStage, buildPlan) && self.timeLeft(buildStage, buildPlan)) {
			self.planNext(buildStage, buildPlan);
		}

		if(self.doneWithStage(buildStage, buildPlan)) {
			if(buildPlan.buildingPlacementStage == 'final') {
				self.currentRoom = undefined;
				return;
			}
			buildPlan.buildingPlacementStage = self.getNextStage(buildPlan.buildingPlacementStage);
			buildPlan.stages[buildPlan.buildingPlacementStage] = {};	
		}
	}
	planNext(stage: placementStage, plan: BuildPlan) {

	}
	getNextStage(stage: stages) : stages {
		var self = this;
		switch (stage) {
			case 'init':
			return 'rcl2';
			case 'rcl2':
			return 'rcl3';
			case 'rcl3':
			return 'rcl4';
			case 'rcl4':
			return 'rcl5';
			case 'rcl5':
			return 'rcl6';
			case 'rcl6':
			return 'rcl7';
			case 'rcl7':
			return 'rcl8';
			case 'rcl8':
			return 'final';
			case 'final':
			return 'init';
		}
	}
	/*
	inital placement should record any pre-existing buildings/construction sites
	then begin to place all possible buildings
	order should probably be roughly the order defined by the stages
	starts at < 5 from the controller for that room

	*/
	plan(buildPlan: BuildPlan) {
		var self = this;
		var stageName = buildPlan.buildingPlacementStage;
		var stage = buildPlan.stages[buildPlan.buildingPlacementStage];

	}
	existingStructures(roomName: string, structureType?: StructureConstant) : (Structure | ConstructionSite)[] {
		var room = Game.rooms[roomName];
		if(!room) {
			throw new Error('cant find structures in a room we have no visibility into');
		}
		if(!structureType) {
			return _.union(room.find(FIND_STRUCTURES), room.find(FIND_CONSTRUCTION_SITES));
		} else {	
			return _.union(room.find(FIND_STRUCTURES, {filter: function(struct : Structure){
				return struct.structureType == structureType;
			}}), room.find(FIND_CONSTRUCTION_SITES, {filter: function(site : ConstructionSite) {
				return site.structureType == structureType;
			}}));
		}
	}
	visualizeBuildPlan() {
		var self = this;

	}

	//returns a moving average for the last 20 iterations of the time taken by an iteration;
	getAverageUsage() : number {
		var self = this;
		var count = self.memory.stats.length;
		var stats = <Array<number>>self.memory.stats
		var total = _.reduce(stats, function (total, time) {
			return total + time;
		}, 0);
		return (total/count);
	}
	logUsage(timeTaken: number) : void {
		var self = this;
		if(!self.memory.stats) {
			self.memory.stats = [];
		}
		if(self.memory.stats.length >= 20) {
			self.memory.stats.shift();
		}
		self.memory.stats.push(timeTaken);
	}
	get buildPlans () : {[key:string] : BuildPlan} {
		var self = this;
		if(!self.memory.buildPlans) {
			self.memory.buildPlans = {};
		}
		return self.memory.buildPlans;
	}
	get memory () {
		var self = this;
		if(!global.memory.placement) {
			global.memory.placement = {};
		}
		return global.memory.placement;
	}
	get roomQueue () {
		var self = this;
		if(!self.memory.roomQueue) {
			self.memory.roomQueue = [];
		}
		return self.memory.roomQueue;
	}
	get currentRoom () {
		var self = this;
		if(!self.memory.currentRoom) {
			self.memory.currentRoom = self.roomQueue.shift();
		}
		return self.memory.currentRoom;
	}
	set currentRoom (value: string | undefined) {
		var self = this;
		self.memory.currentRoom = value;
	}
	addRoomToPlace(roomName: string) {
		var self = this;
		self.roomQueue.push(roomName);
	}
}