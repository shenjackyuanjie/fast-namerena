/**
 * @fileoverview tswn_wasm 战斗回放展示页 — 入口模块
 *
 * 这是一个独立的 Fight 展示页，专门模仿原始名字竞技场与 fast-namerena 的战斗观感。
 * 左侧按队伍显示角色状态（HP/速度/体力），右侧按帧逐段追加战斗记录。
 *
 * 典型的 State 结构（来自 WASM）：
 * @typedef {{
 *   id: number,
 *   id_name: string,
 *   display_name: string,
 *   minion_kind?: 'clone' | 'summon' | 'shadow' | 'zombie',
 *   hp: number,
 *   max_hp: number,
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
 *   owner_id?: number,
 *   status_labels?: string[]
 * }} FightState
 *
 * 典型的 Player 结构（来自 WASM）：
 * @typedef {{
 *   id: number,
 *   team_index: number,
 *   id_name: string,
 *   display_name: string,
 *   icon_png_base64: string|null
 * }} FightPlayer
 *
 * 一次 Replay 的结构：
 * @typedef {{
 *   rawInput: string,
 *   seedLine?: string|null,
 *   players: FightPlayer[],
 *   initial_states: FightState[],
 *   frames: FrameUpdate[],
 *   winner_ids: number[],
 *   final_states: FightState[],
 *   wasmDurationMs: number
 * }} FightReplay
 *
 * 单帧更新的结构：
 * @typedef {{
 *   updates: FrameMessage[],
 *   states: FightState[],
 *   finished: boolean,
 *   winner_ids: number[],
 *   total_delay: number
 * }} FrameUpdate
 *
 * 单条消息的结构：
 * @typedef {{
 *   updateType?: string,
 *   messageRendered?: string,
 *   messageTemplate?: string,
 *   casterId?: number,
 *   targetId?: number,
 *   targetIds?: number[],
 *   param?: number,
 *   score?: number,
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
 *   deltaWidth: number
 * }} HpMetrics
 *
 * 涉及高亮的角色集合（用于 renderPlayers 的 involved 参数）：
 * @typedef {{
 *   casters: Set<number>,
 *   targets: Set<number>
 * }} InvolvedSet
 *
 * 消息色调：
 * @typedef {'normal' | 'damage' | 'recover' | 'knockout'} MessageTone
 *
 * 播放速度模式：
 * @typedef {'normal' | 'fast' | 'turbo'} SpeedMode
 */

import { buildIconClassCss, formatError, sleep, withTeamIconClassIds } from './show-utils.js';
import { renderIdleState, renderPlayers, buildFrameRows } from './show-render.js';
import {
    renderReplayIntro,
    updateSpeedButtons,
    playbackDelay,
    winnerNamesText,
    buildReplayResultTableHtml,
} from './show-replay.js';
import { ensureApi, buildReplay } from './show-wasm.js';

// ============================================================================
// 默认示例输入 — 可在页面中直接点击"示例"按钮填入
// ============================================================================

/** @type {string} */
const DEFAULT_RAW = `
云剑狄卡敢
白胡子

史莱姆
田一人
`.trim();

/** @type {string} localStorage 键名，用于跨会话记住用户输入 */
const INPUT_STORAGE_KEY = "tswn_wasm_show_input";

// ============================================================================
// DOM 元素引用
// ============================================================================

/** @type {HTMLElement} */
const playerList = document.querySelector("#playerList");
/** @type {HTMLElement} */
const battleRows = document.querySelector("#battleRows");
/** @type {HTMLInputElement} */
const inputName = document.querySelector("#input_name");
/** @type {HTMLElement} */
const inputPanel = document.querySelector("#inputPanel");
/** @type {HTMLElement} */
const endPanel = document.querySelector("#endPanel");
/** @type {HTMLElement} */
const inputStatus = document.querySelector("#inputStatus");
/** @type {HTMLElement} */
const plistMeta = document.querySelector("#plistMeta");
/** @type {HTMLElement} */
const headerMeta = document.querySelector("#headerMeta");
/** @type {HTMLElement} */
const winnerNames = document.querySelector("#winnerNames");
/** @type {HTMLElement} */
const winnerNote = document.querySelector("#winnerNote");

