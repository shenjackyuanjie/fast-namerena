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
 *   icon_key: string,
 *   display_name: string,
 *   display_index: number,
 *   icon_png_base64?: string|null,
 *   icon_class_id?: number,
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
 *   deltaWidth: number
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

import {
  buildIconClassCss,
  escapeHtml,
  formatError,
  replayDisplayName,
  sleep,
  validateReplayInput,
} from "./show-utils.js";
import { renderIdleState, renderPlayers } from "./show-render.js";
import {
  createReplayPlan,
  appendFrameToReplayPlan,
  markReplayPlanComplete,
  renderReplayIntro,
  updateSpeedButtons,
  playbackDelay,
  buildReplayResultTableHtml,
} from "./show-replay.js";
import {
  buildShowShareUrl,
  readStaticReplayInputFromSearch,
} from "./show-routing.js";
import { ensureApi, createBattleStreamSource } from "./show-wasm.js";

import { BattleStreamController } from "./show-stream.js";
import { BattleDisplay } from "./show-display.js";
import { BattleMetrics } from "./show-metrics.js";

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
/** @type {string} localStorage 键名，用于按原始 id_name 保存自定义昵称 */
const NICKNAME_STORAGE_KEY = "tswn_wasm_show_nicknames";
/** @type {SpeedMode} 新战斗默认播放速度 */
const DEFAULT_SPEED_MODE = "normal";
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
const detailPanel = document.querySelector("#detailPanel");
/** @type {HTMLElement} */
const inputStatus = document.querySelector("#inputStatus");
/** @type {HTMLElement} */
const plistMeta = document.querySelector("#plistMeta");
/** @type {HTMLElement} */
const headerMeta = document.querySelector("#headerMeta");
/** @type {HTMLElement} */
const detailContent = document.querySelector("#detailContent");
/** @type {HTMLInputElement} */
const nicknameInput = document.querySelector("#nicknameInput");

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
const closeDetailBtn = document.querySelector("#closeDetailBtn");
/** @type {HTMLButtonElement} */
const saveNicknameBtn = document.querySelector("#saveNicknameBtn");
/** @type {HTMLButtonElement} */
const clearNicknameBtn = document.querySelector("#clearNicknameBtn");
/** @type {HTMLButtonElement} */
const playAgainBtn = document.querySelector("#playAgainBtn");
/** @type {HTMLButtonElement} */
const editNamesBtn = document.querySelector("#editNamesBtn");
/** @type {HTMLButtonElement} */
const inputBtn = document.querySelector("#inputBtn");
/** @type {HTMLButtonElement} */
const normalBtn = document.querySelector("#normalBtn");
/** @type {HTMLButtonElement} */
const fastBtn = document.querySelector("#fastBtn");
/** @type {HTMLButtonElement} */
const turboBtn = document.querySelector("#turboBtn");
/** @type {HTMLButtonElement} */
const pauseBtn = document.querySelector("#pauseBtn");
/** @type {HTMLButtonElement} */
const refreshBtn = document.querySelector("#refreshBtn");
/** @type {HTMLButtonElement} */
const shareBtn = document.querySelector("#shareBtn");
/** @type {HTMLElement} */
const shareToast = document.querySelector("#shareToast");
/** @type {HTMLButtonElement} */
const themeBtn = document.querySelector("#themeBtn");
/** @type {SVGElement} */
const themeLightIcon = document.querySelector("#themeLightIcon");
/** @type {SVGElement} */
const themeDarkIcon = document.querySelector("#themeDarkIcon");
/** @type {HTMLElement} */
const rightControls = document.querySelector("#rightControls");
/** @type {HTMLButtonElement} */
const toggleControlsBtn = document.querySelector("#toggleControlsBtn");
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
let currentBattle = null;
let streamController = null;
let battleDisplay = null;
let battleMetrics = null;
let metricsReported = false;
let streamError = null;
let battleGenerationToken = 0;
/** @type {FightState[]} 当前左侧面板对应的状态快照 */
let currentVisibleStates = [];
/** @type {number|null} 当前详情面板打开的 playerId */
let currentDetailPlayerId = null;
/** @type {Map<string, string>} id_name → 自定义昵称 */
let nicknameByIdName = new Map();
/** @type {SpeedMode} 当前播放速度模式 */
let speedMode = DEFAULT_SPEED_MODE;
/** @type {Map<number, FightPlayer>} playerId → 玩家对象的快速索引 */
let playersById = new Map();
const ICON_STYLE_ID = "tswn-show-icon-styles";
const SEEK_CHECKPOINT_FRAME_INTERVAL = 20;
const NORMAL_RESULT_REVEAL_DELAY_MS = 1500;
const TURBO_YIELD_VISIBLE_CHUNKS = 24;
/** @type {{ frames: Array<{ frameIndex: number, frame: FrameUpdate, previousStates: FightState[], start: number, end: number }>, flatChunks: Array<{ target: 'battleRows' | 'frameBody' | 'row' | 'delay', html: string, delay: number, frameIndex: number, visible: boolean, sidebarStates?: FightState[], sidebarPreviousStates?: FightState[], sidebarInvolved?: InvolvedSet }>, totalChunks: number }|null} */
let currentPlan = null;
/** @type {Map<number, { battle_rows_html: string, player_list_html: string, seed_line: string }>} */
let playbackCheckpoints = new Map();
/** @type {number} 当前已渲染到的 chunk 光标（指向“下一个要播放的 chunk”） */
let playbackCursor = 0;
let historyResumeBoundary = 0;
/** @type {number} 用于打断旧播放循环的 token */
let playbackLoopToken = 0;
/** @type {number} 当前回放开始展示的时间戳 */
let playbackStartedAt = 0;
/** @type {boolean} 当前是否处于暂停态 */
let playbackPaused = false;
/** @type {boolean} 当前回放是否已完整结束 */
let playbackFinished = false;
/** @type {boolean} 右下角控制组是否收起 */
let rightControlsCollapsed = window.matchMedia("(max-width: 640px)").matches;
/** @type {number|null} 分享复制提示的隐藏定时器 */
let shareToastTimer = null;
const themeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
const THEME_STORAGE_KEY = "tswn-show-theme";

