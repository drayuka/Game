
global.jobClasses = {
    upgrade: <typeof UpgradeJob>require('job.upgradeController'),
    spawn: <typeof SpawnJob>require('job.spawn'),
    harvest: <typeof HarvestJob>require('job.harvest'),
    logistics: <typeof LogisticsJob>require('job.logistics'),
    bootstrap: <typeof BootstrapJob>require('job.bootstrap'),
    claim: <typeof ClaimJob>require('job.claim'),
    scout: <typeof ScoutJob>require('job.scout'),
    reserve: <typeof ReserveJob>require('job.reserve'),
    roomworker: <typeof RoomworkerJob>require('job.roomworker'),
    links: <typeof LinkJob>require('job.links'),
    protector: <typeof ProtectorJob>require('job.protector'),
    tower: <typeof TowerJob>require('job.tower')
}
global.utils = require('utils');
global.goal = require('goal');
global.username = 'shockfist';

var initialize = function () {
    if(!global.memory || JSON.stringify(global.memory) != RawMemory.get()) {
        global.memory = JSON.parse(RawMemory.get())
        console.log('had to parse memory');
    }
    if(!global.memory.jobs) {
        global.memory.jobs = {};
    }
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
    global.creeps = _.indexBy(creepObjs, function (creepobj: Creep) {
        return creepobj.name;
    });

    // maintain the creeps
    _.forEach(global.creeps, function (creepobj) {
        creepobj.maintain();
    });
    try {
        global.spawn = new global.jobClasses.spawn();
    } catch (e) {
        console.log('had the following error when instantiating spawn');
        console.log(e.stack);
        debugger;
    }
    try {
        global.scout = new global.jobClasses.scout();
    } catch (e) {
        console.log('had the following error when instatiating scout');
        console.log(e.stack);
        debugger;
    }
    try {
        global.bootstrap = new global.jobClasses.bootstrap();
    } catch (e) {
        console.log('had the following error when instantiating bootstrap');
        console.log(e.stack);
        debugger; 
    }


};

module.exports = initialize;