
global.jobClasses = {
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
global.username = 'shockfist';

var initialize = function () {
    if(!Memory.jobs) {
        Memory.jobs = {};
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
    global.creeps = _.indexBy(creepObjs, function (creepobj) {
        return creepobj.name;
    });

    // maintain the creeps
    _.forEach(global.creeps, function (creepobj) {
        creepobj.maintain();
    });
    try {
        global.bootstrap = new global.jobClasses.bootstrap();
    } catch (e) {
        console.log('had the following error when instantiating bootstrap');
        console.log(e.stack);
        debugger; 
    }
};