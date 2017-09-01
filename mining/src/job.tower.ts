var job = require('job');

interface creepRoomList {
	[key: string]: Creep[]
}

class spawn extends JobClass {
	enemyCreeps : creepRoomList;
	execute() {
		var self = this;
		self.findEnemyCreeps();
		self.attackEnemyCreeps();
	}
	findEnemyCreeps() {
		var self = this;
		_.forEach(Game.rooms, function (room) {
			if(!room.controller || !room.controller.my) {
				return true;
			}
			let enemyCreeps = <Array<Creep>>room.find(FIND_CREEPS, {filter: function (creep: Creep) {
				if(!creep.my) {
					return true;
				}
				return false;
			}});
			self.enemyCreeps[room.name] = enemyCreeps;
		});
	}
	attackEnemyCreeps() {
		var self = this;
		_.forEach(Game.rooms, function (room) {
			if(!room.controller || !room.controller.my) {
				return true;
			}
			if(!self.enemyCreeps[room.name]) {
				return true;
			}
			let towers : StructureTower[] = <Array<_HasRoomPosition>>room.find(FIND_MY_STRUCTURES, {filter: function(struct: OwnedStructure) {
				if(struct.structureType == STRUCTURE_TOWER) {
					return true;
				}
				return false;
			}});
			_.forEach(towers, function (tower) {
				tower.attack(self.enemyCreeps[room.name][0]);
			});
		});
	}
}