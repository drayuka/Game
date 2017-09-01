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
// can be called with just name, or with target as well
class bootstrap extends job {
    execute() {
        var self = this;
        self.checkRooms();
        self.addAndRemoveRooms();
    }
    addAndRemoveRooms() {
        var self = this;
        var newClaimRooms = _.difference(Memory.claimedRooms, self.memory.claimedRooms);
        var oldClaimRooms = _.difference(self.memory.claimedRooms, Memory.claimedRooms);
        var newReserveRooms = _.difference(Memory.reservedRooms, self.memory.reservedRooms);
        var oldReserveRooms = _.difference(self.memory.reservedRooms, Memory.reservedRooms);
        // this is a case that is already handled normally
        oldReserveRooms = _.difference(oldReserveRooms, newClaimRooms);
        // for the moment "new" rooms don't need much as that is the default case
        _.forEach(oldClaimRooms, function (roomName) {
            global.jobs.upgrade.removeRoom(roomName);
            global.jobs.claim.removeRoom(roomName);
            global.jobs.links.removeRoomLinks(roomName);
            global.jobs.mining.removeDeposits(roomName);
            delete self.memory.rooms[roomName];
            Game.rooms[roomName].controller.unclaim();
        });
        _.forEach(_.union(oldReserveRooms, oldClaimRooms), function (roomName) {
            global.jobs.scout.removeRoom(roomName);
            global.jobs.roomworker.removeRoom(roomName);
            global.jobs.reserve.removeRoom(roomName);
            global.jobs.harvest.removeSources(roomName);
            global.jobs.logistics.removeRoomNodesAndCleanup(roomName);
            global.jobs.protector.removeRoomToProtect(roomName);
            delete self.memory.rooms[roomName];
        });
        self.memory.reservedRooms = _.cloneDeep(Memory.reservedRooms);
        self.memory.claimedRooms = _.cloneDeep(Memory.claimedRooms);
    }
    checkRooms() {
        var self = this;
        if (!self.memory.rooms) {
            self.memory.rooms = {};
        }
        _.forEach(self.memory.claimedRooms, function (roomName) {
            if (!self.memory.rooms[roomName]) {
                self.memory.rooms[roomName] = {};
            }
            var roomMemory = self.memory.rooms[roomName];
            if (!Game.rooms[roomName]) {
                if (!roomMemory.scouting) {
                    roomMemory.scouting = global.jobs.scout.addRoomToScout(roomName);
                }
                return true;
            }
            var room = Game.rooms[roomName];
            if (room.controller.my && !roomMemory.upgrading) {
                roomMemory.upgrading = global.jobs.upgrade.addRoom(roomName);
            }
            else if (!room.controller.my && !roomMemory.claiming) {
                roomMemory.claiming = global.jobs.claim.addRoomToClaim(roomName);
            }
            if (room.terminal && !roomMemory.terminal) {
                roomMemory.terminal = global.jobs.logistics.addNode(Game.rooms[roomName].terminal, 'terminal');
            }
            if (room.storage && !roomMemory.storage) {
                roomMemory.storage = global.jobs.logistics.addNode(Game.rooms[roomName].storage, 'storage');
            }
            if ((room.controller.level >= 5) && (roomMemory.prevLevel != room.controller.level || !roomMemory.linking)) {
                roomMemory.linking = global.jobs.links.setupRoomLinks(roomName);
            }
            if (!roomMemory.mining && room.controller.level >= 6) {
                roomMemory.mining = global.jobs.mining.addDeposits(roomName);
            }
            //leave this at the end so that prevLevel and current level comparisons will all show that the level has changed
            roomMemory.prevLevel = room.controller.level;
        });
        var reserveLevelRooms = _.union(self.memory.reservedRooms, self.memory.claimedRooms);
        _.forEach(reserveLevelRooms, function (roomName) {
            if (!self.memory.rooms[roomName]) {
                self.memory.rooms[roomName] = {};
            }
            var roomMemory = self.memory.rooms[roomName];
            if (!Game.rooms[roomName]) {
                if (!roomMemory.scouting) {
                    roomMemory.scouting = global.jobs.scout.addRoomToScout(roomName);
                }
                return true;
            }
            if (!roomMemory.roomworker) {
                roomMemory.roomworker = global.jobs.roomworker.addRoom(roomName);
            }
            if (!roomMemory.reserved && !_.includes(self.memory.claimedRooms, roomName)) {
                roomMemory.reserved = global.jobs.reserve.addRoomToReserve(roomName);
            }
            if (!roomMemory.harvest) {
                roomMemory.harvest = global.jobs.harvest.addSources(roomName);
            }
            if (!roomMemory.protect) {
                roomMemory.protect = global.jobs.protector.addRoomToProtect(roomName);
            }
        });
    }
}
module.exports = bootstrap;
