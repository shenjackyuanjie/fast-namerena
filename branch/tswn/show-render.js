/**
 * @fileoverview tswn_wasm 战斗回放展示页 — 渲染函数
 *
 * 本模块负责将战斗数据（FightPlayer、FightState、FrameUpdate）转换为 HTML
 * 字符串，供 show.html 页面直接插入 DOM。所有渲染函数均为纯函数，通过参数
 * 接收 DOM 引用和全局状态（playersById），不直接依赖模块级变量。
 *
 * ## 导出函数一览
 *
 * ### 消息行角色 Token 渲染
 * - {@link actorToken} — 渲染单个角色的小头像 + HP mini bar + 名字，用于
 *   消息行中内联插入角色标识。HP mini bar 支持显示当前血量（fill）以及
 *   与上一帧相比的变化量（delta），变化方向由 CSS 类控制。
 * - {@link renderActorById} — 根据 playerId 调用 actorToken：先去 playersById
 *   查找对应 FightPlayer，找不到则降级为幻影/未知角色的纯文本名称。
 *
 * ### 模板消息渲染
 * - {@link renderMessageParam} — 渲染 message_template 中的 [2] 占位参数。
 *   若 update.target_ids 非空，将其渲染为逗号分隔的 actorToken 列表；否则
 *   渲染 param/score 数值，damage/recover 类型包裹 .message-number 样式。
 * - {@link renderTemplateMessage} — 解析含 [0][1][2] 占位符的 message_template
 *   字符串：[0] 渲染为施法者 token（不显示 HP），[1] 渲染为目标 token（显示
 *   HP），[2] 委托给 renderMessageParam。其余普通文本通过 formatMessageText
 *   应用 tone 对应的着色/样式。占位符不存在时走 message_rendered 降级路径。
 * - {@link highlightMessage} — renderTemplateMessage 的别名，语义上强调
 *   "高亮渲染一条消息"，便于调用侧阅读。
 *
 * ### 空闲状态
 * - {@link renderIdleState} — 战斗未开始时的占位欢迎内容。向 playerList、
 *   battleRows、plistMeta、headerMeta 四个 DOM 节点写入引导文案。
 *
 * ### 玩家状态面板
 * - {@link renderPlayers} — 渲染左侧玩家状态面板，是页面最核心的渲染入口
 *   之一。首次调用或玩家数量变化时执行全量 innerHTML 渲染（按 teamIndex
 *   分组输出 <table>，每行含头像、名字、HP/MP 条、状态标签）；后续调用
 *   则增量更新已有 DOM 元素的 className 和 textContent，避免重绘闪烁。
 *   同时会自动补全 states 中存在但初始 players 中缺失的召唤单位（幻影/分身）。
 *
 * ### 战斗帧 HTML
 * - {@link buildFrameHtml} — 构建右侧单帧的战斗记录 HTML。逐条处理
 *   frame.updates，将多条消息用"，"拼接为一行，遇到 next_line 类型的
 *   update 则换行。帧内会维护一份模拟 HP 状态（running Map），每次
 *   damage/recover 消息都会更新该状态，使后续消息中角色 HP 条反映帧内
 *   累计效果。帧结束时若 finished 为 true，追加 winner_ids 行。
 */

import {
    escapeHtml,
    actorHpMetrics,
    formatMessageText,
    statusText,
    buildStateMap,
    phantomDisplayName,
    replayDisplayName,
    renderIconSprite,
} from './show-utils.js';

function playerIconClassId(player) {
    return player?.icon_class_id ?? player?.id;
}

// ============================================================================
// 角色 Token 渲染（消息行里的小头像 + 名字 + HP 条）
// ============================================================================

/**
 * 渲染一个角色在消息行中的 token（小头像 + HP mini bar + 名字）。
 * @param {FightPlayer} player — 玩家对象
 * @param {FightState} state — 当前状态
 * @param {FightState} previousState — 上一帧状态
 * @param {{ showHp?: boolean }} [options] — 是否显示 HP mini bar
 * @returns {string} HTML 字符串
 */
