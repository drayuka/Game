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
class roomworker extends JobClass {
    execute () {
        var self = this;
        self.updateRequisition();
        self.generateMissions();
        self.assignMissions();
        self.runMissions();
    }
    missionGenerators() {
        var self = this;
        return {
            repairRoads: {
                init: function (missionMem: any) {
                    missionMem.missions = {};
                    missionMem.lastCheck = {};
                },
                new: function (missionMem: any, rooms: string[]) : Mission[] {
                    var newMissions : Mission[] = [];
                    _.forEach(rooms, function (roomName) {
                        var room = Game.rooms[roomName];
                        // can't see in the room, can't check the roads
                        if(!room) {
                            return true;
                        }
                        // already have a mission to repair roads in this room
                        if(missionMem.missions[room.name]) {
                            return true;
                        }
                        // only check every 1000 ticks
                        if(missionMem.lastCheck[room.name] + 1000 > Game.time) {
                            return true;
                        }
                        missionMem.lastCheck[room.name] = Game.time;
                        console.log('checking road repair in ' + room.name);
                        var maxWorkerPower = self.getWorkerPower();
                        //max amount of energy that can be carried by the creep - 20% so that we can repair to full
                        var maxRepair = maxWorkerPower * 150 * 100 * .8;
                        var structures = <Structure[]>room.find(FIND_STRUCTURES);
                        var needsRepair = false;
                        var currentRepairAmount = 0;
                        var roadsNeedingRepair: string[] = [];
                        _.forEach(structures, function (struct) {
                            if(struct.structureType != STRUCTURE_ROAD) {
                                return true;
                            }
                            currentRepairAmount += struct.hitsMax - struct.hits;
                            if(struct.hitsMax != struct.hits) {
                                roadsNeedingRepair.push(struct.id);
                            }
                            if(!needsRepair && currentRepairAmount >= maxRepair) {
                                needsRepair = true;
                            }
                            if(!needsRepair && struct.hits/struct.hitsMax < .3) {
                                //emergency repairs needed
                                needsRepair = true;
                            }
                        });
                        // doesn't need repair move along, but only check 1 per tick
                        if(!needsRepair) {
                            return false;
                        }
                        var mission : Mission = {
                            missionName: 'repairRoads',
                            maxWorkers: 1,
                            runner: 'runMission',
                            missionInit: 'creepMissionInit',
                            creeps: [],
                            priority: 1,
                            other: {
                                roomName: room.name,
                                roads: roadsNeedingRepair
                            }
                        }
                        missionMem.missions[room.name] = 1;
                        newMissions.push(mission);
                        // only check 1 room per tick;
                        return false;
                    });
                    return newMissions;
                },
                remove: function (missionMem: any, mission: Mission) {
                    delete missionMem.missions[mission.other.roomName];
                },
                creepMissionInit:  function (creep : CreepClass) {
                    creep.memory.missionStatus = {
                        gettingEnergy : false,
                        repairingRoad : false,
                        target: undefined,
                        sortTimer: 0
                    }
                },
                runMission: function (mission: Mission, creeps: CreepClass[]) {
                    // should only be one creep
                    var creep = creeps[0];
                    if(creep.memory.missionStatus.gettingEnergy) {
                        if(self.getEnergy(creep)) {
                            creep.memory.missionStatus.gettingEnergy = false;
                        }
                    } else if(creep.memory.missionStatus.repairingRoad) {
                        
                        var roads: StructureRoad[] = [];
                        if(creep.pos.roomName != mission.other.roomName) {
                            creep.navigateToRoom
                            return {continue: true};
                        }
                        //creep has arrived at target, wipe target
                        if(creep.arrived()) {
                            delete creep.memory.missionStatus.target;
                            delete creep.memory.arrived;
                        }
                        if(!creep.memory.missionStatus.target) {
                            roads = _.map(mission.other.roads, function (roadid: string) {
                                return <StructureRoad>Game.getObjectById(roadid)
                            });
                            roads = _.sortBy(roads,function (a) {
                                return a.pos.getRangeTo(creep.pos);
                            });
                            var furthestRoad = roads[roads.length-1];
                            creep.memory.missionStatus.target = furthestRoad.id;
                            var newGoal = new GoalClass(undefined, mission.other.roomName, furthestRoad, {range: 3, halts: true});
                            creep.goal = newGoal;
                        }
                        var roadsNotRepaired: StructureRoad[] = [];
                        var roadsRemoved: string[] = [];
                        var needToStort: boolean = false;
                        if(roads) {
                            mission.other.roads = _.map(roads, function (road) {
                                return road.id;
                            });
                            creep.memory.missionStatus.sortTimer = Game.time + 2;
                        } else if(Game.time > creep.memory.missionStatus.sortTimer) {
                            mission.other.roads = _.sortBy(mission.other.roads, function (roadid: string) {
                                var road = <StructureRoad>Game.getObjectById(roadid);
                                if(!road) {
                                    return 0;
                                } else {
                                    return road.pos.getRangeTo(creep.pos);
                                }
                            });
                        }
                        mission.other.roads = _.dropWhile(mission.other.roads, function (roadid: string) {
                            var road = <StructureRoad>Game.getObjectById(roadid);
                            // if we couldn't find it, give up.
                            if(!road) {
                                return true;
                            }
                            // if it is 
                            if(road.hits/road.hitsMax > .9) {
                                roadsRemoved.push(road.id);
                                return true;
                            } else if(road.pos.getRangeTo(creep.pos) > 3 && creep.memory.missionStatus.sortTimer <= Game.time) {
                                return false;
                            }
                        });
                        // no more roads that need repair that we know about
                        if(mission.other.roads.length = 0) {
                            return {continue: false}
                        }
                        var closestRoad = <StructureRoad>Game.getObjectById(mission.other.roads[0]);
                        if(closestRoad.pos.getRangeTo(creep.pos) <= 3) {
                            creep.repair(closestRoad);
                            creep.memory.missionStatus.sortTimer++;
                        }
                        //if we aren't done but we are out of energy, stop having the repair road status
                        if(creep.carry[RESOURCE_ENERGY] == 0) {
                            return {
                                creepsToGiveBack: [creep.name],
                                continue: true
                            };
                        }
                        creep.navigate();
                    } else {
                        if(creep.carry[RESOURCE_ENERGY] == creep.carryCapacity) {
                            creep.memory.missionStatus.repairingRoad = true;
                        } else {
                            creep.memory.missionStatus.gettingEnergy = true;
                        }
                    }
                    return {continue: true};
                }
            },
            buildStructures: {
                new: function (missionMem: any, rooms :string[]) : Mission[] {
                    var newMissions : Mission[] = [];
                    _.forEach(rooms, function (roomName) {
                        var room = Game.rooms[roomName];
                        if(!room) {
                            return;
                        }
                        var newBuildSites: ConstructionSite[] = room.find(FIND_MY_CONSTRUCTION_SITES, {filter: function (site) {
                            if(missionMem.missions[site.id]) {
                                return false;
                            } 
                            return true;
                        }});
                        if(newBuildSites.length == 0) {
                            return true;
                        }
                        newMissions.push(...<Mission[]>_.map(newBuildSites, function (buildSite) {
                            missionMem.missions[buildSite.id] = true;
                            var pos = undefined;
                            var type = undefined;
                            if(buildSite.structureType == STRUCTURE_RAMPART || buildSite.structureType == STRUCTURE_WALL) {
                                pos = [buildSite.pos.x, buildSite.pos.y, buildSite.pos.roomName];
                                type = buildSite.structureType;
                            }
                            return {
                                missionName: 'buildStructures',
                                maxWorkers: Infinity,
                                runner: 'runMission',
                                missionInit: 'creepMissionInit',
                                creeps: [],
                                priority: 2,
                                other: {
                                    buildSiteId: buildSite.id,
                                    pos: pos,
                                    type: type
                                }
                            };
                        }));
                    });
                    return newMissions;
                },
                init: function (missionMem: any) {
                    missionMem.missions = {};
                },
                remove: function (missionMem: any, mission: Mission) {
                    delete missionMem.missions[mission.other.buildSiteId];
                },
                runMission: function (mission: Mission, creeps: CreepClass[]) {
                    var doneCreeps : CreepClass[] = [];
                    var buildSite = <ConstructionSite>Game.getObjectById(mission.other.buildSiteId);
                    var defSite: Structure;
                    if(!buildSite) {
                        // if this is a rampart or wall we need to build it up a bit, before we let other jobs deal with it
                        if(mission.other.type == STRUCTURE_RAMPART || mission.other.type == STRUCTURE_WALL) {
                            if(mission.other.defSite) {
                                defSite = Game.getObjectById(mission.other.defSite);
                                if(!defSite) {
                                    throw new Error('couldnt find the ' + mission.other.type + ' at ' + JSON.stringify(mission.other.pos));
                                }
                                // defense site is high enough, we can build it up normally;
                                if(defSite.hits > 10000) {
                                    return {
                                        continue: false;
                                    }
                                }
                            } else {
                                var pos = new RoomPosition(...mission.other.pos);
                                var structures = _.filter(pos.lookFor(LOOK_STRUCTURES), function (struct: Structure) {
                                    return struct.structureType == mission.other.type;
                                });
                                if(structures.length == 0) {
                                    throw new Error('couldnt find the ' + mission.other.type + ' at ' + JSON.stringify(mission.other.pos));
                                }
                                defSite = structures[0];
                                mission.other.defSite = defSite.id;
                            }
                        } else {
                            return {
                                continue: false;
                            }
                        }
                    }
                    _.forEach(creeps, function (creep) {
                        if(creep.memory.missionStatus.gettingEnergy) {
                            if(self.getEnergy(creep)) {
                                creep.memory.missionStatus.gettingEnergy = false;
                            }
                        } else if(creep.memory.missionStatus.buildingStructure) {
                            if(!creep.memory.goal) {
                                var newgoal = new GoalClass(undefined, buildSite.pos.roomName, buildSite.id, {range: 3, halts: true});
                            }
                            if(creep.arrived()) {
                                if(buildSite) {
                                    creep.build(buildSite);
                                } else if (defSite) {
                                    creep.repair(defSite);
                                }
                            } else {
                                creep.navigate();
                            }
                            if(creep.carry[RESOURCE_ENERGY] == 0) {
                                doneCreeps.push(creep);
                            }
                        } else {
                            if(creep.carry[RESOURCE_ENERGY] == creep.carryCapacity) {
                                creep.memory.missionStatus.buildingStructure = true;
                            } else {
                                creep.memory.missionStatus.gettingEnergy = true;
                            }
                        }
                    });
                    return {
                        creepsToGiveBack: doneCreeps;
                        continue: true
                    }
                },
                creepMissonInit: function (creep: CreepClass) {
                    creep.memory.missionStatus = {
                        gettingEnergy : false,
                        buildingStructure : false,
                    };
                }
            },
            upgradeWallsAndRamparts: {
                init: function (missionMem: any) : void {
                    missionMem.missions = {};
                    missionMem.roomDefenseLimits = {};
                    missionMem.lastCheck = {};
                },
                new: function (missionMem: any, rooms: string[]) : Mission[] {
                    _.forEach(rooms, function (roomName) {
                        var room = Game.rooms[roomName];
                        if(!room) {
                            return true;
                        }
                        // skip any room which doesn't have a controller, owner, or where the owner of the controller isn't us
                        if(!room.controller || !room.controller.owner || room.controller.owner.username != global.username) {
                            return true;
                        }
                        if(missionMem.lastCheck + 1000 > Game.time) {

                        }

                        var 
                    });
                },
                remove: function (missionMem: any, mission: Mission) {

                },
                runMission: function (mission: Mission, creeps: CreepClass[]) {

                },
                creepMissionInit: function (creep: CreepClass) : void {

                }
            }
        }
    }
    getEnergy(creep: CreepClass) {
        var self = this;
        if(creep.carry[RESOURCE_ENERGY] == creep.carryCapacity) {
            return true;
        }
        if(!creep.memory.navigatingToEnergy) {
            creep.memory.arrived = false;
            var closestStorage = _.find(self.jobs.logistics.getStoragesAtRange(creep.goal.roomName, 3), function (storage: StructureStorage) {
                if(storage.store[RESOURCE_ENERGY] != 0) {
                    return 1;
                }
                return 0;
            });

            if(!closestStorage) {
                throw new Error('cant find a storage in range of room ' + myCreep.goal.roomName);
            }
            creep.memory.navigatingToEnergy = true;
            creep.goal = self.jobs.logistics.goals[closestStorage.id];
        }

        if(!creep.arrived()) {
            creep.navigate();
        } else {
            creep.withdraw(<Structure>creep.goal.target, RESOURCE_ENERGY);
            creep.memory.navigatingToEnergy = false;
        }
        return false;
    }
    generateMissions () {
        var self = this;
        if(!self.memory.missionGen) {
            self.memory.missionGen = {};
        }
        _.forEach(self.missionGenerators, function (missionGen, missionName) {
            //mission gen init
            if(!self.memory.missionGen[missionName]) {
                missionGen.init(self.memory.missionGen[missionName]);
            }
            var newMissions = <Mission[]>missionGen.new(self.memory.missionGen[missionName], self.rooms);
            _.forEach(newMissions, function(newMission) {
                self.memory.missions[newMission.priority].push(newMission);
            });
        });
    }
    assignMissions() {
        var self = this;
        var freeWorkers = self.getFreeWorkers();
        var priorities = _.keys(self.memory.missions).sort();
        _.forEach(priorities, function (priority) {
            if(freeWorkers.length == 0) {
                return false;
            }
            var missions = self.memory.missions[priority];
            if(missions.length == 0) {
                return true;
            }
            _.forEach(missions, function (mission: Mission) {
                //already enough creeps on this mission
                if(mission.maxWorkers <= mission.creeps.length) {
                    return true;
                } else if(mission.maxWorkers > mission.creeps.length + freeWorkers.length) {
                    //all remaining creeps can be assigned to this mission
                    mission.creeps.push(..._.map(freeWorkers, function (creep) {
                        creep.cleanup([]);
                        self.missionGenerators[mission.missionName][mission.missionInit](creep);
                        creep.memory.onMission = true;
                        return creep.name;
                    }));
                    freeWorkers = [];
                } else { 
                    // assign some creeps to this mission
                    var neededWorkers = mission.maxWorkers - mission.creeps.length;
                    mission.creeps.push(..._.map(_.take(freeWorkers, neededWorkers), function (creep) {
                        creep.cleanup([]);
                        self.missionGenerators[mission.missionName][mission.missionInit](creep);
                        creep.memory.onMission = true;
                        return creep.name;
                    }));
                    freeWorkers = _.takeRight(freeWorkers, freeWorkers.length - neededWorkers);
                }
            });
        });
    }
    getFreeWorkers() : CreepClass[] {
        var self = this;
        return _.filter(self.creeps, function (creep) {
            return creep.memory.onMission != true
        });
    }
    runMissions () {
        var self = this;
        var priorities = _.keys(self.memory.missions).sort();
        _.forEach(priorities, function (priority) {
            var missions = self.memory.missions[priority];
            if(missions.length == 0) {
                return true;
            }
            self.memory.missions[priority] = _.filter(missions, function (mission: Mission) {
                //no creeps on this mission
                if(mission.creeps.length == 0) {
                    return true;
                }
                var missionCreeps = _.map(mission.creeps, function (creepName) {
                    return self.creeps[creepName];
                });
                try{
                    var result = self.missionGenerators[mission.missionName][mission.runner](mission, missionCreeps);
                    if(result.creepsToGiveBack) {
                        _.difference(mission.creeps, result.creepsToGiveBack);
                        _.forEach(result.creepsToGiveBack, function (creepName) {
                            self.creeps[creepName].memory.onMission = false;
                        });
                    }
                    if(!result.continue) {
                        _.forEach(mission.creeps, function (creepName) {
                            self.creeps[creepName].memory.onMission = false;
                        });
                        self.missionGenerators[mission.missionName][mission.runner].remove(self.memory.missionGen[mission.missionName], mission);
                    }
                    return result.continue;
                } catch (e) {
                    console.log('had problems running mission: ' + JSON.stringify(mission));
                    console.log(e.stack);
                    debugger;
                }
            });
        });
        //creeps with no mission should get outta the way;
        _.forEach(self.getFreeWorkers(), function (creep) {
            creep.moveOffRoad();
        });
    }
    updateRequisition () {
        var self = this;
        _.forEach(self.memory.roomAssignments, function (creepNames, roomName) {
            var room = Game.rooms[roomName];
            if(!room) {
                return true;
            }
            if(self.getGoalsInRoom(roomName).length == 0) {
                return true;
            }
            var maxCreeps = 1;
            var maxCreepSize = 2;
            if(room.controller.my) {
                maxCreepSize = 6;
            }
            if(room.controller.level >= 7) {
                maxCreeps = 2;
            }
            if(creepNames.length < maxCreeps) {
                global.jobs.spawn.addRequisition(self.name, 'roomworker', maxCreepSize, roomName, {});
            }
        });
    }
}

interface Mission {
    missionName: string,
    maxWorkers: number,
    runner: string,
    missionInit: string,
    creeps: string[],
    priority: number,
    other: any
}
module.exports = roomworker;