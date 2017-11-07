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
class UpgradeJob extends JobClass {
    execute() {
        var self = this;
        self.updateWaits();
        self.updateRequisition();
        self.controlWorkers();
    }
    addRoom(roomName) {
        var self = this;
        var room = Game.rooms[roomName];
        if(!Game.rooms[roomName]) {
            throw new Error('cant see into ' + roomName);
        }
        self.addGoal(roomName, Game.rooms[roomName].controller, {halts: 1});
        return 1;
    }
    removeRoom(roomName) {
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
            if ((goal.meta.storage && Game.getObjectById(goal.meta.storage)) || (goal.meta.linkStorage && Game.getObjectById(goal.meta.linkStorage)) || goal.meta.constructingLinkStorage) {
                return true;
            }
            delete goal.meta.storage;
            if (!goal.meta.constructingStorage || (goal.meta.constructingStorage && !Game.getObjectById(goal.meta.constructingStorage))) {
                delete goal.meta.constructingStorage;
                //storage build has disappeared;
                var sites = goal.target.pos.findInRange(FIND_STRUCTURES, 2, { filter: function (site) { 
                    if (site.structureType == STRUCTURE_CONTAINER || site.structureType == STRUCTURE_STORAGE) {
                        return 1;
                    }
                    return 0;
                }});
                
                if(sites.length != 0) {
                    var positions = utils.openPositionsAround([{pos: sites[0].pos, maxRange: 1, minRange: 0}, {pos: goal.target.pos, range: 3}])
                    goal.permanentPositions = positions;
                    goal.meta.storage = sites[0].id;
                    if(sites[0].structureType != STRUCTURE_STORAGE) {
                        self.jobs.logistics.addNode(goal.meta.storage, 'sink', 15);
                    }
                }
            }
            // if we didn't get the storage in the last check, look for a construction site
            if(!goal.meta.storage) {
                var sites = goal.target.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 2, {filter: function (site) {
                    if (site.structureType == STRUCTURE_CONTAINER || site.structureType == STRUCTURE_STORAGE) {
                        return 1;
                    }
                    return 0;
                }});

                if(sites.length == 0) {
                    var positions = utils.openPositionsAround([{pos: goal.target.pos, minRange: 1, maxRange: 1}]);
                    goal.target.room.createConstructionSite(positions[0], STRUCTURE_CONTAINER);
                    return true;
                }
                goal.meta.constructingStorage = sites[0].id;
            }
        });
    }
    controlCreep(myCreep) {
        var self = this;
        if (myCreep.arrived()) {
            var storage = Game.getObjectById(myCreep.goal.meta.storage);
            if(storage.hits < storage.hitsMax) {
                myCreep.repair(storage);
            } else {
                myCreep.upgradeController(myCreep.goal.target);
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
    getUpgradePowerForUpgradeGoal(goal) {
        var self = this;
        var buffer;
        if(goal.meta.linkStorage) {
            var room = Game.rooms[goal.roomName];
            buffer = self.jobs.logistics.getUsableStorageAmountForGoal(room.storage.id);
        } else {
            buffer = self.jobs.logistics.getUsableStorageAmountForGoal(goal.meta.storage);
        }
        var desiredWork = Math.floor(buffer / self.bufferPerWork);
        if(desiredWork > 15 && goal.target.level == 8) {
            return 15;
        }
        return desiredWork;
    }
    updateRequisition() {
        var self = this;
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
            self.jobs.spawn.addRequisition(self.name, 'heavyworker', desiredPower, goal.id, {});
            if(!goal.meta.linkStorage) {
                self.jobs.logistics.setEPTForGoal(goal.meta.storage, desiredPower);
            }
            goal.meta.requested = desiredPower;
        });
    }
}
module.exports = UpgradeJob;