/** @type {HTMLElement} */
const versionInfo = document.querySelector("#versionInfo");
/** @type {HTMLElement} */
const coreVersionInfo = document.querySelector("#coreVersionInfo");
/** @type {HTMLElement} */
const modulePathInfo = document.querySelector("#modulePathInfo");

/** @type {HTMLButtonElement} */
const startBtn = document.querySelector("#startBtn");
/** @type {HTMLButtonElement} */
const sampleBtn = document.querySelector("#sampleBtn");
/** @type {HTMLButtonElement} */
const closeInputBtn = document.querySelector("#closeInputBtn");
/** @type {HTMLButtonElement} */
const closeEndBtn = document.querySelector("#closeEndBtn");
/** @type {HTMLButtonElement} */
const playAgainBtn = document.querySelector("#playAgainBtn");
/** @type {HTMLButtonElement} */
const editNamesBtn = document.querySelector("#editNamesBtn");
/** @type {HTMLButtonElement} */
const inputBtn = document.querySelector("#inputBtn");
/** @type {HTMLButtonElement} */
const fastBtn = document.querySelector("#fastBtn");
/** @type {HTMLButtonElement} */
const turboBtn = document.querySelector("#turboBtn");
/** @type {HTMLButtonElement} */
const pauseBtn = document.querySelector("#pauseBtn");
/** @type {HTMLButtonElement} */
const refreshBtn = document.querySelector("#refreshBtn");
/** @type {HTMLElement} */
const stepControls = document.querySelector("#stepControls");
/** @type {HTMLButtonElement} */
const stepBackEventBtn = document.querySelector("#stepBackEventBtn");
/** @type {HTMLButtonElement} */
const stepForwardEventBtn = document.querySelector("#stepForwardEventBtn");
/** @type {HTMLButtonElement} */
const stepBackFrameBtn = document.querySelector("#stepBackFrameBtn");
/** @type {HTMLButtonElement} */
const stepForwardFrameBtn = document.querySelector("#stepForwardFrameBtn");

// ============================================================================
// 全局状态
// ============================================================================

/** @type {FightReplay|null} 当前已生成的回放数据 */
let currentReplay = null;
/** @type {SpeedMode} 当前播放速度模式 */
let speedMode = 'normal';
/** @type {Map<number, FightPlayer>} playerId → 玩家对象的快速索引 */
let playersById = new Map();
const ICON_STYLE_ID = 'tswn-show-icon-styles';
const SEEK_CHECKPOINT_FRAME_INTERVAL = 20;
/** @type {{ frames: Array<{ frameIndex: number, frame: FrameUpdate, previousStates: FightState[], involved: InvolvedSet, start: number, end: number }>, flatChunks: Array<{ target: 'battleRows' | 'frameBody' | 'row' | 'delay', html: string, delay: number, frameIndex: number, visible: boolean }>, totalChunks: number }|null} */
let currentPlan = null;
/** @type {Map<number, { battleRowsHtml: string, playerListHtml: string, seedLine: string }>} */
let playbackCheckpoints = new Map();
/** @type {number} 当前已渲染到的 chunk 光标（指向“下一个要播放的 chunk”） */
let playbackCursor = 0;
/** @type {number} 用于打断旧播放循环的 token */
let playbackLoopToken = 0;
/** @type {number} 当前回放开始展示的时间戳 */
let playbackStartedAt = 0;
/** @type {boolean} 当前是否处于暂停态 */
let playbackPaused = false;
/** @type {boolean} 当前回放是否已完整结束 */
let playbackFinished = false;

