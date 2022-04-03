import _ from "lodash";
import { JobClass, JobMemory } from "./job"
import { OS, Buildout, Tactical, Builder } from "./os";
import { makeid } from "./utils";
import { structureType } from "./job.placement";
import { BuilderJob } from "./job.builder"

export type BuildCriteria = 'Extension3' 
    | 'Extension4' 
    | 'Extension5' 
    | 'Extension6' 
    | 'Extension7' 
    | 'Extension8'
    | 'Spawn3'
    | 'Spawn2'
    | 'Storage'
    | 'Observer'
    | 'Terminal'
    | 'Labs'
    | 'Tower1'
    | 'Tower2'
    | 'Tower3'
    | 'Tower6';


type crit = {
    [x: string]: (BuildCriteria | number)[]
}
let criteria : crit = {
    //extensions should handle building out roads to extensions
    Extension3: [3],
    Extension4: [4, 'Extension3'],
    Extension5: [5, 'Extension4'],
    Extension6: [6, 'Extension5'],
    Extension7: [7, 'Extension6'],
    Spawn2: [7],
    Extension8: [8, 'Extension7'],
    Spawn3: [8, 'Spawn2'],
    Storage: [4],
    Observer: [8],
    //PowerSpawn: [8] TODO
    //Factory: [8], TODO
    //Nuker: [8], TODO
    //Walls: [4], TODO
    Terminal: [6, 'Storage'],
    Labs: [8, 'Terminal'],
    Tower1: [4, 'Storage'],
    Tower2: [5, 'Tower1'],
    Tower3: [7, 'Tower2'],
    Tower6: [8, 'Tower3'],
}

interface BuildoutJobMemory extends JobMemory {
    finished: {[x: string]: boolean},
    roomName: string,
    buildJob?: string,
}

