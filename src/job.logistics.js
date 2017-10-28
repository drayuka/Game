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
class logistics extends JobClass {
    execute() {
        var self = this;
        self.updateRoutes();
        self.removeCompleted();
        self.updateRequisition();
        self.controlWorkers();
    }
    updateRoutes () {
        var self = this;
        var unroutedGoals = _.filter(self.goals, function (goal) {
            if(!(typeof goal.meta.storage === 'undefined')) {
                return 0;
            }
            if(goal.meta.transfer) {
                return 1;
            }
            if(goal.target.structureType == STRUCTURE_STORAGE) {
                return 0;
            }
            if(goal.target.structureType == STRUCTURE_TERMINAL) {
                return 0;
            }
            return 1;
        });
        _.forEach(unroutedGoals, function (urgoal) {
            if(!Game.rooms[urgoal.roomName] || !urgoal.target) {
                return true;
            }
            var goals;
            if(urgoal.meta.resource == RESOURCE_ENERGY) {
                if(Game.rooms[urgoal.roomName].storage) {
                    goals = [{pos: Game.rooms[urgoal.roomName].storage.pos, range: 1}];
                } else {
                    goals = _.map(self.getStoragesAtRange(urgoal.roomName, 3) , function (goal) {
                        return {pos: goal.pos, range: 1};
                    });
                }
            } else {
                if(Game.rooms[urgoal.roomName].terminal) {
                    goals = [{pos: Game.rooms[urgoal.roomName].terminal.pos, range: 1}];
                } else {
                    goals = _.map(self.getTerminalsAtRange(urgoal.roomName, 3), function (goal) {
                        return {pos: goal.pos, range: 1};
                    });
                }
            }
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
            utils.buildRoadsByPath(ret.path);
            var storageRoom = ret.path[0].roomName;
            var storage;
            if(urgoal.meta.resource == RESOURCE_ENERGY) {
                storage = Game.rooms[storageRoom].storage;
            } else {
                storage = Game.rooms[storageRoom].terminal;
            }
            urgoal.meta.storage = storage.id;
            delete urgoal.meta.rebuildStorage;
            urgoal.meta.pathLength = ret.path.length * 2;
        });
    }
    removeCompleted() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            if(goal.meta.amount && goal.meta.amount <= 0) {
                self.removeGoal(goal.id);
            }
        });
    }
    removeRoomNodesAndCleanup(roomName) {
        var self = this;
        var hasStorage = false;
        var hasTerminal = false;
        _.forEach(self.getGoalsForRoom(roomName), function (goal) {
            if(goal.meta.type == 'storage') {
                hasStorage = goal.id;
            }
            if(goal.meta.type == 'terminal') {
                hasTerminal = goal.id;
            }
            _.forEach(goal.assignments, function (creepName) {
                self.creeps[creepName].suicide();
            });
            self.removeGoal(goal.id);
        });
        if(hasStorage) {
            _.forEach(self.goals, function (goal) {
                if(goal.meta.storage == hasStorage) {
                    delete goal.meta.storage;
                }
            });
        }
        if(hasTerminal) {
            _.forEach(self.goals, function (goal) {
                if(goal.meta.storage == hasTerminal) {
                    delete goal.meta.storage;
                }
            })
        }
    }
    getStorages() {
        var self = this;
        return _.map(_.filter(self.goals, function (goal) {
            if(goal.meta.type == 'storage') {
                return 1;
            }
            return 0;
        }), function (storage) {
            return storage.target;
        });
    }
    getStoragesAtRange(roomName, range) {
        var self = this;
        var rooms = utils.getRoomsAtRange(roomName, range);
        var storages = [];
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
    getTerminalsAtRange(roomName, range) {
        var self = this;
        var rooms = utils.getRoomsAtRange(roomName, range);
        var terminals = [];
        _.forEach(rooms, function (distance, roomName) {
            if(!Game.rooms[roomName]) {
                return true;
            }
            var terminal = Game.rooms[roomName].terminal;
            if(terminal) {
                terminals.push(terminal);
            }
        });
        return terminals;
    }
    addNode(node, type, ept, resource) {
        var self = this;
        var nodeObj = node;
        if(typeof node == 'string') {
            nodeObj = Game.getObjectById(node);
        }
        if(self.goals[nodeObj.id]) {
            return;
        }
        if(!resource) {
            resource = RESOURCE_ENERGY;
        }
        self.addGoal(nodeObj.pos.roomName, nodeObj, {range: 1, type: type, ept: ept, resource: resource});
        if(type == 'storage' || type == 'terminal') {
            self.rebuildStoragesAround(nodeObj.pos.roomName);
        }
    }
    rebuildStoragesAround(roomName) {
        var self = this;
        var rooms = utils.getRoomsAtRange(roomName, 3);
        var goalsByRoom = _.groupBy(self.goals, function (goal) {
            return goal.roomName;
        })
        _.forEach(rooms, function (distance, roomName) {
            _.forEach(goalsByRoom[roomName], function (goal) {
                delete goal.meta.storage;
            });
        });
    }
    updateRequisition() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            if(!goal.meta.storage || goal.meta.type == 'storage' || goal.meta.ept == 0) {
                return true;
            }
            var capacity = self.getRequiredCapacityForGoal(goal);
            var curCapacity = _.reduce(goal.assignments, function (total, creepName) {
                return (total + _.reduce(self.creeps[creepName].body, function (total, part) {
                    if(part.type == 'carry') {
                        return total + 1;
                    }
                    return total;
                }, 0));
            }, 0);
            if(capacity > curCapacity) {
                self.jobs.spawn.addRequisition(self.name, 'transporter', (capacity - curCapacity), goal.id, {});
            }
        });
    }
    getRequiredCapacityForGoal(goal) {
        var self = this;
        var stats = self.getStatsForGoal(goal);
        var carryParts = Math.ceil(stats.maxHeld/50);
        return carryParts + 1;
    }
    netEnergyOnStorage(storageGoal) {
        var self = this;
        var storageGoals = _.filter(self.goals, function (goal) {
            if(goal.meta.storage == storageGoal.id) {
                return 1;
            }
            return 0;
        });
        return _.reduce(storageGoals, function (total, goal) {
            return total + goal.meta.ept;
        }, 0);
    }
    getStatsForGoal(goal) {
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
    getUsableStorageAmountForGoal(goalId) {
        var self = this;
        var storageAmount = 0;
        if(!self.goals[goalId]) {
            return 0;
        }
        if(self.goals[goalId].meta.type == 'storage') {
            storageAmount = self.goals[goalId].target.store[RESOURCE_ENERGY];
        } else {
            if(!self.goals[goalId].meta.storage) {
                return 0;
            }
            var storageGoalId = self.goals[goalId].meta.storage;
            storageAmount = self.goals[storageGoalId].target.store[RESOURCE_ENERGY];
        }
        return Math.max(0, (storageAmount - self.minStorageBuffer));
    }
    setEPTForGoal(goalId, ept) {
        var self = this;
        self.goals[goalId].meta.ept = ept;
    }
    get minStorageBuffer () {
        return 100000;
    }
    controlCreep(myCreep) {
        var self = this;
        var resource = myCreep.goal.meta.resource;
        if(myCreep.memory.assignment) {
            resource = self.goals[myCreep.memory.assignment].meta.resource;
        }
        if (myCreep.arrived()) {
            if(myCreep.goal.target.structureType == STRUCTURE_STORAGE) {
                myCreep.goal = self.goals[myCreep.memory.assignment];
                var storage = Game.getObjectById(myCreep.goal.meta.storage);
                if(myCreep.goal.meta.type == 'sink') {
                    myCreep.withdraw(storage, resource);
                } else if(myCreep.goal.meta.type == 'source') {
                    myCreep.transfer(storage, resource);
                }
                delete myCreep.memory.assignment;
            } else if(myCreep.goal.meta.type == 'sink') {
                myCreep.transfer(myCreep.goal.target, resource);
                myCreep.memory.assignment = myCreep.goal.id;
                if(myCreep.goal.meta.amount) {
                    var amountDeposited = _.sum(myCreep.carry);
                    myCreep.goal.meta.amount -= amountDeposited;
                }
                myCreep.goal = self.goals[myCreep.goal.meta.storage];
            } else if(myCreep.goal.meta.type == 'source') {
                myCreep.withdraw(myCreep.goal.target, resource);
                myCreep.memory.assignment = myCreep.goal.id;
                myCreep.goal = self.goals[myCreep.goal.meta.storage];
            }
        }
        if(_.sum(myCreep.carry) != myCreep.carryCapacity) {
            var droppedResource = _.find(myCreep.pos.lookFor(LOOK_RESOURCES), function (res) {
                return res.resourceType == resource;
            });
            myCreep.pickup(droppedResource);
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
module.exports = logistics;
