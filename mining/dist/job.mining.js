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
var build = require('build');
class mining extends job {
    execute() {
        var self = this;
        self.updateBuilds();
        self.updateRequisition();
        self.controlWorkers();
    }
    get cleanGoalPositions() {
        var self = this;
        return 0;
    }
    // update any goals we are waiting for other jobs to make ready
    updateBuilds() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            if (goal.meta.extractorBuild) {
                var extractorBuildObj = global.builds[goal.meta.extractorBuild];
                if (extractorBuildObj.isFinished) {
                    delete goal.meta.extractorBuild;
                    extractorBuildObj.finishBuild();
                }
            }
            if (goal.meta.storage && Game.getObjectById(goal.meta.storage)) {
                return true;
            }
            if (goal.meta.storage && global.jobs.logistics.goals[goal.meta.storage]) {
                global.jobs.logistics.removeGoal(goal.meta.storage);
            }
            delete goal.meta.storage;
            if (!goal.meta.constructingStorage) {
                delete goal.meta.constructingStorage;
                var sites = goal.target.pos.findInRange(FIND_STRUCTURES, 1, { filter: function (struct) {
                        return struct.structureType == STRUCTURE_CONTAINER;
                    } });
                if (sites.length != 0) {
                    goal.meta.storage = sites[0];
                    goal.permanentPositions = [sites[0].pos];
                    global.jobs.roomworker.addGoal(goal.roomName, sites[0].id, { range: 3, priority: 3, halts: 1 });
                    global.jobs.logistics.addNode(sites[0], 'source', 3.2, goal.target.mineralType);
                }
                else {
                    var positions = utils.openPositionsAround([{ pos: goal.target.pos, minRange: 1, maxRange: 1 }]);
                    goal.meta.constructingStorage = build.newBuild(positions[0], STRUCTURE_CONTAINER);
                    goal.permanentPositions = [positions[0]];
                }
                return true;
            }
            var buildObj = global.builds[goal.meta.constructingStorage];
            if (buildObj.isFinished) {
                delete goal.meta.constructingStorage;
                goal.meta.storage = buildObj.getStructure().id;
                global.jobs.roomworker.addGoal(goal.roomName, buildObj.getStructure().id, { range: 3, priority: 3, halts: 1 });
                global.jobs.logistics.addNode(buildObj.getStructure(), 'source', 3.2, goal.target.mineralType);
                buildObj.finishBuild();
            }
        });
    }
    controlCreep(myCreep) {
        var self = this;
        if (myCreep.arrived()) {
            myCreep.harvest(myCreep.goal.target);
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
    addDeposits(newRoom) {
        var self = this;
        _.forEach(Game.rooms[newRoom].find(FIND_MINERALS), function (min) {
            // we will add positions and storages later;
            self.addGoal(newRoom, min, { halts: 1 });
            var extractor = Game.rooms[newRoom].find(FIND_STRUCTURES, { filter: function (struct) {
                    return struct.structureType == STRUCTURE_EXTRACTOR;
                } });
            if (extractor.length == 0) {
                self.goals[min.id].meta.extractorBuild = build.newBuild(min.pos, STRUCTURE_EXTRACTOR);
            }
        });
        return 1;
    }
    removeDeposits(roomName) {
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
            if (goal.assignments.length > 0 || goal.target.mineralAmount == 0 || goal.meta.constructingStorage || goal.meta.extractorBuild) {
                return true;
            }
            var maxSize = global.jobs.spawn.getMaxSizeForRoom('heavyworker', goal.roomName);
            if (maxSize < 16) {
                return true;
            }
            global.jobs.spawn.addRequisition(self.name, 'heavyworker', 16, goal.id, {});
        });
    }
}
module.exports = mining;
