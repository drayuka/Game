/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('job.upgradeController');
 * mod.thing == 'a thing'; // true
 */
import { makeid, serializePosition, Path, deserializePosition, getPositionsAround } from "./utils"
import { JobClass, JobMemory } from "./job";
import { CreepClass } from "./creep";
import * as _ from "lodash"
import { OS, Logistics, Tactical, Maintenance } from "./os";
import { SpawnJob } from "./job.spawn";
import { BuilderJob } from "./job.builder";
import { MaintenanceJob } from "./job.maintenance";
interface LogisiticsJobMemory extends JobMemory {
    source: string,
    sink: string,
    groundSink: boolean,
    groundSource: boolean,
    resource: ResourceConstant,
    mainPath?: string // Path string from source to sink
    rate: number,
    roadsJobId?: string,
    builtRoad: boolean,
    maintenanceJob?: string,
}
export class LogisticsJob extends JobClass {
    _path?: Path;
    memory: LogisiticsJobMemory;
    static addLogisticsJob(
        source: string | RoomPosition, 
        sink: string | RoomPosition, 
        resource: ResourceConstant, 
        rate: number, 
        os: OS, 
        parentJobId: string
    ) {
        let threwItOnTheGround = false;
        let pickedItFromTheGround = false;
        let stringSource : string;
        let stringSink : string;
        if(typeof source != 'string') {
            pickedItFromTheGround = true;
            stringSource = serializePosition(source);
        } else {
            stringSource = source;
        }
        if(typeof sink != 'string') {
            threwItOnTheGround = true;
            stringSink = serializePosition(sink);
        } else {
            stringSink = sink;
        }
        let newMemory : LogisiticsJobMemory = {
            id: makeid(),
            parentId: parentJobId,
            source: stringSource,
            sink: stringSink,
            groundSink: threwItOnTheGround,
            groundSource: pickedItFromTheGround,
            resource: resource,
            type: Logistics,
            creeps: [],
            spawnJobs: [],
            rate: rate,
            builtRoad: false,
        }
        os.addJob(newMemory.id, newMemory);
        return newMemory.id;
    }
    updateRate (rate: number) {
        let self = this;
        self.memory.rate = rate;
    }
    // gets path creeps for this job should follow, should avoid having to repath
    get path () {
        var self = this;
        if(!self._path && self.memory.mainPath && self.memory.mainPath.length > 0) {
            self._path = new Path(self.memory.mainPath);
        }
        return self._path
    }
    set path (path: Path | undefined) {
        var self = this;
        if(!path) {
            delete self.memory.path;
            delete self._path;
            return;
        }
        self.memory.path = path.spath;
        self._path = path;
    }
    priority() {
        return 5;
    }
    execute() {
        var self = this;
        if(!self.hasMainPath()) {
            self.findMainPath();
            return;
        }
        if(self.memory.spawnJobs.length > 0) {
            self.claimSpawnedCreeps();
        }
        if(!self.workNeeded()) {
            self.spawnCreep();
        }
        if(!self.builtRoad() && self.shouldBuildRoad() && self.hasMainPath()) {
            self.buildRoad();
        } else if(self.builtRoad() && !self.hasMaintenanceJob()) {
            self.makeMaintenanceJob()
        }
        _.forEach(self.creeps, function(creep) {
            if(!self.onPath(creep)) {
                self.putCreepOnPath(creep);
                return true;
            }
            if(self.hasArrivedOnPath(creep)) {
                self.doAppropriate(creep);
            }
            self.navigate(creep);
        });
    }
    makeMaintenanceJob() {
        var self = this;
        self.memory.maintenanceJob = MaintenanceJob.createMaintenanceJob(
            Path.deserialize(self.memory.mainPath),
            STRUCTURE_ROAD,
            self.os,
            self.id
        )
        let job = self.os.jobs.get(self.memory.maintenanceJob) as MaintenanceJob;
        self.findParentJobType(Tactical).addRoomWorkerJob(job);
    }
    hasMaintenanceJob() {
        var self = this;
        return self.memory.maintenanceJob;
    }
    findMainPath() {
        var self = this;
        let startPos : RoomPosition;
        if(self.memory.groundSource) {
            startPos = deserializePosition(self.memory.source);
        } else {
            let source = Game.getObjectById<StructureContainer | StructureStorage>(self.memory.source)
            startPos = source.pos;
        }
        let surrounds = getPositionsAround(startPos, 1);
        let terrain = new Room.Terrain(startPos.roomName);
        surrounds = _.filter(surrounds, (pos) => terrain.get(pos.x, pos.y) != TERRAIN_MASK_WALL)
        let start = surrounds[Math.floor(Math.random() * surrounds.length)];
        let finish : RoomPosition;
        let finishRange = 1;
        if(self.memory.groundSink) {
            finish = deserializePosition(self.memory.sink);
            finishRange = 0;
        } else {
            let sink = Game.getObjectById<StructureContainer | StructureStorage>(self.memory.sink);
            finish = sink.pos;
        }
        let ret = PathFinder.search(start, {pos: finish, range: finishRange}, {
            plainCost: 2,
            swampCost: 10,
            roomCallback: CreepClass.workerRoomCostsGenerator(false, false, self.os)
        });
        if(ret.incomplete) {
            throw new Error('unable to complete main path creation');
        }
        let path = ret.path;
        // since we pick an arbitrary starting point, need to make 
        // sure we aren't curling around the source
        while(path && path.length > 0 && path[0].getRangeTo(startPos) < 2) {
            path.shift();
        }
        self.path = new Path(path);
    }
    buildRoad() {
        var self = this;
        self.memory.roadsJobId = BuilderJob.createNewBuilderJob(
            STRUCTURE_ROAD, self.path, self.os, self.id
        )
        let job = self.os.jobs.get(self.memory.roadsJobId) as BuilderJob;
        self.findParentJobType(Tactical).addRoomWorkerJob(job);
    }
    shouldBuildRoad() {
        var self = this;
        let mainRoom = self.getParentRoom();
        if(mainRoom.controller && mainRoom.controller.level > 3) {
            return true;
        }
        return false;
    }
    builtRoad() {
        var self = this;
        if(self.memory.builtRoads) {
            return true;
        }
        if(self.memory.roadsJobId) {
            let roadsJob = self.os.jobs.get(self.memory.roadsJobId);
            if(roadsJob.finished()) {
                self.memory.builtRoads = true;
                self.os.removeJob(self.memory.roadsJobId);
                delete self.memory.roadsJobId;
                return true;
            }
        }
        return false;
    }
    hasArrivedOnPath(creep: CreepClass) {
        var self = this;
        if(creep.path.hasNextPos()) {
            return false;
        }
        return false;
    }
    navigate(creep: CreepClass) {
        var self = this;
        if(creep.wait) {
            return;
        }
        if(!creep.path.hasNextPos()) {
            if(creep.memory.movingToSink) {
                creep.path = new Path(self.path.spath);
            } else if(creep.memory.movingToSource) {
                creep.path = new Path(Path.deserialize(self.path).reverse())
            }
        }
        creep.followPath();
    }
    doAppropriate(creep: CreepClass) {
        var self = this;
        let result : number;
        let action : string;
        if(creep.memory.movingToSink) {
            if(self.memory.groundSink) {
                action = 'drop'
                result = creep.drop(self.memory.resource);
                delete creep.memory.movingToSink;
                creep.memory.movingToSource = true;
            } else {
                action = 'transfer';
                let sink = Game.getObjectById<StructureContainer | StructureStorage>(self.memory.sink);
                result = creep.transfer(sink, self.memory.resource);
            }
        } else if(creep.memory.movingToSource) {
            if(self.memory.groundSource) {
                // fun times
                action = 'pickup'
                let pos = deserializePosition(self.memory.source)
                let resources = pos.lookFor(LOOK_RESOURCES);
                resources = _.filter(resources, (res) => res.resourceType == self.memory.resource);
                if(resources[0].amount < creep.store.getFreeCapacity()) {
                    creep.wait = true;
                    return;
                }
                result = creep.pickup(resources[0]);
            } else {
                action = 'withdraw'
                let source = Game.getObjectById<StructureStorage | StructureContainer>(self.memory.source);
                if(source.store[self.memory.resource] < creep.store.getFreeCapacity()) {
                    creep.wait = true;
                    return;
                }
                result = creep.withdraw(source, self.memory.resource);
            }
        }
        if(result) {
            throw new Error('attempted to ' + action + ' appropriate but got: ' + result);
        }
    }
    putCreepOnPath(creep: CreepClass) {
        var self = this;
        if(creep.arrived([self.path.first()], 0)) {
            creep.memory.onPath = true;
            creep.memory.movingToSource = true;
        } else {
            creep.navigate([self.path.first()], 0);
        }
    }
    onPath(creep: CreepClass) {
        var self = this;
        return creep.memory.onPath;
    }
    hasMainPath() {
        var self = this;
        if(self.path) {
            return true;
        }
        return false;
    }
    workNeeded() {
        var self = this;
        let currentWork = 50 * _.reduce(self.creeps, (total, creep) => total + creep.partCount(CARRY), 0);
        let distance = self.path.length;
        return Math.max(self.memory.rate * distance * 2 - currentWork, 0);
    }
    spawnCreep() {
        var self = this;
        let shape : BodyPartConstant[] = [CARRY, MOVE]
        let shapeCost = 100
        if(self.builtRoad()) {
            let shape = [CARRY, CARRY, MOVE]
            let shapeCost = 150
        }
        let spawnRoom = self.findParentJobType(Tactical).getCenterRoom();
        let capacity = spawnRoom.energyCapacityAvailable;
        let size = Math.min(Math.floor(capacity/shapeCost), 16);
        let creepBody = _.flattenDeep(Array(size).fill(shape));
        self.memory.spawnJobs.push(SpawnJob.createSpawnJob(
            {
                parts: creepBody,
            },
            self.os,
            self.id,
            spawnRoom.name,
            5,
        ));
    }
    getParentRoom() {
        var self = this;
        let parentTac = self.findParentJobType(Tactical);
        if(!parentTac) {
            self.os.removeJob(self.id);
            throw new Error(self.getIdentifier() + ' has no parent tac job and is self deleting');
        }
        return Game.rooms[parentTac.getCenterRoom().name];
    }
    finished() {
        return false;
    }
}
