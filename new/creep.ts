/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('type.worker');
 * mod.thing == 'a thing'; // true
 */

import { deserializePosition, getOverlappingPositions, Path, serializePosition, WALKABLE_STRUCTURES } from "./utils"
import * as _ from "lodash"
import { JobClass } from "./job";
import { OS } from "./os";

interface CreepMemory {
    path?: string,
    stationary?: boolean,
    buildSite?: {pos: string, id: Id<ConstructionSite>}
    repairSite?: string;
    onRoad?: boolean,
    rebuildId?: Id<ConstructionSite>,
    fidget?: {
        time: number, pos: string[]
    }
    [x: string]: any
}

export declare const FIDGET_FREQ = 3;

Creep.prototype.memory = undefined;

export class CreepClass extends Creep {
    _path?: Path;
    memory: CreepMemory;
    job: JobClass
    wait: boolean = false;
    constructor (creep: Creep, memory: CreepMemory, job: JobClass) {
        super(creep.id);
        var self = this;
        self.memory = memory;
        self.job = job;
    }
    get energy () {
        var self = this;
        return self.store[RESOURCE_ENERGY]; 
    }
    get path () {
        var self = this;
        if(!self._path && self.memory.path && self.memory.path.length > 0) {
            self._path = new Path(self.memory.path);
        }
        return self._path;
    }
    set path (path : Path | undefined) {
        var self = this;
        if(!path) {
            delete self.memory.path;
            delete self._path;
            return;
        }
        self.memory.path = path.spath;
        self._path = path;
    }
    fidget(pos: RoomPosition, range: number) {
        var self = this;
        if(!self.fidget) {
            let potPos = getOverlappingPositions([{pos: self.pos, range: 1}, {pos: pos, range: range}]);
            let terrain = new Room.Terrain(pos.roomName);
            potPos = _.filter(potPos, (pos) => terrain.get(pos.x, pos.y) != TERRAIN_MASK_WALL);
            let fidgetPos = _.find(potPos, (pos) => !_.find(pos.lookFor(LOOK_STRUCTURES), (st) => !WALKABLE_STRUCTURES[st.structureType]))
            if(fidgetPos) {
                self.memory.fidget = {
                    time: Game.time, pos: [ serializePosition(fidgetPos), serializePosition(self.pos)]
                }
            }
        }
        if(self.fidget && self.memory.fidget.time <= Game.time) {
            self.moveByPath([deserializePosition(self.memory.fidget.pos[0])]);
            self.memory.fidget.pos.push(self.memory.fidget.pos.shift());
            self.memory.fidget.time = Game.time + FIDGET_FREQ;
        }
    }
    clearMemory(os: OS) {
        var self = this;
        self.memory = {stationary: false};
        os.memory.creeps[self.name] = self.memory;
    }
    getRoomPath(startRoom: string, endRoom: string) {
        return Game.map.findRoute(startRoom, endRoom);
    }
    arrived(destPos: RoomPosition[], range: number) {
        var self = this;
        return _.find(destPos, function(pos) {
            if(pos.roomName != self.pos.roomName) {
                return false;
            }
            return (pos.getRangeTo(self.pos) < range)
        })
    }
    blockUp() {
        var self = this
        self.memory.stationary = true;
    }
    followPath() {
        var self = this;
        delete self.memory.fidget;
        if(!self.path || !self.path.hasNextPos()) {
            return;
        }
        if(self.path.first().isEqualTo(self.pos)) {
            self.path.next();
            self.memory.path = self.path.spath;
            self.memory.moveFailure = 0;
        }
        if(!self.path.hasNextPos()) {
            return;
        }
        var result = self.moveByPath([self.path.first()]);
        if(result != ERR_TIRED) {
            //assume failure until success is confirmed next tick
            self.memory.moveFailure++;
            if(self.memory.moveFailure > 5) {
                self.memory.moveFailure = 0;
                self.path = undefined;
            }
        }
    }
    // will take in multiple destination positions in the same room
    // note path updates do not propagate automatically from the Path class.
    navigate(destPos: RoomPosition[], range: number) {
        var self = this;
        delete self.memory.fidget;
        if(self.arrived(destPos, range)) {
            return;
        }
        // check if we successfully moved last tick
        if(self.path && self.path.hasNextPos && self.path.first().isEqualTo(self.pos)) {
            self.path.next();
            //path was changed, store it back.
            self.memory.path = self.path.spath;
            self.memory.moveFailure = 0;
        }
        if(!self.path || !self.path.hasNextPos()) {
            self.findPath(destPos, range);
        }
        //successfully pathed...but we've already arrived
        if(!self.path.hasNextPos()) {
            return
        }
        var result = self.moveByPath([self.path.first()]);
        if(result != ERR_TIRED) {
            self.memory.moveFailure++;
            if(self.memory.moveFailure > 5) {
                self.memory.moveFailure = 0;
                delete self.memory.path;
                delete self._path;
            }
        }
    }
    partCount (type: BodyPartConstant) {
        var self = this;
        return _.reduce(self.body, function (total, part) {
            if(part.type != type) {
                return total;
            }
            return total + 1;
        },0)
    }
    findPath (destPos: RoomPosition[], range: number) {
        var self = this;
        delete self.memory.fidget;
        let destinations = destPos;
        let destRange = range;
        if(self.pos.roomName != destPos[0].roomName) {
            if(!self.memory.roomPath ) {
                var roomPath = self.getRoomPath(self.pos.roomName, destPos[0].roomName);
                if(roomPath == ERR_NO_PATH) {
                    throw new Error('could not path from ' + self.pos.roomName + ' to ' + destPos[0].roomName);
                }
                self.memory.roomPath = roomPath;
            }
            if (self.pos.roomName == roomPath[0].room) {
                self.memory.roomPath = _.drop(self.memory.roomPath);
            }
            var curRoom = Game.rooms[self.pos.roomName];
            destinations = curRoom.find(self.memory.roomPath[0].exit)
            destRange = 0;
        }
        var roomCostFunction = self.roomCostsFunction(self.job.os);
        var ret = PathFinder.search(self.pos, _.map(destinations, (pos) => ({pos: pos, range: range})), {
		    plainCost: 2,
			swampCost: 10,
	    	roomCallback: roomCostFunction
	    });
        self.path = new Path(ret.path);
	    return ret.path;
    }
    roomCostsFunction(os: OS) {
        return CreepClass.workerRoomCostsGenerator(false, false, os)
    }
    // ignoreCreeps ignores creeps which are stationary
    static workerRoomCostsGenerator(ignoreCreeps: boolean, notLeaveRoom: boolean, os: OS) : (roomName: string) => CostMatrix {
        return function(roomName: string) : CostMatrix {
            var room = Game.rooms[roomName];
            if(!room) {
                return new PathFinder.CostMatrix();
            }
            var costs = CreepClass.getBaseCosts(roomName);

            if(!ignoreCreeps) {
                CreepClass.applyMyCreepCosts(costs, roomName, os);
            }
            if(notLeaveRoom) {
                CreepClass.blockExits(costs, roomName);
            }
            
            return costs;
            
        }
    }
    static blockExits(costsMatrix: CostMatrix, roomName: string) {
        var room: Room;
        if(!Game.rooms[roomName]) {
            throw new Error('coudnt block exits for room ' + roomName + ' as there is no visibility');
        }
        room = Game.rooms[roomName];
        let exits : RoomPosition[] = room.find(FIND_EXIT);
        exits.forEach(function(pos) {
            costsMatrix.set(pos.x, pos.y, 255);
        });
    }
    static applyMyCreepCosts(costsMatrix: CostMatrix, roomName: string, os: OS) {
        var room = Game.rooms[roomName];
        if(!room) {
            return;
        }
        room.find(FIND_MY_CREEPS).forEach(function(creep: Creep) {
            let creepMemory = _.get(os.memory.creeps, '.' + creep.name, {})
            if(creepMemory.stationary) {
                costsMatrix.set(creep.pos.x, creep.pos.y, 255);
            }
        });
    }
    static getBaseCosts(roomName: string): CostMatrix {
		var room = Game.rooms[roomName];
		if(!room) { 
            return new PathFinder.CostMatrix();
        }

        var costs = new PathFinder.CostMatrix();
    	
		room.find(FIND_STRUCTURES).forEach(function(structure: Structure | OwnedStructure) {
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
		
		room.find(FIND_CONSTRUCTION_SITES).forEach(function(site: ConstructionSite) {
            if(site.structureType == STRUCTURE_ROAD) {
                costs.set(site.pos.x, site.pos.y, 1);
            }
            if(_.some(OBSTACLE_OBJECT_TYPES, function (type) {
		        return site.structureType == type;
		    })) {
		        costs.set(site.pos.x, site.pos.y, 255);
		    }
		});
        return costs;
    }
};