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
import { CreepList } from "./init"
import { JobClass } from "./job"
import * as _ from "lodash"

declare global {
	namespace NodeJS {
		export interface Global {
			Version: string,
			reservedRooms: string[],
			allRooms: string[],
			jobClasses: JobDefinitionList,
			bootstrap: Bootstrap,
			spawn: SpawnJob,
			scout: ScoutJob,
			creeps: CreepList,
			username: string,
			memory: any,
			requestSegments: number[]
		}
	}

	interface JobDefinitionList {
		[key: string]: typeof JobClass
	}

	interface JobDefinitionList {
    upgrade : typeof UpgradeJob,
    spawn : typeof SpawnJob,
    harvest : typeof HarvestJob,
    logistics : typeof LogisticsJob,
    claim : typeof ClaimJob,
    scout : typeof ScoutJob,
    reserve : typeof ReserveJob,
    roomworker : typeof RoomworkerJob,
    links : typeof LinkJob,
    protector : typeof ProtectorJob,
    tower : typeof TowerJob,
    loader : typeof LoaderJob,
    initial : typeof InitialRoomJob
	}
	interface CreepMemory {[name: string]: any}
	interface FlagMemory {[name: string]: any}
	interface SpawnMemory {[name: string]: any}
	interface RoomMemory {[name: string]: any}
	interface Memory { [key: string]: any }
}
