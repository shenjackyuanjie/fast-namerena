/** 战斗展示页入口：组装会话、页面事件和独立播放控制器。
 * @typedef {import("./show-types.js").FightState} FightState
 * @typedef {import("./show-types.js").FightPlayer} FightPlayer
 * @typedef {import("./show-types.js").FightReplay} FightReplay
 * @typedef {import("./show-types.js").SpeedMode} SpeedMode
 * @typedef {import("./show-types.js").FrameUpdate} FrameUpdate
 * @typedef {import("./show-types.js").InvolvedSet} InvolvedSet
 */

import { createShowPlayback } from "./show-playback.js";
import { createThemeControls, setupPlayerHighlight, isEditableKeyTarget, copyTextToClipboard } from "./show-ui.js";
import {
  buildIconClassCss,
  formatError,
  validateReplayInput,
} from "./show-utils.js";
import { buildPlayerDetailHtml } from "./show-detail.js";
import { renderIdleState } from "./show-render.js";
import {
  createReplayPlan,
  appendFrameToReplayPlan,
  markReplayPlanComplete,
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

// 仅给尚未绑定快捷键的控制按钮登记字母键。
const BUTTON_SHORTCUTS = new Map([
  ["c", toggleControlsBtn],
  ["p", normalBtn],
  ["f", fastBtn],
  ["i", inputBtn],
  ["t", turboBtn],
  ["r", refreshBtn],
  ["s", shareBtn],
  ["d", themeBtn],
]);

for (const [key, button] of BUTTON_SHORTCUTS) {
  button.setAttribute("aria-keyshortcuts", key.toUpperCase());
  if (button !== toggleControlsBtn && button !== themeBtn) {
    button.title = `${button.title} (${key.toUpperCase()})`;
  }
}

pauseBtn.setAttribute("aria-keyshortcuts", "Space");
pauseBtn.title = `${pauseBtn.title} (Space)`;
stepBackEventBtn.setAttribute("aria-keyshortcuts", "ArrowLeft");
stepForwardEventBtn.setAttribute("aria-keyshortcuts", "ArrowRight");
stepBackFrameBtn.setAttribute("aria-keyshortcuts", "ArrowUp");
stepForwardFrameBtn.setAttribute("aria-keyshortcuts", "ArrowDown");

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
// 页面初始化时尝试恢复上次保存的输入与昵称。
restoreInputValue();
restoreNicknameMap();

const { currentTheme, setTheme } = createThemeControls({ themeBtn, themeLightIcon, themeDarkIcon });
const { clearPlayerHighlight } = setupPlayerHighlight();
const {
  stopPlaybackLoop, prepareReplayPlan, syncPlaybackUi, renderPlaybackToCursor,
  autoplayFromCurrentCursor, beginReplayPlayback, previousVisibleCursor, previousFrameCursor,
  pausePlayback, resumePlayback, togglePausePlayback, stepPlaybackTo,
  stepPlaybackForward, nextVisibleCursor, nextFrameCursor,
} = createShowPlayback({
  get currentBattle() { return currentBattle; }, set currentBattle(value) { currentBattle = value; },
  get streamController() { return streamController; }, set streamController(value) { streamController = value; },
  get battleDisplay() { return battleDisplay; }, set battleDisplay(value) { battleDisplay = value; },
  get battleMetrics() { return battleMetrics; }, set battleMetrics(value) { battleMetrics = value; },
  get metricsReported() { return metricsReported; }, set metricsReported(value) { metricsReported = value; },
  get streamError() { return streamError; }, set streamError(value) { streamError = value; },
  get battleGenerationToken() { return battleGenerationToken; }, set battleGenerationToken(value) { battleGenerationToken = value; },
  get currentVisibleStates() { return currentVisibleStates; }, set currentVisibleStates(value) { currentVisibleStates = value; },
  get speedMode() { return speedMode; }, set speedMode(value) { speedMode = value; },
  get playersById() { return playersById; }, set playersById(value) { playersById = value; },
  get currentPlan() { return currentPlan; }, set currentPlan(value) { currentPlan = value; },
  get playbackCheckpoints() { return playbackCheckpoints; }, set playbackCheckpoints(value) { playbackCheckpoints = value; },
  get playbackCursor() { return playbackCursor; }, set playbackCursor(value) { playbackCursor = value; },
  get historyResumeBoundary() { return historyResumeBoundary; }, set historyResumeBoundary(value) { historyResumeBoundary = value; },
  get playbackLoopToken() { return playbackLoopToken; }, set playbackLoopToken(value) { playbackLoopToken = value; },
  get playbackStartedAt() { return playbackStartedAt; }, set playbackStartedAt(value) { playbackStartedAt = value; },
  get playbackPaused() { return playbackPaused; }, set playbackPaused(value) { playbackPaused = value; },
  get playbackFinished() { return playbackFinished; }, set playbackFinished(value) { playbackFinished = value; },
}, { playerList, battleRows, endPanel, headerMeta, plistMeta, normalBtn, fastBtn, pauseBtn, shareBtn, stepControls, stepBackEventBtn, stepForwardEventBtn, stepBackFrameBtn, stepForwardFrameBtn, rememberPlayers, clearPlayerHighlight, closePanel, visibleStatesForCursor });

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

function syncRightControlsUi() {
  rightControls.classList.toggle("is-collapsed", rightControlsCollapsed);
  toggleControlsBtn.setAttribute("aria-expanded", String(!rightControlsCollapsed));
  const label = rightControlsCollapsed ? "展开控制按钮" : "收起控制按钮";
  toggleControlsBtn.title = `${label} (C)`;
  toggleControlsBtn.setAttribute("aria-label", label);
}

function toggleRightControls() {
  rightControlsCollapsed = !rightControlsCollapsed;
  syncRightControlsUi();
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
  if (!event.altKey && !event.ctrlKey && !event.metaKey) {
    const shortcutButton = BUTTON_SHORTCUTS.get(event.key.toLowerCase());
    if (shortcutButton) {
      if (!event.repeat) shortcutButton.click();
      event.preventDefault();
      return;
    }
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

void main();
