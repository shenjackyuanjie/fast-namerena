/* tslint:disable */
/* eslint-disable */
export interface CliBatchRateResult {
    label: string;
    avg_win_rate: number;
    aggregate_win_rate: number;
    wins: number;
    total: number;
    valid_matchups: number;
    skipped_matchups: number;
    init_nanos: number;
    fight_nanos: number;
}

export interface CliGroupWinRateResult {
    opponent: string;
    result: CliWinRateResult;
}

export interface CliIconInfo {
    border_style: number;
    shapes: number[];
    bg_color_idx: number;
    bg_color: [number, number, number];
    fg_color_indices: number[];
    fg_colors: [number, number, number][];
    colors_consumed: number;
}

export interface CliNamerPfResult {
    group: string[];
    modes: string[];
    scores: number[];
    total_score: number;
}

export interface CliPairRateEntry {
    name: string;
    rate: number;
}

export interface CliPairRateResult {
    label: string;
    final_score: number;
    head: number;
    selected: number;
    top_pairs: CliPairRateEntry[];
    aggregate_win_rate: number;
    wins: number;
    total: number;
    valid_matchups: number;
    skipped_matchups: number;
    init_nanos: number;
    fight_nanos: number;
}

export interface CliScoreResult {
    score: number;
    wins: number;
    total: number;
    errors: number;
    init_nanos: number;
    fight_nanos: number;
}

export interface CliWinRateResult {
    wins: number;
    total: number;
    win_rate: number;
    init_nanos: number;
    fight_nanos: number;
}

export interface FightOptions {
    eval_rq?: number;
    include_icons?: boolean;
    capture_replay?: boolean;
}

export interface FightReplay {
    players: PlayerMeta[];
    frames: RoundFrame[];
    winner_ids: number[];
    final_states: PlayerState[];
}

export interface FightSummary {
    finished: boolean;
    players: PlayerMeta[];
    winner_ids: number[];
    final_states: PlayerState[];
}

export interface GroupWinRateResult {
    opponent: string;
    result: WinRateResult;
}

export interface PlayerMeta {
    id: number;
    team_index: number;
    id_name: string;
    icon_key: string;
    display_name: string;
    icon_png_base64?: string;
}

export interface PlayerState {
    id: number;
    team_index: number;
    id_name: string;
    icon_key: string;
    display_name: string;
    display_index: number;
    icon_png_base64?: string;
    owner_id?: number;
    minion_kind?: MinionKindView;
    hp: number;
    max_hp: number;
    magic_point: number;
    move_point: number;
    attack: number;
    defense: number;
    speed: number;
    agility: number;
    magic: number;
    resistance: number;
    wisdom: number;
    point: number;
    all_sum: number;
    name_factor: number;
    at_boost: number;
    attract: number;
    frozen: boolean;
    alive: boolean;
    status_labels?: string[];
}

export interface ReplayClip {
    delay: number;
    text_template: string;
    color: string;
    tone: MessageTone;
    player_id?: number;
    data?: string;
    show_hp: boolean;
    hp_before: number;
    hp_after: number;
    death_effect: boolean;
    emoji: string | undefined;
    parts?: ReplayTextPart[];
    caster_ids?: number[];
    target_ids?: number[];
    sidebar_states?: PlayerState[];
    sidebar_previous_states?: PlayerState[];
    winner: boolean;
}

export interface ReplayRow {
    indent: boolean;
    clips: ReplayClip[];
}

export interface ReplayTextPart {
    kind: ReplayTextPartKind;
    text: string;
    player_id?: number;
    show_hp: boolean;
    hp_before: number;
    hp_after: number;
    death_effect: boolean;
    emoji: string | undefined;
}

export interface RoundFrame {
    finished: boolean;
    winner_ids: number[];
    updates: UpdateView[];
    rows?: ReplayRow[];
    states: PlayerState[];
    /**
     * 帧内所有可见 update 的原始等待总和（毫秒），按混淆版 md5.js 的 delay 规则计算，未按角色数量缩放。
     */
    total_delay: number;
}

export interface UpdateView {
    score: number;
    delay0: number;
    delay1: number;
    caster_id: number;
    target_id: number;
    target_ids: number[];
    update_type: UpdateTypeView;
    message_template: string;
    message_rendered: string;
    param?: number;
    hp_delta?: number;
    status_change_tokens: string[];
    /**
     * 消息色调，由 WASM 根据模板内容判定，JS 无需再通过关键词反推。
     */
    tone: MessageTone;
}

export interface WinRateOptions {
    eval_rq?: number;
    thread?: number;
}

export interface WinRateProgress {
    done: boolean;
    rounds_done: number;
    total_rounds: number;
    wins: number;
    percent: number;
}

export interface WinRateResult {
    done: boolean;
    rounds_done: number;
    total_rounds: number;
    wins: number;
    percent: number;
    timing?: WinRateTiming;
}

export interface WinRateTiming {
    init_nanos: number;
    fight_nanos: number;
}

export type MessageTone = "normal" | "damage" | "recover" | "knockout" | "status_exit";

export type MinionKindView = "clone" | "summon" | "shadow" | "zombie";

