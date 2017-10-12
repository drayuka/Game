/*
	a pos with distance-from-pos information attached
*/
interface distancePos {
	pos: RoomPosition,
	range: number
}

function isDistancePos(pos: distancePos | rangePos)	: pos is distancePos {
	return (typeof (<distancePos>pos).range) !== undefined;
}

/*
	a pos with range-from-pos information attached
*/
interface rangePos {
	pos: RoomPosition,
	minRange: number,
	maxRange: number
}

interface openPositionsOptions {
	noRoads: boolean,
	noHaltingCreeps: boolean
}

interface oldCreepList {
	[key: string]: Creep
}
interface JobList {
	[key: string]: JobClass
}
interface CreepList {
	[key: string]: CreepClass
}
interface GoalList {
	[key: string]: GoalClass
}

interface JobDefinitionList {
    upgrade : typeof upgradeControllerJob,
    spawn : typeof spawnJob,
    harvest : typeof harvestJob,
    logistics : typeof ogisticsJob,
    bootstrap : typeof bootstrapJob,
    claim : typeof claimJob,
    scout : typeof scoutJob,
    reserve : typeof reserveJob,
    roomworker : typeof roomworkerJob,
    links : typeof linksJob,
    protector : typeof protectorJob,
    mining : typeof miningJob,
    tower : typeof towerJob
}

namespace NodeJS {
	export interface Global {
		Version: string,
		reservedRooms: string[],
		allRooms: string[],
		jobClasses: JobDefinitionList,
		bootstrap: bootstrapJob,
		creeps: CreepList,
		utils: typeof Utils,
		goal: typeof GoalClass,
		username: string
	}
}

interface CreepMemory {[name: string]: any}
interface FlagMemory {[name: string]: any}
interface SpawnMemory {[name: string]: any}
interface RoomMemory {[name: string]: any}