export function actorToken(player, state, previousState, { showHp = true } = {}) {
    const hpMetrics = showHp ? actorHpMetrics(state, previousState) : null;
    const hpBar = hpMetrics
        ? `
            <span class="actor-hp" style="width:${hpMetrics.totalWidth}px">
                <span class="actor-hp-fill" style="width:${hpMetrics.fillWidth}px"></span>
                ${hpMetrics.deltaWidth > 0 ? `<span class="actor-hp-delta" style="left:${hpMetrics.deltaLeft}px;width:${hpMetrics.deltaWidth}px"></span>` : ""}
            </span>
        `
        : "";
    const hpClass = hpMetrics ? " has-hp" : "";

    return `<span class="actor-token${hpClass}"><span class="actor-avatar-wrap">${renderIconSprite(playerIconClassId(player), 'msg-avatar icon-sprite')}${hpBar}</span><span class="actor-name">${escapeHtml(player.display_name)}</span></span>`;
}

/**
 * 从状态里补出一个可渲染的玩家对象。
 * 优先使用 WASM 提供的真实名字，避免把 clone/shadow/summon 一律退化成“幻影 #id”。
 * @param {number} playerId
 * @param {FightState|undefined} state
 * @param {Map<number, FightPlayer>} playersById
 * @returns {FightPlayer}
 */
function syntheticPlayerFromState(playerId, state, playersById) {
    let icon = null;
    let icon_class_id = state?.owner_id ?? playerId;
    if (state?.owner_id != null) {
        const ownerPlayer = playersById.get(state.owner_id);
        if (ownerPlayer) {
            icon = ownerPlayer.icon_png_base64;
            icon_class_id = ownerPlayer.icon_class_id ?? ownerPlayer.id;
        }
    }

    return {
        id: playerId,
        team_index: state?.team_index ?? 0,
        id_name: state?.id_name ?? `player_${playerId}`,
        display_name: replayDisplayName(state, playerId),
        icon_png_base64: icon,
        icon_class_id,
    };
}

/**
 * 根据 playerId 渲染一个角色 token，自动处理幻影/未知角色。
 * @param {number} playerId
 * @param {Map<number, FightState>} stateMap — 当前状态 Map
 * @param {Map<number, FightState>} [previousStateMap] — 上一帧状态 Map
 * @param {Map<number, FightPlayer>} playersById — playerId → 玩家对象索引
 * @param {{ showHp?: boolean }} [options]
 * @returns {string} HTML 字符串
 */
export function renderActorById(playerId, stateMap, previousStateMap, playersById, options) {
    const player = playersById.get(playerId);
    const state = stateMap.get(playerId);
    const previousState = previousStateMap?.get(playerId) ?? state;
    if (!player) {
        return actorToken(syntheticPlayerFromState(playerId, state, playersById), state, previousState, options);
    }

    return actorToken(player, state, previousState, options);
}

/**
 * 渲染消息模板中的 [2] 参数（目标列表或数值）。
 * @param {FrameMessage} update — 当前消息
 * @param {MessageTone} tone
 * @param {Map<number, FightState>} stateMap
 * @param {Map<number, FightState>} previousStateMap
 * @param {Map<number, FightPlayer>} playersById
 * @returns {string} HTML 字符串
 */
export function renderMessageParam(update, tone, stateMap, previousStateMap, playersById) {
    if (Array.isArray(update.target_ids) && update.target_ids.length) {
        return update.target_ids
            .map((playerId) => renderActorById(playerId, stateMap, previousStateMap, playersById, { showHp: true }))
            .join(",");
    }

    const value = update.param ?? update.score;
    if (value == null) {
        return "";
    }

    const html = escapeHtml(String(value));
    if (tone === "damage" || tone === "recover") {
        return `<span class="message-number">${html}</span>`;
    }
    return html;
}

