/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('job.upgradeController');
 * mod.thing == 'a thing'; // true
 */
import { deserializePosition, getOverlappingPositions, getPositionsAround, makeid, serializePosition, Utils as utils } from "./utils"
import { JobClass, JobMemory } from "./job";
import { CreepClass } from "./creep";
import * as _ from "lodash"
import { OS, Tactical } from "./os";
import { SpawnJob } from "./job.spawn";
import { LogisticsJob } from "./job.logistics";
interface HarvestJobMemory extends JobMemory {
    targetId: string,
    containerId?: string,
    containerConstructionSiteId?: string,
    containerConstructionLocation?: string,
    logisiticsJob?: string
}
export class HarvestJob extends JobClass {
    memory: HarvestJobMemory
    static addResourceToHarvest(target: Source, os: OS, parentJobId: string) {
        var newMemory : HarvestJobMemory= {
            id: makeid(),
            parentId: parentJobId,
            type: 'harvest',
            targetId: target.id,
            creeps: [],
            spawnJobs : []
        }
        os.addJob(newMemory.id, newMemory);
        return newMemory.id;
    }
    finished() {
        return false;
    }
    priority() {
        return 5;
    }
    execute() {
        var self = this;
        if(self.memory.spawnJobs) {
            self.claimSpawnedCreeps();
        }
        if(!self.workNeeded()) {
            self.spawnCreep();
        }
        if(self.hasStorage() && !self.memory.logisiticsJob) {
            self.generateLogJob();
        }
        //this job may run with multiple creeps, and each should run,
        //even though in most cases there will be only one creep
        _.forEach(self.creeps, function(creep) {
            if(!self.hasArrived(creep)) {
                self.navigate(creep);
            } else if(!self.hasStorage()) {
                if(creep.energy > 0) {
                    self.buildStorage(creep);
                } else {
                    self.harvest(creep);
                }
            } else if(!self.targetHasResources()) {
                if(self.storageNeedsRepair()) {
                    self.repairStorage(creep);
                }
            } else {
                self.harvest(creep);
            }
        });
    }
    repairStorage(creep: CreepClass) {
        var self = this;
        let storage = Game.getObjectById<StructureContainer>(self.memory.containerId);
        creep.repair(storage);
    }
    harvest(creep: CreepClass) {
        var self = this;
        if(creep.store.getFreeCapacity() < creep.partCount(WORK) * 4) {
            let container = Game.getObjectById<StructureContainer>(self.memory.containerId);
            if(container && !container.pos.isEqualTo(creep.pos)) {
                creep.transfer(container, RESOURCE_ENERGY)
            }
        }
        let source = Game.getObjectById<Source>(self.memory.targetId);
        if(!source) {
            //WUT?
            return;
        }
        let result = creep.harvest(source);
        if(result) {
            console.log('Got back ' + result + ' when harvesting for job: ' + self.getIdentifier());
        }
    }
    generateLogJob() {
        var self = this;
        let parentStorage : StructureContainer | StructureStorage = self.findParentJobType(Tactical).getStorage();
        let storage = Game.getObjectById<StructureContainer>(self.memory.containerId);
        let source = Game.getObjectById<Source>(self.memory.targetId);
        let rate = Math.max(source.energyCapacity, 3000) / 300;
        self.memory.logisiticsJob = LogisticsJob.addLogisticsJob(
            storage.id,
            parentStorage.id,
            RESOURCE_ENERGY,
            rate,
            self.os,
            self.id
        );
    }
    buildStorage(creep: CreepClass) {
        var self = this;
        if(!self.memory.containerConstructionSiteId) {
            if(self.memory.containerConstructionLocation) {
                let pos = deserializePosition(self.memory.containerConstructionLocation);
                let conSites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
                conSites = _.filter(conSites, (site) => site.structureType == STRUCTURE_CONTAINER)
                if(!conSites) {
                    // construction site didn't get created, try again next tick
                    delete self.memory.containerConstructionLocation;
                    throw new Error('failed to create construction site')
                }
            }
            let source = Game.getObjectById<Source>(self.memory.targetId);
            let positions = getPositionsAround(source.pos, 1);
            let terrain = new Room.Terrain(positions[0].roomName);
            let openPositions = _.filter(positions, (pos) => terrain.get(pos.x, pos.y) != TERRAIN_MASK_WALL)
            // sort by the number of other positions near this one
            openPositions.sort((posa, posb) => {
                let posaclose = _.filter(openPositions, (pos) => pos.getRangeTo(posa) < 2).length;
                let posbclose = _.filter(openPositions, (pos) => pos.getRangeTo(posb) < 2).length;
                return posbclose - posaclose;
            });
            if(openPositions.length == 0) {
                //WUT?
                return;
            }
            let candidatePosition = openPositions[0];
            let room = Game.rooms[candidatePosition.roomName];
            let result = room.createConstructionSite(candidatePosition, STRUCTURE_CONTAINER);
            if(result) {
                console.log(self.getIdentifier() + ' got the following error trying to create a storage construction site: ' + result);
            }
            self.memory.containerConstructionLocation = serializePosition(candidatePosition);
            return;
        }
        let conSite = Game.getObjectById<ConstructionSite>(self.memory.containerConstructionSiteId)
        if(!conSite) {
            let conPos = deserializePosition(self.memory.containerConstructionLocation);
            let structures = conPos.lookFor(LOOK_STRUCTURES);
            structures = _.filter(structures, (struct) => struct.structureType == STRUCTURE_CONTAINER);
            if(structures.length == 0) {
                delete self.memory.containerConstructionSiteId;
                delete self.memory.containerConstructionLocation;
                throw new Error('construction site dissapeard without constructing a building')
            }
            // SUCCESS!! built container;
            self.memory.containerId = structures[0].id;
            return
        }
        let result = creep.build(conSite)
        if(result) {
            console.log(self.getIdentifier() + ' got the following error building storage: ' + result);
            return;
        }
    }
    navigate(creep: CreepClass) {
        var self = this;
        let source = Game.getObjectById<Source>(self.memory.targetId);
        if(!source || creep.pos.roomName != source.pos.roomName) {
            creep.navigate([source.pos], 1);
        }
        if(!creep.path) {
            if(self.hasStorage()) {
                let container = Game.getObjectById<StructureContainer>(self.memory.containerId);
                if(self.creeps.length > 1) {
                    let arrivedPositions = _.map(
                        _.filter(self.creeps, (creep) => creep.memory.stationary),
                        (creep) => creep.pos
                    );
                    let containerBlocked = _.find(arrivedPositions, (pos) => pos.isEqualTo(container.pos));
                    if(containerBlocked) {
                        let source = Game.getObjectById<Source>(self.memory.targetId);
                        let positions = getOverlappingPositions([{pos: container.pos, range: 1}, {pos: source.pos, range: 1}]);
                        let terrain = new Room.Terrain(positions[0].roomName);
                        // remove wall postions
                        let availableSpots = _.filter(positions, (pos) => terrain.get(pos.x, pos.y) != TERRAIN_MASK_WALL);
                        let destinations = _.differenceWith(availableSpots, arrivedPositions,
                            (posa, posb) => posa.isEqualTo(posb))
                        creep.findPath(destinations, 0)
                    } else {
                        creep.findPath([container.pos], 0);
                    }
                } else {
                    // if there is only one creep, navigate to be on top of the container there.
                    creep.findPath([container.pos], 0);
                }
            } else {
                let source = Game.getObjectById<Source>(self.memory.targetId);
                if(!source) {
                    self.scoutSourceRoom();
                    return;
                }
                creep.findPath([source.pos], 1);
            }
        }
        creep.followPath();
    }
    hasArrived(creep: CreepClass) {
        var self = this;
        let source = Game.getObjectById<Source>(self.memory.targetId);
        if(!source) {
            self.scoutSourceRoom();
            return false;
        }
        let arrived = creep.arrived([source.pos], 1);
        if(arrived) {
            creep.blockUp();
        }
        return arrived;
    }
    storageNeedsRepair() {
        var self = this;
        let container = Game.getObjectById<StructureContainer>(self.memory.containerId);
        if(!container) {
            return false;
        }
        if(container.hits < container.hitsMax) {
            return true;
        }
        return false;
    }
    targetHasResources() {
        var self = this;
        let source = Game.getObjectById<Source>(self.memory.targetId);
        if(!source) {
            self.scoutSourceRoom();
            return false;
        }
        if(source.energy == 0) {
            return false;
        }
        return true;
    }
    hasStorage() {
        var self = this;
        if(!self.memory.containerId) {
            return false;
        }
        var storage = Game.getObjectById<StructureContainer>(self.memory.storageId);
        if(!storage) {
            return false;
        }
        return true;
    }
    scoutSourceRoom() {
        var self = this;
        //FIXIT
    }
    workNeeded() {
        var self = this;
        let source : Source = Game.getObjectById<Source>(self.memory.targetId);
        if(!source) {
            self.scoutSourceRoom();
            return
        }
        let maxWork = Math.ceil((Math.max(source.energyCapacity, 3000)/300)/2);
        let curWork = _.reduce(self.creeps, (total, creep) => creep.partCount(WORK) + total, 0);
        curWork += _.reduce(self.memory.spawnJobs, function (total, spawnJobId) {
            let parts = self.os.jobs.get(spawnJobId).memory.desc.parts;
            return total + _.filter(parts, (part) => part == WORK).length;
        }, 0);
        return(maxWork - curWork);
    }
    maxWorkerSize() {
        var self = this;
        let spawnRoom = self.getParentRoom();
        return Math.floor((spawnRoom.energyCapacityAvailable - 50) / 250);
    }
    creepSpawnSize() {
        let self = this;
        return Math.min(self.workNeeded() / 2, self.maxWorkerSize());
    }
    getParentRoom() {
        let self = this;
        let parentTac = self.findParentJobType(Tactical)
        if(!parentTac) {
            self.os.removeJob(self.id);
            throw new Error(self.getIdentifier() + ' has no parent tac job and is self deleting')
        }
        return Game.rooms[parentTac.getCenterRoom().name]
    }
    spawnCreep() {
        var self = this;

        let creepSize = self.creepSpawnSize();
        let spawnRoom = self.getParentRoom();
        let parts = _.flattenDeep(Array(creepSize).fill([WORK, WORK, MOVE]));
        parts.push(CARRY);

        let desc = {
            parts: parts
        }
        self.memory.spawnJobs.push(SpawnJob.createSpawnJob(desc, self.os, self.id, spawnRoom.name, 5));
    }
}
module.exports = HarvestJob;
