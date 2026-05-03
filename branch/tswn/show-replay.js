/**
 * @fileoverview tswn_wasm 战斗回放展示页 — 回放播放辅助
 *
 * 提供回放介绍渲染、速度按钮状态更新、帧延迟计算、获胜者文本等辅助函数。
 * playReplay 主循环因需要频繁读写全局状态（playbackToken 等），保留在 show.js 中。
 */

import { renderPlayers } from './show-render.js';
import { actorHpMetrics, escapeHtml, replayDisplayName, renderIconSprite } from './show-utils.js';

// ============================================================================
// 回放介绍与速度控制
// ============================================================================

/**
 * 渲染回放开始前的介绍信息（角色数量、队伍数、帧数等）。
 *
 * @param {FightReplay} replay
 * @param {SpeedMode} speedMode — 当前播放速度
 * @param {HTMLElement} playerList
 * @param {HTMLElement} battleRows
 * @param {HTMLElement} plistMeta
 * @param {HTMLElement} headerMeta
 * @param {Map<number, FightPlayer>} playersById — 会被 rememberPlayers 覆写
 * @param {(players: FightPlayer[]) => void} rememberPlayers — 更新 playersById 的回调
 */
export function renderReplayIntro(replay, speedMode, playerList, battleRows, plistMeta, headerMeta, playersById, rememberPlayers) {
    // 统计队伍数（去重）
    const teamCount = new Set(replay.players.map((player) => player.team_index)).size;
    // 将玩家列表写入全局映射
    rememberPlayers(replay.players);
    // 将种子信息保存到 dataset 供后续使用
    if (replay.seed_line) {
        playerList.dataset.seedLine = replay.seed_line;
    } else {
        delete playerList.dataset.seedLine;
    }
    // 更新角色列表上方的概要信息
    plistMeta.textContent = `${replay.players.length} 名角色 · ${teamCount} 支队伍 · ${replay.frames.length} 帧回放。`;
    const labels = { normal: '正常速度', fast: '快进模式', turbo: '极速模式（无延时）' };
    // 更新顶部抬头，标明当前播放速度与总帧数
    headerMeta.textContent = `当前是${labels[speedMode]}，会自动推进 ${replay.frames.length} 帧。`;
    battleRows.innerHTML = `
        <div class="welcome">
            <div><strong>战斗已经开始。</strong></div>
            <div>下面会按回合逐段追加战斗事件，左侧状态栏会同步刷新 HP、MP 与存活状态。</div>
            <div>右下角两个速度按钮可切换快进或极速模式。</div>
            ${replay.seed_line ? `<div>种子：${escapeHtml(replay.seed_line)}</div>` : ''}
        </div>
    `;
    renderPlayers(replay.players, replay.initial_states, replay.initial_states, null, playerList, playersById);
}

/**
 * 根据当前 speedMode 更新快进/极速按钮的激活样式。
 *
 * @param {HTMLButtonElement} fastBtn
 * @param {HTMLButtonElement} turboBtn
 * @param {SpeedMode} speedMode
 * @param {FightReplay|null} currentReplay
 * @param {HTMLElement} headerMeta
 */
export function updateSpeedButtons(fastBtn, turboBtn, speedMode, currentReplay, headerMeta) {
    // 切换两个速度按钮的激活状态
    fastBtn.classList.toggle("is-active", speedMode === 'fast');
    turboBtn.classList.toggle("is-active", speedMode === 'turbo');
    if (currentReplay) {
        const labels = { normal: '正常速度', fast: '快进模式', turbo: '极速模式（无延时）' };
        // 同步更新顶部抬头的速度提示
        headerMeta.textContent = `当前是${labels[speedMode]}，会自动推进 ${currentReplay.frames.length} 帧。`;
    }
}

/**
 * 根据当前速度模式和帧的延迟配置，计算本帧应等待的毫秒数。
 * turbo 模式返回 0；fast 模式固定 40ms；normal 使用 WASM 预计算的 total_delay。
 *
 * @param {FrameUpdate} frame
 * @param {SpeedMode} speedMode
 * @returns {number} 等待毫秒数
 */
export function playbackDelay(frame, speedMode) {
    // 极速模式：零延迟
    if (speedMode === 'turbo') {
        return 0;
    }
    // 快进模式：固定 40ms 保证视觉可感
    if (speedMode === 'fast') {
        return 40;
    }
    // 正常模式：使用 WASM 预计算的延迟值
    return frame.total_delay ?? 0;
}

