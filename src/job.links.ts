/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('job');
 * mod.thing == 'a thing'; // true
 */
var utils = require('utils');
var goal = require('goal');
var job = require('job');
var build = require('build');
// can be called with just name, or with target as well
class LinkJob extends JobClass {
    execute () {
        var self = this;
        self.updateLinks();
        self.updateRequisitions();
        self.controlLinks();
        self.controlCreeps();
    }
    removeRoomLinks(roomName) {
        _.forEach(self.goals, function (goal) {
            if(goal.roomName == roomName) {
                self.removeGoal(goal.id);
            }
        })
        if(self.memory.rooms && self.memory.rooms[roomName]) {
            delete self.memory.rooms[roomName];
        }
    }
    setupRoomLinks(roomName) {
        var self = this;
        var room = Game.rooms[roomName];
        if(!room) {
            return;
        }
        var linksAvailable = CONTROLLER_STRUCTURES['link'][room.controller.level];
        if(linksAvailable == 0) {
            return;
        }
        if(!self.memory.rooms) {
            self.memory.rooms = {};
        }
        if(!self.memory.rooms[roomName]) {
            self.memory.rooms[roomName] = {
                linkCount: 0,
                sourceLinks: {},
            };
        }
        var roomLinkInfo = self.memory.rooms[roomName];
        if(linksAvailable <= roomLinkInfo.linkCount) {
            return;
        }
        if(!roomLinkInfo.storageLink) {
            self.addStorageLinkToRoom(roomName);
        }
        if(linksAvailable <= roomLinkInfo.linkCount) {
            return;
        }
        if(!roomLinkInfo.upgradeLink) {
            self.addUpgradeLinkToRoom(roomName);
        }
        var sources = room.find(FIND_SOURCES);
        _.forEach(sources, function (source) {
            if(roomLinkInfo.linkCount == linksAvailable) {
                return false;
            }
            if(roomLinkInfo.sourceLinks && roomLinkInfo.sourceLinks[source.id]) {
                return true;
            }
            self.addSourceLinkToRoom(roomName, source.id);
        });
        return 1;
    }
    addStorageLinkToRoom(roomName) {
        var self = this;
        var room = Game.rooms[roomName];
        var roomLinkInfo = self.memory.rooms[roomName];
        var closePositions = utils.openPositionsAround([{pos: room.storage.pos, range: 1}], {noRoads: true});
        var farPositions = utils.openPositionsAround([{pos: room.storage.pos, maxRange: 2, minRange: 2}], {noRoads: true});
        if(farPositions.length == 0) {
            throw new Error('cant find a far position that is open and not on a road');
        }
        if(closePositions.length == 0) {
            throw new Error('cant find a close position that is open and not on a road');
        }
        var buildSpot;
        var transferSpot;
        _.forEach(closePositions, function (cpos) {
            var validFarPositions = _.filter(farPositions, function (fpos) {
                if(fpos.isNearTo(cpos)) {
                    return 1;
                }
                return 0;
            });
            if(validFarPositions.length == 0) {
                return true;
            }
            buildSpot = validFarPositions[0];
            transferSpot = cpos;
            return false;
        });

        roomLinkInfo.storageLink = {
            linkBuild: build.newBuild(buildSpot, STRUCTURE_LINK),
            creepLocation: [transferSpot.x, transferSpot.y, transferSpot.roomName]
        }
        roomLinkInfo.linkCount++;
    }
    addUpgradeLinkToRoom(roomName) {
        var self = this;
        var room = Game.rooms[roomName];
        var roomLinkInfo = self.memory.rooms[roomName];
        var closePositions = utils.openPositionsAround([{pos: room.controller.pos, minRange: 2, maxRange:2}], {noRoads: true});
        closePositions = _.sortBy(closePositions, function (pos) {
            var posClosePositions = utils.openPositionsAround([{pos: pos, range: 1}], {noRoads: true});
            var distance;
            if(roomLinkInfo.storageLink.link) {
                distance = Game.getObjectById(roomLinkInfo.storageLink.link).pos.getRangeTo(pos);
            } else {
                var storeLinkPos = global.builds[roomLinkInfo.storageLink.linkBuild].pos;
                distance = storeLinkPos.getRangeTo(pos);
            }
            return (8 - posClosePositions.length) + '.' + (distance);
        });
        if(closePositions.length != 0) {
            var buildSpot = closePositions[0];
            var upgradeGoal = self.jobs.upgrade.goals[room.controller.id];
            if(upgradeGoal.meta.storage) {
                var oldStorage = Game.getObjectById(upgradeGoal.meta.storage);
                oldStorage.destroy();
                var logisticsGoal = self.jobs.logistics.goals[oldStorage.id];
                self.jobs.logistics.removeGoal(logisticsGoal.id);
                delete upgradeGoal.meta.storage;
            }
            var surroundingPositions = utils.openPositionsAround([{pos: buildSpot, range: 1}], {noRoads: true});
            upgradeGoal.permanentPositions = surroundingPositions;
            delete upgradeGoal.meta.constructingStorage;
            upgradeGoal.meta.constructingLinkStorage = true;
            _.forEach(upgradeGoal.assignments, function (creepName) {
                global.creeps[creepName].suicide();
            });
            delete upgradeGoal.meta.requested;
            roomLinkInfo.upgradeLink = {
                linkBuild : build.newBuild(buildSpot, STRUCTURE_LINK)
            }
            roomLinkInfo.linkCount++;
        } else {
            throw new Error('tried to automatically build an upgradeLink for ' + roomName + ' but couldnt find a pos to build at');
        }
    }
    addSourceLinkToRoom(roomName, sourceId) {
        var self = this;
        var self = this;
        var room = Game.rooms[roomName];
        var roomInfo = self.memory.rooms[roomName];
        var source = Game.getObjectById(sourceId);
        var closePositions = utils.openPositionsAround([{pos: source.pos, range: 1}], {noRoads:true, noHaltingCreeps: true});
        var buildSpot;
        var harvestSpot;
        if(closePositions.length > 1) {
            // we have more than one position which is close to the harvest point
            _.forEach(closePositions, function (cpos) {
                var found = false;
                if(utils.obstructionAt(cpos)) {
                    return true;
                }
                _.forEach(_.drop(closePositions), function (cpos2) {
                    if(cpos.isNearTo(cpos2) && !cpos.isEqualTo(cpos2)) {
                        buildSpot = cpos;
                        harvestSpot = cpos2;
                        found = true;
                        return false;
                    }
                });
                if(found) {
                    return false;
                }
            });
        } 
        if(!buildSpot || !harvestSpot) {
            var farPositions = utils.openPositionsAround([{pos: source.pos, maxRange: 2, minRange: 2}], {noRoads: true});
            _.forEach(closePositions, function (cpos) {
                var validFarPositions = _.filter(farPositions, function (fpos) {
                    if(fpos.isNearTo(cpos)) {
                        return 1;
                    }
                    return 0;
                });
                if(validFarPositions.length == 0) {
                    return true;
                }
                buildSpot = validFarPositions[0];
                harvestSpot = cpos;
                return false;
            });
        }
        if(!buildSpot || !harvestSpot) {
            throw new Error('cannot auto build link for source ' + sourceId + ' at ' + source.pos);
        }
        if(!roomInfo.sourceLinks) {
            roomInfo.sourceLinks = {};
        }
        var harvestGoal = self.jobs.harvest.goals[sourceId];
        harvestGoal.permanentPositions = [harvestSpot];
        if(harvestGoal.meta.storage) {
            self.jobs.logistics.removeGoal(harvestGoal.meta.storage);
            Game.getObjectById(harvestGoal.meta.storage).destroy();
            delete harvestGoal.meta.storage;
        }
        delete harvestGoal.meta.dropHarvest;
        if(harvestGoal.meta.constructingStorage) {
            Game.getObjectById(harvestGoal.meta.constructingStorage).remove();
            delete harvestGoal.meta.constructingStorage;
        }
        roomInfo.sourceLinks[sourceId] = {
            linkBuild: build.newBuild(buildSpot, STRUCTURE_LINK)
        }
        harvestGoal.meta.linkStorage = true;
        roomInfo.linkCount++;
    }
    updateLinks() {
        var self = this;
        _.forEach(self.memory.rooms, function (roomInfo, roomName) {
            if(!Game.rooms[roomName]) {
                return true;
            }
            if(roomInfo.storageLink.linkBuild) {
                var globalBuild = global.builds[roomInfo.storageLink.linkBuild];
                if(globalBuild.isFinished) {
                    delete roomInfo.storageLink.linkBuild;
                    roomInfo.storageLink.link = globalBuild.getStructure().id;
                    self.addGoal(roomName, globalBuild.getStructure().id, {halts: 1, permanentPositions: [roomInfo.storageLink.creepLocation], storage: Game.rooms[roomName].storage.id});
                    globalBuild.finishBuild();
                }
            }
            if(roomInfo.upgradeLink.linkBuild) {
                var globalBuild = global.builds[roomInfo.upgradeLink.linkBuild];
                if(globalBuild.isFinished) {
                    delete roomInfo.upgradeLink.linkBuild;
                    roomInfo.upgradeLink.link = globalBuild.getStructure().id;
                    var controller = Game.rooms[roomName].controller;
                    var upgradeGoal = self.jobs.upgrade.goals[controller.id];
                    delete upgradeGoal.meta.constructingLinkStorage;
                    upgradeGoal.meta.storage = globalBuild.getStructure().id;
                    upgradeGoal.meta.linkStorage = true;
                    globalBuild.finishBuild();
                }
            }
            _.forEach(roomInfo.sourceLinks, function (sourceLink, sourceId) {
                if(sourceLink.linkBuild) {
                    var globalBuild = global.builds[sourceLink.linkBuild];
                    if(globalBuild.isFinished) {
                        delete sourceLink.linkBuild;
                        sourceLink.link = globalBuild.getStructure().id;
                        var harvestGoal = self.jobs.harvest.goals[sourceId];
                        delete harvestGoal.meta.constructingStorage;
                        harvestGoal.meta.storage = globalBuild.getStructure().id;
                    } else if(globalBuild.getBuild()) {
                        var harvestGoal = self.jobs.harvest.goals[sourceId];
                        if(!harvestGoal.meta.constructingStorage) {
                            harvestGoal.meta.constructingStorage = globalBuild.getBuild().id;
                        }
                    }
                }
            });
        });
    }
    updateRequisitions() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            if(goal.assignments.length != 0) {
                return true;
            }
            self.jobs.spawn.addRequisition(self.name, 'transporter', 16, goal.id, {});
        });
    }
    controlLinks() {
        var self = this;
        _.forEach(self.memory.rooms, function (roomInfo, roomName) {
            if(!roomInfo.storageLink.link) {
                return true;
            }
            var upgradeNeedsEnergy = false;
            var upgradeLink;
            if(roomInfo.upgradeLink.link) {
                upgradeLink = Game.getObjectById(roomInfo.upgradeLink.link);
                if(upgradeLink.energy <= 100) {
                    upgradeNeedsEnergy = true;
                }
            }
            var storageLink = Game.getObjectById(roomInfo.storageLink.link);
            var transferredEnergy = 0;
            var sourceLinkFull = false;
            var transferredToStorage = false;
            _.forEach(roomInfo.sourceLinks, function (sourceLink, sourceId) {
                if(!sourceLink.link) {
                    return true;
                }
                var sourceLinkObj = Game.getObjectById(sourceLink.link);
                if(!sourceLinkObj) {
                    delete roomInfo.sourceLinks[sourceId];
                    roomInfo.linkCount--;
                    return true;
                }
                if(sourceLinkObj.cooldown) {
                    return true;
                }
                if(upgradeNeedsEnergy && transferredEnergy < 100 && sourceLinkObj.energy > 700) {
                    transferredEnergy += sourceLinkObj.energy;
                    sourceLinkObj.transferEnergy(upgradeLink);
                } else if(upgradeNeedsEnergy && storageLink.cooldown != 0 && transferredEnergy < 700) {
                    transferredEnergy += sourceLinkObj.energy;
                    sourceLinkObj.transferEnergy(upgradeLink);
                } else if(sourceLinkObj.energy > 700 && storageLink.energy == 0 && !upgradeNeedsEnergy && !transferredToStorage) {
                    sourceLinkObj.transferEnergy(storageLink);
                    transferredToStorage = true;
                } else if(sourceLinkObj.energy > 700 && storageLink.energy != 0 && !upgradeNeedsEnergy) {
                    sourceLinkFull = true;
                }
            });
            var storageGoal = self.getGoalsInRoom(roomName)[0];
            storageGoal.meta.sending = false;
            storageGoal.meta.storing = false;
            if(storageLink.cooldown == 0 && upgradeNeedsEnergy && storageLink.energy >= 700) {
                storageLink.transferEnergy(upgradeLink);
            } else if(transferredEnergy < 700 && storageLink.cooldown == 0 && upgradeNeedsEnergy && storageLink.energy < 700) {
                storageGoal.meta.sending = true;
            } else if(sourceLinkFull) {
                storageGoal.meta.storing = true;
            }
        });
    }
    controlCreeps() {
        var self = this;
        _.forEach(self.creeps, function (creep) {
            self.controlCreep(creep);
        });
    }
    controlCreep(myCreep) {
        var self = this;
        if(myCreep.arrived()) {
            var storageLink = myCreep.goal.target;
            var storageGoal = myCreep.goal;
            var storage = Game.getObjectById(myCreep.goal.meta.storage);
            if(storageGoal.meta.sending) {
                if(_.sum(myCreep.carry) == myCreep.carryCapacity) {
                    myCreep.transfer(storageLink, RESOURCE_ENERGY);
                } else {
                    myCreep.withdraw(storage, RESOURCE_ENERGY);
                }
            } else if(storageGoal.meta.storing) {
                if(_.sum(myCreep.carry) == myCreep.carryCapacity) {
                    myCreep.transfer(storage, RESOURCE_ENERGY);
                } else {
                    myCreep.withdraw(storageLink, RESOURCE_ENERGY);
                }
            } else {
                if(_.sum(myCreep.carry) < myCreep.carryCapacity) {
                    myCreep.withdraw(storage, RESOURCE_ENERGY);
                }
            }
        } else {
            myCreep.navigate();
        }
    }
}
module.exports = LinkJob;