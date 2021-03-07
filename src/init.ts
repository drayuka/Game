
import { UpgradeJob } from "./job.upgrade";
import { SpawnJob } from "./job.spawn";
import { HarvestJob } from "./job.harvest"
import { LogisticsJob } from "./job.logistics"
import { Bootstrap } from "./bootstrap"
import { ClaimJob } from "./job.claim"
import { ScoutJob } from "./job.scout"
import { ReserveJob } from "./job.reserve"
import { RoomworkerJob } from "./job.roomworker"
import { LinkJob } from "./job.links"
import { ProtectorJob } from "./job.protector"
import { TowerJob } from "./job.tower"
import { LoaderJob } from "./job.loader"
import { InitialRoomJob } from "./job.initial"

import { GoalClass } from "./goal";
import { JobClass } from "./job";
import { CreepClass } from "./creep";
import * as _ from "lodash"


interface oldCreepList {
    [key: string]: Creep
}
export interface CreepList {
    [key: string]: CreepClass
}
export interface GoalList {
    [key: string]: GoalClass
}

global.jobClasses = {
    upgrade: UpgradeJob,
    spawn: SpawnJob,
    harvest: HarvestJob,
    logistics: LogisticsJob,
    claim: ClaimJob,
    scout: ScoutJob,
    reserve: ReserveJob,
    roomworker: RoomworkerJob,
    links: LinkJob,
    protector: ProtectorJob,
    tower: TowerJob,
    loader: LoaderJob,
    initial: InitialRoomJob
}
global.username = 'shockfist';

export var init = function () {
    if(!global.requestSegments) {
        global.requestSegments = [];
    }

    if(!global.memory || JSON.stringify(global.memory) != RawMemory.get()) {
        global.memory = JSON.parse(RawMemory.get())
        console.log('had to parse memory');
    }
    if(!global.memory.jobs) {
        global.memory.jobs = {};
    }
    var creepObjs = <CreepClass[]>_.filter(_.map(Game.creeps, function (creep : Creep) {
        try {
            var newCreep = new CreepClass(creep);
            return newCreep;
        } catch (e) {
            console.log('had the following error when spinning up creeps:');
            console.log(e.stack);
            debugger;
        }
    }), function (creep: CreepClass | undefined) {
        return typeof creep != 'undefined';
    });
    global.creeps = _.indexBy(creepObjs, function (creepobj: CreepClass) {
        return creepobj.name;
    });

    // maintain the creeps
    _.forEach(global.creeps, function (creepobj : CreepClass) {
        creepobj.maintain();
    });
    try {
        global.spawn = new global.jobClasses.spawn();
    } catch (e) {
        console.log('had the following error when instantiating spawn');
        console.log(e.stack);
        debugger;
    }
    try {
        global.scout = new global.jobClasses.scout();
    } catch (e) {
        console.log('had the following error when instatiating scout');
        console.log(e.stack);
        debugger;
    }
    try {
        global.bootstrap = new Bootstrap();
    } catch (e) {
        console.log('had the following error when instantiating bootstrap');
        console.log(e.stack);
        debugger; 
    }
};