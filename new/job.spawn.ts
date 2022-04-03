/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('job.upgradeController');
 * mod.thing == 'a thing'; // true
 */


import { OS, Spawner } from "./os"
import { makeid } from "./utils";
import { JobClass, JobMemory} from "./job";
import * as _ from "lodash"

interface CreepDescription {
    parts: BodyPartConstant[],
    memory?: any,
}

interface SpawnJobMemory extends JobMemory {
    spawner?: Id<StructureSpawn>,
    desc: CreepDescription,
    priority: number,
    room: string | {roomName: string, maxRange: number},
    finished: boolean;
    creepName: string;
}

export class SpawnJob extends JobClass {
    memory: SpawnJobMemory
    static createSpawnJob(
        creepDesc: CreepDescription,
        os: OS,
        parentJobId: string,
        room: string | {roomName: string, maxRange: number},
        priority: number = 5,
    ) {
        let name = makeid();
        var newMemory :SpawnJobMemory= {
            id: name,
            parentId: parentJobId,
            type: Spawner,
            desc: creepDesc,
            priority: priority,
            room: room,
            creeps: [],
            creepName: name,
            spawnJobs: [],
            finished: false,
        }
        os.addJob(newMemory.id, newMemory);
        return newMemory.id;
    }
    execute() {
        var self = this;
        if(self.finished()) {
            return;
        }
        if(!self.spawned() && !self.spawning()) {
            self.spawnCreep();
            return;
        } else if(!self.spawned() && self.spawning()) {
            return;
        }
        self.finish();
    }
    spawning() {
        var self = this;
        if(self.memory.spawner) {
            return true;
        }
        return false;
    }
    spawned() {
        var self = this;
        if(self.memory.creepName) {
            let creep : Creep = Game.creeps[self.memory.creepName];
            if(creep) {
                return !creep.spawning
            }
        }
        return false;
    }
    finish() {
        var self = this;
        self.os.setSpawnUnbusy(self.memory.spawner)
        self.addCreep(self.memory.creepName);
        self.memory.finished = true;
    }
    finished() : boolean {
        var self = this;
        return self.memory.finished;
    }
    finishedCreepName() : string {
        var self = this;
        return self.memory.creepName;
    }
    priority(): number {
        var self = this;
        return self.memory.priority;
    }
    spawnCreep() {
        var self = this;
        let spawnMemory = self.os.memory.spawnInfo;
        if(typeof self.memory.room == 'string') {
            self.spawnInRoom(self.memory.room);
        } else {
            self.spawnNearRoom(self.memory.room.roomName, self.memory.room.maxRange)
        }
    }
    spawnInRoom(roomName: string) {
        var self = this;
        let room = Game.rooms[roomName];
        room.memory
        let spawns = room.find(FIND_MY_SPAWNS)
        if(spawns.length == 0) {
            self.finish();
            console.log('Got asked to spawn in a room with no spawns: ' + room.name + ' by ' + self.os.jobs.get(self.parentJobId).getIdentifier());
            return;
        }

        let reqEnergy = self.requiredCost(self.memory.desc);
        if(room.energyCapacityAvailable > reqEnergy) {
            self.finish();
            console.log('Got asked to spawn a creep too big for ' + room.name + ' size: ' + reqEnergy + ' by ' + self.os.jobs.get(self.parentJobId).getIdentifier());
            return;
        }
        // can't spawn now, try again in the future
        if(room.energyAvailable - self.os.spawningEnergy[room.name] > reqEnergy) {
            return;
        }
        let spawn = _.find(spawns, (spawn) => 
            !self.os.getSpawnBusy(spawn.id) && !spawn.spawning
        );
        // all spawns in this room are engaged.
        if(!spawn) {
            return;
        }
        let result = spawn.spawnCreep(self.memory.desc.parts, self.memory.creepName, {memory: self.memory.desc.memory});
        if(result) {
            console.log('Error ' + result + ' Spawning in ' + room.name + ' by ' + self.os.jobs.get(self.parentJobId).getIdentifier())
            return;
        }
        self.os.setSpawnBusy(spawn.id, self.id);
        self.memory.spawner = spawn.id;
    }
    spawnNearRoom(roomName: string, range: number) {
        var self = this;
        let desc = self.memory.desc;
        let cost = self.requiredCost(desc);
        let spawnDistanceMap = self.os.getSpawnDistanceMap(roomName);

        // first, filter out all of the rooms that can't spawn
        let spawnRoomList = _.filter(spawnDistanceMap, function (spawn) {
            let roomName = spawn.roomName;
            let distance = spawn.distance;
            if(distance > range) {
                return false;
            }
            let room = Game.rooms[roomName];
            if(cost > room.energyCapacityAvailable) {
                return false;
            }
        });
        if(spawnRoomList.length == 0) {
            self.finish();
            console.log('Got asked to spawn a creep too big for any room within ' + range + ' of ' + roomName +
                 '\nsize: ' + cost + ' by ' + self.os.jobs.get(self.parentJobId).getIdentifier());
            return;
        }

        let validSpawn: StructureSpawn;
        
        _.find(spawnRoomList, function(spawnRoomName) {
            let room = Game.rooms[spawnRoomName.roomName];
            let spawns = room.find(FIND_MY_SPAWNS)

            let spawn = _.find(spawns, (spawn) => !spawn.spawning && !self.os.getSpawnBusy(spawn.id))
            if(!spawn) {
                return false;
            }
            validSpawn = spawn;
            return true;
        });
        // there are nearby valid spawns, but they're all busy
        if(!validSpawn) {
            return;
        }
        let result = validSpawn.spawnCreep(self.memory.desc.parts, self.memory.creepName, {memory: self.memory.desc.memory});
        if(result) {
            console.log('Error ' + result + ' Spawning near ' + roomName + ':' + range + ' by ' + self.os.jobs.get(self.parentJobId).getIdentifier())
            return;
        }
        self.os.setSpawnBusy(validSpawn.id, self.id);
        self.memory.spawner = validSpawn.id;
    }
    requiredCost(desc: CreepDescription) : number {
        var self = this;
        let parts = desc.parts;
        return _.reduce(parts, function (total: number, part: BodyPartConstant) {
            return (total + BODYPART_COST[part])
        }, 0);
    }
}