/**
 * 根据回放中的 winner_ids 拼接获胜者名字。
 *
 * @param {FightReplay} replay
 * @returns {string} 如 "张三、李四" 或 "未分出胜负"
 */
export function winnerNamesText(replay) {
    // 构建玩家 id → 玩家对象的索引
    const playersById = new Map(replay.players.map((player) => [player.id, player]));
    // 构建最终状态 id → 展示名的索引（用于召唤物等非玩家单元）
    const finalStateNames = new Map(replay.final_states.map((state) => [state.id, replayDisplayName(state)]));
    // 解析每个 winner_id 对应的可读名字，兜底显示 #id
    const names = replay.winner_ids.map((winnerId) => playersById.get(winnerId)?.display_name ?? finalStateNames.get(winnerId) ?? `#${winnerId}`);
    return names.length ? names.join("、") : "未分出胜负";
}

/**
 * 收集回放中所有出现过的战斗单元状态（initial + 每帧 + final），按 id 索引。
 *
 * @param {FightReplay} replay
 * @returns {Map<number, FightState>}
 */
function collectKnownStates(replay) {
    const statesById = new Map();
    // 收集初始状态
    for (const state of replay.initial_states) {
        statesById.set(state.id, state);
    }
    // 逐帧收集过程中的状态变更
    for (const frame of replay.frames) {
        for (const state of frame.states) {
            statesById.set(state.id, state);
        }
    }
    // 收集最终状态（覆盖前面的旧状态）
    for (const state of replay.final_states) {
        statesById.set(state.id, state);
    }
    return statesById;
}

/**
 * 构建每个战斗单元 → 根拥有者（玩家）的映射。
 * 用于将召唤物/分身的得分与击杀归属到其主人。
 *
 * @param {FightReplay} replay
 * @param {Map<number, FightState>} statesById
 * @returns {Map<number, number>}
 */
function buildRootOwnerMap(replay, statesById) {
    // 玩家自身即根拥有者
    const rootOwnerById = new Map(replay.players.map((player) => [player.id, player.id]));
    // 非玩家单元通过 owner_id 归属到其主人，无 owner 则视作自身为根
    for (const state of statesById.values()) {
        rootOwnerById.set(state.id, state.owner_id ?? state.id);
    }
    return rootOwnerById;
}

/**
 * 在某一帧中倒序查找对目标造成最后一击（非治疗）的施法者 id。
 *
 * @param {FrameUpdate} frame
 * @param {number} targetId
 * @returns {number|null}
 */
function lastRelevantKillerId(frame, targetId) {
    // 倒序遍历本帧所有 update，找到最后一个对 targetId 造成非治疗伤害的施法者
    for (let index = frame.updates.length - 1; index >= 0; index -= 1) {
        const update = frame.updates[index];
        // 跳过无施法者或治疗效果的事件
        if (update.caster_id == null) {
            continue;
        }
        if (update.tone === 'recover') {
            continue;
        }
        // 匹配单体目标
        if (update.target_id === targetId) {
            return update.caster_id;
        }
        // 匹配群体目标列表
        if (Array.isArray(update.target_ids) && update.target_ids.includes(targetId)) {
            return update.caster_id;
        }
    }
    return null;
}

/**
 * 构建结算表中的「致命一击」列所需的角色摘要元信息（id、名字、图标）。
 *
 * @param {number|null} actorId
 * @param {Map<number, FightPlayer>} replayPlayersById
 * @param {Map<number, FightState>} statesById
 * @returns {{ id: number, display_name: string, icon_png_base64: string|null, icon_class_id: number }|null}
 */
function actorSummaryMeta(actorId, replayPlayersById, statesById) {
    // 无击杀者时返回 null
    if (actorId == null) {
        return null;
    }

    const player = replayPlayersById.get(actorId);
    const state = statesById.get(actorId);
    // 优先取玩家名，其次取状态展示名，最后兜底
    const displayName = player?.display_name ?? replayDisplayName(state, actorId);
    let iconPngBase64 = player?.icon_png_base64 ?? null;

    // 如果自身没有图标，尝试从主人继承
    if (!iconPngBase64 && state?.owner_id != null) {
        iconPngBase64 = replayPlayersById.get(state.owner_id)?.icon_png_base64 ?? null;
    }

    return {
        id: actorId,
        display_name: displayName,
        icon_png_base64: iconPngBase64,
        // 存活状态：有状态则用状态的 alive，否则默认存活
        alive: state?.alive ?? true,
        // icon_class_id 优先级：玩家 > 主人 > 状态的 owner > 自身 id
        icon_class_id: player?.icon_class_id
            ?? replayPlayersById.get(state?.owner_id)?.icon_class_id
            ?? state?.owner_id
            ?? actorId,
    };
}

