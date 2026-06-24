/**
 * @fileoverview tswn_wasm 战斗回放展示页 — 纯工具函数
 *
 * 本模块不依赖任何 DOM 或全局状态，所有函数均为纯函数或仅依赖参数。
 */

// ============================================================================
// HTML / 字符串工具
// ============================================================================

/**
 * HTML 转义，防止 XSS。
 * @param {unknown} text — 任意输入
 * @returns {string} 已转义的 HTML 安全字符串
 */
export function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * 将可能的 base64 字符串转为可用的 data URI。
 * 如果传入的是空值，返回一张 1x1 透明 GIF 占位图。
 * @param {string|null|undefined} iconPngBase64 — 原始 base64 或 data URI
 * @returns {string} 可直接用于 background-image 的 data URI
 */
export function iconSrc(iconPngBase64) {
  if (!iconPngBase64) {
    return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
  }
  return iconPngBase64.startsWith("data:")
    ? iconPngBase64
    : `data:image/png;base64,${iconPngBase64}`;
}

/**
 * 根据玩家/归属者 ID 生成 show 风格头像类名。
 * @param {number|string|null|undefined} iconId
 * @returns {string}
 */
export function iconClassName(iconId) {
  return iconId == null ? "icon_missing" : `icon_${iconId}`;
}

/**
 * 为当前回放中的头像表生成 `.icon_N { background-image: ... }` 样式规则。
 * @param {Array<{ icon_class_id?: number|string, id?: number|string, icon_png_base64?: string|null }>} iconEntries
 * @returns {string}
 */