// 页面初始化时尝试恢复上次保存的输入
restoreInputValue();

// ============================================================================
// 胶水函数（直接操作 DOM 或全局状态）
// ============================================================================

/**
 * 记住玩家列表，建立 id→player 的快速查找表。
 * 原地更新 Map（不替换引用），确保所有持有该 Map 引用的调用方都能看到最新数据。
 * @param {FightPlayer[]} players
 */
function rememberPlayers(players) {
    playersById.clear();
    for (const player of players) {
        playersById.set(player.id, player);
    }
    syncIconStyles(players);
}

function ensureIconStyleTag() {
    let styleEl = document.getElementById(ICON_STYLE_ID);
    if (!(styleEl instanceof HTMLStyleElement)) {
        styleEl = document.createElement('style');
        styleEl.id = ICON_STYLE_ID;
        document.head.append(styleEl);
    }
    return styleEl;
}

function syncIconStyles(players) {
    ensureIconStyleTag().textContent = buildIconClassCss(players);
}

function normalizeReplayPlayers(replay) {
    return {
        ...replay,
        players: withTeamIconClassIds(replay.players),
    };
}

/**
 * 设置输入面板下方的状态提示文本。
 * @param {string} message — 提示消息
 * @param {boolean} [isError=false] — 是否标记为错误样式
 */
function setInputStatus(message, isError = false) {
    inputStatus.textContent = message;
    inputStatus.classList.toggle("error", isError);
}

/**
 * 切换开始/示例按钮的 loading 态。
 * @param {boolean} loading
 */
function setLoading(loading) {
    startBtn.disabled = loading;
    sampleBtn.disabled = loading;
}

function stopPlaybackLoop() {
    playbackLoopToken += 1;
}

function buildInvolvedSet(frame) {
    const involved = { casters: new Set(), targets: new Set() };
    for (const update of frame.updates) {
        if (update.casterId != null) {
            involved.casters.add(update.casterId);
        }
        if (update.targetId != null) {
            involved.targets.add(update.targetId);
        }
        if (Array.isArray(update.targetIds)) {
            update.targetIds.forEach((id) => involved.targets.add(id));
        }
    }
    return involved;
}

function prepareReplayPlan(replay) {
    const workingPlayersById = new Map(replay.players.map((player) => [player.id, player]));
    let previousStates = replay.initial_states;
    const frames = replay.frames.map((frame, frameIndex) => {
        const framePlan = {
            frameIndex,
            frame,
            previousStates,
            involved: buildInvolvedSet(frame),
            start: 0,
            end: 0,
        };
        framePlan.chunks = buildFrameRows(frame, frameIndex, previousStates, workingPlayersById);
        previousStates = frame.states;
        return framePlan;
    });

    const flatChunks = [];
    for (const framePlan of frames) {
        framePlan.start = flatChunks.length;
        for (const chunk of framePlan.chunks) {
            flatChunks.push({
                ...chunk,
                frameIndex: framePlan.frameIndex,
                visible: chunk.target !== 'delay',
            });
        }
        framePlan.end = flatChunks.length;
    }

    return {
        frames,
        flatChunks,
        totalChunks: flatChunks.length,
    };
}

function currentFrameIndexFromCursor() {
    if (!currentPlan || currentPlan.frames.length === 0) {
        return 0;
    }
    const framePlan = currentPlan.frames.find((item) => playbackCursor < item.end);
    return framePlan ? framePlan.frameIndex : currentPlan.frames[currentPlan.frames.length - 1].frameIndex;
}

