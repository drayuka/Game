import immutable = require("immutable");

export class Placement {
	execute () {
		var self = this;
		self.workOnBuildQueue();
		self.developBuildPlan();
		self.visualizeBuildPlan();
	}
	workOnBuildQueue() {
		var self = this;
		var built : number = 0;
		var existing = _.keys(Game.constructionSites).length;
		_.forEach(self.memory.buildQueue, function (build) {
			if(existing + build[2] + built > 100) {
				return false;
			}
			self.buildStructure(build[0],build[1],build[2]);
			built += build[2];
		});
	}
	addToBuildQueue(roomName: string, structureType: StructureConstant, count: number) : void {
		var self = this;
		self.memory.buildQueue.push([roomName, structureType, count]);
	}
	//creates a construction site for a structure which hasn't been placed yet
	buildStructure(roomName: string, structureType: StructureConstant, count: number) : void {
		var self = this;
		var buildPlan : {[k in StructureConstant]: string[]} = self.memory.buildPlan[roomName];
		if(!buildPlan) {
			self.addToBuildQueue(roomName, structureType, count);
		}
		var structurePlan : string[] = buildPlan[structureType];
		var room = Game.rooms[roomName];
		if(!room) {
			throw new Error('cant build in a room we have no visibility into');
		}
		var roomLevel : number = 0;
		if(room.controller && room.controller.my) {
			roomLevel = room.controller.level;
		}
		var existing = _.map(self.existingStructures(roomName, structureType), function (build) {
			return (build.pos.x + '|' + build.pos.y)
		});
		var remainingPlaces = _.difference(structurePlan, existing);

		var maxNow = CONTROLLER_STRUCTURES[structureType][roomLevel];
		var maxForever = CONTROLLER_STRUCTURES[structureType][8];
		if(existing.length + count > maxNow && existing.length + count < maxForever) {
			console.log('cant build ' + count + existing.length + ' ' + structureType + '\'s in ' + roomName)
			self.addToBuildQueue(roomName, structureType, count);
			return;
		} else if(existing.length + count > maxForever) {
			throw new Error('cant build ' + count + existing.length + ' ' + structureType + '\'s in ' + roomName);
		} else if(_.keys(Game.constructionSites).length + count > 100) {
			self.addToBuildQueue(roomName, structureType, count);
			return;
		}
		var built = 0;
		_.forEach(remainingPlaces, function (place) {
			var split = place.split('|');
			var pos = RoomPosition(parseInt(split[0]),parseInt(split[1]),roomName);
			var result = pos.createConstructionSite(structureType);
			if(!result) {
				console.log('built ' + structureType + ' at ' + pos.x + ' ' + pos.y + ' ' + pos.roomName);
			} else {
				console.log('failed to build ' + structureType + ' at ' + pos.x + ' ' + pos.y + ' ' + pos.roomName + ' got error ' + result);
			}
		});
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
	iterateBuildPlan() {
		var self = this;
	}
	developBuildPlan() {
		var self = this;

		if(!self.memory.currentRoom) {
			if(self.memory.waitingRooms.length == 0) {
				return;
			}
			self.memory.currentRoom = self.memory.waitingRooms.shift();
		}
		var remainingCpu = Game.cpu.tickLimit - Game.cpu.getUsed();
		var averageUsage = self.getAverageUsage();
		while(remainingCpu > averageUsage * 3) {

		}
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
	get memory {
		var self = this;
		if(!global.memory.placement) {
			global.memory.placement = {};
		}
		return global.memory.placement;
	}
	addRoomToPlace(roomName: string) {
		var self = this;
		if(!self.memory.waitingRooms) {
			self.memory.waitingRooms = [];
		}
		self.memory.waitingRooms.push(roomName);
	}
}