
var jobs: JobDefinitionList = {
    upgrade: require('job.upgradeController'),
    spawn: <spawnJob>require('job.spawn'),
    harvest: require('job.harvest'),
    logistics: require('job.logistics'),
    bootstrap: <bootstrapJob>require('job.bootstrap'),
    claim: require('job.claim'),
    scout: require('job.scout'),
    reserve: require('job.reserve'),
    roomworker: require('job.roomworker'),
    links: require('job.links'),
    protector: <protectorJob>require('job.protector'),
    mining: require('job.mining'),
    tower: <towerJob>require('job.tower')
}
global.utils = require('utils');
global.goal = require('goal');


var initializeSimRoom = function () {
    console.log('cant initalize sim room');
    return;
    if(_.keys(Game.creeps).length == 1) {
        var firstCreep = Game.creeps[_.keys(Game.creeps)[0]];
        if(!firstCreep.memory.jobName && global.jobs.roomworker.memory.roomAssignments && global.jobs.roomworker.memory.roomAssignments['sim']) {
            firstCreep.memory.goal = 'sim'; 
            global.jobs.roomworker.addCreep(firstCreep.name);
        }
    }
}

var initialize = function () {
    if(!Memory.jobs) {
        Memory.jobs = {};
    }
    if (!Memory.rooms) {
        Memory.rooms = {};
    }
    if(!Memory.jobs || typeof Memory.jobs != 'object') {
        Memory.jobs = {};
    }
    if(Game.rooms['sim'] !== undefined && Game.rooms['sim'].controller !== undefined) {
        Memory.rooms['sim'] = {
            status: 'claimed',
            roomLevel: Game.rooms['sim'].controller.level
        };
    }
    // if we haven't created our new creep objects, create them, otherwise, do not.
    if(!global.creeps) {
        var creepObjs = _.map(Game.creeps, function (creep) {
            try {
                var newCreep = new CreepClass(creep);
                return newCreep;
            } catch (e) {
                console.log('had the following error when spinning up creeps:');
                console.log(e.stack);
                debugger;        
            }
        });
        global.creeps = _.indexBy(creepObjs, function (creepobj) {
            return creepobj.name;
        });
    }
    // maintain the creeps
    _.forEach(global.creeps, function (creepobj) {
        creepobj.maintain;
    })
    
    if(!global.jobs) {
        global.jobs = {};
    }
    for (var jobName of global.jobClasses) {
        try {
            var job = global.jobClasses[jobName];
            global.jobs[jobName] = new job(jobName);
        } catch (e) {
            console.log('had the following error when instatiating the following job: ' + jobName);
            console.log(e.stack);
            debugger;
        }
    }
    if(Game.rooms['sim']) {
        initializeSimRoom();
    }
};