/**
 * 生成结算表中角色 HP 条的 HTML（仅存活角色显示的紧凑型血条）。
 *
 * @param {{ final_state: FightState|null }|null} actor
 * @param {boolean} showHp
 * @returns {string}
 */
function summaryHpBarHtml(actor, showHp) {
    // 不显示 HP 或角色已死亡时跳过
    if (!showHp || !actor?.final_state?.alive) {
        return '';
    }

    // 从最终状态计算 HP 百分比与血条宽度
    const hpMetrics = actorHpMetrics(actor.final_state);
    if (!hpMetrics) {
        return '';
    }

    return `
        <span class="summary-actor-hp hpwrap compact" style="width:${hpMetrics.totalWidth}px" aria-hidden="true">
            <span class="maxhp"></span>
            <span class="hp" style="width:${hpMetrics.fillWidth}px"></span>
        </span>
    `;
}

/**
 * 生成结算表中单个角色整行的 HTML（头像 + 名字 + 可选 HP 条）。
 *
 * @param {{ id: number, display_name: string, icon_class_id?: number, final_state?: FightState|null }|null} actor
 * @param {{ showHp?: boolean }} [options]
 * @returns {string}
 */
function actorSummaryHtml(actor, { showHp = false } = {}) {
    // 空角色直接返回空字符串
    if (!actor) {
        return '';
    }

    // 确定图标 class id，优先用预设值，其次用角色 id
    const iconClassId = actor.icon_class_id ?? actor.id;
    // 根据 showHp 决定是否渲染 HP 条
    const hpBar = summaryHpBarHtml(actor, showHp);
    const hpClass = hpBar ? ' has-hp' : '';
    // 死亡角色的名字灰色，与侧边栏 .namedie 效果一致
    const nameClass = actor.alive !== false ? 'summary-actor-name' : 'summary-actor-name is-dead';

    return `
        <span class="summary-actor${hpClass}" data-player-id="${actor.id}" title="playerId: ${actor.id}">
            <span class="summary-actor-avatar">
                ${renderIconSprite(iconClassId, 'summary-actor-icon icon-sprite')}
                ${hpBar}
            </span>
            <span class="summary-actor-body">
                <span class="${nameClass}">${escapeHtml(actor.display_name)}</span>
            </span>
        </span>
    `;
}

/**
 * 按原版 renderer 口径统计战斗结算数据：
 * - score：累加每条 update.score，召唤物/分身归属到 root owner
 * - kills：统计真实死亡或消失的单位数，归属到造成最后一击的 root owner
 * - killed_by：记录原始最后一击单位，用于“致命一击”列显示
 *
 * @param {FightReplay} replay
 * @returns {{ winners: Array<object>, losers: Array<object> }}
 */
