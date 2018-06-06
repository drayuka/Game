import {Utils as utils} from "./utils";

interface buildLocation {
	pos: RoomPosition,
	structureType: StructureConstant
}
type BuildList = {
	[k in StructureConstant]: buildLocation[]
}
type stages = 
	'init'|
	'rcl1'|
	'rcl2'|
	'rcl3'|
	'rcl4'|
	'rcl5'|
	'rcl6'|
	'rcl7'|
	'rcl8'|
	'final';

interface BuildPlan {
	stages?: {
		[K in stages]: BuildList
	}
	total?: BuildList
	lowestCost?: number
	prevHashes?: string[]
	buildingPlacementStage?: string,
	buildingPlacementIndex?: number,
	buildingPlacementCount?: number
	planningStatus: 'initial'|'opt'|'staging'|'final'
}

var buildingPlacement = { 
	init: [
		{STRUCTURE_SPAWN: 1},
		{"containerasstorage": 1},
		{"sources":0},//means all
		{"upgrade":0}
	],
	rcl2: [
		{STRUCTURE_EXTENSION: 5}
	],
	rcl3: [
		{STRUCTURE_EXTENSION: 5}
	],
	rcl4: [
		{STRUCTURE_EXTENSION: 10},
		{STRUCTURE_STORAGE: 1},
	],
	rcl5: [
		{STRUCTURE_EXTENSION: 10},
		{'upgradelinks': 2},
		{STRUCTURE_TOWER: 2}
	],
	rcl6: [
		{STRUCTURE_EXTENSION: 10},
		{STRUCTURE_TERMINAL: 1},
		{STRUCTUTRE_EXTRACTOR: 1},
		{"upgradelinks":1},
	],
	rcl7: [
		{STRUCTURE_EXTENSION: 10},
		{STRUCTURE_SPAWN: 1},
		{"upgradelinks":1},
	],
	rcl8: [
		{STRUCTURE_EXTENSION: 10},
		{STRUCTURE_SPAWN: 1},
		{"borderdefenses": 0}, //build the first border defenses, may have to move this forward
		{STRUCTURE_TOWER: 4},
	],
	final: [
		{"sourcelinks":0},//signifies that we want to delete upgrade links except for 1 and change them to source links
		{STRUCTURE_NUKER: 1},
		{STRUCTURE_OBSERVER: 1}
	]
}


export class Placement {
	execute () {
		var self = this;
		self.developBuildPlan();
		self.visualizeBuildPlan();
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
				total: undefined,
				planningStatus: 'initial',
				buildingPlacementIndex: 0
			}
			self.buildPlans[self.currentRoom] = buildPlan;
		}

		if(buildPlan.planningStatus == 'initial') {
			self.runInitalPlanning(buildPlan);
		} else if(buildPlan.planningStatus == 'opt') {
			self.iterateBuildPlan(buildPlan);
		} else if(buildPlan.planningStatus == 'staging') {
			self.stageBuildPlan(buildPlan);
		} else {
			// this should cause the next get of this variable to pull the next room off of the queue
			self.currentRoom = undefined;
		}
	}
	/*
	inital placement should record any pre-existing buildings/construction sites
	then begin to place all possible buildings
	order should probably be roughly the order defined by the stages
	starts at < 5 from the controller for that room

	*/
	runInitalPlanning(buildPlan: BuildPlan) {
		var self = this;

	}
	iterateBuildPlan(buildPlan: BuildPlan) {
		var self = this;
	}
	stageBuildPlan(buildPlan: BuildPlan) {
		var self = this;
	}
	existingStructures(roomName: string, structureType: StructureConstant) : (Structure | ConstructionSite)[] {
		var room = Game.rooms[roomName];
		if(!room) {
			throw new Error('cant find structures in a room we have no visibility into');
		}
		return _.union(room.find(FIND_STRUCTURES, {filter: function(struct : Structure){
			return struct.structureType == structureType;
		}}), room.find(FIND_CONSTRUCTION_SITES, {filter: function(site : ConstructionSite) {
			return site.structureType == structureType;
		}}));
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