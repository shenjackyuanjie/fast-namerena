import test from "node:test";
import assert from "node:assert/strict";

import { buildFrameRows } from "./show-render.js";
import { buildMainReplayFromNormalizedRun } from "./show-wasm.js";

test("buildMainReplayFromNormalizedRun returns show-compatible replay shape", () => {
  const rawInput = "seed: fixed\nleft@red\n\nright@blue\n";
  const replay = buildMainReplayFromNormalizedRun(rawInput, {
    winner_team: 0,
    guard_exhausted: false,
    total_score: 7,
    rounds: [
      {
        winner_team: null,
        round: 1,
        total_score: 3,
        rng_i: 1,
        rng_j: 2,
        entity_ids: [0, 1],
        teams: [0, 1],
        hp: [100, 70],
        magic_point: [10, 20],
        defense: [1, 2],
        resistance: [3, 4],
        alive: [true, true],
        round_order: [0, 1],
        flat_alive: [0, 1],
        team_alive: [[0], [1]],
        alive_group_count: 2,
        actions: [{ round: 1, actor: 0, target: 1, amount: 20 }],
        frames: [
          {
            message: "[0]攻击[1]造成[2]点伤害",
            caster: 0,
            target: 1,
            targets: [1],
            param: 20,
            score: 3,
            delay0: 120,
            delay1: 80,
            update_type: "none",
          },
          {
            message: "[0]攻击[1]造成[2]点伤害",
            caster: 0,
            target: 1,
            targets: [1],
            param: 10,
            score: 1,
            delay0: 40,
            delay1: 20,
            update_type: "none",
          },
          {
            message: "[1][回避]了攻击",
            caster: 1,
            target: 0,
            targets: [0],
            score: 0,
            delay0: 10,
            delay1: 15,
            update_type: "next_line",
          },
        ],
      },
      {
        winner_team: 0,
        round: 2,
        total_score: 7,
        rng_i: 3,
        rng_j: 4,
        entity_ids: [0, 1],
        teams: [0, 1],
        hp: [100, 0],
        magic_point: [10, 20],
        defense: [1, 2],
        resistance: [3, 4],
        alive: [true, false],
        round_order: [0],
        flat_alive: [0],
        team_alive: [[0], []],
        alive_group_count: 1,
        actions: [{ round: 2, actor: 0, target: 1, amount: 80 }],
        frames: [
          {
            message: "[0]击败[1]",
            caster: 0,
            target: 1,
            targets: [1],
            score: 4,
            delay0: 30,
            delay1: 40,
            update_type: "win",
          },
        ],
      },
    ],
  }, 12.5);

  assert.equal(replay.runtime, true);
  assert.equal(replay.seed_line, "seed: fixed");
  assert.equal(replay.winner_team, 0);
  assert.deepEqual(replay.winner_ids, [0]);
  assert.equal(replay.total_score, 7);
  assert.equal(replay.wasm_duration_ms, 12.5);

  assert.deepEqual(replay.players.map((player) => player.display_name), ["left@red", "right@blue"]);
  assert.deepEqual(replay.players.map((player) => player.team_index), [0, 1]);
  assert.deepEqual(replay.initial_states.map((state) => state.hp), [100, 100]);
  assert.deepEqual(replay.final_states.map((state) => state.alive), [true, false]);

  assert.equal(replay.frames.length, 2);
  assert.equal(replay.frames[0].total_delay, 285);
  assert.equal(replay.frames[0].rows.length, 2);
  assert.equal(replay.frames[0].updates[0].message_rendered, "left@red攻击right@blue造成20点伤害");
  assert.equal(replay.frames[0].updates[0].tone, "damage");
  const damageClip = replay.frames[0].rows[0].clips[0];
  const damagedTargetPart = damageClip.parts.find((part) => part.kind === "player" && part.player_id === 1);
  assert.equal(damageClip.show_hp, true);
  assert.equal(damageClip.hp_before, 100);
  assert.equal(damageClip.hp_after, 80);
  assert.equal(damagedTargetPart.show_hp, true);
  assert.equal(damagedTargetPart.hp_before, 100);
  assert.equal(damagedTargetPart.hp_after, 80);
  assert.equal(damageClip.parts[4].kind, "data");
  const secondDamageClip = replay.frames[0].rows[0].clips[1];
  const secondDamagedTargetPart = secondDamageClip.parts.find((part) => part.kind === "player" && part.player_id === 1);
  assert.equal(secondDamageClip.show_hp, true);
  assert.equal(secondDamageClip.hp_before, 80);
  assert.equal(secondDamageClip.hp_after, 70);
  assert.equal(secondDamagedTargetPart.hp_before, 80);
  assert.equal(secondDamagedTargetPart.hp_after, 70);
  assert.equal(replay.frames[1].finished, true);
  assert.equal(replay.frames[1].updates[0].tone, "knockout");
  const knockoutClip = replay.frames[1].rows[0].clips[0];
  const defeatedTargetPart = knockoutClip.parts.find((part) => part.kind === "player" && part.player_id === 1);
  assert.equal(knockoutClip.show_hp, true);
  assert.equal(knockoutClip.hp_before, 70);
  assert.equal(knockoutClip.hp_after, 0);
  assert.equal(knockoutClip.death_effect, true);
  assert.equal(defeatedTargetPart.show_hp, true);
  assert.equal(defeatedTargetPart.hp_before, 70);
  assert.equal(defeatedTargetPart.hp_after, 0);
  assert.equal(defeatedTargetPart.death_effect, true);
  const winnerClip = replay.frames[1].rows.at(-1).clips[0];
  assert.equal(winnerClip.winner, true);
  assert.equal(winnerClip.text_template, "胜者：<data>");
  assert.equal(winnerClip.parts.map((part) => part.text).join(""), "胜者：left@red");
  assert.equal(winnerClip.delay, 1000);
  assert.equal(replay.frames[1].total_delay, 1070);
  assert.deepEqual(replay.frames[1].winner_ids, [0]);
});

