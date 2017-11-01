/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('job.upgradeController');
 * mod.thing == 'a thing'; // true
 */
var partPriority = {
    tough: 1,
    work: 2,
    attack: 3,
    move: 4,
    carry: 5,
    ranged_attack: 6,
    claim: 7,
    heal: 8
};

var jobPriority : jobPriorities = {
    roomworker: 1,
    harvest: 2,
    logistics: 3,
    default: 4,
}

interface jobPriorities {
    [key: string] : number
}

interface creepType {
    powerPart: BodyPartConstant,
    parts: BodyPartConstant[],
    required_parts?: BodyPartConstant[]
}
interface roomSpawnInfo {
    roomName?: string,
    distance: number,
    spawns: StructureSpawn[],
    capacityAvailable: number,
    energyAvailable?: number
}

interface spawnsForRoom { 
    [key: string]: roomSpawnInfo
}

interface RoomSpawnCache {
    [key: string]: spawnsForRoom
}

interface StartedSpawning {
    [key: string]: boolean
}

interface CurrentCost {
    [key: string]: number
}

interface jobRequisitions {
    [key: string] : goalRequistions
}
interface goalRequistions {
    [key: string] : {
        typeName: string,
        power: number,
        memory: any
    }
}
interface collapsedRequisition {
    typeName: string,
    power: number,
    memory: any,
    additionalInformation: {
        jobName: string,
        priority: number,
        goalId: string,
        roomName: string   
    }
}

interface creepDescription {
    power: number,
    type: string,
    memory: any,
    id: any,
    jobName: string,
    parentClaim: string,
    waitingSince: number,
    newClaim: string | undefined
}


    // {
        //ROOM_NAME: {
            //distance: DISTANCE,
            //spawns: [SPAWN_ID_1, SPAWN_ID_2],
            //capacityAvailable: ENERGY_CAPACITY_AVAILABLE
            //energyAvailable: ENERGY_CURRENTLY_AVAILABLE
        //}
    //}}

