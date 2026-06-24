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
 *   累计效果。帧结束时若 finished 为 true，追加可读的胜者行。
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
} from "./show-utils.js";

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
export function actorToken(player, state, previousState, update, { showHp = true } = {}) {
  // 仅在血量变化时（或新对象首次出现时）显现血条。
  // 被减速等 debuff 状态不会改变血量，因此不展示血条。
  const isNew = state?._is_new_in_frame;
  const hpChanged = isNew || previousState == null || Number(state.hp) !== Number(previousState.hp);
  const shouldShowHp = showHp && hpChanged;
  const hpMetrics = shouldShowHp ? actorHpMetrics(state, previousState) : null;
  const hpBar = hpMetrics
    ? `
            <span class="actor-hp" style="width:${hpMetrics.totalWidth}px">
                <span class="actor-hp-fill" style="width:${hpMetrics.fillWidth}px"></span>
                ${hpMetrics.deltaWidth > 0 ? `<span class="actor-hp-delta" style="left:${hpMetrics.deltaLeft}px;width:${hpMetrics.deltaWidth}px"></span>` : ""}
            </span>
        `
    : "";
  const hpClass = hpMetrics ? " has-hp" : "";
  const isKnockout = update?.tone === "knockout" || (state && !state.alive);
  const nameClass = `actor-name${isKnockout ? " namedie" : ""}`;

  return `<span class="actor-token${hpClass}" data-player-id="${player.id}"><span class="actor-avatar-wrap">${renderIconSprite(playerIconClassId(player), "msg-avatar icon-sprite")}</span><span class="${nameClass}">${hpBar}${escapeHtml(player.display_name)}</span></span>`;
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
  let icon = state?.icon_png_base64 ?? null;
  let icon_class_id = state?.icon_class_id ?? state?.owner_id ?? playerId;
  if (state?.owner_id != null) {
    const ownerPlayer = playersById.get(state.owner_id);
    if (ownerPlayer && !icon) {
      icon = ownerPlayer.icon_png_base64;
    }
    if (ownerPlayer && state?.icon_class_id == null) {
      icon_class_id = ownerPlayer.icon_class_id ?? ownerPlayer.id;
    }
  }

  return {
    id: playerId,
    team_index: state?.team_index ?? 0,
    owner_id: state?.owner_id ?? null,
    minion_kind: state?.minion_kind ?? null,
    id_name: state?.id_name ?? `player_${playerId}`,
    icon_key: state?.icon_key ?? state?.id_name ?? `player_${playerId}`,
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
export function renderActorById(
  playerId,
  stateMap,
  previousStateMap,
  playersById,
  update,
  options,
) {
  const player = playersById.get(playerId);
  const state = stateMap.get(playerId);
  // 若上一帧不存在该对象则传 null，供 actorToken 识别为"新对象"以展示血条
  const previousState = previousStateMap?.get(playerId) ?? null;
  if (!player) {
    return actorToken(
      syntheticPlayerFromState(playerId, state, playersById),
      state,
      previousState,
      update,
      options,
    );
  }

  return actorToken(player, state, previousState, update, options);
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
      .map((playerId) =>
        renderActorById(playerId, stateMap, previousStateMap, playersById, update, {
          showHp: true,
        }),
      )
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
    return formatMessageText(
      `${update.message_rendered ?? ""}`,
      tone,
      update.status_change_tokens ?? [],
    );
  }

  let result = template
    .split(/(\[[012]\])/g)
    .filter((part) => part.length > 0)
    .map((part) => {
      if (part === "[0]") {
        // 施法者 — 仅在血量变化时显示 HP
        return renderActorById(update.caster_id, stateMap, previousStateMap, playersById, update, {
          showHp: true,
        });
      }
      if (part === "[1]") {
        // 目标 — 显示 HP
        return renderActorById(update.target_id, stateMap, previousStateMap, playersById, update, {
          showHp: true,
        });
      }
      if (part === "[2]") {
        // 参数（目标列表或数值）
        return renderMessageParam(update, tone, stateMap, previousStateMap, playersById);
      }
      return formatMessageText(part, tone, update.status_change_tokens ?? []);
    })
    .join("");

  // 瘟疫/体力减少等场景：数字后跟 % 或"减少"时标红（即使 tone 不是 damage）
  if (tone !== "damage" && tone !== "recover") {
    result = result.replace(/(\d+)(?=%|减少)/g, '<span class="message-number">$1</span>');
  }

  return result;
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

const POSITIVE_STATUS_LABELS = new Set([
  "聚气",
  "蓄力",
  "隐匿",
  "潜行",
  "狂暴",
  "疾走",
  "铁壁",
  "守护",
]);
const NEGATIVE_STATUS_LABELS = new Set(["魅惑", "诅咒", "冰冻", "中毒", "迟缓", "垂死"]);
const QUICK_AREA_SKILL_MAX_DELAY_MS = 300;
const QUICK_AREA_SKILL_TOKENS = ["[雷击术]", "[地裂术]", "使用雷击术", "使用地裂术"];
const WIN_UPDATE_DELAY0_MS = 3000;

function isQuickAreaSkillUpdate(update) {
  const template = `${update.message_template ?? ""}`;
  const rendered = `${update.message_rendered ?? ""}`;
  return QUICK_AREA_SKILL_TOKENS.some(
    (token) => template.includes(token) || rendered.includes(token),
  );
}

function quickAreaSkillDelay(rawDelay) {
  return Math.min(rawDelay, QUICK_AREA_SKILL_MAX_DELAY_MS);
}

function statusPillTone(label) {
  if (POSITIVE_STATUS_LABELS.has(label)) {
    return "positive";
  }
  if (NEGATIVE_STATUS_LABELS.has(label)) {
    return "negative";
  }
  return "";
}

function renderStatusPill(label) {
  const tone = statusPillTone(label);
  const className = tone ? `status-pill ${tone}` : "status-pill";
  return `<span class="${className}">${escapeHtml(label)}</span>`;
}

function renderPlayerStatusPills(state) {
  const labels = sidebarStatusLabels(state);
  const chips = labels.map(renderStatusPill).join("");
  return `<div class="detail-line player-effects"${labels.length ? "" : " hidden"}>${chips}</div>`;
}

function playerRowLifeClass(state, previous) {
  if (state.alive) {
    return "";
  }
  return previous?.alive ? " is-dead is-just-dead" : " is-dead";
}

function nonNegativeFinite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function barValueWidth(value) {
  return value > 0 ? Math.max(1, Math.ceil(value / 4)) : 0;
}

function playerMpMetrics(state, previousState) {
  const currentMp = state?.alive ? nonNegativeFinite(state.magic_point) : 0;
  const previousMp =
    previousState && previousState.alive !== false
      ? nonNegativeFinite(previousState.magic_point)
      : currentMp;
  const maxMp = Math.max(
    1,
    nonNegativeFinite(state?.magic),
    nonNegativeFinite(previousState?.magic),
    currentMp,
    previousMp,
  );
  const totalWidth = Math.max(20, Math.ceil(maxMp / 4));
  const fillWidth = barValueWidth(currentMp);
  const previousWidth = barValueWidth(previousMp);
  const recoverLeft = Math.min(previousWidth, fillWidth);
  const recoverWidth = Math.max(0, fillWidth - previousWidth);
  const costLeft = Math.min(previousWidth, fillWidth);
  const costWidth = Math.max(0, previousWidth - fillWidth);

  return {
    totalWidth,
    fillWidth,
    previousWidth,
    recoverLeft,
    recoverWidth,
    costLeft,
    costWidth,
  };
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

function playerWithCurrentState(player, state) {
  return {
    ...player,
    team_index: state?.team_index ?? player.team_index ?? 0,
    owner_id: state?.owner_id ?? player.owner_id ?? null,
    minion_kind: state?.minion_kind ?? player.minion_kind ?? null,
    id_name: state?.id_name ?? player.id_name,
    icon_key: state?.icon_key ?? player.icon_key,
    display_name: state?.display_name ?? player.display_name,
    icon_png_base64: state?.icon_png_base64 ?? player.icon_png_base64,
    icon_class_id: state?.icon_class_id ?? player.icon_class_id,
  };
}

function compareDisplayPlayers(left, right) {
  const leftTeam = left.team_index ?? 0;
  const rightTeam = right.team_index ?? 0;
  if (leftTeam !== rightTeam) {
    return leftTeam - rightTeam;
  }
  return left.id - right.id;
}

function orderedDisplayPlayers(players, states, stateMap, playersById) {
  const knownIds = new Set(players.map((player) => player.id));
  const allPlayers = players.map((player) => playerWithCurrentState(player, stateMap.get(player.id)));
  for (const state of states) {
    if (knownIds.has(state.id)) {
      continue;
    }
    knownIds.add(state.id);
    const phantomPlayer = syntheticPlayerFromState(state.id, state, playersById);
    allPlayers.push(phantomPlayer);
    playersById.set(state.id, phantomPlayer);
  }

  const playerById = new Map(allPlayers.map((player) => [player.id, player]));
  const roots = [];
  const childrenByOwner = new Map();
  for (const player of allPlayers) {
    const ownerId = stateMap.get(player.id)?.owner_id ?? player.owner_id ?? null;
    if (ownerId != null && ownerId !== player.id && playerById.has(ownerId)) {
      const children = childrenByOwner.get(ownerId) ?? [];
      children.push(player);
      childrenByOwner.set(ownerId, children);
    } else {
      roots.push(player);
    }
  }

  roots.sort(compareDisplayPlayers);

  const ordered = [];
  const visited = new Set();
  function appendWithChildren(player) {
    if (visited.has(player.id)) {
      return;
    }
    visited.add(player.id);
    ordered.push(player);
    for (const child of childrenByOwner.get(player.id) ?? []) {
      appendWithChildren(child);
    }
  }

  for (const root of roots) {
    appendWithChildren(root);
  }
  for (const player of allPlayers) {
    appendWithChildren(player);
  }
  return ordered;
}

function frameWinnerNames(frame, playersById) {
  const winnerIds = Array.isArray(frame.winner_ids) ? frame.winner_ids : [];
  if (!winnerIds.length) {
    return "未分出胜负";
  }
  const stateMap = buildStateMap(frame.states);
  return winnerIds
    .map((winnerId) => {
      const player = playersById.get(winnerId);
      return player?.display_name ?? replayDisplayName(stateMap.get(winnerId), winnerId);
    })
    .join("、");
}

function frameWinnerLineHtml(frame, playersById) {
  return `<div class="row winner-line"><span class="winner-row">胜者：${escapeHtml(frameWinnerNames(frame, playersById))}</span></div>`;
}

function involvedSetForUpdate(update) {
  const involved = { casters: new Set(), targets: new Set() };
  if (update.caster_id != null) {
    involved.casters.add(update.caster_id);
  }
  if (update.target_id != null) {
    involved.targets.add(update.target_id);
  }
  if (Array.isArray(update.target_ids)) {
    update.target_ids.forEach((id) => involved.targets.add(id));
  }
  return involved;
}

function statesFromRunningMap(running) {
  return Array.from(running.values());
}

function updateParticipantIds(update) {
  const ids = [];
  const add = (id) => {
    if (id == null || ids.includes(id)) {
      return;
    }
    ids.push(id);
  };

  add(update.caster_id);
  add(update.target_id);
  if (Array.isArray(update.target_ids)) {
    update.target_ids.forEach(add);
  }
  return ids;
}

function syncReappearedParticipants(update, hitState, frameStateMap) {
  for (const id of updateParticipantIds(update)) {
    const frameState = frameStateMap.get(id);
    if (!frameState?.alive) {
      continue;
    }

    const currentState = hitState.get(id);
    if (currentState?.alive) {
      continue;
    }

    hitState.set(id, { ...frameState, _is_new_in_frame: true });
  }
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
export function renderPlayers(
  players,
  states,
  previousStates = states,
  involved = null,
  playerList,
  playersById,
) {
  const stateMap = buildStateMap(states);
  const previousStateMap = buildStateMap(previousStates);
  const seedLine = playerList.dataset.seedLine ?? "";
  const allPlayers = orderedDisplayPlayers(players, states, stateMap, playersById);
  const layoutKey = allPlayers.map((player) => `${player.team_index}:${player.id}`).join("|");

  const existingRows = playerList.querySelectorAll("tr[data-player-id]");
  const shouldRenderFullList =
    existingRows.length !== allPlayers.length || playerList.dataset.playerLayoutKey !== layoutKey;
  if (shouldRenderFullList) {
    // —— 全量渲染（首次、玩家数量变化或展示顺序变化时） ——
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
            const deadClass = playerRowLifeClass(state, previous);
            const involvedClass = involved
              ? involved.casters.has(player.id) && involved.targets.has(player.id)
                ? " is-caster is-target"
                : involved.casters.has(player.id)
                  ? " is-caster"
                  : involved.targets.has(player.id)
                    ? " is-target"
                    : ""
              : "";
            const nameClass = state.alive ? "name" : "name namedie";
            const stateClass = !state.alive
              ? "status-pill dead"
              : state.frozen
                ? "status-pill frozen"
                : "status-pill";

            const mpMetrics = playerMpMetrics(state, previous);

            return `
                        <tr class="player-row${deadClass}${involvedClass}" data-player-id="${player.id}" title="id: ${escapeHtml(player.id_name)} · playerId: ${player.id}">
                            <td class="player-name-cell">
                                <div class="player-name-wrap">
                                    ${renderIconSprite(playerIconClassId(player), "sgl icon-sprite")}
                                    <span class="${nameClass}">${escapeHtml(player.display_name)}</span>
                                    <span class="player-id"> #${player.id}</span>
                                    <button type="button" class="detail-btn" data-player-detail-id="${player.id}" title="打开角色详情" aria-label="打开角色详情">i</button>
                                </div>
                                <div class="hpwrap compact" style="width:${totalWidth}px">
                                    <div class="maxhp" style="width:${totalWidth}px"></div>
                                    <div class="oldhp" style="width:${previousWidth}px"></div>
                                    <div class="healhp" style="left:${healStart}px;width:${healWidth}px"></div>
                                    <div class="hp" style="width:${fillWidth}px"></div>
                                </div>
                                <div class="mpwrap" style="width:${mpMetrics.totalWidth}px">
                                    <div class="mp-prev" style="width:${mpMetrics.previousWidth}px"></div>
                                    <div class="mp-recover" style="left:${mpMetrics.recoverLeft}px;width:${mpMetrics.recoverWidth}px"></div>
                                    <div class="mp-cost" style="left:${mpMetrics.costLeft}px;width:${mpMetrics.costWidth}px"></div>
                                    <div class="mp" style="width:${mpMetrics.fillWidth}px"></div>
                                </div>
                                ${renderPlayerStatusPills(state)}
                            </td>
                            <td class="player-stat-cell player-hp-cell">${state.hp}/${state.max_hp}</td>
                            <td class="player-stat-cell player-mp-move-cell"><span class="mp-val">${state.magic_point}</span> / <span class="move-val">${((state.move_point / 2048) * 100).toFixed(0)}%</span></td>
                            <td class="player-state-cell"><span class="${stateClass}">${statusText(state)}</span></td>
                        </tr>
                    `;
          })
          .join("");

        const isSingle = teamPlayers.length === 1;
        const labelHtml = !isSingle ? `<div class="team-label">Team ${teamIndex + 1}</div>` : "";
        const theadHtml = !isSingle
          ? `
                        <thead>
                            <tr>
                                <th class="player-name-head">角色</th>
                                <th class="player-hp-head">HP</th>
                                <th class="player-mix-head">蓝量/体力</th>
                                <th class="player-state-head">状态</th>
                            </tr>
                        </thead>`
          : "";
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
    const columnHeader = firstTeamIsSingle
      ? `
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
        </table>`
      : "";
    playerList.innerHTML = seedRowHtml(seedLine) + columnHeader + teamHtml;
    playerList.dataset.playerLayoutKey = layoutKey;
  } else {
    const seedRow = playerList.querySelector(".seed-row");
    if (seedLine) {
      if (seedRow) {
        const valueEl = seedRow.querySelector(".seed-value");
        if (valueEl) {
          valueEl.textContent = seedLine;
        }
      } else {
        playerList.insertAdjacentHTML("afterbegin", seedRowHtml(seedLine));
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
      const deadClass = playerRowLifeClass(state, previous);
      const involvedClass = involved
        ? involved.casters.has(player.id) && involved.targets.has(player.id)
          ? " is-caster is-target"
          : involved.casters.has(player.id)
            ? " is-caster"
            : involved.targets.has(player.id)
              ? " is-target"
              : ""
        : "";
      const nameClass = state.alive ? "name" : "name namedie";
      const stateClass = !state.alive
        ? "status-pill dead"
        : state.frozen
          ? "status-pill frozen"
          : "status-pill";
      const mpMetrics = playerMpMetrics(state, previous);

      row.className = `player-row${deadClass}${involvedClass}`;
      row.title = `id: ${player.id_name} · playerId: ${player.id}`;

      const nameEl = row.querySelector(".player-name-wrap .name, .player-name-wrap .namedie");
      if (nameEl) {
        nameEl.className = nameClass;
        nameEl.textContent = player.display_name;
      }

      const hpwrapEl = row.querySelector(".hpwrap");
      if (hpwrapEl) hpwrapEl.style.width = totalWidth + "px";
      const maxhpEl = row.querySelector(".maxhp");
      if (maxhpEl) maxhpEl.style.width = totalWidth + "px";
      const hpEl = row.querySelector(".hp");
      if (hpEl) hpEl.style.width = fillWidth + "px";
      const oldhpEl = row.querySelector(".oldhp");
      if (oldhpEl) oldhpEl.style.width = previousWidth + "px";
      const healhpEl = row.querySelector(".healhp");
      if (healhpEl) {
        healhpEl.style.left = healStart + "px";
        healhpEl.style.width = healWidth + "px";
      }

      const mpwrapEl = row.querySelector(".mpwrap");
      if (mpwrapEl) mpwrapEl.style.width = mpMetrics.totalWidth + "px";
      const mpPrevEl = row.querySelector(".mp-prev");
      if (mpPrevEl) mpPrevEl.style.width = mpMetrics.previousWidth + "px";
      const mpRecoverEl = row.querySelector(".mp-recover");
      if (mpRecoverEl) {
        mpRecoverEl.style.left = mpMetrics.recoverLeft + "px";
        mpRecoverEl.style.width = mpMetrics.recoverWidth + "px";
      }
      const mpCostEl = row.querySelector(".mp-cost");
      if (mpCostEl) {
        mpCostEl.style.left = mpMetrics.costLeft + "px";
        mpCostEl.style.width = mpMetrics.costWidth + "px";
      }
      const mpEl = row.querySelector(".mp");
      if (mpEl) mpEl.style.width = mpMetrics.fillWidth + "px";

      const nameWrap = row.querySelector(".player-name-wrap");
      if (nameWrap) {
        const iconEl = nameWrap.querySelector(".icon-sprite");
        if (iconEl) {
          iconEl.outerHTML = renderIconSprite(playerIconClassId(player), "sgl icon-sprite");
        }

        let idSpan = nameWrap.querySelector(".player-id");
        if (!idSpan) {
          idSpan = document.createElement("span");
          idSpan.className = "player-id";
          nameWrap.appendChild(idSpan);
        }
        idSpan.textContent = " #" + player.id;

        let detailBtn = nameWrap.querySelector(".detail-btn");
        if (!detailBtn) {
          nameWrap.insertAdjacentHTML(
            "beforeend",
            `<button type="button" class="detail-btn" data-player-detail-id="${player.id}" title="打开角色详情" aria-label="打开角色详情">i</button>`,
          );
          detailBtn = nameWrap.querySelector(".detail-btn");
        }
        if (detailBtn) {
          detailBtn.dataset.playerDetailId = String(player.id);
        }
      }

      const effectsEl = row.querySelector(".player-effects");
      if (effectsEl) {
        const labels = sidebarStatusLabels(state);
        effectsEl.hidden = labels.length === 0;
        effectsEl.innerHTML = labels.map(renderStatusPill).join("");
      }

      const hpCell = row.querySelector(".player-hp-cell");
      if (hpCell) hpCell.textContent = `${state.hp}/${state.max_hp}`;

      const mpMoveCell = row.querySelector(".player-mp-move-cell");
      if (mpMoveCell) {
        const mpSpan = mpMoveCell.querySelector(".mp-val");
        const moveSpan = mpMoveCell.querySelector(".move-val");
        if (mpSpan) mpSpan.textContent = `${state.magic_point}`;
        if (moveSpan) moveSpan.textContent = ((state.move_point / 2048) * 100).toFixed(0) + "%";
      }

      const stateEl = row.querySelector(".player-state-cell span");
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
function structuredPlayerToken(part, clip, stateMap, previousStateMap, playersById) {
  const playerId = part.player_id;
  const stateBase = stateMap.get(playerId) ?? previousStateMap.get(playerId) ?? null;
  const maxHp = Math.max(
    1,
    Number(stateBase?.max_hp ?? 0),
    Number(part.hp_before ?? 0),
    Number(part.hp_after ?? 0),
  );
  const nextHp = Number(part.hp_after ?? stateBase?.hp ?? 0);
  const previousHp = Number(part.hp_before ?? stateBase?.hp ?? nextHp);
  const nextState = {
    ...(stateBase ?? {
      id: playerId,
      team_index: 0,
      id_name: `player_${playerId}`,
      icon_key: `player_${playerId}`,
      display_name: part.text ?? `#${playerId}`,
      max_hp: maxHp,
      hp: nextHp,
      alive: nextHp > 0,
    }),
    hp: nextHp,
    max_hp: maxHp,
    alive: nextHp > 0,
  };
  const previousBase = previousStateMap.get(playerId) ?? stateBase ?? nextState;
  const previousState = {
    ...previousBase,
    hp: previousHp,
    max_hp: maxHp,
    alive: previousHp > 0,
  };
  const player = playersById.get(playerId) ?? syntheticPlayerFromState(playerId, nextState, playersById);
  return actorToken(player, nextState, previousState, { tone: clip.color }, { showHp: Boolean(part.show_hp) });
}

function renderStructuredPart(part, clip, stateMap, previousStateMap, playersById) {
  if (part.kind === "player") {
    return structuredPlayerToken(part, clip, stateMap, previousStateMap, playersById);
  }
  if (part.kind === "data") {
    return `<span class="message-number">${escapeHtml(part.text ?? "")}</span>`;
  }
  if (part.kind === "highlight") {
    return `<span class="skill-token">${escapeHtml(part.text ?? "")}</span>`;
  }
  return escapeHtml(part.text ?? "");
}

function structuredClipHtml(clip, playersById) {
  if (clip.winner) {
    const text = (clip.parts ?? []).map((part) => escapeHtml(part.text ?? "")).join("");
    return `<span class="winner-row">${text}</span>`;
  }
  const stateMap = buildStateMap(clip.sidebar_states ?? []);
  const previousStateMap = buildStateMap(clip.sidebar_previous_states ?? clip.sidebar_states ?? []);
  const body = (clip.parts ?? [])
    .map((part) => renderStructuredPart(part, clip, stateMap, previousStateMap, playersById))
    .join("");
  return `<span class="msg ${clip.color ?? "normal"}">${body}</span>`;
}

function structuredClipSidebar(clip) {
  if (!Array.isArray(clip.sidebar_states) || !clip.sidebar_states.length) {
    return null;
  }
  return {
    sidebarStates: clip.sidebar_states,
    sidebarPreviousStates: clip.sidebar_previous_states ?? clip.sidebar_states,
    sidebarInvolved: {
      casters: new Set(clip.caster_ids ?? []),
      targets: new Set(clip.target_ids ?? []),
    },
  };
}

function buildStructuredFrameRows(frame, roundIndex, playersById) {
  const chunks = [];
  let frameStarted = false;
  let rowStarted = false;

  for (const row of frame.rows ?? []) {
    rowStarted = false;
    for (const clip of row.clips ?? []) {
      const messageHtml = structuredClipHtml(clip, playersById);
      const delay = Number.isFinite(clip.delay) ? clip.delay : 0;
      const sidebar = structuredClipSidebar(clip);
      if (!frameStarted) {
        chunks.push({
          target: "battleRows",
          html: `
                    <section class="round-block">
                        <div class="frame-sidebar"><span class="frame-chip">#${roundIndex}</span></div>
                        <div class="frame-body">
                            <div class="row${clip.winner ? " winner-line" : ""}">${messageHtml}</div>
                        </div>
                    </section>
                `,
          delay,
          ...(sidebar ?? {}),
        });
        frameStarted = true;
        rowStarted = true;
        continue;
      }
      if (!rowStarted) {
        chunks.push({
          target: "frameBody",
          html: `<div class="row${clip.winner ? " winner-line" : ""}">${messageHtml}</div>`,
          delay,
          ...(sidebar ?? {}),
        });
        rowStarted = true;
        continue;
      }
      chunks.push({
        target: "row",
        html: `<span class="msg-sep">, </span>${messageHtml}`,
        delay,
        ...(sidebar ?? {}),
      });
    }
  }

  return chunks;
}

export function buildFrameHtml(frame, roundIndex, previousStates = frame.states, playersById) {
  for (const state of frame.states) {
    if (playersById.has(state.id)) {
      continue;
    }

    playersById.set(state.id, syntheticPlayerFromState(state.id, state, playersById));
  }

  const previousStateMap = buildStateMap(previousStates);
  const frameStateMap = buildStateMap(frame.states);
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
    rows.push(`<div class="row">${segments.join('<span class="msg-sep">, </span>')}</div>`);
    segments = [];
  }

  /**
   * 对 running 中的某个角色施加 HP 变化。
   * @param {number} id — 角色 id
   * @param {Map<number, FightState>} hitState — 当前帧内模拟状态 Map
   * @param {number} hpDelta — 正数为回复，负数为伤害
   */
  function applyDelta(id, hitState, hpDelta) {
    const cur = hitState.get(id);
    if (!cur || cur.max_hp <= 0) return;
    if (hpDelta < 0) {
      hitState.set(id, { ...cur, hp: Math.max(0, cur.hp + hpDelta) });
    } else if (hpDelta > 0) {
      hitState.set(id, { ...cur, hp: Math.min(cur.max_hp, cur.hp + hpDelta) });
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
    syncReappearedParticipants(update, hitState, frameStateMap);
    const hpDelta = Number.isFinite(update.hp_delta) ? update.hp_delta : 0;
    if (hpDelta !== 0) {
      if (update.target_id != null) applyDelta(update.target_id, hitState, hpDelta);
      if (Array.isArray(update.target_ids))
        update.target_ids.forEach((id) => applyDelta(id, hitState, hpDelta));
    }
    segments.push(
      `<span class="msg ${tone}">${highlightMessage(update, tone, hitState, running, playersById)}</span>`,
    );
    running = hitState;
  }

  // 帧内所有消息处理完后才清除 _is_new_in_frame，确保同一帧中的多条消息都能识别新对象
  for (const [k, v] of running.entries()) {
    if (v._is_new_in_frame) {
      running.set(k, { ...v, _is_new_in_frame: false });
    }
  }

  flushRow();

  if (!rows.length && !frame.finished) {
    return "";
  }

  const winnerLine = frame.finished ? frameWinnerLineHtml(frame, playersById) : "";

  return `
        <section class="round-block">
            <div class="frame-sidebar"><span class="frame-chip">#${roundIndex}</span></div>
            <div class="frame-body">
                ${rows.join("")}
                ${winnerLine}
            </div>
        </section>
    `;
}

/**
 * 构建单帧的渲染 chunk 数组，用于 normal/fast 模式逐段渲染。
 * next_line 只负责切到新行，不再把整行消息聚合成一个大 chunk。
 * 每条可见消息都会成为独立 chunk，并携带混淆版 md5.js 原始渲染器的未缩放等待时间：
 * 等待时间 = max(update.delay0, 上一条可见 update 的 delay1)，每帧起始上一条 delay1 为 1800。
 *
 * @param {FrameUpdate} frame
 * @param {number} roundIndex
 * @param {FightState[]} [previousStates=frame.states]
 * @param {Map<number, FightPlayer>} playersById
 * @returns {Array<{target: 'battleRows' | 'frameBody' | 'row' | 'delay', html: string, delay: number}>}
 */
export function buildFrameRows(frame, roundIndex, previousStates = frame.states, playersById) {
  if (Array.isArray(frame.rows) && frame.rows.length) {
    return buildStructuredFrameRows(frame, roundIndex, playersById);
  }

  for (const state of frame.states) {
    if (playersById.has(state.id)) {
      continue;
    }

    playersById.set(state.id, syntheticPlayerFromState(state.id, state, playersById));
  }

  const previousStateMap = buildStateMap(previousStates);
  const frameStateMap = buildStateMap(frame.states);
  /** @type {Map<number, FightState>} */
  let running = new Map(previousStateMap);
  /** @type {Array<{target: 'battleRows' | 'frameBody' | 'row' | 'delay', html: string, delay: number}>} */
  const chunks = [];
  let frameStarted = false;
  let rowStarted = false;
  let nextWait = 1800;
  let quickAreaSkillActive = false;

  function pushVisibleChunk(target, html, delay, sidebar = null) {
    chunks.push({ target, html, delay, ...(sidebar ?? {}) });
  }

  function visibleWait(update) {
    const delay0 = Number.isFinite(update.delay0) ? update.delay0 : 0;
    const delay1 = Number.isFinite(update.delay1) ? update.delay1 : 0;
    const wait = Math.max(delay0, nextWait);
    nextWait = delay1;
    return wait;
  }

  function pushLeadingDelayChunk() {
    // 混淆版 md5.js 的换行和空消息不会单独等待；保留函数让后续流程不需要分支。
  }

  function pushMessageChunk(messageHtml, delay, sidebar) {
    if (!frameStarted) {
      pushVisibleChunk(
        "battleRows",
        `
                    <section class="round-block">
                        <div class="frame-sidebar"><span class="frame-chip">#${roundIndex}</span></div>
                        <div class="frame-body">
                            <div class="row">${messageHtml}</div>
                        </div>
                    </section>
                `,
        delay,
        sidebar,
      );
      frameStarted = true;
      rowStarted = true;
      return;
    }

    if (!rowStarted) {
      pushVisibleChunk("frameBody", `<div class="row">${messageHtml}</div>`, delay, sidebar);
      rowStarted = true;
      return;
    }

    pushVisibleChunk("row", `<span class="msg-sep">, </span>${messageHtml}`, delay, sidebar);
  }

  function applyDelta(id, hitState, hpDelta) {
    const cur = hitState.get(id);
    if (!cur || cur.max_hp <= 0) return;
    if (hpDelta < 0) {
      const hp = Math.max(0, cur.hp + hpDelta);
      hitState.set(id, { ...cur, hp, alive: hp > 0 });
    } else if (hpDelta > 0) {
      const hp = Math.min(cur.max_hp, cur.hp + hpDelta);
      hitState.set(id, { ...cur, hp, alive: hp > 0 });
    }
  }

  for (const update of frame.updates) {
    if (update.update_type === "next_line") {
      rowStarted = false;
      continue;
    }

    const message = `${update.message_rendered ?? ""}`.trim();
    if (!message) {
      continue;
    }

    pushLeadingDelayChunk();
    const rawDelay = visibleWait(update);
    if (isQuickAreaSkillUpdate(update)) {
      quickAreaSkillActive = true;
    }
    const delay = quickAreaSkillActive ? quickAreaSkillDelay(rawDelay) : rawDelay;

    const tone = update.tone ?? "normal";
    const previousForMessage = new Map(running);
    const hitState = new Map(running);
    syncReappearedParticipants(update, hitState, frameStateMap);
    const hpDelta = Number.isFinite(update.hp_delta) ? update.hp_delta : 0;
    if (hpDelta !== 0) {
      if (update.target_id != null) applyDelta(update.target_id, hitState, hpDelta);
      if (Array.isArray(update.target_ids))
        update.target_ids.forEach((id) => applyDelta(id, hitState, hpDelta));
    }

    pushMessageChunk(
      `<span class="msg ${tone}">${highlightMessage(update, tone, hitState, running, playersById)}</span>`,
      delay,
      {
        sidebarStates: statesFromRunningMap(hitState),
        sidebarPreviousStates: statesFromRunningMap(previousForMessage),
        sidebarInvolved: involvedSetForUpdate(update),
      },
    );
    running = hitState;
  }

  // 帧内所有消息处理完后才清除 _is_new_in_frame，确保同一帧中的多条消息都能识别新对象
  for (const [k, v] of running.entries()) {
    if (v._is_new_in_frame) {
      running.set(k, { ...v, _is_new_in_frame: false });
    }
  }

  if (!chunks.length) {
    pushLeadingDelayChunk();
    if (!frame.finished) {
      return chunks;
    }
  }

  const winnerHtml = frameWinnerLineHtml(frame, playersById);
  if (frame.finished) {
    if (!frameStarted) {
      pushLeadingDelayChunk();
      chunks.push({
        target: "battleRows",
        html: `
                    <section class="round-block">
                        <div class="frame-sidebar"><span class="frame-chip">#${roundIndex}</span></div>
                        <div class="frame-body">
                            ${winnerHtml}
                        </div>
                    </section>
                `,
        delay: WIN_UPDATE_DELAY0_MS,
      });
    } else {
      chunks.push({
        target: "frameBody",
        html: winnerHtml,
        delay: WIN_UPDATE_DELAY0_MS,
      });
    }
  }

  return chunks;
}