export class BuildoutJob extends JobClass {
    memory: BuildoutJobMemory;
    createBuildoutJob (roomName: string, os: OS, parentId: string) {
        let newMemory : BuildoutJobMemory = {
            finished: {},
            roomName: roomName,
            id: makeid(),
            parentId: parentId,
            creeps: [],
            spawnJobs: [],
            type: Buildout,
        }
        os.addJob(newMemory.id, newMemory);
    }
    priority() {
        return 5
    }
    finished() {
        return false;
    }
    finishedForNow(): boolean {
        let self = this;
        let tac = self.findParentJobType(Tactical);
        if(!tac.getRoomWorkerJob().finishedForNow()) {
            // if roomworker is busy we're not going to add other things to the queue
            return true;
        }
        if(self.needsBuilding()) {
            return false;
        }
        return true;
    }
    getRoom() {
        let self = this;
        return Game.rooms[self.memory.roomName]
    }
    needsBuilding() : BuildCriteria | undefined {
        let self = this;
        return _.findKey(criteria, (critList, critKey) => {
            // already done
            if(self.memory.finished[critKey]) {
                return false;
            }
            // check if criteria list is met
            return !_.find(critList, (critItem) => {
                if(typeof critItem == 'number') {
                    return self.getRoom().controller.level < critItem
                } else {
                    return !self.memory.finished[critItem]
                }
            })
        }) as BuildCriteria
    }
    execute(): void {
        let self = this;
        if(self.memory.buildJob) {
            let job = self.os.jobs.get(self.memory.buildJob);
            if(!job.finished()) {
                return
            } else {
                delete self.memory.buildJob
            }
        }
        switch (self.needsBuilding()) {
            case 'Extension3':
                self.buildExtensions(3)
                break;
            case 'Extension4':
                self.buildExtensions(4)
                break;
            case 'Extension5':
                self.buildExtensions(5)
                break;
            case 'Extension6':
                self.buildExtensions(6)
                break;
            case 'Extension7':
                self.buildExtensions(7)
                break;
            case 'Spawn2':
                self.buildSpawn(2)
                break;
            case 'Extension8':
                self.buildExtensions(8)
                break;
            case 'Spawn3':
                self.buildSpawn(3)
                break;
            case 'Storage':
                self.buildStorage()
                break;
            case 'Observer':
                self.buildObserver()
                break;
            //PowerSpawn: [8] TODO
            //Factory: [8], TODO
            //Nuker: [8], TODO
            //Walls: [4], TODO
            case 'Terminal':
                self.buildTerminal()
                break;
            case 'Labs':
                self.buildLabs()
                break;
            case 'Tower1':
                self.buildTower(1)
                break;
            case 'Tower2':
                self.buildTower(2)
                break;
            case 'Tower3':
                self.buildTower(3)
                break;
            case 'Tower6':
                self.buildTower(6)
                break;
        }
    }
    extLvls : [0,0,5,10,20,30,40,50,60]
    buildExtensions(level: number) {
        let self = this;
        let spots = self.getBuildSpotsForType(STRUCTURE_EXTENSION)
        let [oldSpots, newSpots] = _.partition(spots, (spot) => _.filter(
            spot.lookFor(LOOK_STRUCTURES), (struct) => struct.structureType == STRUCTURE_EXTENSION
        ));
        newSpots = _.take(newSpots, self.extLvls[level] - oldSpots.length);
        self.memory.buildJob = BuilderJob.createNewBuilderJob(
            STRUCTURE_EXTENSION,
            newSpots,
            self.os,
            self.id
        )
    }
    buildSpawn(count: number) {
        let self = this;
        let spots = self.getBuildSpotsForType(STRUCTURE_SPAWN)
        let [oldSpots, newSpots] = _.partition(spots, (spot) => _.filter(
            spot.lookFor(LOOK_STRUCTURES), (struct) => struct.structureType == STRUCTURE_SPAWN
        ));
        newSpots = _.take(newSpots, count - oldSpots.length);
        self.memory.buildJob = BuilderJob.createNewBuilderJob(
            STRUCTURE_SPAWN,
            newSpots,
            self.os,
            self.id
        )
    }
    buildStorage() {
        let self = this;
        let spots = self.getBuildSpotsForType(STRUCTURE_STORAGE)
        self.memory.buildJob = BuilderJob.createNewBuilderJob(
            STRUCTURE_STORAGE,
            spots,
            self.os,
            self.id
        )
    }
    buildObserver() {
        let self = this;
        let spots = self.getBuildSpotsForType(STRUCTURE_OBSERVER);
        self.memory.buildJob = BuilderJob.createNewBuilderJob(
            STRUCTURE_OBSERVER,
            spots,
            self.os,
            self.id
        )
    }
    buildTerminal() {
        let self = this;
        let spots = self.getBuildSpotsForType(STRUCTURE_TERMINAL)
        self.memory.buildJob = BuilderJob.createNewBuilderJob(
            STRUCTURE_TERMINAL,
            spots,
            self.os,
            self.id
        )
    }
    buildLabs() {
        let self = this;
        let spots = self.getBuildSpotsForType(STRUCTURE_LAB)
        self.memory.buildJob = BuilderJob.createNewBuilderJob(
            STRUCTURE_LAB,
            spots,
            self.os,
            self.id
        )
    }
    buildTower(count: number) {
        let self = this;
        let spots = self.getBuildSpotsForType(STRUCTURE_TOWER)
        let [oldSpots, newSpots] = _.partition(spots, (spot) => _.filter(
            spot.lookFor(LOOK_STRUCTURES), (struct) => struct.structureType == STRUCTURE_TOWER
        ));
        newSpots = _.take(newSpots, count - oldSpots.length);
        self.memory.buildJob = BuilderJob.createNewBuilderJob(
            STRUCTURE_TOWER,
            newSpots,
            self.os,
            self.id
        )
    }
    //should not be used for extensions
    getBuildSpotsForType(type: StructureConstant) : RoomPosition[]{
        let self = this;
        let place = self.findParentJobType(Tactical).getPlacementJob();
        switch(type) {
            case STRUCTURE_STORAGE:
                return place.getSiteByType(structureType.Storage)
            case STRUCTURE_OBSERVER:
                return place.getSiteByType(structureType.Observer)
            case STRUCTURE_TERMINAL:
                return place.getSiteByType(structureType.Terminal)
            case STRUCTURE_LAB:
                return place.getSiteByType(structureType.Lab)
            case STRUCTURE_TOWER:
                return place.getSiteByType(structureType.Tower)
            case STRUCTURE_EXTENSION:
                return place.getExtensionSites(structureType.Extension)
            default:
                return [];
        }
    }

}