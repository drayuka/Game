import { JobClass, JobMemory} from "./job";
import { BuilderJob } from "./job.builder";
import { MaintenanceJob } from "./job.maintenance";
import { PlacementJob } from "./job.placement";
import { RoomworkerJob } from "./job.roomworker";
import { OS, Placement, Roomstartup, Roomworker, Tactical } from "./os";
import { makeid } from "./utils";

interface TacticalJobMemory extends JobMemory {
    roomName: string,
    stage: number,
    roomWorkerJob?: string,
    roomStartupJob?: string,
    containerId?: Id<StructureContainer>,
    placementJob?: string,
    remoteMines: string[]
}

export class TacticalJob extends JobClass {
    memory: TacticalJobMemory
    static createNewStrategyJob (
        roomName: string,
        os: OS,
        parentId: string,
    ) {
        let newMemory : TacticalJobMemory = {
            roomName: roomName,
            id: makeid(),
            parentId: parentId,
            spawnJobs: [],
            creeps: [],
            type: Tactical,
            stage: 0,
            remoteMines: []
        }
        os.addJob(newMemory.id, newMemory);
        return newMemory.id;
    }
    priority () {
        return 6;
    }
    finished () { 
        return false;
    }
    execute() {
        let self = this;

        switch (self.memory.stage) {
            case 0:
                self.createPlacementJob()
                self.createRoomStartupJob()
                self.memory.stage = 1;
                break;
            case 1:
                if(self.roomStartupFinished() && self.placementFinished()) {
                    self.memory.stage = 2;
                }
                break;
            case 2:
                self.createRoomWorkerJob()
                self.createLocalHarvestJobs()
                self.createRoomBuildoutJob()
                self.memory.stage = 3;
                break;
            case 3:
                if(self.readyForRemoteMining()) {
                    self.memory.stage = 4;
                }
                break;
            case 4:
                self.createRemoteHarvestJobs();
                self.memory.stage = 5;
                break;
        }
        self.identifyFailureModes();
    }
    getCenterRoom() : Room {
        let self = this;
        return Game.rooms[self.memory.roomName];
    }
    getStorage() : StructureContainer | StructureStorage | undefined {
        let self = this;
        if(self.memory.containerId) {
            return Game.getObjectById(self.memory.containerId);
        }
        let room = Game.rooms[self.memory.roomName]
        if(room.storage) {
            return room.storage
        }
    }
    getRoomWorkerJob() : RoomworkerJob {
        let self = this;
        return self.os.jobs.get(self.memory.roomWorkerJob) as RoomworkerJob
    }
    addRoomWorkerJob(job: BuilderJob | MaintenanceJob) {
        let self = this;
        if(!self.memory.roomWorkerJob) {
            throw new Error('tried to add a builder or maintentance job before this room was ready to support it');
        }
        
        self.getRoomWorkerJob().addSubJob(job.id);
    }
    identifyFailureModes() {
        //IDEA: what if tac identified sub job failure modes 
        //based on detections run intermediately
        FIXIT
        //failure mode 1, we aren't reloading spawns and extensions fast
        //enough to keep up with demand and loader jobs can't get their 
        //creeps spawned.
    }
    getPlacementJob() : PlacementJob{
        let self = this;
        return self.os.jobs.get(self.memory.placementJob) as PlacementJob;
    }
}