/**
 * 渲染带模板占位符的消息：[0]=caster, [1]=target, [2]=param。
 * @param {FrameMessage} update
 * @param {MessageTone} tone
 * @param {Map<number, FightState>} stateMap
 * @param {Map<number, FightState>} previousStateMap
 * @param {Map<number, FightPlayer>} playersById
 * @returns {string} HTML 字符串
 */
export function renderTemplateMessage(update, tone, stateMap, previousStateMap, playersById) {
    const template = `${update.message_template ?? ""}`;
    if (!template) {
        return formatMessageText(`${update.message_rendered ?? ""}`, tone);
    }

    return template
        .split(/(\[[012]\])/g)
        .filter((part) => part.length > 0)
        .map((part) => {
            if (part === "[0]") {
                // 施法者 — 不显示 HP
                return renderActorById(update.caster_id, stateMap, previousStateMap, playersById, { showHp: false });
            }
            if (part === "[1]") {
                // 目标 — 显示 HP
                return renderActorById(update.target_id, stateMap, previousStateMap, playersById, { showHp: true });
            }
            if (part === "[2]") {
                // 参数（目标列表或数值）
                return renderMessageParam(update, tone, stateMap, previousStateMap, playersById);
            }
            return formatMessageText(part, tone);
        })
        .join("");
}

/**
 * 高亮渲染一条消息（模板或纯文本），是 renderTemplateMessage 的别名。
 * @param {FrameMessage} update
 * @param {MessageTone} tone
 * @param {Map<number, FightState>} stateMap
 * @param {Map<number, FightState>} previousStateMap
 * @param {Map<number, FightPlayer>} playersById
 * @returns {string}
 */
export function highlightMessage(update, tone, stateMap, previousStateMap, playersById) {
    return renderTemplateMessage(update, tone, stateMap, previousStateMap, playersById);
}

// ============================================================================
// 初始 / 空闲状态渲染
// ============================================================================

/**
 * 战斗未开始时的占位内容渲染。
 * @param {HTMLElement} playerList
 * @param {HTMLElement} battleRows
 * @param {HTMLElement} plistMeta
 * @param {HTMLElement} headerMeta
 */
export function renderIdleState(playerList, battleRows, plistMeta, headerMeta) {
    playerList.innerHTML = `
        <div class="welcome">
            <div><strong>战斗还没开始。</strong></div>
            <div>左侧会按队伍显示角色状态，右侧则按原版风格逐段追加战斗记录。</div>
            <div>你可以直接用默认示例点击开始，也可以改成自己的输入。</div>
        </div>
    `;
    battleRows.innerHTML = `
        <div class="welcome">
            <div><strong>show.html 是单独的 Fight 展示页。</strong></div>
            <div>它不再混合胜率功能，而是专门模仿原始名字竞技场与 fast-namerena 的战斗观感。</div>
        </div>
    `;
    plistMeta.textContent = "输入名字后点击开始，左侧会显示角色状态，右侧自动播放整场战斗。";
    headerMeta.textContent = "目前显示的是 show 风格回放视图。";
}

function sidebarStatusLabels(state) {
    return Array.isArray(state?.status_labels) ? state.status_labels : [];
}

const POSITIVE_STATUS_LABELS = new Set(["聚气", "蓄力", "隐匿", "潜行", "狂暴", "疾走", "铁壁", "守护"]);
const NEGATIVE_STATUS_LABELS = new Set(["魅惑", "诅咒", "冰冻", "中毒", "迟缓", "垂死"]);

function statusPillTone(label) {
    if (POSITIVE_STATUS_LABELS.has(label)) {
        return 'positive';
    }
    if (NEGATIVE_STATUS_LABELS.has(label)) {
        return 'negative';
    }
    return '';
}

function renderStatusPill(label) {
    const tone = statusPillTone(label);
    const className = tone ? `status-pill ${tone}` : 'status-pill';
    return `<span class="${className}">${escapeHtml(label)}</span>`;
}

function renderPlayerStatusPills(state) {
    const labels = sidebarStatusLabels(state);
    const chips = labels.map(renderStatusPill).join('');
    return `<div class="detail-line player-effects"${labels.length ? '' : ' hidden'}>${chips}</div>`;
}

