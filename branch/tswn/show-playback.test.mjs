import test from "node:test";
import assert from "node:assert/strict";
import { createReplayPlan, appendFrameToReplayPlan, markReplayPlanComplete } from "./show-replay.js";

export function fixtureFrame(index, previousHp = 100) {
    const states = [{ id: 0, hp: previousHp - 10, max_hp: 100, alive: true }];
    return {
        frame_index: index, round_index: index * 2, states, updates: [], total_delay: 200,
        rows: [{ indent: false, clips: [{ delay: 200, color: "", tone: "normal",
            parts: [{ kind: "text", text: `event ${index}` }], caster_ids: [], target_ids: [],
            sidebar_states: states, sidebar_previous_states: [{ ...states[0], hp: previousHp }], winner: false }] }],
    };
}

test("append-only replay plan keeps prior chunks and contiguous offsets", () => {
    const initial = [{ id: 0, hp: 100, max_hp: 100, alive: true }];
    const plan = createReplayPlan(initial);
    const players = new Map();
    assert.equal(plan.totalChunks, 0);
    assert.equal(plan.complete, false);
    const frame0 = fixtureFrame(0);
    const first = appendFrameToReplayPlan(plan, frame0, initial, players);
    assert.equal(first.start, 0);
    assert.equal(first.previousStates, initial);
    assert.equal(first.frame, frame0);
    const oldChunks = [...plan.flatChunks];
    const oldJson = JSON.stringify(oldChunks);
    const oldTotal = plan.totalChunks;
    const frame1 = fixtureFrame(1, 90);
    const second = appendFrameToReplayPlan(plan, frame1, frame0.states, players);
    assert.equal(second.start, first.end);
    assert.equal(second.previousStates, frame0.states);
    assert.equal(second.end, plan.totalChunks);
    assert.ok(plan.totalChunks > oldTotal);
    assert.equal(JSON.stringify(oldChunks), oldJson);
    oldChunks.forEach((chunk, index) => assert.equal(plan.flatChunks[index], chunk));
    assert.equal(plan.frames[0], first);
    assert.equal(plan.frames[1], second);
    const result = { status: "finished" };
    markReplayPlanComplete(plan, result);
    assert.equal(plan.complete, true);
    assert.equal(plan.result, result);
    assert.throws(() => appendFrameToReplayPlan(plan, fixtureFrame(2), frame1.states, players), /completed/);
});

test("empty canonical frames keep frame history without inventing chunks", () => {
    const plan = createReplayPlan([]);
    const frame = { frame_index: 0, states: [], rows: [] };
    const entry = appendFrameToReplayPlan(plan, frame, [], new Map());
    assert.equal(entry.start, entry.end);
    assert.equal(plan.frames.length, 1);
    assert.equal(plan.totalChunks, 0);
});
