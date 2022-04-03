/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('job');
 * mod.thing == 'a thing'; // true
 */

import { JobClass, JobMemory } from "./job";
import * as _ from "lodash"
import { OS, Reserve, Tactical } from "./os";
import { makeid } from "./utils";
import { SpawnJob } from "./job.spawn";
import { CreepClass } from "./creep"
// can be called with just name, or with target as well
interface ReserveJobMemory extends JobMemory {
    roomName: string,
    distance?: number,
}
export class ReserveJob extends JobClass {
    memory: ReserveJobMemory;
    static createNewReserveJob(
        roomName: string,
        os: OS,
        parentJobId: string
    ) {
        let newMemory : ReserveJobMemory = {
            roomName: roomName,
            id: makeid(),
            type: Reserve,
            creeps: [],
            parentId: parentJobId,
            spawnJobs: [],
        }
        os.addJob(newMemory.id, newMemory);
        return newMemory.id
    }
    priority(): number {
        return 4;
    }
    finished() {
        return false;
    }
    finishedForNow(): boolean {
        let self = this;
        if(!self.memory.distance) {
            return false;
        }
        if(self.creeps.length > 0) {
            return false;
        }
        let room = Game.rooms[self.memory.roomName];
        if(!room) {
            return true;
        }
        if(room.controller 
            && room.controller.reservation 
            && room.controller.reservation.username == 'shockfist'
            && room.controller.reservation.ticksToEnd > self.memory.distance * 100) {
                return true;
            }
        return false;
    }
    execute(): void {
        let self = this;

        if(self.memory.spawnJobs.length) {
            self.claimSpawnedCreeps();
            return;
        }

        if(self.creeps.length == 0) {
            self.spawnCreep()
            return;
        }
        
        _.forEach(self.creeps, (creep) => {
            if(self.creepArrived(creep)) {
                self.creepReserve(creep);
                return;
            }
            self.navigateCreep(creep);
        })
    }
    spawnCreep() {
        let self = this;
        let tac = self.findParentJobType(Tactical);
        let room = tac.getCenterRoom()
        let size = Math.floor(room.energyCapacityAvailable / 650)
        let body = _.flattenDeep(Array(size).fill([CLAIM,MOVE]))
        self.memory.spawnJobs.push(SpawnJob.createSpawnJob(
            {
                parts: body,
            },
            self.os,
            self.id,
            room.name,
        ));
    }
    creepArrived(creep: CreepClass) {
        let self = this;
        let room = Game.rooms[self.memory.roomName];
        if(!room) {
            return false;
        }
        if(creep.pos.inRangeTo(room.controller.pos, 1)) {
            return true;
        }
        return false;
    }
    creepReserve(creep: CreepClass) {
        let self = this;
        let room = Game.rooms[self.memory.roomName];
        creep.reserveController(room.controller);
    }
    navigateCreep(creep: CreepClass) {
        let self = this;
        let room = Game.rooms[self.memory.roomName];
        if(!room) {
            creep.navigate([new RoomPosition(25,25, self.memory.roomName)], 1)
        }
        creep.navigate([room.controller.pos], 1)
    }
}