function seedRowHtml(seedLine) {
    if (!seedLine) {
        return "";
    }
    return `
        <div class="seed-row">
            <span class="seed-label">Seed</span>
            <span class="seed-value">${escapeHtml(seedLine)}</span>
        </div>
    `;
}

// ============================================================================
// 玩家状态面板渲染
// ============================================================================

/**
 * 渲染左侧玩家状态面板。
 * — 首次渲染：全量 innerHTML
 * — 后续渲染：增量更新现有 DOM 元素属性
 *
 * @param {FightPlayer[]} players — 玩家列表
 * @param {FightState[]} states — 当前帧状态
 * @param {FightState[]} [previousStates=states] — 上一帧状态
 * @param {InvolvedSet|null} [involved=null] — 当前帧涉及的角色（用于高亮 caster/target）
 * @param {HTMLElement} playerList — 左侧面板容器 DOM
 * @param {Map<number, FightPlayer>} playersById — playerId → 玩家对象索引（会被写入幻影/分身条目）
 */
export function renderPlayers(players, states, previousStates = states, involved = null, playerList, playersById) {
    const stateMap = buildStateMap(states);
    const previousStateMap = buildStateMap(previousStates);
    const seedLine = playerList.dataset.seedLine ?? "";

    // 补上 states 里有但初始 players 里没有的召唤单位（幻影/分身）
    const knownIds = new Set(players.map((p) => p.id));
    const allPlayers = [...players];
    for (const state of states) {
        if (!knownIds.has(state.id)) {
            knownIds.add(state.id);
            const phantomPlayer = syntheticPlayerFromState(state.id, state, playersById);
            allPlayers.push(phantomPlayer);
            playersById.set(state.id, phantomPlayer);
        }
    }

    const existingRows = playerList.querySelectorAll('tr[data-player-id]');
    if (existingRows.length !== allPlayers.length) {
        // —— 全量渲染（首次或玩家数量变化时） ——
        const teams = new Map();
        for (const player of allPlayers) {
            const items = teams.get(player.team_index) ?? [];
            items.push(player);
            teams.set(player.team_index, items);
        }

        const sortedTeams = [...teams.entries()].sort((left, right) => left[0] - right[0]);
        const firstTeamIsSingle = sortedTeams.length > 0 && sortedTeams[0][1].length === 1;

        const teamHtml = sortedTeams
            .map(([teamIndex, teamPlayers]) => {
                const members = teamPlayers
                    .map((player) => {
                        const state = stateMap.get(player.id);
                        const previous = previousStateMap.get(player.id) ?? state;
                        if (!state) {
                            return "";
                        }

                        const hpMetrics = actorHpMetrics(state, previous);
                        const totalWidth = hpMetrics?.totalWidth ?? 0;
                        const fillWidth = hpMetrics?.fillWidth ?? 0;
                        const previousWidth = hpMetrics?.previousWidth ?? 0;
                        const healStart = Math.min(previousWidth, fillWidth);
                        const healWidth = Math.max(0, fillWidth - previousWidth);
                        const deadClass = state.alive ? "" : " is-dead";
                        const involvedClass = involved
                            ? (involved.casters.has(player.id) && involved.targets.has(player.id) ? " is-caster is-target"
                                : involved.casters.has(player.id) ? " is-caster"
                                : involved.targets.has(player.id) ? " is-target"
                                : "")
                            : "";
                        const nameClass = state.alive ? "name" : "name namedie";
                        const stateClass = !state.alive ? "status-pill dead" : state.frozen ? "status-pill frozen" : "status-pill";

                        const maxMp = state.magic > 0 ? state.magic : (state.magic_point > 0 ? state.magic_point : 1);
                        const mpPercent = state.alive
                            ? Math.max(0, Math.min(100, (state.magic_point / maxMp) * 100))
                            : 0;

                        return `
                        <tr class="player-row${deadClass}${involvedClass}" data-player-id="${player.id}" title="id: ${escapeHtml(player.id_name)} · playerId: ${player.id}">
                            <td class="player-name-cell">
                                <div class="player-name-wrap">
                                    ${renderIconSprite(playerIconClassId(player), 'sgl icon-sprite')}
                                    <span class="${nameClass}">${escapeHtml(player.display_name)}</span>
                                    <span class="player-id"> #${player.id}</span>
                                </div>
                                <div class="hpwrap compact" style="width:${totalWidth}px">
                                    <div class="maxhp" style="width:${totalWidth}px"></div>
                                    <div class="oldhp" style="width:${previousWidth}px"></div>
                                    <div class="healhp" style="left:${healStart}px;width:${healWidth}px"></div>
                                    <div class="hp" style="width:${fillWidth}px"></div>
                                </div>
                                <div class="mpwrap">
                                    <div class="mp" style="width:${mpPercent.toFixed(2)}%"></div>
                                </div>
                                ${renderPlayerStatusPills(state)}
                            </td>
                            <td class="player-stat-cell player-hp-cell">${state.hp}/${state.max_hp}</td>
                            <td class="player-stat-cell player-mp-move-cell"><span class="mp-val">${state.magic_point}</span> / <span class="move-val">${(state.move_point / 2048 * 100).toFixed(0)}%</span></td>
                            <td class="player-state-cell"><span class="${stateClass}">${statusText(state)}</span></td>
                        </tr>
                    `;
                    })
                    .join("");

                const isSingle = teamPlayers.length === 1;
                const labelHtml = !isSingle ? `<div class="team-label">Team ${teamIndex + 1}</div>` : "";
                const theadHtml = !isSingle ? `
                        <thead>
                            <tr>
                                <th class="player-name-head">角色</th>
                                <th class="player-hp-head">HP</th>
                                <th class="player-mix-head">蓝量/体力</th>
                                <th class="player-state-head">状态</th>
                            </tr>
                        </thead>` : "";
                return `
                <section class="team-block">
                    ${labelHtml}
                    <table class="player-table">
                        <colgroup>
                            <col class="player-name-head">
                            <col class="player-hp-head">
                            <col class="player-mix-head">
                            <col class="player-state-head">
                        </colgroup>
                        ${theadHtml}
                        <tbody>
                            ${members}
                        </tbody>
                    </table>
                </section>
            `;
            })
            .join("");

        // 单队伍时在顶部渲染列头
        const columnHeader = firstTeamIsSingle ? `
        <table class="player-table column-headers">
            <colgroup>
                <col class="player-name-head">
                <col class="player-hp-head">
                <col class="player-mix-head">
                <col class="player-state-head">
            </colgroup>
            <thead>
                <tr>
                    <th class="player-name-head">角色</th>
                    <th class="player-hp-head">HP</th>
                    <th class="player-mix-head">蓝量/体力</th>
                    <th class="player-state-head">状态</th>
                </tr>
            </thead>
        </table>` : "";
        playerList.innerHTML = seedRowHtml(seedLine) + columnHeader + teamHtml;
    } else {
        const seedRow = playerList.querySelector('.seed-row');
        if (seedLine) {
            if (seedRow) {
                const valueEl = seedRow.querySelector('.seed-value');
                if (valueEl) {
                    valueEl.textContent = seedLine;
                }
            } else {
                playerList.insertAdjacentHTML('afterbegin', seedRowHtml(seedLine));
            }
        } else if (seedRow) {
            seedRow.remove();
        }

        // —— 增量更新：直接修改现有 DOM，避免 innerHTML 全量替换造成闪烁 ——
        for (const player of allPlayers) {
            const state = stateMap.get(player.id);
            const previous = previousStateMap.get(player.id) ?? state;
            if (!state) continue;

            const row = playerList.querySelector(`tr[data-player-id="${player.id}"]`);
            if (!row) continue;

            const hpMetrics = actorHpMetrics(state, previous);
            const totalWidth = hpMetrics?.totalWidth ?? 0;
            const fillWidth = hpMetrics?.fillWidth ?? 0;
            const previousWidth = hpMetrics?.previousWidth ?? 0;
            const healStart = Math.min(previousWidth, fillWidth);
            const healWidth = Math.max(0, fillWidth - previousWidth);
            const deadClass = state.alive ? "" : " is-dead";
            const involvedClass = involved
                ? (involved.casters.has(player.id) && involved.targets.has(player.id) ? " is-caster is-target"
                    : involved.casters.has(player.id) ? " is-caster"
                    : involved.targets.has(player.id) ? " is-target"
                    : "")
                : "";
            const nameClass = state.alive ? "name" : "name namedie";
            const stateClass = !state.alive ? "status-pill dead" : state.frozen ? "status-pill frozen" : "status-pill";
            const maxMp = state.magic > 0 ? state.magic : (state.magic_point > 0 ? state.magic_point : 1);
            const mpPercent = state.alive
                ? Math.max(0, Math.min(100, (state.magic_point / maxMp) * 100))
                : 0;

            row.className = `player-row${deadClass}${involvedClass}`;

            const nameEl = row.querySelector('.player-name-wrap .name, .player-name-wrap .namedie');
            if (nameEl) nameEl.className = nameClass;

            const hpwrapEl = row.querySelector('.hpwrap');
            if (hpwrapEl) hpwrapEl.style.width = totalWidth + 'px';
            const maxhpEl = row.querySelector('.maxhp');
            if (maxhpEl) maxhpEl.style.width = totalWidth + 'px';
            const hpEl = row.querySelector('.hp');
            if (hpEl) hpEl.style.width = fillWidth + 'px';
            const oldhpEl = row.querySelector('.oldhp');
            if (oldhpEl) oldhpEl.style.width = previousWidth + 'px';
            const healhpEl = row.querySelector('.healhp');
            if (healhpEl) {
                healhpEl.style.left = healStart + 'px';
                healhpEl.style.width = healWidth + 'px';
            }

            const mpEl = row.querySelector('.mp');
            if (mpEl) mpEl.style.width = mpPercent.toFixed(2) + '%';

            const nameWrap = row.querySelector('.player-name-wrap');
            if (nameWrap) {
                let idSpan = nameWrap.querySelector('.player-id');
                if (!idSpan) {
                    idSpan = document.createElement('span');
                    idSpan.className = 'player-id';
                    nameWrap.appendChild(idSpan);
                }
                idSpan.textContent = ' #' + player.id;
            }

            const effectsEl = row.querySelector('.player-effects');
            if (effectsEl) {
                const labels = sidebarStatusLabels(state);
                effectsEl.hidden = labels.length === 0;
                effectsEl.innerHTML = labels.map(renderStatusPill).join('');
            }

            const hpCell = row.querySelector('.player-hp-cell');
            if (hpCell) hpCell.textContent = `${state.hp}/${state.max_hp}`;

            const mpMoveCell = row.querySelector('.player-mp-move-cell');
            if (mpMoveCell) {
                const mpSpan = mpMoveCell.querySelector('.mp-val');
                const moveSpan = mpMoveCell.querySelector('.move-val');
                if (mpSpan) mpSpan.textContent = `${state.magic_point}`;
                if (moveSpan) moveSpan.textContent = (state.move_point / 2048 * 100).toFixed(0) + '%';
            }

            const stateEl = row.querySelector('.player-state-cell span');
            if (stateEl) {
                stateEl.className = stateClass;
                stateEl.textContent = statusText(state);
            }
        }
    }
}

