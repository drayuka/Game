
import * as _ from "lodash";
import { myMemory, myMemorySegments } from "./os"


type Patch = (myMemory, myMemorySegments) => void;

interface Patches {
	[id: string]: Patch
}


var patches : Patches = {
};

export var oneTimePatch = function(memory: myMemory, memorySegments: myMemorySegments) {
	if(Game.rooms['sim']) {
		return;
	}
	var patched = false;

	_.forEach(patches, function (patch: Patch, patchId: string) {
		if(_.get(memory, 'patch.' + patchId + 'ran', false)) {
			return true;
		}
		patched = true;
		patch(memory, memorySegments);
		_.set(memory, 'patch.' + patchId + '.ran', true)
	});
	return patched;
}
