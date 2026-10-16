/**
 * @fileoverview tswn_wasm 战斗回放展示页 — 共享类型说明
 *
 * 典型的 State 结构（来自 WASM）：
 * @typedef {{
 *   id: number,
 *   id_name: string,
 *   icon_key: string,
 *   display_name: string,
 *   display_index: number,
 *   icon_png_base64?: string|null,
 *   icon_class_id?: number,
 *   minion_kind?: 'clone' | 'summon' | 'shadow' | 'zombie',
 *   hp: number,
 *   max_hp: number,
 *   shield?: number,
 *   max_shield?: number,
 *   magic_point: number,
 *   move_point: number,
 *   speed: number,
 *   agility: number,
 *   magic: number,
 *   attack: number,
 *   defense: number,
 *   resistance: number,
 *   wisdom: number,
 *   point: number,
 *   all_sum: number,
 *   name_factor: number,
 *   at_boost: number,
 *   attract: number,
 *   alive: boolean,
 *   frozen: boolean,
 *   team_index: number,
 *   input_team_index?: number|null,
 *   owner_id?: number,
 *   status_labels?: string[]
 * }} FightState
 *
 * 典型的 Player 结构（来自 WASM）：
 * @typedef {{
 *   id: number,
 *   team_index: number,
 *   input_team_index?: number|null,
 *   id_name: string,
 *   icon_key: string,
 *   display_name: string,
 *   icon_png_base64: string|null,
 *   icon_class_id?: number
 * }} FightPlayer
 *
 * 一次 Replay 的结构：
 * @typedef {{
 *   raw_input: string,
 *   seed_line?: string|null,
 *   players: FightPlayer[],
 *   initial_states: FightState[],
 *   frames: FrameUpdate[],
 *   winner_ids: number[],
 *   final_states: FightState[],
 *   icon_styles?: Array<{ icon_class_id: number, icon_png_base64: string }>,
 *   wasm_duration_ms: number
 * }} FightReplay
 *
 * 单帧更新的结构：
 * @typedef {{
 *   updates: FrameMessage[],
 *   rows?: ReplayRow[],
 *   states: FightState[],
 *   finished: boolean,
 *   winner_ids: number[],
 *   total_delay: number
 * }} FrameUpdate
 *
 * replay view 行结构：
 * @typedef {{
 *   indent: boolean,
 *   clips: ReplayClip[]
 * }} ReplayRow
 *
 * replay view 片段结构；文本/玩家/血条/死亡特效语义都在 parts 内。
 * @typedef {{
 *   delay: number,
 *   color: string,
 *   tone: MessageTone,
 *   parts: ReplayTextPart[],
 *   caster_ids?: number[],
 *   target_ids?: number[],
 *   sidebar_states?: FightState[],
 *   sidebar_previous_states?: FightState[],
 *   winner?: boolean
 * }} ReplayClip
 *
 * replay view 文本片段结构：
 * @typedef {{
 *   kind: 'text' | 'highlight' | 'player' | 'data',
 *   text: string,
 *   player_id?: number|null,
 *   show_hp?: boolean,
 *   hp_before?: number,
 *   hp_after?: number,
 *   death_effect?: boolean,
 *   emoji?: string|null
 * }} ReplayTextPart
 *
 * 单条消息的结构：
 * @typedef {{
 *   update_type?: string,
 *   message_rendered?: string,
 *   message_template?: string,
 *   caster_id?: number,
 *   target_id?: number,
 *   target_ids?: number[],
 *   param?: number,
 *   score?: number,
 *   hp_delta?: number,
 *   status_change_tokens?: string[],
 *   delay1?: number,
 *   delay0?: number,
 *   tone?: MessageTone
 * }} FrameMessage
 *
 * HP 条的布局度量：
 * @typedef {{
 *   totalWidth: number,
 *   fillWidth: number,
 *   previousWidth: number,
 *   deltaLeft: number,
 *   deltaWidth: number,
 *   deltaKind: 'damage' | 'recover' | 'none'
 * }} HpMetrics
 *
 * 涉及高亮的角色集合（用于 renderPlayers 的 involved 参数）：
 * @typedef {{
 *   casters: Set<number>,
 *   targets: Set<number>
 * }} InvolvedSet
 *
 * 消息色调：
 * @typedef {'normal' | 'damage' | 'recover' | 'knockout' | 'status_exit'} MessageTone
 *
 * 播放速度模式：
 * @typedef {'normal' | 'fast' | 'turbo'} SpeedMode
 */
export {};
