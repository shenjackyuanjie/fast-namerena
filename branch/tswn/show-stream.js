/** 内部规范流控制器。Runtime 策略仍在 BattleSession 中。 */
export const STREAM_BUFFER_FRAMES = 2;

export class BattleStreamController {
    constructor(source, options = {}) {
        this.source = source;
        this.options = options;
        this.history = [];
        this.terminalResult = null;
        this.sourceDone = false;
        this.failed = null;
        this.disposed = false;
        this.paused = options.paused ?? false;
        this.playbackFrame = -1;
        this.consumedThrough = -1;
        this.sourceReleased = false;
        this.generation = 0;
        this.inflight = null;
        this.listeners = new Set();
        try { this.captureResult(); }
        catch (error) { this.releaseSource(); throw error; }
    }

    initialStates() { return this.source.initial_states; }
    frames() { return this.history; }
    result() { return this.terminalResult; }
    isSourceDone() { return this.sourceDone; }
    error() { return this.failed; }
    bufferedFrames() { return Math.max(0, this.history.length - this.consumedThrough - 1); }

    setPaused(paused) { this.paused = Boolean(paused); }

    /** 向后移动时复用已接收历史；绝不回退源端。 */
    setPlaybackFrame(index) {
        if (!Number.isInteger(index) || index < -1 || index >= this.history.length) {
            throw new RangeError("playback frame must be in received history");
        }
        this.playbackFrame = index;
        this.consumedThrough = Math.max(this.consumedThrough, index);
    }

    notify(listener, event) {
        try { listener(event); }
        catch (error) { this.options.onListenerError?.(error); }
    }

    emit(event) {
        for (const listener of [...this.listeners]) this.notify(listener, event);
    }

    releaseSource() {
        if (this.sourceReleased) return;
        this.sourceReleased = true;
        this.source.dispose();
    }

    subscribe(listener) {
        if (this.disposed) {
            this.notify(listener, { type: "disposed" });
            return () => {};
        }
        this.listeners.add(listener);
        this.notify(listener, { type: "initial", data: this.initialStates() });
        if (this.sourceDone) this.notify(listener, { type: "result", data: this.terminalResult });
        if (this.failed) this.notify(listener, { type: "error", error: this.failed });
        return () => this.listeners.delete(listener);
    }

    captureResult() {
        if (this.sourceDone || !this.source.isDone()) return;
        const result = this.source.result();
        if (result == null) throw new Error("source 已结束但没有 result");
        this.terminalResult = result;
        this.sourceDone = true;
        this.options.metrics?.sourceEnded();
        this.releaseSource();
        this.emit({ type: "result", data: result });
    }

    async pullOne() {
        if (this.disposed || this.sourceDone) return null;
        if (this.failed) throw this.failed;
        if (this.inflight) return this.inflight;
        if (this.bufferedFrames() >= STREAM_BUFFER_FRAMES) return null;
        const generation = this.generation;
        this.inflight = Promise.resolve().then(async () => {
            try {
                const frame = await this.source.nextFrame();
                if (this.disposed || generation !== this.generation) return null;
                if (frame != null) {
                    if (frame.frame_index !== this.history.length) throw new Error("source frame_index 不连续");
                    this.history.push(frame);
                    this.options.metrics?.frameReceived();
                    this.emit({ type: "frame", data: frame });
                }
                if (this.disposed || generation !== this.generation) return null;
                this.captureResult();
                if (frame == null && !this.sourceDone) throw new Error("source 返回空帧但尚未结束");
                return frame;
            } catch (error) {
                if (this.disposed || generation !== this.generation) return null;
                this.failed = error;
                this.paused = true;
                this.releaseSource();
                this.emit({ type: "error", error });
                throw error;
            } finally {
                this.inflight = null;
            }
        });
        return this.inflight;
    }

    async ensureBuffered() {
        while (!this.paused && !this.disposed && !this.sourceDone
            && this.playbackFrame >= this.consumedThrough
            && this.bufferedFrames() < STREAM_BUFFER_FRAMES) {
            await this.pullOne();
        }
        return this.bufferedFrames();
    }

    /** 明确的导航需求可逐帧向前遍历历史。 */
    async ensureFrame(index) {
        if (!Number.isInteger(index) || index < 0) throw new RangeError("frame index must be nonnegative");
        while (this.history.length <= index && !this.disposed && !this.sourceDone) {
            // 由明确跳转经过的帧属于历史，而非推测缓冲区。
            if (this.bufferedFrames() >= STREAM_BUFFER_FRAMES) {
                this.consumedThrough = this.history.length - 1;
            }
            const frame = await this.pullOne();
            if (frame == null) break;
        }
        return this.history[index] ?? null;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.paused = true;
        this.generation += 1;
        this.releaseSource();
        this.history.length = 0;
        this.emit({ type: "disposed" });
        this.listeners.clear();
    }
}