function currentTheme() {
  return document.documentElement.dataset.theme ?? (themeMediaQuery.matches ? "dark" : "light");
}

function syncThemeUi() {
  const isDark = currentTheme() === "dark";
  themeLightIcon.toggleAttribute("hidden", !isDark);
  themeDarkIcon.toggleAttribute("hidden", isDark);
  const label = isDark ? "切换到浅色模式" : "切换到深色模式";
  themeBtn.title = label;
  themeBtn.setAttribute("aria-label", label);
  themeBtn.setAttribute("aria-pressed", String(isDark));
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themeSource = "user";
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // 存储不可用时仍保留本次页面会话的主题。
  }
  syncThemeUi();
}

syncThemeUi();
themeMediaQuery.addEventListener("change", () => {
  if (document.documentElement.dataset.themeSource === "system") {
    document.documentElement.dataset.theme = themeMediaQuery.matches ? "dark" : "light";
    syncThemeUi();
  }
});
// 页面初始化时尝试恢复上次保存的输入
restoreInputValue();
restoreNicknameMap();

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
  syncIconStyles(battleDisplay?.iconEntries() ?? []);
}

function ensureIconStyleTag() {
  let styleEl = document.getElementById(ICON_STYLE_ID);
  if (!(styleEl instanceof HTMLStyleElement)) {
    styleEl = document.createElement("style");
    styleEl.id = ICON_STYLE_ID;
    document.head.append(styleEl);
  }
  return styleEl;
}

function syncIconStyles(iconEntries) {
  ensureIconStyleTag().textContent = buildIconClassCss(iconEntries);
}

function actorNicknameKey(actor) {
  return `${actor?.id_name ?? actor?._raw_display_name ?? actor?.display_name ?? ""}`.trim();
}

