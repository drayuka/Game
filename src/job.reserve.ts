/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('job');
 * mod.thing == 'a thing'; // true
 */

import { Utils as utils } from "./utils"
import { GoalClass } from "./goal";
import { JobClass } from "./job";
import { CreepClass } from "./creep";
// can be called with just name, or with target as well
export class ReserveJob extends JobClass {
    execute() {
        var self = this;
        self.reassessSites();
        self.updateRequisition();
        self.controlWorkers();
    }
    addRoomToReserve(roomName : string) {
        var self = this;
        var room = Game.rooms[roomName];
        if(!room) {
            throw new Error('do not have visibility into ' + roomName);
        }
        if(!room.controller) {
            throw new Error('cannot reserve room with no controller');
        }
        if(self.goals[room.controller.id]) {
            return;
        }
        self.addGoal(roomName, room.controller, {range: 1, halts: 1});
        return 1;
    }
    removeRoom(roomName : string) {
        var self = this;
        var room = Game.rooms[roomName];
        if(!room) {
            throw new Error('do not have visibility into ' + roomName);
        }
        if(!room.controller) {
            throw new Error('room somehow has no controller');
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
            var controller = room.controller;
            if(room && controller && controller.my) {
                self.removeGoal(goal.id);
            }
        });
    }
    updateRequisition() {
        var self = this;
        var creeps: creepDescription[] = [];
        _.forEach(self.goals, function (goal) {
            var controller = <StructureController>goal.target;
            if(goal.assignments.length != 0 || !controller || (controller.reservation && controller.reservation.ticksToEnd > 4000)) {
                return true;
            }
            creeps.push({
                power: 2,
                type: 'claim',
                memory: {},
                id: goal.id,
                jobName: self.name,
                parentClaim: self.parentClaim,
                waitingSince: Game.time,
                newClaim: undefined
            })
        });
        self.jobs.spawn.addRequisition(creeps);
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
    controlCreep(myCreep : CreepClass) {
        var self = this;
        if(myCreep.arrived()) {
            var controller = <StructureController>myCreep.goal.target;
            myCreep.reserveController(controller);
        } else {
            myCreep.navigate();
        }
    }
}