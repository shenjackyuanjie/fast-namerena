import test from "node:test";
import assert from "node:assert/strict";
import { BattleStreamController, STREAM_BUFFER_FRAMES } from "./show-stream.js";

function fakeSource(count = 8, { wait = null, failAt = -1 } = {}) {
    let index = 0;
    const source = {
        initial_states: [{ id: 0, hp: 100 }], calls: 0, frees: 0,
        async nextFrame() {
            source.calls++;
            if (wait) await wait();
            if (index === failAt) throw new Error("runtime failure");
            return index < count ? { frame_index: index++, states: [], rows: [] } : null;
        },
        isDone() { return index >= count; },
        result() { return source.isDone() ? { status: "finished", frames_emitted: index } : null; },
        dispose() { source.frees++; },
    };
    return source;
}

test("initial event, bounded prefetch and append-only received history", async () => {
    const source = fakeSource();
    const controller = new BattleStreamController(source);
    const events = [];
    controller.subscribe(event => events.push(event.type));
    assert.deepEqual(controller.initialStates(), source.initial_states);
    assert.deepEqual(events, ["initial"]);
    assert.equal(source.calls, 0);
    await Promise.all([controller.ensureBuffered(), controller.ensureBuffered()]);
    assert.equal(source.calls, 2);
    assert.equal(controller.bufferedFrames(), STREAM_BUFFER_FRAMES);
    assert.equal(await controller.pullOne(), null);
    const first = controller.frames()[0];
    controller.setPlaybackFrame(0);
    await controller.ensureBuffered();
    assert.equal(source.calls, 3);
    assert.equal(controller.frames()[0], first);
    assert.deepEqual(events, ["initial", "frame", "frame", "frame"]);
});

test("result follows final frame once, subscribers preserve order and can unsubscribe", async () => {
    const controller = new BattleStreamController(fakeSource(2));
    const first = [], second = [];
    const off = controller.subscribe(event => first.push(event.type));
    controller.subscribe(event => second.push(event.type));
    await controller.pullOne();
    off();
    await controller.pullOne();
    await controller.pullOne();
    assert.deepEqual(first, ["initial", "frame"]);
    assert.deepEqual(second, ["initial", "frame", "frame", "result"]);
    assert.equal(controller.isSourceDone(), true);
    assert.equal(controller.result().frames_emitted, 2);
});

test("pause lets one in-flight pull finish and prevents further prefetch", async () => {
    let release;
    const source = fakeSource(8, { wait: () => new Promise(resolve => { release = resolve; }) });
    const controller = new BattleStreamController(source);
    const pending = controller.ensureBuffered();
    await Promise.resolve();
    controller.setPaused(true);
    release();
    await pending;
    assert.equal(source.calls, 1);
    assert.equal(controller.frames().length, 1);
    await controller.ensureBuffered();
    assert.equal(source.calls, 1);
});

test("ensureFrame is explicit demand, history navigation never reruns frames", async () => {
    const source = fakeSource();
    const controller = new BattleStreamController(source, { paused: true });
    const frame = await controller.ensureFrame(4);
    assert.equal(frame.frame_index, 4);
    assert.equal(source.calls, 5);
    assert.ok(controller.bufferedFrames() <= 2);
    assert.equal(await controller.ensureFrame(1), controller.frames()[1]);
    controller.setPlaybackFrame(1);
    controller.setPaused(false);
    await controller.ensureBuffered();
    assert.equal(source.calls, 5);
    controller.setPlaybackFrame(4);
    await controller.ensureBuffered();
    assert.equal(source.calls, 7);
});

test("dispose invalidates in-flight generation and cannot leak a stale frame", async () => {
    let release;
    const source = fakeSource(2, { wait: () => new Promise(resolve => { release = resolve; }) });
    const old = new BattleStreamController(source);
    const events = [];
    old.subscribe(event => events.push(event.type));
    const pending = old.pullOne();
    await Promise.resolve();
    old.dispose();
    old.dispose();
    const replacement = new BattleStreamController(fakeSource());
    await replacement.pullOne();
    release();
    assert.equal(await pending, null);
    assert.deepEqual(old.frames(), []);
    assert.equal(replacement.frames().length, 1);
    assert.equal(source.frees, 1);
    assert.deepEqual(events, ["initial", "disposed"]);
});

test("midstream error retains history, releases source and never emits a result", async () => {
    const source = fakeSource(3, { failAt: 1 });
    const controller = new BattleStreamController(source);
    const events = [];
    controller.subscribe(event => events.push(event.type));
    await controller.pullOne();
    await assert.rejects(controller.pullOne(), /runtime failure/);
    assert.equal(controller.frames().length, 1);
    assert.equal(source.frees, 1);
    assert.equal(controller.result(), null);
    assert.equal(controller.isSourceDone(), false);
    assert.deepEqual(events, ["initial", "frame", "error"]);
});
