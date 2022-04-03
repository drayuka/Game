
import * as _ from "lodash"
import { global } from "./main";
import { myMemorySegments, myMemory } from "./os";


export declare const SEGMENT_CACHE_TIMEOUT = 100;

export function init(global: global) : void {
    // global is still intact, but we weren't able to run finish
    // we should defnitely save before doing anything else
    if(global.memory && !global.ranFinish) {
        finish(global)
    }
    if(!global.memory) {
        global.memory = JSON.parse(RawMemory.get())
        console.log('had to parse memory');
    }
    if(!global.memorySegments) {
        global.memorySegments = new Map();
    }
    if(_.keys(RawMemory.segments).length > 0) {
        _.forEach(RawMemory.segments, function(segment, segmentId) {
            if(!global.memorySegments.has(parseInt(segmentId))) {
                // if this segment has never been touched before, touch it!!!
                if(!segment) {
                    RawMemory.segments[segmentId] = '{}'
                    global.memorySegments.set(parseInt(segmentId), {});
                } else {
                    global.memorySegments.set(parseInt(segmentId), JSON.parse(segment));
                }
            }
        });
    }
};

export function finish(global: global) {
    RawMemory.set(JSON.stringify(global.memory))
    _.forEach(global.memorySegments, (segment, segmentNumber) => {
        RawMemory.segments[segmentNumber] = JSON.stringify(segment);
    });
    // request segments for next tick
    RawMemory.setActiveSegments(_.reduce(global.memory.requestedSegments, (list, time, id) => {
        if(time + SEGMENT_CACHE_TIMEOUT >= Game.time) {
            list.push(id)
        }
        return list;
    }, []))
    global.ranFinish = true;
}