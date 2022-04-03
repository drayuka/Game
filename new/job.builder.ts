import _ from "lodash";
import { CreepClass } from "./creep";
import { JobClass, JobMemory } from "./job";
import { Builder, OS, Tactical } from "./os";
import { deserializePosition, getPositionsAround, makeid, Path, serializePosition } from "./utils";

interface BuilderJobMemory extends JobMemory {
    locations: string,
    buildType: BuildableStructureConstant,
    finished: boolean
}

export class BuilderJob extends JobClass {
    memory: BuilderJobMemory;
    //if locations are in multiple rooms, they should preferably be in order
    static createNewBuilderJob(
        buildType: BuildableStructureConstant,
        locations: RoomPosition[] | Path,
        os: OS,
        parentJobId: string
    ) {
        let path: Path;
        if(locations instanceof Path) {
            path = new Path(locations.spath);
        } else {
            path = new Path(locations)
        }
        let newMemory : BuilderJobMemory = {
            id: makeid(),
            type: Builder,
            creeps: [],
            parentId: parentJobId,
            spawnJobs: [],
            locations: path.spath,
            buildType: buildType,
            finished: false,
        }
        os.addJob(newMemory.id, newMemory);
        return newMemory.id;
    }
    // builder jobs should never run by themselves.
    priority(): number {
        return 5;
    }
    osRun(): boolean {
        return false;
    }
    execute(): void {
        var self = this;
        _.forEach(self.creeps, function (creep) {
            if(self.creepHasSite(creep)) {
                self.checkSite(creep);
            }
            if(!self.creepHasSite(creep)) {
                self.creepGetNewSite(creep);
            }

            if(self.creepHasEnergy(creep)) {
                if(self.creepArrivedAtBuildSite(creep)) {
                    self.creepBuild(creep);
                } else {
                    self.creepNavigateToBuildSite(creep);
                }
            } else {
                if(self.creepArrivedAtResourcePickup(creep)) {
                    self.creepGetEnergy(creep);
                    self.creepNavigateToBuildSite(creep);
                } else {
                    self.creepNavigateToResources(creep);
                }
            }
        });
    }
    creepNavigateToResources(creep: CreepClass) {
        let self = this;
        let storePos = self.resourceStorage().pos;
        creep.navigate([storePos], 1);
    }
    creepGetEnergy(creep: CreepClass) {
        var self = this;
        let storage = self.resourceStorage();
        creep.withdraw(storage, RESOURCE_ENERGY)
    }
    resourceStorage() : StructureContainer | StructureStorage {
        var self = this;
        return self.findParentJobType(Tactical).getStorage();
    }
    creepArrivedAtResourcePickup(creep: CreepClass) {
        var self = this;
        let storePos = self.resourceStorage().pos;
        return creep.pos.getRangeTo(storePos) <= 1;
    }
    creepNavigateToBuildSite(creep: CreepClass) {
        var self = this;
        let sitePos = deserializePosition(creep.memory.buildSite.pos);
        creep.navigate([sitePos], 3);
    }
    creepBuild(creep: CreepClass) {
        var self = this;
        if(creep.memory.stationary) {
            let buildPos = deserializePosition(creep.memory.buildSite.pos)
            let positions = getPositionsAround(buildPos, 3);
            let terrain = new Room.Terrain(creep.pos.roomName);
            positions = _.filter(positions, (pos) => pos.lookFor(LOOK_STRUCTURES).length == 0 && terrain.get(pos.x, pos.y) != TERRAIN_MASK_WALL)
            // if we're already in a good position mark ourselves stationary
            if(!_.find(positions, (pos) => pos.isEqualTo(creep.pos))) {
                creep.navigate([positions[0]], 0);
            } else {
                delete creep.memory.path;
                creep.memory.stationary = true;
            }
        }
        let buildSite = Game.getObjectById<ConstructionSite>(creep.memory.buildSite.id)
        let result = creep.build(buildSite)
        if(result) {
            throw new Error('couldnt build construction site at ' + creep.memory.buildSite.pos);
        }
    }
    creepArrivedAtBuildSite(creep: CreepClass) {
        var self = this;
        let pos = deserializePosition(creep.memory.buildSite.pos);
        return creep.pos.getRangeTo(pos) <= 3;
    }
    creepHasEnergy(creep: CreepClass) {
        return creep.energy > 0;
    }
    creepGetNewSite(creep: CreepClass) {
        var self = this;
        let posList = new Path(self.memory.locations);
        let newPos = posList.first();
        let result = newPos.createConstructionSite(self.memory.buildType);
        if(result) {
            throw new Error('Couldnt create a build site at ' + serializePosition(newPos));
        }
        posList.next();
        self.memory.locations = posList.spath;
        let room = Game.rooms[newPos.roomName];
    }
    creepHasSite(creep: CreepClass) {
        var self = this;
        return creep.memory.buildSite;
    }
    checkSite(creep: CreepClass) {
        var self = this;
        let siteInfo = creep.memory.buildSite;
        if(!siteInfo.id) {
            let pos = deserializePosition(siteInfo.pos);
            let conSites = _.filter(pos.lookFor(LOOK_CONSTRUCTION_SITES), (site) => site.my);
            if(conSites.length == 0) {
                self.memory.locations = self.memory.locations + serializePosition(pos);
                delete creep.memory.buildSite;
                delete creep.memory.stationary;
            }
            siteInfo.id = conSites[0].id;
        }
        let construction = Game.getObjectById<ConstructionSite>(siteInfo.id);
        if(!construction) {
            let pos = deserializePosition(siteInfo.pos);
            let structures = _.filter(pos.lookFor(LOOK_STRUCTURES), (struct) => struct.structureType == self.memory.buildType);
            if(structures.length == 0) {
                // construction site vanished!
                self.memory.locations = self.memory.locations + serializePosition(pos);
                delete creep.memory.buildSite;
                delete creep.memory.stationary;
            } else {
                //success!
                delete creep.memory.buildSite;
                delete creep.memory.stationary;
            }
        }
    }
    finished() {
        var self = this;
        return self.memory.finished;
    }
}