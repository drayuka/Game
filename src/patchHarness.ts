interface Patches {
	[key: string]: Patch
}

interface Patch {
	patch: () => void,
	version: string,
	postInit?: boolean
}

var patches : Patches = {
	wipePatch: {
		patch: function () {
			delete Memory.patch;
		},
		version: 'Mining'
	},
	killAllCreeps: {
		patch: function () {
			_.forEach(Game.creeps, function (creep) {
				creep.suicide();
			});
			delete Memory.creeps;
			
		},
		version: 'Mining'
	},
	wipeMemory: {
		patch: function () {
			_.forEach(Memory, function (item, name) {
				delete Memory[name];
			})
			Memory.flags = {};
		},
		version: 'Mining'
	}
};

var oneTimePatch = function(postInit : boolean) {
	if(Game.rooms['sim']) {
		return;
	}
	if(!Memory.patchHarness) {
		Memory.patchHarness = {};
	}
	if(!Memory.patchHarness[global.Version]) {
		Memory.patchHarness = {};
		Memory.patchHarness[global.Version] = {};
	}
	var currentPatches = Memory.patchHarness[global.Version];

	_.forEach(patches, function (patch: Patch, patchName: string) {
		if(currentPatches[patchName].ran) {
			return true;
		}
		if(patch.postInit != postInit) {
			return true;
		}
		if(patch.version != global.Version) {
			console.log('current version' + global.Version + ' does not match patch version: ' + patch.version);
			return true;
		}
		patch.patch();
		currentPatches[patchName].ran = true;
	});
}

module.exports = oneTimePatch;
