import test from "node:test";
import assert from "node:assert/strict";
import { BattleDisplay } from "./show-display.js";
import { createReplayPlan, appendFrameToReplayPlan } from "./show-replay.js";

function freeze(value) {
    if (value && typeof value === "object") {
        for (const item of Object.values(value)) freeze(item);
        Object.freeze(value);
    }
    return value;
}
const root = freeze({ id: 1, id_name: "原名", display_name: "原名", icon_key: "root", hp: 100, max_hp: 100 });
const summon = freeze({ ...root, id: 2, owner_id: 1, minion_kind: "summon", display_name: "召唤物", icon_key: "summon" });
function frame(states = [root], index = 0) {
    return freeze({ frame_index: index, states, rows: [{ clips: [{ delay: 0, sidebar_states: states,
        parts: states.map(state => ({ kind: "player", player_id: state.id, text: state.display_name })) }] }] });
}

test("nicknames decorate old and future frames without changing canonical data", () => {
    let nickname = "";
    const display = new BattleDisplay([root], () => "png", () => nickname);
    const canonical = frame();
    const before = JSON.stringify(canonical);
    const html = data => {
        const plan = createReplayPlan([]);
        appendFrameToReplayPlan(plan, data, [], new Map());
        return plan.flatChunks.map(chunk => chunk.html).join("");
    };
    assert.match(html(display.frame(canonical)), /原名/);
    nickname = "新昵称";
    assert.match(html(display.frame(canonical)), /新昵称/);
    assert.match(html(display.frame(frame())), /新昵称/);
    assert.equal(JSON.stringify(canonical), before);
    assert.equal(root.display_name, "原名");
    nickname = "";
    assert.match(html(display.frame(canonical)), /原名/);
});

test("icons are generated lazily once per key and dynamic entities keep their identity", () => {
    const calls = [];
    const display = new BattleDisplay([root], key => { calls.push(key); return `${key}-png`; }, () => "昵称");
    assert.deepEqual(calls, []);
    display.states([root, { ...root, id: 3 }]);
    assert.deepEqual(calls, ["root"]);
    const decorated = display.frame(frame([root, summon]));
    assert.deepEqual(calls, ["root", "summon"]);
    assert.equal(decorated.states[1].display_name, "召唤物");
    assert.notEqual(decorated.states[0].icon_class_id, decorated.states[1].icon_class_id);
    display.frame(frame([root, summon], 1));
    assert.equal(calls.length, 2);
    assert.equal(display.state({ ...root, id: 4, owner_id: 1, minion_kind: "clone" }).display_name, "昵称");
    const other = new BattleDisplay([summon], key => `other-${key}`);
    other.state(summon);
    assert.deepEqual(display.iconEntries().map(entry => entry.icon_png_base64), ["root-png", "summon-png"]);
    assert.equal(other.iconEntries()[0].icon_png_base64, "other-summon");
});
