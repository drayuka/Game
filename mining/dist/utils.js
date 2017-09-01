/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('utils');
 * mod.thing == 'a thing'; // true
 */
var Utils = {
    /* requires that you have vision into all rooms that the positions are in
    / options - {
        noRoads - boolean - set if you don't want to return "open" positions with roads
        noHaltingCreeps - boolean - set if you don't want to automatically remove locations claimed by halting creeps
    }
    */
    openPositionsAround: function (positions, options) {
        var around = [];
        if (!options) {
            options = {};
        }
        var started = 0;
        for (var i in positions) {
            var roomPosition = positions[i].pos;
            var minRange = positions[i].minRange;
            var maxRange = positions[i].maxRange;
            if (positions[i].range) {
                maxRange = positions[i].range;
                minRange = 1;
            }
            var spaces = Game.rooms[roomPosition.roomName].lookForAtArea(LOOK_TERRAIN, roomPosition.y - maxRange, roomPosition.x - maxRange, roomPosition.y + maxRange, roomPosition.x + maxRange, 1);
            var spaces = _.filter(spaces, function (space) {
                if (space.x > 49 || space.x < 0 || space.y > 49 || space.y < 0) {
                    return 0;
                }
                if (space.terrain == 'wall') {
                    return 0;
                }
                var pos = new RoomPosition(space.x, space.y, roomPosition.roomName);
                if (pos.getRangeTo(roomPosition) < minRange) {
                    return 0;
                }
                if (!options.noHaltingCreeps && Utils.obstructionAt(pos)) {
                    return 0;
                }
                if (options.noRoads) {
                    var road = Utils.getRoadAtPos(pos);
                    if (road) {
                        return 0;
                    }
                }
                return 1;
            });
            var newSpaces = _.map(spaces, function (space) {
                return space.x + 'y' + space.y;
            });
            if (!started) {
                around = newSpaces;
                started = 1;
            }
            else {
                around = _.intersection(around, newSpaces);
            }
        }
        return _.map(around, function (pos) {
            var roomName = positions[0].pos.roomName;
            var coord = pos.split('y');
            return new RoomPosition(coord[0], coord[1], roomName);
        });
    },
    buildRoadsByPath(path) {
        _.forEach(path, function (step) {
            if (step.x == 0 || step.y == 0 || step.x == 49 || step.y == 49) {
                return true;
            }
            var room = Game.rooms[step.roomName];
            if (!room) {
                throw new Error('new road goes through non-visible room');
            }
            if (Utils.getRoadAtPos(step)) {
                return true;
            }
            var result = room.createConstructionSite(step, STRUCTURE_ROAD);
            if (result == ERR_FULL) {
                console.log('cant build anymore road');
                return false;
            }
            else if (result == ERR_INVALID_TARGET) {
                console.log('cant build road at ' + step);
            }
            else if (result) {
                throw new Error('couldnt build ' + step + ' section of new road');
            }
        });
    },
    getRoadAtPos(pos) {
        return _.union(_.filter(pos.lookFor(LOOK_STRUCTURES), function (structure) {
            if (structure.structureType == STRUCTURE_ROAD) {
                return 1;
            }
            return 0;
        }), _.filter(pos.lookFor(LOOK_CONSTRUCTION_SITES), function (structure) {
            if (structure.structureType == STRUCTURE_ROAD) {
                return 1;
            }
            return 0;
        }))[0];
    },
    // should return an object with keys of roomNames and values of distances from the original room; 
    getRoomsAtRange(roomName, range) {
        var rooms = {};
        rooms[roomName] = 0;
        var newRooms = {};
        newRooms[roomName] = 1;
        _.times(range, function (d) {
            var distance = d + 1;
            var expandRooms = newRooms;
            newRooms = {};
            _.forEach(_.keys(expandRooms), function (curRoomName) {
                var exits = _.values(Game.map.describeExits(curRoomName));
                _.forEach(exits, function (newRoomName) {
                    if (typeof rooms[newRoomName] == 'undefined') {
                        rooms[newRoomName] = distance;
                        newRooms[newRoomName] = 1;
                    }
                });
            });
        });
        return rooms;
    },
    filterEdgeOfMapPositions: function (positions) {
        return _.filter(positions, function (pos) {
            if (pos.x < 2 || pos.x > 47 || pos.y < 2 || pos.y > 47) {
                return 0;
            }
            return 1;
        });
    },
    serializePath: function (path) {
        var spath;
        var roomName;
        spath = _.map(path, function (point) {
            return [point.x, point.y, point.roomName];
        });
        return spath;
    },
    deserializePath: function (path) {
        var uspath;
        var roomName;
        uspath = _.map(path, function (point) {
            return new RoomPosition(point[0], point[1], point[2]);
        });
        return uspath;
    },
    obstructionAt: function (pos) {
        var items = pos.lookFor(LOOK_STRUCTURES);
        var roomCosts = Utils.workerRoomCostsGenerator()(pos.roomName);
        if (roomCosts.get(pos.x, pos.y) == 255) {
            return 1;
        }
        return 0;
    },
    sameAsDestination: function (pos) {
        var found = _.findIndex(global.creepDestinations, function (dest) {
            return dest.isEqualTo(pos);
        });
        if (found != -1) {
            return 1;
        }
        return 0;
    },
    getPositionsAround: function (pos, range) {
        var positions = [];
        for (var x = pos.x - range; x < pos.x + range; x++) {
            if (x < 0 || x > 49) {
                continue;
            }
            for (var y = pos.y - range; y < pos.y + range; y++) {
                if (y < 0 || y > 49) {
                    continue;
                }
                positions.push({ x: x, y: y });
            }
        }
        return positions;
    },
    getRoomExit: function (startRoom, endRoom) {
        return Game.map.findExit(startRoom, endRoom);
    },
    getRoomPath: function (startRoom, endRoom) {
        return Game.map.findRoute(startRoom, endRoom, { routeCallback: function (roomName, fromRoomName) {
                if (roomName == 'E34S11') {
                    return Infinity;
                }
                if (roomName == 'E35S13') {
                    return Infinity;
                }
                return 1;
            } });
    },
    interRoomDistance: function (pos1, pos2) {
        if (pos1.roomName == pos2.roomName) {
            return pos1.getRangeTo(pos2);
        }
        var roomDistance = Game.map.getRoomLinearDistance(pos1.roomName, pos2.roomName);
        if (roomDistance > 5) {
            return 75 * roomDistance;
        }
        else {
            var roomPath = Utils.getRoomPath(pos1.roomName, pos2.roomName);
            return 50 * roomPath.length;
        }
    },
    workerRoomCosts: function () {
        return Utils.workerRoomCostsGenerator();
    },
    workerRoomCostsGenerator: function (ignoreCreeps, notLeaveRoom) {
        return function (roomName) {
            var room = Game.rooms[roomName];
            if (!room) {
                return;
            }
            if (global.rooms[room.name].workerCosts && !ignoreCreeps) {
                return global.rooms[room.name].workerCosts;
            }
            var costs = new PathFinder.CostMatrix;
            room.find(FIND_STRUCTURES).forEach(function (structure) {
                if (structure.structureType === STRUCTURE_ROAD) {
                    costs.set(structure.pos.x, structure.pos.y, 1);
                }
                else if (_.includes(OBSTACLE_OBJECT_TYPES, structure.structureType)) {
                    costs.set(structure.pos.x, structure.pos.y, 255);
                }
                else if (structure.structureType == STRUCTURE_RAMPART && !structure.my) {
                    costs.set(structure.pos.x, structure.pos.y, 255);
                }
            });
            room.find(FIND_CONSTRUCTION_SITES).forEach(function (structure) {
                if (structure.structureType == STRUCTURE_ROAD) {
                    costs.set(structure.pos.x, structure.pos.y, 1);
                }
                if (_.some(OBSTACLE_OBJECT_TYPES, function (type) {
                    return structure.structureType == type;
                })) {
                    costs.set(structure.pos.x, structure.pos.y, 255);
                }
            });
            if (notLeaveRoom) {
                room.find(FIND_EXIT).forEach(function (pos) {
                    costs.set(pos.x, pos.y, 255);
                });
            }
            if (!ignoreCreeps) {
                room.find(FIND_CREEPS).forEach(function (creep) {
                    if (creep.my) {
                        var myCreep = global.creeps[creep.name];
                        if (myCreep.goal && myCreep.goal.meta.halts) {
                            if (myCreep.memory.arrived) {
                                costs.set(creep.pos.x, creep.pos.y, 255);
                            }
                            else if (myCreep.path && myCreep.path.length != 0) {
                                var lastpos = myCreep.path[myCreep.path.length - 1];
                                costs.set(lastpos.x, lastpos.y, 255);
                            }
                        }
                        else if (myCreep.memory.arrived && !myCreep.goal) {
                            costs.set(myCreep.pos.x, myCreep.pos.y, 255);
                        }
                    }
                    else {
                        costs.set(creep.pos.x, creep.pos.y, 255);
                    }
                });
            }
            if (!ignoreCreeps) {
                global.rooms[room.name].workerCosts = costs;
            }
            return costs;
        };
    }
};
module.exports = Utils;
