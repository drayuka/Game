import _ from "lodash";
import { JobClass, JobMemory } from "./job";
import { OS, Roomstartup, Placement, Tactical } from "./os";
import { getPositionsAround, makeid, Path, removeUnwalkableTerrain, removeUnwalkableStructures, serializePosition, deserializePosition } from "./utils";
import { SpawnJob } from "./job.spawn"
import { serialize } from "v8";
import { CreepClass } from "./creep";


interface RoomStartupJobMemory extends JobMemory {
    roomName: string,
    storageId?: Id<StructureContainer>,
    spawnId: Id<StructureSpawn>
    buildSites?: {id: Id<ConstructionSite>, pos: string}[],
    sourceList?: {id: Id<Source>, pos: string}[]
}

type SourceList = Map<RoomPosition, string>

export class RoomStartupJob extends JobClass {
    memory: RoomStartupJobMemory;
    static createNewRoomStartupJob(
        roomName: string,
        os: OS,
        parentJobId: string
    ) {
        let spawn = _.find(Game.spawns, (spawn) => spawn.pos.roomName == roomName);
        if(!spawn) {
            throw new Error('No spawn in roomstartup job target room');
        }
        let newMemory : RoomStartupJobMemory = {
            id: makeid(),
            type: Roomstartup,
            creeps: [],
            parentId: parentJobId,
            spawnJobs: [],
            roomName: roomName,
            spawnId: spawn.id,
        }
        os.addJob(newMemory.id, newMemory);
        return newMemory.id
    }
    stage1Done() {
        let self = this;
        let room = Game.rooms[self.memory.roomName]
        if(room.controller.level > 1) {
            return true;
        }
        return false;
    }
    stage2Done() {
        let self = this;
        let room = Game.rooms[self.memory.roomName]
        if(room.energyCapacityAvailable == 550) {
            return true;
        }
        return false;
    }
    stage3Done() {
        let self = this;
        if(self.memory.storageId) {
            let storage = Game.getObjectById(self.memory.storageId)
            if(storage.structureType == STRUCTURE_CONTAINER) {
                return true;
            }
        }
        return false;
    }
    get sourceList () {
        let self = this;
        if(!self.memory.sourceList) {
            let room = Game.rooms[self.memory.roomName];
            let sl : {id: Id<Source>, pos: string}[]= [];
            let sources = room.find(FIND_SOURCES);
            _.forEach(sources, (source) => {
                let poss = getPositionsAround(source.pos, 1);
                poss = removeUnwalkableStructures(removeUnwalkableTerrain(poss, room.name))
                sl.push(..._.map(poss, (pos) => ({id: source.id, pos: serializePosition(pos)})))
            });
            self.memory.sourceList = sl;
        }
        return self.memory.sourceList;
    }
    sourceLocations() : number {
        let self = this;
        return self.sourceList.length
    }
    placeExtSites() {
        let self = this;
        let sites = self.findParentJobType(Tactical).getPlacementJob().getLevel2ExtSites();
        if(sites) {
            self.memory.buildSites = _.map(sites, (siteId) => {
                let site = Game.getObjectById(siteId);
                return {pos: serializePosition(site.pos), id: siteId, type: STRUCTURE_EXTENSION}
            });
        }
    }
    placeContSite() {
        let self = this;
        let site = self.findParentJobType(Tactical).getPlacementJob().getMainContainerSite()
        if(site) {
            self.memory.buildSites = _.map([site], (siteId) => {
                let site = Game.getObjectById(siteId);
                return {pos: serializePosition(site.pos), id: siteId, type: STRUCTURE_CONTAINER}
            });
        }
    }
    removeCreep(...args): void {
        let self = this;
        let creepMemory = self.os.memory.creeps[args[0]]
        if(self.memory.sourceList) {
            let source = _.get(creepMemory, '.source', undefined);
            _.unset(creepMemory, '.source');
            if(source) {
                self.memory.sourceList.push(source);
            }
        }
        let buildSite = _.unset(creepMemory, '.buildSite')
        JobClass.prototype.removeCreep.apply(self, args);
    }
    //harvesting
    assignCreepToSource(creep: CreepClass) {
        let self = this;
        if(self.memory.sourceList.length == 0) {
            throw new Error('we ran out of source poses somehow');
        }
        creep.memory.source = self.memory.sourceList.shift();
    }
    creepArrivedAtSource(creep: CreepClass) {
        let self = this;
        let pos = deserializePosition(creep.memory.source.pos);
        return creep.pos.getRangeTo(pos) <= 1;
    }
    navigateCreepToSource(creep: CreepClass) {
        let self = this;
        let pos = deserializePosition(creep.memory.source.pos);
        creep.navigate([pos], 0);
    }
    execute(): void {
        var self = this;
        if(self.memory.spawnJobs) {
            self.claimSpawnedCreeps()
        }
        if(self.sourceLocations()) {
            self.spawnHarvestCreep();
        }
        if(!self.memory.buildSites) {
            if(self.stage1Done() && !self.stage2Done()) {
                self.placeExtSites();
            } else if(self.stage2Done()){
                self.placeContSite();
            }
        }
        if(self.stage2Done() && !self.memory.contSite) {
            self.placeContSite();
        }
        _.forEach(self.creeps, (creep) => {
            if(creep.energy == 0) {
                delete creep.memory.spawnRestock
                delete creep.memory.upgrading;
                delete creep.memory.building;
                delete creep.memory.stationary;
                creep.memory.harvesting = true;
                creep.path = undefined;
            }
            if(creep.memory.harvesting) {
                if(!creep.memory.sourceTarget) {
                    self.assignCreepToSource(creep);
                }
                if(!self.creepArrivedAtSource(creep)) {
                    self.navigateCreepToSource(creep)
                    return true;
                }
                creep.memory.stationary = true;
                if(creep.energy + creep.partCount(WORK) * 2 >= creep.store.getCapacity()) {
                    if(self.spawnNeedsEnergy()) {
                        creep.memory.spawnRestock = true;
                    } else if(!self.memory.buildSites || self.memory.buildSites.length == 0 || self.getController().ticksToDowngrade < 5000) {
                        creep.memory.upgrading = true;
                    } else {
                        creep.memory.building = true;
                    }
                    delete creep.memory.harvesting;
                }
                let source = Game.getObjectById<Source>(creep.memory.source.id);
                creep.harvest(source);
            } else if(creep.memory.spawnRestock) {
                if(!self.creepArrivedAtSpawn(creep)) {
                    self.navigateCreepToSpawn(creep)
                    return true;
                }
                if(!self.spawnNeedsEnergy()) {
                    creep.memory.upgrading = true;
                    delete creep.memory.spawnRestock
                }
            } else if(creep.memory.upgrading) {
                if(!self.creepArrivedAtController(creep)) {
                    self.navigateCreepToController(creep)
                    return true;
                }
                creep.memory.stationary = true;
                if(creep.energy - 1 == 0) {
                    delete creep.memory.upgrading;
                    creep.memory.harvesting = true;
                }
                self.upgradeWithCreep(creep);
            } else if(creep.memory.building) {
                if(!self.creepHasBuildSite(creep)) {
                    self.assignCreepToBuildSite(creep)
                }
                if(!self.creepHasBuildSite(creep)) {
                    delete creep.memory.building;
                    creep.memory.harvesting = true;
                    creep.path = undefined;
                    return true;
                }
                if(!self.creepArrivedAtBuildSite(creep)) {
                    self.navigateCreepToBuildSite(creep);
                    return true;
                }
                creep.memory.stationary = true;
                let site = Game.getObjectById(creep.memory.buildSite.id);
                //probably finished building, but we'll stop building again anyways
                if(!site) {
                    delete creep.memory.buildSite;
                    delete creep.memory.building;
                    creep.memory.harvesting = true;
                    return true;
                }
                creep.build(site)
            }
        });
    }
    //building
    navigateCreepToBuildSite(creep: CreepClass) {
        let self = this;
        let site = Game.getObjectById(creep.memory.buildSite.id);
        creep.navigate([site.pos], 3);
    }
    creepArrivedAtBuildSite(creep: CreepClass) {
        let self = this;
        let site = Game.getObjectById(creep.memory.buildSite.id)
        return creep.arrived([site.pos], 3);
    }
    assignCreepToBuildSite(creep: CreepClass) {
        let self = this;
        if(!self.memory.buildSites || self.memory.buildSites.length == 0) {
            return;
        }
        let site = Game.getObjectById(self.memory.buildSites[0].id);
        if(!site) {
            self.memory.buildSites.shift();
            this.assignCreepToBuildSite(creep)
            return;
        }
        creep.memory.buildSite = self.memory.buildSites[0]
    }
    creepHasBuildSite(creep: CreepClass) {
        let self = this;
        return creep.memory.buildSite;
    }
    //upgrading
    upgradeWithCreep(creep: CreepClass) {
        let self = this;
        let room = Game.rooms[self.memory.roomName];
        creep.upgradeController(room.controller)
    }
    navigateCreepToController(creep: CreepClass) {
        let self = this;
        let room = Game.rooms[self.memory.roomName];
        return creep.arrived([room.controller.pos], 3)
    }
    creepArrivedAtController(creep: CreepClass) {
        let self = this;
        let room = Game.rooms[self.memory.roomName];
        return creep.arrived([room.controller.pos], 3)
    }
    //spawn
    navigateCreepToSpawn(creep: CreepClass) {
        let self = this;
        let spawn = Game.getObjectById(self.memory.spawnId);
        return creep.navigate([spawn.pos], 1);        
    }
    creepArrivedAtSpawn(creep: CreepClass) {
        let self = this;
        let spawn = Game.getObjectById(self.memory.spawnId);
        return creep.arrived([spawn.pos], 1);
    }
    spawnNeedsEnergy() {
        let self = this;
        let spawn = Game.getObjectById(self.memory.spawnId);
        if(!spawn) {
            throw new Error('spawn dissappeared');
        }
        return spawn.store.energy < spawn.store.getCapacity(RESOURCE_ENERGY);
    }
    spawnBuild: [WORK,CARRY,CARRY,MOVE]
    spawnHarvestCreep() {
        var self = this;
        self.memory.spawnJobs.push(SpawnJob.createSpawnJob(
            {parts: self.spawnBuild},
            self.os,
            self.id,
            self.memory.roomName,
        ));
    }
    getController(): StructureController {
        var self = this;
        let room = Game.rooms[self.memory.roomName];
        if(!room || !room.controller) {
            throw new Error('It all falls down');
        }
        return room.controller;
    }
    finished() {
        var self = this;
        return self.stage3Done();
    }
    priority() {
        return 3;
    }
}