export function buildIconClassCss(iconEntries) {
  const seen = new Set();
  return iconEntries
    .map((entry) => {
      const iconId = entry.icon_class_id ?? entry.id;
      if (iconId == null || seen.has(iconId)) {
        return "";
      }
      seen.add(iconId);
      return `.${iconClassName(iconId)} { background-image: url("${iconSrc(entry.icon_png_base64)}"); }`;
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * 取混淆版 md5.js 中 Sgls.o6 使用的头像缓存 key。
 * @param {{ icon_key?: string, id_name?: string, id?: number|string }|null|undefined} actor
 * @returns {string}
 */
function iconCacheKey(actor) {
  return actor?.icon_key ?? actor?.id_name ?? `#${actor?.id ?? "missing"}`;
}

/**
 * 为完整回放补齐 icon_class_id，并收集需要注入的 CSS 背景图规则。
 * 混淆版 md5.js 的 Sgls.o6 是按 fy/icon_key 缓存，再按出现顺序分配 icon_N。
 * @param {FightReplay} replay
 * @returns {FightReplay}
 */
export function normalizeReplayIconClasses(replay) {
  const iconIdByKey = new Map();
  const iconStyleById = new Map();
  let nextIconId = 0;

  const register = (actor) => {
    if (!actor) {
      return actor;
    }
    const key = iconCacheKey(actor);
    let icon_class_id = iconIdByKey.get(key);
    if (icon_class_id == null) {
      icon_class_id = nextIconId;
      nextIconId += 1;
      iconIdByKey.set(key, icon_class_id);
    }
    if (actor.icon_png_base64 && !iconStyleById.has(icon_class_id)) {
      iconStyleById.set(icon_class_id, {
        icon_class_id,
        icon_png_base64: actor.icon_png_base64,
      });
    }
    return {
      ...actor,
      icon_class_id,
    };
  };

  const normalizeStates = (states) => (states ?? []).map(register);
  const players = (replay.players ?? []).map(register);
  const initial_states = normalizeStates(replay.initial_states);
  const frames = (replay.frames ?? []).map((frame) => ({
    ...frame,
    states: normalizeStates(frame.states),
  }));
  const final_states = normalizeStates(replay.final_states);

  return {
    ...replay,
    players,
    initial_states,
    frames,
    final_states,
    icon_styles: Array.from(iconStyleById.values()),
  };
}

/**
 * @deprecated 使用 normalizeReplayIconClasses；保留导出避免旧页面直接引用时报错。
 * @param {FightPlayer[]} players
 * @returns {FightPlayer[]}
 */
export function withTeamIconClassIds(players) {
  return normalizeReplayIconClasses({ players }).players;
}

/**
 * 渲染一个 show 风格头像节点。
 * 头像图片由外部注入的 `.icon_N` 规则提供，这里只负责输出结构和类名。
 * @param {number|string|null|undefined} iconId
 * @param {string} className
 * @returns {string}
 */
export function renderIconSprite(iconId, className) {
  return `<span class="${className} ${iconClassName(iconId)}" aria-hidden="true"></span>`;
}

/**
 * 把任意类型的错误对象格式化为人类可读的中文消息。
 * @param {unknown} error
 * @returns {string}
 */
export function formatError(error) {
  if (!error) {
    return "未知错误";
  }
  if (typeof error === "string") {
    return error;
  }
  if (error.code || error.message) {
    return `${error.code ?? "ERROR"}: ${error.message ?? ""}`.trim();
  }
  if (error instanceof Error) {
    return error.message;
  }
  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

// ============================================================================
// 输入校验
// ============================================================================

const INTEGER_PATTERN = /^[+-]?\d+$/;
const UNSIGNED_INTEGER_PATTERN = /^\d+$/;
const SKILL_BOOST_PATTERN = /^(?:\d+|\d+\s*\+\s*\d+|2\s*\*\s*\d+)$/;
const MINION_OVERLAY_KEYS = new Set([
  "shadow",
  "phantom",
  "幻影",
  "summon",
  "familiar",
  "使魔",
  "zombie",
  "丧尸",
  "僵尸",
]);

export function validateReplayInput(rawInput) {
  const lines = rawInput.replace(/\r\n?/g, "\n").split("\n");
  let playerLineCount = 0;
  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (!trimmed || /^seed:/i.test(trimmed)) {
      continue;
    }
    playerLineCount += 1;
    const error = validateInlineOverlay(trimmed, lineNumber);
    if (error) {
      return error;
    }
  }
  if (playerLineCount === 0) {
    return "输入中没有可参战名字：请至少输入一个非 seed 行。";
  }
  return null;
}

function validateInlineOverlay(line, lineNumber) {
  const olIndex = line.indexOf("+ol:");
  if (olIndex >= 0) {
    const result = validateObjectAt(line, olIndex + "+ol:".length, lineNumber, "+ol", validateOverlayField);
    if (result.error) {
      return result.error;
    }
    const suffixError = validateInlineObjectSuffix(line, result.end, lineNumber, "+ol");
    if (suffixError) {
      return suffixError;
    }
  }

  const diyIndex = line.indexOf("+diy[");
  if (diyIndex >= 0) {
    const attrsStart = diyIndex + "+diy".length;
    const attrsEnd = findBalancedEnd(line, attrsStart, "[", "]");
    if (attrsEnd < 0) {
      return `第 ${lineNumber} 行：+diy 缺少右方括号 ]。`;
    }
    const attrError = validateAttrList(line.slice(attrsStart + 1, attrsEnd - 1), lineNumber, "+diy");
    if (attrError) {
      return attrError;
    }

    const rest = line.slice(attrsEnd).trimStart();
    if (rest.startsWith("{")) {
      const result = validateSkillMapAt(rest, 0, lineNumber, "+diy 技能");
      if (result.error) {
        return result.error;
      }
      return validateInlineObjectSuffix(rest, result.end, lineNumber, "+diy 技能");
    }
    if (rest && !rest.startsWith("+")) {
      return `第 ${lineNumber} 行：+diy 属性后应接技能对象或新的 + 后缀。`;
    }
  }
  return null;
}

function validateInlineObjectSuffix(raw, endIndex, lineNumber, label) {
  const rest = raw.slice(endIndex).trimStart();
  if (rest && !rest.startsWith("+")) {
    return `第 ${lineNumber} 行：${label} 对象后应结束或接新的 + 后缀。`;
  }
  return null;
}

function validateObjectAt(raw, startIndex, lineNumber, label, fieldValidator) {
  const first = raw.slice(startIndex).search(/\S/);
  if (first < 0 || raw[startIndex + first] !== "{") {
    return { error: `第 ${lineNumber} 行：${label} 后缺少对象。`, end: startIndex };
  }
  const objectStart = startIndex + first;
  return validateObjectEntries(raw, objectStart, lineNumber, label, fieldValidator);
}

function validateObjectEntries(raw, startIndex, lineNumber, label, fieldValidator) {
  if (raw[startIndex] !== "{") {
    return { error: `第 ${lineNumber} 行：${label} 后缺少对象。`, end: startIndex };
  }

  let index = startIndex + 1;
  while (index < raw.length) {
    index = skipWsAndCommas(raw, index);
    if (raw[index] === "}") {
      return { error: null, end: index + 1 };
    }
    if (index >= raw.length) {
      break;
    }
    if (raw[index] !== '"') {
      return { error: `第 ${lineNumber} 行：${label} 对象字段名必须使用双引号。`, end: index };
    }

    const key = parseQuotedString(raw, index);
    if (key.error) {
      return { error: `第 ${lineNumber} 行：${label} 字段名缺少右引号。`, end: index };
    }
    index = skipWs(raw, key.end);
    if (raw[index] !== ":") {
      return { error: `第 ${lineNumber} 行：${label}.${key.value} 缺少冒号 :。`, end: index };
    }

    index = skipWs(raw, index + 1);
    const value = readLooseValue(raw, index, lineNumber, `${label}.${key.value}`);
    if (value.error) {
      return value;
    }

    const fieldError = fieldValidator?.(key.value, raw.slice(index, value.end), lineNumber, label);
    if (fieldError) {
      return { error: fieldError, end: index };
    }
    index = value.end;
  }

  return { error: `第 ${lineNumber} 行：${label} 对象缺少右花括号 }。`, end: raw.length };
}

function validateOverlayField(key, valueRaw, lineNumber, label) {
  if (key === "attrs") {
    const value = valueRaw.trim();
    if (!value.startsWith("[") || !value.endsWith("]")) {
      return `第 ${lineNumber} 行：${label}.attrs 应为 8 个整数的数组。`;
    }
    return validateAttrList(value.slice(1, -1), lineNumber, `${label}.attrs`);
  }
  if (key === "skills") {
    const result = validateSkillMapAt(valueRaw, 0, lineNumber, `${label}.skills`);
    return result.error;
  }
  if (key === "name_factor_enabled" || key === "reuse_skills_on_recast" || key === "inherit_owner_def_res") {
    const value = valueRaw.trim();
    if (value !== "true" && value !== "false") {
      return `第 ${lineNumber} 行：${label}.${key} 应为 true 或 false。`;
    }
  }
  if (MINION_OVERLAY_KEYS.has(key)) {
    const result = validateObjectAt(valueRaw, 0, lineNumber, `${label}.${key}`, validateOverlayField);
    return result.error;
  }
  return null;
}

function validateSkillMapAt(raw, startIndex, lineNumber, label) {
  return validateObjectAt(raw, startIndex, lineNumber, label, validateSkillField);
}

function validateSkillField(key, valueRaw, lineNumber, label) {
  const value = valueRaw.trim();
  if (value.startsWith('"')) {
    const parsed = parseQuotedString(value, 0);
    if (parsed.error || parsed.end !== value.length || !SKILL_BOOST_PATTERN.test(parsed.value.trim())) {
      return `第 ${lineNumber} 行：${label}.${key} 应为非负整数或 "40+30" / "2*40" 字符串。`;
    }
    return null;
  }
  if (!UNSIGNED_INTEGER_PATTERN.test(value)) {
    return `第 ${lineNumber} 行：${label}.${key} 应为非负整数或 "40+30" / "2*40" 字符串。`;
  }
  return null;
}

function validateAttrList(raw, lineNumber, label) {
  const attrs = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (attrs.length !== 8) {
    return `第 ${lineNumber} 行：${label} 需要 8 个属性值，当前是 ${attrs.length} 个。`;
  }
  const badAttrIndex = attrs.findIndex((part) => !INTEGER_PATTERN.test(part));
  if (badAttrIndex >= 0) {
    return `第 ${lineNumber} 行：${label} 第 ${badAttrIndex + 1} 个属性不是整数。`;
  }
  return null;
}

function readLooseValue(raw, startIndex, lineNumber, label) {
  if (startIndex >= raw.length || raw[startIndex] === "," || raw[startIndex] === "}") {
    return { error: `第 ${lineNumber} 行：${label} 缺少字段值。`, end: startIndex };
  }
  const ch = raw[startIndex];
  if (ch === "{") {
    const end = findBalancedEnd(raw, startIndex, "{", "}");
    return end < 0
      ? { error: `第 ${lineNumber} 行：${label} 对象缺少右花括号 }。`, end: startIndex }
      : { error: null, end };
  }
  if (ch === "[") {
    const end = findBalancedEnd(raw, startIndex, "[", "]");
    return end < 0
      ? { error: `第 ${lineNumber} 行：${label} 数组缺少右方括号 ]。`, end: startIndex }
      : { error: null, end };
  }
  if (ch === '"') {
    const result = parseQuotedString(raw, startIndex);
    return result.error
      ? { error: `第 ${lineNumber} 行：${label} 字符串缺少右引号。`, end: startIndex }
      : { error: null, end: result.end };
  }

  let index = startIndex;
  while (index < raw.length && raw[index] !== "," && raw[index] !== "}") {
    index += 1;
  }
  if (raw.slice(startIndex, index).trim() === "") {
    return { error: `第 ${lineNumber} 行：${label} 缺少字段值。`, end: startIndex };
  }
  return { error: null, end: index };
}

function parseQuotedString(raw, startIndex) {
  if (raw[startIndex] !== '"') {
    return { error: "missing quote", value: "", end: startIndex };
  }
  let value = "";
  let escaped = false;
  for (let index = startIndex + 1; index < raw.length; index += 1) {
    const ch = raw[index];
    if (escaped) {
      value += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      return { error: null, value, end: index + 1 };
    }
    value += ch;
  }
  return { error: "missing quote", value: "", end: raw.length };
}

function findBalancedEnd(raw, startIndex, open, close) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = startIndex; index < raw.length; index += 1) {
    const ch = raw[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === open) {
      depth += 1;
    } else if (ch === close) {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
  }
  return -1;
}

function skipWs(raw, startIndex) {
  let index = startIndex;
  while (index < raw.length && /\s/.test(raw[index])) {
    index += 1;
  }
  return index;
}

function skipWsAndCommas(raw, startIndex) {
  let index = startIndex;
  while (index < raw.length && (/\s/.test(raw[index]) || raw[index] === ",")) {
    index += 1;
  }
  return index;
}

// ============================================================================
// 异步工具
// ============================================================================

/**
 * 异步等待若干毫秒。
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

// ============================================================================
// 状态 / 显示映射
// ============================================================================

/**
 * 将状态数组转换为 id→state 的 Map。
 * @param {FightState[]} states
 * @returns {Map<number, FightState>}
 */
export function buildStateMap(states) {
  return new Map(states.map((state) => [state.id, state]));
}

/**
 * 为没有名字的召唤/幻影单位生成显示名。
 * @param {number} playerId
 * @returns {string}
 */
export function phantomDisplayName(playerId) {
  return `幻影 #${playerId}`;
}

/**
 * 统一格式化回放状态里的显示名。
 * minion 会追加 #playerId，用来和其他同类单位区分。
 * @param {FightState|undefined} state
 * @param {number} [fallbackPlayerId]
 * @returns {string}
 */
export function replayDisplayName(state, fallbackPlayerId) {
  const playerId = fallbackPlayerId ?? state?.id;
  if (!state) {
    return playerId == null ? "未知角色" : phantomDisplayName(playerId);
  }
  if (state.minion_kind === "clone") {
    return playerId == null ? state.display_name : `${state.display_name} #${playerId}`;
  }
  if (
    state.minion_kind === "summon" ||
    state.minion_kind === "shadow" ||
    state.minion_kind === "zombie"
  ) {
    const baseName =
      state.display_name ??
      (state.minion_kind === "shadow" ? "幻影" : state.minion_kind === "zombie" ? "丧尸" : "使魔");
    return playerId == null ? baseName : `${baseName} #${playerId}`;
  }
  return state.display_name ?? phantomDisplayName(playerId ?? 0);
}

/**
 * 将存活状态映射为中文标签。
 * @param {FightState} state
 * @returns {string} "死亡" | "冻结" | "存活"
 */
export function statusText(state) {
  if (!state.alive) {
    return "死亡";
  }
  if (state.frozen) {
    return "冻结";
  }
  return "存活";
}

// ============================================================================
// HP 条计算
// ============================================================================

/**
 * 计算 HP 条的布局度量，包括当前/上一帧宽度、变化宽度等。
 * 宽度会根据 maxHp 自适应，范围 20~56（乘以 1.5 缩放）。
 *
 * @param {FightState} state — 当前状态
 * @param {FightState} [previousState=state] — 上一帧状态（默认同当前，表示无变化）
 * @returns {HpMetrics|null} 若 state 无效或 maxHp≤0 返回 null
 */
export function actorHpMetrics(state, previousState) {
  if (!state || state.max_hp <= 0) {
    return null;
  }

  const maxHp = Math.max(1, state.max_hp, previousState?.max_hp ?? 0);
  const hp = Math.max(0, Math.min(maxHp, state.hp));
  // 新对象（无 previousState 或本帧刚出现）当作 hp 从 0 开始变化
  const isNew = state?._is_new_in_frame || previousState?._is_new_in_frame;
  const previousHp = previousState && !isNew ? Math.max(0, Math.min(maxHp, previousState.hp)) : 0;
  // 血条长度调整为 血量 / 4 向上取整
  const totalWidth = Math.max(20, Math.ceil(maxHp / 4));
  const fillWidth = hp > 0 ? Math.max(1, Math.ceil(hp / 4)) : 0;
  const previousWidth = previousHp > 0 ? Math.max(1, Math.ceil(previousHp / 4)) : 0;
  // 受伤变化量（红条）：上一帧比当前宽多少
  const deltaWidth = previousHp > hp ? Math.max(1, previousWidth - fillWidth) : 0;

  return {
    totalWidth,
    fillWidth,
    previousWidth,
    deltaLeft: fillWidth,
    deltaWidth,
  };
}

// ============================================================================
// 消息格式化
// ============================================================================

/**
 * 格式化消息文本：HTML 转义 + 技能名高亮 + 数字高亮。
 * @param {string} text — 原始消息
 * @param {MessageTone} tone — 消息色调，决定数字是否高亮
 * @param {string[]} [statusChangeTokens=[]] — 由 WASM 提供的状态变化词
 * @returns {string} HTML 字符串
 */
export function formatMessageText(text, tone, statusChangeTokens = []) {
  let html = escapeHtml(text);

  const uniqueStatusTokens = [
    ...new Set((statusChangeTokens ?? []).map((token) => `${token}`.trim()).filter(Boolean)),
  ];
  if (uniqueStatusTokens.length > 0) {
    for (const token of uniqueStatusTokens) {
      const safeToken = escapeHtml(token);
      html = html.replaceAll(
        `从[${safeToken}]中解除`,
        `从<span class="status-change-token">${safeToken}</span>中解除`,
      );
      html = html.replaceAll(
        `从[${safeToken}]状态中解除`,
        `从<span class="status-change-token">${safeToken}</span>状态中解除`,
      );
      html = html.replaceAll(
        `的[${safeToken}]被识破`,
        `的<span class="status-change-token">${safeToken}</span>被识破`,
      );
      html = html.replaceAll(
        `的[${safeToken}]被中止了`,
        `的<span class="status-change-token">${safeToken}</span>被中止了`,
      );
      html = html.replaceAll(
        `的[${safeToken}]被中止`,
        `的<span class="status-change-token">${safeToken}</span>被中止`,
      );
      html = html.replaceAll(
        `的[${safeToken}]被打消了`,
        `的<span class="status-change-token">${safeToken}</span>被打消了`,
      );
      html = html.replaceAll(
        `的[${safeToken}]被打消`,
        `的<span class="status-change-token">${safeToken}</span>被打消`,
      );
      html = html.replaceAll(
        `的[${safeToken}]属性被打消`,
        `的<span class="status-change-token">${safeToken}</span>属性被打消`,
      );
      html = html.replaceAll(
        `[${safeToken}]`,
        `<span class="status-change-token">${safeToken}</span>`,
      );
    }
  }

  html = html.replace(/\[s_dmg\d+\]/g, "");

  // 其他技能或状态（包括回避、反击、识破、反弹、吸收等普通技能） → 去掉 []，蓝色
  html = html.replace(/\[([^\]]+)\]/g, '<span class="skill-token">$1</span>');

  if (tone === "damage") {
    // "XX点伤害" 中的数字标红
    html = html.replace(/(\d+)(?=点伤害)/g, '<span class="message-number">$1</span>');
  }
  if (tone === "recover") {
    // "回复XX点" 中的数字标绿
    html = html.replace(/(\d+)(?=点)/g, '<span class="message-number">$1</span>');
  }
  // 瘟疫/体力减少等也标红（数字后跟%或"减少"）
  html = html.replace(/(\d+)(?=%|减少)/g, '<span class="message-number">$1</span>');

  return html;
}