// ============================================================================
// 右侧战斗帧 HTML 构建
// ============================================================================

/**
 * 构建单帧的战斗记录 HTML。
 * 每帧内部的多条消息用" ，"分隔，换行消息（next_line）触发新行。
 * HP 条会基于当前帧内累计伤害/回复进行模拟变化。
 *
 * @param {FrameUpdate} frame — 当前帧数据
 * @param {number} roundIndex — 帧序号
 * @param {FightState[]} [previousStates=frame.states] — 上一帧的状态（默认同当前帧）
 * @param {Map<number, FightPlayer>} playersById — playerId → 玩家对象索引
 * @returns {string} 帧的 HTML 字符串，无有效行时返回空字符串
 */
export function buildFrameHtml(frame, roundIndex, previousStates = frame.states, playersById) {
    for (const state of frame.states) {
        if (playersById.has(state.id)) {
            continue;
        }

        playersById.set(state.id, syntheticPlayerFromState(state.id, state, playersById));
    }

    const previousStateMap = buildStateMap(previousStates);
    /** @type {Map<number, FightState>} 帧内逐步更新的模拟 HP 状态 */
    let running = new Map(previousStateMap);
    const rows = [];
    let segments = [];

    /**
     * 将当前累积的消息片段刷入一个新行。
     */
    function flushRow() {
        if (!segments.length) {
            return;
        }
        rows.push(`<div class="row">${segments.join('<span class="msg-sep">，</span>')}</div>`);
        segments = [];
    }

    /**
     * 对 running 中的某个角色施加 HP 变化（伤害或回复）。
     * @param {number} id — 角色 id
     * @param {Map<number, FightState>} hitState — 当前帧内模拟状态 Map
     * @param {MessageTone} tone
     * @param {number} value — 变化量
     */
    function applyDelta(id, hitState, tone, value) {
        const cur = hitState.get(id);
        if (!cur || cur.max_hp <= 0) return;
        if (tone === 'damage') {
            hitState.set(id, { ...cur, hp: Math.max(0, cur.hp - value) });
        } else if (tone === 'recover') {
            hitState.set(id, { ...cur, hp: Math.min(cur.max_hp, cur.hp + value) });
        }
    }

    for (const update of frame.updates) {
        if (update.update_type === "next_line") {
            flushRow();
            continue;
        }

        const message = `${update.message_rendered ?? ""}`.trim();
        if (!message) {
            continue;
        }

        const tone = update.tone ?? "normal";
        const hitState = new Map(running);
        const value = update.param ?? update.score ?? 0;
        if (value > 0) {
            if (update.target_id != null) applyDelta(update.target_id, hitState, tone, value);
            if (Array.isArray(update.target_ids)) update.target_ids.forEach((id) => applyDelta(id, hitState, tone, value));
        }
        segments.push(`<span class="msg ${tone}">${highlightMessage(update, tone, hitState, running, playersById)}</span>`);
        running = hitState;
    }

    flushRow();

    if (!rows.length && !frame.finished) {
        return "";
    }

    const winnerLine = frame.finished
        ? `<div class="row winner-line"><span class="winner-row">winner_ids=${escapeHtml(JSON.stringify(frame.winner_ids))}</span></div>`
        : "";

    return `
        <section class="round-block">
            <div class="frame-sidebar"><span class="frame-chip">frame ${roundIndex}</span></div>
            <div class="frame-body">
                ${rows.join("")}
                ${winnerLine}
            </div>
        </section>
    `;
}