function syncPlaybackUi() {
    updateSpeedButtons(fastBtn, turboBtn, speedMode, currentReplay, headerMeta);

    pauseBtn.disabled = !currentReplay;
    pauseBtn.classList.toggle('is-paused', playbackPaused);

    const showStepControls = playbackPaused && !!currentReplay;
    stepControls.hidden = !showStepControls;

    const noReplay = !currentReplay;
    stepBackEventBtn.disabled = noReplay || !playbackPaused || playbackCursor <= 0;
    stepBackFrameBtn.disabled = noReplay || !playbackPaused || playbackCursor <= 0;
    stepForwardEventBtn.disabled = noReplay || !playbackPaused || !currentPlan || playbackCursor >= currentPlan.totalChunks;
    stepForwardFrameBtn.disabled = noReplay || !playbackPaused || !currentPlan || playbackCursor >= currentPlan.totalChunks;

    if (currentReplay) {
        if (playbackPaused) {
            headerMeta.textContent = `已暂停，可单步前后移动。当前位置：frame ${currentFrameIndexFromCursor()} / ${Math.max(0, currentReplay.frames.length - 1)}。`;
        } else if (playbackFinished) {
            headerMeta.textContent = `回放已结束，共 ${currentReplay.frames.length} 帧。`;
        }
    }
}

function scrollBattleToBottom() {
    const hbody = battleRows.closest('.hbody');
    if (hbody) {
        hbody.scrollTop = hbody.scrollHeight;
    }
}

function appendPlaybackChunk(chunk) {
    if (chunk.target === 'delay') {
        return;
    }

    if (chunk.target === 'battleRows') {
        battleRows.insertAdjacentHTML('beforeend', chunk.html);
    } else if (chunk.target === 'frameBody') {
        const frameBody = battleRows.lastElementChild?.querySelector('.frame-body');
        frameBody?.insertAdjacentHTML('beforeend', chunk.html);
    } else if (chunk.target === 'row') {
        const frameBody = battleRows.lastElementChild?.querySelector('.frame-body');
        const currentRow = frameBody?.lastElementChild;
        currentRow?.insertAdjacentHTML('beforeend', chunk.html);
    }

    scrollBattleToBottom();
}

function renderFrameSidebar(framePlan) {
    renderPlayers(
        currentReplay.players,
        framePlan.frame.states,
        framePlan.previousStates,
        framePlan.involved,
        playerList,
        playersById,
    );
}

function renderEndPanel(replay) {
    winnerNames.textContent = winnerNamesText(replay);
    winnerNote.textContent = '你可以重新播放当前回放，或者重新打开输入面板换一组名字。';
}

function resetPlaybackView(replay) {
    closePanel(endPanel);
    renderReplayIntro(replay, speedMode, playerList, battleRows, plistMeta, headerMeta, playersById, rememberPlayers);
}

function appendReplayResultBlock(replay) {
    const existing = battleRows.querySelector('.battle-result-block');
    if (existing) {
        existing.remove();
    }
    battleRows.insertAdjacentHTML(
        'beforeend',
        `<section class="battle-result-block">${buildReplayResultTableHtml(replay)}</section>`,
    );
    scrollBattleToBottom();
}

function findNearestPlaybackCheckpointCursor(cursor) {
    let bestCursor = 0;
    for (const checkpointCursor of playbackCheckpoints.keys()) {
        if (checkpointCursor <= cursor && checkpointCursor > bestCursor) {
            bestCursor = checkpointCursor;
        }
    }
    return bestCursor;
}

function restorePlaybackCheckpoint(cursor) {
    const checkpoint = playbackCheckpoints.get(cursor);
    if (!checkpoint) {
        return false;
    }

    closePanel(endPanel);
    battleRows.innerHTML = checkpoint.battleRowsHtml;
    playerList.innerHTML = checkpoint.playerListHtml;
    if (checkpoint.seedLine) {
        playerList.dataset.seedLine = checkpoint.seedLine;
    } else {
        delete playerList.dataset.seedLine;
    }
    return true;
}

function storePlaybackCheckpoint(cursor) {
    if (!currentPlan) {
        return;
    }

    const clampedCursor = Math.max(0, Math.min(cursor, currentPlan.totalChunks));
    playbackCheckpoints.set(clampedCursor, {
        battleRowsHtml: battleRows.innerHTML,
        playerListHtml: playerList.innerHTML,
        seedLine: playerList.dataset.seedLine ?? '',
    });
}