function baseNicknameKey(key) {
  return `${key ?? ""}`
    .trim()
    .replace(/\s+#\d+$/, "")
    .replace(/\?\d+(?=@|$)/, "");
}

function nicknameForKey(key) {
  const normalizedKey = `${key ?? ""}`.trim();
  if (!normalizedKey) {
    return "";
  }
  return nicknameByIdName.get(normalizedKey) ?? nicknameByIdName.get(baseNicknameKey(normalizedKey)) ?? "";
}

function currentStateById(playerId) {
  const visibleState = currentVisibleStates.find((state) => state.id === playerId);
  if (visibleState) {
    return visibleState;
  }
  if (!currentBattle) {
    return null;
  }
  for (const frame of [...(currentBattle.frames ?? [])].reverse()) {
    const state = frame.states?.find((candidate) => candidate.id === playerId);
    if (state) {
      return state;
    }
  }
  return (
    currentBattle.final_states?.find((state) => state.id === playerId) ??
    currentBattle.initial_states?.find((state) => state.id === playerId) ??
    null
  );
}

function inputPlayerById(playerId) {
  return currentBattle?.players?.find((player) => player.id === playerId) ?? null;
}

function visibleStatesForCursor(cursor) {
  if (!currentBattle || !currentPlan) {
    return [];
  }
  if (currentBattle.source_done && cursor >= currentPlan.totalChunks) {
    return currentBattle.final_states;
  }

  let states = currentBattle.initial_states;
  for (const framePlan of currentPlan.frames) {
    if (cursor >= framePlan.end) {
      states = framePlan.frame.states;
      continue;
    }
    if (cursor > framePlan.start) {
      const lastChunkIndex = Math.min(cursor, framePlan.end) - 1;
      for (let index = lastChunkIndex; index >= framePlan.start; index -= 1) {
        const chunk = currentPlan.flatChunks[index];
        if (Array.isArray(chunk?.sidebarStates)) {
          return chunk.sidebarStates;
        }
      }
    }
    break;
  }
  return states;
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

function clearCurrentReplayView() {
  clearPlayerHighlight();
  streamController?.dispose();
  streamController = null;
  battleDisplay = null;
  streamError = null;
  currentBattle = null;
  currentPlan = null;
  playbackCheckpoints = new Map();
  playbackCursor = 0;
  historyResumeBoundary = 0;
  playbackPaused = true;
  playbackFinished = false;
  currentVisibleStates = [];
  closePanel(endPanel);
  closePanel(detailPanel);
  renderIdleState(playerList, battleRows, plistMeta, headerMeta);
  syncPlaybackUi();
}

function stopPlaybackLoop() {
  playbackLoopToken += 1;
}

function prepareReplayPlan(replay) {
  const display = battleDisplay.battle(replay);
  const plan = createReplayPlan(display.initial_states);
  const workingPlayersById = new Map(display.players.map((player) => [player.id, player]));
  let previousStates = display.initial_states;
  for (const frame of replay.frames) {
    const displayFrame = battleDisplay.frame(frame);
    appendFrameToReplayPlan(plan, displayFrame, previousStates, workingPlayersById);
    previousStates = displayFrame.states;
  }
  if (replay.source_done) markReplayPlanComplete(plan, replay.result);
  return plan;
}

function currentFrameIndexFromCursor() {
  if (!currentPlan || currentPlan.frames.length === 0) {
    return 0;
  }
  const framePlan = currentPlan.frames.find((item) => playbackCursor < item.end);
  return framePlan
    ? framePlan.frameIndex
    : currentPlan.frames[currentPlan.frames.length - 1].frameIndex;
}

function syncPlaybackUi() {
  updateSpeedButtons(
    normalBtn,
    fastBtn,
    pauseBtn,
    playbackPaused,
    speedMode,
    currentBattle,
    headerMeta,
  );

  pauseBtn.disabled = !currentBattle;
  shareBtn.disabled = !currentBattle;
  pauseBtn.classList.toggle("is-paused", playbackPaused);

  stepControls.hidden = false;

  const noReplay = !currentBattle;
  stepBackEventBtn.disabled = noReplay || playbackCursor <= 0;
  stepBackFrameBtn.disabled = noReplay || playbackCursor <= 0;
  stepForwardEventBtn.disabled =
    noReplay || !currentPlan || (currentBattle.source_done && playbackCursor >= currentPlan.totalChunks);
  stepForwardFrameBtn.disabled =
    noReplay || !currentPlan || (currentBattle.source_done && playbackCursor >= currentPlan.totalChunks);

  if (currentBattle) {
    const teamCount = new Set(currentBattle.players.map(player => player.team_index)).size;
    plistMeta.textContent = `${currentBattle.players.length} 名角色 · ${teamCount} 支队伍 · 已接收 ${currentBattle.frames.length} 帧。`;
  }
  if (streamError) {
    headerMeta.textContent = `战斗读取失败：${formatError(streamError)}`;
  } else if (currentBattle) {
    if (playbackFinished) {
      headerMeta.textContent = `回放已结束，共 ${currentBattle.frames.length} 帧。`;
    } else if (playbackPaused) {
      headerMeta.textContent = `已暂停，可单步前后移动。当前位置：frame ${currentFrameIndexFromCursor()} / ${Math.max(0, currentBattle.frames.length - 1)}。`;
    }
  }
}

function syncRightControlsUi() {
  rightControls.classList.toggle("is-collapsed", rightControlsCollapsed);
  toggleControlsBtn.setAttribute("aria-expanded", String(!rightControlsCollapsed));
  const label = rightControlsCollapsed ? "展开控制按钮" : "收起控制按钮";
  toggleControlsBtn.title = label;
  toggleControlsBtn.setAttribute("aria-label", label);
}

function toggleRightControls() {
  rightControlsCollapsed = !rightControlsCollapsed;
  syncRightControlsUi();
}

function scrollBattleToBottom() {
  const hbody = battleRows.closest(".hbody");
  if (hbody) {
    hbody.scrollTop = hbody.scrollHeight;
  }
}

function appendPlaybackChunk(chunk) {
  if (chunk.target === "delay") {
    return;
  }

  const renderStart = performance.now();
  if (chunk.target === "battleRows") {
    battleRows.insertAdjacentHTML("beforeend", chunk.html);
  } else if (chunk.target === "frameBody") {
    const frameBody = battleRows.lastElementChild?.querySelector(".frame-body");
    frameBody?.insertAdjacentHTML("beforeend", chunk.html);
  } else if (chunk.target === "row") {
    const frameBody = battleRows.lastElementChild?.querySelector(".frame-body");
    const currentRow = frameBody?.lastElementChild;
    currentRow?.insertAdjacentHTML("beforeend", chunk.html);
  }

  scrollBattleToBottom();
  renderChunkSidebar(chunk);
  battleMetrics?.chunkRendered(performance.now() - renderStart);
}

function renderSidebarSnapshot(states, previousStates, involved) {
  currentVisibleStates = battleDisplay.states(states);
  renderPlayers(
    battleDisplay.states(currentBattle.players),
    currentVisibleStates,
    battleDisplay.states(previousStates),
    involved,
    playerList,
    playersById,
  );
}

function renderChunkSidebar(chunk) {
  if (!currentBattle || !Array.isArray(chunk.sidebarStates)) {
    return;
  }
  renderSidebarSnapshot(
    chunk.sidebarStates,
    chunk.sidebarPreviousStates ?? chunk.sidebarStates,
    chunk.sidebarInvolved ?? null,
  );
}

function lastSidebarChunkForFrame(framePlan) {
  if (!currentPlan) {
    return null;
  }
  for (let index = framePlan.end - 1; index >= framePlan.start; index -= 1) {
    const chunk = currentPlan.flatChunks[index];
    if (Array.isArray(chunk?.sidebarStates)) {
      return chunk;
    }
  }
  return null;
}

function renderFrameSidebar(framePlan) {
  const lastSidebarChunk = lastSidebarChunkForFrame(framePlan);
  renderSidebarSnapshot(
    framePlan.frame.states,
    lastSidebarChunk?.sidebarPreviousStates ?? framePlan.previousStates,
    null,
  );
}

function resetPlaybackView(replay) {
  replay = battleDisplay.battle(replay);
  clearPlayerHighlight();
  closePanel(endPanel);
  currentVisibleStates = replay.initial_states;
  renderReplayIntro(
    replay,
    speedMode,
    playerList,
    battleRows,
    plistMeta,
    headerMeta,
    playersById,
    rememberPlayers,
  );
}

function appendReplayResultBlock(replay) {
  const existing = battleRows.querySelector(".battle-result-block");
  if (existing) {
    existing.remove();
  }
  battleRows.insertAdjacentHTML(
    "beforeend",
    `<section class="battle-result-block">${buildReplayResultTableHtml(battleDisplay.battle(replay))}</section>`,
  );
  scrollBattleToBottom();
  reportBattleMetrics();
}

function reportBattleMetrics() {
  if (!metricsReported && battleMetrics && currentBattle?.source_done) {
    metricsReported = true;
    if (new URLSearchParams(window.location.search).get("perf") === "1") {
      console.table(battleMetrics.snapshot());
    }
  }
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
  battleRows.innerHTML = checkpoint.battle_rows_html;
  playerList.innerHTML = checkpoint.player_list_html;
  if (checkpoint.seed_line) {
    playerList.dataset.seedLine = checkpoint.seed_line;
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
    battle_rows_html: battleRows.innerHTML,
    player_list_html: playerList.innerHTML,
    seed_line: playerList.dataset.seedLine ?? "",
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
  if (!currentBattle || !currentPlan) {
    return;
  }

  const previousCursor = playbackCursor;
  const wasFinished = playbackFinished;
  const targetCursor = Math.max(0, Math.min(cursor, currentPlan.totalChunks));
  playbackCursor = targetCursor;
  playbackFinished = currentBattle.source_done && playbackCursor >= currentPlan.totalChunks;

  if (forceReset) {
    resetPlaybackView(currentBattle);
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
        resetPlaybackView(currentBattle);
        appendChunksBetween(0, targetCursor);
      }
    }
  }

  if (playbackFinished) {
    renderSidebarSnapshot(currentBattle.final_states, currentBattle.final_states, null);
    appendReplayResultBlock(currentBattle);
    storePlaybackCheckpoint(playbackCursor);
  }

  if (playbackCursor === 0) {
    storePlaybackCheckpoint(0);
  }

  if (!playbackFinished) {
    currentVisibleStates = battleDisplay.states(visibleStatesForCursor(playbackCursor));
  }
  scrollBattleToBottom();
  syncPlaybackUi();
}

function resolveChunkDelay(frame, rawDelay) {
  if (speedMode === "turbo") {
    return 0;
  }
  if (speedMode === "fast") {
    const targetDelay = playbackDelay(frame, speedMode);
    return frame.total_delay > 0 ? Math.round((targetDelay * rawDelay) / frame.total_delay) : 0;
  }
  // normal 模式直接使用 core replay view 给出的句子级延迟。
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
  if (!currentBattle || !currentPlan || (playbackFinished && battleRows.querySelector(".battle-result-block"))) {
    syncPlaybackUi();
    return;
  }

  const token = ++playbackLoopToken;
  let turboVisibleChunks = 0;
  playbackPaused = false;
  streamController?.setPaused(false);
  syncPlaybackUi();

  while (true) {
    if (token !== playbackLoopToken || playbackPaused) {
      return;
    }

    if (playbackCursor >= currentPlan.totalChunks) {
      if (currentBattle.source_done) break;
      if (streamError) { pausePlayback(); return; }
      try { await streamController.ensureFrame(currentBattle.frames.length); }
      catch { return; }
      if (token !== playbackLoopToken || playbackPaused) return;
      continue;
    }
    const chunk = currentPlan.flatChunks[playbackCursor];
    const framePlan = currentPlan.frames[chunk.frameIndex];
    if (!streamError) streamController?.setPlaybackFrame(framePlan.frameIndex);
    if (playbackCursor >= historyResumeBoundary) {
      void streamController?.ensureBuffered().catch(() => {});
    }
    const delay =
      playbackCursor === 0 && speedMode === "normal"
        ? 0
        : resolveChunkDelay(framePlan.frame, chunk.delay);
    if (delay > 0) {
      const completed = await waitForPlaybackDelay(delay, token);
      if (!completed) {
        return;
      }
    }

    appendPlaybackChunk(chunk);
    playbackCursor += 1;

    if (playbackCursor >= framePlan.end) {
      renderFrameSidebar(framePlan);
      maybeStoreFrameCheckpoint(framePlan);
    }

    if (speedMode === "turbo" && chunk.visible && ++turboVisibleChunks % TURBO_YIELD_VISIBLE_CHUNKS === 0) {
      await sleep(0);
      if (token !== playbackLoopToken || playbackPaused) {
        return;
      }
    }
  }

  if (token !== playbackLoopToken) {
    return;
  }

  playbackFinished = true;
  renderSidebarSnapshot(currentBattle.final_states, currentBattle.final_states, null);
  if (speedMode === "normal") {
    const completed = await waitForPlaybackDelay(NORMAL_RESULT_REVEAL_DELAY_MS, token);
    if (!completed) {
      return;
    }
  }
  appendReplayResultBlock(currentBattle);
  storePlaybackCheckpoint(playbackCursor);
  playbackPaused = true;
  streamController?.setPaused(true);
  // turbo 是一次性按钮：播完后自动回到暂停态。
  if (speedMode === "turbo") {
    playbackPaused = true;
    speedMode = "normal";
  }
  syncPlaybackUi();
}

function beginReplayPlayback(replay, { autoPlay = true } = {}) {
  currentBattle = replay;
  currentPlan = prepareReplayPlan(replay);
  playbackCheckpoints = new Map();
  playbackCursor = 0;
  historyResumeBoundary = currentPlan.totalChunks;
  playbackPaused = false;
  playbackFinished = false;
  playbackStartedAt = performance.now();
  stopPlaybackLoop();
  if (!streamError) streamController?.setPlaybackFrame(-1);
  renderPlaybackToCursor(0, { forceReset: true });
  if (autoPlay !== false) {
    void autoplayFromCurrentCursor();
  }
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
  if (!currentBattle) {
    return;
  }
  playbackPaused = true;
  streamController?.setPaused(true);
  stopPlaybackLoop();
  syncPlaybackUi();
}

function resumePlayback() {
  if (!currentBattle) {
    return;
  }

  if (playbackFinished && battleRows.querySelector(".battle-result-block")) {
    syncPlaybackUi();
    return;
  }

  playbackPaused = false;
  syncPlaybackUi();
  void autoplayFromCurrentCursor();
}

function togglePausePlayback() {
  if (!currentBattle) {
    return;
  }
  if (playbackPaused) {
    resumePlayback();
  } else {
    pausePlayback();
  }
}

function stepPlaybackTo(cursor) {
  if (!currentBattle || !currentPlan) {
    return;
  }
  playbackPaused = true;
  streamController?.setPaused(true);
  stopPlaybackLoop();
  if (cursor < playbackCursor) historyResumeBoundary = currentPlan.totalChunks;
  renderPlaybackToCursor(cursor);
  const frameIndex = currentPlan.frames.findLastIndex(frame => playbackCursor > frame.start);
  if (!streamError) streamController?.setPlaybackFrame(frameIndex);
}

async function stepPlaybackForward(byFrame = false) {
  if (!currentBattle || !currentPlan) return;
  pausePlayback();
  const generation = battleGenerationToken;
  const token = playbackLoopToken;
  if (playbackCursor >= currentPlan.totalChunks && !currentBattle.source_done && !streamError) {
    try { await streamController.ensureFrame(currentBattle.frames.length); }
    catch { return; }
    if (generation !== battleGenerationToken || token !== playbackLoopToken) return;
  }
  stepPlaybackTo(byFrame ? nextFrameCursor(playbackCursor) : nextVisibleCursor(playbackCursor));
}

/**
 * @param {EventTarget|null} target
 * @returns {boolean}
 */
function isEditableKeyTarget(target) {
  if (!(target instanceof Element)) {
    return false;
  }
  if (target.closest("textarea, select, input")) {
    return true;
  }
  const editableTarget =
    target instanceof HTMLElement ? target : target.closest("[contenteditable]");
  return editableTarget instanceof HTMLElement && editableTarget.isContentEditable;
}

function showShareToast(message = "分享链接已复制") {
  if (shareToastTimer != null) {
    clearTimeout(shareToastTimer);
    shareToastTimer = null;
  }
  shareToast.textContent = message;
  shareToast.hidden = false;
  window.requestAnimationFrame(() => {
    shareToast.classList.add("is-visible");
  });
  shareToastTimer = window.setTimeout(() => {
    shareToast.classList.remove("is-visible");
    shareToastTimer = window.setTimeout(() => {
      shareToast.hidden = true;
      shareToastTimer = null;
    }, 180);
  }, 1600);
}

// ============================================================================
// URL 静态输入参数
// ============================================================================

/**
 * 将 URL-safe Base64 文本解码成 UTF-8 字符串。
 * @param {string} encoded
 * @returns {string}
 * @throws {Error} 当参数为空、Base64 不合法或 UTF-8 解码失败时抛出错误
 */
/**
 * 为当前对局输入生成分享链接。
 * @param {string} rawInput
 * @returns {string}
 */
function buildShareUrl(rawInput) {
  return buildShowShareUrl(rawInput, {
    href: window.location.href,
  });
}

/**
 * 复制文本到剪贴板，Clipboard API 不可用时使用 textarea fallback。
 * @param {string} text
 * @returns {Promise<void>}
 */
async function copyTextToClipboard(text) {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.append(textarea);
  textarea.select();
  try {
    if (!document.execCommand("copy")) {
      throw new Error("浏览器拒绝复制操作。");
    }
  } finally {
    textarea.remove();
  }
}

/**
 * 从当前页面 URL 中读取静态对局输入参数。
 * @returns {{ ok: true, input: string, paramName: string }|{ ok: false, message: string }|null}
 */
function readStaticReplayInputFromUrl() {
  return readStaticReplayInputFromSearch(window.location.search);
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

function restoreNicknameMap() {
  try {
    const raw = window.localStorage.getItem(NICKNAME_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    nicknameByIdName = new Map(
      Object.entries(parsed).filter(([, value]) => typeof value === "string" && value.trim()),
    );
  } catch {
    nicknameByIdName = new Map();
  }
}

function persistNicknameMap() {
  try {
    const data = Object.fromEntries([...nicknameByIdName.entries()].sort());
    window.localStorage.setItem(NICKNAME_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage 不可用时，当前页面内的昵称仍会生效。
  }
}

function detailValue(value, fallback = "-") {
  if (value == null || value === "") {
    return fallback;
  }
  return escapeHtml(value);
}

function detailNumber(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "-";
  }
  return Number.isInteger(number) ? String(number) : number.toFixed(digits);
}

function detailRow(label, value) {
  return `<dt>${escapeHtml(label)}</dt><dd>${value}</dd>`;
}

function buildPlayerDetailHtml(player, state, canEditNickname) {
  const source = state ?? player ?? null;
  const displayName = state ? replayDisplayName(state, state.id) : (player?.display_name ?? "未知角色");
  const rawName = player?._raw_display_name ?? state?._raw_display_name ?? displayName;
  const idName = player?.id_name ?? state?.id_name ?? "";
  const statusLabels = Array.isArray(source?.status_labels) ? source.status_labels.join("、") : "";
  const rows = [
    detailRow("原名", detailValue(rawName)),
    detailRow("ID 名", detailValue(idName)),
    detailRow("playerId", detailNumber(player?.id ?? source?.id)),
    detailRow("队伍", detailNumber(player?.team_index ?? source?.team_index)),
    detailRow("HP", source ? `${detailNumber(source.hp)} / ${detailNumber(source.max_hp)}` : "-"),
    detailRow("蓝量", detailNumber(source?.magic_point)),
    detailRow("体力", source ? `${detailNumber(((source.move_point ?? 0) / 2048) * 100, 0)}%` : "-"),
    detailRow("攻击", detailNumber(source?.attack)),
    detailRow("防御", detailNumber(source?.defense)),
    detailRow("速度", detailNumber(source?.speed)),
    detailRow("敏捷", detailNumber(source?.agility)),
    detailRow("魔力", detailNumber(source?.magic)),
    detailRow("抗性", detailNumber(source?.resistance)),
    detailRow("智慧", detailNumber(source?.wisdom)),
    detailRow("评价", detailNumber(source?.point)),
    detailRow("总和", detailNumber(source?.all_sum)),
    detailRow("短名系数", detailNumber(source?.name_factor)),
    detailRow("攻击加成", detailNumber(source?.at_boost)),
    detailRow("吸引", detailNumber(source?.attract)),
    detailRow("状态", detailValue(statusLabels)),
  ].join("");

  return `
    <div class="detail-name">${escapeHtml(displayName)}</div>
    <div class="detail-subtitle">${canEditNickname ? "昵称会按 ID 名持久化，并应用到当前及后续回放。" : "召唤物或临时单位暂不支持保存昵称。"}</div>
    <dl class="detail-grid">${rows}</dl>
  `;
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

function openPlayerDetail(playerId) {
  if (!currentBattle) {
    return;
  }
  pausePlayback();
  currentDetailPlayerId = playerId;
  const player = playersById.get(playerId) ?? inputPlayerById(playerId);
  const state = currentStateById(playerId);
  const inputPlayer = inputPlayerById(playerId);
  const key = inputPlayer ? actorNicknameKey(inputPlayer) : "";
  const canEditNickname = Boolean(inputPlayer && key);

  detailContent.innerHTML = buildPlayerDetailHtml(player ?? inputPlayer, state, canEditNickname);
  nicknameInput.disabled = !canEditNickname;
  saveNicknameBtn.disabled = !canEditNickname;
  clearNicknameBtn.disabled = !canEditNickname;
  nicknameInput.value = canEditNickname ? (nicknameByIdName.get(key) ?? "") : "";
  openPanel(detailPanel);
  window.requestAnimationFrame(() => {
    if (!nicknameInput.disabled) {
      nicknameInput.focus();
      nicknameInput.select();
    }
  });
}

function refreshCurrentReplayView() {
  if (!currentBattle || !currentPlan) {
    return;
  }
  currentPlan = prepareReplayPlan(currentBattle);
  playbackCheckpoints = new Map();
  renderPlaybackToCursor(playbackCursor, { forceReset: true });
}

function saveCurrentNickname() {
  if (currentDetailPlayerId == null || !currentBattle) {
    return;
  }
  const player = inputPlayerById(currentDetailPlayerId);
  const key = player ? actorNicknameKey(player) : "";
  if (!key) {
    return;
  }
  const nickname = nicknameInput.value.trim();
  if (nickname) {
    nicknameByIdName.set(key, nickname);
  } else {
    nicknameByIdName.delete(key);
  }
  persistNicknameMap();
  refreshCurrentReplayView();
  openPlayerDetail(currentDetailPlayerId);
  setInputStatus(nickname ? "昵称已保存。" : "昵称已清除。");
}

function clearCurrentNickname() {
  nicknameInput.value = "";
  saveCurrentNickname();
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
 * @param {{ persistInput?: boolean }} [options]
 * @returns {Promise<void>}
 */
async function startBattle({ persistInput = true } = {}) {
  const clickStartedAt = performance.now();
  const rawInput = inputName.value.trim();
  if (!rawInput) {
    setInputStatus("请输入至少一个名字。", true);
    openInputEditor();
    return;
  }
  const inputError = validateReplayInput(rawInput);
  if (inputError) {
    setInputStatus(inputError, true);
    openInputEditor();
    return;
  }

  speedMode = DEFAULT_SPEED_MODE;
  if (persistInput) {
    persistInputValue();
  }
  const generation = ++battleGenerationToken;
  stopPlaybackLoop();
  clearCurrentReplayView();
  battleMetrics = new BattleMetrics({ startedAt: clickStartedAt });
  metricsReported = false;
  setLoading(true);
  setInputStatus("正在准备战斗...");

  let source = null;
  try {
    source = await createBattleStreamSource(rawInput, versionInfo, coreVersionInfo, modulePathInfo, { metrics: battleMetrics });
    if (generation !== battleGenerationToken) { source.dispose(); return; }
    currentBattle = {
      raw_input: source.raw_input, seed_line: source.seed_line,
      players: source.players, initial_states: source.initial_states,
      frames: [], result: null, source_done: false,
      winner_ids: [], final_states: source.initial_states,
    };
    battleDisplay = new BattleDisplay(source.players, key => source.loadIcon(key), nicknameForKey);
    // 在首次拉取源代码前，初始 DOM 和加载状态已经就绪。
    closePanel(inputPanel);
    beginReplayPlayback(currentBattle, { autoPlay: false });
    battleMetrics.initialRendered();
    setLoading(false);
    setInputStatus("战斗已开始，正在逐帧播放。");
    streamController = new BattleStreamController(source, { paused: true, onListenerError: failStreaming, metrics: battleMetrics });
    streamController.subscribe(event => {
      if (generation !== battleGenerationToken) return;
      if (event.type === "frame") {
        const previousStates = currentBattle.frames.at(-1)?.states ?? currentBattle.initial_states;
        currentBattle.frames.push(event.data);
        const displayFrame = battleDisplay.frame(event.data);
        for (const state of displayFrame.states) playersById.set(state.id, state);
        syncIconStyles(battleDisplay.iconEntries());
        appendFrameToReplayPlan(currentPlan, displayFrame, battleDisplay.states(previousStates), playersById);
      } else if (event.type === "result") {
        currentBattle.result = event.data;
        currentBattle.source_done = true;
        currentBattle.final_states = event.data.final_states;
        currentBattle.winner_ids = event.data.winner_ids;
        markReplayPlanComplete(currentPlan, event.data);
      } else if (event.type === "error") {
        failStreaming(event.error);
      }
      syncPlaybackUi();
    });
    void autoplayFromCurrentCursor();
  } catch (error) {
    if (generation !== battleGenerationToken) return;
    streamController?.dispose();
    source?.dispose();
    setInputStatus(formatError(error), true);
    openInputEditor();
  } finally {
    if (generation === battleGenerationToken) setLoading(false);
  }
}

/**
 * 重播当前回放（不重新生成）。
 * @returns {Promise<void>}
 */
function failStreaming(error) {
  streamError = error;
  pausePlayback();
  streamController?.dispose();
  setInputStatus(formatError(error), true);
}

window.addEventListener("pagehide", () => {
  battleGenerationToken += 1;
  stopPlaybackLoop();
  streamController?.dispose();
});

async function replayCurrent() {
  if (!currentBattle) {
    openInputEditor();
    return;
  }
  beginReplayPlayback(currentBattle);
}

async function copyCurrentShareUrl() {
  if (!currentBattle?.raw_input) {
    setInputStatus("当前还没有可分享的对局。", true);
    openInputEditor();
    return;
  }

  try {
    await copyTextToClipboard(buildShareUrl(currentBattle.raw_input));
    setInputStatus("分享链接已复制到剪贴板。");
    showShareToast();
  } catch (error) {
    setInputStatus(`复制分享链接失败：${formatError(error)}`, true);
  }
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

shareBtn.addEventListener("click", () => {
  void copyCurrentShareUrl();
});

themeBtn.addEventListener("click", () => {
  setTheme(currentTheme() === "dark" ? "light" : "dark");
});

toggleControlsBtn.addEventListener("click", () => {
  toggleRightControls();
});

pauseBtn.addEventListener("click", () => {
  togglePausePlayback();
});

// 输入按钮：打开输入编辑面板
inputBtn.addEventListener("click", () => {
  openInputEditor();
});

playerList.addEventListener("click", (event) => {
  const button =
    event.target instanceof Element ? event.target.closest("[data-player-detail-id]") : null;
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }
  const playerId = Number(button.dataset.playerDetailId);
  if (Number.isFinite(playerId)) {
    openPlayerDetail(playerId);
  }
});

// 编辑名字按钮：关闭结束面板并打开输入编辑
editNamesBtn.addEventListener("click", () => {
  closePanel(endPanel);
  openInputEditor(true);
});

// 播放按钮：normal 速度播放
normalBtn.addEventListener("click", () => {
  speedMode = "normal";
  if (playbackPaused && currentBattle && !playbackFinished) {
    resumePlayback();
    return;
  }
  syncPlaybackUi();
});

// 快进按钮：fast 速度播放
fastBtn.addEventListener("click", () => {
  speedMode = "fast";
  if (playbackPaused && currentBattle && !playbackFinished) {
    resumePlayback();
    return;
  }
  syncPlaybackUi();
});

// 极速按钮：一次性快进至结束，完成后自动暂停
turboBtn.addEventListener("click", () => {
  if (!currentBattle || playbackFinished) {
    return;
  }
  speedMode = "turbo";
  if (playbackPaused) {
    resumePlayback();
  } else {
    syncPlaybackUi();
  }
});

stepBackEventBtn.addEventListener("click", () => {
  stepPlaybackTo(previousVisibleCursor(playbackCursor));
});

stepForwardEventBtn.addEventListener("click", () => {
  void stepPlaybackForward();
});

stepBackFrameBtn.addEventListener("click", () => {
  stepPlaybackTo(previousFrameCursor(playbackCursor));
});

stepForwardFrameBtn.addEventListener("click", () => {
  void stepPlaybackForward(true);
});

// 键盘快捷键
document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || isEditableKeyTarget(event.target)) {
    return;
  }
  if (event.key === " ") {
    if (!currentBattle) return;
    togglePausePlayback();
    event.preventDefault();
    return;
  }
  if (!currentBattle) {
    return;
  }
  switch (event.key) {
    case "ArrowLeft":
      stepPlaybackTo(previousVisibleCursor(playbackCursor));
      event.preventDefault();
      break;
    case "ArrowRight":
      void stepPlaybackForward();
      event.preventDefault();
      break;
    case "ArrowUp":
      stepPlaybackTo(previousFrameCursor(playbackCursor));
      event.preventDefault();
      break;
    case "ArrowDown":
      void stepPlaybackForward(true);
      event.preventDefault();
      break;
  }
});

// 关闭输入面板（仅在已有回放时允许关闭）
closeInputBtn.addEventListener("click", () => {
  if (currentBattle) {
    closePanel(inputPanel);
  }
});

// 关闭结束面板
closeEndBtn.addEventListener("click", () => {
  closePanel(endPanel);
});

closeDetailBtn.addEventListener("click", () => {
  closePanel(detailPanel);
});

saveNicknameBtn.addEventListener("click", () => {
  saveCurrentNickname();
});

clearNicknameBtn.addEventListener("click", () => {
  clearCurrentNickname();
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

nicknameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    saveCurrentNickname();
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
  const staticInput = readStaticReplayInputFromUrl();
  if (staticInput?.ok) {
    inputName.value = staticInput.input;
  }

  renderIdleState(playerList, battleRows, plistMeta, headerMeta);
  syncPlaybackUi();
  syncRightControlsUi();
  if (staticInput?.ok) {
    setInputStatus(`已读取 URL 参数 ${staticInput.paramName}，正在初始化回放...`);
  } else {
    setInputStatus(staticInput?.message ?? "会使用 show 风格自动播放整场战斗。", Boolean(staticInput));
    openInputEditor();
  }

  try {
    await ensureApi(versionInfo, coreVersionInfo, modulePathInfo);
    if (staticInput?.ok) {
      await startBattle({ persistInput: false });
      return;
    }
    setInputStatus("tswn_wasm 已初始化，可以开始。");
  } catch (error) {
    setInputStatus(`模块加载失败: ${formatError(error)}`, true);
  }
}

// ============================================================================
// 玩家联动高亮：鼠标悬停时高亮页面中所有该玩家的头像和名字
// ============================================================================

let highlightTimer = null;

function clearHighlightTimer() {
  if (highlightTimer) {
    clearTimeout(highlightTimer);
    highlightTimer = null;
  }
}

/**
 * 高亮指定 playerId 对应的所有元素，其余淡化。
 * @param {string|number|null} playerId
 */
function setPlayerHighlight(playerId) {
  // 清除旧的高亮标记
  document
    .querySelectorAll("[data-player-id].hl-active")
    .forEach((el) => el.classList.remove("hl-active"));

  if (playerId) {
    document.body.classList.add("highlight-active");
    document
      .querySelectorAll('[data-player-id="' + playerId + '"]')
      .forEach((el) => el.classList.add("hl-active"));
  } else {
    document.body.classList.remove("highlight-active");
  }
}

function clearPlayerHighlight() {
  clearHighlightTimer();
  setPlayerHighlight(null);
}

function clearPlayerHighlightSoon() {
  clearHighlightTimer();
  highlightTimer = setTimeout(() => {
    setPlayerHighlight(null);
    highlightTimer = null;
  }, 80);
}

document.addEventListener("mouseover", (event) => {
  const el = event.target instanceof Element ? event.target.closest("[data-player-id]") : null;
  if (el) {
    clearHighlightTimer();
    setPlayerHighlight(el.dataset.playerId);
  } else if (!document.querySelector("[data-player-id]:hover")) {
    clearPlayerHighlightSoon();
  }
});

document.addEventListener("mouseout", (event) => {
  if (event.relatedTarget instanceof Node && document.documentElement.contains(event.relatedTarget)) {
    if (!document.querySelector("[data-player-id]:hover")) {
      clearPlayerHighlightSoon();
    }
    return;
  }
  clearPlayerHighlight();
});

window.addEventListener("blur", clearPlayerHighlight);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    clearPlayerHighlight();
  }
});

void main();
