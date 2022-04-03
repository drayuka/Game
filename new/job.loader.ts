
var utils = require('utils');
import { JobClass, JobMemory } from "./job";
import { CreepClass } from "./creep";
import * as _ from "lodash"
import { Loader, OS } from "./os";
import { makeid } from "./utils";

interface LoaderJobMemory extends JobMemory {
	sitesInfo: {
		site: Id<StructureExtension | StructureSpawn | StructureLab | StructureTower | StructureNuker | StructurePowerSpawn | StructureFactory>
		need: ResourceConstant,
		rangeTo: number,
	}[]
	roomName: string,
}

export class LoaderJob extends JobClass {
	memory: LoaderJobMemory;
	static createNewLoaderJob(
		roomName: string,
		os: OS,
		parentJobId: string,
	) {
		let newMemory : LoaderJobMemory = {
			roomName: roomName,
			sitesInfo: [],
			id: makeid(),
			parentId: parentJobId,
			type: Loader,
			spawnJobs: [],
			creeps: [],
		}
		return os.addJob(newMemory.id, newMemory);
	}
	finished() {
		return false;
	}
	finishedForNow() {
		let self = this;
		let room = Game.rooms[self.memory.roomName]
		if(room.energyCapacityAvailable == room.energyAvailable) {
			return !_.find(self.creeps, (creep) =>!self.creepShelved(creep))
		}
		return false;
	}
	priority(): number {
		return 2;
	}
	execute () {
		var self = this;
		if(self.memory.spawnJobs.length != 0) {
			self.claimSpawnedCreeps();
		}

		if(!self.hasEnoughCap()) {
			self.spawnCreep()
		}

		_.forEach(self.creeps, (creep) => {

		})

		FIXIT
	}
}