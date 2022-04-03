import _, { xor } from "lodash";
import { setFlagsFromString } from "v8";
import { JobClass, JobMemory } from "./job"
import { OS, Placement } from "./os";
import { deserializePosition, getOverlappingPositions, makeid, serializePosition, visualisePath } from "./utils";

export enum structureType {
    Road = 1,
    Container,
    Rampart,
    Extension,
    Wall,
    Tower,
    Storage,
    Lab,
    Terminal,
    Observer,
    PowerSpawn,
    Factory,
    Nuker,
    FutureSpot
}

interface PlacementJobMemory extends JobMemory {
    roomName: string,
    segment: number,
    planningState: number,
    stagePlacementMiscData: any,
    storagePos?: string,
    containerPos?: string,
}

interface SegmentMemory {
    finishedPlan: number[]
}

export class PlacementJob extends JobClass {
    memory : PlacementJobMemory;
    segment : SegmentMemory;
    static createPlacementJob(
        roomName: string,
        segment: number,
        os: OS,
        parentJobId: string
    ) {
        var newMemory : PlacementJobMemory = {
            id: makeid(),
            parentId: parentJobId,
            type: Placement,
            creeps: [],
            spawnJobs: [],
            roomName: roomName,
            segment: segment,
            planningState: 0,
            stagePlacementMiscData: {}
        }
        os.addJob(newMemory.id, newMemory);
    }
    constructor(memory: any, os: OS) {
        super(memory, os);
        let self = this;
        self.setupSegment();
    }
    setupSegment() {
        let self = this;
        let seg = self.os.getSegment(self.memory.segment);
        if(!seg) {
            seg = {}
        }
        if(!seg[self.getIdentifier()]) {
            seg[self.getIdentifier()] = {}
        }
        self.segment = seg[self.getIdentifier()]
    }
    getExtensionSites(type: structureType) : RoomPosition[] {
        let self = this;
        FIXIT
    }
    getSiteByType(type: structureType) : RoomPosition[] {
        let self = this;
        let spots = [];
        for(let x = 0; x < 50; x++) {
            for(let y = 0; y < 50; y++) {
                if(self.finishedPlan.get(x, y) == type) {
                    spots.push(new RoomPosition(x, y, self.memory.roomName));
                }
            }
        }
        return spots;
    }
    getLevel2ExtSites() : Id<ConstructionSite>[] | undefined {

    }
    //has a container site seperate from future storage site for levels 2-4
    getMainContainerSite() : Id<ConstructionSite> | undefined {
        let self = this;
    }
    getFirstSpawnSite() : Id<ConstructionSite> | undefined {
        let self = this;

    }
    finished() {
        return false;
    }
    finishedForNow(): boolean {
        let self = this;
        let room = Game.rooms[self.memory.roomName];
        if(!room) {
            return true;
        }
        return self.memory.planningState == 8
    }
    priority() : number {
        return 6;
    }
    _finishedPlan: CostMatrix;
    get finishedPlan () {
        let self = this;
        if(!self._finishedPlan) {
            if(self.segment.finishedPlan) {
                self._finishedPlan = PathFinder.CostMatrix.deserialize(self.segment.finishedPlan);
            } else {
                self._finishedPlan = new PathFinder.CostMatrix();
            }
        }
        return self._finishedPlan;
    }
    execute() {
        let self = this;
        let startState = self.memory.planningState
        switch(self.memory.planningState) {
            case 0:
                // finds a good center for the base to exist at, near to the controller
                // places storage, and initial container
                self.storagePlacement();
                break;
            case 1:
                //sets up roads from storage to sources and each exit from the room,
                // this makes sure it should be possible to navigate to and from the storage
                // without a problem
                self.mainPathPlacement();
                break;
            case 2:
                // roads and future spots for things like labs and extensions
                // doesn't need specifics, just needs a big enough collection
                // of locations for future placement routines
                // needs to try to break even between closer spots and reducing the amount of
                // road neccesary
                self.trafficPlacement();
                break;
            case 3:
                // place the following
                // Factory
                // Observer
                // PowerSpawn
                // Nuker
                // Spawns
                // terminal
                // 1 link - for future input and output to other links
                self.centralBuildingPlacement();
                break;
            case 4:
                // places labs while reducing distance between them
                self.LabPlacement();
                break;
            case 5:
                // fills the rest of the spots with the 60 odd extension spots
                self.ExtensionPlacement();
                break;
            case 6: 
                // places towers at the outer edges of the base
                self.TowerPlacement();
                break;
            case 7:
                // order extensions from nearest to furthest
                self.OrderExtensions();
                break;
            case 8: 
                // places walls
                //self.placeWalls(); TODO
                break;
        }
        if(startState != self.memory.planningState) {
            self.memory.stagePlacementMiscData = {}
        }
        self.segment.finishedPlan = self.finishedPlan.serialize();
    }
    // should produce a couple of artifacts
    // 1. a cost matrix
    // 2. number of spots on the road network including their distance from storage, in distance order
    // 3. total of each building spot times the distance from storage it is on the road network
    indiciesAround(x: number, y: number) : {x: number, y: number}[]{
        let self = this;
        return [
            {x: x - 1, y: y - 1},
            {x: x,     y: y - 1},
            {x: x + 1, y: y - 1},
            {x: x - 1, y: y    },
            {x: x + 1, y: y    },
            {x: x - 1, y: y + 1},
            {x: x,     y: y + 1},
            {x: x + 1, y: y + 1},
        ]
    }
    trafficPrep(build : CostMatrix) {
        let self = this;
        let costs = new PathFinder.CostMatrix();
        let terrain = new Room.Terrain(self.memory.roomName);
        let road = new Set()
        let building = new Set();
        let total = 0;
        let storagePos = deserializePosition(self.memory.storagePos);
        let containerPos = deserializePosition(self.memory.containerPos);
        building.add(storagePos.x + ',' + storagePos.y);
        building.add(containerPos.x + ',' + containerPos.y);

        let distance = 0;
        let ends = self.indiciesAround(storagePos.x, storagePos.y);
        ends.push(...self.indiciesAround(containerPos.x, containerPos.y));
        ends = _.filter(ends, (end) => {
            if(build.get(end.x, end.y) == structureType.Road) {
                road.add(end.x + ',' + end.y)
                return true;
            }
            return false;
        })
        let cost = 0;
        while(ends.length > 0) {
            cost++;
            let starts = ends;
            ends = []
            _.forEach(starts, (start) => {
                let surrounds = self.indiciesAround(start.x, start.y);
                _.forEach(surrounds, (surround) => {
                    if(terrain.get(surround.x, surround.y) == TERRAIN_MASK_WALL) {
                        return true;
                    }
                    let comp = surround.x + ',' + surround.y;
                    if(!building.has(comp) && build.get(surround.x, surround.y) != structureType.Road) {
                        building.add(comp)
                        costs.set(surround.x, surround.y, cost);
                        total += cost;
                    } else if(!road.has(comp) && build.get(surround.x, surround.y) == structureType.Road) {
                        ends.push(surround);
                        road.add(comp);
                        costs.set(surround.x, surround.y, cost);
                    } 
                });
            });
        }
        self.freezePlacement(costs, )
    }
    //Traffic placement
    trafficPlacement() {
        let self = this;
        if(!self.memory.stagePlacementMiscData.roadPoints) {
            self.trafficPrep(self.finishedPlan);
            return;
        } else {

        }
        FIXIT

    }
    //main Path placement
    generateTrafficGoals() : string[] {
        let self = this;
        let goals : RoomPosition[]= [];
        let room = Game.rooms[self.memory.roomName];
        if(!room) {
            throw new Error('cant see in room for traffic placement')
        }
        goals.push(..._.map(room.find(FIND_SOURCES), (source) => source.pos))
        let nexit = room.find(FIND_EXIT_TOP);
        if(nexit.length > 0) {
            goals.push(nexit[0])
        }
        let eexit = room.find(FIND_EXIT_RIGHT);
        if(eexit.length > 0) {
            goals.push(eexit[0]);
        }
        let wexit = room.find(FIND_EXIT_LEFT);
        if(wexit.length > 0) {
            goals.push(wexit[0]);
        }
        let sexit = room.find(FIND_EXIT_BOTTOM);
        if(sexit.length > 0) {
            goals.push(sexit[0]);
        }
        goals.push(room.controller.pos);
        _.forEach(goals, (goal) => room.visual.circle(goal, {radius: 1}))
        return _.map(goals, (goal) => serializePosition(goal));
    }
    getStorageAndContainerDestPositions() {
        let self = this;
        let storagePos = deserializePosition(self.memory.storagePos);
        let containerPos = deserializePosition(self.memory.containerPos);
        let spots = getOverlappingPositions([
            {pos: storagePos, range: 1}, 
            {pos: containerPos, range: 1}
        ]);
        spots = _.filter(spots, (pos) => !pos.isEqualTo(storagePos) && !pos.isEqualTo(containerPos));
        return spots;
    }
    mainPathPlacement() {
        let self = this;
        let pathGoal : RoomPosition;
        if(!self.memory.stagePlacementMiscData.goalList) {
            self.memory.stagePlacementMiscData.goalList = self.generateTrafficGoals();
            _.forEach(self.getStorageAndContainerDestPositions(), (pos) => self.finishedPlan.set(pos.x, pos.y, structureType.Road))
            return;
        } else {
            if(self.memory.stagePlacementMiscData.goalList.length == 0) {
                self.memory.planningState = 2
                return;
            }
            pathGoal = deserializePosition(self.memory.stagePlacementMiscData.goalList.shift())
        }

        let plan = self.finishedPlan.clone();
        for(let x = 0; x < 50; x++) {
            for(let y = 0; y < 50; y++) {
                if(plan.get(x,y) > structureType.Road) {
                    plan.set(x,y, 255);
                }
            }
        }
        
        let func = function (roomName: string) {
            return plan;
        }
        let ret = PathFinder.search(pathGoal, self.getStorageAndContainerDestPositions(), {
            roomCallback: func,
            swampCost: 10,
            plainCost: 2
        })
        if(ret.path && ret.path.length > 0) {
            _.forEach(ret.path, (pos) => self.finishedPlan.set(pos.x, pos.y, structureType.Road))
        }

    }
    // storage Placement
    buildSpaceMap() {
        let self = this;
        let terrain = new Room.Terrain(self.memory.roomName);
        let spaceMap = new PathFinder.CostMatrix();
        let changed = true;
        for(let x = 1; x < 49; x++) {
            for(let y = 1; y < 49; y++) {
                spaceMap.set(x, y, terrain.get(x,y) == TERRAIN_MASK_WALL ? 0 : 1)
            }
        }
        let iter = 1;
        while(changed) {
            changed = false;
            let newMap = spaceMap.clone();
            for(let x = 1; x < 49; x++) {
                for(let y = 1; y < 49; y++) {
                    let tot = 0;
                    for(let a = x-1; a <= x + 1; a++) {
                        for( let b = y-1; b <= y + 1; b++) {
                            tot += spaceMap.get(a,b);
                        }
                    }
                    if(Math.floor(tot / 9) == iter) {
                        changed = true;
                        newMap.set(x,y, iter + 1)
                    }
                }
            }
            spaceMap = newMap;
            iter++;
        }
        let visual = new RoomVisual(self.memory.roomName)
        for(let x = 0; x < 50; x++) {
            for(let y = 0; y < 50; y++) {
                visual.circle(x,y, {radius: .1 * spaceMap.get(x,y)})
            }
        }
        return spaceMap;
    }
    storagePlacement() {
        let self = this;
        if(!self.memory.stagePlacementMiscData.spaceMap) {
            self.memory.stagePlacementMiscData.spaceMap = self.buildSpaceMap().serialize();
            // pause after building and saving the space map
            return;
        }
        let room = Game.rooms[self.memory.roomName];
        if(!room) {
            return;
        }
        if(!self.memory.stagePlacementMiscData.threshold) {
            self.memory.stagePlacementMiscData.threshold = 5
        }
        let threshold = self.memory.stagePlacementMiscData.threshold
        let spaceMap = PathFinder.CostMatrix.deserialize(self.memory.stagePlacementMiscData.spaceMap);
        let positions : RoomPosition[] = [];
        for(let x = 1; x < 49; x++) {
            for(let y = 1; y < 49; y++) {
                if(spaceMap.get(x,y) >= threshold && spaceMap.get(x,y) < 7) {
                    positions.push(new RoomPosition(x, y, self.memory.roomName))
                }
            }
        }
        if(positions.length == 0) {
            self.memory.stagePlacementMiscData.threshold--;
            return;
        }
        let ret = PathFinder.search(room.controller.pos, positions);
        // if it's too far away set our threshold a little lower and look again
        // next tick
        if(ret.path.length > 20 && self.memory.stagePlacementMiscData.threshold > 3) {
            self.memory.stagePlacementMiscData.threshold--;
            return;
        }
        FIXIT // need to deal with having a spawn already
        visualisePath(ret.path)
        let containerPos = ret.path.pop()
        let storagePos = ret.path.pop();
        self.finishedPlan.set(containerPos.x, containerPos.y, structureType.Container)
        self.finishedPlan.set(storagePos.x, storagePos.y, structureType.Storage);
        self.memory.containerPos = serializePosition(containerPos)
        self.memory.storagePos = serializePosition(storagePos);
        self.memory.planningState = 1;
    }
}