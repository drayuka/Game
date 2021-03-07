/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('job');
 * mod.thing == 'a thing'; // true
 */
// can be called with just name, or with target as well


import "./types";
import { GoalList } from "./init";
import { CreepList } from "./init";
import { JobList } from "./bootstrap";
import { GoalClass } from "./goal";
import { CreepClass } from "./creep";
import * as _ from "lodash"

export class JobClass {
    /*
    * name - the name of the job
    * types - types of creep that can do this job, defaults to worker.
    */
    name: string;
    memory: any;
    protected jobs: JobList;
    protected _goals: GoalList;
    protected _creeps: CreepList;
    protected parentClaim: string;
    execute () {
        throw new Error('must implement an execute function');
    }
    constructor(name: string, parentClaimRoom: string, jobs: JobList) {
        var self = this;
        self.name = name;
        self.parentClaim = parentClaimRoom;
        self.jobs = jobs;
        self.initialize();
        self._maintain();
    }
    initialize() {
        var self = this;
        if(!Memory.jobs[self.parentClaim] || !Memory.jobs[self.parentClaim][self.name]) {
            _.set(Memory.jobs, self.parentClaim + '.' + self.name, {creeps: [], goals: {}});
        }
        self.memory = Memory.jobs[self.parentClaim][self.name];
    }
    protected _maintain() {
        var self = this;
        //remove dead creeps
        var deadCreeps: string[] = [];
        _.forEach(self.memory.creeps, function (name) {
            if(!Game.creeps[name]) {
                deadCreeps.push(name);
            }
        });
        self.removeDeadCreeps(deadCreeps);
    }
    get rooms () {
        var self = this;
        var rooms = _.keys(global.bootstrap.claimedRooms[self.parentClaim].subRooms);
        rooms.push(self.parentClaim);
        return rooms;
    }
    removeDeadCreeps (deadCreeps: string[]) {
        var self = this;
        _.forEach(deadCreeps, function (creepName) {
            var goalId = Memory.creeps[creepName].goal;
            if(Memory.creeps[creepName].assignment) {
                goalId = Memory.creeps[creepName].assignment;
            }
            self.removeCreepFromGoal(creepName, goalId);
            self.removeCreep(creepName);
            delete Memory.creeps[creepName];
        });
    }
    get assignments() {
        var self = this;
        throw new Error('you should not be getting all assignments, look at goals');
    }
    set assignments(assignments) {
        var self = this;
        throw new Error('you should not be setting assignments');
    }
    get goals() {
        var self = this;
        if (self._goals) {
            return self._goals;
        }
        var myGoals : GoalClass[] = [];
        _.forEach(self.memory.goals, function (goals, roomName: string) {
            _.forEach(goals, function (meta: any, goalId: string) {
                myGoals.push(new GoalClass(self, roomName, goalId, meta));
            });
        });
        self._goals = <GoalList>_.indexBy(myGoals, function (sgoal : GoalClass) { return sgoal.id; });
        return self._goals;
    }
    addGoal (roomName: string, target: RoomObject | string, meta: any) {
        var self = this;
        if(!meta) {
            meta = {};
        }
        var ngoal = new GoalClass(self, roomName, roomName, meta);
        if(self.goals[ngoal.id]) {
            throw new Error('already have goal with id ' + ngoal.id);
        }
        if(self._goals) {
            self._goals[ngoal.id] = ngoal;
        }
        _.set(self.memory, 'goals.' + ngoal.roomName + '.' + ngoal.id, ngoal.meta);
    }
    removeGoal(goalId: string) {
        var self = this;
        if(!self.goals[goalId]) {
            throw new Error('attempting to remove goal which does not exist ' + goalId);
        }
        _.forEach(self.goals[goalId].assignments, function (creepName) {
            self.removeCreepFromGoal(creepName, goalId);
        });
        var rgoal = self._goals[goalId];
        delete self._goals[goalId];
        delete self.memory.goals[rgoal.roomName][goalId];
        self.jobs.spawn.removeRequisition(self.name, self.parentClaim, goalId);
    }
    get creeps() {
        var self = this;
        if (self._creeps) {
            return self._creeps;
        }
        var creeps = _.filter(_.map(self.memory.creeps, function (creepName: string) {
            return global.creeps[creepName];
        }), function (creep) {
            if(!creep) {
                return false
            }
            return true;
        });
        self._creeps = _.indexBy(creeps, function (creep : CreepClass) {
            return creep.name; 
        });
        return self._creeps;
    }
    addCreep (creepName: string) {
        var self = this;
        let myCreep : CreepClass = global.creeps[creepName];
        if(!myCreep) {
            throw new Error('could not find creep to add ' + creepName);
        }
        self.memory.creeps.push(creepName);
        if(self._creeps) {
            self._creeps[creepName] = myCreep;
        }
        var goalId = myCreep.memory.goal;
        if(!goalId) {
            console.log('adding creep with no goal ' + creepName);
        }
        if(!self.goals[goalId]) {
            console.log('adding creep: ' + creepName + ' with goal that doesnt exist ' + goalId);
        }
        self.assignCreepToGoal(creepName, myCreep.memory.goal);
    }
    // should be subclassed out in logistics
    getRoomForGoal (goalId: string) {
        var self = this;
        return self.goals[goalId].roomName;
    }
    removeCreep(creepName: string) {
        var self = this;
        self.memory.creeps = _.difference(self.memory.creeps, [creepName]);

        if(self._creeps) {
            delete self._creeps[creepName];
        }
        if(Memory.creeps[creepName]) {
            var creepGoalId = Memory.creeps[creepName].goal;
            if(creepGoalId) {
                self.removeCreepFromGoal(creepName, creepGoalId);
            }
        }
    }
    assignCreepToGoal(creepName: string, goalId: string) {
        var self = this;
        if(!self.creeps[creepName]) {
            throw new Error('attempting to assign goal to non-existant creep');
        }
        if(!self.goals[goalId]) {
            throw new Error('attempting to assign creep to non-existant goal');
        }
        if(self.creeps[creepName].goal) {
            self.removeCreepFromGoal(creepName, self.creeps[creepName].goal.id)
        }
        self.creeps[creepName].cleanup(self.keeps);
        self.creeps[creepName].goal = self.goals[goalId];
        self.creeps[creepName].memory.arrived = 0;
        self.goals[goalId].assignments.push(creepName);
    }
    getGoalsInRoom(roomName: string) {
        var self = this;
        return _.map(self.memory.goals[roomName], function (goalMeta, goalId) {
            return self.goals[goalId];
        });
    }
    get keeps () : string[] {
        return [];
    }
    // removes creep from goal, safe to run even if one doesn't exist anymore
    removeCreepFromGoal(creepName: string, goalId: string) {
        var self = this;
        if(self.creeps[creepName]) {
            self.creeps[creepName].cleanup(self.keeps);
        }
        if(self.goals[goalId]) {
            self.goals[goalId].assignments = _.difference(self.goals[goalId].assignments, [creepName]);
            if(self.goals[goalId].assignments.length == 0) {
                self.goals[goalId].clearPositions();
            }
        }
    }
    getUnassignedCreeps() {
        var self = this;
        return _.filter(self.creeps, function (creep) {
            if(!creep.goal) {
                return true;
            }
            return false;
        });
    }
}
