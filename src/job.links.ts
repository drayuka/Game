/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('job');
 * mod.thing == 'a thing'; // true
 */
type link  = RoomPosition | StructureLink | ConstructionSite;
interface roomLinks {
    sourceLinks: link[],
    controllerLink: link | undefined,
    storageLinks: link[]
}
var utils = <Utils>require('utils');
var goal = require('goal');
// can be called with just name, or with target as well
class LinkJob extends JobClass {
    _links : roomLinks;
    execute () {
        var self = this;
        self.updateLinks();
        self.updateRequisitions();
        self.controlLinks();
        self.controlCreeps();
    }
    updateLinks () {
        var self = this;
        _.forEach(self.links.sourceLinks, function (sourceLink, index) {
            self.links.sourceLinks[index] = self.updateLink(sourceLink);
        });
        if(self.links.controllerLink) {
            self.links.controllerLink = self.updateLink(self.links.controllerLink);
        }
        _.forEach(self.links.storageLinks, function (storageLink, index) {
            self.links.storageLinks[index] = self.updateLink(storageLink);
        });
    }
    updateLink (link: link) : link {
        var self = this;
        if(link instanceof RoomPosition) {
            var room = Game.rooms[link.roomName];
            if(!room) {
                return link;
            }
            var site = <ConstructionSite | StructureLink>_.filter(_.union(link.lookFor(LOOK_CONSTRUCTION_SITES), link.lookFor(LOOK_STRUCTURES)), function (site) {
                return site instanceof ConstructionSite || site instanceof StructureLink;
            })[0];
            if(!site) {
                room.createConstructionSite(link, STRUCTURE_LINK);
                return link;
            } else {
                return site;
            }
        } else {
            //we found the construction site or link, no updating neccesary
            return link
        }
    }
    get links () : roomLinks {
        var self = this;
        if(self._links) {
            return self._links;
        }
        if(!self.memory.links) {
            self.memory.links = {
                sourceLinks: [],
                controllerLink: undefined,
                storageLinks: []
            };
        }
        self._links = {
            sourceLinks: _.map (self.memory.sourceLinks, function (link: any){return self.getLink(link)}),
            controllerLink: self.getLink(self.memory.controllerLink),
            storageLinks: _.map(self.memory.storageLinks, function (link: any){return self.getLink(link)})
        }
        self._links.sourceLinks = new Proxy(self._links.sourceLinks, self.setLink('sourceLinks'));
        self._links.storageLinks = new Proxy(self._links.storageLinks, self.setLink('storageLinks'));
        self._links = new Proxy(self._links, self.setLinkSingle())
        return self._links;
    }
    setLinkSingle () {
        var self = this;
        return {
            set: function (obj: roomLinks, prop: string, value: link) {
                if(prop == 'controllerLink') {
                    obj[prop] = value;
                    self.memory.links[prop] = self.convertLink(value);
                } else {
                    throw new Error('cant set the list of source or storage links, can only add or remove');
                }
                return true;
            }
        }
    }
    setLink (listType: string) {
        var self = this;
        return {
            set: function (obj: link [], prop: number, value: link) {
                if(typeof obj == 'object' && Array.isArray(obj)) {
                    obj[prop] = value;
                    self.memory.links[listType][prop] = self.convertLink(value);
                } else {
                    throw new Error('set link was proxied on a non array')
                }
                return true;
            }
        }
    }
    convertLink (value: link) {
        var self = this;
        if(value instanceof RoomPosition) {
            return [value.x, value.y, value.roomName];
        } else if (value instanceof ConstructionSite || value instanceof StructureLink) {
            return [value.pos.x, value.pos.y, value.pos.roomName, value.id];
        } else {
            throw new Error('cant convert something that isnt a link or a room position');
        }
    }
    getLink (link: [number,number,string] | [number,number,string,string]) : link {
        var self = this;
        if (typeof link == 'object' && Array.isArray(link)) {
            if(link.length == 4) {
                var obj = Game.getObjectById(<string>link[3]);
                if(obj instanceof ConstructionSite || obj instanceof StructureLink) {
                    return obj;
                } else {
                    // can no longer find the object that is the last 
                    // element of the array
                    // it probably no longer exists
                    link.pop();
                    return new RoomPosition(link[0], link[1], link[2]);
                }
            } else if (link.length == 3) {
                return new RoomPosition(link[0],link[1], link[2]);
            }
        }
        throw new Error('didnt find a string or a pos or construction site array for ' + JSON.stringify(link));
    }
    removeRoomLinks(roomName: string) {
        var self = this;
        _.forEach(self.goals, function (goal) {
            if(goal.roomName == roomName) {
                self.removeGoal(goal.id);
            }
        });

        if(self.memory.links) {
            _.forEach(self.memory.links.sourceLinks)
            delete self.memory.links;
        }
    }
    setupRoomLinks(roomName: string) {
        var self = this;
        var room = Game.rooms[roomName];
        var maxStorageLinksNeeded: number;
        if(!room) {
            return false;
        }
        if(!room.controller) {
            return false;
        }
        if(!room.storage) {
            return false;
        }
        var linksAvailable = CONTROLLER_STRUCTURES['link'][room.controller.level];
        if(linksAvailable == 0) {
            return false;
        }
        if(roomName != self.parentClaim) {
            console.log('tried to setup room links for a non-claim room');
            return false;
        }
        var linkCount = self.links.controllerLink ? 1 : 0 + self.links.sourceLinks.length + self.links.storageLinks.length;
        if(linksAvailable == linkCount) {
            return true;
        }
        if(self.links.storageLinks.length == 0) {
            self.addStorageLinkToRoom();
            linkCount++;
        }
        if(linksAvailable == linkCount) {
            return true;
        }
        if(!self.links.controllerLink) {
            self.addUpgradeLinkToRoom();
            linkCount++;
        }
        if(linksAvailable == linkCount) {
            return true;
        }
        if(room.controller.level != 8) {
            var maxStorageLinksNeeded : number = self.calcStorageLinksNeeded();
            if(self.links.storageLinks.length < maxStorageLinksNeeded) {
                var linksToCreate = Math.min(maxStorageLinksNeeded - self.links.storageLinks.length, linksAvailable - linkCount);
                _.times(linksToCreate, function (n) {
                    self.addStorageLinkToRoom();
                });
            }
        }
        if(linksAvailable == linkCount) {
            return true;
        }
        var sources : Source[] = room.find(FIND_SOURCES);
        if(sources.length < self.links.sourceLinks.length) {
            var sourceLinksNeeded = sources.length - self.links.sourceLinks.length;
            // if we're at lvl 8 and we have more than one storage link and we still 
            // need more source links than we have available
            // start removing storage links
            if(room.controller.level == 8 && self.links.storageLinks.length > 1 && linksAvailable - linkCount < sourceLinksNeeded) {
                while(self.links.storageLinks.length > 1 && sourceLinksNeeded > linksAvailable - linkCount) {
                    var link = self.links.storageLinks.pop();
                    if(link instanceof ConstructionSite) {
                        link.remove();
                    } else if(link instanceof StructureLink) {
                        link.destroy();
                    }
                    linkCount--;
                }
            }
            _.forEach(sources, function (source) {
                if(linkCount == linksAvailable) {
                    return false;
                }
                var result = self.addSourceLinkToRoom(source.id);
                if(result) {
                    linkCount++;
                }
            });
        }
        return true;
    }
    calcStorageLinksNeeded() : number {
        var self = this;
        var room = Game.rooms[self.parentClaim];
        if(!room) {
            throw new Error('coudnt see the parent claim room when calculating links required');
        }
        if(!room.storage || !room.controller) {
            throw new Error('couldnt find the storage or controller in this room');
        }
        var distance = room.controller.pos.getRangeTo(room.storage.pos);
        var energyperlink = 800/distance;
        return 64/energyperlink;
    }
    addStorageLinkToRoom() {
        var self = this;
        var room = Game.rooms[self.parentClaim];
        if(!room.storage) {
            return;
        }
        var maxStorageLinksRequired = self.calcStorageLinksNeeded();

        var closePositions;
        if(!self.memory.transferSpot) {
            closePositions = utils.openPositionsAround([{pos: room.storage.pos, range: 1}], {noRoads: true});
        } else {
            closePositions = [new RoomPosition(self.memory.transferSpot[0], self.memory.transferSpot[1], self.memory.transferSpot[2])];
        }
        var farPositions = utils.openPositionsAround([{pos: room.storage.pos, maxRange: 2, minRange: 2}], {noRoads: true});
        if(farPositions.length == 0) {
            throw new Error('cant find a far position that is open and not on a road');
        }
        if(closePositions.length == 0) {
            throw new Error('cant find a close position that is open and not on a road');
        }
        var buildSpot: RoomPosition | undefined;
        var transferSpot : RoomPosition | undefined;
        _.forEach(closePositions, function (cpos: RoomPosition) {
            var validFarPositions = _.filter(farPositions, function (fpos: RoomPosition) {
                if(fpos.isNearTo(cpos)) {
                    return true;
                }
                return false;
            });
            if(validFarPositions.length < maxStorageLinksRequired) {
                return true;
            }
            // lodash definition error
            _.forEach(_.rest(validFarPositions), function (pos: RoomPosition) {
                pos.createFlag();
            });
            buildSpot = validFarPositions[0];
            transferSpot = cpos;
            return false;
        });
        if(!transferSpot || !buildSpot) {
            throw new Error('couldnt find a transfer or build spot using the following lists: ' + JSON.stringify(closePositions) + ' ' + JSON.stringify(farPositions));
        }
        if(!self.memory.transferSpot) {
            self.memory.transferSpot = [transferSpot.x, transferSpot.y, transferSpot.roomName];
            self.addGoal(self.parentClaim, self.parentClaim, {permanentPositions: [{x: transferSpot.x, y: transferSpot.y}]});
        }
        self.links.storageLinks.push(buildSpot);
    }
    addUpgradeLinkToRoom() {
        var self = this;
        var room = Game.rooms[self.parentClaim];
        if(!room || !room.controller) {
            throw new Error('tried to add upgrade link to room we cant see or that doesnt have a controller');
        }

        var linkPositions = utils.openPositionsAround([{pos: room.controller.pos, minRange: 2, maxRange:2}], {noRoads: true, noHaltingCreeps: true});
        if(linkPositions.length == 0) {
            throw new Error('couldnt find a place to put a link near the controller for ' + self.parentClaim);
        }
        var linkPosition = _.max(linkPositions, function (pos: RoomPosition) {
            var upgraderPositions = utils.openPositionsAround([{pos: pos, range: 1}], {noRoads: true});
            var distance;
            return upgraderPositions.length;
        });
        var upgraderPositions = utils.openPositionsAround([{pos: linkPosition, range: 1}], {noRaods: true});
        if(upgraderPositions.length != 0) {
            var upgradeGoal = self.jobs.upgrade.goals[room.controller.id];
            if(upgradeGoal.meta.storage) {
                var oldStorage = <StructureContainer>Game.getObjectById(upgradeGoal.meta.storage);
                oldStorage.destroy();
                var logisticsGoal = self.jobs.logistics.goals[oldStorage.id];
                self.jobs.logistics.removeGoal(logisticsGoal.id);
                delete upgradeGoal.meta.storage;
            }
            upgradeGoal.permanentPositions = upgraderPositions;
            delete upgradeGoal.meta.constructingStorage;
            upgradeGoal.meta.constructingLinkStorage = true;
            _.forEach(upgradeGoal.assignments, function (creepName) {
                global.creeps[creepName].suicide();
            });
            delete upgradeGoal.meta.requested;
            self.links.controllerLink = linkPosition;
        } else {
            throw new Error('tried to automatically build an upgradeLink for ' + self.parentClaim + ' but couldnt find a pos to build at');
        }
    }
    addSourceLinkToRoom(sourceId: string) {
        var self = this;
        var room = Game.rooms[self.parentClaim];
        if(!room) {
            throw new Error('couldnt see into the parent claim for this link job');
        }
        var source = <Source>Game.getObjectById(sourceId);
        var currentLink = self.getLinkForSource(sourceId);
        if(currentLink) {
            return false;
        }
        var closePositions = utils.openPositionsAround([{pos: source.pos, range: 1}], {noRoads:true, noHaltingCreeps: true});
        var buildSpot;
        var harvestSpot;
        if(closePositions.length > 1) {
            // we have more than one position which is close to the harvest point
            _.forEach(closePositions, function (cpos: RoomPosition) {
                var found = false;
                _.forEach(closePositions, function (cpos2: RoomPosition) {
                    if(cpos.isNearTo(cpos2) && !cpos.isEqualTo(cpos2)) {
                        buildSpot = cpos;
                        harvestSpot = cpos2;
                        found = true;
                        return false;
                    }
                });
                if(found) {
                    return false;
                }
            });
        } else {
            // we have only one position which is close to the harvest point
            var farPositions = utils.openPositionsAround([{pos: source.pos, maxRange: 2, minRange: 2}], {noRoads: true, noHaltingCreeps: true});
            _.forEach(closePositions, function (cpos: RoomPosition) {
                var validFarPositions = _.filter(farPositions, function (fpos: RoomPosition) {
                    if(fpos.isNearTo(cpos)) {
                        return true;
                    }
                    return false;
                });
                if(validFarPositions.length == 0) {
                    return true;
                }
                buildSpot = validFarPositions[0];
                harvestSpot = cpos;
                return false;
            });
        }
        if(!buildSpot || !harvestSpot) {
            throw new Error('cannot auto build link for source ' + sourceId + ' at ' + source.pos);
        }
        var harvestGoal = self.jobs.harvest.goals[sourceId];
        harvestGoal.permanentPositions = [harvestSpot];
        if(harvestGoal.meta.storage) {
            self.jobs.logistics.removeGoal(harvestGoal.meta.storage);
            var container = <StructureContainer>Game.getObjectById(harvestGoal.meta.storage);
            container.destroy();
            delete harvestGoal.meta.storage;
        }
        delete harvestGoal.meta.dropHarvest;
        if(harvestGoal.meta.constructingStorage) {
            var site = <ConstructionSite>Game.getObjectById(harvestGoal.meta.constructingStorage);
            site.remove();
            delete harvestGoal.meta.constructingStorage;
        }
        self.links.sourceLinks.push(buildSpot);
        harvestGoal.meta.linkStorage = true;
    }
    updateRequisitions() {
        var self = this;
        _.forEach(self.goals, function (goal) {
            if(goal.assignments.length != 0) {
                return true;
            }
            self.jobs.spawn.addRequisition([{
                power: 16,
                type: 'transporter',
                memory: {},
                id: goal.id,
                jobName: self.name,
                parentClaim: self.parentClaim,
                waitingSince: Game.time,
                newClaim: undefined
            }]);
        });
    }
    getLinkForSource (sourceid: string) {
        var self = this;
        var source = <Source>Game.getObjectById(sourceid);
        return _.find(self.links.sourceLinks, function (link: link) {
            if(link instanceof RoomPosition) {
                if(source.pos.getRangeTo(link) <= 2) {
                    return true;
                }
            } else if(link instanceof ConstructionSite || link instanceof StructureLink) {
                if(source.pos.getRangeTo(link.pos) <= 2) {
                    return true;
                }
            }
            return false;
        });
    }
    controlLinks() {
        var self = this;
        var links = self.getActiveLinks();
        if(!links.storageLinks) {
            return;
        }
        var controllerLink = links.controllerLink;
        var storageLinks = links.storageLinks;
        var sourceLinks = links.sourceLinks;
        if(controllerLink) {
            if(controllerLink.energy < 128) {
                var availableStorageLink = _.find(storageLinks, function (link: StructureLink) {
                    return link.cooldown == 0 && link.energy == link.energyCapacity;
                });
                if(availableStorageLink) {
                    availableStorageLink.transferEnergy(controllerLink);
                }
            }
        }
        if(sourceLinks.length != 0) {
            var availableStorageLinks = _.filter(storageLinks, function (link) {
                return link.energy == 0;
            });
            _.forEach(sourceLinks, function (sourceLink: StructureLink) {
                var storageLink = availableStorageLinks.pop();
                if(!storageLink) {
                    return false;
                }
                if(sourceLink.energy + 100 > sourceLink.energyCapacity) {
                    sourceLink.transferEnergy(storageLink);
                }
            });
        }
    }
    getActiveLinks() {
        var self = this;
        var storageLinks = <StructureLink[]>_.filter(self.links.storageLinks, function (link: link) {
            return link instanceof StructureLink;
        });
        var controllerLink: StructureLink = <StructureLink>(self.links.controllerLink instanceof StructureLink ? self.links.controllerLink : undefined);
        var sourceLinks = <StructureLink[]>_.filter(self.links.sourceLinks, function (link: link) {
            return link instanceof StructureLink;
        });
        return {
            storageLinks:storageLinks,
            controllerLink: controllerLink,
            sourceLinks: sourceLinks
        }
    }
    controlCreeps() {
        var self = this;
        _.forEach(self.creeps, function (creep) {
            self.controlCreep(creep);
        });
    }
    controlCreep(myCreep: CreepClass) {
        var self = this;
        if(myCreep.arrived()) {
            var room = Game.rooms[self.parentClaim];
            if(!room) {
                return;
            }
            var storage = room.storage;
            if(!storage) {
                return;
            }

            var links = self.getActiveLinks();
            if(links.storageLinks.length == 0) {
                return;
            }
            var doingStuff = false;
            if(links.controllerLink) {
                var availLink = <StructureLink>_.min(links.storageLinks, function (link: StructureLink) {
                    return link.cooldown;
                });
                if(availLink.energy < availLink.energyCapacity) {
                    if(myCreep.carry[RESOURCE_ENERGY] < availLink.energyCapacity - availLink.energy) {
                        myCreep.withdraw(storage,RESOURCE_ENERGY);
                    } else {
                        myCreep.transfer(availLink, RESOURCE_ENERGY);
                    }
                    doingStuff = true;
                }
            }
            if(links.sourceLinks.length != 0 && !doingStuff) {
                var availLink = <StructureLink>_.find(links.storageLinks, function (link: StructureLink) {
                    return link.energy == 0;
                });
                if(!availLink) {
                    var carry = _.sum(myCreep.carry);
                    if(carry + LINK_CAPACITY > myCreep.carryCapacity) {
                        myCreep.transfer(storage, RESOURCE_ENERGY);
                    } else {
                        myCreep.withdraw(availLink, RESOURCE_ENERGY);
                    }
                }
            }
        } else {
            myCreep.navigate();
        }
    }
}
module.exports = LinkJob;