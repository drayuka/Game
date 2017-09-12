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
    upgrade : upgradeControllerJob,
    spawn : spawnJob,
    harvest : harvestJob,
    logistics : logisticsJob,
    bootstrap : bootstrapJob,
    claim : claimJob,
    scout : scoutJob,
    reserve : reserveJob,
    roomworker : roomworkerJob,
    links : linksJob,
    protector : protectorJob,
    mining : miningJob,
    tower : towerJob
}

namespace NodeJS {
	export interface Global {
		Version: string,
		reservedRooms: string[],
		allRooms: string[],
		jobClasses: JobDefinitionList,
		creeps: CreepList,
		utils: typeof Utils,
		goal: typeof GoalClass
	}
}

interface CreepMemory {[name: string]: any}
interface FlagMemory {[name: string]: any}
interface SpawnMemory {[name: string]: any}
interface RoomMemory {[name: string]: any}