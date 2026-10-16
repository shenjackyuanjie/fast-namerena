/** 角色详情的纯渲染函数，读取当前可见快照。 */
import { escapeHtml, playerStatusLabels, replayDisplayName } from "./show-utils.js";

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

export function buildPlayerDetailHtml(player, state, canEditNickname) {
  const source = state ?? player ?? null;
  const displayName = state ? replayDisplayName(state, state.id) : (player?.display_name ?? "未知角色");
  const rawName = player?._raw_display_name ?? state?._raw_display_name ?? displayName;
  const idName = player?.id_name ?? state?.id_name ?? "";
  const statusLabels = playerStatusLabels(source).join("、");
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
