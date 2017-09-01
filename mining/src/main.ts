//role enumeration in order of priority roles should be sorted at creep creation
//types have collections of roles
var creepClass = require('creep');
var buildClass = require('build');

global.Version = 'Mining';

var oneTimePatchRunner = require('patchHarness');
var init = require('init');

//we should only ever run through oneTimePatch when we have to 
//re-build code(which happens on a commit)
oneTimePatchRunner();

module.exports.loop = function () {
    //Error.stackTraceLimit = Infinity;
    init();
    //run jobs
    _.forEach(global.jobs, function (job: JobClass, name: string) {
        try {
            job.execute();
        } catch (e) {
            console.log('job ' + name +' had the following error:');
            console.log(e.stack);
            debugger;
        }
    });
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
