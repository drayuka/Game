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
        if(Game.time % 20) {
            self.findGoals();
            self.raiseDefenseMaximums();
        }
        self.deactivateGoals();
        self.updateRequisition();
        self.controlWorkers();
    }
    removeRoom(roomName) {
        var self = this;
        self.memory.activeRooms = _.difference(self.memory.activeRooms, [roomName]);
        if(self.memory.roomAssignments && self.memory.roomAssignments[roomName]) {
            _.forEach(self.memory.roomAssignments[roomName], function (creepName) {
                self.creeps[creepName].suicide();
            });
            delete self.memory.roomAssignments[roomName]
        }
        _.forEach(self.getGoalsInRoom(roomName), function (goal) {
            self.removeGoal(goal.id);
        });
    }
    addRoom (roomName) {
        var self = this;
        self.memory.activeRooms = _.union([roomName], self.memory.activeRooms);
        if(!self.memory.roomAssignments) {
            self.memory.roomAssignments = {};
        }
        self.memory.roomAssignments[roomName] = [];
        if(!self.memory.defenseMaximum) {
            self.memory.defenseMaximum = {};
        }
        self.memory.defenseMaximum[roomName] = 10000;
        self.findGoalsInRoom(roomName);
        return true;
    }
    get maxbuildSize () {
        var self = this;
        return {

        }
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
                            creep.memory.missionStatus.repairingRoad = false;
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
                new: function (missionMem: any, rooms :string[]) {

                },
                runMission: function (mission: Mission, creeps: CreepClass[]) {

                }
            },
            upgradeWallsAndRamparts: {
                new: function (missionMem: any, rooms: string[]) {

                },
                runMission: function (mission: Mission, creeps: CreepClass[]) {

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
        _.forEach(self.missionGenerators, function (missionGen, missionName) {
            var newMissions = self.missionGen.new(self.memory.missionGen[missionName], self.rooms);
            if(newMissions.length != 0) {
                self.addMissions(newMissions);
            }
        }); 
    }
    assignMissions(roomName) {
        var self = this;
        _.forEach(self.freeWorkers, function (freeworker) {

        });
    }
    findGoalsInRoom(roomName) {
        var self = this;
        if(!Game.rooms[roomName]) {
            return;
        }
        var room = Game.rooms[roomName];

        var newSites;
        if(room.controller.my) {
            newSites = room.find(FIND_STRUCTURES, { filter: function (structure) {
                if(self.goals[structure.id]) {
                    return 0;
                }
                if(_.includes([STRUCTURE_ROAD, STRUCTURE_WALL, STRUCTURE_RAMPART, STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_TOWER, STRUCTURE_LAB], structure.structureType)
                    && structure.isActive()) {
                    return 1;
                }
                return 0;
            }});
        } else {
            newSites = room.find(FIND_STRUCTURES, { filter: function (structure) {
                if(self.goals[structure.id]) {
                    return 0;
                }
                if(structure.structureType == STRUCTURE_ROAD) {
                    return 1;
                }
                return 0;
            }});
        }
        if(newSites.length > 0) {
            _.forEach(newSites, function (site) {
                var halts = 0;
                var range = 1;
                if(_.includes([STRUCTURE_ROAD, STRUCTURE_WALL, STRUCTURE_RAMPART], site.structureType)) {
                    halts = 1;
                    range = 3;
                }
                self.addGoal(site.pos.roomName, site, {range: range, priority: self.priority[site.structureType], halts: halts});
            });
        }
        var newDefenseConstructionSites = room.find(FIND_MY_CONSTRUCTION_SITES, {filter: function (structure) {
            if(self.goals[structure.id]) {
                return 0;
            }
            return 1;
        }});
        if(newDefenseConstructionSites.length > 0) {
            _.forEach(newDefenseConstructionSites, function (site) {
                self.addGoal(site.pos.roomName, site, {range: 3, priority: 5, halts: 1});
            });
        }
    }
    findGoals () {
        var self = this;
        _.forEach(self.memory.roomAssignments, function (creeps, roomName) {
            self.findGoalsInRoom(roomName);
        });
    }
    raiseDefenseMaximums () {
        var self = this;
        _.forEach(self.memory.roomAssignments, function (creeps, roomName) {
            var defenseGoals = _.filter(self.getGoalsInRoom(roomName), function (goal) {
                if(goal.target.structureType == STRUCTURE_RAMPART || goal.target.structureType == STRUCTURE_WALL) {
                    return 1;
                }
                return 0;
            });
            if(defenseGoals.length == 0) {
                return true;
            }
            var activeGoals = _.filter(defenseGoals, function (goal) {
                if(goal.target.hits < self.memory.defenseMaximum[goal.roomName]) {
                    return 1;
                }
                return 0;
            });
            if(activeGoals.length == 0) {
                self.memory.defenseMaximum[roomName] += self.defenseIncrement;
                console.log('defense maximum for ' + roomName + ' is now ' + self.memory.defenseMaximum[roomName]);
            }
        });
    }
    get defenseIncrement () {
        return 5000;
    }
    prioritizeRoomGoals(goals) {
        var self = this;
        var indexedGoals = _.groupBy(goals, function (goal) {
            // to give a high priority to ramparts that might go away.
            if (goal.target.structureType == STRUCTURE_RAMPART && goal.target.hits < self.defenseIncrement) {
                return 2;
            } else if(self.checkIfGoalValid(goal)) {
                return goal.meta.priority;
            } else {
                return 100;
            }
        });
        delete indexedGoals[100];
        return indexedGoals;
    }
    checkIfGoalValid(goal, deactivation) {
        var self = this;
        if(goal.assignments.length != 0 && !deactivation) {
            return false;
        }
        if(goal.meta.priority == 5) {
            return true;
        }
        if(goal.target.structureType == STRUCTURE_ROAD) {
            if(goal.assignments.length != 0) {
                return false;
            }
            if(deactivation) {
                if(goal.target.hits >= goal.target.hitsMax) {
                    return false;
                }
            } else {
                if((goal.target.hits / goal.target.hitsMax) > .6) {
                    return false;
                }
            }
            return true;
        }
        if(goal.target.structureType == STRUCTURE_WALL || goal.target.structureType == STRUCTURE_RAMPART) {
            if(goal.target.hits >= self.memory.defenseMaximum[goal.roomName] || goal.target.hits >= goal.target.hitsMax) {
                return false;
            } else {
                return true;
            }
        }
        if(_.includes([STRUCTURE_LAB,STRUCTURE_TOWER,STRUCTURE_EXTENSION,STRUCTURE_SPAWN],goal.target.structureType)) {
            if(goal.target.energy >= goal.target.energyCapacity) {
                return false;
            } else {
                return true;
            }
        }
    }
    deleteGoals() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            if(!Game.rooms[goal.roomName]) {
                return true;
            }
            var room = Game.rooms[goal.roomName];
            if(goal.id && !Game.getObjectById(goal.id)) {
                self.removeGoal(goal.id);
                return true;
            }
        });
    }
    deactivateGoals() {
        var self = this;
        _.forEach(self.memory.roomAssignments, function (creepNames, roomName) {
            _.forEach(creepNames, function (creepName) {
                var goal = self.creeps[creepName].goal;
                var creep = self.creeps[creepName];
                if(goal && goal.job.name == self.name && goal.target && !self.checkIfGoalValid(goal, 1)) {
                    self.removeCreepFromGoal(creepName, goal.id);
                }
            });
        })
    }
    assignGoals() {
        var self = this;
        var unAssignedCreepsByRoom = _.groupBy(self.getUnassignedCreeps(), function (creep) {
            return creep.memory.workRoom;
        });
        _.forEach(self.memory.roomAssignments, function (creepNames, roomName) {
            if(!unAssignedCreepsByRoom[roomName]) {
                return true;
            }
            var prioritizedRoomGoals = self.prioritizeRoomGoals(self.getGoalsInRoom(roomName));
            if(_.keys(prioritizedRoomGoals).length == 0) {
                return true;
            }
            var index = 0;
            var validPriority = 0;
            _.forEach(unAssignedCreepsByRoom[roomName], function (creep) {
                var validGoals = [];
                if(!prioritizedRoomGoals[validPriority] || prioritizedRoomGoals[validPriority].length == 0) {
                    for(var i = validPriority; i < 100; i++) {
                        if(prioritizedRoomGoals[i]) {
                            validGoals = prioritizedRoomGoals[i];
                            validPriority = i;
                            break;
                        }
                    }
                    validGoals = prioritizedRoomGoals[validPriority];
                } else {
                    validGoals = prioritizedRoomGoals[validPriority];
                }

                if(validGoals.length == 0) {
                    return false;
                }
                var sortedRoomGoals = _.sortBy(validGoals, function (goal) {
                    if(creep.pos.roomName != goal.roomName) {
                        return 50;
                    } else {
                        return creep.pos.getRangeTo(goal.target.pos);
                    }
                });

                var validGoal = sortedRoomGoals.shift();
                prioritizedRoomGoals[validPriority] = sortedRoomGoals;
                self.assignCreepToGoal(creep.name, validGoal.id);
            });
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
    // this job uses roomNames as goal ids for spawning so when spawn asks this question
    // the goalId is actually the roomName already
    getRoomForGoal (goalId) {
        var self = this;
        return goalId;
    }
    controlWorkers () {
        var self = this;
        _.forEach(self.memory.roomAssignments, function (creepNames) {
            _.forEach(creepNames, function (creepName) {
                if(self.creeps[creepName].goal) {
                    self.controlCreep(self.creeps[creepName]);    
                } else {
                    self.creeps[creepName].moveOffRoad();
                }
            });
        });
    }
    controlCreep (myCreep) {
        var self = this;
        if(myCreep.energy == 0 && !myCreep.memory.gettingEnergy) {
            myCreep.memory.arrived = 0;
            var closestStorage = _.find(global.jobs.logistics.getStoragesAtRange(myCreep.goal.roomName, 3), function (storage) {
                if(storage.store[RESOURCE_ENERGY] != 0) {
                    return 1;
                }
                return 0;
            });

            if(!closestStorage) {
                throw new Error('cant find a storage in range of room ' + myCreep.goal.roomName);
            }
            self.removeCreepFromGoal(myCreep.name, myCreep.goal.id);
            myCreep.goal = global.jobs.logistics.goals[closestStorage.id];
            myCreep.memory.gettingEnergy = 1;
        } else if(myCreep.energy != 0 && myCreep.memory.gettingEnergy) {
            myCreep.memory.arrived = 0;
            delete myCreep.memory.gettingEnergy;
            myCreep.cleanup(self.keeps);
            return;
        }
        myCreep.navigate();
        if(myCreep.arrived()) {
            if(myCreep.memory.gettingEnergy) {
                myCreep.withdraw(myCreep.goal.target, RESOURCE_ENERGY);
            } else if(Game.constructionSites[myCreep.goal.id]) {
                myCreep.build(myCreep.goal.target);
            } else if(_.includes([STRUCTURE_LAB, STRUCTURE_EXTENSION, STRUCTURE_SPAWN, STRUCTURE_TOWER], myCreep.goal.target.structureType)) {
                myCreep.transfer(myCreep.goal.target, RESOURCE_ENERGY);
            } else {
                myCreep.repair(myCreep.goal.target);
            }
        }
    }
}

interface Mission {
    maxWorkers: number,
    runner: string,
    missionInit: string,
    goals: string[],
    creeps: string[],
    priority: number,
    other: any
}
module.exports = roomworker;