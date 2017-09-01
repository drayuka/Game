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
    execute () {
        var self = this;
        self.checkRooms();
    }
    get claimedRooms () {
        var self = this;
        if(!self.memory.claimedRooms) {
            self.memory.claimedRooms = [];
        }
        return self.memory.claimedRooms;
    }
    set claimedRooms (roomList) {
        var self = this;
        self.memory.claimedRooms = roomList;
    }
    get reservedRooms () {
        var self = this;
        if(!self.memory.reservedRooms) {
            self.memory.reservedRooms = {};
        }
        return self.memory.reservedRooms;
    }
    set reservedRooms () {
        var self = this;
        self.memory.reservedRooms;
    }
    claimRoom (claimedRoomName) {
        var self = this;
        if(self.claimedRooms[claimedRoomName]) {
            throw new Error('room ' + claimedRoomName + ' is already claimed');
        }
        self.claimedRooms[claimedRooms] = {};
    }
    //reserve a room for use by a claimed room, this means that the claimed room should spawn everything
    //claimed rooms without spawns cannot reserve any rooms
    reserveRoom (reservedRoomName, claimedRoomName) {
        var self = this;
        if(!reservedRoomName) {
            throw new Error('no reservedRoomName');
        } else if (!claimedRoomName) {
            throw new Error('no claimedRoomName');
        }
        if(!_.find(self.claimedRooms, function (roomName) {
            return claimedRoomName == roomName;
        })) {
            throw new Error('room ' + claimedRoomName + ' is not a recorded claimed room and cannot be used as the parent of room ' + reservedRoomName + ' for reservation');
        }
        if(!Game.rooms[claimedRoomName]) {
            throw new Error('claimed room ' + claimedRoomName + ' is not visible');
        }
        if(_.find(self.reservedRooms[claimedRoomName], function (roomName) {
            return reservedRoomName == roomName;
        })) {
            throw new Error('room ' + reservedRoomName + ' is ')
        }
        //all checks are done, add it in;
        self.reservedRooms[claimedRoomName][reservedRoomName] = {};
    }
    //also automatically unreserves all rooms associated with that claimed room
    unClaimRoom (claimedRoomName) {
        var self = this;
        if(!_.find(self.claimedRooms, function (roomName) {
            return roomName == claimedRoomName;
        })) {
            throw new Error('room ' + claimedRoomName + ' cannot be unclaimed as it was not claimed');
        }
        self.claimedRooms = _.filter(self.claimedRooms, function (claimRoomName) {
            return claimRoomName != claimedRoomName; 
        });
        roomMemory = self.claimedRooms[claimedRoomName];
        if(roomMemory.upgrading) {
            global.jobs.upgrade.removeRoom(claimedRoomName);
        } else if(roomMemory.claiming) {
            global.jobs.claim.removeRoom(claimedRoomName);
        }
        if(roomMemory.linking) {
            global.jobs.links.removeRoomLinks(roomName);
        }
        if(roomMemory.mining) {
            global.jobs.mining.removeDeposits(roomName);
        }
        if(roomMemory.roomworker) {
            global.jobs.roomworker.removeRoom(roomName);
        }
        if(roomMemory.harvest) {
            global.jobs.harvest.removeSources(roomName);
        }
        //always do this as other jobs create the goals for logistics
        global.jobs.logistics.removeRoomNodesAndCleanup(roomName);
        _.forEach(self.claimedRooms[claimedRoomName].reservedRooms, function (reservedRoom, roomName) {
            self.unReserveRoom(roomName);
        });

        Game.rooms[roomName].controller.unclaim();
        delete self.claimedRooms[claimedRoomName];
    }
    unReserveRoom (reservedRoomName) {
        var self = this;
        if(!_.find(self.claimedRooms, function(roomName) {
            return roomName == reservedRoomName;
        })) {
            throw new Error('room ' + reservedRoomName + ' cannot be unreserved as it was not reserved');
        }
        var claimedRoom = self.getReservedRoomClaimRoom(reservedRoomName);
    }
    getReservedRoomClaimRoom(roomName) {
        var self = this;
        if(self.reserveRoomToClaimRoom) {
            return self.reserveRoomToClaimRoom(roomName);
        }
        var reserveToClaim = {};
        _.forEach(self.claimedRooms, function (claimedRoom) {
            
        });
        self.reserveRoomToClaimRoom = reserveToClaim;
    }
    addAndRemoveRooms() {
        var self = this;
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
        if(!self.memory.rooms) {
            self.memory.rooms = {};
        }
        _.forEach(self.memory.claimedRooms, function (roomName) {
            var roomMemory = self.memory.rooms[roomName];
            if(!Game.rooms[roomName]) {
                if(!roomMemory.scouting) {
                    roomMemory.scouting = global.jobs.scout.addRoomToScout(roomName);
                }
                return true;
            }
            var room = Game.rooms[roomName]
            if(room.controller.my && !roomMemory.upgrading) {
                roomMemory.upgrading = global.jobs.upgrade.addRoom(roomName);
            } else if(!room.controller.my && !roomMemory.claiming) {
                roomMemory.claiming = global.jobs.claim.addRoomToClaim(roomName);
            }
            if(room.terminal && !roomMemory.terminal) {
                roomMemory.terminal = global.jobs.logistics.addNode(Game.rooms[roomName].terminal, 'terminal');
            }
            if(room.storage && !roomMemory.storage) {
                roomMemory.storage = global.jobs.logistics.addNode(Game.rooms[roomName].storage, 'storage');
            }
            if((room.controller.level >= 5) && (roomMemory.prevLevel != room.controller.level || !roomMemory.linking)) {
                roomMemory.linking = global.jobs.links.setupRoomLinks(roomName);
            }
            if(!roomMemory.mining && room.controller.level >= 6) {
                roomMemory.mining = global.jobs.mining.addDeposits(roomName);
            }

            if(!roomMemory.labs || roomMemory.prevLevel != room.controller.level) {
                roomMemory.labs = global.jobs.lab.checkForNewLabs(roomName);
            }
            //leave this at the end so that prevLevel and current level comparisons will all show that the level has changed
            roomMemory.prevLevel = room.controller.level
        });
        var reserveLevelRooms = _.union(self.memory.reservedRooms, self.memory.claimedRooms);
        _.forEach(reserveLevelRooms, function (roomName) {
            if(!self.memory.rooms[roomName]) {
                self.memory.rooms[roomName] = {};
            }
            var roomMemory = self.memory.rooms[roomName];
            if(!Game.rooms[roomName]) {
                if(!roomMemory.scouting) {
                    roomMemory.scouting = global.jobs.scout.addRoomToScout(roomName);
                }
                return true;
            }
            if(!roomMemory.roomworker) {
                roomMemory.roomworker = global.jobs.roomworker.addRoom(roomName);
            }
            if(!roomMemory.reserved && !_.includes(self.memory.claimedRooms, roomName)) {
                roomMemory.reserved = global.jobs.reserve.addRoomToReserve(roomName);
            }
            if(!roomMemory.harvest) {
                roomMemory.harvest = global.jobs.harvest.addSources(roomName);
            }
            if(!roomMemory.protect) {
                roomMemory.protect = global.jobs.protector.addRoomToProtect(roomName);
            }
        });
    }
}

interface
module.exports = bootstrap;