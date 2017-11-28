class MissionJobClass extends JobClass {
	get missionGenerators () : MissionGenerators {
		throw new Error('subclasses of missionjobclass must implement missionGenerators');
	}
 	generateMissions () {
    var self = this;
    if(!self.memory.missionGen) {
        self.memory.missionGen = {};
    }
    if(!self.memory.missions) {
        self.memory.missions = {};
    }
    _.forEach(self.missionGenerators, function (missionGen, missionName) {
      //mission gen init
      if(!self.memory.missionGen[missionName]) {
          missionGen.init(self.memory.missionGen[missionName]);
      }
      var newMissions = <Mission[]>missionGen.new(self.memory.missionGen[missionName], self.rooms);
      _.forEach(newMissions, function(newMission) {
        if(!self.memory.missions[newMission.priority]) {
          self.memory.missions[newMission.priority] = [];
        }
        self.memory.missions[newMission.priority].push(newMission);
    	});
    });
  }
	getFreeWorkers() : CreepClass[] {
		var self = this;
		return _.filter(self.creeps, function (creep) {
			return creep.memory.onMission != true;
		});
	}
  assignMissions() {
    var self = this;
    var freeWorkers = self.getFreeWorkers();
    var priorities = _.keys(self.memory.missions).sort();
    _.forEach(priorities, function (priority) {
      if(freeWorkers.length == 0) {
        return false;
      }
      var missions = self.memory.missions[priority];
      if(missions.length == 0) {
        return true;
      }
      _.forEach(missions, function (mission: Mission) {
        //already enough creeps on this mission
        if(mission.maxWorkers <= mission.creeps.length) {
          return true;
        } else if(mission.maxWorkers > mission.creeps.length + freeWorkers.length) {
          //all remaining creeps can be assigned to this mission
          mission.creeps.push(..._.map(freeWorkers, function (creep) {
            creep.cleanup([]);
            self.missionGenerators[mission.missionName][mission.missionInit](creep);
            creep.memory.onMission = true;
            return creep.name;
          }));
          freeWorkers = [];
          return false;
        } else { 
          // assign some creeps to this mission
          var neededWorkers = mission.maxWorkers - mission.creeps.length;
          mission.creeps.push(..._.map(_.take(freeWorkers, neededWorkers), function (creep) {
            creep.cleanup([]);
            self.missionGenerators[mission.missionName][mission.missionInit](creep);
            creep.memory.onMission = true;
            return creep.name;
          }));
          freeWorkers = _.takeRight(freeWorkers, freeWorkers.length - neededWorkers);
          return true;
        }
      });
    });
  }
	runMissions () {
		var self = this;
		var priorities = _.keys(self.memory.missions).sort();
		_.forEach(priorities, function (priority) {
			var missions = self.memory.missions[priority];
			if(missions.length == 0) {
				return true;
			}
			self.memory.missions[priority] = _.filter(missions, function (mission: Mission) {
				//no creeps on this mission
				if(mission.creeps.length == 0) {
					return true;
				}
				//remove any creeps on this mission who are no longer on this job
				mission.creeps = _.filter(mission.creeps, function (creepName) {
					return self.creeps[creepName];
				});
				var missionCreeps = _.map(mission.creeps, function (creepName) {
					return self.creeps[creepName];
				});
				try {
					var result = self.missionGenerators[mission.missionName][mission.runner](mission, missionCreeps);
					if(result.creepsToGiveBack && result.creepsToGiveBack.length != 0) {
						mission.creeps = _.difference(mission.creeps, result.creepsToGiveBack);
						_.forEach(result.creepsToGiveBack, function (creepName) {
							self.creeps[creepName].memory.onMission = false;
						});
					}
					if(!result.continue) {
						_.forEach(mission.creeps, function (creepName) {
							self.creeps[creepName].memory.onMission = false;
						});
						self.missionGenerators[mission.missionName] ['remove'](self.memory.missionGen[mission.missionName], mission);
					}
					return result.continue;
				} catch (e) {
					console.log('had problems running mission: ' + JSON.stringify(mission));
					console.log(e.stack);
					debugger;
				}
			})
		})
	}
	getEnergy(creep: CreepClass) {
    var self = this;
    if(creep.carry[RESOURCE_ENERGY] == creep.carryCapacity) {
      return true;
    }
    if(!creep.memory.navigatingToEnergy) {
      creep.memory.arrived = false;
      var closestStorage = <StructureStorage>_.find(self.jobs.logistics.getStoragesAtRange(creep.goal.roomName, 3), function (storage: StructureStorage) {
        if(storage.store[RESOURCE_ENERGY] != 0) {
          return true;
        }
        return false;
      });

      if(!closestStorage) {
        throw new Error('cant find a storage in range of room ' + creep.goal.roomName);
      }
      creep.memory.navigatingToEnergy = true;
      creep.goal = self.jobs.logistics.goals[closestStorage.id];
    }

    if(!creep.arrived()) {
      creep.navigate();
    } else {
      creep.withdraw(<Structure>creep.goal.target, RESOURCE_ENERGY);
      creep.memory.navigatingToEnergy = false;
  	}
    return false;
  }
}