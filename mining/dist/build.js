/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('utils');
 * mod.thing == 'a thing'; // true
 */
var job = require('job');
class build {
    constructor(id, meta) {
        var self = this;
        self.meta = meta;
        self.id = id;
    }
    get pos() {
        var self = this;
        return new RoomPosition(...self.meta.pos);
    }
    static newBuild(pos, structureType, options) {
        var self = this;
        if (!Memory.buildCount) {
            Memory.builds = {};
            Memory.buildCount = 1;
        }
        if (!options) {
            options = {};
        }
        var id = Memory.buildCount;
        Memory.builds[id] = {
            pos: [pos.x, pos.y, pos.roomName],
            structureType: structureType,
            options: options
        };
        var newBuild = new build(id, Memory.builds[id]);
        console.log('building ' + structureType + ' at ' + pos);
        global.builds[id] = newBuild;
        Memory.buildCount++;
        return id;
    }
    maintainBuild(id) {
        var self = this;
        var room = Game.rooms[self.pos.roomName];
        if (!room) {
            return;
        }
        if (self.getBuild()) {
            return;
        }
        if (self.getStructure()) {
            return;
        }
        var sites = self.pos.lookFor(LOOK_CONSTRUCTION_SITES);
        sites = _.filter(sites, function (site) {
            return (site.structureType == self.meta.structureType && site.owner.username == 'shockfist');
        });
        if (sites.length == 0) {
            var items = self.pos.lookFor(LOOK_STRUCTURES);
            items = _.filter(items, function (item) {
                return (item.structureType == self.meta.structureType);
            });
            if (items.length == 0) {
                var result = room.createConstructionSite(self.pos, self.meta.structureType);
                if (result != 0 && result != ERR_FULL) {
                    throw new Error('cant build ' + self.meta.structureType + ' at ' + self.pos + ' error: ' + result);
                }
            }
            else {
                delete self.meta.constructionSiteId;
                self.meta.structureId = items[0].id;
                self.meta.buildIsDone = true;
                if (self.meta.options && self.meta.options.deleteOnFinish) {
                    self.finishBuild(self.id);
                }
            }
        }
        else {
            self.meta.constructionSiteId = sites[0].id;
        }
    }
    get isFinished() {
        var self = this;
        return (self.meta.buildIsDone == true);
    }
    getBuild() {
        var self = this;
        if (!self.isFinished && self.meta.constructionSiteId) {
            var site = Game.getObjectById(self.meta.constructionSiteId);
            if (site) {
                return site;
            }
            else {
                return null;
            }
        }
        else {
            return null;
        }
    }
    getStructure() {
        var self = this;
        if (self.isFinished) {
            return Game.getObjectById(self.meta.structureId);
        }
        else {
            return null;
        }
    }
    finishBuild(id) {
        var self = this;
        delete Memory.builds[id];
        delete global.builds[id];
    }
}
module.exports = build;
