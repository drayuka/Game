class InitialRoom extends MissionJobClass {
	execute () {
		var self = this;
		self.generateMissions();
		self.assignMissions();
		self.updateRequisitions();
		self.runMissions();
	}
	get missionGenerators() : MissionGenerators {
		var self = this;
		return {
			upgrade: {
				init: function (missionMem: any) {
					missionMem.missions = {};
				},
				new: function (missionMem: any, rooms: string[]) : Mission[] {
					var newMissions : Mission[] = [];
					_.forEach(rooms, function (roomName) {

					});
					return newMissions;
				},
				remove: function (missionMem: any, mission: Mission) {
					delete missionMem.missions[mission.other.roomName];
				},
				creepMissionInit: function (creep : CreepClass) {
					creep.memory.missionStatus = {
						
					}
				}
			}
		}
	}
	updateRequisitions() {
		var self = this;
	}
}