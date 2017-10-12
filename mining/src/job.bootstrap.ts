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

interface roomMemory {
    upgrading : boolean,
    claimed : boolean,
    claiming : boolean,
    linking : boolean,
    mining : boolean,
    roomworker : boolean,
    harvest : boolean,
    scout : boolean,
    reserve : boolean,
    logistics : boolean,
    protector : boolean,
}
interface JobList {
    upgrade : upgradeControllerJob,
    spawn : spawnJob,
    harvest : harvestJob,
    logistics : logisticsJob,
    claim : claimJob,
    scout : scoutJob,
    reserve : reserveJob,
    roomworker : roomworkerJob,
    links : linksJob,
    protector : protectorJob,
    mining : miningJob,
    tower : towerJob
}

interface roomDirectory {
    [key: string] : claimedRoom
}

interface claimedRoom {
    roomMemory : roomMemory
    reservedRooms : {
        [key : string] : {
            roomMemory : roomMemory
        }
    },
    jobs : JobList
}
// can be called with just name, or with target as well
class bootstrapJob {
    _reserveRoomToClaimRoom : {[key: string] : string} | undefined;
    memory: any;
    constructor() {
        if(!Memory.jobs.bootstrap) {
            Memory.jobs.bootstrap = {};
        }
        self.memory = Memory.jobs.bootstrap;
    }
    get claimedRooms () : roomDirectory {
        var self = this;
        if(!self.memory.claimedRooms) {
            self.memory.claimedRooms = {};
        }
        return self.memory.claimedRooms;
    }
    set claimedRooms (roomList) {
        var self = this;
        self.memory.claimedRooms = roomList;
    }
    //alternative to patchHarness having to
    //claim and reserve rooms, setup flagging system.
    scanForRooms() {
        var self = this;
        _.forEach(Game.flags, function (flag) {
            if(flag.pos.roomName) {

            }
        });
    }
    claimRoom (claimedRoomName : string) {
        var self = this;
        if(!claimedRoomName) {
            throw new Error('no claimed room name');
        }
        if(self.claimedRooms[claimedRoomName]) {
            throw new Error('room ' + claimedRoomName + ' is already claimed');
        }
        var room = Game.rooms[claimedRoomName];
        if(room) {
            if(room.controller.owner && room.controller.owner.username != global.username) {
                throw new Error(claimedRoomName + ' is currently claimed by ' + room.controller.owner.username);
            }
        } else if (!Game.map.isRoomAvailable) {
            throw new Error(claimedRoomName + ' is unavailable for claiming');
        }
        self.claimedRooms[claimedRoomName] = {
            roomMemory: {
                upgrading : false,
                claiming : false,
                claimed : false,
                linking : false,
                mining : false,
                roomworker : false,
                harvest : false,
                scout : false,
                reserve : false,
                logistics : false,
                protector : false
            }, 
            reservedRooms: {}, 
            jobs: <JobList>{}
        };
        self.initalizeRoom(self.claimedRooms[claimedRoomName], claimedRoomName);
        var claimedRoom = self.claimedRooms[claimedRoomName];
        var room = Game.rooms[claimedRoomName];
        if(room && room.controller.owner && room.controller.owner.username == global.username) {
            claimedRoom.roomMemory.claimed = true;
            //if the room is already claimed we don't need to scout it
            claimedRoom.roomMemory.scout = true;
            return;
        }
        claimedRoom.roomMemory.scout = true;
        claimedRoom.roomMemory.claiming = true;
        claimedRoom.jobs.scout.addRoomToScout(claimedRoomName);
        claimedRoom.jobs.claim.addRoomToClaim(claimedRoomName);
        return;
    }
    //reserve a room for use by a claimed room, this means that the claimed room should spawn everything
    //claimed rooms without spawns cannot reserve any rooms
    reserveRoom (reservedRoomName : string, claimedRoomName : string) {
        var self = this;
        if(!reservedRoomName) {
            throw new Error('no reservedRoomName');
        } else if (!claimedRoomName) {
            throw new Error('no claimedRoomName');
        }
        if(!_.find(self.claimedRooms, function (room, roomName) {
            return claimedRoomName == roomName;
        })) {
            throw new Error('room ' + claimedRoomName + ' is not a recorded claimed room and cannot be used as the parent of room ' + reservedRoomName + ' for reservation');
        }
        if(!Game.rooms[claimedRoomName]) {
            throw new Error('claimed room ' + claimedRoomName + ' is not visible');
        }
        if(_.find(self.claimedRooms[claimedRoomName].reservedRooms, function (room, roomName) {
            return reservedRoomName == roomName;
        })) {
            throw new Error('room ' + reservedRoomName + ' is already reserved by this room')
        }
        var room = Game.rooms[reservedRoomName];
        if(room && room.controller.owner) {
            throw new Error(reservedRoomName + ' is already owned by ' + room.controller.owner.username);
        }
        //all checks are done, add it in;
        self.claimedRooms[claimedRoomName].reservedRooms[reservedRoomName] = {roomMemory : {
            upgrading : false,
            claiming : false,
            claimed : false,
            linking : false,
            mining : false,
            roomworker : false,
            harvest : false,
            scout : false,
            reserve : false,
            logistics : false,
            protector : false
        }};
        var claimedRoom = self.claimedRooms[claimedRoomName];
        delete self._reserveRoomToClaimRoom;
    }
    //also automatically unreserves all rooms associated with that claimed room
    unClaimRoom (claimedRoomName : string) {
        var self = this;
        if(!_.find(self.claimedRooms, function (room, roomName) {
            return roomName == claimedRoomName;
        })) {
            throw new Error('room ' + claimedRoomName + ' cannot be unclaimed as it was not claimed');
        }
        var claimedRoom = self.claimedRooms[claimedRoomName];
        var roomMemory : roomMemory = self.claimedRooms[claimedRoomName].roomMemory;
        if(roomMemory.upgrading) {
            claimedRoom.jobs.upgrade.removeRoom(claimedRoomName);
        } else if(roomMemory.claiming) {
            claimedRoom.jobs.claim.removeRoom(claimedRoomName);
        }
        if(roomMemory.linking) {
            claimedRoom.jobs.links.removeRoomLinks(claimedRoomName);
        }
        if(roomMemory.mining) {
            claimedRoom.jobs.mining.removeDeposits(claimedRoomName);
        }
        if(roomMemory.roomworker) {
            claimedRoom.jobs.roomworker.removeRoom(claimedRoomName);
        }
        if(roomMemory.harvest) {
            claimedRoom.jobs.harvest.removeSources(claimedRoomName);
        }
        //always do this as other jobs create the goals for logistics
        claimedRoom.jobs.logistics.removeRoomNodesAndCleanup(claimedRoomName);
        _.forEach(self.claimedRooms[claimedRoomName].reservedRooms, function (reservedRoom, roomName) {
            self.unReserveRoom(roomName);
        });
        Game.rooms[claimedRoomName].find(FIND_STRUCTURES, {filter: function (struct : Structure) {
            struct.destroy();
        }});
        Game.rooms[claimedRoomName].controller.unclaim();
        delete self.claimedRooms[claimedRoomName];
    }
    //TODO: FIX AS THIS DOES NOT CURRENTLY WORK
    unReserveRoom (reservedRoomName : string) {
        throw new Error('unreserve room is currently non functional');
        var self = this;
        if(!_.find(self.claimedRooms, function(room, roomName) {
            return roomName == reservedRoomName;
        })) {
            throw new Error('room ' + reservedRoomName + ' cannot be unreserved as it was not reserved');
        }
        var claimedRoom = self.reservedRoomClaimRoom[reservedRoomName];
    }
    get reservedRoomClaimRoom() {
        var self = this;
        if(self._reserveRoomToClaimRoom) {
            return self._reserveRoomToClaimRoom;
        }
        self._reserveRoomToClaimRoom = {};
        _.forEach(self.claimedRooms, function (claimedRoom, claimedRoomName) {
            _.forEach(self.claimedRooms[claimedRoomName].reservedRooms, function (reservedRoom, reservedRoomName) {
                self._reserveRoomToClaimRoom[reservedRoomName] = claimedRoomName;
            });
        });
        return self._reserveRoomToClaimRoom;
    }
    initializeRooms() {
        var self = this;
        _.forEach(self.claimedRooms, function (claimedRoom, claimedRoomName) {
            self.initalizeRoom(claimedRoom, claimedRoomName);
        });
    }
    initalizeRoom(claimedRoom : claimedRoom, claimedRoomName: string) {
        if(!claimedRoom.jobs) {
            claimedRoom.jobs = <JobList>{};
            _.forEach(global.jobClasses, function (jobClass, jobName: string) {
                try {
                    claimedRoom.jobs[jobName] = new jobClass(jobName, claimedRoomName);
                } catch (e) {
                    console.log('job ' + jobName + ' had the following error on instantiation:');
                    console.log(e.stack);
                    debugger;
                }
            });
        }
    }
    runRooms() {
        var self = this;
        self.checkRooms();
        _.forEach(self.claimedRooms, function (claimedRoom: claimedRoom, claimedRoomName : string) {
            _.forEach(claimedRoom.jobs, function (job, jobName) {
                try {
                    job.execute();
                } catch (e) {
                    console.log('job ' + jobName + ' had the following error when executing:');
                    console.log(e.stack);
                    debugger;
                }
            });
        });
    }
    checkClaimedRoom(roomName: string, roomMemory: any) {
        var self = this;
        if(!Game.rooms[roomName]) {
            console.log('cant check claimed room ' + roomName + ' as it is not visible');
        }
        var room = Game.rooms[roomName];
    }
    checkRooms() {
        var self = this;

        _.forEach(self.claimedRooms, function (claimedRoom, claimedRoomName) {
            claimedRoomMemory = claimedRoom.roomMemory;
            checkClaimedRoom(claimedRoomName, claimedRoomMemory);
        });
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