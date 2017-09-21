//role enumeration in order of priority roles should be sorted at creep creation
//types have collections of roles

global.Version = 'Mining';

var oneTimePatchRunner = require('patchHarness');
var init = require('init');

//we should only ever run through oneTimePatch when we have to 
//re-build code(which happens on a commit)
try {
    oneTimePatchRunner(false);
} catch (e) {
    console.log('one time patch runner pre init had the following error: ');
    console.log(e.stack);
    debugger;
}

module.exports.loop = function () {
    //Error.stackTraceLimit = Infinity;
    try {
        init();
    } catch(e) {
        console.log('init had the following error:');
        console.log(e.stack);
        debugger;
    }
    try {
        oneTimePatchRunner(true);
    } catch(e) {
        console.log('one time patch runner post init had the following error: ');
        console.log(e.stack);
        debugger;
    }
    try{
        global.bootstrap.runRooms();
    } catch(e) {
        console.log('global bootstrap job had the following error: ');
        console.log(e.stack);
        debugger;
    }
    _.forEach(Memory.creeps, function (creep: any ,name: string) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
        }
    });
    delete Memory.roomCosts;
    if (Memory.cleanup) {
        Memory.cleanup = 0;
    }
};
