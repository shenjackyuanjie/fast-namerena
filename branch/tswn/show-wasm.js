/**
 * @fileoverview tswn_wasm 战斗回放展示页 — WASM 模块加载与回放生成
 *
 * 负责动态加载 tswn_wasm WASM 模块（懒加载 + 缓存），
 * 以及根据用户输入调用 FightSession 生成完整回放数据。
 */

// ============================================================================
// 模块级缓存
// ============================================================================

/** @type {object|null} WASM 模块的 API 句柄，仅在首次 ensureApi() 时初始化 */
let wasmApi = null;

// ============================================================================
// 模块加载
// ============================================================================

/**
 * 尝试加载 tswn_wasm WASM 模块。
 *
 * 基于当前脚本自身的 URL（import.meta.url）枚举多个候选路径，
 * 兼容 examples/ 子目录部署和扁平部署两种结构：
 *   - show-wasm.js 在 examples/ 下 → 尝试 ../pkg/tswn_wasm.js
 *   - show-wasm.js 与 pkg/ 同级    → 尝试 ./pkg/tswn_wasm.js
 *
 * @param {HTMLElement} modulePathInfo — 用于展示加载路径的 DOM 元素
 * @returns {Promise<object>} WASM 模块的导出对象
 * @throws {Error} 若所有候选路径均加载失败
 */
export async function loadModule(modulePathInfo) {
    const base = new URL('.', import.meta.url);
    const candidates = [
        { label: '../pkg/tswn_wasm.js', url: new URL('../pkg/tswn_wasm.js', base) },
        { label: './pkg/tswn_wasm.js', url: new URL('./pkg/tswn_wasm.js', base) },
    ];

    let lastError = null;
    for (const candidate of candidates) {
        try {
            const mod = await import(candidate.url);
            modulePathInfo.textContent = `module: ${candidate.label}`;
            return mod;
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError;
}

/**
 * 确保 WASM API 已初始化（懒加载 + 缓存）。
 * 首次调用时会加载模块、调用 default() 初始化、记录版本信息。
 *
 * @param {HTMLElement} versionInfo — wrapper 版本展示 DOM
 * @param {HTMLElement} coreVersionInfo — core 版本展示 DOM
 * @param {HTMLElement} modulePathInfo — 模块路径展示 DOM
 * @returns {Promise<object>} WASM API 对象
 */
export async function ensureApi(versionInfo, coreVersionInfo, modulePathInfo) {
    if (wasmApi) {
        return wasmApi;
    }
    const mod = await loadModule(modulePathInfo);
    await mod.default();
    versionInfo.textContent = `wrapper: ${mod.version()}`;
    coreVersionInfo.textContent = `core: ${mod.core_version()}`;
    wasmApi = mod;
    return wasmApi;
}

// ============================================================================
// 回放生成
// ============================================================================

/**
 * 从原始输入里提取显式指定的 seed 行。
 * @param {string} rawInput
 * @returns {string|null}
 */
function extractSpecifiedSeedLine(rawInput) {
    for (const line of rawInput.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (/^seed:/i.test(trimmed)) {
            return trimmed;
        }
    }
    return null;
}

/**
 * 根据原始输入文本生成完整回放数据。
 *
 * @param {string} rawInput — 原始输入文本（每行一个名字，空行分隔队伍）
 * @param {HTMLElement} versionInfo
 * @param {HTMLElement} coreVersionInfo
 * @param {HTMLElement} modulePathInfo
 * @returns {Promise<FightReplay>}
 */
export async function buildReplay(rawInput, versionInfo, coreVersionInfo, modulePathInfo) {
    const api = await ensureApi(versionInfo, coreVersionInfo, modulePathInfo);
    const session = new api.FightSession(rawInput, { includeIcons: true, captureReplay: true });
    const players = session.players();
    const initialStates = session.state();
    const wasmStart = performance.now();
    const replay = session.run_to_end();
    const wasmDurationMs = performance.now() - wasmStart;
    return {
        rawInput,
        seedLine: extractSpecifiedSeedLine(rawInput),
        players,
        initialStates,
        frames: replay.frames,
        winnerIds: replay.winnerIds,
        finalStates: replay.finalStates,
        wasmDurationMs,
    };
}