var creepTypes : {[key: string]: creepType} = {
    roomworker: {
        powerPart: 'work',
        parts: [
            'work',
            'carry',
            'carry',
            'carry',
            'move',
            'move'
        ]
    },
    warrior: {
        powerPart: 'attack',
        parts: [
            'attack',
            'attack',
            'attack',
            'attack',
            'ranged_attack',
            'move',
            'move',
            'move',
            'move',
            'move'
        ]
    },
    heavyworker: {
        required_parts: [
            'carry',
            'carry'
        ],
        powerPart: 'work',
        parts: [
            'work',
            'work',
            'move'
        ]
    },
    scout: {
        powerPart: 'move',
        parts: [
            'move'
        ]
    },
    claim: {
        powerPart: 'claim',
        parts: [
            'claim',
            'move'
        ]
    },
    worker: {
        powerPart: 'work',
        parts: [
            'work',
            'carry',
            'move'
        ]
    },
    transporter: {
        powerPart: 'carry',
        parts: [
            'move',
            'carry',
            'carry'
        ]
    }
};
//this is a job for ease of use, it doesn't really make sense for spawn to have goals;
class spawnJob extends JobClass {
    execute() {
        var self = this;
        self.updateSpawns();
        self.giveCreeps();
        self.spawnCreeps();
    }
    get roomSpawnCache() : RoomSpawnCache {
        var self = this;
        if(self._roomSpawnCache == undefined) {
            self._roomSpawnCache = {};
        }
        return self._roomSpawnCache;
    }
    get justStartedSpawning() : StartedSpawning {
        var self = this;
        if(self._justStartedSpawning == undefined) {
            self._justStartedSpawning = {};
            return self._justStartedSpawning;
        }
        return self._justStartedSpawning;
    }
    get currentCost() : CurrentCost {
        var self = this;
        if(self._currentCost == undefined) {
            self._currentCost = {};
            return self._currentCost;
        }
        return self._currentCost;
    }
    _roomSpawnCache : RoomSpawnCache | undefined;
    _justStartedSpawning: StartedSpawning | undefined;
    _currentCost: CurrentCost | undefined;
    // should be called by other jobs on this job.
    // stores requisitions in the following format
    // self.memory.requisitions = {
        //jobname: {
            //GOAL_ID: {
                //typeName: TYPE_NAME,
                //power: POWER,
                //memory: MEMORY,
            //}
        //}
    //}
    _requisitions : jobRequisitions | undefined;
    get requisitions () {
        var self = this;
        if(self._requisitions == undefined) {
            self._requisitions = self.memory.requisitions;
            return self.memory.requisitions;
        } else {
            return self._requisitions;
        }
    }
    addRequisition(creepDescriptions: creepDescription[]) {
        var self = this;
        if(!self.memory.requisitions) {
            self.memory.requisitions = {};
        }
        var found = 0;

        _.forEach(creepDescriptions, function (creepDesc: creepDescription) {
            var parentClaim = creepDesc.parentClaim;
            var jobName = creepDesc.jobName;
            var jobRequisitions = self.memory.requisitions[parentClaim][jobName];
            if(!self.requisitions[parentClaim]) {
                self.requisitions[parentClaim] = {};
            }
            if(!self.requisitions[parentClaim][jobName]) {
                self.requisitions[parentClaim][jobName] = {};
            }
            var curRequisition = jobRequisitions[creepDesc.id];
            if(curRequisition && curRequisition.power != creepDesc.power) {
                if(creepDesc.power > 0) {
                    curRequisition.power = creepDesc.power;        
                } else {
                    delete jobRequisitions[creepDesc.id];
                    return;
                }
            } else if(!curRequisition) {
                jobRequisitions[creepDesc.id] = creepDesc;
            }
        });
    }
    removeRequisition(jobName: string, parentClaim: string, goalId: string) {
        var self = this;
        if(!self.memory.requisitions) {
            return;
        }
        if(!self.memory.requisitions[parentClaim]) {
            return;
        }
        if(!self.memory.requisitions[parentClaim][jobName]) {
            return;
        }
        delete self.memory.requisitions[parentClaim][jobName][goalId];
    }
    giveCreeps() {
        var self = this;
        var spawnedCreeps : CreepClass[] = _.filter(self.creeps, function (creep) {
            return !creep.spawning
        });
        _.forEach(spawnedCreeps, function (creep) {
            var jobName = creep.memory.destinationJobName;
            var parentClaim = creep.memory.parentClaim;
            var id = creep.memory.id;
            delete creep.memory.destinationJobName;
            delete creep.memory.parentClaim;
            self.removeCreep(creep.name);
            var creepType = creepTypes[creep.memory.type];
            var spawnedPower = creep.partCount(creepType.powerPart);
            global.bootstrap.claimedRooms[parentClaim].jobs[jobName].addCreep(creep.name);

            if(!self.memory.requisitions[parentClaim][jobName][id]) {
                return;
            }
            var remainingPower = self.memory.requisitions[parentClaim][jobName][id].power - spawnedPower;
            if(remainingPower <= 0) {
                delete self.memory.requisitions[parentClaim][jobName][id];
            } else {
                self.memory.requisitions[parentClaim][jobName][id].power = remainingPower;
            }
        });
    }
    updateSpawns() {
        var self = this;
        _.forEach(Game.spawns, function (spawn) {
            if (spawn.spawning && !self.creeps[spawn.spawning.name]) {
                var spawnedCreep = global.creeps[spawn.spawning.name];
                self.addCreep(spawnedCreep.name);
            }
        });
    }
    addCreep (creepName: string) {
        var self = this;
        var myCreep = global.creeps[creepName];
        if(!myCreep) {
            throw new Error('could not find creep to add ' + creepName);
        }
        self.memory.creeps.push(creepName);
        if(self._creeps) {
            self._creeps[creepName] = myCreep;
        }
        // add creep for spawn doesn't have any relationship to goals
    }
    maxPower(typeName: string) : number {
        var self = this;
        var maxPower = <number | undefined>_.get(self.memory, 'types.' + typeName + '.maxPower');
        if(maxPower != undefined) {
            return maxPower;
        }
        var creepType = creepTypes[typeName];
        var parts = creepType.required_parts ? _.cloneDeep(creepType.required_parts) : [];
        var cycleParts = creepType.parts;
        while (true) {
            if(parts.length + cycleParts.length > 50) {
                break;
            }
            parts.push(...cycleParts)
        }
        maxPower = _.reduce(parts, function (total, part) {
            if(part == creepType.powerPart) {
                return (total + 1);
            }
            return total;
        }, 0);
        _.set(self.memory, 'types.' + typeName + '.maxPower', maxPower);
        return maxPower;
    }
    costPerPower(typeName: string) {
        var self = this;
        var creepType = creepTypes[typeName];
        var parts = creepType.parts;
        var powerPerCycle = _.reduce(parts, function (total, part) {
            if(part == creepType.powerPart) {
                return total + 1;
            }
            return total;
        }, 0);
        var costPerCycle = _.reduce(parts, function (total, part) {
            return (total + BODYPART_COST[part]);
        }, 0);
        return (Math.ceil(powerPerCycle/costPerCycle));
    }
    powerForCost(typeName: string, cost: number) : number {
        var self = this;
        var creepType = creepTypes[typeName];
        var parts = creepType.parts;
        var availCost = cost - self.requiredCost(typeName);
        var powerPerCycle = _.reduce(parts, function (total, part) {
            if(part == creepType.powerPart) {
                return total +1;
            }
            return total;
        }, 0);
        var maxPower = self.maxPower(typeName);
        var costPerCycle = _.reduce(parts, function (total, part) {
            return (total + BODYPART_COST[part]);
        }, 0);
        var cycles = Math.floor(availCost / costPerCycle);
        return Math.min(maxPower, (cycles * powerPerCycle));
    }
    costForPower(typeName: string, power: number) : number {
        var self = this;
        var creepType = creepTypes[typeName];
        var minPower = self.minPower(typeName);
        if(power % minPower != 0) {
            power = power + (power % minPower);
        }
        var requiredCost = self.requiredCost(typeName);
        var parts = _.flatten(_.times((power/minPower), function () {
            return creepType.parts;
        }));
        return _.reduce(parts, function (total, part) {
            return (total + BODYPART_COST[part]);
        }, requiredCost);
    }
    minPower(typeName: string) : number {
        var self = this;
        var minPower = <number | undefined>_.get(self.memory, 'types.' + typeName + '.minPower');
        if(minPower != undefined) {
            return minPower;
        }
        var creepType = creepTypes[typeName];
        var parts = creepType.parts;
        minPower = _.reduce(parts, function (total, part) {
            if(part == creepType.powerPart) {
                return (total + 1);
            }
            return total;
        }, 0);
        _.set(self.memory, 'types.' + typeName + '.minPower', minPower);
        return minPower;
    }
    requiredCost(typeName : string) : number {
        var self = this;
        var creepType = creepTypes[typeName];
        if(creepType.required_parts !== undefined) {
            return _.reduce(creepType.required_parts, function (total: number, part: BodyPartConstant) {
                return (total + BODYPART_COST[part]);
            }, 0);    
        } else {
            return 0;
        }
        
    }
    spawn(spawn: StructureSpawn, creepDesc: creepDescription) {
        var self = this;
        var creepType = creepTypes[creepDesc.type];
        var power = creepDesc.power;
        var requiredParts = _.cloneDeep(creepType.required_parts);
        var minPower = self.minPower(creepDesc.type);
        if(power % minPower != 0) {
            power = power + (power % minPower);
        }
        var parts = _.flatten(_.times((power / minPower), function () {
            return creepType.parts;
        }));
        var finalParts = parts;
        if(requiredParts) {
            finalParts = _.flatten([requiredParts, parts]);
        }
        var sortedFinalParts = self.sortParts(finalParts);
        var memory = _.cloneDeep(creepDesc.memory);
        memory.type = creepDesc.type;
        memory.destinationJobName = creepDesc.jobName;
        memory.jobName = 'spawn';
        memory.goal = creepDesc.id;
        return spawn.createCreep(sortedFinalParts, undefined, memory);
    }
    sortParts(parts: BodyPartConstant[]) : BodyPartConstant[] {
        var self = this;
        return _.sortBy(parts, function (part) {
            return partPriority[part];
        });
    }
    // should return an object that answers the question: 
    // for a given room, which spawns should service it 
    // will only return rooms with spawns that are not currently spawning
    // this method is deep, and should be heavily cached;
    // should return the list as so:
    // {
        //ROOM_NAME: {
            //distance: DISTANCE,
            //spawns: [SPAWN_ID_1, SPAWN_ID_2],
            //capacityAvailable: ENERGY_CAPACITY_AVAILABLE
            //energyAvailable: ENERGY_CURRENTLY_AVAILABLE
        //}
    //}}

