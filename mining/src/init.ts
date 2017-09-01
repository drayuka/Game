interface JobDefinitionList {
    [key: string]: JobClass;
}

const jobs: JobDefinitionList = {
    upgrade: require('job.upgradeController'),
    spawn: require('job.spawn'),
    harvest: require('job.harvest'),
    logistics: require('job.logistics'),
    bootstrap: require('job.bootstrap'),
    claim: require('job.claim'),
    scout: require('job.scout'),
    reserve: require('job.reserve'),
    roomworker: require('job.roomworker'),
    evacuator: require('job.evacuator'),
    links: require('job.links'),
    protector: require('job.protector'),
    mining: require('job.mining'),
    tower: require('job.tower')
}
global.utils = require('utils');
global.goal = require('goal');


var initializeSimRoom = function () {
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
    var creepObjs = _.map(Game.creeps, function (creep) {
        try {
            var newCreep = new creepClass(creep);
            newCreep.maintain();
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

    if(!global.jobs) {
        global.jobs = {};
    }
    for (var jobName of jobs) {
        try {
            var job = jobs[jobName];
            global.jobs[jobName] = new job(jobName);
        } catch (e) {
            console.log('had the following error when instatiating the following job: ' + jobName);
            console.log(e.stack);
            debugger;
        }
    }
    var builds = _.map(Memory.builds, function (meta, id) {
        try {
            var build = new buildClass(id, meta);
            build.maintainBuild();
            return build;
        } catch (e) {
            console.log('had the following error when checking on builds:');
            console.log(e.stack);
            debugger;
        }
    });
    global.builds = _.indexBy(builds, function (build) {
        return build.id;
    });
    if(Game.rooms['sim']) {
        initializeSimRoom();
    }
};