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
    const teamCount = new Set(replay.players.map((player) => player.team_index)).size;
    rememberPlayers(replay.players);
    if (replay.seedLine) {
        playerList.dataset.seedLine = replay.seedLine;
    } else {
        delete playerList.dataset.seedLine;
    }
    plistMeta.textContent = `${replay.players.length} 名角色 · ${teamCount} 支队伍 · ${replay.frames.length} 帧回放。`;
    const labels = { normal: '正常速度', fast: '快进模式', turbo: '极速模式（无延时）' };
    headerMeta.textContent = `当前是${labels[speedMode]}，会自动推进 ${replay.frames.length} 帧。`;
    battleRows.innerHTML = `
        <div class="welcome">
            <div><strong>战斗已经开始。</strong></div>
            <div>下面会按回合逐段追加战斗事件，左侧状态栏会同步刷新 HP、MP 与存活状态。</div>
            <div>右下角两个速度按钮可切换快进或极速模式。</div>
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
    fastBtn.classList.toggle("is-active", speedMode === 'fast');
    turboBtn.classList.toggle("is-active", speedMode === 'turbo');
    if (currentReplay) {
        const labels = { normal: '正常速度', fast: '快进模式', turbo: '极速模式（无延时）' };
        headerMeta.textContent = `当前是${labels[speedMode]}，会自动推进 ${currentReplay.frames.length} 帧。`;
    }
}

/**
 * 根据当前速度模式和帧的延迟配置，计算本帧应等待的毫秒数。
 * turbo 模式返回 0；fast 模式固定 40ms；normal 使用 WASM 预计算的 totalDelay。
 *
 * @param {FrameUpdate} frame
 * @param {SpeedMode} speedMode
 * @returns {number} 等待毫秒数
 */
export function playbackDelay(frame, speedMode) {
    if (speedMode === 'turbo') {
        return 0;
    }
    if (speedMode === 'fast') {
        return 40;
    }
    return frame.total_delay ?? 0;
}

/**
 * 根据回放中的 winnerIds 拼接获胜者名字。
 *
 * @param {FightReplay} replay
 * @returns {string} 如 "张三、李四" 或 "未分出胜负"
 */
export function winnerNamesText(replay) {
    const playersById = new Map(replay.players.map((player) => [player.id, player]));
    const finalStateNames = new Map(replay.final_states.map((state) => [state.id, replayDisplayName(state)]));
    const names = replay.winner_ids.map((winnerId) => playersById.get(winnerId)?.display_name ?? finalStateNames.get(winnerId) ?? `#${winnerId}`);
    return names.length ? names.join("、") : "未分出胜负";
}

function collectKnownStates(replay) {
    const statesById = new Map();
    for (const state of replay.initial_states) {
        statesById.set(state.id, state);
    }
    for (const frame of replay.frames) {
        for (const state of frame.states) {
            statesById.set(state.id, state);
        }
    }
    for (const state of replay.final_states) {
        statesById.set(state.id, state);
    }
    return statesById;
}

function buildRootOwnerMap(replay, statesById) {
    const rootOwnerById = new Map(replay.players.map((player) => [player.id, player.id]));
    for (const state of statesById.values()) {
        rootOwnerById.set(state.id, state.owner_id ?? state.id);
    }
    return rootOwnerById;
}

function lastRelevantKillerId(frame, targetId) {
    for (let index = frame.updates.length - 1; index >= 0; index -= 1) {
        const update = frame.updates[index];
        if (update.casterId == null) {
            continue;
        }
        if (update.tone === 'recover') {
            continue;
        }
        if (update.targetId === targetId) {
            return update.casterId;
        }
        if (Array.isArray(update.targetIds) && update.targetIds.includes(targetId)) {
            return update.casterId;
        }
    }
    return null;
}

function actorSummaryMeta(actorId, replayPlayersById, statesById) {
    if (actorId == null) {
        return null;
    }

    const player = replayPlayersById.get(actorId);
    const state = statesById.get(actorId);
    const displayName = player?.display_name ?? replayDisplayName(state, actorId);
    let iconPngBase64 = player?.icon_png_base64 ?? null;

    if (!iconPngBase64 && state?.owner_id != null) {
        iconPngBase64 = replayPlayersById.get(state.owner_id)?.icon_png_base64 ?? null;
    }

    return {
        id: actorId,
        displayName,
        iconPngBase64,
        iconClassId: player?.iconClassId
            ?? replayPlayersById.get(state?.owner_id)?.iconClassId
            ?? state?.owner_id
            ?? actorId,
    };
}

