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
class LogisticsJob extends JobClass {
    execute() {
        var self = this;
        self.updateRoutes();
        self.updateRequisition();
        self.controlWorkers();
    }
    updateRoutes () {
        var self = this;

        var unroutedGoals = _.filter(self.goals, function (goal) {
            var target = <OwnedStructure>goal.target;
            if(!(typeof goal.meta.storage === 'undefined')) {
                return false;
            }
            if(goal.meta.transfer) {
                return true;
            }
            if(target.structureType == STRUCTURE_STORAGE) {
                return false;
            }
            return true;
        });
        _.forEach(unroutedGoals, function (urgoal) {
            var room = Game.rooms[self.parentClaim];
            if(!room) {
                return false;
            }
            var storage = room.storage;
            if(!storage) {
                return false;
            }
            var goals = [{pos: storage.pos, range: 1}];
            var ret = PathFinder.search(urgoal.target.pos, goals, {
                plainCost: 2,
                swampCost: 10,
                roomCallback: utils.workerRoomCostsGenerator()
            });
            if(ret.incomplete) {
                return true;
                //throw new Error('could not find a path from ' + urgoal.target.pos + ' to any storage within 3 rooms');
            }
            ret.path.reverse();
            // we should do something with the failedPos eventually, right now i'm lazy
            var failedPos: failedPos = utils.buildRoadsByPath(ret.path);
            urgoal.meta.storage = storage.id;
            delete urgoal.meta.rebuildStorage;
            urgoal.meta.pathLength = ret.path.length * 2;
        });
    }
    removeRoomNodesAndCleanup(roomName: string) {
        var self = this;
        _.forEach(_.filter(self.goals, function(goal) {
            return goal.roomName == roomName;
        }), function (goal) {
            _.forEach(goal.assignments, function (creepName) {
                self.creeps[creepName].suicide();
            });
            self.removeGoal(goal.id);
        });
    }
    getStorages() {
        var self = this;
        var room = Game.rooms[self.parentClaim];
        if(room.storage) {
            return [room.storage];
        }
    }
    getStoragesAtRange(roomName : string, range : number) {
        var self = this;
        var rooms = utils.getRoomsAtRange(roomName, range);
        var storages : StructureStorage[] = [];
        _.forEach(rooms, function (distance, roomName) {
            if(!Game.rooms[roomName]) {
                return true;
            }
            var storage = Game.rooms[roomName].storage;
            if(storage) {
                storages.push(storage);
            }
        });
        return storages;
    }
    addNode(node : Mineral | Source | string, type: string, ept : number) {
        var self = this;
        var nodeObj;
        if(typeof node == 'string') {
            nodeObj = Game.getObjectById(node);
        } else {
            nodeObj = node;
        }
        if(self.goals[nodeObj.id]) {
            return;
        }
        self.addGoal(nodeObj.pos.roomName, nodeObj, {range: 1, type: type, ept: ept});
        if(type == 'storage') {
            self.rebuildStoragesAround(nodeObj.pos.roomName);
        }
    }
    rebuildStoragesAround(roomName : string) {
        var self = this;
        var rooms = utils.getRoomsAtRange(roomName, 3);
        var goalsByRoom = _.groupBy(self.goals, function (goal) {
            return goal.roomName;
        });
        _.forEach(rooms, function (distance, roomName) {
            _.forEach(goalsByRoom[roomName], function (goal) {
                delete goal.meta.storage;
            });
        });
    }
    updateRequisition() {
        var self = this;
        var creeps : creepDescription[] = [];
        _.forEach(self.goals, function (goal : GoalClass) {
            if(!goal.meta.storage || goal.meta.type == 'storage' || goal.meta.ept == 0) {
                return true;
            }
            var capacity = self.getRequiredCapacityForGoal(goal);
            var curCapacity = _.reduce(goal.assignments, function (total, creepName: string) {
                return (total + _.reduce(self.creeps[creepName].body, function (total, part) {
                    if(part.type == 'carry') {
                        return total + 1;
                    }
                    return total;
                }, 0));
            }, 0);
            if(capacity > curCapacity) {
                creeps.push({
                    power: capacity - curCapacity,
                    type: 'transporter',
                    memory: {},
                    id: goal.id,
                    jobName: self.name,
                    parentClaim: self.parentClaim,
                    waitingSince: Game.time,
                    newClaim: undefined
                });
            }
        });
        self.jobs.spawn.addRequisition(creeps);
    }
    getRequiredCapacityForGoal(goal : GoalClass) {
        var self = this;
        var stats = self.getStatsForGoal(goal);
        var carryParts = Math.ceil(stats.maxHeld/50);
        return carryParts + 1;
    }
    netEnergyOnStorage(storageGoal : GoalClass) {
        var self = this;
        var storageGoals = _.filter(self.goals, function (goal) {
            if(goal.meta.storage == storageGoal.id) {
                return true;
            }
            return false;
        });
        return _.reduce(storageGoals, function (total, goal) {
            return total + goal.meta.ept;
        }, 0);
    }
    getStatsForGoal(goal : GoalClass) {
        var self = this;
        var maxHolding = Math.floor(goal.meta.ept * goal.meta.pathLength);
        var netEnergy = 0;
        if(goal.meta.type == 'sink') {
            netEnergy = -1 * goal.meta.ept * goal.meta.pathLength;
        } else if(goal.meta.type == 'source') {
            netEnergy = goal.meta.ept * goal.meta.pathLength;
        }
        return {
            maxHeld: maxHolding,
            netEnergy: netEnergy
        };
    }
    getUsableStorageAmountForGoal(goalId : string) {
        var self = this;
        var storageAmount = 0;
        if(!self.goals[goalId]) {
            return false;
        }
        if(self.goals[goalId].meta.type == 'storage') {
            let storage = <StructureStorage>self.goals[goalId].target;
            storageAmount = storage.store[RESOURCE_ENERGY];
        } else {
            if(!self.goals[goalId].meta.storage) {
                return false;
            }
            var storageGoalId = self.goals[goalId].meta.storage;
            let storage = <StructureStorage>self.goals[storageGoalId].target;
            storageAmount = storage.store[RESOURCE_ENERGY];
        }
        return Math.max(0, (storageAmount - self.minStorageBuffer));
    }
    setEPTForGoal(goalId : string, ept : number) {
        var self = this;
        self.goals[goalId].meta.ept = ept;
    }
    get minStorageBuffer () {
        return 100000;
    }
    controlCreep(myCreep : CreepClass) {
        var self = this;
        if (myCreep.arrived()) {
            if(myCreep.goal.target instanceof StructureStorage) {
                var storage = myCreep.goal.target;
                myCreep.goal = self.goals[myCreep.memory.assignment];
                if(myCreep.goal.meta.type == 'sink') {
                    myCreep.withdraw(storage, RESOURCE_ENERGY);
                } else if(myCreep.goal.meta.type == 'source') {
                    myCreep.transfer(storage, RESOURCE_ENERGY);
                }
                myCreep.goal = self.goals[myCreep.memory.assignment];
                delete myCreep.memory.assignment;
            } else {
                var container = <StructureContainer>myCreep.goal.target;
                if(myCreep.goal.meta.type == 'sink') {
                    myCreep.transfer(container, RESOURCE_ENERGY);
                } else if(myCreep.goal.meta.type == 'source') {
                    myCreep.withdraw(container, RESOURCE_ENERGY);
                }
                myCreep.memory.assignment = myCreep.goal.id;
                myCreep.goal = self.goals[myCreep.goal.meta.storage];
            }
        }
        myCreep.navigate();
    }
    controlWorkers() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            _.forEach(goal.assignments, function (creepName) {
                self.controlCreep(self.creeps[creepName]);
            });
        });
        _.forEach(self.getUnassignedCreeps(), function (creep) {
            creep.moveOffRoad();
        });
    }
}
module.exports = LogisticsJob;