function maybeStoreFrameCheckpoint(framePlan) {
    if ((framePlan.frameIndex + 1) % SEEK_CHECKPOINT_FRAME_INTERVAL === 0) {
        storePlaybackCheckpoint(framePlan.end);
    }
}

function appendChunksBetween(startCursor, targetCursor) {
    if (!currentPlan || targetCursor <= startCursor) {
        return;
    }

    for (const framePlan of currentPlan.frames) {
        if (targetCursor <= framePlan.start) {
            break;
        }
        if (startCursor >= framePlan.end) {
            continue;
        }

        const chunkStart = Math.max(startCursor, framePlan.start);
        const limit = Math.min(targetCursor, framePlan.end);
        for (let chunkIndex = chunkStart; chunkIndex < limit; chunkIndex += 1) {
            appendPlaybackChunk(currentPlan.flatChunks[chunkIndex]);
        }

        if (targetCursor >= framePlan.end) {
            renderFrameSidebar(framePlan);
            maybeStoreFrameCheckpoint(framePlan);
            continue;
        }

        break;
    }
}

function renderPlaybackToCursor(cursor, { forceReset = false } = {}) {
    if (!currentReplay || !currentPlan) {
        return;
    }

    const previousCursor = playbackCursor;
    const wasFinished = playbackFinished;
    const targetCursor = Math.max(0, Math.min(cursor, currentPlan.totalChunks));
    playbackCursor = targetCursor;
    playbackFinished = playbackCursor >= currentPlan.totalChunks;

    if (forceReset) {
        resetPlaybackView(currentReplay);
        appendChunksBetween(0, targetCursor);
    } else if (targetCursor === previousCursor && wasFinished === playbackFinished) {
        // 游标没动且完成状态没变，无需重新渲染
        return;
    } else if (targetCursor !== previousCursor) {
        if (!wasFinished && targetCursor > previousCursor) {
            appendChunksBetween(previousCursor, targetCursor);
        } else {
            const checkpointCursor = findNearestPlaybackCheckpointCursor(targetCursor);
            if (checkpointCursor > 0 && restorePlaybackCheckpoint(checkpointCursor)) {
                appendChunksBetween(checkpointCursor, targetCursor);
            } else {
                resetPlaybackView(currentReplay);
                appendChunksBetween(0, targetCursor);
            }
        }
    }

    if (playbackFinished) {
        renderPlayers(currentReplay.players, currentReplay.final_states, currentReplay.final_states, null, playerList, playersById);
        renderEndPanel(currentReplay);
        appendReplayResultBlock(currentReplay);
        storePlaybackCheckpoint(playbackCursor);
    }

    if (playbackCursor === 0) {
        storePlaybackCheckpoint(0);
    }

    scrollBattleToBottom();
    syncPlaybackUi();
}

function resolveChunkDelay(frame, rawDelay) {
    if (speedMode === 'turbo') {
        return 0;
    }
    if (speedMode === 'fast') {
        const targetDelay = playbackDelay(frame, speedMode);
        return frame.total_delay > 0 ? Math.round((targetDelay * rawDelay) / frame.total_delay) : 0;
    }
    return rawDelay;
}

async function waitForPlaybackDelay(ms, token) {
    let remaining = ms;
    while (remaining > 0) {
        if (token !== playbackLoopToken || playbackPaused) {
            return false;
        }
        const slice = Math.min(remaining, 25);
        await sleep(slice);
        remaining -= slice;
    }
    return token === playbackLoopToken && !playbackPaused;
}