function summaryHpBarHtml(actor, showHp) {
    if (!showHp || !actor?.finalState?.alive) {
        return '';
    }

    const hpMetrics = actorHpMetrics(actor.finalState);
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

function actorSummaryHtml(actor, { showHp = false } = {}) {
    if (!actor) {
        return '';
    }

    const iconClassId = actor.iconClassId ?? actor.id;
    const hpBar = summaryHpBarHtml(actor, showHp);
    const hpClass = hpBar ? ' has-hp' : '';

    return `
        <span class="summary-actor${hpClass}" title="playerId: ${actor.id}">
            ${renderIconSprite(iconClassId, 'summary-actor-icon icon-sprite')}
            <span class="summary-actor-body">
                <span class="summary-actor-name">${escapeHtml(actor.displayName)}</span>
                ${hpBar}
            </span>
        </span>
    `;
}

/**
 * 按原版 renderer 口径统计战斗结算数据：
 * - score：累加每条 update.score，召唤物/分身归属到 root owner
 * - kills：统计真实死亡或消失的单位数，归属到造成最后一击的 root owner
 * - killedBy：记录原始最后一击单位，用于“致命一击”列显示
 *
 * @param {FightReplay} replay
 * @returns {{ winners: Array<object>, losers: Array<object> }}
 */
export function buildReplayResultSummary(replay) {
    const replayPlayersById = new Map(replay.players.map((player) => [player.id, player]));
    const statesById = collectKnownStates(replay);
    const finalStatesById = new Map(replay.final_states.map((state) => [state.id, state]));
    const rootOwnerById = buildRootOwnerMap(replay, statesById);
    const rowsById = new Map(
        replay.players.map((player, order) => [player.id, {
            id: player.id,
            order,
            displayName: player.display_name,
            iconPngBase64: player.icon_png_base64,
            iconClassId: player.iconClassId ?? player.id,
            finalState: finalStatesById.get(player.id) ?? statesById.get(player.id) ?? null,
            alive: finalStatesById.get(player.id)?.alive ?? statesById.get(player.id)?.alive ?? false,
            score: 0,
            kills: 0,
            killedById: null,
        }]),
    );

    let aliveById = new Map(replay.initial_states.map((state) => [state.id, state.alive]));
    for (const frame of replay.frames) {
        const frameStateMap = new Map(frame.states.map((state) => [state.id, state]));

        for (const update of frame.updates) {
            if ((update.score ?? 0) <= 0 || update.casterId == null) {
                continue;
            }
            const ownerId = rootOwnerById.get(update.casterId) ?? update.casterId;
            const row = rowsById.get(ownerId);
            if (row) {
                row.score += update.score;
            }
        }

        for (const [id, wasAlive] of aliveById) {
            const isAliveNow = frameStateMap.get(id)?.alive ?? false;
            if (!wasAlive || isAliveNow) {
                continue;
            }

            const killerId = lastRelevantKillerId(frame, id);
            if (killerId != null) {
                const ownerId = rootOwnerById.get(killerId) ?? killerId;
                const killerRow = rowsById.get(ownerId);
                if (killerRow) {
                    killerRow.kills += 1;
                }

                const targetRow = rowsById.get(id);
                if (targetRow) {
                    targetRow.killedById = killerId;
                }
            }
        }

        const nextAliveById = new Map(aliveById);
        for (const [id] of aliveById) {
            if (!frameStateMap.has(id)) {
                nextAliveById.set(id, false);
            }
        }
        for (const state of frame.states) {
            nextAliveById.set(state.id, state.alive);
        }
        aliveById = nextAliveById;
    }

    const winnerIdSet = new Set(replay.winner_ids);
    const rows = [...rowsById.values()].map((row) => ({
        ...row,
        killedBy: actorSummaryMeta(row.killedById, replayPlayersById, statesById),
    }));
    const sortRows = (left, right) => (right.score - left.score) || (left.order - right.order);

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

function resultSectionRows(title, rows) {
    const body = rows.length
        ? rows.map((row) => `
            <tr class="result-row${row.alive ? '' : ' is-loser'}">
                <td class="result-name-cell">${actorSummaryHtml(row, { showHp: true })}</td>
                <td class="result-score-cell">${row.score}</td>
                <td class="result-kill-cell">${row.kills}</td>
                <td class="result-killer-cell">${row.killedBy ? actorSummaryHtml(row.killedBy) : ''}</td>
            </tr>
        `).join('')
        : `
            <tr class="result-row empty-row">
                <td class="result-empty" colspan="4">-</td>
            </tr>
        `;

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

export function buildReplayResultTableHtml(replay) {
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
