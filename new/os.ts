import _ from "lodash";
import { bootstrap } from "./bootstrap";
import { JobClass, JobMemory } from "./job";
import { BuilderJob } from "./job.builder";
import { ClaimJob } from "./job.claim";
import { HarvestJob } from "./job.harvest";
import { LoaderJob } from "./job.loader";
import { LogisticsJob } from "./job.logistics";
import { SpawnJob } from "./job.spawn";
import { MaintenanceJob } from "./job.maintenance"
import { RoomworkerJob } from "./job.roomworker";
import { UpgradeJob } from "./job.upgrade";
import { ProtectorJob } from "./job.protector"
import { RoomStartupJob } from "./job.roomstartup"
import { TacticalJob } from "./job.tactical";
import { StrategyJob } from "./job.strategy";
import { PlacementJob } from "./job.placement"
import { BuildoutJob } from "./job.buildout";
import { ReserveJob } from "./job.reserve";

export declare const Tactical : Tactical;
export declare const Strategy : Strategy;
export declare const Claim : Claim;
export declare const Harvest : Harvest;
export declare const Loader : Loader;
export declare const Builder: Builder;
export declare const Logistics : Logistics;
export declare const Protector : Protector;
export declare const Roomworker : Roomworker;
export declare const Spawner : Spawner;
export declare const Maintenance : Maintenance;
export declare const Upgrade : Upgrade;
export declare const Roomstartup : Roomstartup;
export declare const Placement : Placement;
export declare const Buildout : Buildout;
export declare const Reserve : Reserve;

export declare const DO_NOT_RUN_PRIO = 10000;

export type Tactical = "tac";
export type Strategy = "strat";
export type Claim = "claim";
export type Harvest = "harvest";
export type Loader = "loader";
export type Builder = "builder";
export type Logistics = "logistics";
export type Protector = "protec";
export type Roomworker = "rmWorker";
export type Spawner = "spawner";
export type Maintenance = "maint";
export type Upgrade = "upgrade";
export type Roomstartup = 'rmstrt';
export type Placement = 'placement';
export type Buildout = 'buildout';
export type Reserve = 'res'

export type Job = 
    Tactical 
    | Strategy 
    | Claim 
    | Harvest 
    | Loader 
    | Builder 
    | Logistics
    | Protector
    | Roomworker
    | Spawner
    | Maintenance
    | Upgrade
    | Roomstartup
    | Placement
    | Buildout
    | Reserve;

export type JobType<T> = 
    T extends Tactical ? TacticalJob : 
    T extends Strategy ? StrategyJob :
    T extends Claim ? ClaimJob:
    T extends Harvest ? HarvestJob:
    T extends Loader ? LoaderJob:
    T extends Builder ? BuilderJob:
    T extends Logistics ? LogisticsJob:
    T extends Protector ? ProtectorJob:
    T extends Roomworker ? RoomworkerJob:
    T extends Spawner ? SpawnJob :
    T extends Maintenance ? MaintenanceJob :
    T extends Upgrade ? UpgradeJob :
    T extends Roomstartup ? RoomStartupJob :
    T extends Placement ? PlacementJob : 
    T extends Buildout ? BuildoutJob :
    T extends Reserve ? ReserveJob : never;

export type myMemorySegments = Map<number, myMemorySegment>
export type myMemorySegment = any;
export interface myMemory {
	jobs: {
		[x: string] : JobMemory
	}
	creeps: {
		[x: string]: any
	}
	requestedSegments: {[seg: number] : number};
	spawnInfo: {
		// list of rooms in order of closest to furthest including range info
		distanceSpawnList: {
			[x: string]: {roomName: string, distance: number}[]
		}
		// list of spawns and the job id they're currently working on.
		currentSpawnJobList: {
			[x: Id<StructureSpawn>]: string
		}
		[x: string]: any
	}
}

