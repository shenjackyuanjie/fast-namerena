/**
 * @fileoverview tswn_wasm 战斗回放展示页 — WASM 模块加载与流式战斗
 *
 * 负责动态加载 tswn_wasm WASM 模块（懒加载 + 缓存），
 * 以及创建 BattleSession、逐帧拉取和显式释放 WASM 资源。
 */

// ============================================================================
// 模块级缓存
// ============================================================================

/** @type {object|null} WASM 模块的 API 句柄，仅在首次 ensureApi() 时初始化 */
let wasmApi = null;
const MODULE_CACHE_BUST = Date.now().toString(36);

function withCacheBust(url) {
    const busted = new URL(url);
    busted.searchParams.set('v', MODULE_CACHE_BUST);
    return busted;
}

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
 * @returns {Promise<{ mod: object, wasmUrl: URL }>} WASM 模块及对应 wasm URL
 * @throws {Error} 若所有候选路径均加载失败
 */
export async function loadModule(modulePathInfo) {
    const base = new URL('.', import.meta.url);
    const candidates = [
        {
            label: '../pkg/tswn_wasm.js',
            moduleUrl: withCacheBust(new URL('../pkg/tswn_wasm.js', base)),
            wasmUrl: withCacheBust(new URL('../pkg/tswn_wasm_bg.wasm', base)),
        },
        {
            label: './pkg/tswn_wasm.js',
            moduleUrl: withCacheBust(new URL('./pkg/tswn_wasm.js', base)),
            wasmUrl: withCacheBust(new URL('./pkg/tswn_wasm_bg.wasm', base)),
        },
    ];

    let lastError = null;
    for (const candidate of candidates) {
        try {
            const mod = await import(candidate.moduleUrl.href);
            modulePathInfo.textContent = `module: ${candidate.label}`;
            return { mod, wasmUrl: candidate.wasmUrl };
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
    const { mod, wasmUrl } = await loadModule(modulePathInfo);
    await mod.default({ module_or_path: wasmUrl });
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

function playersFromBattleReplayStates(states) {
    return (states ?? [])
        .filter((state) => state.owner_id == null)
        .map((state) => ({
            ...state,
            id: Number(state.id),
            team_index: Number(state.team_index ?? state.input_team_index ?? 0),
            id_name: state.id_name ?? state.base_name ?? `entity_${state.id}`,
            icon_key: state.icon_key ?? state.id_name ?? `entity_${state.id}`,
            display_name: state.display_name ?? state.base_name ?? `#${state.id}`,
            icon_png_base64: state.icon_png_base64 ?? null,
        }));
}

/** 创建一个增量驱动的 WASM 会话。启动时不拉取任何帧。
 * `api` 是供适配器测试使用的可选依赖注入点。
 */
export async function createBattleStreamSource(rawInput, versionInfo, coreVersionInfo, modulePathInfo, options = {}) {
    const loadStart = performance.now();
    const api = options.api ?? await ensureApi(versionInfo, coreVersionInfo, modulePathInfo);
    options.metrics?.wasmLoaded(performance.now() - loadStart);
    const createStart = performance.now();
    if (typeof api.BattleSession !== "function") {
        throw new Error("当前 tswn_wasm 包未导出 BattleSession");
    }
    let session = new api.BattleSession(rawInput, {
        include_icons: false,
        ...(options.maxRounds == null ? {} : { max_rounds: options.maxRounds }),
        ...(options.evalRq == null ? {} : { eval_rq: options.evalRq }),
    });
    let terminalResult = null;
    let disposed = false;
    let failure = null;
    function release() {
        const owned = session;
        session = null;
        owned?.free();
    }
    function captureResult() {
        if (session?.is_done()) {
            terminalResult = session.result();
            if (terminalResult == null) throw new Error("BattleSession 终止但未返回 result");
            release();
        }
    }
    try {
        const initialStates = session.initial_states();
        captureResult();
        options.metrics?.sessionCreated(performance.now() - createStart);
        return {
            raw_input: rawInput,
            seed_line: extractSpecifiedSeedLine(rawInput),
            players: playersFromBattleReplayStates(initialStates),
            initial_states: initialStates,
            async nextFrame() {
                if (failure) throw failure;
                if (disposed || terminalResult != null) return null;
                const pullStart = performance.now();
                try {
                    const frame = session.next_frame();
                    captureResult();
                    if (frame == null && terminalResult == null) {
                        throw new Error("BattleSession 返回空 frame 但尚未终止");
                    }
                    return frame ?? null;
                } catch (error) {
                    failure = error;
                    release();
                    throw error;
                } finally {
                    options.metrics?.framePulled(performance.now() - pullStart);
                }
            },
            result() { return terminalResult; },
            isDone() { return terminalResult != null; },
            dispose() {
                if (disposed) return;
                disposed = true;
                release();
            },
            loadIcon(iconKey) { return api.name_to_png_base64(iconKey); },
        };
    } catch (error) {
        release();
        throw error;
    }
}

