/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('utils');
 * mod.thing == 'a thing'; // true
 */
 declare global {
    interface failedPos {
        unownedRoom: {[key: string] : RoomPosition},
        noConstruction: RoomPosition[],
        noVisibility: RoomPosition[]
    }
    interface distancePos {
        pos: RoomPosition,
        range: number
    }
    /*
        a pos with range-from-pos information attached
    */
    interface rangePos {
        pos: RoomPosition,
        minRange: number,
        maxRange: number
    }
    //serialized room position [x,y, roomName]
    interface roomPos {
        x: number, 
        y: number
        rn: string
    }
    interface openPositionsOptions {
        noRoads?: boolean,
        noHaltingCreeps?: boolean
    }
}
import * as _ from "lodash"

function isDistancePos(pos: distancePos | rangePos)    : pos is distancePos {
    return (typeof (<distancePos>pos).range) !== undefined;
}
export class Utils {
    /* requires that you have vision into all rooms that the positions are in
    / options - {
        noRoads - boolean - set if you don't want to return "open" positions with roads
        noHaltingCreeps - boolean - set if you don't want to automatically remove locations claimed by halting creeps
    }
    */
    static openPositionsAround (positions: Array<distancePos | rangePos>, entryOptions?: openPositionsOptions): RoomPosition[] {
        var around : string[] = [];
        var options : openPositionsOptions;
        if(entryOptions === undefined) {
            options = {noRoads: false, noHaltingCreeps: false};
        } else {
            options = entryOptions;
        }
        var started = 0;
        _.forEach(positions, function (position: distancePos | rangePos) {

            var roomPosition : RoomPosition = position.pos;
            let minRange: number;
            let maxRange: number;
            if(isDistancePos(position)) {
                maxRange = position.range;
                minRange = 1;
            } else {
                minRange = position.minRange;
                maxRange = position.maxRange;
            }

            var spaces = <LookAtResultWithPos[]>Game.rooms[roomPosition.roomName].lookForAtArea(LOOK_TERRAIN,
            roomPosition.y-maxRange, roomPosition.x-maxRange,
            roomPosition.y+maxRange, roomPosition.x+maxRange, true);
            var spaces = _.filter(spaces, function (space) {
                if(space.x > 49 || space.x < 0 || space.y > 49 || space.y < 0) {
                    return false;
                }
                if(space.terrain == 'wall') {
                    return false;
                }
                var pos = new RoomPosition(space.x, space.y, roomPosition.roomName);
                if(pos.getRangeTo(roomPosition) < minRange) {
                    return false;
                }
                if(!options.noHaltingCreeps && Utils.obstructionAt(pos)) {
                    return false;
                }
                if(options.noRoads) {
                    var road = Utils.getRoadAtPos(pos);
                    if(road) {
                        return false;
                    }
                }
                return true;
            });
            var newSpaces = _.map(spaces, function (space) {
                return space.x + 'y' + space.y;
            });
            if(!started) {
                around = newSpaces;
                started = 1;
            } else {
                around = _.intersection(around, newSpaces);
            }
        });
        return _.map(around, function (pos) {
            var roomName = positions[0].pos.roomName;
            var coord = _.map(pos.split('y'), function (coord) {
                return parseInt(coord);
            });
            return new RoomPosition(coord[0], coord[1], roomName);
        });
    }
    static buildRoadsByPath(path : RoomPosition[]) {
        var failedPos: failedPos = {
            unownedRoom: {},
            noConstruction: [],
            noVisibility: [],
        };
        _.forEach(path, function (step) {
            if(step.x == 0 || step.y == 0 || step.x == 49 || step.y == 49) {
                return true;
            }
            var room = Game.rooms[step.roomName];
            if(!room) {
                failedPos.noVisibility.push(step);
            }
            if(Utils.getRoadAtPos(step)) {
               return true; 
            }
            var result = room.createConstructionSite(step, STRUCTURE_ROAD);
            if(result == ERR_FULL) {
                failedPos.noConstruction.push(step);
                console.log('cant build anymore road');
            } else if(result == ERR_INVALID_TARGET) {
                console.log('cant build road at ' + step);
            } else if(result) {
                throw new Error('couldnt build ' + step + ' section of new road');
            } else if(global.bootstrap.claimedRooms[step.roomName] || global.bootstrap.subRoomToClaimRoom[step.roomName]) {
                failedPos.unownedRoom[step.roomName] = step;
            }
        });
        return failedPos;
    }
    static getRoadAtPos(pos: RoomPosition) : StructureRoad | undefined {
        return <StructureRoad>Utils.getStructureAtPos(pos, STRUCTURE_ROAD);
    }
    static getStructureAtPos(pos: RoomPosition, structureType: string) {
        return _.union(<RoomObject[]>_.filter(<Structure[]>pos.lookFor(LOOK_STRUCTURES), function (structure) {
            return structure.structureType == structureType
        }), _.filter(<ConstructionSite[]>pos.lookFor(LOOK_CONSTRUCTION_SITES), function (structure) {
            return structure.structureType == structureType
        }))[0];
    }
    // should return an object with keys of roomNames and values of distances from the original room; 
    static getRoomsAtRange(roomName: string, range: number) {
        var rooms : {[key: string] : number}= {};
        rooms[roomName] = 0;
        var newRooms : {[key: string] : number} = {};
        newRooms[roomName] = 1;
        _.times(range, function (d) {
            var distance = d + 1;
            var expandRooms = newRooms;
            newRooms = {};
            _.forEach(_.keys(expandRooms), function (curRoomName) {
                var exits = <string[]>_.values(Game.map.describeExits(curRoomName));
                _.forEach(exits, function (newRoomName) {
                    if(typeof rooms[newRoomName] == 'undefined') {
                        rooms[newRoomName] = distance;
                        newRooms[newRoomName] = 1;
                    }
                });
            });
        });
        return rooms;
    }
    static serializePath(path: RoomPosition[]) : [number, number, string][]{
        var spath : [number, number, string][];
        var roomName;
        spath = <[number, number, string][]>_.map(path, function (pos : RoomPosition) {
            return [pos.x, pos.y, pos.roomName];
        });
        return spath;
    }
    static deserializePath(path : [number, number, string][]) : RoomPosition[] {
        var uspath;
        var roomName;
        uspath = _.map(path, function (point) {
            return new RoomPosition(point[0], point[1], point[2]);
        });
        return uspath;
    }
    static obstructionAt(pos: RoomPosition) : boolean {
        var items = pos.lookFor(LOOK_STRUCTURES);
        var roomCosts = Utils.workerRoomCostsGenerator(false, false)(pos.roomName);
        if(!roomCosts) {
            return true;
        }
        if(roomCosts.get(pos.x, pos.y) == 255) {
            return true;
        }
        return false;
    }
    static getRoomExit(startRoom: string, endRoom: string) {
        return Game.map.findExit(startRoom,endRoom);
    }
    static getRoomPath(startRoom: string, endRoom: string) {
        return Game.map.findRoute(startRoom, endRoom, {routeCallback: function (roomName, fromRoomName) {
            if(roomName == 'E34S11') {
                return Infinity;
            }
            if(roomName == 'E35S13') {
                return Infinity;
            }
            return 1;
        }});
    }
    static interRoomDistance(pos1: RoomPosition, pos2: RoomPosition) {
        if(pos1.roomName == pos2.roomName) {
            return pos1.getRangeTo(pos2);
        }
        var roomDistance = Game.map.getRoomLinearDistance(pos1.roomName, pos2.roomName);
        if(roomDistance > 5) {
            return 75 * roomDistance;
        } else {
            var roomPath = Utils.getRoomPath(pos1.roomName, pos2.roomName);
            if(typeof roomPath === "number") {
                throw new Error('got err ' + roomPath + ' while pathing from ' + pos1.roomName + ' to ' + pos2.roomName);
            }
            return 50 * roomPath.length;
        }
    }
    static blockExits(costsMatrix: CostMatrix, roomName: string) {
        var room: Room;
        if(!Game.rooms[roomName]) {
            throw new Error('coudnt block exits for room ' + roomName + ' as there is no visibility');
        }
        room = Game.rooms[roomName];
        let exits = room.find<RoomPosition>(FIND_EXIT);
        exits.forEach(function(pos) {
            costsMatrix.set(pos.x, pos.y, 255);
        });
    }
    static workerRoomCosts(): (roomName: string) => CostMatrix {
        return Utils.workerRoomCostsGenerator(false, false)
    }
    static applyMyCreepCosts(costsMatrix: CostMatrix, roomName: string) {
        var room = Game.rooms[roomName];
        if(!room) {
            return;
        }
        room.find<Creep>(FIND_MY_CREEPS).forEach(function(creep) {
            var myCreep = global.creeps[creep.name];
            if(myCreep.memory.arrived) {
                costsMatrix.set(myCreep.pos.x, myCreep.pos.y, 255);
            } else if(myCreep.goal && myCreep.goal.meta.halts) {
                if(myCreep.path && myCreep.path.length != 0) {
                    var lastpos = myCreep.path[myCreep.path.length -1];
                    if(lastpos.roomName == roomName) {
                        costsMatrix.set(lastpos.x, lastpos.y, 255);
                    }
                }
            }
        });
    }
    static workerRoomCostsGenerator(ignoreCreeps: boolean, notLeaveRoom: boolean) : (roomName: string) => CostMatrix {
        return function(roomName: string) : CostMatrix {
            var room = Game.rooms[roomName];
            if(!room) {
                return new PathFinder.CostMatrix();
            }
            var costs = Utils.getBaseCosts(roomName);

            if(!ignoreCreeps) {
                Utils.applyMyCreepCosts(costs, roomName);
            }
            if(notLeaveRoom) {
                Utils.blockExits(costs, roomName);
            }
            return costs;
        }
    }
    static getBaseCosts(roomName: string): CostMatrix {
		var room = Game.rooms[roomName];
		if(!room) { 
            return new PathFinder.CostMatrix();
        }
        if(Memory.rooms[roomName].baseCosts && Memory.rooms[roomName].baseCosts.age + 1000 > Game.time) {
            return PathFinder.CostMatrix.deserialize(Memory.rooms[roomName].baseCosts.costsMatrix);
        }

        var costs = new PathFinder.CostMatrix();
    	
		room.find<Structure>(FIND_STRUCTURES).forEach(function(structure: Structure | OwnedStructure) {
			if(structure.structureType === STRUCTURE_ROAD) {
				costs.set(structure.pos.x, structure.pos.y, 1);
			} else if (_.includes(OBSTACLE_OBJECT_TYPES, structure.structureType)) {
				costs.set(structure.pos.x, structure.pos.y, 255);
			} else if (structure.structureType == STRUCTURE_RAMPART) {
                var rampart = <StructureRampart>structure;
                if(!rampart.my) {
			        costs.set(structure.pos.x, structure.pos.y, 255);
                }
            }
		});
		
		room.find<ConstructionSite>(FIND_CONSTRUCTION_SITES).forEach(function(site: ConstructionSite) {
            if(site.structureType == STRUCTURE_ROAD) {
                costs.set(site.pos.x, site.pos.y, 1);
            }
            if(_.some(OBSTACLE_OBJECT_TYPES, function (type) {
		        return site.structureType == type;
		    })) {
		        costs.set(site.pos.x, site.pos.y, 255);
		    }
		});
        Memory.rooms[roomName].baseCosts.costsMatrix = costs.serialize();
        Memory.rooms[roomName].baseCosts.age = Game.time;
        return costs;
    }
    static assertNever(x: never) : never {
        throw new Error('Unexpected object: ' + x);
    }
    static freezePos(pos: RoomPosition) : [number, number, string] {
        return [pos.x, pos.y, pos.roomName];
    }
    static unfreezePos(pos: [number, number, string]) {
        return new RoomPosition(pos[0], pos[1], pos[2]);
    }
};