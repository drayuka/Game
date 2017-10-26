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
class reserve extends JobClass {
    execute() {
        var self = this;
        self.reassessSites();
        self.updateRequisition();
        self.controlWorkers();
    }
    addRoomToReserve(roomName) {
        var self = this;
        var room = Game.rooms[roomName];
        if(!room) {
            throw new Error('do not have visibility into ' + roomName);
        }
        if(self.goals[room.controller.id]) {
            return;
        }
        self.addGoal(roomName, room.controller, {range: 1, halts: 1});
        return 1;
    }
    removeRoom(roomName) {
        var self = this;
        var room = Game.rooms[roomName];
        if(!room) {
            throw new Error('do not have visibility into ' + roomName);
        }
        _.forEach(self.goals[room.controller.id].assignments, function (creepName) {
            self.creeps[creepName].suicide();
        });
        self.removeGoal(room.controller.id);
    }
    reassessSites() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            if(Game.rooms[goal.roomName] && Game.rooms[goal.roomName].controller.my) {
                self.removeGoal(goal.id);
            }
        });
    }
    updateRequisition() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            if(goal.assignments.length != 0 || (goal.target && goal.target.reservation && goal.target.reservation.ticksToEnd > 4000)) {
                return true;
            }
            global.jobs.spawn.addRequisition(self.name, 'claim', 2, goal.id, {});
        });
    }
    controlWorkers() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            _.forEach(goal.assignments, function (creepName) {
                self.controlCreep(self.creeps[creepName]);
            });
        });
        _.forEach(self.getUnassignedCreeps(), function(creep) {
            creep.moveOffRoad();
        });
    }
    controlCreep(myCreep) {
        var self = this;
        if(myCreep.arrived()) {
            myCreep.reserveController(myCreep.goal.target);
        } else {
            myCreep.navigate();
        }
    }
}
module.exports = reserve;