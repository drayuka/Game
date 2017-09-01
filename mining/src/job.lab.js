/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('job.upgradeController');
 * mod.thing == 'a thing'; // true
 */
var job = require('job');
var goal = require('goal');
var utils = require('utils');
var creep = require('creep');
var build = require('build');
class lab extends job {
    execute() {
        var self = this;
        self.maintainLabs();
        self.updateRequisition();
        self.controlWorkers();
    }
    checkForNewLabs (roomName) {
    	var self = this;
    	if(!Game.rooms[roomName]) {
    		return 0;
    	}
    	var room = Game.rooms[roomName];
    	if(!self.memory.rooms) {
    		self.memory.rooms = {};
    	}
    	if(!self.memory.rooms[roomName]) {
    		self.memory.rooms[roomName] = {
    			labCount: 0
    		};
    	}
    	var roomMemory = self.memory.rooms[roomName];
    	if(roomMemory.labCount == CONTROLLER_STRUCTURES['lab'][room.controller.level]) {
    		return 1;
    	}
    	if(!roomMemory.seedPos) {
    		var seedFlag = room.find(FIND_FLAGS, function (flag) {
    			if(flag.color == COLOR_CYAN && flag.secondaryColor == COLOR_BROWN) {
    				return 1;
    			}
    			return 0;
    		});
    		if(seedFlag.length > 0) {
    			console.log('found multiple lab seed pos flags')
    		}
    		if(seedFlag.length == 0) {
    			console.log('couldnt find a lab seed pos flag');
    		}
    		var result = self.addSeedPosFlag(seedFlag[0]);
    		if(!result) {
    			console.log('tried to add flag at ' + seedFlag[0].pos + ' but couldnt');
    			return 0;
    		}
    	}
    	var newLabs = CONTROLLER_STRUCTURES['lab'][room.controller.level] - roomMemory.labCount;

    	self.addLabs(roomName, newLabs);

    	if(roomMemory.labCount < CONTROLLER_STRUCTURES['lab'][room.controller.level]) {
    		return 0;
    	}
    	return 1;
    }
    addSeedPosFlag(flag) {
    	var self = this;
    	var positions = utils.openPositionsAround([{pos: flag.pos, maxRange: 3, minRange: 0}], {noRoads: true});
    	var availableLocations = {topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0};
    	_.forEach(positions, function (pos) {
    		var dx = pos.x - flag.pos.x;
    		var dy = pos.y - flag.pos.y;
    		if((Math.abs(dx) == 3 && dy == 0) || (Math.abs(dy) == 3 && dx == 0)) {
    			return true;
    		}
    		if(dx == 0 && dy > 0) {
    			availableLocations.topLeft++;
    			availableLocations.topRight++;
    		} else if(dx == 0 && dy < 0) {
    			availableLocations.bottomLeft++;
    			availableLocations.bottomRight++;
    		} else if(dy == 0 && dx < 0) {
    			availableLocations.bottomLeft++;
    			availableLocations.topLeft++;
    		} else if(dy == 0 && dx > 0) {
    			availableLocations.bottomRight++;
    			availableLocations.topRight++;
    		}
    	});

    	var locations = [];
    	_.forEach(availableLocations, function (loc, dir) {
    		if(loc >= 13) {
    			locations.push(dir);
    		}
    	});
    	if(locations.length == 0) {
    		return false;
    	}
    	if(!self.memory.rooms || !self.memory.rooms[flag.pos.roomName]) {
    		return false;
    	}
    	var roomMemory = self.memory.rooms[flag.pos.roomName];
    	roomMemory.seedPos = [flag.pos.x, flag.pos.y, flag.pos.roomName];
    	roomMemory.direction = locations[0];
    	return true;
    }
    get posList () {
    	var self = this;
    	return [[3,1,1,0],
    					[1,3,2,1],
    					[1,2,3,1],
    					[0,1,1,3]]
    }
    addLabs(roomName, count) {
    	var self = this;
    	if(!Game.rooms[roomName]) {
    		return;
    	}
    	var room = Game.rooms[roomName];
    	if(!self.memory.rooms || !self.memory.rooms[roomName]) {
    		return;
    	}
    	var roomMemory = self.memory.rooms[roomName];
    	if(!roomMemory.seedPos) {
    		return;
    	}
    	var seedPos = new RoomPosition(...roomMemory.seedPos);
    	var qx = 0;
    	var qy = 0;
    	if(roomMemory.direction == 'bottomRight') {
    		qx = 0;
    		qy = -1;
    	} else if(roomMemory.direction == 'topLeft') {
    		qx = -1;
    		qy = 0;
    	} else if(roomMemory.direction == 'topRight') {
    		qx = 0;
    		qy = 0;
    	} else if(roomMemory.direction == 'bottomLeft') {
    		qx = -1;
    		qy = -1;
    	}
    	var road = [];
    	var primaryLab = [];
    	var secondaryLab = [];
    	_.forEach(self.posList, function (posRow, yind) {
    		_.forEach(posRow, function (marker, xind) {
    			if(!marker) {
    				return true;
    			}
    			var newPos = self.getVectorPos(seedPos, xind * qx, yind * qy);
    			if(marker == 3) {
    				road.push(newPos);
    			} else if(marker == 2) {
    				primaryLab.push(newPos);
    			} else if(marker == 1) {
    				secondaryLab.push(newPos);
    			}
    		});
    	});
    	_.forEach(road, function (roadPos) {
    		var road = utils.getRoadAtPos(roadPos);
    		if(road) {
    			return true;
    		}
    		build.newBuild(roadPos, STRUCTURE_ROAD, {deleteOnFinish: true});
    	});
        var numLabsBuilt = 0;
    	_.forEach(primaryLab, function (plabPos) {
    		var lab = utils.getStructureAtPos(plabPos, STRUCTURE_LAB);
    		if(lab) {
    			return true;
    		}
    		var buildId = build.newBuild(plabPos, STRUCTURE_LAB);
            roomMemory.labs.push({build: buildId, type: 'primary'});
            numLabsBuilt++;
    	});
        _.forEach(secondaryLab, function (slabPos) {
            if(numLabsBuilt >= count) {
                return false;
            }
            var lab = utils.getStructureAtPos(slabPos, STRUCTURE_LAB);
            if(lab) {
                return true;
            }
            var buildId = build.newBuild(slabPos, STRUCTURE_LAB);
            roomMemory.labs.push({build: buildId, type: 'secondary'});
            numLabsBuilt++;
        });
    }
    getVectorPos(pos, dx, dy) {
    	var self = this;
    	if(pos.x + dx < 0 || pos.x + dx > 49 || pos.y + dy < 0 || pos.y + dy > 49) {
    		throw new Error('cant get a position (' + pos.x + ', ' + pos.y + ') from ' + pos);
    	}
    	return new RoomPosition(pos.x + dx, pos.y + dy, pos.roomName);
    }
    setupBoostCreeps(roomName, boostMinerals) {
        var self = this;
    }
}
module.exports = lab;
