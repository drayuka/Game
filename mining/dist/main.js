//role enumeration in order of priority roles should be sorted at creep creation
//types have collections of roles
var jobs = {
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
    mining: require('job.mining')
};
var creepClass = require('creep');
var buildClass = require('build');
var oneTimePatch = function () {
    if (Game.rooms['sim']) {
        return;
    }
    if (!Memory.patch) {
        Memory.patch = [];
    }
    if (!Memory.patch[2]) {
        _.forEach(Memory.jobs, function (job) {
            _.forEach(job.goals, function (goals, roomName) {
                _.forEach(goals, function (meta, goalId) {
                    if (meta.positions) {
                        delete meta.positions;
                    }
                });
            });
        });
        Memory.patch[2] = 1;
    }
    if (!Memory.patch[3]) {
        _.forEach(Game.creeps, function (creep) {
            creep.suicide();
        });
        _.forEach(Memory.jobs, function (job) {
            _.forEach(job.goals, function (goals, roomName) {
                _.forEach(goals, function (meta, goalId) {
                    meta.assignments = [];
                    delete meta.positions;
                });
            });
            job.creeps = [];
        });
        Memory.creeps = {};
        Memory.patch[3] = 1;
    }
    if (!Memory.patch[4]) {
        _.forEach(Memory.jobs.roomworker.goals, function (goals, roomName) {
            goals = _.filter(goals, function (meta, goalId) {
                var obj = Game.getObjectById(goalId);
                if (!_.includes(['E36S11', 'E36S12', 'E37S11', 'E37S12'], roomName) && obj.structureType != STRUCTURE_ROAD) {
                    return 0;
                }
                return 1;
            });
        });
        Memory.patch[4] = 1;
    }
    if (!Memory.patch[5]) {
        Memory.jobs.scout.observers = [];
        Memory.patch[5] = 1;
    }
    if (!Memory.patch[6]) {
        _.forEach(Memory.jobs.logistics.goals, function (goals, roomName) {
            _.forEach(goals, function (meta) {
                delete meta.storage;
            });
        });
        Memory.patch[6] = 1;
    }
    if (!Memory.patch[7]) {
        _.forEach(Memory.jobs, function (job) {
            _.forEach(job.goals, function (goals, roomName) {
                if (!Game.rooms[roomName]) {
                    return false;
                }
                _.forEach(goals, function (meta, goalId) {
                    var obj = Game.getObjectById(goalId);
                    if (!obj || (obj.isActive && !obj.isActive())) {
                        delete goals[goalId];
                        _.forEach(obj.assignments, function (creepName) {
                            delete Memory.creeps[creepName].goal;
                        });
                    }
                });
            });
        });
        Memory.jobs.spawn.requisitions = {};
        Memory.patch[7] = 1;
    }
};
var initializeSimRoom = function () {
    if (_.keys(Game.creeps).length == 1) {
        var firstCreep = Game.creeps[_.keys(Game.creeps)[0]];
        if (!firstCreep.memory.jobName && global.jobs.roomworker.memory.roomAssignments && global.jobs.roomworker.memory.roomAssignments['sim']) {
            firstCreep.memory.goal = 'sim';
            global.jobs.roomworker.addCreep(firstCreep.name);
        }
    }
};
var initialize = function () {
    if (!Memory.jobs) {
        Memory.jobs = {};
    }
    if (!Memory.rooms) {
        Memory.rooms = {};
    }
    if (!Memory.jobs || typeof Memory.jobs != 'object') {
        Memory.jobs = {};
    }
    if (Game.rooms['sim']) {
        Memory.claimedRooms = ['sim'];
        global.reservedRooms = [];
    }
    else {
        //claimed rooms are upgraded and mined
        Memory.claimedRooms = ['E36S11', 'E36S12', 'E37S11', 'E37S12', 'E34S12'];
        //reserved rooms are reserved by a claim creep and mined
        Memory.reservedRooms = ['E35S11', 'E36S13', 'E37S13', 'E35S12', 'E38S13', 'E34S13'];
    }
    global.myRooms = _.map(_.filter(Game.rooms, function (room) {
        if (room.controller.my) {
            return 1;
        }
        return 0;
    }), function (room) {
        return room.name;
    });
    global.targetedRooms = _.union(global.claimedRooms, global.reservedRooms);
    global.visibleRooms = _.map(Game.rooms, function (room) {
        return room.name;
    });
    global.workRooms = _.intersection(global.targetedRooms, global.visibleRooms);
    global.allRooms = _.union(visibleRooms, global.workRooms);
    global.rooms = {};
    for (var roomNameIndex in global.allRooms) {
        var roomName = global.allRooms[roomNameIndex];
        global.rooms[roomName] = {};
        if (!Memory.rooms[roomName]) {
            Memory.rooms[roomName] = {
                exitTo: {}
            };
        }
    }
    for (var roomNameIndex in global.workRooms) {
        if (!Game.rooms[global.workRooms[roomNameIndex]]) {
            global.workRooms.splice(roomNameIndex, 1);
        }
    }
    var creepObjs = _.map(Game.creeps, function (creep) {
        try {
            var newCreep = new creepClass(creep);
            newCreep.maintain();
            return newCreep;
        }
        catch (e) {
            console.log('had the following error when spinning up creeps:');
            console.log(e.stack);
            debugger;
        }
    });
    global.creeps = _.indexBy(creepObjs, function (creepobj) {
        return creepobj.name;
    });
    if (!global.jobs) {
        global.jobs = {};
    }
    _.forEach(jobs, function (job, jobName) {
        try {
            global.jobs[jobName] = new job(jobName);
        }
        catch (e) {
            console.log('had the following error when instatiating the following job: ' + jobName);
            console.log(e.stack);
            debugger;
        }
    });
    var builds = _.map(Memory.builds, function (meta, id) {
        try {
            var build = new buildClass(id, meta);
            build.maintainBuild();
            return build;
        }
        catch (e) {
            console.log('had the following error when checking on builds:');
            console.log(e.stack);
            debugger;
        }
    });
    global.builds = _.indexBy(builds, function (build) {
        return build.id;
    });
    if (Game.rooms['sim']) {
        initializeSimRoom();
    }
};
module.exports.loop = function () {
    //Error.stackTraceLimit = Infinity;
    oneTimePatch();
    initialize();
    // run market
    if (false && Game.time % 1200 == 0) {
        var orders = Game.market.getAllOrders({ type: ORDER_BUY, resourceType: RESOURCE_ENERGY });
        orders = _.sortBy(orders, function (order) {
            var orderAmount = Math.min(order.remainingAmount, Game.rooms['E36S11'].terminal.store[RESOURCE_ENERGY]);
            var cost = Game.market.calcTransactionCost(orderAmount, 'E36S11', order.roomName);
            var totalAmount = orderAmount + cost;
            return (order.price * orderAmount) / totalAmount;
        });
        orders = _.filter(orders, function (order) {
            if (order.remainingAmount < 1000) {
                return 0;
            }
            return 1;
        });
        orders = orders.reverse();
        if (Game.market.calcTransactionCost(1000, 'E36S11', orders[0].roomName) + 1000 < Game.rooms['E36S11'].terminal.store[RESOURCE_ENERGY]) {
            var result = Game.market.deal(orders[0].id, 1000, 'E36S11');
        }
    }
    // run towers
    _.forEach(Game.rooms, function (room) {
        var enemyCreeps = room.find(FIND_CREEPS, { filter: function (creep) {
                if (!creep.my) {
                    return 1;
                }
                return 0;
            } });
        if (enemyCreeps.length == 0) {
            return true;
        }
        var towers = room.find(FIND_MY_STRUCTURES, { filter: function (struct) {
                if (struct.structureType == STRUCTURE_TOWER) {
                    return 1;
                }
                return 0;
            } });
        if (towers.length == 0) {
            return true;
        }
        _.forEach(towers, function (tower) {
            tower.attack(enemyCreeps[0]);
        });
    });
    //run jobs
    _.forEach(global.jobs, function (job, name) {
        try {
            job.execute();
        }
        catch (e) {
            console.log('job ' + name + ' had the following error:');
            console.log(e.stack);
            debugger;
        }
    });
    _.forEach(Memory.creeps, function (creep, name) {
        if (!Game.creeps[name]) {
            delete Memory.creeps[name];
        }
    });
    delete Memory.roomCosts;
    if (Memory.cleanup) {
        Memory.cleanup = 0;
    }
};
