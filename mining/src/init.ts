
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

var initialize = function () {
    if(!Memory.jobs) {
        Memory.jobs = {};
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
        creepobj.maintain();
    });
    if(!global.bootstrap) {
        try {
            global.bootstrap = new global.jobClasses.bootstrap();
        } catch (e) {
            console.log('had the following error when instantiating bootstrap');
            console.log(e.stack);
            debugger; 
        }
    }
};