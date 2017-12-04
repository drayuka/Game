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

export class ProtectorJob extends JobClass {
    execute() {
        var self = this;
        self.reassessProtectionRooms();
        self.maintainHostileCreeps();
        self.updateRequisition();
        self.controlWarriors();
    }
    addRoomToProtect(roomName: string) {
        var self = this;
        if(self.goals[roomName]) {
            return;
        }
        self.addGoal(roomName, roomName, {hostileCreeps: [], roomGoal: true});
        self.goals[roomName].permanentPositions = [new RoomPosition(25,25, roomName)];
        return 1;
    }
    removeRoomToProtect(roomName: string) {
        var self = this;
        if(!self.goals[roomName]) {
            return;
        }
        _.forEach(self.goals[roomName].meta.hostileCreeps, function (hostileGoal) {
            _.forEach(self.goals[hostileGoal].assignments, function (creepName) {
                self.creeps[creepName].suicide();
            })
            self.removeGoal(hostileGoal);
        });
        _.forEach(self.goals[roomName].assignments, function (creepName) {
            self.creeps[creepName].suicide();
        });
        self.removeGoal(roomName);
    }
    reassessProtectionRooms() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            if(!Game.rooms[goal.roomName]) {
                return true;
            }
            var towers = <Array<StructureTower>>Game.rooms[goal.roomName].find(FIND_MY_STRUCTURES, {filter: function (struct: OwnedStructure) {
                return struct.structureType == STRUCTURE_TOWER;
            }});
            if(towers.length != 0) {
                self.removeRoomToProtect(goal.roomName);
            }
        });
    }
    maintainHostileCreeps () {
        var self = this;
        _.forEach(_.filter(self.goals, function (goal) {
            return goal.meta.roomGoal;
        }), function (goal) {
            if(!goal.meta.roomGoal) {
                return true;
            }
            if(!Game.rooms[goal.roomName]) {
                return true;
            }
            var room = Game.rooms[goal.roomName];
            var hostileCreeps = _.indexBy(<Array<Creep>>room.find(FIND_CREEPS, {filter: function (creep: Creep){
                return !creep.my;
            }}), function (creep: Creep) {
                return creep.id;
            });
            if(_.keys(hostileCreeps).length == 0 && goal.meta.hostileCreeps.length == 0) {
                return true;
            }
            var newHostileIds = _.difference(_.keys(hostileCreeps), goal.meta.hostileCreeps);
            if(newHostileIds.length > 0) {
                _.forEach(newHostileIds, function (creepId) {
                    var creep = hostileCreeps[creepId];
                    var invader = creep.owner.username == 'Invader';
                    self.addGoal(goal.roomName, creep, {invader: invader});
                });
            }
            var oldHostileIds = _.difference(goal.meta.hostileCreeps, _.keys(hostileCreeps));
            if(oldHostileIds.length != 0) {
                _.forEach(oldHostileIds, function (creepId) {
                    var creepAssignments = self.goals[creepId].assignments;
                    _.forEach(creepAssignments, function (creepName) {
                        self.assignCreepToGoal(creepName, self.goals[creepId].roomName);
                    });
                    self.removeGoal(creepId);
                });
            }
            goal.meta.hostileCreeps = _.keys(hostileCreeps);
        });
    }
    updateRequisition() {
        var self = this;
        var requisitions : creepDescription[] = [];
        _.forEach(self.goals, function (goal) {
            if(!goal.meta.roomGoal) {
                return true;
            }
            var assignments = _.reduce(goal.meta.hostileCreeps, function (total: number, creepId: string) {
                return total + self.goals[creepId].assignments.length;
            }, goal.assignments.length);
            if(assignments != 0) {
                return true;
            }
            if(goal.meta.hostileCreeps.length == 0) {
                return true;
            }
            requisitions.push({
                power: 8,
                type: 'warrior',
                memory: {},
                id: goal.id,
                jobName: self.name,
                parentClaim: self.parentClaim,
                waitingSince: Game.time,
                newClaim: undefined
            });
        });
        self.jobs.spawn.addRequisition(requisitions);

    }
    controlWarriors() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            _.forEach(goal.assignments, function (creepName) {
                self.controlWarrior(self.creeps[creepName]);
            });
        });
    }
    controlWarrior(myCreep: CreepClass) {
        var self = this;
        if(myCreep.goal.meta.roomGoal) {
            if(myCreep.pos.roomName == myCreep.goal.roomName) {
                if(myCreep.goal.meta.hostileCreeps.length != 0) {
                    var newGoalId = <string>_.sample(myCreep.goal.meta.hostileCreeps);
                    self.assignCreepToGoal(myCreep.name, newGoalId);
                    self.controlWarrior(myCreep);
                } else {
                    if(!myCreep.memory.wait) {
                        myCreep.memory.wait = Game.time + 50;
                    } else if (Game.time > myCreep.memory.wait) {
                        myCreep.suicide();
                    } else {
                        myCreep.moveOffRoad();
                    }
                }
            } else {
                myCreep.navigate();
            }
        } else {
            myCreep.moveTo(myCreep.goal.target);
        }
    }
}