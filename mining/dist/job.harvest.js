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
class harvest extends job {
    execute() {
        var self = this;
        self.updateStorages();
        self.updateRequisition();
        self.controlWorkers();
    }
    // update any goals we are waiting for other jobs to make ready
    updateStorages() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            if (!Game.rooms[goal.roomName]) {
                return;
            }
            if ((goal.meta.constructingStorage && Game.getObjectById(goal.meta.constructingStorage)) || (goal.meta.storage && Game.getObjectById(goal.meta.storage)) || goal.meta.linkStorage) {
                return true;
            }
            delete goal.meta.storage;
            if (!goal.meta.constructingStorage || (goal.meta.constructingStorage && !Game.getObjectById(goal.meta.constructingStorage))) {
                delete goal.meta.constructingStorage;
                //storage build has disappeared;
                var sites = goal.target.pos.findInRange(FIND_STRUCTURES, 1, { filter: function (site) {
                        if (site.structureType == STRUCTURE_CONTAINER || site.structureType == STRUCTURE_STORAGE) {
                            return 1;
                        }
                        return 0;
                    } });
                if (sites.length != 0) {
                    goal.meta.storage = sites[0].id;
                    goal.meta.dropHarvest = true;
                    global.jobs.logistics.addNode(goal.meta.storage, 'source', 10);
                }
            }
            // if we didn't get the storage in the last check, look for a construction site
            if (!goal.meta.storage) {
                var sites = goal.target.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 1, { filter: function (site) {
                        if (site.structureType == STRUCTURE_CONTAINER || site.structureType == STRUCTURE_STORAGE) {
                            return 1;
                        }
                        return 0;
                    } });
                if (sites.length == 0) {
                    var positions = utils.openPositionsAround([{ pos: goal.target.pos, minRange: 1, maxRange: 1 }], { noHaltingCreeps: 1 });
                    goal.target.room.createConstructionSite(positions[0], STRUCTURE_CONTAINER);
                }
                else {
                    delete goal.meta.range;
                    goal.permanentPositions = [sites[0].pos];
                    goal.meta.constructingStorage = sites[0].id;
                }
            }
        });
    }
    controlCreep(myCreep) {
        var self = this;
        if (myCreep.arrived()) {
            // if the storage needs to be built, build it or harvest more energy
            if (myCreep.goal.meta.constructingStorage) {
                var storageBuild = Game.getObjectById(myCreep.goal.meta.constructingStorage);
                if (myCreep.energy >= myCreep.workPower('build') * 5) {
                    myCreep.build(storageBuild);
                }
                else {
                    myCreep.harvest(myCreep.goal.target);
                }
            }
            else if (myCreep.goal.meta.storage) {
                var storage = Game.getObjectById(myCreep.goal.meta.storage);
                if (storage.hits < storage.hitsMax && myCreep.goal.target.energy == 0) {
                    myCreep.repair(storage);
                    myCreep.withdraw(storage, RESOURCE_ENERGY);
                }
                else {
                    myCreep.harvest(myCreep.goal.target);
                    if (myCreep.pos.isEqualTo(storage.pos)) {
                    }
                    else {
                        var carry = _.sum(myCreep.carry);
                        if (carry + myCreep.workPower('harvest') * 4 > myCreep.carryCapacity) {
                            myCreep.transfer(storage, RESOURCE_ENERGY);
                        }
                    }
                }
            }
        }
        else {
            myCreep.navigate();
        }
    }
    controlWorkers() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            _.forEach(goal.assignments, function (creepName) {
                self.controlCreep(self.creeps[creepName]);
            });
        });
    }
    addSources(newRoom) {
        var self = this;
        var newSources = _.map(Game.rooms[newRoom].find(FIND_SOURCES), function (src) {
            // we will add positions and storages later;
            self.addGoal(newRoom, src, { halts: 1, range: 1 });
        });
        return 1;
    }
    removeSources(roomName) {
        var self = this;
        _.forEach(self.getGoalsForRoom(roomName), function (goal) {
            _.forEach(goal.assignments, function (creepName) {
                self.creeps[creepName].suicide();
            });
            Game.getObjectById(goal.meta.storage).destroy();
            self.removeGoal(goal.id);
        });
    }
    updateRequisition() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            var curWorkPower = _.reduce(goal.assignments, function (total, creepName) {
                return total + self.creeps[creepName].workPower('harvest');
            }, 0);
            if (curWorkPower >= 6) {
                return true;
            }
            global.jobs.spawn.addRequisition(self.name, 'heavyworker', 6, goal.id, {});
        });
    }
}
module.exports = harvest;
