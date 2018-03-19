//role enumeration in order of priority roles should be sorted at creep creation
//types have collections of roles

global.Version = 'Mining';

import { oneTimePatch } from "./patchHarness";
import { init } from "./init"

//we should only ever run through oneTimePatch when we have to 
//re-build code(which happens on a commit)
try {
    oneTimePatch(false);
} catch (e) {
    console.log('one time patch runner pre init had the following error: ');
    console.log(e.stack);
    debugger;
}

module.exports.loop = function () {
    //Error.stackTraceLimit = Infinity;
    try {
        init();
    } catch(e) {
        console.log('init had the following error:');
        console.log(e.stack);
        debugger;
    }
    try {
        oneTimePatch(true);
    } catch(e) {
        console.log('one time patch runner post init had the following error: ');
        console.log(e.stack);
        debugger;
    }

    try {
        global.spawn.execute();
    } catch (e) {
        console.log('global spawn job had the following error:');
        console.log(e.stack);
        debugger;
    }

    try {
        global.scout.execute();
    } catch (e) {
        console.log('global scout job had the following error:');
        console.log(e.stack);
        debugger;
    }

    try{
        global.bootstrap.execute();
    } catch(e) {
        console.log('global bootstrap job had the following error: ');
        console.log(e.stack);
        debugger;
    }

    try {
        var segments : number[] = [];
        segments = _.reduce(global.requestSegments, function (ary, segment : number){
            ary.push(segment);
            return ary;
        }, segments);
        RawMemory.setActiveSegments(segments);
    } catch(e) {
        console.log('global segments setting had the following error: ');
        console.log(e.stack);
        debugger;
    }
};
