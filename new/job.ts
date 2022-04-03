/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('job');
 * mod.thing == 'a thing'; // true
 */
// can be called with just name, or with target as well


import "./types";
import * as _ from "lodash"
import { Job, OS, JobType } from "./os";
import { CreepClass } from "./creep";
import { SpawnJob } from "./job.spawn";
import { remove } from "lodash";
export interface JobMemory {
    id: string,
    parentId: string,
    type: Job,
    creeps: string[],
    [x: string]: any
    spawnJobs: string[]
};

export abstract class JobClass {
    id: string
    memory: JobMemory;
    // this job is contingient on the parent job, if the parent job 
    // no longer exists, this job will self-annihilate
    parentJobId?: string;
    os: OS;
    type: Job;
    ranThisTick: boolean = false;
    abstract execute () : void;
    abstract priority () : number;
    abstract finished () : boolean;
    constructor(memory: any, os: OS) {
        var self = this;
        self.id = _.get(memory, 'id');
        self.parentJobId = _.get(memory, 'parentId');
        self.memory = memory;
        self.os = os;
        self.type = _.get(memory, 'type')
    }
    get creeps() {
        var self = this;
        return _.map(self.memory.creeps, function (creepName) {
            let memory = self.os.memory.creeps[creepName];
            return new CreepClass(Game.creeps[creepName], memory, self);
        });
    }
    // decides whether or not to run through the os
    osRun() {
        return true;
    }
    finishedForNow() {
        return false;
    }
    neededSegments() : number[] {
        return []
    }
    addCreep (creepName: string) {
        var self = this;
        self.os.memory.creeps[creepName].jobId = self.id;
        self.memory.creeps.push(creepName);
    }
    removeCreep(removeCreepName: string) {
        var self = this;
        delete self.os.memory.creeps[removeCreepName].jobId;
        self.memory.creeps = _.filter(self.memory.creeps, (creepName) => removeCreepName != creepName);
    }
    hasCreeps() {
        var self = this;
        return (self.creeps.length > 0);
    }
    getIdentifier() {
        var self = this;
        return self.type + ':' + self.id;
    }
    findParentJobType<T extends Job>(jobType: T) : JobType<T> | undefined {
        var self = this;
        if(self.type == jobType) {
            return self as JobType<T>;
        }
        if(self.parentJobId) {
            return self.os.jobs.get(self.parentJobId).findParentJobType(jobType);
        }
    }
    claimSpawnedCreeps() {
        var self = this;
        let remainingSpawnJobs = _.filter(self.memory.spawnJobs, function (spawnJobId) {
            let spawnJob : SpawnJob = self.os.jobs.get(spawnJobId) as SpawnJob;
            if(!spawnJob) {
                return false;
            }
            if(spawnJob.finished()) {
                if(Game.creeps[spawnJob.finishedCreepName()]) {
                    spawnJob.removeCreep(spawnJob.finishedCreepName());
                    self.addCreep(spawnJob.finishedCreepName());
                }
                self.os.removeJob(spawnJob.id);
                return false;
            }
            return true;
        });
        self.memory.spawnJobs = remainingSpawnJobs;
    }
}
