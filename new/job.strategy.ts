import { JobClass, JobMemory } from "./job";
import { OS, Strategy } from "./os";
import { makeid } from "./utils";

interface StrategyJobMemory extends JobMemory {
    ownedRooms: string[],
    reservedRooms: string[],
    ClaimJobs: {
        [roomName: string] : string,
    },
    TacticalJobs: {
        [roomName: string] : string,
    },
    threats: any[],
    scoutJob?: string,
}

export class StrategyJob extends JobClass {
    memory : StrategyJobMemory;
    createNewStrategyJob(
        firstRoom: string,
        os: OS
    ) {
        let newMemory : StrategyJobMemory = {
            ClaimJobs: {},
            TacticalJobs: {},
            ownedRooms: [firstRoom],
            reservedRooms: [],
            threats: [],
            parentId: undefined,
            id: makeid(),
            creeps: [],
            spawnJobs: [],
            type: Strategy,
        }
        os.addJob(newMemory.id, newMemory)
        return newMemory.id;
    }
    priority () {
        return 6
    }
    finished () {
        return false;
    }
    execute(): void {
        let self = this;
        FIXIT
    }
    addTacticalJob(roomName: string, jobId: string): void {
        let self = this;
        self.memory.TacticalJobs[roomName] = jobId;
    }
}