export class OS {
    memory: myMemory;
    memorySegments: myMemorySegments;
    // mapped by id
    jobs: Map<string, JobClass>;
    // mapped by priority
    queue: Map<number, JobClass[]>;
    strat?: StrategyJob;
    spawningEnergy: {
        [x: string]: number
    };
    constructor(memory: myMemory, memorySegments: Map<number, myMemorySegment>) {
        var self = this;
        self.memory = memory;
        self.memorySegments = memorySegments;
    }
    needsBootstrap() {
        let self = this;
        if(self.jobs.size == 0 || !self.strategyJob()) {
            return true;
        }
        return false;
    }
    strategyJob() : StrategyJob | undefined{
        let self = this;
        return self.strat;
    }
    instJobObj(jobMemory: JobMemory) {
        var self = this;
        let job : JobClass;
        switch (jobMemory.type) {
            case Tactical:
                job = new TacticalJob(jobMemory, self);
                FIXIT
                break;
            case Strategy:
                job = new StrategyJob(jobMemory, self);
                FIXIT
                break;
            case Claim: 
                job = new ClaimJob(jobMemory, self);
                break;
            case Harvest:
                job = new HarvestJob(jobMemory, self);
                break;
            case Loader:
                job = new LoaderJob(jobMemory, self);
                FIXIT
                break;
            case Builder:
                job = new BuilderJob(jobMemory, self);
                break;
            case Logistics:
                job = new LogisticsJob(jobMemory, self);
                break;
            case Protector:
                job = new ProtectorJob(jobMemory, self);
                FIXIT
                break;
            case Roomworker:
                job = new RoomworkerJob(jobMemory, self);
                break;
            case Spawner:
                job = new SpawnJob(jobMemory, self);
                break;
            case Maintenance:
                job = new MaintenanceJob(jobMemory, self);
                break;
            case Upgrade:
                job = new UpgradeJob(jobMemory, self);
                break;
            case Roomstartup:
                job = new RoomStartupJob(jobMemory, self);
                break;
            case Placement:
                job = new PlacementJob(jobMemory, self);
                FIXIT
                break;
            case Buildout:
                job = new BuildoutJob(jobMemory, self);
                FIXIT // still need to figure out roads for extension sites
                break;
            case Reserve:
                job = new ReserveJob(jobMemory, self);
                break;
        }
        return job;
    }
    //execute jobs based on their priority
    init() {
        var self = this;
        self.initJobs();
        self.initSpawns();
        self.initCreeps();
    }
    initCreeps() {
        var self = this;
        let deadCreeps = _.reduce(self.memory.creeps, function(creeps, creep, name) {
            if(!Game.creeps[name]) {
                creeps.push(name);
            }
            return creeps;
        }, []);

        _.forEach(deadCreeps, (name) => {
            self.jobs.get(self.memory.creeps[name].jobId).removeCreep(name);
            delete self.memory.creeps[name]
        });
    }
    findSpawnDistances(destRoomName: string) : {roomName: string, distance: number}[] {
        var self = this;
        let rooms : Set<string> = new Set();
        _.reduce(Game.spawns, function(roomList, spawn) {
            return roomList.add(spawn.room.name);
        }, rooms);
        let distanceList : {roomName: string, distance: number}[] = [];
        rooms.forEach(function (spawnRoomName) {
            if(Game.map.getRoomLinearDistance(destRoomName, spawnRoomName) > 20) {
                return true;
            }
            let route = Game.map.findRoute(destRoomName, spawnRoomName);
            if(route != -2 && route.length < 30) {
                distanceList.push({roomName: spawnRoomName, distance: route.length});
            }
        });
        return distanceList.sort((a, b) => a.distance - b.distance)
    }
    getSpawnBusy(id: Id<StructureSpawn>) : boolean {
        var self = this;
        if(self.memory.spawnInfo.currentSpawnJobList[id]) {
            return true;
        }
        return false;
    }
    setSpawnBusy(id: Id<StructureSpawn>, spawnJobId: string) {
        var self = this;
        self.memory.spawnInfo.currentSpawnJobList[id] = spawnJobId;
    }
    setSpawnUnbusy(id: Id<StructureSpawn>) {
        var self = this;
        delete self.memory.spawnInfo.currentSpawnJobList[id];
    }
    getSpawnDistanceMap(roomName : string) : {roomName: string, distance: number}[] {
        var self = this;
        if(!self.memory.spawnInfo.distanceSpawnList[roomName]) {
            self.memory.spawnInfo.distanceSpawnList[roomName] = self.findSpawnDistances(roomName);
        }
        return self.memory.spawnInfo.distanceSpawnList[roomName];
    }
    // needs to reset and deal with spawn jobs interface with os memory
    addSpawn(id: Id<StructureSpawn>) {
        var self = this;
        let newSpawn = Game.getObjectById(id);
        if(!newSpawn) {
            //WUT?
            return;
        }
        // if this room already has other spawns, we're good
        if(_.find(Game.spawns, (spawn) => spawn.id != newSpawn.id && spawn.pos.roomName == newSpawn.pos.roomName)) {
            return;
        }
        // brand new room, no luck on spawn rooms
        _.forEach(self.memory.spawnInfo.distanceSpawnList, (distanceList, roomName) => {
            // these 2 rooms are too far away from each other
            if(Game.map.getRoomLinearDistance(newSpawn.pos.roomName, roomName) > 20) {
                return true
            }
            let route = Game.map.findRoute(newSpawn.pos.roomName, roomName);
            if(route != -2 && route.length < 30) {
                // typescript is broken sometimes
                let length = route.length;
                distanceList.splice(_.findIndex(distanceList, (dist) => dist.distance > length), 0, {roomName: newSpawn.pos.roomName, distance: route.length})
            }
        })
    }
    removeSpawnsInRoom(roomName: string) {
        var self = this;
        //FIXIT: we should resolve this better
        _.forEach(self.memory.spawnInfo.distanceSpawnList, (distanceList, roomKey) => {
            self.memory.spawnInfo.distanceSpawnList[roomKey] = _.filter(distanceList, (distItem) => distItem.roomName == roomName)
        });
    }
    initSpawns() {
        var self = this;
        this.spawningEnergy = {}
        if(!self.memory.spawnInfo) {
            self.memory.spawnInfo = {
                distanceSpawnList: {},
                currentSpawnJobList: {},
            }
        }
        _.forEach(_.cloneDeep(self.memory.spawnInfo.currentSpawnJobList), (spawnJobId, spawnId) => {
            if(!Game.spawns[spawnId]) {
                let job = self.jobs.get(spawnJobId) as SpawnJob;
                delete job.memory.spawner
                delete self.memory.spawnInfo.currentSpawnJobList[spawnId];
            }
        });
    }
    getSegment(seg: number) {
        let self = this;
        if(!self.memorySegments.get(seg)) {
            self.memorySegments.set(seg, {});
        }
        return self.memorySegments.get(seg);
    }
    initJobs() {
        var self = this;
        var jobs = new Map();
        var queue = new Map();
        _.forEach(self.memory.jobs, function(jobMemory) {
            let job = self.instJobObj(jobMemory);
            if(job.type == Strategy) {
                self.strat = job;
            }
            jobs.set(job.id, job);
        });
        self.jobs = jobs;
        _.forEach(Array.from(self.jobs.values()), (job) =>{
            if(!jobs.has(job.id)) {
                return true;
            }
            if(!job.osRun) {
                return true;
            }
            if(job.finished() || job.finishedForNow()) {
                return true;
            }
            if(job.neededSegments()) {
                let segments = job.neededSegments()
                _.forEach(segments, (seg) => {
                    self.memory.requestedSegments[seg] = Game.time;
                })
                if(_.find(segments, (segment) => !self.memorySegments.has(segment))) {
                    return true;
                }
            }
            let prio = job.priority();
            if(prio >= DO_NOT_RUN_PRIO) {
                return true;
            }
            if(!queue.has(prio)) {
                queue.set(prio, []);
            }
            queue.get(prio).push(job);
        })
        self.queue = queue;
    }
    addJob (id: string, memory: JobMemory) {
        var self = this;
        _.set(self.memory, 'jobs.' + id, memory);
        let job = self.instJobObj(memory);
        let prio = job.priority();

        if(!self.queue.has(prio)) {
            self.queue.set(prio, [])
        }
        self.queue.get(prio).push(job);
        self.jobs.set(job.id, job)
    }
    removeJob (id: string) {
        var self = this;
        _.unset(self.memory, 'jobs.' + id);
        self.jobs.delete(id);
    }
    // run each job according to it's priority as long as its still valid and hasn't run this tick;
    run () {
        var self = this;
        if(self.shouldStop(0)) {
            console.log('stopped before doing anything, might be bad?');
            return;
        }
        if(self.jobs.size == 0) {
            bootstrap(self);
            return;
        }
        let priorities = Array.from(self.queue.keys()).sort()
        let jobList = _.reduce(priorities, function(list, prio) {
            list.push(...self.queue.get(prio));
            return list;
        }, []);
        let jobsToRemove = [];

        let ran = 0;
        _.forEach(jobList, function(job) {
            if(!self.validateJob(job.id)) {
                jobsToRemove.push(job.id);
                return true;
            }
            if(job.ranThisTick) {
                return true;
            }
            if(ran % 10 == 0) {
                if(self.shouldStop(job.priority())) {
                    return false;
                }
            }
            try {
                job.execute();
            } catch (e) {
                console.log(job.getIdentifier() + ' had a problem running:');
                console.log(e.stack);
                debugger;
            }
            job.ranThisTick = true;
            ran++;
        });
        _.forEach(jobsToRemove, (jobId) => self.removeJob(jobId));
    }
    shouldStop(priority: number) {
        var self = this
        let used = Game.cpu.getUsed();
        if(Game.cpu.limit / 2 < used && Game.cpu.bucket < Game.cpu.limit * 2) {
            // stop if our bucket is small so we can build up some bucket
            return true;
        }
        if(used > Game.cpu.limit) {
            if(priority > 5) {
                return true;
            }
        }
        return false;
    }
    validateJob(jobId : string) {
        var self = this;
        if(!self.jobs.has(jobId)){
            return false;
        }
        let job = self.jobs.get(jobId);
        if(!job.parentJobId && job.type == Strategy) {
            return true;
        }
        if(!self.jobs.has(job.parentJobId)) {
            return false;
        }
        return self.validateJob(job.parentJobId);
    }
}
module.exports = OS;