    getSpawnsForRoom(checkingRoomName: string, available: boolean) : roomSpawnInfo[] {
        var self = this;
        if(!self.roomSpawnCache[checkingRoomName]) {
            var spawnsByRoom = _.groupBy(Game.spawns, function (spawn) {
                return spawn.pos.roomName;
            });
            var rooms = utils.getRoomsAtRange(checkingRoomName, 3);
            
            var roomsByDistance : spawnsForRoom = {};
            _.forEach(rooms, function (distance: number, roomName: string) {
                if(!spawnsByRoom[roomName]) {
                    return true;
                }
                var spawnIds = _.map(spawnsByRoom[roomName], function (spawn) {
                    return spawn.id;
                });

                roomsByDistance[roomName] = {
                    distance: distance,
                    spawns: spawnsByRoom[roomName],
                    capacityAvailable: Game.rooms[roomName].energyCapacityAvailable,
                    roomName: undefined,
                    energyAvailable: undefined
                };
            });
            self.roomSpawnCache[checkingRoomName] = roomsByDistance;
        }
        var availableRooms: roomSpawnInfo[] = [];
        _.forEach(self.roomSpawnCache[checkingRoomName], function (room, roomName : string) {
            var availableSpawns = room.spawns;
            if(available) {
                availableSpawns = _.filter(availableSpawns, function (spawn) {
                    if(spawn.spawning) {
                        return 0;
                    }
                    if(self.justStartedSpawning[spawn.id]) {
                        return 0;
                    }
                    return 1;
                });
                if(availableSpawns.length == 0) {
                    return true;
                }
            }
            var currentCost = self.currentCost[roomName] ? self.currentCost[roomName] : 0;
            var capacityAvailable = room.capacityAvailable;
            var energyAvailable = Game.rooms[roomName].energyAvailable - currentCost;
            //////////
            /////// FIX ME
            ////////
            if(self.jobs.roomworker.memory.roomAssignments[roomName]) {
                var roomWorkers = self.jobs.roomworker.memory.roomAssignments[roomName].length;
                if(roomWorkers == 0) {
                    capacityAvailable = Math.max(energyAvailable, 300);
                }
            }
            availableRooms.push({
                roomName: roomName,
                distance: room.distance,
                spawns: availableSpawns,
                capacityAvailable: capacityAvailable,
                energyAvailable: Game.rooms[roomName].energyAvailable - currentCost
            });
        });
        return _.sortBy(availableRooms, function (room) {
            return room.distance;
        });
    }
    // this is used to allow a room to limit the size of 
    // the creeps it creates so that it creates
    // a limited number
    getMaxPowerForRoom(creepType: string, roomName: string) {
        var self = this;
        var spawns = self.getSpawnsForRoom(roomName, false);
        var maxCreepCost : number = _.max(spawns, function (room: roomSpawnInfo) {
            return room.capacityAvailable;
        }).capacityAvailable;
        return self.powerForCost(creepType, maxCreepCost);
    }
    findAvailableSpawns () {
        var self = this;
        return _.filter(Game.spawns, function (spawn) {
            if(spawn.spawning) {
                return 0;
            }
            return 1;
        });
    }
    findSpawnsInRoom (roomName: string) : StructureSpawn[] {
        var self = this;
        return _.filter(Game.spawns, function (spawn) {
            if(spawn.pos.roomName != roomName) {
                return false;
            }
            return true;
        });
    }
    spawnCreeps() {
        var self = this;
        _.forEach(self.memory.requisitions, function (jobReqs: any, parentClaim: string) {
            var parentClaimRoom = Game.rooms[parentClaim];
            // if we can't see the parent claim, something is screwed, stop spawning for it.
            if(!parentClaimRoom) {
                return true;
            }
            var availableEnergy = parentClaimRoom.energyAvailable;
            var capacityAvailable = parentClaimRoom.energyCapacityAvailable;
            var spawns = self.findSpawnsInRoom(parentClaim);
            var availableSpawns = _.filter(spawns, function (spawn) {
                if(spawn.spawning) {
                    return false;
                }
                return true;
            });

            _.forEach(_.sortBy(jobReqs, function (req, jobName) {
                return jobPriority[jobName];
            }), function (goalReqs) {
                _.forEach(goalReqs, function (creepDesc: creepDescription, id: string) {
                    // can't spawn right now
                    var couldntspawn = false;
                    if(!availableSpawns) {
                        couldntspawn = true;
                    }
                    var cost = self.costForPower(creepDesc.type, creepDesc.power);
                    // can never spawn in this room
                    if(cost > capacityAvailable) {
                        couldntspawn = true;
                    }
                    // can't spawn right now
                    if(availableEnergy < cost) {
                        couldntspawn = true;
                    }

                    var result = self.spawn(availableSpawns[0], creepDesc);
                    if(typeof result == 'string') {
                        availableEnergy -= cost;
                        availableSpawns.shift();
                    } else {
                        console.log('couldnt spawn ' + JSON.stringify(creepDesc) + ' got error: ' + result);
                        couldntspawn = true;
                    }
                    if(couldntspawn) {
                        self.checkMoveReq(creepDesc, spawns, availableEnergy, capacityAvailable);
                    }
                });
            });
        });
    }
    //check to see if we need to try to spawn this creep in another room
    checkMoveReq(creepDesc: creepDescription, spawns: StructureSpawn[], availEnergy: number, energyCap: number) {
        var self = this;
        var soonestAvailableSpawn = _.min(spawns, function (spawn: StructureSpawn) {
            if(spawn.spawning) {
                return spawn.spawning.remainingTime;
            } else {
                return 0;
            }
        });
        //we should be trying to distinguish a couple of things:
        // 1. that if the spawns in the 
        if(soonestAvailableSpawn < 50) {
            
        }
    }
    spawnCreeps() {
        var self = this;
        var availableSpawns = self.findAvailableSpawns();
        if(availableSpawns.length == 0) {
            return;
        }
        var requests = self.getDecoratedRequests();
        if(requests.length == 0) {
            return;
        }
        requests = _.sortBy(requests, function (req) {
            return req.additionalInformation.priority;
        });
        var roomRequests = _.groupBy(requests, function (req) {
            return req.additionalInformation.roomName;
        });
        // requests should be in priority order already so they should get spawned first
        _.forEach(roomRequests, function (reqs, roomName) {
            // if we are blocking spawning in this room due to other invader creeps being in it
            var rooms = self.getSpawnsForRoom(roomName, true);

            if(rooms.length == 0) {
                console.log('cant spawn in room ' + roomName + ' because there are no available spawns in range');
                return true;
            }
            var allRooms = self.getSpawnsForRoom(roomName, false);
            var maxCreepCost = _.max(allRooms, function (room) {
                return room.capacityAvailable;
            }).capacityAvailable;

            rooms = _.sortBy(rooms, function (room) {
                return room.distance;
            });

            _.forEach(reqs, function (req) {
                var maxPower = self.maxPower(req.typeName);
                var reqPower = req.power;
                if(req.power > maxPower) {
                    var fewestCreeps = Math.ceil(req.power/maxPower);
                    reqPower = Math.ceil(req.power/fewestCreeps);
                }
                var cost = self.costForPower(req.typeName, reqPower);
                var canCreate = 0;

                // no spawn that this room has access to can spawn a creep of the size desired
                // even though it isn't bigger than the largest creep you could spawn of this type
                if(cost > maxCreepCost) {
                    console.log('cant spawn a ' + req.typeName + ' of size ' + reqPower + ' for ' + req.additionalInformation.jobName);
                    var reqPower = self.powerForCost(req.typeName, maxCreepCost);
                    if(reqPower == 0) {
                        return true;
                    }
                    cost = self.costForPower(req.typeName, reqPower);
                }

                _.forEach(rooms, function (room) {
                    if(cost > room.energyAvailable) {
                        return true;
                    }
                    if(room.spawns.length == 0) {
                        return true;
                    }
                    var result = self.spawn(room.spawns[0], req.typeName, reqPower, req.additionalInformation.jobName, req.additionalInformation.goalId, req.memory);
                    if(typeof result == 'string') {
                        self.logSuccessfulSpawn(room.spawns[0], cost);
                        room.spawns.shift();
                        room.energyAvailable = room.energyAvailable - cost;
                        return false;
                    }
                    console.log('attempted to spawn and got error ' + result);
                });
            });
        });
    }
    // returns requisitions with already spawning creep powers deducted or removed, as appropriate
    // should return requisitions with the following structure:
    // [{
        //typeName: TYPE_NAME,
        //power: POWER,
        //memory: MEMORY,
        //additionalInformation: {
            //jobName: JOB_NAME,
            //priority: PRIORITY,
            //goalId: GOAL_ID,
            //roomName: ROOM_NAME
        //}
    //},...]
    getDecoratedRequests() : collapsedRequisition[] {
        var self = this;
        var spawningLookup = _.groupBy(self.creeps, function (creep) {
            return creep.memory.goal;
        });

        var uninitiatedSpawns : jobRequisitions = {};
        _.forEach(self.memory.requisitions, function (reqs, jobName) {
            var jobUnSpawn : goalRequistions = {};
            _.forEach(reqs, function (req, goalId) {
                var found = spawningLookup[goalId];
                var creepType = creepTypes[req.typeName];
                var spawningPower = _.reduce(found, function (total, creep) {
                    return total + creep.getActiveBodyparts(creepType.powerPart);
                }, 0);
                if(spawningPower < req.power) {
                    var rectifiedReq = _.cloneDeep(req);
                    rectifiedReq.power = req.power - spawningPower;
                    jobUnSpawn[goalId] = rectifiedReq;
                }
            });
            if(_.keys(jobUnSpawn).length != 0) {
                uninitiatedSpawns[jobName] = jobUnSpawn;
            }
        });

        return _.flatten(_.map(uninitiatedSpawns, function (reqs, jobName) {
            return _.map(reqs, function (req, goalId) {
                var priority = jobPriority[jobName];
                if(!jobPriority[jobName]) {
                    priority = jobPriority['default'];
                }
                return {
                    typeName: req.typeName,
                    power: req.power,
                    memory: req.memory,
                    additionalInformation : {
                        jobName: jobName,
                        priority: priority,
                        goalId: goalId,
                        roomName: self.jobs[jobName].getRoomForGoal(goalId)
                    }
                }
            });
        }));
    }
}
module.exports = SpawnJob;
