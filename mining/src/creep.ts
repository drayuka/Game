/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('type.worker');
 * mod.thing == 'a thing'; // true
 */
var goal = require('goal');

class CreepClass extends Creep {
    _path: RoomPosition[] | undefined;
    _job: JobClass;
    _goal: GoalClass;
    constructor (creep: Creep) {
        super(creep.id);
    }
    get creep () {
        throw new Error('this is no longer neccesary all functions are now a part of the main creep object');
    }
    get energy () {
        var self = this;
        return self.carry[RESOURCE_ENERGY]; 
    }
    get upgradePower () {
        var self = this;
        return _.reduce(self.body, function (total, part) {
            if(part.type == 'work') {
                return total + 1;
            }
            return total;
        },0);
    }
    moveOffRoad () : void {
        var self = this;
        if(global.utils.getRoadAtPos(self.pos)) {
            let room: Room;
            if(Game.rooms[self.pos.roomName]) {
                room = Game.rooms[self.pos.roomName];
            } else {
                return;
            }
            if (!self.memory.path || self.memory.path.length == 0) {
                let roadsInRoom = <Array<RoomObject>>room.find(FIND_STRUCTURES, {filter: function (struct: Structure) {
                    if(struct.structureType == STRUCTURE_ROAD) {
                        return true;
                    }
                    return 0;
                }});
                roadsInRoom = _.union(roadsInRoom, <Array<RoomObject>>Game.rooms[self.pos.roomName].find(FIND_CONSTRUCTION_SITES, {filter: function (site: ConstructionSite) {
                    if(site.structureType == STRUCTURE_ROAD) {
                        return 1;
                    }
                    return 0;
                }}));
                var goals = _.map(roadsInRoom, function (road) {
                    return {pos: road.pos, range: 1}
                });
                self.path = self.findPath(goals, true);
            }
            self.navigate();
        }
        self.memory.arrived = 1;
    }
    maintain () {
        var self = this;
        if(self.memory.maintain == Game.time) {
            return;
        }
        self.memory.maintain = Game.time;
        if(self.memory.path && self.memory.path.length > 0) {
            if(typeof self._path != undefined) {
                throw new Error('self._path should not be defined while maintaining');
            }
            if(self.nextPathPos.isEqualTo(self.pos)) {
                self.memory.path = _.drop(self.memory.path);
                self.moveFailure = 0;
            } else {
                var nextPos = self.nextPathPos;
                var pos = self.pos;
                // crossed room boundary
                if(nextPos.roomName != pos.roomName && (nextPos.x == pos.x || nextPos.y == pos.y)) {
                    self.memory.path = _.drop(self.memory.path,2);
                    self.moveFailure = 0;
                }
            }
        }
    }
    arrived () {
        var self = this;
        if(self.memory.arrived) {
            return 1;
        }
        if(self.path && self.path.length != 0) {
            return 0;
        }
        if(self.path && self.path.length == 0) {
            var posAt = _.find(self.goal.positions, function (pos) {
                return self.pos.isEqualTo(pos);
            });
            if(posAt) {
                delete self.memory.path;
                self.memory.arrived = 1;
                return 1;
            }
        }
        return 0;
    }
    set job (job : JobClass) {
        var self = this;
        if(typeof job == 'string') {
            self._job = global.jobs[<string>job];
            self.memory.jobName = job;
        } else {
            self._job = job;
            self.memory.jobName = job.name;
        }
    }
    get job () : JobClass {
        var self = this;
        if(!self._job) {
            self._job = global.jobs[self.memory.jobName];
        }
        return self._job;
    }
    get goal () {
        var self = this;
        if(!self._goal && self.memory.goal) {
            if(self.memory.goalJob) {
                self._goal = global.jobs[self.memory.goalJob].goals[self.memory.goal];
            } else {
                self._goal = self.job.goals[self.memory.goal];    
            }
        }
        return self._goal;
    }
    set goal (goal) {
        var self = this;
        if(goal.job != this.job) {
            self.memory.goalJob = goal.job.name;
        } else {
            delete self.memory.goalJob;
        }
        self._goal = goal;
        self.memory.goal = goal.id;
        self.memory.arrived = 0;
    }
    get path () {
        var self = this;
        if(self._path === undefined) {
            if(self.memory.path) {
                self._path = global.utils.deserializePath(self.memory.path);
                return self._path;
            }
            return undefined;
        } else {
            return self._path;
        }
    }
    set path (path: RoomPosition[] | undefined) {
        var self = this;
        self._path = path;
        if(path !== undefined) {
            self.memory.path = global.utils.serializePath(path);
        } else {
            delete self.memory.path;
        }
    }
    get nextPathPos () {
        var self = this;
        return new RoomPosition(self.memory.path[0][0], self.memory.path[0][1], self.memory.path[0][2]);
    }
    get lastPathPos () {
        var self = this;
        var lpos = self.memory.path.length - 1;
        return new RoomPosition(self.memory.path[lpos][0], self.memory.path[lpos][1], self.memory.path[lpos][2]);
    }
    navigate () {
        var self = this;
        if(!self.memory.path || self.memory.path.length == 0) {
            let targets: distancePos[];
            if(self.goal.roomName != self.pos.roomName) {
                var roomPath = global.utils.getRoomPath(self.pos.roomName, self.goal.roomName);
                if(typeof roomPath === 'number') {
                    throw new Error('could not path from ' + self.pos.roomName + ' to ' + self.goal.roomName);
                }
                if(roomPath.length == 1 && Game.rooms[roomPath[0].room]) {
                    targets = _.map(self.goal.positions, function (pos) {
                        return {pos: pos, range: 0}
                    });
                } else {
                    targets = <Array<distancePos>>_.map(self.room.find(roomPath[0].exit), function (site) {
                        return {pos: site , range: 0};
                    });
                }
            } else {
                targets = _.map(self.goal.positions, function (pos) {
                    return {pos: pos, range: 0};
                });
            }
            self.path = self.findPath(targets, false);
        }
        if(!self.memory.path || self.memory.path.length == 0) {
            return;
        }
        var result = self.moveByPath([self.nextPathPos]);
        if(result != ERR_TIRED) {
            //assume we failed until the next tick when we will delete the moveFailure if we moved to our first
            //path coordinate
            self.moveFailure++;
            if(self.moveFailure > 4) {
                self.memory.path = undefined;
                self._path = undefined;
                self.moveFailure = 0;
            }
        }
    }
    get moveFailure () {
        var self = this;
        return self.memory.moveFailure;
    }
    set moveFailure (val) {
        var self = this;
        self.memory.moveFailure = val;
    }
    cleanup (keeps: string[]) {
        var self = this;
        keeps.push('type', 'jobName');
        var oldMemory = self.memory;
        self.memory = {};
        _.forEach(keeps, function (keep) {
            self.memory[keep] = oldMemory[keep];
        });
        delete self._path;
        delete self._goal;
    }
    get roomCostsFunction () {
        var self = this;
        return utils.workerRoomCosts();
    }
    // returns the creeps work power modified by boosts based on type;
    workPower (type: string) {
        var self = this;
        return _.reduce(self.body, function (total, part) {
            if(part.type != 'work') {
                return total;
            }
            if(part.boost) {
                var boostFeatures = BOOSTS['work'][part.boost];
                if(boostFeatures[type]) {
                    return total + 1 * boostFeatures[type];
                }
            }
            return total + 1;
        }, 0);
    }
    partCount (type: string) {
        var self = this;
        return _.reduce(self.body, function (total, part) {
            if(part.type != type) {
                return total;
            }
            return total + 1;
        },0)
    }
    findPath (goals: {pos: RoomPosition, range: number}[], flee: boolean) {
        var self = this;
        var roomCostFunction = self.roomCostsFunction;
        if(flee) {
            roomCostFunction = global.utils.workerRoomCostsGenerator(false, true);
        }
        var ret = PathFinder.search(self.pos, goals, {
		    plainCost: 2,
			swampCost: 10,
            flee: flee,
	    	roomCallback: roomCostFunction
	    });
	    return ret.path;
    }
};

module.exports = CreepClass;