/**
 * 构建单帧的渲染 chunk 数组，用于 normal/fast 模式逐段渲染。
 * next_line 只负责切到新行，不再把整行消息聚合成一个大 chunk；每条可见消息
 * 都会成为独立 chunk，并直接携带该 update 的 delay1||delay0。
 *
 * @param {FrameUpdate} frame
 * @param {number} roundIndex
 * @param {FightState[]} [previousStates=frame.states]
 * @param {Map<number, FightPlayer>} playersById
 * @returns {Array<{target: 'battleRows' | 'frameBody' | 'row' | 'delay', html: string, delay: number}>}
 */
export function buildFrameRows(frame, roundIndex, previousStates = frame.states, playersById) {
    for (const state of frame.states) {
        if (playersById.has(state.id)) {
            continue;
        }

        playersById.set(state.id, syntheticPlayerFromState(state.id, state, playersById));
    }

    const previousStateMap = buildStateMap(previousStates);
    /** @type {Map<number, FightState>} */
    let running = new Map(previousStateMap);
    /** @type {Array<{target: 'battleRows' | 'frameBody' | 'row' | 'delay', html: string, delay: number}>} */
    const chunks = [];
    let frameStarted = false;
    let rowStarted = false;
    let leadingDelay = 0;
    let lastVisibleChunk = null;

    function pushVisibleChunk(target, html, delay) {
        const chunk = { target, html, delay };
        chunks.push(chunk);
        lastVisibleChunk = chunk;
    }

    function recordHiddenDelay(delay) {
        if (delay <= 0) {
            return;
        }
        if (lastVisibleChunk) {
            lastVisibleChunk.delay += delay;
        } else {
            leadingDelay += delay;
        }
    }

    function pushLeadingDelayChunk() {
        if (leadingDelay <= 0) {
            return;
        }
        chunks.push({ target: 'delay', html: '', delay: leadingDelay });
        leadingDelay = 0;
    }

    function pushMessageChunk(messageHtml, delay) {
        if (!frameStarted) {
            pushVisibleChunk(
                'battleRows',
                `
                    <section class="round-block">
                        <div class="frame-sidebar"><span class="frame-chip">frame ${roundIndex}</span></div>
                        <div class="frame-body">
                            <div class="row">${messageHtml}</div>
                        </div>
                    </section>
                `,
                delay,
            );
            frameStarted = true;
            rowStarted = true;
            return;
        }

        if (!rowStarted) {
            pushVisibleChunk('frameBody', `<div class="row">${messageHtml}</div>`, delay);
            rowStarted = true;
            return;
        }

        pushVisibleChunk('row', `<span class="msg-sep">，</span>${messageHtml}`, delay);
    }

    function applyDelta(id, hitState, tone, value) {
        const cur = hitState.get(id);
        if (!cur || cur.max_hp <= 0) return;
        if (tone === 'damage') {
            hitState.set(id, { ...cur, hp: Math.max(0, cur.hp - value) });
        } else if (tone === 'recover') {
            hitState.set(id, { ...cur, hp: Math.min(cur.max_hp, cur.hp + value) });
        }
    }

    for (const update of frame.updates) {
        const delay = update.delay1 || update.delay0 || 0;

        if (update.update_type === "next_line") {
            rowStarted = false;
            recordHiddenDelay(delay);
            continue;
        }

        const message = `${update.message_rendered ?? ""}`.trim();
        if (!message) {
            recordHiddenDelay(delay);
            continue;
        }

        pushLeadingDelayChunk();

        const tone = update.tone ?? "normal";
        const hitState = new Map(running);
        const value = update.param ?? update.score ?? 0;
        if (value > 0) {
            if (update.target_id != null) applyDelta(update.target_id, hitState, tone, value);
            if (Array.isArray(update.target_ids)) update.target_ids.forEach((id) => applyDelta(id, hitState, tone, value));
        }

        pushMessageChunk(
            `<span class="msg ${tone}">${highlightMessage(update, tone, hitState, running, playersById)}</span>`,
            delay,
        );
        running = hitState;
    }

    if (!chunks.length) {
        pushLeadingDelayChunk();
        if (!frame.finished) {
            return chunks;
        }
    }

    const winnerHtml = `<div class="row winner-line"><span class="winner-row">winner_ids=${escapeHtml(JSON.stringify(frame.winner_ids))}</span></div>`;
    if (frame.finished) {
        if (!frameStarted) {
            pushLeadingDelayChunk();
            chunks.push({
                target: 'battleRows',
                html: `
                    <section class="round-block">
                        <div class="frame-sidebar"><span class="frame-chip">frame ${roundIndex}</span></div>
                        <div class="frame-body">
                            ${winnerHtml}
                        </div>
                    </section>
                `,
                delay: 0,
            });
        } else {
            chunks.push({
                target: 'frameBody',
                html: winnerHtml,
                delay: 0,
            });
        }
    }

    return chunks;
}
