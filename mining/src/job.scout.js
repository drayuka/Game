/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('job');
 * mod.thing == 'a thing'; // true
 */
var utils = require('utils');
var goal = require('goal');
var job = require('job');
var creep = require('creep');
// can be called with just name, or with target as well
class scout extends job {
    execute() {
        var self = this;
        self.reassessScoutingSites();
        self.updateObservers();
        self.updateRequisition();
        self.controlWorkers();
    }
    removeRoom(roomName) {
        var self = this;
        _.forEach(self.goals[roomName].assignments, function (creepName) {
            self.creeps[creepName].sucide();
        });
        self.removeGoal(roomName);
    }
    addRoomToScout(roomName) {
        var self = this;
        var scoutedRooms = _.map(self.goals, function (goal) {
            return goal.roomName;
        });
        if(_.includes(scoutedRooms, roomName)) {
            return;
        }
        var positions = [new RoomPosition(25,25,roomName)];
        self.addGoal(roomName, roomName, {halts: 1});
        self.goals[roomName].permanentPositions = positions;
        return 1;
    }
    reassessScoutingSites() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            if(!Game.rooms[goal.roomName]) {
                return true;
            }
            var ownedStructures = Game.rooms[goal.roomName].find(FIND_MY_STRUCTURES);
            if(ownedStructures.length) {
                self.removeRoom(goal.roomName);
            }
        });
    }
    updateRequisition() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            if(goal.assignments.length != 0) {
                return true;
            }
            global.jobs.spawn.addRequisition(self.name, 'scout', 1, goal.id, {});
        });
    }
    get observers () {
        var self = this;
        if(self._observers) {
            return self._observers;
        }
        self._observers = _.map(self.memory.observers, function (obs) {
            return Game.getObjectById(obs);
        });
        return self._observers;
    }
    updateObservers() {
        var self = this;
        var newObservers = [];
        _.forEach(global.claimedRooms, function (roomName) {
            if(!Game.rooms[roomName]) {
                return true;
            }
            var observer = Game.rooms[roomName].find(FIND_MY_STRUCTURES, {filter: function (struct) {
                return struct.structureType == STRUCTURE_OBSERVER;
            }});
            if(observer.length > 0) {
                newObservers.push(observer[0].id);
            }
        });
        self.memory.observers = _.union(self.memory.observers, newObservers);
        delete self._observers;
    }
    controlWorkers() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            if(goal.assignments.length == 0 && self.observers.length != 0) {
                var observer = self.observers.shift();
                observer.observeRoom(goal.roomName);
            } else {
                _.forEach(goal.assignments, function (creepName) {
                    self.controlCreep(self.creeps[creepName]);
                })
            }
        })
    }
    controlCreep(myCreep) {
        var self = this;
        if(myCreep.pos.roomName == myCreep.goal.roomName) {
            if(myCreep.pos.x == 0 || myCreep.pos.x == 49 || myCreep.pos.y == 0 || myCreep.pos.y == 49) {
                myCreep.navigate();
            } else {
                myCreep.moveOffRoad();
            }
        } else {
            if(self.observers.length > 0) {
                var observer = self.observers.shift();
                observer.observeRoom(myCreep.goal.roomName);
            }
            myCreep.navigate();
        }
    }
}
module.exports = scout;