async function autoplayFromCurrentCursor() {
    if (!currentReplay || !currentPlan || playbackFinished) {
        syncPlaybackUi();
        return;
    }

    const token = ++playbackLoopToken;
    playbackPaused = false;
    syncPlaybackUi();

    while (playbackCursor < currentPlan.totalChunks) {
        if (token !== playbackLoopToken || playbackPaused) {
            return;
        }

        const chunk = currentPlan.flatChunks[playbackCursor];
        const framePlan = currentPlan.frames[chunk.frameIndex];
        appendPlaybackChunk(chunk);
        playbackCursor += 1;

        if (playbackCursor >= framePlan.end) {
            renderFrameSidebar(framePlan);
            maybeStoreFrameCheckpoint(framePlan);
        }

        if (speedMode === 'turbo' && chunk.visible && playbackCursor % 24 === 0) {
            await sleep(0);
            if (token !== playbackLoopToken || playbackPaused) {
                return;
            }
        }

        const delay = resolveChunkDelay(framePlan.frame, chunk.delay);
        if (delay > 0) {
            const completed = await waitForPlaybackDelay(delay, token);
            if (!completed) {
                return;
            }
        }
    }

    if (token !== playbackLoopToken) {
        return;
    }

    playbackFinished = true;
    renderPlayers(currentReplay.players, currentReplay.final_states, currentReplay.final_states, null, playerList, playersById);
    renderEndPanel(currentReplay);
    appendReplayResultBlock(currentReplay);
    storePlaybackCheckpoint(playbackCursor);
    syncPlaybackUi();
}

function beginReplayPlayback(replay) {
    currentReplay = replay;
    currentPlan = prepareReplayPlan(replay);
    playbackCheckpoints = new Map();
    playbackCursor = 0;
    playbackPaused = false;
    playbackFinished = false;
    playbackStartedAt = performance.now();
    stopPlaybackLoop();
    renderPlaybackToCursor(0, { forceReset: true });
    void autoplayFromCurrentCursor();
}

function nextVisibleCursor(cursor) {
    if (!currentPlan) {
        return cursor;
    }
    for (let index = cursor; index < currentPlan.totalChunks; index += 1) {
        if (currentPlan.flatChunks[index].visible) {
            return index + 1;
        }
    }
    return currentPlan.totalChunks;
}

function previousVisibleCursor(cursor) {
    if (!currentPlan) {
        return cursor;
    }
    for (let index = Math.min(cursor, currentPlan.totalChunks) - 1; index >= 0; index -= 1) {
        if (currentPlan.flatChunks[index].visible) {
            return index;
        }
    }
    return 0;
}

function nextFrameCursor(cursor) {
    if (!currentPlan) {
        return cursor;
    }
    for (const framePlan of currentPlan.frames) {
        if (cursor < framePlan.end) {
            return framePlan.end;
        }
    }
    return currentPlan.totalChunks;
}

function previousFrameCursor(cursor) {
    if (!currentPlan) {
        return cursor;
    }
    for (let index = currentPlan.frames.length - 1; index >= 0; index -= 1) {
        const framePlan = currentPlan.frames[index];
        if (cursor > framePlan.start) {
            return index > 0 ? currentPlan.frames[index - 1].end : 0;
        }
    }
    return 0;
}

function pausePlayback() {
    if (!currentReplay) {
        return;
    }
    if (speedMode !== 'normal') {
        speedMode = 'normal';
    }
    playbackPaused = true;
    stopPlaybackLoop();
    syncPlaybackUi();
}

function resumePlayback() {
    if (!currentReplay) {
        return;
    }

    if (playbackFinished) {
        playbackPaused = false;
        syncPlaybackUi();
        return;
    }

    playbackPaused = false;
    syncPlaybackUi();
    void autoplayFromCurrentCursor();
}

function togglePausePlayback() {
    if (!currentReplay) {
        return;
    }
    if (playbackPaused) {
        resumePlayback();
    } else {
        pausePlayback();
    }
}

