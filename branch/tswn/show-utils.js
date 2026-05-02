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
 * @param {number|null|undefined} iconId
 * @returns {string}
 */
export function iconClassName(iconId) {
    return iconId == null ? "icon_missing" : `icon_${iconId}`;
}

/**
 * 为当前回放中的玩家列表生成 `.icon_N { background-image: ... }` 样式规则。
 * @param {FightPlayer[]} players
 * @returns {string}
 */
export function buildIconClassCss(players) {
    return players
    .map((player) => `.${iconClassName(player.id)} { background-image: url("${iconSrc(player.icon_png_base64)}"); }`)
        .join("\n");
}

/**
 * 为 show 回放玩家列表补齐 iconClassId。
 * 多对多时，整队统一使用输入顺序中该队第一个玩家的头像编号。
 * @param {FightPlayer[]} players
 * @returns {FightPlayer[]}
 */
export function withTeamIconClassIds(players) {
    const firstPlayerIdByTeam = new Map();
    return players.map((player) => {
        const existing = firstPlayerIdByTeam.get(player.team_index);
        const iconClassId = existing ?? player.id;
        if (existing == null) {
            firstPlayerIdByTeam.set(player.team_index, player.id);
        }
        return {
            ...player,
            iconClassId,
        };
    });
}

/**
 * 渲染一个 show 风格头像节点。
 * 头像图片由外部注入的 `.icon_N` 规则提供，这里只负责输出结构和类名。
 * @param {number|null|undefined} iconId
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
    if (state.minion_kind === 'clone') {
        return playerId == null ? state.display_name : `${state.display_name} #${playerId}`;
    }
    if (state.minion_kind === 'summon' || state.minion_kind === 'shadow' || state.minion_kind === 'zombie') {
        const baseName = state.display_name
            ?? (state.minion_kind === 'shadow'
                ? '幻影'
                : state.minion_kind === 'zombie'
                    ? '丧尸'
                    : '使魔');
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
export function actorHpMetrics(state, previousState = state) {
    if (!state || state.max_hp <= 0) {
        return null;
    }

    const maxHp = Math.max(1, state.max_hp, previousState?.max_hp ?? 0);
    const hp = Math.max(0, Math.min(maxHp, state.hp));
    const previousHp = Math.max(0, Math.min(maxHp, previousState?.hp ?? hp));
    // 基础宽度根据最大 HP 的平方根自适应，然后缩放 1.5 倍
    const totalWidth = Math.max(20, Math.min(56, 16 + Math.round(Math.sqrt(maxHp) * 2.8))) * 1.5;
    const fillWidth = hp > 0 ? Math.max(1, Math.round((hp / maxHp) * totalWidth)) : 0;
    const previousWidth = previousHp > 0 ? Math.max(1, Math.round((previousHp / maxHp) * totalWidth)) : 0;
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
 * @returns {string} HTML 字符串
 */
export function formatMessageText(text, tone) {
    let html = escapeHtml(text);
    // [技能名] 包裹为 span
    html = html.replace(/(\[[^\]]+\])/g, '<span class="skill-token">$1</span>');

    if (tone === "damage") {
        // "XX点伤害" 中的数字高亮
        html = html.replace(/(\d+)(?=点伤害)/g, '<span class="message-number">$1</span>');
    }
    if (tone === "recover") {
        // "回复XX点" 中的数字高亮
        html = html.replace(/(\d+)(?=点)/g, '<span class="message-number">$1</span>');
    }
    return html;
}
