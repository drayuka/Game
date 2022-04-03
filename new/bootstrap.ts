// we just spawned create starter tac and strat jobs. 
// also needs to wipe and re-instantiate os memory

import { StrategyJob } from "./job.strategy";
import { OS } from "./os";
import * as _ from "lodash"
import { TacticalJob } from "./job.tactical";

// creates inital tac and strat jobs
export function bootstrap(os: OS) {
    let spawns = _.keys(Game.spawns)
    if(spawns.length > 1 || spawns.length == 0) {
        //something has gone horribly wrong
        throw new Error('bootstrap ran, but probably shouldnt have')
    }
    let spawn = Game.spawns[spawns[0]]
    let strat = StrategyJob.createNewStrategyJob(spawn.room.name, os)
    let tac = TacticalJob.createNewStrategyJob(spawn.room.name, os, strat);
    let stratJob = os.jobs.get(strat) as StrategyJob;
    stratJob.addTacticalJob(spawn.room.name, tac);

}