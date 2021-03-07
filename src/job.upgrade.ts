/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('job.upgradeController');
 * mod.thing == 'a thing'; // true
 */
import { GoalClass } from "./goal";
import { JobClass } from "./job";
import { CreepClass } from "./creep";
import { Utils as utils } from "./utils"
import * as _ from "lodash"
export class UpgradeJob extends JobClass {
    execute() {
        var self = this;
        self.updateWaits();
        self.updateRequisition();
        self.controlWorkers();
    }
    addRoom(roomName : string) {
        var self = this;
        var room = Game.rooms[roomName];
        if(!room) {
            throw new Error('cant see into ' + roomName);
        }
        var controller = room.controller;
        if(!controller) {
            throw new Error('room does not have a controller' + roomName);
        }
        self.addGoal(roomName, controller, {halts: 1});
        return true;
    }
    removeRoom(roomName : string) {
        var self = this;
        var removeGoal = _.find(self.goals, function (goal) {
            return goal.roomName == roomName;
        });
        if(removeGoal) {
            _.forEach(removeGoal.assignments, function (creepName) {
                self.creeps[creepName].suicide();
            });
            self.removeGoal(removeGoal.id);
        }
    }
    // update any goals we are waiting for other jobs to make ready
    updateWaits() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            var room = Game.rooms[goal.roomName];
            if(!room) {
                return true;
            }
            if ((goal.meta.storage && Game.getObjectById(goal.meta.storage)) || goal.meta.linkStorage) {
                return true;
            }
            delete goal.meta.storage;
            if (!goal.meta.constructingStorage || !Game.getObjectById(goal.meta.constructingStorage)) {
                delete goal.meta.constructingStorage;
                //storage build has disappeared;
                var structs = <Array<StructureContainer | StructureStorage>>goal.target.pos.findInRange(FIND_STRUCTURES, 2, { filter: function (site : Structure) { 
                    if (site.structureType == STRUCTURE_CONTAINER || site.structureType == STRUCTURE_STORAGE) {
                        return 1;
                    }
                    return 0;
                }});
                
                if(structs.length != 0) {
                    var positions = utils.openPositionsAround([{pos: structs[0].pos, maxRange: 1, minRange: 0}, {pos: goal.target.pos, range: 3}])
                    goal.permanentPositions = positions;
                    goal.meta.storage = structs[0].id;
                    if(structs[0].structureType != STRUCTURE_STORAGE) {
                        self.jobs.logistics.addNode(goal.meta.storage, 'sink', 15);
                    }
                }
            }
            // if we didn't get the storage in the last check, look for a construction site
            if(!goal.meta.storage) {
                var sites = <ConstructionSite[]>goal.target.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 2, {filter: function (site : ConstructionSite) {
                    if (site.structureType == STRUCTURE_CONTAINER || site.structureType == STRUCTURE_STORAGE) {
                        return 1;
                    }
                    return 0;
                }});

                if(sites.length == 0) {
                    var positions = utils.openPositionsAround([{pos: goal.target.pos, minRange: 1, maxRange: 1}]);
                    room.createConstructionSite(positions[0], STRUCTURE_CONTAINER);
                    return true;
                }
                goal.meta.constructingStorage = sites[0].id;
            }
        });
    }
    controlCreep(myCreep : CreepClass) {
        var self = this;
        if (myCreep.arrived()) {
            var storage = <StructureContainer>Game.getObjectById(myCreep.goal.meta.storage);
            var controller = <StructureController>myCreep.goal.target;
            if(storage.hits < storage.hitsMax) {
                myCreep.repair(storage);
            } else {
                myCreep.upgradeController(controller);
            }
            if(myCreep.energy - myCreep.workPower('upgrade') < myCreep.workPower('upgrade')) {
                myCreep.withdraw(storage, RESOURCE_ENERGY);
            }
        }
        else {
            myCreep.navigate();
        }
    }
    controlWorkers() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            _.forEach(goal.assignments, function(creepName) {
                self.controlCreep(self.creeps[creepName]);
            });
        });
        _.forEach(self.getUnassignedCreeps(), function (creep){
            creep.moveOffRoad();
        });
    }
    get bufferPerWork() {
        var self = this;
        return 1500;
    }
    getUpgradePowerForUpgradeGoal(goal : GoalClass) : number {
        var self = this;
        var room = Game.rooms[goal.roomName];
        var storage = room.storage;
        if(!storage) {
            return 0;
        }
        var controller = room.controller;
        if(!controller) {
            return 0;
        }
        var buffer = self.jobs.logistics.getUsableStorageAmountForGoal(storage.id);
        var desiredWork = Math.floor(buffer / self.bufferPerWork);
        if(desiredWork > 15 && controller.level == 8) {
            return 15;
        }
        return desiredWork;
    }
    updateRequisition() {
        var self = this;
        var creeps : creepDescription[] = [];
        _.forEach(self.goals, function (goal) {
            if((!goal.meta.storage || !Game.getObjectById(goal.meta.storage)) && (!goal.meta.linkStorage || !Game.getObjectById(goal.meta.linkStorage))) {
                return true;
            }
            if(goal.assignments.length != 0) {
                delete goal.meta.requested;
                return true;
            }
            if(goal.meta.requested) {
                return;
            }

            if(!goal.meta.linkStorage) {
                var logisticsGoal = self.jobs.logistics.goals[goal.meta.storage];
                if(logisticsGoal.assignments.length != 0) {
                    _.forEach(logisticsGoal.assignments, function (creepName) {
                        global.creeps[creepName].suicide();
                    });
                }
            }

            var desiredPower = self.getUpgradePowerForUpgradeGoal(goal);
            if(desiredPower > 2 * 32) {
                desiredPower = 2 * 32;
            }
            if(desiredPower == 0) {
                desiredPower = 1;
            }
            creeps.push({
                power: desiredPower,
                type: 'heavyworker',
                memory: {},
                id: goal.id,
                jobName: self.name,
                parentClaim: self.parentClaim,
                waitingSince: Game.time,
                newClaim: undefined
            });
            if(!goal.meta.linkStorage) {
                self.jobs.logistics.setEPTForGoal(goal.meta.storage, desiredPower);
            }
            goal.meta.requested = desiredPower;
        });
    }
}
module.exports = UpgradeJob;
