import { JobClass, JobMemory } from "./job";
import { Maintenance, OS, Tactical } from "./os";
import { deserializePosition, getPositionsAround, makeid, Path, serializePosition } from "./utils";
import * as _ from "lodash"
import { CreepClass } from "./creep";
import { BuilderJob } from "./job.builder";
import { hasIn } from "lodash";


interface MaintenanceJobMemory extends JobMemory {
    locations: string,
    buildType: BuildableStructureConstant,
    currentRepairLocs?: string,
    repairLevel: number,
    repairLevelMin: number,
    finishedUntil: number
}

export class MaintenanceJob extends JobClass {
    memory: MaintenanceJobMemory;
    static createMaintenanceJob(
        locations: RoomPosition[] | Path,
        buildType: BuildableStructureConstant,
        os: OS,
        parentJobId: string,
        repairLevel: number = .8,
        repairLevelMin: number = .3
    ) : string {
        let path: Path;
        if(locations instanceof Path) {
            path = new Path(locations.spath);
        } else {
            path = new Path(locations);
        }
        let newMemory : MaintenanceJobMemory = {
            id: makeid(),
            type: Maintenance,
            creeps: [],
            parentId: parentJobId,
            spawnJobs: [],
            locations: path.spath,
            buildType: buildType,
            //repair to this level
            repairLevel: repairLevel,
            //start repairing when we reach this level
            repairLevelMin: repairLevelMin,
            finishedUntil: Game.time,
        }
        os.addJob(newMemory.id, newMemory);
        return newMemory.id;
    }
    priority() {
        return 5;
    }
    osRun() {
        return false;
    }
    execute(): void {
        var self = this;
        if(self.memory.currentRepairLocs.length == 0) {
            return
        }
        _.forEach(self.creeps, function (creep) {
            if(creep.energy == 0) {
                if(!self.creepHasArrivedAtEnergy(creep)) {
                    self.creepNavigateToEnergy(creep);
                    return true;
                }
                self.creepGetEnergy(creep)
            }
            if(!creep.memory.repairSite) {
                self.assignRepairToCreep(creep)
            }
            if(!creep.memory.repairSite) {
                return false;
            }
            if(!self.creepHasArrivedToRepair(creep)) {
                self.creepNavigateToRepair(creep)    
                return true;
            }
            if(self.siteDestroyed(creep)) {
                self.rebuildSite(creep);
                let conSite = self.getConstructionSite(creep);
                if(conSite) {
                    creep.fidget(conSite.pos, 3)
                }
                return true;
            }
            if(self.longRepair(creep)) {
                creep.fidget(self.getStructure(creep).pos, 3);
            }
            self.creepRepairSite(creep);
        });
    }
    getStructure(creep: CreepClass) : Structure | undefined {
        let self = this;
        let pos = deserializePosition(creep.memory.repairSite);
        return _.find(pos.lookFor(LOOK_STRUCTURES), (st) => st.structureType == self.memory.buildType);
    }
    creepRepairSite(creep: CreepClass) {
        var self = this;
        let structure = self.getStructure(creep);
        if(structure.hits / structure.hitsMax > self.memory.repairLevel) {
            delete creep.memory.repairSite
            return;
        }
        creep.repair(structure);
    }
    longRepair(creep: CreepClass) {
        var self = this;
        let struct = self.getStructure(creep);
        return (struct.hits + creep.partCount(WORK) * 100 * 3) / struct.hitsMax >= self.memory.repairLevel
    }
    creepHasArrivedAtEnergy(creep: CreepClass) {
        var self = this;
        let store = self.findParentJobType(Tactical).getStorage();
        return creep.arrived([store.pos], 0);
    }
    creepNavigateToEnergy(creep: CreepClass) {
        var self = this;
        let store = self.findParentJobType(Tactical).getStorage();
        creep.navigate([store.pos], 0);
    }
    creepGetEnergy(creep: CreepClass) {
        var self = this;
        let store = self.findParentJobType(Tactical).getStorage();
        let result = creep.withdraw(store, RESOURCE_ENERGY)
        if(result) {
            throw new Error('Failed to get energy from the storage');
        }
    }
    assignRepairToCreep(creep: CreepClass) {
        var self = this;
        let sites = new Path(self.memory.currentRepairLocs);
        if(!sites.hasNextPos()) {
            return;
        }
        creep.memory.repairSite = serializePosition(sites.first());
        sites.next();
        self.memory.currentRepairLocs = sites.spath;
    }
    creepHasArrivedToRepair(creep: CreepClass) {
        var self = this;
        let pos = deserializePosition(creep.memory.repairSite);
        return creep.arrived([pos], 3);
    }
    creepNavigateToRepair(creep: CreepClass) {
        var self = this;
        let pos = deserializePosition(creep.memory.repairSite);
        creep.navigate([pos], 3);
    }
    siteDestroyed(creep: CreepClass) {
        var self = this;
        return !self.getStructure(creep);
    }
    getConstructionSite(creep: CreepClass) : ConstructionSite | undefined {
        var self = this;
        return Game.getObjectById(creep.memory.rebuildId);
    }
    rebuildSite(creep: CreepClass) {
        var self = this;
        let conSite: ConstructionSite;
        if(!creep.memory.rebuildId) {
            let pos = deserializePosition(creep.memory.rebuildId);
            let conSite = _.find(pos.lookFor(LOOK_CONSTRUCTION_SITES), (site) => site.structureType == self.memory.buildType);
            if(!conSite) {
                let result = pos.createConstructionSite(self.memory.buildType);
                if(result) {
                    throw new Error('had problem creating construction site: ' + result);
                }
                return;
            }
            creep.memory.rebuildId = conSite.id
        }
        if(creep.memory.rebuildId) {
            conSite = Game.getObjectById(creep.memory.rebuildId);
        }
        if(!conSite) {
            delete creep.memory.rebuildId
            return;
        }
        let result = creep.build(conSite);
        if(result) {
            conSite
            throw new Error('had problem building construction site: ' + result);
        }
    }
    startRepairing() {
        var self = this;
        if(!self.memory.currentRepairLocs) {
            self.memory.currentRepairLocs = self.memory.locations;
        }
    }
    finishedForNow(): boolean {
        var self = this;
        if(Game.time < self.memory.finishedUntil) {
            return true;
        }
        // still repairing current sites;
        if(self.memory.currentRepairLocs.length != 0 || _.find(self.creeps, (creep) => creep.memory.repairSite)) {
            return false;
        }
        let type = self.memory.buildType;
        if(type == STRUCTURE_WALL) {
            let locs = Path.deserialize(self.memory.locations);
            if(_.find(locs, (loc) => {
                let wall = _.find(loc.lookFor(LOOK_STRUCTURES), (struct) => struct.structureType == type);
                if(!wall || wall.hits / wall.hitsMax < self.memory.repairLevelMin) {
                    return true;
                }
                return false;
            })) {
                // found a missing wall
                self.startRepairing()
                return false;
            }
            self.memory.finishedUntil = Game.time + 10000
            return true;
        }
        let locations = new Path(self.memory.locations);
        let first = locations.first();
        let structs = _.filter(first.lookFor(LOOK_STRUCTURES), (struct) => struct.structureType == self.memory.buildType)
        // !!! first part of road at least decayed away
        if(structs.length == 0) {
            console.log('PROBABLY WAITING TOO LONG BETWEEN MAINTENANCE CYCLES FOR ' + self.getIdentifier());
            self.startRepairing();
            return false;
        }
        let struct = structs[0];
        if(struct.hits / struct.hitsMax < self.memory.repairLevelMin) {
            self.startRepairing();
            return false;
        }    
        if(type == STRUCTURE_ROAD) {
            let maxDecayTime = ROAD_HITS / (ROAD_DECAY_AMOUNT / ROAD_DECAY_TIME)
            let decayLevel = struct.hits / struct.hitsMax;
            self.memory.finishedUntil = Game.time + (maxDecayTime * (decayLevel - self.memory.repairLevelMin))
        } else if(type == STRUCTURE_RAMPART) {
            let parentRoom = Game.rooms[self.findParentJobType(Tactical).getCenterRoom().name];
            let maxDecayTime = RAMPART_HITS_MAX[parentRoom.controller.level] / (RAMPART_DECAY_AMOUNT / RAMPART_DECAY_TIME)
            let decayLevel = struct.hits / struct.hitsMax;
            self.memory.finishedUntil = Game.time + (maxDecayTime * (decayLevel - self.memory.repairLevelMin))
        } else if(type == STRUCTURE_CONTAINER) {
            let structRoom = Game.rooms[struct.pos.roomName];
            let maxDecayTime = CONTAINER_HITS / (CONTAINER_DECAY / (structRoom.controller.my ? CONTAINER_DECAY_TIME_OWNED : CONTAINER_DECAY_TIME))
            let decayLevel = struct.hits / struct.hitsMax;
            self.memory.finishedUntil = Game.time + (maxDecayTime * (decayLevel - self.memory.repairLevelMin));
        }
        return true;
    }
    finished () {
        return false;
    }
}