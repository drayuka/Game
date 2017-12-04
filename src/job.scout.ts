/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('job');
 * mod.thing == 'a thing'; // true
 */

import { Utils as utils } from "./utils"
import { GoalClass } from "./goal";
import { JobClass } from "./job";
import { CreepClass } from "./creep";
import { JobList } from "./bootstrap";
// can be called with just name, or with target as well
export class ScoutJob extends JobClass {
    _observers: StructureObserver[];
    constructor() {
        super('scout','scout',<JobList>{spawn: global.spawn})
    }
    execute() {
        var self = this;
        self.reassessScoutingSites();
        self.updateObservers();
        self.updateRequisition();
        self.controlWorkers();
    }
    removeRoom(roomName: string) {
        var self = this;
        _.forEach(self.goals[roomName].assignments, function (creepName: string) {
            self.creeps[creepName].suicide();
        });
        self.removeGoal(roomName);
    }
    addRoomToScout(roomName: string) {
        var self = this;
        var scoutedRooms = _.map(self.goals, function (goal: GoalClass) {
            return goal.roomName;
        });
        if(_.includes(scoutedRooms, roomName)) {
            return;
        }
        var positions = [new RoomPosition(25,25,roomName)];
        self.addGoal(roomName, roomName, {halts: 1});
        self.goals[roomName].permanentPositions = positions;
        return 1;
    }
    reassessScoutingSites() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            if(!Game.rooms[goal.roomName]) {
                return true;
            }
            var ownedStructures = Game.rooms[goal.roomName].find(FIND_MY_STRUCTURES);
            if(ownedStructures.length != 0) {
                self.removeRoom(goal.roomName);
            }
        });
    }
    updateRequisition() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            if(goal.assignments.length != 0) {
                return true;
            }
            self.jobs.spawn.addRequisition([{
                power: 1,
                type: 'scout',
                memory: {},
                id: goal.id,
                jobName: self.name,
                // this is a hack so that we don't have to do a 
                // bunch of logic that we should write anyways to handle global jobs
                parentClaim: self.name, 
                waitingSince: Game.time,
                newClaim: undefined
            }]);
        });
    }
    get observers () {
        var self = this;
        if(self._observers) {
            return self._observers;
        }
        self._observers = _.map(self.memory.observers, function (obs: string) {
            return <StructureObserver>Game.getObjectById(obs);
        });
        return self._observers;
    }
    updateObservers() {
        var self = this;
        var newObservers: string[] = [];
        _.forEach(global.bootstrap.claimedRooms, function (room, roomName) {
            if(!Game.rooms[roomName]) {
                return true;
            }
            var observer: StructureObserver[] = Game.rooms[roomName].find(FIND_MY_STRUCTURES, {filter: function (struct: OwnedStructure) {
                return struct.structureType == STRUCTURE_OBSERVER;
            }});
            if(observer.length > 0) {
                newObservers.push(observer[0].id);
            }
        });
        self.memory.observers = _.union(self.memory.observers, newObservers);
        delete self._observers;
    }
    controlWorkers() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            var room = Game.rooms[goal.roomName];
            if(!room) {
                var observer = _.find(self.observers, function (obs) {
                    return Game.map.getRoomLinearDistance(obs.pos.roomName, goal.roomName) < OBSERVER_RANGE;
                });
                if(observer) {
                    observer.observeRoom(goal.roomName);
                }
            }

            _.forEach(goal.assignments, function (creepName) {
                self.controlCreep(self.creeps[creepName]);
            });
        });
    }
    controlCreep(myCreep: CreepClass) {
        var self = this;
        if(myCreep.pos.roomName == myCreep.goal.roomName) {
            if(myCreep.pos.x == 0 || myCreep.pos.x == 49 || myCreep.pos.y == 0 || myCreep.pos.y == 49) {
                myCreep.navigate();
            } else {
                myCreep.moveOffRoad();
            }
        } else {
            myCreep.navigate();
        }
    }
}
module.exports = ScoutJob;