export function buildReplayResultSummary(replay) {
    // ---- 初始化索引 ----
    const replayPlayersById = new Map(replay.players.map((player) => [player.id, player]));
    const statesById = collectKnownStates(replay);
    const finalStatesById = new Map(replay.final_states.map((state) => [state.id, state]));
    const rootOwnerById = buildRootOwnerMap(replay, statesById);

    // 为每个玩家初始化结算行（含得分/击杀/存活等统计字段）
    const rowsById = new Map(
        replay.players.map((player, order) => [player.id, {
            id: player.id,
            order,
            display_name: player.display_name,
            icon_png_base64: player.icon_png_base64,
            icon_class_id: player.icon_class_id ?? player.id,
            final_state: finalStatesById.get(player.id) ?? statesById.get(player.id) ?? null,
            alive: finalStatesById.get(player.id)?.alive ?? statesById.get(player.id)?.alive ?? false,
            score: 0,
            kills: 0,
            killed_by_id: null,
        }]),
    );

    // ---- 帧循环：统计得分与击杀 ----
    // aliveById 追踪每个单元在当前帧之前的存活状态
    let aliveById = new Map(replay.initial_states.map((state) => [state.id, state.alive]));

    for (const frame of replay.frames) {
        // 构建本帧状态快照
        const frameStateMap = new Map(frame.states.map((state) => [state.id, state]));

        // 累加得分：只有正分且有施法者的 update 才计入，归属到根拥有者
        for (const update of frame.updates) {
            if ((update.score ?? 0) <= 0 || update.caster_id == null) {
                continue;
            }
            const ownerId = rootOwnerById.get(update.caster_id) ?? update.caster_id;
            const row = rowsById.get(ownerId);
            if (row) {
                row.score += update.score;
            }
        }

        // 统计击杀：检查从上一帧到本帧由存活→死亡/消失的单元
        for (const [id, wasAlive] of aliveById) {
            const isAliveNow = frameStateMap.get(id)?.alive ?? false;
            if (!wasAlive || isAliveNow) {
                continue;
            }

            // 找到谁造成了最后一击
            const killerId = lastRelevantKillerId(frame, id);
            if (killerId != null) {
                // 击杀归属到击杀者的根拥有者
                const ownerId = rootOwnerById.get(killerId) ?? killerId;
                const killerRow = rowsById.get(ownerId);
                if (killerRow) {
                    killerRow.kills += 1;
                }

                // 记录被击杀者的致命一击来源
                const targetRow = rowsById.get(id);
                if (targetRow) {
                    targetRow.killed_by_id = killerId;
                }
            }
        }

        // 推进存活状态到本帧之后的状态
        const nextAliveById = new Map(aliveById);
        // 本帧不再出现的单元标记为死亡（分身消失等）
        for (const [id] of aliveById) {
            if (!frameStateMap.has(id)) {
                nextAliveById.set(id, false);
            }
        }
        // 按本帧的最新状态更新
        for (const state of frame.states) {
            nextAliveById.set(state.id, state.alive);
        }
        aliveById = nextAliveById;
    }

    // ---- 排序与分组 ----
    const winnerIdSet = new Set(replay.winner_ids);
    // 为每个结算行补充致命一击的元信息
    const rows = [...rowsById.values()].map((row) => ({
        ...row,
        killed_by: actorSummaryMeta(row.killed_by_id, replayPlayersById, statesById),
    }));
    // 按得分降序排列，得分相同按原始顺序
    const sortRows = (left, right) => (right.score - left.score) || (left.order - right.order);

    // 有明确胜者时按 winner_ids 分组，否则按存活状态分组
    if (winnerIdSet.size > 0) {
        return {
            winners: rows.filter((row) => winnerIdSet.has(row.id)).sort(sortRows),
            losers: rows.filter((row) => !winnerIdSet.has(row.id)).sort(sortRows),
        };
    }

    return {
        winners: rows.filter((row) => row.alive).sort(sortRows),
        losers: rows.filter((row) => !row.alive).sort(sortRows),
    };
}

/**
 * 生成结算表中一个分组的表格行（标题行 + 数据行）。
 *
 * @param {string} title — 分组名称，如"胜者"、"败者"
 * @param {Array<object>} rows — 该分组内的角色数据
 * @returns {string}
 */
function resultSectionRows(title, rows) {
    // 生成数据行：有数据时逐行渲染，无数据时显示占位横线
    const body = rows.length
        ? rows.map((row) => `
            <tr class="result-row${row.alive ? '' : ' is-loser'}">
                <td class="result-name-cell">${actorSummaryHtml(row, { showHp: true })}</td>
                <td class="result-score-cell">${row.score}</td>
                <td class="result-kill-cell">${row.kills}</td>
                <td class="result-killer-cell">${row.killed_by ? actorSummaryHtml(row.killed_by) : ''}</td>
            </tr>
        `).join('')
        : `
            <tr class="result-row empty-row">
                <td class="result-empty" colspan="4">-</td>
            </tr>
        `;

    // 拼接标题行与数据行
    return `
        <tr class="result-section-row">
            <th class="result-section-title">${title}</th>
            <th class="result-head">得分</th>
            <th class="result-head">击杀</th>
            <th class="result-head">致命一击</th>
        </tr>
        ${body}
    `;
}

/**
 * 生成完整的战斗结算 HTML 表格。
 *
 * @param {FightReplay} replay
 * @returns {string}
 */
export function buildReplayResultTableHtml(replay) {
    // 先计算结算数据，再包裹为完整的表格 HTML
    const summary = buildReplayResultSummary(replay);
    return `
        <div class="result-table-wrap">
            <table class="result-table">
                <tbody>
                    ${resultSectionRows('胜者', summary.winners)}
                    ${resultSectionRows('败者', summary.losers)}
                </tbody>
            </table>
        </div>
    `;
}
