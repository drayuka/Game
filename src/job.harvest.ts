/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('job.upgradeController');
 * mod.thing == 'a thing'; // true
 */
import { Utils as utils } from "./utils"
import { GoalClass } from "./goal";
import { JobClass } from "./job";
import { CreepClass } from "./creep";
import * as _ from "lodash"
export class HarvestJob extends JobClass {
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
            if(!Game.rooms[goal.roomName]) {
                return;
            }
            if(!goal.target) {
                return;
            }
            if ((goal.meta.constructingStorage && Game.getObjectById(goal.meta.constructingStorage)) || (goal.meta.storage && Game.getObjectById(goal.meta.storage)) || goal.meta.linkStorage) {
                return true;
            }
            delete goal.meta.storage;
            if (!goal.meta.constructingStorage || (goal.meta.constructingStorage && !Game.getObjectById(goal.meta.constructingStorage))) {
                delete goal.meta.constructingStorage;
                //storage build has disappeared;
                let sites : Structure[] = goal.target.pos.findInRange(FIND_STRUCTURES, 1, { filter: function (site: Structure) { 
                    if (site.structureType == STRUCTURE_CONTAINER || site.structureType == STRUCTURE_STORAGE) {
                        return true;
                    }
                    return false;
                }});
                if(sites.length != 0) {
                    goal.meta.storage = sites[0].id;
                    goal.meta.dropHarvest = true;
                    self.jobs.logistics.addNode(goal.meta.storage, 'source', 10);
                }
            }
            // if we didn't get the storage in the last check, look for a construction site
            if(!goal.meta.storage) {
                let sites : ConstructionSite[] = goal.target.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 1, {filter: function (site: Structure) {
                    if (site.structureType == STRUCTURE_CONTAINER || site.structureType == STRUCTURE_STORAGE) {
                        return true;
                    }
                    return false;
                }});

                if(sites.length == 0) {
                    var positions = utils.openPositionsAround([{pos: goal.target.pos, minRange: 1, maxRange: 1}], {noHaltingCreeps: true});
                    if(goal.target && goal.target.room) {
                        goal.target.room.createConstructionSite(positions[0], STRUCTURE_CONTAINER);
                    } else {
                        throw new Error('couldnt get the source or the room the source is in to create a container');
                    }
                } else {
                    delete goal.meta.range;
                    goal.permanentPositions = [sites[0].pos];
                    goal.meta.constructingStorage = sites[0].id;
                }
            }
        });
    }
    controlCreep(myCreep: CreepClass) {
        var self = this;
        if (myCreep.arrived()) {
            var room = Game.rooms[myCreep.goal.roomName];
            if(!room) {
                myCreep.memory.arrived = false;
                return;
            }
            if(!myCreep.goal.target) {
                throw new Error('Source no longer exists in room ' + room.name);
            }
            var source = <Source>myCreep.goal.target;
            // if the storage needs to be built, build it or harvest more energy
            if(myCreep.goal.meta.constructingStorage) {
                var storageBuild = <ConstructionSite>Game.getObjectById(myCreep.goal.meta.constructingStorage);
                if(myCreep.energy >= myCreep.workPower('build') * 5) {
                    myCreep.build(storageBuild);
                } else {
                    myCreep.harvest(source);
                }
            // if we have a storage, either harvest and store in it, or harvest and repair it
            } else if(myCreep.goal.meta.storage) {
                var storage = <StructureContainer>Game.getObjectById(myCreep.goal.meta.storage);
                if(storage.hits < storage.hitsMax && source.energy == 0) {
                    myCreep.repair(storage);
                    myCreep.withdraw(storage, RESOURCE_ENERGY);
                } else {
                    myCreep.harvest(source);
                    if(myCreep.pos.isEqualTo(storage.pos)) {
                    // drop harvesting we should automatically drop 
                    // energy over our carry capacity into the storage;
                    } else {
                        var carry = _.sum(myCreep.carry);
                        if(carry + myCreep.workPower('harvest') * 4 > myCreep.carryCapacity) {
                            myCreep.transfer(storage, RESOURCE_ENERGY);
                        } 
                    }
                }
            } else if(myCreep.goal.meta.linkStorage) {
                var link = self.jobs.links.getLinkForSource(source.id);
                if(link instanceof RoomPosition) {
                    return;
                } else if(link instanceof ConstructionSite) {
                    var storageBuild = link;
                    if(myCreep.energy >= myCreep.workPower('build') * 5) {
                        myCreep.build(storageBuild);
                    } else {
                        myCreep.harvest(source);
                    }
                } else if(link instanceof StructureLink) {
                    var carry = _.sum(myCreep.carry);
                    if(carry + myCreep.workPower('harvest') * 4 > myCreep.carryCapacity) {
                        myCreep.transfer(link, RESOURCE_ENERGY);
                    }
                }
            }
        } else {
            myCreep.navigate();
        }
    }
    controlWorkers() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            _.forEach(goal.assignments, function (creepName) {
                self.controlCreep(self.creeps[creepName]);
            })
        });
    }
    addSources(newRoom : string) {
        var self = this;
        var newSources = _.map(Game.rooms[newRoom].find(FIND_SOURCES), function (src: Source) {
            // we will add positions and storages later;
            self.addGoal(newRoom, src, {halts: 1, range: 1});
        });
        return true;
    }
    removeSources(roomName : string) {
        var self = this;
        _.forEach(self.getGoalsInRoom(roomName), function (goal) {
            _.forEach(goal.assignments, function (creepName) {
                self.creeps[creepName].suicide();
            });
            self.removeGoal(goal.id);
        });
    }
    updateRequisition() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            var curWorkPower = _.reduce(goal.assignments, function (total: number, creepName: string) {
                return total + self.creeps[creepName].workPower('harvest');
            },0);
            if(curWorkPower >= 6) {
                return true;
            }
            self.jobs.spawn.addRequisition([{
                power: 6,
                type: 'heavyworker',
                memory: {},
                id: goal.id,
                jobName: self.name,
                parentClaim: self.parentClaim,
                waitingSince: Game.time,
                newClaim: undefined
            }]);
        });
    }
}
module.exports = HarvestJob;
