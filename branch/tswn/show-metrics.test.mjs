import test from "node:test";
import assert from "node:assert/strict";
import { BattleMetrics, percentile } from "./show-metrics.js";

test("stream metrics measure milestones and percentile samples without payloads", () => {
    let time = 100;
    const metrics = new BattleMetrics({ now: () => time });
    metrics.wasmLoaded(5);
    time = 110;
    metrics.sessionCreated(5);
    time = 120;
    metrics.initialRendered();
    for (let i = 1; i <= 20; i++) { metrics.framePulled(i); metrics.frameReceived(); }
    time = 125;
    metrics.chunkRendered(2);
    time = 130;
    metrics.chunkRendered(4);
    metrics.initialRendered();
    metrics.sourceEnded();
    time = 200;
    metrics.sourceEnded();
    assert.deepEqual(metrics.snapshot(), {
        wasm_load_ms: 5, session_create_ms: 5, ttis_ms: 20, ttfe_ms: 25,
        frames_received: 20, chunks_rendered: 2, battle_source_total_ms: 20,
        frame_pull_count: 20, frame_pull_total_ms: 210, frame_pull_max_ms: 20,
        frame_pull_p50_ms: 10, frame_pull_p95_ms: 19,
        render_chunk_count: 2, render_chunk_total_ms: 6, render_chunk_p50_ms: 2, render_chunk_p95_ms: 4,
    });
    assert.ok(Object.values(metrics.snapshot()).every(value => typeof value === "number"));
    assert.equal(percentile([], 0.95), 0);
    assert.equal(new BattleMetrics().snapshot().ttfe_ms, null);
});
