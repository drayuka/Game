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

//serialized room position [x,y, roomName]
interface roomPos {
	x: number, 
	y: number
	rn: string
};

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
    upgrade : typeof UpgradeControllerJob,
    spawn : typeof SpawnJob,
    harvest : typeof HarvestJob,
    logistics : typeof LogisticsJob,
    bootstrap : typeof BootstrapJob,
    claim : typeof ClaimJob,
    scout : typeof ScoutJob,
    reserve : typeof ReserveJob,
    roomworker : typeof RoomworkerJob,
    links : typeof LinkJob,
    protector : typeof ProtectorJob,
    tower : typeof TowerJob
}

namespace NodeJS {
	export interface Global {
		Version: string,
		reservedRooms: string[],
		allRooms: string[],
		jobClasses: JobDefinitionList,
		bootstrap: BootstrapJob,
		spawn: SpawnJob,
		scout: ScoutJob,
		creeps: CreepList,
		utils: typeof Utils,
		goal: typeof GoalClass,
		username: string,
		memory: any
	}
}

interface CreepMemory {[name: string]: any}
interface FlagMemory {[name: string]: any}
interface SpawnMemory {[name: string]: any}
interface RoomMemory {[name: string]: any}