export type ReplayTextPartKind = "text" | "highlight" | "player" | "data";

export type UpdateTypeView = "win" | "none" | "next_line";

export type WinnerIds = number[];


export class FightSession {
    free(): void;
    [Symbol.dispose](): void;
    is_finished(): boolean;
    constructor(raw_input: string, options?: FightOptions | null);
    players(): PlayerMeta[];
    run_to_end(limit?: number | null): FightReplay;
    state(): PlayerState[];
    step(): RoundFrame;
    winner_ids(): WinnerIds;
}

export class WinRateSession {
    free(): void;
    [Symbol.dispose](): void;
    eval_rq(): number;
    is_finished(): boolean;
    constructor(raw_input: string, total_rounds: number, options?: WinRateOptions | null);
    progress(): WinRateProgress;
    result(): WinRateResult;
    step(batch_size?: number | null): WinRateProgress;
}

export function batch_rate(target_groups: string[], player_groups: string[], total_rounds: number, player_labels?: string[] | null, keep_rq?: boolean | null, thread?: number | null): CliBatchRateResult[];

export function core_version(): string;

export function default_eval_rq(): number;

export function fight(raw_input: string, options?: FightOptions | null): FightReplay;

export function fight_summary(raw_input: string, options?: FightOptions | null): FightSummary;

export function group_win_rate(target: string, against: string[], total_rounds: number, options?: WinRateOptions | null): GroupWinRateResult[];

export function group_win_rate_summary(target: string, against: string[], total_rounds: number, eval_rq?: number | null, thread?: number | null): CliGroupWinRateResult[];

export function icon_info(name: string): CliIconInfo;

export function name_to_icon_rgba(name: string): Uint8Array;

export function name_to_png_base64(name: string): string;

export function name_to_png_bytes(name: string): Uint8Array;

export function namer_pf(raw_input: string, total_rounds: number, modes?: string[] | null, keep_rq?: boolean | null, thread?: number | null): CliNamerPfResult[];

export function pair_rate(target_groups: string[], players: string[], teammates: string[], head: number, total_rounds: number, keep_rq?: boolean | null, thread?: number | null): CliPairRateResult[];

export function parse_group_lines(content: string, double_plus?: boolean | null): string[];

export function score(raw_input: string, total_rounds: number, mode?: string | null, eval_rq?: number | null, thread?: number | null): CliScoreResult;

export function team_win_rate_summary(team1: string, team2: string, total_rounds: number, eval_rq?: number | null, thread?: number | null): CliWinRateResult;

export function to_diy(name: string, old?: boolean | null, minions?: boolean | null): string;

export function to_diy_batch(names: string[], old?: boolean | null, minions?: boolean | null): string[];

export function version(): string;

export function wasm_start(): void;

export function win_rate_eval_rq(): number;

export function win_rate_summary(raw_input: string, total_rounds: number, eval_rq?: number | null, thread?: number | null): CliWinRateResult;

export function win_rate_sync(raw_input: string, total_rounds: number, options?: WinRateOptions | null): WinRateResult;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_fightsession_free: (a: number, b: number) => void;
    readonly __wbg_winratesession_free: (a: number, b: number) => void;
    readonly batch_rate: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number, number, number];
    readonly core_version: () => [number, number];
    readonly default_eval_rq: () => number;
    readonly fight: (a: number, b: number, c: number) => [number, number, number];
    readonly fight_summary: (a: number, b: number, c: number) => [number, number, number];
    readonly fightsession_is_finished: (a: number) => number;
    readonly fightsession_new: (a: number, b: number, c: number) => [number, number, number];
    readonly fightsession_players: (a: number) => [number, number];
    readonly fightsession_run_to_end: (a: number, b: number) => [number, number, number];
    readonly fightsession_state: (a: number) => [number, number, number, number];
    readonly fightsession_step: (a: number) => [number, number, number];
    readonly fightsession_winner_ids: (a: number) => any;
    readonly group_win_rate: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
    readonly group_win_rate_summary: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number, number, number];
    readonly icon_info: (a: number, b: number) => any;
    readonly name_to_icon_rgba: (a: number, b: number) => [number, number];
    readonly name_to_png_base64: (a: number, b: number) => [number, number];
    readonly name_to_png_bytes: (a: number, b: number) => [number, number];
    readonly namer_pf: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
    readonly pair_rate: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => [number, number, number, number];
    readonly parse_group_lines: (a: number, b: number, c: number) => [number, number];
    readonly score: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number, number];
    readonly team_win_rate_summary: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number, number];
    readonly to_diy: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly to_diy_batch: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly version: () => [number, number];
    readonly win_rate_eval_rq: () => number;
    readonly win_rate_summary: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly win_rate_sync: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly winratesession_eval_rq: (a: number) => number;
    readonly winratesession_is_finished: (a: number) => number;
    readonly winratesession_new: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly winratesession_progress: (a: number) => any;
    readonly winratesession_result: (a: number) => any;
    readonly winratesession_step: (a: number, b: number) => [number, number, number];
    readonly wasm_start: () => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_alloc: () => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __externref_drop_slice: (a: number, b: number) => void;
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
