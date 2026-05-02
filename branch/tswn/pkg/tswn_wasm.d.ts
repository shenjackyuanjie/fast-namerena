/* tslint:disable */
/* eslint-disable */

export class FightSession {
    free(): void;
    [Symbol.dispose](): void;
    is_finished(): boolean;
    constructor(raw_input: string, options?: any | null);
    players(): any;
    run_to_end(limit?: number | null): any;
    state(): any;
    step(): any;
    winner_ids(): any;
}

export class WinRateSession {
    free(): void;
    [Symbol.dispose](): void;
    eval_rq(): number;
    is_finished(): boolean;
    constructor(raw_input: string, total_rounds: number, options?: any | null);
    progress(): any;
    result(): any;
    step(batch_size?: number | null): any;
}

export function core_version(): string;

export function fight(raw_input: string, options?: any | null): any;

export function fight_summary(raw_input: string, options?: any | null): any;

export function name_to_png_base64(name: string): string;

export function version(): string;

export function wasm_start(): void;

export function win_rate_sync(raw_input: string, total_rounds: number, options?: any | null): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_fightsession_free: (a: number, b: number) => void;
    readonly fightsession_is_finished: (a: number) => number;
    readonly fightsession_new: (a: number, b: number, c: number) => [number, number, number];
    readonly fightsession_players: (a: number) => [number, number, number];
    readonly fightsession_run_to_end: (a: number, b: number) => [number, number, number];
    readonly fightsession_state: (a: number) => [number, number, number];
    readonly fightsession_step: (a: number) => [number, number, number];
    readonly fightsession_winner_ids: (a: number) => [number, number, number];
    readonly core_version: () => [number, number];
    readonly fight: (a: number, b: number, c: number) => [number, number, number];
    readonly fight_summary: (a: number, b: number, c: number) => [number, number, number];
    readonly name_to_png_base64: (a: number, b: number) => [number, number];
    readonly version: () => [number, number];
    readonly win_rate_sync: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly wasm_start: () => void;
    readonly __wbg_winratesession_free: (a: number, b: number) => void;
    readonly winratesession_eval_rq: (a: number) => number;
    readonly winratesession_is_finished: (a: number) => number;
    readonly winratesession_new: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly winratesession_progress: (a: number) => [number, number, number];
    readonly winratesession_result: (a: number) => [number, number, number];
    readonly winratesession_step: (a: number, b: number) => [number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_alloc: () => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
