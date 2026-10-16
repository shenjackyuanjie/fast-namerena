/** 句子级播放、跳转和检查点；通过访问器读取同一份页面会话状态。 */
import { formatError, sleep } from "./show-utils.js";
import { renderPlayers } from "./show-render.js";
import { createReplayPlan, appendFrameToReplayPlan, markReplayPlanComplete, renderReplayIntro, updateSpeedButtons, playbackDelay, buildReplayResultTableHtml } from "./show-replay.js";

const SEEK_CHECKPOINT_FRAME_INTERVAL = 20;
const NORMAL_RESULT_REVEAL_DELAY_MS = 1500;
const TURBO_YIELD_VISIBLE_CHUNKS = 24;

export function createShowPlayback(state, { playerList, battleRows, endPanel, headerMeta, plistMeta, normalBtn, fastBtn, pauseBtn, shareBtn, stepControls, stepBackEventBtn, stepForwardEventBtn, stepBackFrameBtn, stepForwardFrameBtn, rememberPlayers, clearPlayerHighlight, closePanel, visibleStatesForCursor }) {
  function stopPlaybackLoop() {
    state.playbackLoopToken += 1;
  }

  function prepareReplayPlan(replay) {
    const display = state.battleDisplay.battle(replay);
    const plan = createReplayPlan(display.initial_states);
    const workingPlayersById = new Map(display.players.map((player) => [player.id, player]));
    let previousStates = display.initial_states;
    for (const frame of replay.frames) {
      const displayFrame = state.battleDisplay.frame(frame);
      appendFrameToReplayPlan(plan, displayFrame, previousStates, workingPlayersById);
      previousStates = displayFrame.states;
    }
    if (replay.source_done) markReplayPlanComplete(plan, replay.result);
    return plan;
  }

  function currentFrameIndexFromCursor() {
    if (!state.currentPlan || state.currentPlan.frames.length === 0) {
      return 0;
    }
    const framePlan = state.currentPlan.frames.find((item) => state.playbackCursor < item.end);
    return framePlan
      ? framePlan.frameIndex
      : state.currentPlan.frames[state.currentPlan.frames.length - 1].frameIndex;
  }

  function syncPlaybackUi() {
    updateSpeedButtons(
      normalBtn,
      fastBtn,
      pauseBtn,
      state.playbackPaused,
      state.speedMode,
      state.currentBattle,
      headerMeta,
    );

    pauseBtn.disabled = !state.currentBattle;
    shareBtn.disabled = !state.currentBattle;
    pauseBtn.classList.toggle("is-paused", state.playbackPaused);

    stepControls.hidden = false;

    const noReplay = !state.currentBattle;
    stepBackEventBtn.disabled = noReplay || state.playbackCursor <= 0;
    stepBackFrameBtn.disabled = noReplay || state.playbackCursor <= 0;
    stepForwardEventBtn.disabled =
      noReplay || !state.currentPlan || (state.currentBattle.source_done && state.playbackCursor >= state.currentPlan.totalChunks);
    stepForwardFrameBtn.disabled =
      noReplay || !state.currentPlan || (state.currentBattle.source_done && state.playbackCursor >= state.currentPlan.totalChunks);

    if (state.currentBattle) {
      const teamCount = new Set(state.currentBattle.players.map(player => player.team_index)).size;
      plistMeta.textContent = `${state.currentBattle.players.length} 名角色 · ${teamCount} 支队伍 · 已接收 ${state.currentBattle.frames.length} 帧。`;
    }
    if (state.streamError) {
      headerMeta.textContent = `战斗读取失败：${formatError(state.streamError)}`;
    } else if (state.currentBattle) {
      if (state.playbackFinished) {
        headerMeta.textContent = `回放已结束，共 ${state.currentBattle.frames.length} 帧。`;
      } else if (state.playbackPaused) {
        headerMeta.textContent = `已暂停，可单步前后移动。当前位置：frame ${currentFrameIndexFromCursor()} / ${Math.max(0, state.currentBattle.frames.length - 1)}。`;
      }
    }
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
    state.battleMetrics?.chunkRendered(performance.now() - renderStart);
  }

  function renderSidebarSnapshot(states, previousStates, involved) {
    state.currentVisibleStates = state.battleDisplay.states(states);
    renderPlayers(
      state.battleDisplay.states(state.currentBattle.players),
      state.currentVisibleStates,
      state.battleDisplay.states(previousStates),
      involved,
      playerList,
      state.playersById,
    );
  }

  function renderChunkSidebar(chunk) {
    if (!state.currentBattle || !Array.isArray(chunk.sidebarStates)) {
      return;
    }
    renderSidebarSnapshot(
      chunk.sidebarStates,
      chunk.sidebarPreviousStates ?? chunk.sidebarStates,
      chunk.sidebarInvolved ?? null,
    );
  }

  function lastSidebarChunkForFrame(framePlan) {
    if (!state.currentPlan) {
      return null;
    }
    for (let index = framePlan.end - 1; index >= framePlan.start; index -= 1) {
      const chunk = state.currentPlan.flatChunks[index];
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
    replay = state.battleDisplay.battle(replay);
    clearPlayerHighlight();
    closePanel(endPanel);
    state.currentVisibleStates = replay.initial_states;
    renderReplayIntro(
      replay,
      state.speedMode,
      playerList,
      battleRows,
      plistMeta,
      headerMeta,
      state.playersById,
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
      `<section class="battle-result-block">${buildReplayResultTableHtml(state.battleDisplay.battle(replay))}</section>`,
    );
    scrollBattleToBottom();
    reportBattleMetrics();
  }

  function reportBattleMetrics() {
    if (!state.metricsReported && state.battleMetrics && state.currentBattle?.source_done) {
      state.metricsReported = true;
      if (new URLSearchParams(window.location.search).get("perf") === "1") {
        console.table(state.battleMetrics.snapshot());
      }
    }
  }

  function findNearestPlaybackCheckpointCursor(cursor) {
    let bestCursor = 0;
    for (const checkpointCursor of state.playbackCheckpoints.keys()) {
      if (checkpointCursor <= cursor && checkpointCursor > bestCursor) {
        bestCursor = checkpointCursor;
      }
    }
    return bestCursor;
  }

  function restorePlaybackCheckpoint(cursor) {
    const checkpoint = state.playbackCheckpoints.get(cursor);
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
    if (!state.currentPlan) {
      return;
    }

    const clampedCursor = Math.max(0, Math.min(cursor, state.currentPlan.totalChunks));
    state.playbackCheckpoints.set(clampedCursor, {
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
    if (!state.currentPlan || targetCursor <= startCursor) {
      return;
    }

    for (const framePlan of state.currentPlan.frames) {
      if (targetCursor <= framePlan.start) {
        break;
      }
      if (startCursor >= framePlan.end) {
        continue;
      }

      const chunkStart = Math.max(startCursor, framePlan.start);
      const limit = Math.min(targetCursor, framePlan.end);
      for (let chunkIndex = chunkStart; chunkIndex < limit; chunkIndex += 1) {
        appendPlaybackChunk(state.currentPlan.flatChunks[chunkIndex]);
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
    if (!state.currentBattle || !state.currentPlan) {
      return;
    }

    const previousCursor = state.playbackCursor;
    const wasFinished = state.playbackFinished;
    const targetCursor = Math.max(0, Math.min(cursor, state.currentPlan.totalChunks));
    state.playbackCursor = targetCursor;
    state.playbackFinished = state.currentBattle.source_done && state.playbackCursor >= state.currentPlan.totalChunks;

    if (forceReset) {
      resetPlaybackView(state.currentBattle);
      appendChunksBetween(0, targetCursor);
    } else if (targetCursor === previousCursor && wasFinished === state.playbackFinished) {
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
          resetPlaybackView(state.currentBattle);
          appendChunksBetween(0, targetCursor);
        }
      }
    }

    if (state.playbackFinished) {
      renderSidebarSnapshot(state.currentBattle.final_states, state.currentBattle.final_states, null);
      appendReplayResultBlock(state.currentBattle);
      storePlaybackCheckpoint(state.playbackCursor);
    }

    if (state.playbackCursor === 0) {
      storePlaybackCheckpoint(0);
    }

    if (!state.playbackFinished) {
      state.currentVisibleStates = state.battleDisplay.states(visibleStatesForCursor(state.playbackCursor));
    }
    scrollBattleToBottom();
    syncPlaybackUi();
  }

  function resolveChunkDelay(frame, rawDelay) {
    if (state.speedMode === "turbo") {
      return 0;
    }
    if (state.speedMode === "fast") {
      const targetDelay = playbackDelay(frame, state.speedMode);
      return frame.total_delay > 0 ? Math.round((targetDelay * rawDelay) / frame.total_delay) : 0;
    }
    // normal 模式直接使用 core replay view 给出的句子级延迟。
    return rawDelay;
  }

  async function waitForPlaybackDelay(ms, token) {
    let remaining = ms;
    while (remaining > 0) {
      if (token !== state.playbackLoopToken || state.playbackPaused) {
        return false;
      }
      const slice = Math.min(remaining, 25);
      await sleep(slice);
      remaining -= slice;
    }
    return token === state.playbackLoopToken && !state.playbackPaused;
  }

  async function autoplayFromCurrentCursor() {
    if (!state.currentBattle || !state.currentPlan || (state.playbackFinished && battleRows.querySelector(".battle-result-block"))) {
      syncPlaybackUi();
      return;
    }

    const token = ++state.playbackLoopToken;
    let turboVisibleChunks = 0;
    state.playbackPaused = false;
    state.streamController?.setPaused(false);
    syncPlaybackUi();

    while (true) {
      if (token !== state.playbackLoopToken || state.playbackPaused) {
        return;
      }

      if (state.playbackCursor >= state.currentPlan.totalChunks) {
        if (state.currentBattle.source_done) break;
        if (state.streamError) { pausePlayback(); return; }
        try { await state.streamController.ensureFrame(state.currentBattle.frames.length); }
        catch { return; }
        if (token !== state.playbackLoopToken || state.playbackPaused) return;
        continue;
      }
      const chunk = state.currentPlan.flatChunks[state.playbackCursor];
      const framePlan = state.currentPlan.frames[chunk.frameIndex];
      if (!state.streamError) state.streamController?.setPlaybackFrame(framePlan.frameIndex);
      if (state.playbackCursor >= state.historyResumeBoundary) {
        void state.streamController?.ensureBuffered().catch(() => {});
      }
      const delay =
        state.playbackCursor === 0 && state.speedMode === "normal"
          ? 0
          : resolveChunkDelay(framePlan.frame, chunk.delay);
      if (delay > 0) {
        const completed = await waitForPlaybackDelay(delay, token);
        if (!completed) {
          return;
        }
      }

      appendPlaybackChunk(chunk);
      state.playbackCursor += 1;

      if (state.playbackCursor >= framePlan.end) {
        renderFrameSidebar(framePlan);
        maybeStoreFrameCheckpoint(framePlan);
      }

      if (state.speedMode === "turbo" && chunk.visible && ++turboVisibleChunks % TURBO_YIELD_VISIBLE_CHUNKS === 0) {
        await sleep(0);
        if (token !== state.playbackLoopToken || state.playbackPaused) {
          return;
        }
      }
    }

    if (token !== state.playbackLoopToken) {
      return;
    }

    state.playbackFinished = true;
    renderSidebarSnapshot(state.currentBattle.final_states, state.currentBattle.final_states, null);
    if (state.speedMode === "normal") {
      const completed = await waitForPlaybackDelay(NORMAL_RESULT_REVEAL_DELAY_MS, token);
      if (!completed) {
        return;
      }
    }
    appendReplayResultBlock(state.currentBattle);
    storePlaybackCheckpoint(state.playbackCursor);
    state.playbackPaused = true;
    state.streamController?.setPaused(true);
    // turbo 是一次性按钮：播完后自动回到暂停态。
    if (state.speedMode === "turbo") {
      state.playbackPaused = true;
      state.speedMode = "normal";
    }
    syncPlaybackUi();
  }

  function beginReplayPlayback(replay, { autoPlay = true } = {}) {
    state.currentBattle = replay;
    state.currentPlan = prepareReplayPlan(replay);
    state.playbackCheckpoints = new Map();
    state.playbackCursor = 0;
    state.historyResumeBoundary = state.currentPlan.totalChunks;
    state.playbackPaused = false;
    state.playbackFinished = false;
    state.playbackStartedAt = performance.now();
    stopPlaybackLoop();
    if (!state.streamError) state.streamController?.setPlaybackFrame(-1);
    renderPlaybackToCursor(0, { forceReset: true });
    if (autoPlay !== false) {
      void autoplayFromCurrentCursor();
    }
  }

  function nextVisibleCursor(cursor) {
    if (!state.currentPlan) {
      return cursor;
    }
    for (let index = cursor; index < state.currentPlan.totalChunks; index += 1) {
      if (state.currentPlan.flatChunks[index].visible) {
        return index + 1;
      }
    }
    return state.currentPlan.totalChunks;
  }

  function previousVisibleCursor(cursor) {
    if (!state.currentPlan) {
      return cursor;
    }
    for (let index = Math.min(cursor, state.currentPlan.totalChunks) - 1; index >= 0; index -= 1) {
      if (state.currentPlan.flatChunks[index].visible) {
        return index;
      }
    }
    return 0;
  }

  function nextFrameCursor(cursor) {
    if (!state.currentPlan) {
      return cursor;
    }
    for (const framePlan of state.currentPlan.frames) {
      if (cursor < framePlan.end) {
        return framePlan.end;
      }
    }
    return state.currentPlan.totalChunks;
  }

  function previousFrameCursor(cursor) {
    if (!state.currentPlan) {
      return cursor;
    }
    for (let index = state.currentPlan.frames.length - 1; index >= 0; index -= 1) {
      const framePlan = state.currentPlan.frames[index];
      if (cursor > framePlan.start) {
        return index > 0 ? state.currentPlan.frames[index - 1].end : 0;
      }
    }
    return 0;
  }

  function pausePlayback() {
    if (!state.currentBattle) {
      return;
    }
    state.playbackPaused = true;
    state.streamController?.setPaused(true);
    stopPlaybackLoop();
    syncPlaybackUi();
  }

  function resumePlayback() {
    if (!state.currentBattle) {
      return;
    }

    if (state.playbackFinished && battleRows.querySelector(".battle-result-block")) {
      syncPlaybackUi();
      return;
    }

    state.playbackPaused = false;
    syncPlaybackUi();
    void autoplayFromCurrentCursor();
  }

  function togglePausePlayback() {
    if (!state.currentBattle) {
      return;
    }
    if (state.playbackPaused) {
      resumePlayback();
    } else {
      pausePlayback();
    }
  }

  function stepPlaybackTo(cursor) {
    if (!state.currentBattle || !state.currentPlan) {
      return;
    }
    state.playbackPaused = true;
    state.streamController?.setPaused(true);
    stopPlaybackLoop();
    if (cursor < state.playbackCursor) state.historyResumeBoundary = state.currentPlan.totalChunks;
    renderPlaybackToCursor(cursor);
    const frameIndex = state.currentPlan.frames.findLastIndex(frame => state.playbackCursor > frame.start);
    if (!state.streamError) state.streamController?.setPlaybackFrame(frameIndex);
  }

  async function stepPlaybackForward(byFrame = false) {
    if (!state.currentBattle || !state.currentPlan) return;
    pausePlayback();
    const generation = state.battleGenerationToken;
    const token = state.playbackLoopToken;
    if (state.playbackCursor >= state.currentPlan.totalChunks && !state.currentBattle.source_done && !state.streamError) {
      try { await state.streamController.ensureFrame(state.currentBattle.frames.length); }
      catch { return; }
      if (generation !== state.battleGenerationToken || token !== state.playbackLoopToken) return;
    }
    stepPlaybackTo(byFrame ? nextFrameCursor(state.playbackCursor) : nextVisibleCursor(state.playbackCursor));
  }

  return {
    stopPlaybackLoop, prepareReplayPlan, syncPlaybackUi, renderPlaybackToCursor,
    autoplayFromCurrentCursor, beginReplayPlayback, previousVisibleCursor, previousFrameCursor,
    pausePlayback, resumePlayback, togglePausePlayback, stepPlaybackTo,
    stepPlaybackForward, nextVisibleCursor, nextFrameCursor,
  };
}