function stepPlaybackTo(cursor) {
    if (!currentReplay || !currentPlan) {
        return;
    }
    playbackPaused = true;
    stopPlaybackLoop();
    renderPlaybackToCursor(cursor);
}

function resumeWithSpeed(nextSpeedMode) {
    speedMode = nextSpeedMode;
    if (playbackPaused && currentReplay && !playbackFinished) {
        resumePlayback();
    } else {
        syncPlaybackUi();
    }
}

// ============================================================================
// localStorage 持久化
// ============================================================================

/** 从 localStorage 恢复上次输入，若无则使用默认示例 */
function restoreInputValue() {
    try {
        const savedValue = window.localStorage.getItem(INPUT_STORAGE_KEY)?.trim();
        inputName.value = savedValue ? savedValue : DEFAULT_RAW;
    } catch {
        inputName.value = DEFAULT_RAW;
    }
}

/** 将当前输入框内容持久化到 localStorage */
function persistInputValue() {
    try {
        window.localStorage.setItem(INPUT_STORAGE_KEY, inputName.value);
    } catch {
        // 即使存储不可用，内存中的输入仍然可用。
    }
}

// ============================================================================
// 面板开关
// ============================================================================

/**
 * 打开指定面板（设置 hidden=false）。
 * @param {HTMLElement} panel
 */
function openPanel(panel) {
    panel.hidden = false;
}

/**
 * 关闭指定面板（设置 hidden=true）。
 * @param {HTMLElement} panel
 */
function closePanel(panel) {
    panel.hidden = true;
}

/**
 * 打开输入编辑面板，可选是否全选文本。
 * @param {boolean} [selectAll=false] — 是否自动全选输入框内容
 */
function openInputEditor(selectAll = false) {
    openPanel(inputPanel);
    window.requestAnimationFrame(() => {
        inputName.focus();
        if (selectAll) {
            inputName.select();
        }
    });
}

// ============================================================================
// 回放播放主循环
// ============================================================================

/**
 * 自动播放整场回放。
 * — normal/fast 模式：逐段渲染 DOM 并等待逐段 delay
 * — turbo 模式：批量缓冲 HTML，约每 16ms 写入一次 DOM 并让出主线程
 *
 * @param {FightReplay} replay
 * @returns {Promise<void>}
 */
/**
 * 开始一场新战斗：校验输入 → 生成回放 → 自动播放。
 * @returns {Promise<void>}
 */
async function startBattle() {
    const rawInput = inputName.value.trim();
    if (!rawInput) {
        setInputStatus("请输入至少一个名字。", true);
        openInputEditor();
        return;
    }

    persistInputValue();
    stopPlaybackLoop();
    playbackPaused = false;
    playbackFinished = false;
    setLoading(true);
    setInputStatus("正在生成回放，请稍候...");
    closePanel(endPanel);

    try {
        currentReplay = normalizeReplayPlayers(await buildReplay(rawInput, versionInfo, coreVersionInfo, modulePathInfo));
        setInputStatus("回放已生成，开始自动播放。");
        closePanel(inputPanel);
        beginReplayPlayback(currentReplay);
    } catch (error) {
        setInputStatus(formatError(error), true);
        openInputEditor();
    } finally {
        setLoading(false);
    }
}

/**
 * 重播当前回放（不重新生成）。
 * @returns {Promise<void>}
 */
async function replayCurrent() {
    if (!currentReplay) {
        openInputEditor();
        return;
    }
    beginReplayPlayback(currentReplay);
}

// ============================================================================
// 事件绑定
// ============================================================================

// 示例按钮：填入默认示例输入
sampleBtn.addEventListener("click", () => {
    inputName.value = DEFAULT_RAW;
    persistInputValue();
    setInputStatus("已填入示例输入。");
    openInputEditor(true);
});

// 开始按钮：启动战斗
startBtn.addEventListener("click", () => {
    void startBattle();
});

