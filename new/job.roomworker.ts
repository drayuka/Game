/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('type.worker');
 * mod.thing == 'a thing'; // true
 */

import { JobClass } from "./job";
import { SpawnJob } from "./job.spawn"
import * as _ from "lodash";
import { DO_NOT_RUN_PRIO, Maintenance, OS, Roomworker, Tactical } from "./os";
import { JobMemory } from "./job";
import { makeid } from "./utils";

interface RoomworkerJobMemory extends JobMemory {
    subJobs: string[]
}

export class RoomworkerJob extends JobClass {
    memory: RoomworkerJobMemory;
    static createRoomWorkerJob(
        os: OS,
        parentJobId: string
    ) {
        let newMemory : RoomworkerJobMemory = {
            id: makeid(),
            type: Roomworker,
            creeps: [],
            parentId: parentJobId,
            spawnJobs: [],
            subJobs: [],
        }
        os.addJob(newMemory.id, newMemory);
        return newMemory.id;
    }
    priority () {
        var self = this;
        if(self.unfinishedJobs().length > 0) {
            return 5;
        }
        return DO_NOT_RUN_PRIO;
    }
    execute () {
        var self = this;

        if(self.memory.spawnJobs.length > 0) {
            self.claimSpawnedCreeps();
        }
        if(self.workNeeded()) {
            self.spawnCreep();
        }
        //recover creeps from jobs that are finished 
        //and remove permanently finished jobs from the queue
        self.memory.subJobs = _.filter(self.memory.subJobs, function(subJobId) {
            let job = self.os.jobs.get(subJobId);
            if(job.finished() || job.finishedForNow()) {
                _.forEach(job.creeps, (creep) => {
                    job.removeCreep(creep.name);
                    creep.clearMemory(self.os);
                })
            }
            if(job.finished()) {
                return false;
            }
            return true;
        });
        //assing creeps to jobs
        _.forEach(_.cloneDeep(self.creeps), function(creep) {
            self.assignCreepToJob(creep);
        });
        _.forEach(self.memory.subJobs, (subJobId) => {
            let job = self.os.jobs.get(subJobId)
            if(job.creeps.length > 0) {
                try {
                    job.execute();
                } catch (e) {
                    console.log(self.getIdentifier() +' Had a problem running' + job.getIdentifier() + ': ');
                    console.log(e.stack);
                    debugger;
                }
            }
        });
    }
    assignCreepToJob(creep) {
        var self = this;
        let jobs = self.unfinishedJobs();
        let assignJob = _.find(jobs, (job) => {
            if(job.creeps.length * self.maxCreepSize() < 3) {
                return true;
            }
            return false;
        });
        if(!assignJob && jobs.length != 0) {
            self.removeCreep(creep.name)
            jobs[0].addCreep(creep.name);
        } else if(assignJob) {
            self.removeCreep(creep.name)
            assignJob.addCreep(creep.name);
        }
    }
    creepParts : BodyPartConstant[] = [WORK, CARRY, CARRY, CARRY, MOVE, MOVE]
    maxCreepSize() {
        var self = this;
        let parentRoom = Game.rooms[self.findParentJobType(Tactical).getCenterRoom().name];
        return Math.max(parentRoom.energyCapacityAvailable/350, 8);
    }
    spawnCreep() {
        var self = this;
        let parts = _.flattenDeep(Array(self.maxCreepSize()).fill(this.creepParts))
        let parentRoomName = self.findParentJobType(Tactical).getCenterRoom().name;
        self.memory.spawnJobs.push(SpawnJob.createSpawnJob(
            {parts: parts},
            self.os,
            self.id,
            parentRoomName,
            8
        ));
    }
    finishedForNow(): boolean {
        let self = this;
        return self.unfinishedJobs().length == 0;
    }
    workNeeded() {
        var self = this;
        let subJobs = this.unfinishedJobs();
        let totalCreeps = _.reduce(subJobs, (total, subJob) => {
            let job = self.os.jobs.get(subJob.id);
            return total + job.creeps.length;
        }, 0) + self.creeps.length + self.memory.spawnJobs.length;
        return (totalCreeps * self.maxCreepSize()) / subJobs.length < 3
    }
    unfinishedJobs() {
        var self = this;
        return _.take(
            _.map(
                _.filter(self.memory.subJobs, (subJobId) => {
                let job = self.os.jobs.get(subJobId);
                return !job.finished() && !job.finishedForNow();
                }),
            (jobId) => self.os.jobs.get(jobId),
        ),5);
    }
    finished () {
        return false;
    }
    addSubJob(subJobId) {
        var self = this;
        self.memory.subJobs.push(subJobId);
    }
}
