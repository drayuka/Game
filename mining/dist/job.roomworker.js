/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('type.worker');
 * mod.thing == 'a thing'; // true
 */
var utils = require('utils');
var goal = require('goal');
var job = require('job');
var creep = require('creep');
class roomworker extends job {
    execute() {
        var self = this;
        self.deleteGoals();
        if (Game.time % 20) {
            self.findGoals();
            self.raiseDefenseMaximums();
        }
        self.deactivateGoals();
        self.assignGoals();
        self.updateRequisition();
        self.controlWorkers();
    }
    get cleanGoalPositions() {
        var self = this;
        return true;
    }
    removeCreep(creepName) {
        var self = this;
        var workRoom = Memory.creeps[creepName].workRoom;
        self.memory.roomAssignments[workRoom] = _.difference(self.memory.roomAssignments[workRoom], [creepName]);
        super.removeCreep(creepName);
    }
    addCreep(creepName) {
        var self = this;
        var myCreep = global.creeps[creepName];
        if (!myCreep) {
            throw new Error('could not find creep to add ' + creepName);
        }
        myCreep.job = self;
        self.memory.creeps.push(creepName);
        if (self._creeps) {
            self._creeps[creepName] = myCreep;
        }
        var creepRoom = myCreep.memory.goal;
        delete myCreep.memory.goal;
        if (!creepRoom) {
            throw new Error('adding creep with no room ' + creepName);
        }
        if (!self.memory.roomAssignments[creepRoom]) {
            throw new Error('adding creep ' + creepName + ' with room that doesnt exist ' + creepRoom);
        }
        myCreep.memory.workRoom = creepRoom;
        self.memory.roomAssignments[creepRoom].push(creepName);
    }
    get keeps() {
        return ['workRoom'];
    }
    removeRoom(roomName) {
        var self = this;
        self.memory.activeRooms = _.difference(self.memory.activeRooms, [roomName]);
        if (self.memory.roomAssignments && self.memory.roomAssignments[roomName]) {
            _.forEach(self.memory.roomAssignments[roomName], function (creepName) {
                self.creeps[creepName].suicide();
            });
            delete self.memory.roomAssignments[roomName];
        }
        _.forEach(self.getGoalsInRoom(roomName), function (goal) {
            self.removeGoal(goal.id);
        });
    }
    addRoom(roomName) {
        var self = this;
        self.memory.activeRooms = _.union([roomName], self.memory.activeRooms);
        if (!self.memory.roomAssignments) {
            self.memory.roomAssignments = {};
        }
        self.memory.roomAssignments[roomName] = [];
        if (!self.memory.defenseMaximum) {
            self.memory.defenseMaximum = {};
        }
        self.memory.defenseMaximum[roomName] = 10000;
        self.findGoalsInRoom(roomName);
        return 1;
    }
    get priority() {
        var self = this;
        return {
            'spawn': 2,
            'extension': 2,
            'tower': 1,
            'lab': 4,
            'road': 3,
            'constructedWall': 6,
            'rampart': 6,
        };
    }
    findGoalsInRoom(roomName) {
        var self = this;
        if (!Game.rooms[roomName]) {
            return;
        }
        var room = Game.rooms[roomName];
        var newSites;
        if (room.controller.my) {
            newSites = room.find(FIND_STRUCTURES, { filter: function (structure) {
                    if (self.goals[structure.id]) {
                        return 0;
                    }
                    if (_.includes([STRUCTURE_ROAD, STRUCTURE_WALL, STRUCTURE_RAMPART, STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_TOWER, STRUCTURE_LAB], structure.structureType)
                        && structure.isActive()) {
                        return 1;
                    }
                    return 0;
                } });
        }
        else {
            newSites = room.find(FIND_STRUCTURES, { filter: function (structure) {
                    if (self.goals[structure.id]) {
                        return 0;
                    }
                    if (structure.structureType == STRUCTURE_ROAD) {
                        return 1;
                    }
                    return 0;
                } });
        }
        if (newSites.length > 0) {
            _.forEach(newSites, function (site) {
                var halts = 0;
                var range = 1;
                if (_.includes([STRUCTURE_ROAD, STRUCTURE_WALL, STRUCTURE_RAMPART], site.structureType)) {
                    halts = 1;
                    range = 3;
                }
                self.addGoal(site.pos.roomName, site, { range: range, priority: self.priority[site.structureType], halts: halts });
            });
        }
        var newDefenseConstructionSites = room.find(FIND_MY_CONSTRUCTION_SITES, { filter: function (structure) {
                if (self.goals[structure.id]) {
                    return 0;
                }
                return 1;
            } });
        if (newDefenseConstructionSites.length > 0) {
            _.forEach(newDefenseConstructionSites, function (site) {
                self.addGoal(site.pos.roomName, site, { range: 3, priority: 5, halts: 1 });
            });
        }
    }
    findGoals() {
        var self = this;
        _.forEach(self.memory.roomAssignments, function (creeps, roomName) {
            self.findGoalsInRoom(roomName);
        });
    }
    raiseDefenseMaximums() {
        var self = this;
        _.forEach(self.memory.roomAssignments, function (creeps, roomName) {
            var defenseGoals = _.filter(self.getGoalsInRoom(roomName), function (goal) {
                if (goal.target.structureType == STRUCTURE_RAMPART || goal.target.structureType == STRUCTURE_WALL) {
                    return 1;
                }
                return 0;
            });
            if (defenseGoals.length == 0) {
                return true;
            }
            var activeGoals = _.filter(defenseGoals, function (goal) {
                if (goal.target.hits < self.memory.defenseMaximum[goal.roomName]) {
                    return 1;
                }
                return 0;
            });
            if (activeGoals.length == 0) {
                self.memory.defenseMaximum[roomName] += self.defenseIncrement;
                console.log('defense maximum for ' + roomName + ' is now ' + self.memory.defenseMaximum[roomName]);
            }
        });
    }
    get defenseIncrement() {
        return 5000;
    }
    prioritizeRoomGoals(goals) {
        var self = this;
        var indexedGoals = _.groupBy(goals, function (goal) {
            // to give a high priority to ramparts that might go away.
            if (goal.target.structureType == STRUCTURE_RAMPART && goal.target.hits < self.defenseIncrement) {
                return 2;
            }
            else if (self.checkIfGoalValid(goal)) {
                return goal.meta.priority;
            }
            else {
                return 100;
            }
        });
        delete indexedGoals[100];
        return indexedGoals;
    }
    checkIfGoalValid(goal, deactivation) {
        var self = this;
        if (goal.assignments.length != 0 && !deactivation) {
            return false;
        }
        if (goal.meta.priority == 5) {
            return true;
        }
        if (goal.target.structureType == STRUCTURE_ROAD) {
            if (goal.assignments.length != 0) {
                return false;
            }
            if (deactivation) {
                if (goal.target.hits >= goal.target.hitsMax) {
                    return false;
                }
            }
            else {
                if ((goal.target.hits / goal.target.hitsMax) > .6) {
                    return false;
                }
            }
            return true;
        }
        if (goal.target.structureType == STRUCTURE_WALL || goal.target.structureType == STRUCTURE_RAMPART) {
            if (goal.target.hits >= self.memory.defenseMaximum[goal.roomName] || goal.target.hits >= goal.target.hitsMax) {
                return false;
            }
            else {
                return true;
            }
        }
        if (_.includes([STRUCTURE_LAB, STRUCTURE_TOWER, STRUCTURE_EXTENSION, STRUCTURE_SPAWN], goal.target.structureType)) {
            if (goal.target.energy >= goal.target.energyCapacity) {
                return false;
            }
            else {
                return true;
            }
        }
    }
    deleteGoals() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            if (!Game.rooms[goal.roomName]) {
                return true;
            }
            var room = Game.rooms[goal.roomName];
            if (goal.id && !Game.getObjectById(goal.id)) {
                self.removeGoal(goal.id);
                return true;
            }
        });
    }
    deactivateGoals() {
        var self = this;
        _.forEach(self.memory.roomAssignments, function (creepNames, roomName) {
            _.forEach(creepNames, function (creepName) {
                var goal = self.creeps[creepName].goal;
                var creep = self.creeps[creepName];
                if (goal && goal.job.name == self.name && !self.checkIfGoalValid(goal, 1)) {
                    self.removeCreepFromGoal(creepName, goal.id);
                }
            });
        });
    }
    assignGoals() {
        var self = this;
        var unAssignedCreepsByRoom = _.groupBy(self.getUnassignedCreeps(), function (creep) {
            return creep.memory.workRoom;
        });
        _.forEach(self.memory.roomAssignments, function (creepNames, roomName) {
            if (!unAssignedCreepsByRoom[roomName]) {
                return true;
            }
            var prioritizedRoomGoals = self.prioritizeRoomGoals(self.getGoalsInRoom(roomName));
            if (_.keys(prioritizedRoomGoals).length == 0) {
                return true;
            }
            var index = 0;
            var validPriority = 0;
            _.forEach(unAssignedCreepsByRoom[roomName], function (creep) {
                var validGoals = [];
                if (!prioritizedRoomGoals[validPriority] || prioritizedRoomGoals[validPriority].length == 0) {
                    for (var i = validPriority; i < 100; i++) {
                        if (prioritizedRoomGoals[i]) {
                            validGoals = prioritizedRoomGoals[i];
                            validPriority = i;
                            break;
                        }
                    }
                    validGoals = prioritizedRoomGoals[validPriority];
                }
                else {
                    validGoals = prioritizedRoomGoals[validPriority];
                }
                if (validGoals.length == 0) {
                    return false;
                }
                var sortedRoomGoals = _.sortBy(validGoals, function (goal) {
                    if (creep.pos.roomName != goal.roomName) {
                        return 50;
                    }
                    else {
                        return creep.pos.getRangeTo(goal.target.pos);
                    }
                });
                var validGoal = sortedRoomGoals.shift();
                prioritizedRoomGoals[validPriority] = sortedRoomGoals;
                self.assignCreepToGoal(creep.name, validGoal.id);
            });
        });
    }
    updateRequisition() {
        var self = this;
        _.forEach(self.memory.roomAssignments, function (creepNames, roomName) {
            var room = Game.rooms[roomName];
            if (!room) {
                return true;
            }
            if (self.getGoalsInRoom(roomName).length == 0) {
                return true;
            }
            var maxCreeps = 1;
            var maxCreepSize = 2;
            if (room.controller.my) {
                maxCreepSize = 6;
            }
            if (room.controller.level >= 7) {
                maxCreeps = 2;
            }
            if (creepNames.length < maxCreeps) {
                global.jobs.spawn.addRequisition(self.name, 'roomworker', maxCreepSize, roomName, {});
            }
        });
    }
    // this job uses roomNames as goal ids for spawning so when spawn asks this question
    // the goalId is actually the roomName already
    getRoomForGoal(goalId) {
        var self = this;
        return goalId;
    }
    controlWorkers() {
        var self = this;
        _.forEach(self.memory.roomAssignments, function (creepNames) {
            _.forEach(creepNames, function (creepName) {
                if (self.creeps[creepName].goal) {
                    self.controlCreep(self.creeps[creepName]);
                }
                else {
                    self.creeps[creepName].moveOffRoad();
                }
            });
        });
    }
    controlCreep(myCreep) {
        var self = this;
        if (myCreep.energy == 0 && !myCreep.memory.gettingEnergy) {
            myCreep.memory.arrived = 0;
            var closestStorage = _.find(global.jobs.logistics.getStoragesAtRange(myCreep.goal.roomName, 3), function (storage) {
                if (storage.store[RESOURCE_ENERGY] != 0) {
                    return 1;
                }
                return 0;
            });
            if (!closestStorage) {
                throw new Error('cant find a storage in range of room ' + myCreep.goal.roomName);
            }
            self.removeCreepFromGoal(myCreep.name, myCreep.goal.id);
            myCreep.goal = global.jobs.logistics.goals[closestStorage.id];
            myCreep.memory.gettingEnergy = 1;
        }
        else if (myCreep.energy != 0 && myCreep.memory.gettingEnergy) {
            myCreep.memory.arrived = 0;
            delete myCreep.memory.gettingEnergy;
            myCreep.cleanup(self.keeps);
            return;
        }
        myCreep.navigate();
        if (myCreep.arrived()) {
            if (myCreep.memory.gettingEnergy) {
                myCreep.withdraw(myCreep.goal.target, RESOURCE_ENERGY);
            }
            else if (Game.constructionSites[myCreep.goal.id]) {
                myCreep.build(myCreep.goal.target);
            }
            else if (_.includes([STRUCTURE_LAB, STRUCTURE_EXTENSION, STRUCTURE_SPAWN, STRUCTURE_TOWER], myCreep.goal.target.structureType)) {
                myCreep.transfer(myCreep.goal.target, RESOURCE_ENERGY);
            }
            else {
                myCreep.repair(myCreep.goal.target);
            }
        }
    }
}
module.exports = roomworker;