// 再来一局：关闭结束面板，重播当前回放
playAgainBtn.addEventListener("click", () => {
    closePanel(endPanel);
    void replayCurrent();
});

// 刷新按钮：重播当前回放
refreshBtn.addEventListener("click", () => {
    void replayCurrent();
});

pauseBtn.addEventListener("click", () => {
    togglePausePlayback();
});

// 输入按钮：打开输入编辑面板
inputBtn.addEventListener("click", () => {
    openInputEditor();
});

// 编辑名字按钮：关闭结束面板并打开输入编辑
editNamesBtn.addEventListener("click", () => {
    closePanel(endPanel);
    openInputEditor(true);
});

// 快进按钮：切换 normal ↔ fast
fastBtn.addEventListener("click", () => {
    if (playbackPaused && currentReplay && !playbackFinished) {
        resumeWithSpeed('fast');
        return;
    }
    speedMode = speedMode === 'fast' ? 'normal' : 'fast';
    syncPlaybackUi();
});

// 极速按钮：切换 normal ↔ turbo
turboBtn.addEventListener("click", () => {
    if (playbackPaused && currentReplay && !playbackFinished) {
        resumeWithSpeed('turbo');
        return;
    }
    speedMode = speedMode === 'turbo' ? 'normal' : 'turbo';
    syncPlaybackUi();
});

stepBackEventBtn.addEventListener('click', () => {
    stepPlaybackTo(previousVisibleCursor(playbackCursor));
});

stepForwardEventBtn.addEventListener('click', () => {
    stepPlaybackTo(nextVisibleCursor(playbackCursor));
});

stepBackFrameBtn.addEventListener('click', () => {
    stepPlaybackTo(previousFrameCursor(playbackCursor));
});

stepForwardFrameBtn.addEventListener('click', () => {
    stepPlaybackTo(nextFrameCursor(playbackCursor));
});

// 键盘快捷键
document.addEventListener('keydown', (event) => {
    if (event.key === ' ') {
        if (!currentReplay) return;
        togglePausePlayback();
        event.preventDefault();
        return;
    }
    if (!playbackPaused || !currentReplay) {
        return;
    }
    switch (event.key) {
        case 'ArrowLeft':
            stepPlaybackTo(previousVisibleCursor(playbackCursor));
            event.preventDefault();
            break;
        case 'ArrowRight':
            stepPlaybackTo(nextVisibleCursor(playbackCursor));
            event.preventDefault();
            break;
        case 'ArrowUp':
            stepPlaybackTo(previousFrameCursor(playbackCursor));
            event.preventDefault();
            break;
        case 'ArrowDown':
            stepPlaybackTo(nextFrameCursor(playbackCursor));
            event.preventDefault();
            break;
    }
});

// 关闭输入面板（仅在已有回放时允许关闭）
closeInputBtn.addEventListener("click", () => {
    if (currentReplay) {
        closePanel(inputPanel);
    }
});

// 关闭结束面板
closeEndBtn.addEventListener("click", () => {
    closePanel(endPanel);
});

// 输入框内容变化时自动持久化
inputName.addEventListener("input", () => {
    persistInputValue();
});

// Ctrl+Enter / Cmd+Enter 快捷开始
inputName.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        void startBattle();
    }
});

// ============================================================================
// 入口
// ============================================================================

/**
 * 页面入口：渲染空闲 UI，初始化 WASM 模块。
 * @returns {Promise<void>}
 */
async function main() {
    renderIdleState(playerList, battleRows, plistMeta, headerMeta);
    syncPlaybackUi();
    setInputStatus("会使用 show 风格自动播放整场战斗。");
    openInputEditor();

    try {
        await ensureApi(versionInfo, coreVersionInfo, modulePathInfo);
        setInputStatus("tswn_wasm 已初始化，可以开始。");
    } catch (error) {
        setInputStatus(`模块加载失败: ${formatError(error)}`, true);
    }
}

void main();
