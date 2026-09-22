import test from "node:test";
import assert from "node:assert/strict";

import { actorToken, buildFrameRows } from "./show-render.js";
import { createBattleStreamSource } from "./show-wasm.js";
import { actorHpMetrics } from "./show-utils.js";

function streamApi({ failAt = -1, initialFailure = false } = {}) {
  const calls = { pulls: 0, frees: 0, eager: 0, options: null };
  const initial = [{ id: 0, hp: 100, team_index: 0, display_name: "alpha", owner_id: null }];
  const frames = [{ frame_index: 0, states: initial, rows: [] }, { frame_index: 1, states: initial, rows: [] }];
  const result = { status: "finished", stop_reason: "winner", frames_emitted: 2 };
  return { calls, initial, frames, result, api: {
    BattleSession: class {
      constructor(raw, options) { calls.options = options; calls.raw = raw; }
      initial_states() { if (initialFailure) throw new Error("initial failed"); return initial; }
      next_frame() {
        if (calls.pulls === failAt) throw new Error("runtime failed");
        return frames[calls.pulls++] ?? null;
      }
      is_done() { return calls.pulls >= frames.length; }
      result() { return result; }
      free() { calls.frees += 1; }
    },
    battle_replay() { calls.eager += 1; throw new Error("must not eagerly run battle"); },
    name_to_png_base64(key) { return `icon:${key}`; },
  } };
}

test("stream source creates BattleSession and returns initial without pulling", async () => {
  const fake = streamApi();
  const source = await createBattleStreamSource("seed:42@!\nalpha", null, null, null, { api: fake.api, maxRounds: 8 });
  assert.equal(fake.calls.pulls, 0);
  assert.equal(fake.calls.eager, 0);
  assert.deepEqual(fake.calls.options, { include_icons: false, max_rounds: 8 });
  assert.equal(source.initial_states, fake.initial);
  assert.equal(source.players[0].hp, 100);
  assert.equal(source.seed_line, "seed:42@!");
  assert.equal(source.result(), null);
  assert.equal(source.loadIcon("alpha"), "icon:alpha");
  assert.equal(await source.nextFrame(), fake.frames[0]);
  assert.equal(await source.nextFrame(), fake.frames[1]);
  assert.equal(source.result(), fake.result);
  assert.equal(source.isDone(), true);
  assert.equal(fake.calls.frees, 1);
  assert.equal(await source.nextFrame(), null);
  source.dispose();
  source.dispose();
  assert.equal(fake.calls.frees, 1);
});

test("stream source frees an aborted session exactly once", async () => {
  const fake = streamApi();
  const source = await createBattleStreamSource("alpha", null, null, null, { api: fake.api });
  source.dispose();
  assert.equal(await source.nextFrame(), null);
  assert.equal(source.result(), null);
  assert.equal(fake.calls.pulls, 0);
  assert.equal(fake.calls.frees, 1);
});

test("stream errors propagate and release WASM without inventing a result", async () => {
  const fake = streamApi({ failAt: 1 });
  const source = await createBattleStreamSource("alpha", null, null, null, { api: fake.api });
  await source.nextFrame();
  await assert.rejects(source.nextFrame(), /runtime failed/);
  await assert.rejects(source.nextFrame(), /runtime failed/);
  assert.equal(source.result(), null);
  assert.equal(fake.calls.frees, 1);
  source.dispose();
  assert.equal(fake.calls.frees, 1);
});

test("stream constructor failure after allocation releases the handle", async () => {
  const fake = streamApi({ initialFailure: true });
  await assert.rejects(createBattleStreamSource("alpha", null, null, null, { api: fake.api }), /initial failed/);
  assert.equal(fake.calls.frees, 1);
});

test("revive HP bars render only the blue recovery segment", () => {
  const metrics = actorHpMetrics(
    { max_hp: 100, hp: 40, alive: true },
    { max_hp: 100, hp: 0, alive: false },
  );

  assert.equal(metrics.fillWidth, 0);
  assert.equal(metrics.previousWidth, 0);
  assert.equal(metrics.deltaLeft, 0);
  assert.equal(metrics.deltaWidth, 10);
  assert.equal(metrics.deltaKind, "recover");
});

test("explicitly disabled death effect keeps a normal actor name", () => {
  const html = actorToken(
    { id: 2, display_name: "zombie", icon_class_id: 2 },
    { max_hp: 100, hp: 0, alive: false },
    { max_hp: 100, hp: 0, alive: false },
    { tone: "normal" },
    { showHp: false, deathEffect: false },
  );

  assert.doesNotMatch(html, /namedie/);
  assert.match(html, /actor-name/);
});

test("stream players retain all sidebar detail fields", async () => {
  const fake = streamApi();
  Object.assign(fake.initial[0], { attack: 55, defense: 41, speed: 184 });
  const source = await createBattleStreamSource("alpha", null, null, null, { api: fake.api });
  assert.equal(source.players[0].attack, 55);
  assert.equal(source.players[0].defense, 41);
  assert.equal(source.players[0].speed, 184);
  source.dispose();
});

test("canonical clips preserve multi-target recovery, death, delay and dynamic entities", () => {
  const states = [
    { id: 1, display_name: "healer", hp: 80, max_hp: 100 },
    { id: 2, display_name: "target", hp: 0, max_hp: 100 },
    { id: 3, display_name: "summon", icon_class_id: 9, minion_kind: "summon", owner_id: 1, hp: 60, max_hp: 60 },
  ];
  const frame = { states, updates: [{ message_template: "MUST NOT INFER", hp_delta: 999 }], rows: [{
    indent: false, clips: [{ delay: 120, tone: "normal", color: "000000", sidebar_states: states,
      parts: [
        { kind: "player", player_id: 1, text: "healer", show_hp: true, hp_before: 40, hp_after: 80, death_effect: false },
        { kind: "player", player_id: 2, text: "target", show_hp: true, hp_before: 30, hp_after: 0, death_effect: true },
        { kind: "player", player_id: 3, text: "summon", show_hp: false, death_effect: false },
      ],
    }, { delay: 70, parts: [] }],
  }] };
  const players = new Map();
  const chunks = buildFrameRows(frame, 0, [], players);
  const html = chunks.map(chunk => chunk.html).join("");
  assert.match(html, /is-recover/);
  assert.match(html, /is-damage/);
  assert.match(html, /namedie/);
  assert.match(html, /summon/);
  assert.match(html, /icon_9/);
  assert.doesNotMatch(html, /MUST NOT INFER|999/);
  assert.equal(chunks.reduce((sum, chunk) => sum + chunk.delay, 0), 190);
  assert.equal(players.get(3).minion_kind, "summon");
  assert.deepEqual(buildFrameRows({ states, updates: frame.updates }, 0, [], new Map()), []);
});
