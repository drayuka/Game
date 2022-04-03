/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('utils');
 * mod.thing == 'a thing'; // true
 */
import * as _ from "lodash"

export function removeUnwalkableTerrain(poss: RoomPosition[], roomName: string) : RoomPosition[] {
    let terrain = new Room.Terrain(roomName);
    return _.filter(poss, (pos) => terrain.get(pos.x, pos.y) != TERRAIN_MASK_WALL);
}

export function removeUnwalkableStructures(poss: RoomPosition[]) : RoomPosition[] {
    return _.filter(poss, (pos) => !_.find(pos.lookFor(LOOK_STRUCTURES), (struct) => !WALKABLE_STRUCTURES[struct.structureType]))
}

export var WALKABLE_STRUCTURES : Readonly<{[x:string] : boolean}> = {
    STRUCTURE_ROAD: true,
    STRUCTURE_CONTAINER: true,
    STRUCTURE_RAMPART: true
}

export function serializePosition(pos: RoomPosition) : string {
    return pos.roomName + '|' + pos.x + ',' + pos.y;
}

export function deserializePosition(poss: string) : RoomPosition {
    let pind = poss.indexOf('|');
    let cind = poss.indexOf(',');
    return new RoomPosition(parseInt(poss.slice(pind+1, cind)), parseInt(poss.slice(cind+1)), poss.slice(0, pind));
}

export function getOverlappingPositions(positions: {pos: RoomPosition, range: number}[]) {
    let results = [];
    let arrays : RoomPosition[][] = _.map(positions, (pos) => getPositionsAround(pos.pos, pos.range))
    return _.intersectionWith(...arrays, (posa, posb) => posa.isEqualTo(posb));
}


export function getPositionsAround(pos: RoomPosition, range: number) : RoomPosition[] {
    let positions = []
    for(var x = Math.max(pos.x - range, 0); x < Math.min(49, pos.x + range); x++) {
        for(var y = Math.max(pos.y - range, 0); x < Math.min(49, pos.y + range); y++) {
            positions.push(new RoomPosition(x, y, pos.roomName));
        }
    }
    return positions;
}

export class Path {
    spath: string;
    protected _first?: RoomPosition;
    constructor (path: string | RoomPosition[]) {
        var self = this;
        var serPath;
        if (typeof path != 'string') {
            serPath = Path.serialize(path);
        }
        self.spath = serPath;
    }
    /*
        produces a string of the format:
        roomName|x,y|x,y|x,y|x,yRroomName|x,y|x,y
    */
    static serialize(path: RoomPosition[]) : string{
        if(path.length == 0) {
            return '';
        }
        var serPath = path[0].roomName;
        var curRoom = path[0].roomName;
        _.forEach(path, function(pos) {
            if(curRoom != pos.roomName) {
                curRoom = pos.roomName;
                serPath += 'R' + pos.roomName
            }
            serPath += '|' + pos.x + ',' + pos.y;
        });
        return serPath
    }
    static deserialize(path: string | Path) : RoomPosition[] {
        let pathString : string;
        if(path instanceof Path) {
            pathString = path.spath;
        } else {
            pathString = path;
        }
        let posList : RoomPosition[]= []
        let roomPosList = pathString.split('R')
        //first element is empty
        roomPosList.forEach((posString) => {
            let posStringList = posString.split('|');
            let roomName = posStringList.shift();
            posList.push(..._.map(posStringList, function(posString) {
                let posStrings = posString.split(',');
                return new RoomPosition(parseInt(posStrings[0]), parseInt(posStrings[1]), roomName);
            }));
        })
        return posList
    }
    first() : RoomPosition {
        var self = this;
        if(!self._first) {
            let roomPosLists = self.spath.split('R');
            let roomPosStrings = roomPosLists[0].split('|');
            let roomName = roomPosStrings.shift();
            let crs = roomPosStrings[0].split(',');
            self._first = new RoomPosition(parseInt(crs[0]), parseInt(crs[1]), roomName)
        }
        return self._first
    }
    hasNextPos() {
        var self = this;
        return (self.spath.indexOf('|') != -1);
    }
    // deletes the first position
    next() {
        var self = this;
        delete self._first;
        let roomPosLists = self.spath.split('R')
        let roomPosStrings = roomPosLists[0].split('|')
        let roomName = roomPosStrings.shift()
        // last pos in current room
        if(roomPosStrings.length == 1) {
            roomPosLists.shift();
            self.spath = roomPosLists.join('R');
        } else {
            roomPosStrings.shift();
            roomPosStrings.unshift(roomName);
            roomPosLists[0] = roomPosStrings.join('|')
            self.spath = roomPosLists.join('R');
        }
    }
    get length () {
        var self = this;
        return _.reduce(self.spath.split('R'), (total, rmStr) => total + rmStr.split('|').length - 1, 0)
    }
}

export function makeid(length = 10) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}

export function visualisePath(path: RoomPosition[] | Path) {
    let positions : RoomPosition[];
    if(path instanceof Path) {
        positions = Path.deserialize(Path);
    } else {
        positions = _.cloneDeep(path);
    }
    while(positions.length != 0) {
        let roomLine = [];
        let roomName = positions[0].roomName;
        while(positions[0].roomName == roomName) {
            roomLine.push(positions.shift());
        }
        let visual = new RoomVisual(roomName);
        visual.poly(roomLine);
    }
}