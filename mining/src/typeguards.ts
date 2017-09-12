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
interface BuildList {
	[key: string]: BuildClass
}
interface GoalList {
	[key: string]: GoalClass
}
namespace NodeJS {
	export interface Global {
		Version: string,
		reservedRooms: string[],
		allRooms: string[],
		jobs: JobList,
		creeps: CreepList,
		builds: BuildList
		utils: typeof Utils,
		goal: typeof GoalClass
	}
}

interface CreepMemory {[name: string]: any}
interface FlagMemory {[name: string]: any}
interface SpawnMemory {[name: string]: any}
interface RoomMemory {[name: string]: any}