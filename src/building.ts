import * as _ from "lodash"

export class Building {
    get memory () {
        var self = this;
        if(!global.memory.building) {
            global.memory.building = [];
        }
        return global.memory.building;
    }
    execute () {
        var self = this;
        self.workOnBuildQueue();
    }
	workOnBuildQueue() {
		var self = this;
		var built : number = 0;
        var existing = _.keys(Game.constructionSites).length;
        if(existing >= 100) {
            return;
        }
        var build = self.memory.buildQueue[0];
        var pos = new RoomPosition(build[0],build[1], build[2]);
        var structureType = build[3];
        if(self.structureExistsAt(pos,structureType)) {
            self.memory.buildQueue.shift();
            self.memory.errors = 0;
            self.workOnBuildQueue();
        } else {
            var result = pos.createConstructionSite(structureType);
            if(result) {
                console.log('got error ' + result + ' when trying to build ' + structureType + ' at ' + pos);
                self.memory.errors++;
                if(self.memory.errors > 5) {
                    self.memory.buildQueue.shift();
                    console.log('removing from build queue');
                }
            }
        }
	}
    addToBuildQueue(pos: RoomPosition, structureType: StructureConstant, count: number) : void {
		var self = this;
		self.memory.buildQueue.push([pos.x, pos.y, pos.roomName, structureType]);
    }
    structureExistsAt(pos: RoomPosition, structureType: StructureConstant) : boolean {
        var room = Game.rooms[pos.roomName];
        if(!room) {
            throw new Error('no visibilityt into ' + pos.roomName);
        }

        var findings = _.union(pos.lookFor(LOOK_STRUCTURES), pos.lookFor(LOOK_CONSTRUCTION_SITES));
        if(findings.length) {
            var found = false;
            _.forEach(findings, function (finding) {
                var structure = <Structure | ConstructionSite>Game.getObjectById(finding.id);
                if(!structure.hasOwnProperty('structureType')) {
                    return true;
                }
                if(structure.structureType && structure.structureType == structureType) {
                    found = true;
                    return false;
                }
            });
            return found;
        } else {
            return false;
        }
        return false;
    }
}