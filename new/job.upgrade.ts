/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('job.upgradeController');
 * mod.thing == 'a thing'; // true
 */
import { JobClass, JobMemory } from "./job";
import { CreepClass } from "./creep";
import * as _ from "lodash"
import { OS, Tactical, Upgrade } from "./os";
import { BuilderJob } from "./job.builder";
import { deserializePosition, getPositionsAround, makeid, removeUnwalkableStructures, removeUnwalkableTerrain, WALKABLE_STRUCTURES } from "./utils";
import { LogisticsJob } from "./job.logistics";
import { SpawnJob } from "./job.spawn";
import { rawListeners } from "process";

const REPAIR_STORAGE_THRESHOLD = 150000;

interface UpgradeJobMemory extends JobMemory {
    upgradeRoomName: string,
    upgradeStorage?: Id<StructureContainer>
    logJob?: string,
    upgradeRate: number
    storageBuildJob?: string,
}
export class UpgradeJob extends JobClass {
    memory: UpgradeJobMemory
    static createNewUpgradeJob(
        roomName: string,
        upgradeRate: number,
        os: OS,
        parentJobId: string,
    ) {
        let newMemory : UpgradeJobMemory = {
            id: makeid(),
            upgradeRoomName: roomName,
            type: Upgrade,
            creeps: [],
            parentId: parentJobId,
            spawnJobs: [],
            upgradeRate: upgradeRate
        }
        os.addJob(newMemory.id, newMemory);
        return newMemory.id;
    }
    getController() {
        var self = this;
        let room = Game.rooms[self.memory.upgradeRoomName];
        if(!room.controller) {
            //WTF?
            throw new Error('No controller in ' + self.memory.upgradeRoomName);
        }
        return room.controller;
    }
    updateMaxRate(rate: number) {
        var self = this;
        self.memory.upgradeRate = rate;
        if(self.memory.logJob) {
            let logJob = self.os.jobs.get(self.memory.logJob) as LogisticsJob;
            if(logJob) {
                logJob.updateRate(rate);
            }
        }
    }
    getMaxRate() {
        var self = this;
        let tmax = self.getController().level < 8 ? Infinity : 15;
        return Math.min(tmax, self.memory.upgradeRate)
    }
    priority(): number {
        let self = this;
        let controller = self.getController();
        if(controller.ticksToDowngrade < 1000) {
            return 0;
        } else if(controller.level < 8) {
            return 5;
        } else {
            return 10;
        }
    }
    finished() {
        return false;
    }
    execute() {
        var self = this;
        if(!self.upgradeStorage ()) {
            // lost the storage, remove current log job
            if(self.memory.logJob) {
                self.removeLogJob();
            }
            if(!self.memory.storageBuildJob) {
                self.buildUpgradeStorage()
            }
            if(self.upgradeStorageJobFinished()) {
                self.markStorageFinished();
            }
            return;
        }
        if(!self.memory.logJob) {
            self.createLogJob();
            return;
        }
        if(self.memory.spawnJobs.length != 0) {
            self.claimSpawnedCreeps()
        }
        if(self.needsWork()) {
            self.spawnCreep()
        }
        _.forEach(self.creeps, (creep) => {
            if(!creep.arrived([self.upgradeStorage().pos], 1)) {
                creep.navigate([self.upgradeStorage().pos], 1)
                return;
            }
            creep.memory.stationary = true;
            if(creep.energy / 2 < creep.partCount(WORK)) {
                creep.withdraw(self.upgradeStorage(), RESOURCE_ENERGY);
            }
            if(self.upgradeStorage().hits < REPAIR_STORAGE_THRESHOLD) {
                creep.repair(self.upgradeStorage())
            }
            let result = creep.upgradeController(self.getController())
            if(result) {
                throw new Error('Failed to upgrade: ' + result);
            }
        });
    }
    buildUpgradeStorage() {
        var self = this;
        let potPos = getPositionsAround(self.getController().pos, 2);
        potPos = _.filter(potPos, (pos) => pos.getRangeTo(self.getController().pos) == 2)
        potPos = removeUnwalkableStructures(removeUnwalkableTerrain(potPos, self.getController().pos.roomName));
        if(potPos.length == 0) {
            throw new Error('Couldnt find location around controller to build');
        }
        self.memory.storageBuildJob = BuilderJob.createNewBuilderJob(
            STRUCTURE_CONTAINER,
            [potPos[0]],
            self.os,
            self.id
        )
        let job = self.os.jobs.get(self.memory.storageBuildJob) as BuilderJob;
        self.findParentJobType(Tactical).addRoomWorkerJob(job);
    }
    upgradeStorageJobFinished() {
        var self = this;
        let job = self.os.jobs.get(self.memory.storageBuildJob);
        if(!job) {
            delete self.memory.storageBuildJob;
        }
        return job.finished();
    }
    markStorageFinished() {
        var self = this;
        let job = self.os.jobs.get(self.memory.storageBuildJob);
        let pos = deserializePosition(job.memory.locations)
        let store : StructureContainer = _.find(pos.lookFor(LOOK_STRUCTURES), (struct) => struct.structureType == STRUCTURE_CONTAINER) as StructureContainer;
        if(store) {
            self.memory.upgradeStorage = store.id
        }
        self.os.removeJob(job.id)
        delete self.memory.storageBuildJob;
    }
    removeLogJob() {
        var self = this;
        let job = self.os.jobs.get(self.memory.logJob);
        if(job) {
            self.os.removeJob(job.id);
        }
        delete self.memory.logJob
    }
    createLogJob() {
        var self = this;
        self.memory.logJob = LogisticsJob.addLogisticsJob(
            self.findParentJobType(Tactical).getStorage().pos,
            self.upgradeStorage().pos,
            RESOURCE_ENERGY,
            self.memory.upgradeRate,
            self.os,
            self.id
        )
    }
    creepBuild : BodyPartConstant[] = [WORK, WORK, MOVE]
    maxSpawnSize() {
        let self = this;
        let room = Game.rooms[self.memory.upgradeRoomName];
        return Math.min(Math.floor((room.energyCapacityAvailable - 50) / 250), 16)
    }
    needsWork() {
        let self = this;
        let work = _.reduce(self.creeps, (total, creep) => total + creep.partCount(WORK), 0) + self.memory.spawnJobs.length * self.maxSpawnSize();
        return work < self.getMaxRate();
    }
    spawnCreep() {
        let self = this;
        let parts : BodyPartConstant[] = _.flattenDeep(Array(self.maxSpawnSize()).fill(self.creepBuild));
        parts.push(CARRY)
        self.memory.spawnJobs.push(SpawnJob.createSpawnJob(
            {parts: parts},
            self.os,
            self.id,
            self.memory.upgradeRoomName,

        ));
    }
    upgradeStorage() {
        let self = this;
        return Game.getObjectById(self.memory.upgradeStorage);
    }
}
module.exports = UpgradeJob;
