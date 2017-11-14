
global.jobClasses = {
    upgrade: <UpgradeJob>require('job.upgradeController'),
    spawn: <SpawnJob>require('job.spawn'),
    harvest: <HarvestJob>require('job.harvest'),
    logistics: <LogisticsJob>require('job.logistics'),
    bootstrap: <BootstrapJob>require('job.bootstrap'),
    claim: <ClaimJob>require('job.claim'),
    scout: <ScoutJob>require('job.scout'),
    reserve: <ReserveJob>require('job.reserve'),
    roomworker: <RoomworkerJob>require('job.roomworker'),
    links: <LinkJob>require('job.links'),
    protector: <ProtectorJob>require('job.protector'),
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
    global.creeps = _.indexBy(creepObjs, function (creepobj: Creep) {
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
    try {
        global.spawn = new global.jobClasses.spawn();
    } catch (e) {
        console.log('had the following error when instantiating spawn');
        console.log(e.stack);
        debugger;
    }
};

module.exports = initialize;