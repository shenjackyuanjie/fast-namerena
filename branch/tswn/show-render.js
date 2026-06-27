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
 *
 * ### 结构化回放渲染
 * - {@link buildFrameRows} — 只消费 core/WASM 提供的 frame.rows[].clips[]。
 *   delay、分行、文本片段、高亮色、HP 条和死亡效果均来自 replay view 字段；
 *   前端不再从 message_template/message_rendered/hp_delta 反推展示语义。
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
 */

import {
  escapeHtml,
  actorHpMetrics,
  statusText,
  buildStateMap,
  replayDisplayName,
  renderIconSprite,
} from "./show-utils.js";

function playerIconClassId(player) {
  return player?.icon_class_id ?? player?.id;
}

function replayHighlightColorStyle(color) {
  const value = `${color ?? ""}`.trim();
  return /^[0-9a-fA-F]{6}$/.test(value) ? ` style="color:#${value}"` : "";
}

// ============================================================================
// 角色 Token 渲染（消息行里的小头像 + 名字 + HP 条）
// ============================================================================

/**
 * 渲染一个角色在消息行中的 token（小头像 + HP mini bar + 名字）。
 * @param {FightPlayer} player — 玩家对象
 * @param {FightState} state — 当前状态
 * @param {FightState} previousState — 上一帧状态
 * @param {{ showHp?: boolean, forceHp?: boolean, deathEffect?: boolean }} [options] — 是否显示 HP mini bar / 死亡效果
 * @returns {string} HTML 字符串
 */
export function actorToken(player, state, previousState, update, { showHp = true, forceHp = false, deathEffect = null } = {}) {
  // 仅在血量变化时或新实体首次出现时显现血条。
  // 被减速等 debuff 状态不会改变血量，因此不展示血条。
  const isNew = state?._is_new_in_frame;
  const hpChanged = isNew || (previousState != null && Number(state.hp) !== Number(previousState.hp));
  const shouldShowHp = showHp && (forceHp || hpChanged);
  const hpMetrics = shouldShowHp ? actorHpMetrics(state, previousState) : null;
  const hpBar = hpMetrics
    ? `
            <span class="actor-hp" style="width:${hpMetrics.totalWidth}px">
                <span class="actor-hp-fill" style="width:${hpMetrics.fillWidth}px"></span>
                ${hpMetrics.deltaWidth > 0 ? `<span class="actor-hp-delta is-${hpMetrics.deltaKind}" style="left:${hpMetrics.deltaLeft}px;width:${hpMetrics.deltaWidth}px"></span>` : ""}
            </span>
        `
    : "";
  const hpClass = hpMetrics ? " has-hp" : "";
  const isKnockout = deathEffect ?? (update?.tone === "knockout" || (state && !state.alive));
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
    display_index: state?.display_index ?? 0,
    id_name: state?.id_name ?? `player_${playerId}`,
    icon_key: state?.icon_key ?? state?.id_name ?? `player_${playerId}`,
    display_name: replayDisplayName(state, playerId),
    icon_png_base64: icon,
    icon_class_id,
  };
}

function syncSyntheticPlayerFromState(playerId, state, playersById) {
  const player = syntheticPlayerFromState(playerId, state, playersById);
  playersById.set(playerId, player);
  return player;
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
    display_index: state?.display_index ?? player.display_index ?? 0,
    id_name: state?.id_name ?? player.id_name,
    icon_key: state?.icon_key ?? player.icon_key,
    display_name: state ? replayDisplayName(state, state.id ?? player.id) : player.display_name,
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
    const phantomPlayer = syncSyntheticPlayerFromState(state.id, state, playersById);
    allPlayers.push(phantomPlayer);
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
                                    <span class="${nameClass}">${escapeHtml(replayDisplayName(state, player.id))}</span>
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
        nameEl.textContent = replayDisplayName(state, player.id);
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
  const player =
    stateBase != null
      ? syncSyntheticPlayerFromState(playerId, nextState, playersById)
      : (playersById.get(playerId) ?? syncSyntheticPlayerFromState(playerId, nextState, playersById));
  return actorToken(player, nextState, previousState, { tone: clip.tone ?? "normal" }, {
    showHp: Boolean(part.show_hp),
    forceHp: Boolean(part.show_hp),
    deathEffect: Boolean(part.death_effect),
  });
}

function renderStructuredPart(part, clip, stateMap, previousStateMap, playersById) {
  if (part.kind === "player") {
    return structuredPlayerToken(part, clip, stateMap, previousStateMap, playersById);
  }
  if (part.kind === "data") {
    return `<span class="message-number">${escapeHtml(part.text ?? "")}</span>`;
  }
  if (part.kind === "highlight") {
    return `<span class="skill-token"${replayHighlightColorStyle(clip.color)}>${escapeHtml(part.text ?? "")}</span>`;
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
  const tone = clip.tone ?? "normal";
  return `<span class="msg ${tone}">${body}</span>`;
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

/**
 * 构建单帧的渲染 chunk 数组，用于 normal/fast 模式逐段渲染。
 * next_line 只负责切到新行，不再把整行消息聚合成一个大 chunk。
 * 每条可见消息都会成为独立 chunk，并携带 WASM/core replay view 使用的未缩放等待时间。
 *
 * @param {FrameUpdate} frame
 * @param {number} roundIndex
 * @param {FightState[]} [previousStates=frame.states]
 * @param {Map<number, FightPlayer>} playersById
 * @returns {Array<{target: 'battleRows' | 'frameBody' | 'row' | 'delay', html: string, delay: number}>}
 */
export function buildFrameRows(frame, roundIndex, previousStates = frame.states, playersById) {
  void previousStates;
  if (!Array.isArray(frame.rows) || !frame.rows.length) {
    return [];
  }
  return buildStructuredFrameRows(frame, roundIndex, playersById);
}
