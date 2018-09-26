import {Utils as utils} from "./utils";
import * as placement from "./placement";
import {Model as Model} from "./model";

export class modelBuildPlan implements Model {
    get json() : placement.BuildPlan {
        var self = this;
        return {
            stages: self.stages,
            roomName: self.roomName,
            buildingPlacementStage: self.buildingPlacementStage
        };
    }
    set json (json: placement.BuildPlan) {
        var self = this;
        self.loadStages(json.stages);
        self.roomName = json.roomName;
        self.buildingPlacementStage = json.buildingPlacementStage;
    }
    constructor (jsonPlan: placement.BuildPlan) {
        var self = this;
        self.stages = jsonPlan.stages;

    }
    planMap: {
        [K in placement.stages]: placement.structurePlacement[][][]
    };
    // loads stages in so that they can be indexed by location, as well as structure type, and placement type
    loadStages(stages: { [K in placement.stages]?: placement.BuildStage}) {
        var self = this;
        _.forEach(stages, function (stage: placement.BuildStage, stageName) {
            _.forEach(stage, function (locations: placement.location[]) {
                _.forEach(locations, function (location) {
                    var pos = location.pos;
                    var type = location.type;
                    _.set(self.planMap, stageName + '[' + pos[0] + '][' + pos[1] + ']', type);
                });
            });
        });
    }
    //defaults to current stage
    getStage(stage?: placement.stages) : placement.BuildStage {
        var self = this;
        if(!stage) {
            stage = self.buildingPlacementStage;
        }
        var curStage = self.stages[stage];
        
        if(curStage) {
            return curStage;
        } else {
            self.stages[stage] = {};
            return self.stages[stage]!;
        }
    }
    //returns open positions around another position considering what the buildPlan already has placed
    getOpenPositionsAround(pos: RoomPosition, minRange: number, maxRange: number, curStage?: placement.stages) : RoomPosition[] {
        var self = this;
        var stage = self.getStage(curStage);

        var positions = utils.openPositionsAround([{pos: pos, minRange: minRange, maxRange: maxRange}]);


    }
    // adds a structure at the specified position to the build plan, will remove any open or delivery positions if neccesary
    addStructure(pos: RoomPosition, type: StructureConstant, curStage?: placement.stages) : void {
        var self = this;
        var stage = self.getStage(curStage);
    }
    // removes a structure, should never be used to remove road as this leads to faulty behavior
    removeStructure(pos: RoomPosition, type: StructureConstant, curstage?: placement.stages) : void {
        var self = this;
        var stage = self.getStage(curstage);
        if(type == STRUCTURE_ROAD) {
            throw new Error('tried to remove a road from a build plan, this is not supported');
        }
    }
    // reserves a spot on which to place nothing, used as build, and road repair locations
    addOpenSpot(pos: RoomPosition, curStage?: placement.stages) : void {
        var self = this;
        var stage = self.getStage(curStage);
    }
    // removes open spots, shouldn't really be neccesary
    removeOpenSpot(pos: RoomPosition, curStage?: placement.stages) : void {
        var self = this;
        var stage = self.getStage(curStage);
    }
    // adds a spot on which you can place other buildings in range of a road
    // will be removed when placing a structure, road, or open spot
    addDeliverySpot(pos: RoomPosition, curStage?: placement.stages) : void {
        var self = this;
        var stage = self.getStage(curStage);
    }
    // should only really be called internally.
    removeDeliverySopot(pos: RoomPosition, curStage?: placement.stages) : void {
        var self = this;
        var stage = self.getStage(curStage);
    }
    // gets the position of all structures of the specified type in the build plan.
    getType(type: string, curStage?: placement.stages) : RoomPosition[] {
        var self = this;
        var stage = self.getStage(curStage);
    }
    stages: {
        [K in placement.stages]?: placement.BuildStage
    };
    roomName: string;
    buildingPlacementStage: placement.stages
}