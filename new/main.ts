//role enumeration in order of priority roles should be sorted at creep creation
//types have collections of roles

global.Version = 'Mining';

import { oneTimePatch } from "./patchHarness";
import { init, finish } from "./init"
import { OS,  myMemory, myMemorySegments} from "./os";
import { bootstrap } from "./bootstrap";

//we should only ever run through oneTimePatch when we have to 
//re-build code(which happens on a commit)
export interface global {
	Version: string,
	username: string,
	memory?: myMemory,
	memorySegments?: myMemorySegments,
    ranFinish: boolean
}
var global : global = {
    Version: 'Whackadoodle',
    username: 'shockfist',
    ranFinish: true,
};

module.exports.loop = function () {
    try {
        init(global);
        global.ranFinish = false;
        //skip a tick if we patched memory.
        if(!oneTimePatch(global.memory, global.memorySegments)) {
            var Ops = new OS(global.memory, global.memorySegments)
            Ops.init();
            if(Ops.needsBootstrap()) {
                bootstrap(Ops);
            } else {
                Ops.init();
                Ops.run();
            }
        }
    } catch(e) {
        console.log('main had the following error:');
        console.log(e.stack);
        debugger;
    } finally {
        finish(global);
    }
};