test("runtime normalized replay renders show-compatible frame chunks", () => {
  const replay = buildMainReplayFromNormalizedRun("left@red\n\nright@blue\n", {
    winner_team: 0,
    guard_exhausted: false,
    total_score: 7,
    rounds: [
      {
        winner_team: null,
        round: 1,
        total_score: 3,
        rng_i: 1,
        rng_j: 2,
        entity_ids: [0, 1],
        teams: [0, 1],
        hp: [100, 70],
        magic_point: [10, 20],
        defense: [1, 2],
        resistance: [3, 4],
        alive: [true, true],
        round_order: [0, 1],
        flat_alive: [0, 1],
        team_alive: [[0], [1]],
        alive_group_count: 2,
        actions: [],
        frames: [
          {
            message: "[0]攻击[1]造成[2]点伤害",
            caster: 0,
            target: 1,
            targets: [1],
            param: 20,
            score: 3,
            delay0: 120,
            delay1: 80,
            update_type: "none",
          },
        ],
      },
      {
        winner_team: 0,
        round: 2,
        total_score: 7,
        rng_i: 3,
        rng_j: 4,
        entity_ids: [0, 1],
        teams: [0, 1],
        hp: [100, 0],
        magic_point: [10, 20],
        defense: [1, 2],
        resistance: [3, 4],
        alive: [true, false],
        round_order: [0],
        flat_alive: [0],
        team_alive: [[0], []],
        alive_group_count: 1,
        actions: [],
        frames: [
          {
            message: "[0]击败[1]",
            caster: 0,
            target: 1,
            targets: [1],
            score: 4,
            delay0: 30,
            delay1: 40,
            update_type: "win",
          },
        ],
      },
    ],
  });

  const playersById = new Map(replay.players.map((player) => [player.id, player]));
  const damageChunks = buildFrameRows(replay.frames[0], 0, replay.initial_states, playersById);
  const winnerChunks = buildFrameRows(replay.frames[1], 1, replay.frames[0].states, playersById);

  assert.equal(damageChunks.length, 1);
  assert.equal(damageChunks[0].target, "battleRows");
  assert.equal(damageChunks[0].delay, 200);
  assert.match(damageChunks[0].html, /round-block/);
  assert.match(damageChunks[0].html, /actor-token has-hp/);
  assert.match(damageChunks[0].html, /actor-hp-delta is-damage/);
  assert.match(damageChunks[0].html, /message-number">20<\/span>/);
  assert.match(damageChunks[0].html, /left@red/);
  assert.match(damageChunks[0].html, /right@blue/);

  assert.equal(winnerChunks.length, 2);
  assert.equal(winnerChunks[0].target, "battleRows");
  assert.match(winnerChunks[0].html, /namedie/);
  assert.match(winnerChunks[0].html, /actor-hp-delta is-damage/);
  assert.equal(winnerChunks[1].target, "frameBody");
  assert.equal(winnerChunks[1].delay, 1000);
  assert.match(winnerChunks[1].html, /winner-line/);
  assert.match(winnerChunks[1].html, /winner-row/);
  assert.match(winnerChunks[1].html, /胜者：left@red/);
});

test("runtime normalized replay preserves recover and multi-target HP chunks", () => {
  const replay = buildMainReplayFromNormalizedRun("healer@red\nfront@blue\nback@blue\n", {
    winner_team: null,
    guard_exhausted: false,
    total_score: 6,
    rounds: [
      {
        winner_team: null,
        round: 1,
        total_score: 6,
        rng_i: 5,
        rng_j: 6,
        entity_ids: [0, 1, 2],
        teams: [0, 1, 1],
        hp: [100, 75, 70],
        magic_point: [30, 10, 10],
        defense: [1, 2, 3],
        resistance: [4, 5, 6],
        alive: [true, true, true],
        round_order: [0, 1, 2],
        flat_alive: [0, 1, 2],
        team_alive: [[0], [1, 2]],
        alive_group_count: 2,
        actions: [{ round: 1, actor: 0, target: 1, amount: 30 }],
        frames: [
          {
            message: "[0]攻击[1]造成[2]点伤害",
            caster: 0,
            target: 1,
            targets: [1, 2],
            param: 30,
            score: 4,
            delay0: 50,
            delay1: 25,
            update_type: "none",
          },
          {
            message: "[0]治疗[1]恢复[2]点血",
            caster: 0,
            target: 1,
            targets: [1],
            param: 5,
            score: 2,
            delay0: 40,
            delay1: 20,
            update_type: "next_line",
          },
        ],
      },
    ],
  });

  assert.deepEqual(replay.initial_states.map((state) => state.hp), [100, 100, 100]);
  assert.deepEqual(replay.frames[0].states.map((state) => state.hp), [100, 75, 70]);
  assert.equal(replay.frames[0].rows.length, 2);

  const damageClip = replay.frames[0].rows[0].clips[0];
  assert.equal(damageClip.tone, "damage");
  assert.deepEqual(damageClip.target_ids, [1, 2]);
  assert.deepEqual(damageClip.sidebar_states.map((state) => state.hp), [100, 70, 70]);
  assert.deepEqual(damageClip.sidebar_previous_states.map((state) => state.hp), [100, 100, 100]);
  assert.equal(damageClip.show_hp, true);
  assert.equal(damageClip.hp_before, 100);
  assert.equal(damageClip.hp_after, 70);

  const recoverClip = replay.frames[0].rows[1].clips[0];
  assert.equal(recoverClip.tone, "recover");
  assert.deepEqual(recoverClip.target_ids, [1]);
  assert.equal(recoverClip.delay, 60);
  assert.equal(recoverClip.show_hp, true);
  assert.equal(recoverClip.hp_before, 70);
  assert.equal(recoverClip.hp_after, 75);
  assert.deepEqual(recoverClip.sidebar_previous_states.map((state) => state.hp), [100, 70, 70]);
  assert.deepEqual(recoverClip.sidebar_states.map((state) => state.hp), [100, 75, 70]);

  const playersById = new Map(replay.players.map((player) => [player.id, player]));
  const chunks = buildFrameRows(replay.frames[0], 0, replay.initial_states, playersById);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].target, "battleRows");
  assert.equal(chunks[0].delay, 75);
  assert.deepEqual([...chunks[0].sidebarInvolved.targets], [1, 2]);
  assert.match(chunks[0].html, /actor-hp-delta is-damage/);
  assert.match(chunks[0].html, /message-number">30<\/span>/);
  assert.equal(chunks[1].target, "frameBody");
  assert.equal(chunks[1].delay, 60);
  assert.deepEqual([...chunks[1].sidebarInvolved.targets], [1]);
  assert.match(chunks[1].html, /actor-hp-delta is-recover/);
  assert.match(chunks[1].html, /message-number">5<\/span>/);
});

test("runtime normalized replay renders new summoned entities only after spawn frame", () => {
  const replay = buildMainReplayFromNormalizedRun("summoner@red\n\ntarget@blue\n", {
    winner_team: null,
    guard_exhausted: false,
    total_score: 2,
    rounds: [
      {
        winner_team: null,
        round: 1,
        total_score: 1,
        rng_i: 7,
        rng_j: 8,
        entity_ids: [0, 1],
        teams: [0, 1],
        hp: [100, 100],
        magic_point: [10, 10],
        defense: [1, 2],
        resistance: [3, 4],
        alive: [true, true],
        round_order: [0, 1],
        flat_alive: [0, 1],
        team_alive: [[0], [1]],
        alive_group_count: 2,
        actions: [],
        frames: [
          {
            message: "[0]准备召唤",
            caster: 0,
            target: 0,
            targets: [],
            score: 1,
            delay0: 10,
            delay1: 10,
            update_type: "none",
          },
        ],
      },
      {
        winner_team: null,
        round: 2,
        total_score: 2,
        rng_i: 9,
        rng_j: 10,
        entity_ids: [0, 1, 2],
        teams: [0, 1, 0],
        hp: [100, 100, 80],
        magic_point: [10, 10, 0],
        defense: [1, 2, 0],
        resistance: [3, 4, 0],
        alive: [true, true, true],
        round_order: [0, 1, 2],
        flat_alive: [0, 1, 2],
        team_alive: [[0, 2], [1]],
        alive_group_count: 2,
        actions: [],
        frames: [
          {
            message: "[0]召唤出[1]",
            caster: 0,
            target: 2,
            targets: [2],
            score: 1,
            delay0: 30,
            delay1: 20,
            update_type: "none",
          },
        ],
      },
    ],
  });

  assert.deepEqual(replay.players.map((player) => player.display_name), ["summoner@red", "target@blue"]);
  assert.deepEqual(replay.frames[0].states.map((state) => state.id), [0, 1]);
  assert.deepEqual(replay.frames[1].states.map((state) => state.id), [0, 1, 2]);

  const spawnClip = replay.frames[1].rows[0].clips[0];
  assert.equal(spawnClip.tone, "normal");
  assert.deepEqual(spawnClip.sidebar_previous_states.map((state) => state.id), [0, 1]);
  assert.deepEqual(spawnClip.sidebar_states.map((state) => state.id), [0, 1, 2]);
  assert.deepEqual(spawnClip.target_ids, [2]);
  assert.equal(spawnClip.show_hp, true);
  assert.equal(spawnClip.hp_before, 0);
  assert.equal(spawnClip.hp_after, 80);

  const summonedPart = spawnClip.parts.find((part) => part.kind === "player" && part.player_id === 2);
  assert.equal(summonedPart.show_hp, true);
  assert.equal(summonedPart.hp_before, 0);
  assert.equal(summonedPart.hp_after, 80);

  const playersById = new Map(replay.players.map((player) => [player.id, player]));
  const chunks = buildFrameRows(replay.frames[1], 1, replay.frames[0].states, playersById);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].target, "battleRows");
  assert.deepEqual([...chunks[0].sidebarInvolved.targets], [2]);
  assert.match(chunks[0].html, /召唤出/);
  assert.match(chunks[0].html, /#2/);
  assert.match(chunks[0].html, /actor-token has-hp/);
  assert.match(chunks[0].html, /actor-hp-delta is-recover/);
});

