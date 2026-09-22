/** 仅收集计时：不收集输入、名称、帧或其他战斗载荷。 */
export function percentile(samples, quantile) {
    if (samples.length === 0) return 0;
    const sorted = [...samples].sort((a, b) => a - b);
    return sorted[Math.max(0, Math.ceil(sorted.length * quantile) - 1)];
}

export class BattleMetrics {
    constructor({ now = () => performance.now(), startedAt = now() } = {}) {
        this.now = now;
        this.startedAt = startedAt;
        this.sourceStartedAt = null;
        this.pulls = [];
        this.renders = [];
        this.values = {
            wasm_load_ms: 0, session_create_ms: 0, ttis_ms: null, ttfe_ms: null,
            frames_received: 0, chunks_rendered: 0, battle_source_total_ms: null,
        };
    }
    wasmLoaded(ms) { this.values.wasm_load_ms = ms; }
    sessionCreated(ms) { this.values.session_create_ms = ms; this.sourceStartedAt = this.now(); }
    initialRendered() { this.values.ttis_ms ??= this.now() - this.startedAt; }
    framePulled(ms) { this.pulls.push(ms); }
    frameReceived() { this.values.frames_received++; }
    chunkRendered(ms) {
        this.renders.push(ms);
        this.values.chunks_rendered++;
        this.values.ttfe_ms ??= this.now() - this.startedAt;
    }
    sourceEnded() {
        this.values.battle_source_total_ms ??= this.now() - (this.sourceStartedAt ?? this.startedAt);
    }
    snapshot() {
        const sum = samples => samples.reduce((total, ms) => total + ms, 0);
        return {
            ...this.values,
            frame_pull_count: this.pulls.length,
            frame_pull_total_ms: sum(this.pulls),
            frame_pull_max_ms: this.pulls.reduce((max, ms) => Math.max(max, ms), 0),
            frame_pull_p50_ms: percentile(this.pulls, 0.5),
            frame_pull_p95_ms: percentile(this.pulls, 0.95),
            render_chunk_count: this.renders.length,
            render_chunk_total_ms: sum(this.renders),
            render_chunk_p50_ms: percentile(this.renders, 0.5),
            render_chunk_p95_ms: percentile(this.renders, 0.95),
        };
    }
}
