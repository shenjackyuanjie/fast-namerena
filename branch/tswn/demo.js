const DEFAULT_RAW = `
云剑狄卡敢
白胡子

史莱姆
田一人
`.trim();

const rawInput = document.querySelector("#rawInput");
const versionInfo = document.querySelector("#versionInfo");
const coreVersionInfo = document.querySelector("#coreVersionInfo");
const modulePathInfo = document.querySelector("#modulePathInfo");
const statusText = document.querySelector("#statusText");
const summaryBox = document.querySelector("#summaryBox");
const playersGrid = document.querySelector("#playersGrid");
const stateTable = document.querySelector("#stateTable");
const battleLog = document.querySelector("#battleLog");
const roundCountInput = document.querySelector("#roundCountInput");
const winRateProgress = document.querySelector("#winRateProgress");
const winRatePercent = document.querySelector("#winRatePercent");
const winRateText = document.querySelector("#winRateText");
const modeTabs = document.querySelectorAll("[data-mode-tab]");
const modePanels = document.querySelectorAll("[data-mode-panel]");

const summaryButton = document.querySelector("#summaryButton");
const prepareButton = document.querySelector("#prepareButton");
const stepButton = document.querySelector("#stepButton");
const runToEndButton = document.querySelector("#runToEndButton");
const resetLogButton = document.querySelector("#resetLogButton");
const winRateButton = document.querySelector("#winRateButton");

rawInput.value = DEFAULT_RAW;

const MODE_TO_HASH = Object.freeze({
    fight: "#fight",
    winRate: "#win-rate",
});

let fightSession = null;
let frameIndex = 0;
let currentMode = "fight";

function setStatus(message, isError = false) {
    statusText.textContent = message;
    statusText.style.color = isError ? "#9f2f1f" : "#bf5b2c";
}

