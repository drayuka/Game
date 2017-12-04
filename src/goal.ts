/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('goal');
 * mod.thing == 'a thing'; // true
 */

import { Utils as utils } from "./utils"
import { JobClass } from "./job";
import { CreepClass } from "./creep";
export class GoalClass {
    job: JobClass | undefined;
    roomName: string;
    id: string;
    private _meta: any;
    private _target?: RoomObject;
    private _positions?: RoomPosition[];
    // this construction should do as little as possible!
    constructor(job: JobClass | undefined, roomName: string, target: RoomObject | string, meta: any) {
        var self = this;
        // direct link back into this goal's job.
        self.job = job;
        self.roomName = roomName;
        // direct link back to this goals meta memory for this goal
        self._meta = meta;
        if (typeof target == 'string') {
            self.id = target;
        }
        else {
            self._target = target;
            self.id = target.id;
        }
        if(!self.meta.assignments) {
            self.meta.assignments = [];
        }
        if(self.meta.permanentPositions && self.meta.range) {
            throw new Error('you have permanentPositions and a range, fix this');
        }
    }
    set meta (meta) {
        throw new Error('you are breaking meta memory linking');
    }
    get meta () {
        var self = this;
        return self._meta;
    }
    get target() {
        var self = this;
        if(self._target) {
            return self._target;
        }
        self._target = <RoomObject>Game.getObjectById(self.id);
        if(!self._target) {
            console.log(self.roomName + ' ' + self.id + ' couldnt find the target of this goal, you should develop some checking for this job');
        }
        return self._target;
    }
    set target(target) {
        throw new Error('cant change the target of an already constructed goal!');
    }
    get assignments() {
        var self = this;
        return self.meta.assignments;
    }
    set permanentPositions(positions) {
        var self = this;
        self.meta.permanentPositions = _.map(positions, function (pos) {
            return [pos.x, pos.y];
        });
        self._positions = undefined;
        self.meta.positions = undefined;
        self.meta.range = undefined;
    }
    get permanentPositions() {
        var self = this;
        return _.map(self.meta.permanentPositions, function (pos: [number, number]) {
            return new RoomPosition(pos[0], pos[1], self.roomName);
        });
    }
    set assignments(assignments) {
        var self = this;
        self.meta.assignments = assignments;
    }
    get positions() {
        var self = this;
        if(self._positions) {
            return self._positions;
        }
        if(self.meta.positions) {
            self._positions = _.map(self.meta.positions, function (pos: [number, number]) {
                return new RoomPosition(pos[0], pos[1], self.roomName);
            });
            return self._positions;
        }
        var roomPositions: RoomPosition[];
        if(self.meta.permanentPositions) {
            roomPositions = self.permanentPositions;
        } else if(self.meta.range) {
            roomPositions = utils.openPositionsAround([{pos: self.target.pos, range: self.meta.range}]);
            var roomCosts = utils.workerRoomCosts()(self.roomName);
            roomPositions = _.filter(roomPositions, function (pos) {
                if(roomCosts.get(pos.x, pos.y) == 255) {
                    return false;
                }
                var terrain : RoomObject | string = pos.lookFor(LOOK_TERRAIN)[0];
                if(typeof terrain != 'string') {
                    throw new Error('terrain somehow not a string, panic');
                }
                if(terrain == 'wall') {
                    return false;
                }
                return true;
            });
        } else {
            throw new Error('could not build positions list, didnt have positions pre calculated or a range');
        }
        if(self.meta.halts) {
            var noRoads = _.filter(roomPositions, function (pos) {
                var road = utils.getRoadAtPos(pos);
                if(road) {
                    return false;
                }
                if(pos.x == 0 || pos.y == 0 || pos.x == 49 || pos.y == 49) {
                    return false;
                }
                return true;
            });
            if(noRoads.length != 0) {
                roomPositions = noRoads;
            }
        }
        self.meta.positions = _.map(roomPositions, function (pos) {
            return [pos.x, pos.y];
        });
        self._positions = roomPositions;
        return self._positions;
    }
    clearPositions () {
        var self = this;
        delete self.meta.positions;
    }
    set positions(positions) {
        var self = this;
        self._positions = positions;
        self.meta.positions = _.map(positions, function (pos) {
            return [pos.x, pos.y];
        });
    }
}
module.exports = GoalClass;
