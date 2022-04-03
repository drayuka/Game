/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('job');
 * mod.thing == 'a thing'; // true
 */
import { JobClass } from "./job";
import * as _ from "lodash"
import { Claim, OS } from "./os";
import { makeid } from "./utils";
import { SpawnJob } from "./job.spawn";

// can be called with just name, or with target as well
export class ClaimJob extends JobClass {
    static addRoomToClaim(room: Room, os: OS, parentJobId: string) {
        if(!room.controller) {
            throw new Error('room ' + room.name + ' does not have a controller');
        }
        var newMemory = {
            id: makeid(),
            parentId: parentJobId,
            type: Claim,
            room: room.name,
            creeps: [],
            spawnJobs: []
        }
        os.addJob(newMemory.id, newMemory);
        return newMemory.id;
    }
    execute() {
        var self = this;
        if(self.memory.spawnJobs) {
            self.claimSpawnedCreeps();
        }
        if(!self.hasCreeps()) {
            self.spawnCreep();
            return;
        }
        if(!self.hasArrived()) {
            self.navigate();
        } else if(!self.claimed()) {
            self.claim();
        } else {
            self.finish();
        }
    }
    finished() {
        var self = this;
        return self.memory.finished;
    }
    finish() {
        var self = this;
        self.memory.finished = true;
    }
    claimed() {
        var self = this;
        var room = Game.rooms[self.memory.room];
        return room.controller.my;
    }
    claim() {
        var self = this;
        var room = Game.rooms[self.memory.room];
        self.creeps[0].claimController(room.controller);
    }
    hasArrived() {
        var self = this;
        var room = Game.rooms[self.memory.room];
        if(!room) {
            return false;
        }
        var creep = self.creeps[0];
        return creep.arrived([room.controller.pos], 1);
    }
    navigate() {
        var self = this;
        var creep = self.creeps[0];
        var room = Game.rooms[self.memory.room];
        if(!room) {
            creep.navigate([new RoomPosition(25,25, self.memory.roomName)], 1)
        }
        creep.navigate([room.controller.pos], 1)
    }
    priority() {
        var self = this;
        // should want to run every 100 ticks or so
        if(!self.hasCreeps()) {
            // if we don't have a creep spawned
            return (100 - (Game.time * self.memory.lastRan))
        } else {
            // if we have a creep spawned, not critical, but shouldn't be skipped either.
            return 5;
        }
    }
    spawnCreep() {
        var self = this;
        let desc = {
            parts: [CLAIM, MOVE]
        }
        self.memory.spawnJob = SpawnJob.createSpawnJob(desc, self.os, self.id, {roomName: self.memory.room, maxRange: 10});
    }
}