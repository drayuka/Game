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
class ClaimJob extends JobClass {
    execute() {
        var self = this;
        self.reassessSites();
        self.updateRequisition();
        self.controlWorkers();
    }
    addRoomToClaim(roomName: string) {
        var self = this;
        var room = Game.rooms[roomName];
        if(!room) {
            throw new Error('do not have visibility into ' + roomName);
        }
        if(!room.controller) {
            throw new Error('room ' + roomName + ' does not have a controller');
        }
        if(self.goals[room.controller.id]) {
            return false;
        }
        self.addGoal(roomName, room.controller, {range: 1, halts: 1});
        return true;
    }
    removeRoom(roomName: string) {
        var self = this;
        var room = Game.rooms[roomName];
        if(!room) {
            throw new Error('do not have visibility into ' + roomName);
        }
        if(!room.controller) {
            throw new Error('somehow reserved room ' + roomName + ' doesnt have a controller');
        }
        _.forEach(self.goals[room.controller.id].assignments, function (creepName) {
            self.creeps[creepName].suicide();
        });
        self.removeGoal(room.controller.id);
    }
    reassessSites() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            var room = Game.rooms[goal.roomName];
            if(room && room.controller && room.controller.my) {
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
            self.jobs.spawn.addRequisition([{
                power: 1,
                type: 'claim',
                memory: {},
                id: goal.id,
                jobName: 'claim',
                parentClaim: self.parentClaim,
                waitingSince: Game.time,
                newClaim: undefined
            }]);
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
    controlCreep(myCreep: CreepClass) {
        var self = this;
        if(myCreep.arrived()) {
            myCreep.claimController(<StructureController>myCreep.goal.target);
        } else {
            myCreep.navigate();
        }
    }
}
module.exports = ClaimJob;