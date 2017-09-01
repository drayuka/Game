var utils = require('utils');
var goal = require('goal');
var job = require('job');
class evacuator extends job {
    execute() {
        var self = this;
        self.scanRoomForAttackers();
    }
    allowEvacuation(roomName) {
        var self = this;
        if (!self.memory.rooms) {
            self.memory.rooms = {};
        }
        var sources = Game.rooms[roomName].find(FIND_SOURCES);
        self.memory.rooms[roomName] = {
            sources: sources.length,
            minInvasionTime: 0,
        };
    }
    disallowEvacuation(roomName) {
        var self = this;
        delete self.memory.rooms[roomName];
    }
    scanRoomForAttackers() {
        var self = this;
        _.forEach(self.memory.rooms, function (room, roomName) {
            if (Game.time < room.minInvasionTime && !room.beingInvaded) {
                return true;
            }
            var invaders = [];
            if (Game.rooms[roomName]) {
                var creeps = Game.rooms[roomName].find(FIND_CREEPS);
                invaders = _.filter(creeps, function (creep) {
                    if (!creep.my && creep.owner == 'Invader') {
                        return 1;
                    }
                    return 0;
                });
            }
            if (invaders.length == 0 && !room.beingInvaded) {
                return true;
            }
            if (invaders.length == 0 && room.beingInvaded) {
                self.releaseCreeps(roomName);
            }
            room.minInvasionTime = Game.time + Math.floor(7000 / room.sources);
            var myCreeps = _.map(_.filter(creeps, function (creep) {
                if (creep.my) {
                    return 1;
                }
                return 0;
            }), function (creep) {
                return creep.name;
            });
            self.evacuateCreeps(roomName, invaders, myCreeps);
        });
    }
    evacuateCreeps(roomName, invaders, myCreeps) {
        var self = this;
        global.jobs.spawn.disallowSpawningInRoom(roomName);
    }
    releaseCreeps(roomName) {
        var self = this;
        global.jobs.spawn.allowSpawningInRoom(roomName);
    }
}
module.exports = evacuator;