function formatError(error) {
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

function escapeHtml(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function iconSrc(iconPngBase64) {
    if (!iconPngBase64) {
        return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
    }
    return iconPngBase64.startsWith("data:")
        ? iconPngBase64
        : `data:image/png;base64,${iconPngBase64}`;
}

function renderPlayers(players) {
    playersGrid.innerHTML = players
        .map((player) => {
            const icon = `<img alt="${escapeHtml(player.display_name)}" src="${iconSrc(player.icon_png_base64)}">`;
            return `
                <article class="player-card">
                    ${icon}
                    <div>
                        <strong>${escapeHtml(player.display_name)}</strong>
                        <span>id: ${escapeHtml(player.id_name)}</span>
                        <span>team: ${player.team_index}</span>
                        <span>playerId: ${player.id}</span>
                    </div>
                </article>
            `;
        })
        .join("");
}

function renderStates(states) {
    stateTable.innerHTML = `
        <thead>
            <tr>
                <th>玩家</th>
                <th>HP</th>
                <th>MP</th>
                <th>ATK</th>
                <th>DEF</th>
                <th>SPD</th>
                <th>状态</th>
            </tr>
        </thead>
        <tbody>
            ${states
                .map(
                    (state) => `
                        <tr>
                            <td>${state.id}</td>
                            <td>${state.hp}/${state.max_hp}</td>
                            <td>${state.magic_point}</td>
                            <td>${state.attack}</td>
                            <td>${state.defense}</td>
                            <td>${state.speed}</td>
                            <td>${state.alive ? (state.frozen ? "冻结" : "存活") : "死亡"}</td>
                        </tr>
                    `,
                )
                .join("")}
        </tbody>
    `;
}

function appendFrame(frame) {
    const lines = [`# frame ${frameIndex}`];
    for (const update of frame.updates) {
        if (update.updateType === "next_line") {
            lines.push("");
            continue;
        }
        lines.push(`- ${update.messageRendered}`);
    }
    if (frame.finished) {
        lines.push(`winnerIds=${JSON.stringify(frame.winner_ids)}`);
    }
    battleLog.textContent += `${battleLog.textContent.trim() ? "\n\n" : ""}${lines.join("\n")}`;
    battleLog.scrollTop = battleLog.scrollHeight;
    frameIndex += 1;
}

function resetFightLog() {
    frameIndex = 0;
    battleLog.textContent = "";
}

function setFightControls(enabled) {
    stepButton.disabled = !enabled;
    runToEndButton.disabled = !enabled;
    resetLogButton.disabled = !enabled;
}

function normalizeMode(mode) {
    return mode === "winRate" ? "winRate" : "fight";
}

function modeFromHash(hash) {
    return hash === MODE_TO_HASH.winRate ? "winRate" : "fight";
}

function setMode(mode, options = {}) {
    const { updateHash = true } = options;
    currentMode = normalizeMode(mode);

    for (const button of modeTabs) {
        const active = button.dataset.modeTab === currentMode;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
        button.tabIndex = active ? 0 : -1;
    }

    for (const panel of modePanels) {
        panel.hidden = panel.dataset.modePanel !== currentMode;
    }

    if (updateHash) {
        const hash = MODE_TO_HASH[currentMode];
        if (window.location.hash !== hash) {
            window.history.replaceState(null, "", hash);
        }
    }
}

async function nextFrame() {
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function loadModule() {
    const candidates = [
        { label: "../pkg/tswn_wasm.js", path: "../pkg/tswn_wasm.js" },
        { label: "../dist/wasm/pkg/tswn_wasm.js", path: "../dist/wasm/pkg/tswn_wasm.js" },
    ];

    let lastError = null;
    for (const candidate of candidates) {
        try {
            const mod = await import(candidate.path);
            modulePathInfo.textContent = `module: ${candidate.label}`;
            return mod;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError;
}

async function main() {
    try {
        const mod = await loadModule();
        await mod.default();

        const {
            version,
            core_version,
            fight_summary,
            FightSession,
            WinRateSession,
        } = mod;

        versionInfo.textContent = `wrapper: ${version()}`;
        coreVersionInfo.textContent = `core: ${core_version()}`;
        setStatus("tswn_wasm 已初始化。");

        summaryButton.addEventListener("click", () => {
            try {
                setMode("fight");
                const summary = fight_summary(rawInput.value, { include_icons: true });
                renderPlayers(summary.players);
                renderStates(summary.final_states);
                summaryBox.textContent = `fight_summary 完成: finished=${summary.finished}, winnerIds=${JSON.stringify(summary.winner_ids)}`;
                setStatus("fight_summary 已刷新。");
            } catch (error) {
                setStatus(formatError(error), true);
            }
        });

        prepareButton.addEventListener("click", () => {
            try {
                setMode("fight");
                fightSession = new FightSession(rawInput.value, { include_icons: true, capture_replay: true });
                renderPlayers(fightSession.players());
                renderStates(fightSession.state());
                summaryBox.textContent = "FightSession 已创建，可以逐帧推进。";
                resetFightLog();
                setFightControls(true);
                setStatus("FightSession 已创建。");
            } catch (error) {
                fightSession = null;
                setFightControls(false);
                setStatus(formatError(error), true);
            }
        });

        stepButton.addEventListener("click", () => {
            try {
                if (!fightSession) {
                    throw new Error("请先创建 FightSession");
                }
                const frame = fightSession.step();
                appendFrame(frame);
                renderStates(frame.states);
                summaryBox.textContent = `当前回合完成状态: finished=${frame.finished}, winnerIds=${JSON.stringify(frame.winner_ids)}`;
                if (frame.finished) {
                    setStatus("FightSession 已结束。");
                } else {
                    setStatus(`FightSession 已推进到 frame ${frameIndex}.`);
                }
            } catch (error) {
                setStatus(formatError(error), true);
            }
        });

        runToEndButton.addEventListener("click", () => {
            try {
                if (!fightSession) {
                    throw new Error("请先创建 FightSession");
                }
                const replay = fightSession.run_to_end();
                for (const frame of replay.frames) {
                    appendFrame(frame);
                }
                renderStates(replay.final_states);
                summaryBox.textContent = `Run To End 完成: winnerIds=${JSON.stringify(replay.winner_ids)}, frames=${replay.frames.length}`;
                setStatus("FightSession 已直接跑到结束。");
            } catch (error) {
                setStatus(formatError(error), true);
            }
        });

        resetLogButton.addEventListener("click", () => {
            resetFightLog();
            setStatus("战斗日志已清空。");
        });

        winRateButton.addEventListener("click", async () => {
            const totalRounds = Number.parseInt(roundCountInput.value, 10);
            if (!Number.isFinite(totalRounds) || totalRounds <= 0) {
                setStatus("胜率局数必须是正整数。", true);
                return;
            }

            try {
                setMode("winRate");
                winRateButton.disabled = true;
                const session = new WinRateSession(rawInput.value, totalRounds, { thread: 1 });
                setStatus("WinRateSession 已启动。");

                while (!session.is_finished()) {
                    const progress = session.step(250);
                    const ratio = progress.total_rounds === 0 ? 0 : (progress.rounds_done / progress.total_rounds) * 100;
                    winRateProgress.value = ratio;
                    winRatePercent.textContent = `${ratio.toFixed(2)}%`;
                    winRateText.textContent = `wins=${progress.wins}, rounds=${progress.rounds_done}/${progress.total_rounds}, percent=${progress.percent.toFixed(3)}%`;
                    await nextFrame();
                }

                const result = session.result();
                winRateProgress.value = 100;
                winRatePercent.textContent = `${result.percent.toFixed(3)}%`;
                winRateText.textContent = `完成: wins=${result.wins}, rounds=${result.rounds_done}/${result.total_rounds}, init=${result.timing?.init_nanos ?? 0}ns, fight=${result.timing?.fight_nanos ?? 0}ns`;
                setStatus("WinRateSession 已完成。");
            } catch (error) {
                setStatus(formatError(error), true);
            } finally {
                winRateButton.disabled = false;
            }
        });
    } catch (error) {
        setStatus(`模块加载失败: ${formatError(error)}`, true);
    }
}

for (const button of modeTabs) {
    button.addEventListener("click", () => {
        setMode(button.dataset.modeTab);
    });
}

window.addEventListener("hashchange", () => {
    setMode(modeFromHash(window.location.hash), { updateHash: false });
});

setMode(modeFromHash(window.location.hash));

void main();