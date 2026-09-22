import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const examplesDir = dirname(fileURLToPath(import.meta.url));

async function readExampleFile(name) {
  return readFile(join(examplesDir, name), "utf8");
}

test("show page starts a canonical streaming session", async () => {
  const [html, script] = await Promise.all([readExampleFile("index.html"), readExampleFile("show.js")]);
  assert.match(html, /使用 BattleSession 边计算边播放战斗。/);
  assert.match(html, /show\.js\?v=20260907a/);
  assert.match(script, /await createBattleStreamSource\(/);
  assert.match(script, /new BattleStreamController\(/);
  assert.doesNotMatch(script, /buildMainNormalizedReplay|battle_replay|FightSession/);
});

test("show page removes runtime choice from generated share links", async () => {
  const script = await readExampleFile("show.js");

  assert.match(script, /buildShowShareUrl\(rawInput, \{\s*href: window\.location\.href,\s*\}\)/s);
  assert.doesNotMatch(script, /runtimeEngine/);
});

test("detail panel keeps readable colors in light theme", async () => {
  const css = await readExampleFile("show.css");

  assert.match(css, /\.detail-card\s*\{[^}]*background: var\(--surface-soft\);[^}]*color: var\(--ink\);[^}]*\}/s);
  assert.match(css, /\.detail-subtitle\s*\{[^}]*color: var\(--muted\);[^}]*\}/s);
  assert.match(css, /\.detail-grid dt\s*\{[^}]*color: var\(--muted\);[^}]*\}/s);
  assert.match(css, /\.detail-grid dd\s*\{[^}]*color: var\(--ink\);[^}]*\}/s);
  assert.doesNotMatch(css, /\.detail-subtitle\s*\{[^}]*color: rgba\(255, 255, 255, 0\.9\);[^}]*\}/s);
  assert.doesNotMatch(css, /\.detail-grid dd\s*\{[^}]*color: white;[^}]*\}/s);
});