test("runtime normalized replay renders removed entities with death HP state", () => {
  const replay = buildMainReplayFromNormalizedRun("owner@red\n\ntarget@blue\n", {
    winner_team: null,
    guard_exhausted: false,
    total_score: 1,
    rounds: [
      {
        winner_team: null,
        round: 1,
        total_score: 0,
        rng_i: 11,
        rng_j: 12,
        entity_ids: [0, 1, 2],
        teams: [0, 1, 0],
        hp: [100, 100, 80],
        magic_point: [10, 10, 0],
        defense: [1, 2, 0],
        resistance: [3, 4, 0],
        alive: [true, true, true],
        round_order: [0, 1, 2],
        flat_alive: [0, 1, 2],
        team_alive: [[0, 2], [1]],
        alive_group_count: 2,
        actions: [],
        frames: [],
      },
      {
        winner_team: null,
        round: 2,
        total_score: 1,
        rng_i: 13,
        rng_j: 14,
        entity_ids: [0, 1, 2],
        teams: [0, 1, 0],
        hp: [100, 100, 0],
        magic_point: [10, 10, 0],
        defense: [1, 2, 0],
        resistance: [3, 4, 0],
        alive: [true, true, false],
        round_order: [0, 1],
        flat_alive: [0, 1],
        team_alive: [[0], [1]],
        alive_group_count: 2,
        actions: [],
        frames: [
          {
            message: "[1]消失了",
            caster: 0,
            target: 2,
            targets: [2],
            score: 1,
            delay0: 25,
            delay1: 15,
            update_type: "none",
          },
        ],
      },
    ],
  });

  assert.deepEqual(replay.frames[0].states.map((state) => state.id), [0, 1, 2]);
  assert.deepEqual(replay.frames[1].states.map((state) => state.alive), [true, true, false]);
  assert.deepEqual(replay.frames[1].states.map((state) => state.hp), [100, 100, 0]);

  const removeClip = replay.frames[1].rows[0].clips[0];
  assert.equal(removeClip.tone, "knockout");
  assert.deepEqual(removeClip.target_ids, [2]);
  assert.equal(removeClip.show_hp, true);
  assert.equal(removeClip.hp_before, 80);
  assert.equal(removeClip.hp_after, 0);
  assert.equal(removeClip.death_effect, true);
  assert.deepEqual(removeClip.sidebar_previous_states.map((state) => state.alive), [true, true, true]);
  assert.deepEqual(removeClip.sidebar_states.map((state) => state.alive), [true, true, false]);

  const removedPart = removeClip.parts.find((part) => part.kind === "player" && part.player_id === 2);
  assert.equal(removedPart.show_hp, true);
  assert.equal(removedPart.hp_before, 80);
  assert.equal(removedPart.hp_after, 0);
  assert.equal(removedPart.death_effect, true);

  const playersById = new Map(replay.players.map((player) => [player.id, player]));
  const chunks = buildFrameRows(replay.frames[1], 1, replay.frames[0].states, playersById);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].target, "battleRows");
  assert.deepEqual([...chunks[0].sidebarInvolved.targets], [2]);
  assert.match(chunks[0].html, /消失了/);
  assert.match(chunks[0].html, /#2/);
  assert.match(chunks[0].html, /namedie/);
  assert.match(chunks[0].html, /actor-hp-delta is-damage/);
});
