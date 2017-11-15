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

interface creepDescription {
    power: number,
    type: string,
    memory: any,
    id: any,
    jobName: string,
    parentClaim: string,
    waitingSince: number,
    newClaim: string[] | undefined
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
class SpawnJob extends JobClass {
    altSpawnRooms : {[key: string]: {[key: string] : number}};
    _requisitions : jobRequisitions | undefined;
    constructor() {
        super('spawn','spawn',<JobList>{});
        return this;
    }
    execute() {
        var self = this;
        self.updateSpawns();
        self.giveCreeps();
        self.spawnCreeps();
    }
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

        _.forEach(creepDescriptions, function (creepDesc: creepDescription) {
            var parentClaim = creepDesc.parentClaim;
            var jobName = creepDesc.jobName;
            if(!self.requisitions[parentClaim]) {
                self.requisitions[parentClaim] = {};
            }
            if(!self.requisitions[parentClaim][jobName]) {
                self.requisitions[parentClaim][jobName] = {};
            }
            var jobRequisitions = self.memory.requisitions[parentClaim][jobName];
            var curRequisition = jobRequisitions[creepDesc.id];
            var minPower = self.minPower(creepDesc.type);
            // make sure the power is a multiple of the min power, or round it up to one.
            if(creepDesc.power % minPower != 0) {
                creepDesc.power = creepDesc.power + (creepDesc.power % minPower);
            }
            if(curRequisition != undefined && curRequisition.power != creepDesc.power) {
                // if this creep is already spawning, can't do anything to its reequisition
                if(_.find(self.creeps, function (creep) {
                    return creep.memory.goal == creepDesc.id
                }) != undefined) {
                    return true;
                };
                if(creepDesc.power > 0) {
                    curRequisition.power = creepDesc.power;        
                } else {
                    delete jobRequisitions[creepDesc.id];
                }
            } else if(curRequisition == undefined) {
                jobRequisitions[creepDesc.id] = creepDesc.id;
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
            
            var reqs = self.memory.requisitions[parentClaim];
            //job got removed or the parent claim room no longer exists, or something else
            // reguardless do this so we don't halt and catch fire later
            if(!reqs || !reqs[jobName] || !reqs[jobName][id]) {
                creep.suicide();
                return true;
            }
            var remainingPower = self.memory.requisitions[parentClaim][jobName][id].power - spawnedPower;
            if(remainingPower <= 0) {
                delete self.memory.requisitions[parentClaim][jobName][id];
            } else {
                console.log('somehow we spawned an underpowered creep');
                self.memory.requisitions[parentClaim][jobName][id].power = remainingPower;
            }

            //add the creep to its job
            global.bootstrap.claimedRooms[parentClaim].jobs[jobName].addCreep(creep.name);
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
    partsForDescription(creepDesc: creepDescription) : BodyPartConstant[] {
        var self = this;
        var minPower = self.minPower(creepDesc.type);
        var creepType = creepTypes[creepDesc.type];
        var requiredParts = _.cloneDeep(creepType.required_parts);
        
        var parts = _.flatten(_.times((creepDesc.power / minPower), function () {
            return creepType.parts;
        }));
        if(requiredParts != undefined) {
            parts.push(...requiredParts);
        }
        return parts;
    }
    spawn(spawn: StructureSpawn, creepDesc: creepDescription) {
        var self = this;
        var finalParts = self.partsForDescription(creepDesc);
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
    findSpawnsInRoom (roomName: string) : StructureSpawn[] {
        var self = this;
        return _.filter(Game.spawns, function (spawn) {
            if(spawn.pos.roomName != roomName) {
                return false;
            }
            return true;
        });
    }
    //since we can move requisitions to different spawns, but we still need to be able to tell where
    //these requisitions are supposed to be spawning from. so we don't get multiple of the same
    // requisitions, it would also be nice to order spawns 
    getMovedRequisitions() {
        var self = this;
        var requisitions = _.cloneDeep(self.memory.requisitions);
        _.forEach(requisitions, function (jobReqs, parentClaim) {
            _.forEach(jobReqs, function (goalReqs){

            });
        });
        return requisitions;
    }
    spawnCreeps() {
        var self = this;
        var requisitions = self.getMovedRequisitions();
        _.forEach(requisitions, function (jobReqs: any, parentClaim: string) {
            //the queue is the amount of creep parts which are waiting to spawn for this parent claim
            //which have come in sooner than this one in priiority;
            var queue = 0;
            var waitForEnergy = false;
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
                    // can't spawn right now but 
                    // we shouldn't spawn anything else 
                    // in this room until it has enough energy to spawn this creep
                    // if we have problems it should eventually be moved to another room
                    if(availableEnergy < cost) {
                        couldntspawn = true;
                        waitForEnergy = true;
                    }
                    
                    // if we are waiting for energy then we should not spawn a creep, even if we have the energy
                    // but we should still check to see if we need to move that creep to another 
                    // spawning room
                    if(waitForEnergy) {
                        couldntspawn = true;
                    } else {
                        var result = self.spawn(availableSpawns[0], creepDesc);
                        if(typeof result == 'string') {
                            availableEnergy -= cost;
                            availableSpawns.shift();
                        } else {
                            console.log('couldnt spawn ' + JSON.stringify(creepDesc) + ' got error: ' + result);
                            couldntspawn = true;
                        }
                    }

                    if(couldntspawn) {
                        queue += self.partsForDescription(creepDesc).length * 3;
                        if(self.checkMoveReq(creepDesc, spawns, availableEnergy, capacityAvailable, queue)) {
                            self.moveRequisition(creepDesc);
                        }
                    }
                });
                // see above, if we don't have enough energy 
                // to spawn a creep, but we could (eventually)
                // then we should wait for that to happen
            });
        });
    }
    moveRequisition(creepDesc: creepDescription) {
        var self = this;
        var roomToMoveTo = self.getNearestSpawnRoom(creepDesc);
        if(!creepDesc.newClaim) {
            creepDesc.newClaim = [];
        }
        creepDesc.newClaim.unshift(roomToMoveTo);
    }
    //check to see if we need to try to spawn this creep in another room
    checkMoveReq(creepDesc: creepDescription, spawns: StructureSpawn[], availEnergy: number, energyCap: number, queue: number) {
        var self = this;
        var currentSpawnRoom = creepDesc.newClaim ? creepDesc.newClaim[0] : creepDesc.parentClaim;
        var room = Game.rooms[currentSpawnRoom]
        if(!room) {
            return true;
        }
        if(!room.storage) {
            return true;
        }

        var soonestAvailableSpawn = _.min(spawns, function (spawn: StructureSpawn) {
            if(spawn.spawning) {
                return spawn.spawning.remainingTime;
            } else {
                return 0;
            }
        });


        //queue length is roughly the amount of parts * 3 / NUM_SPAWNS
        var cost = self.costForPower(creepDesc.type, creepDesc.power);
        if(cost > energyCap) {
            return true;
        }

        //if we need more energy than we have but we are ready to spawn
        // check to see if approximate time to refill energy is worth waiting for
        if(cost > availEnergy && !soonestAvailableSpawn.spawning) {
            // don't have the energy to spawn this creep in this room right now
            // don't wait to get it
            if(room.storage.store[RESOURCE_ENERGY] < cost - availEnergy) {
                return true;
            }
            var waitTime = (cost - availEnergy) / 10;
            if(waitTime > self.getNearestSpawnDistance(creepDesc)) {
                return true;
            }
        }
        var queueLength = queue / spawns.length;

        if(soonestAvailableSpawn.spawning && soonestAvailableSpawn.spawning.remainingTime + queueLength > self.getNearestSpawnDistance(creepDesc)) {
            return true;
        }

        //patience, we will spawn it eventually
        return false;
    }
    getNearestSpawnRoom(creepDesc: creepDescription) : string {
        var self = this;
        var altSpawns = self.getAlternativeSpawnRooms(creepDesc);
        var closestAltSpawn : string = creepDesc.parentClaim;
        _.forEach(altSpawns, function (distance, roomName) {
            if(!altSpawns[closestAltSpawn]) {
                closestAltSpawn = roomName;
                return true;
            }
            if(altSpawns[closestAltSpawn] > altSpawns[roomName]) {
                closestAltSpawn = roomName;
                return true;
            }
        });
        //FUTURE: change this so that we pull in a gestimate for crossing the distance
        return closestAltSpawn;
    }
    getNearestSpawnDistance(creepDesc: creepDescription) : number {
        var self = this;
        var altSpawns = self.getAlternativeSpawnRooms(creepDesc);
        var closestAltSpawn : string = creepDesc.parentClaim;
        _.forEach(altSpawns, function (distance, roomName) {
            if(!altSpawns[closestAltSpawn]) {
                closestAltSpawn = roomName;
                return true;
            }
            if(altSpawns[closestAltSpawn] > altSpawns[roomName]) {
                closestAltSpawn = roomName;
                return true;
            }
        });
        //FUTURE: change this so that we pull in a gestimate for crossing the distance
        return altSpawns[closestAltSpawn] * 50;
    }
    // returns alternative spawn rooms in an object with roomnames as keys and distances as values
    getAlternativeSpawnRooms(creepDesc: creepDescription) : {[key: string]: number} {
        var self = this;
        if(!self.altSpawnRooms) {
            self.altSpawnRooms = {};
        }
        if(self.altSpawnRooms[creepDesc.parentClaim]) {
            return self.altSpawnRooms[creepDesc.parentClaim];
        }
        var spawnRooms = _.keys(global.bootstrap.claimedRooms);
        if(creepDesc.newClaim ) {
            spawnRooms = _.difference(spawnRooms, creepDesc.newClaim);
        }
        var rooms = utils.getRoomsAtRange(creepDesc.parentClaim);
        var altSpawnRooms : {[key:string]: number} = {};
        _.forEach(spawnRooms, function (roomName) {
            if(roomName == creepDesc.parentClaim) {
                return true;
            }
            altSpawnRooms[roomName] = rooms[roomName];
        });
        self.altSpawnRooms[creepDesc.parentClaim] = altSpawnRooms;
        return altSpawnRooms;
    }
}
module.exports = SpawnJob;
