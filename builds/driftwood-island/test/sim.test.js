import { test } from "node:test";
import assert from "node:assert/strict";
import { RULES, DAY, makeState, step, runTo, island, LANDING, light } from "../src/sim.js";
import { around, SOIL, SAND } from "../src/island.js";
import { label } from "../src/clock.js";

const grassOnly = RULES.filter((r) => r.id === "grass");
const grazersOnly = RULES.filter((r) => r.id === "grazers");
const firstLight = (() => { let t = 0; while (light(t) === 0) t++; return t; })();

test("the island starts bare, and the first seed lands on the south beach at first light on day 0", () => {
  const s = runTo(firstLight - 1);
  assert.ok(s.grass.every((g) => g === 0));
  step(s);
  assert.ok(s.grass[LANDING] > 0);
  assert.equal(s.grass.filter((g) => g > 0).length, 1);
  assert.equal(label(s.history.at(-1).tick), "Day 0, 6:10 am");
});

test("grass grows only on soil, and stays between 0 and 1", () => {
  const s = runTo(10 * DAY);
  for (let i = 0; i < s.grass.length; i++) {
    assert.ok(s.grass[i] >= 0 && s.grass[i] <= 1);
    if (island.tile[i] !== SOIL) assert.equal(s.grass[i], 0);
  }
});

test("grass doesn't grow at night", () => {
  const s = runTo(DAY + 6, grassOnly); // 1 am on day 1
  const before = Float32Array.from(s.grass);
  step(s, grassOnly);
  assert.deepEqual(s.grass, before);
});

test("grass spreads only from a grassy tile to the bare soil right next to it", () => {
  const s = runTo(DAY + 60, grassOnly);
  const before = Float32Array.from(s.grass);
  step(s, grassOnly);
  let spread = 0;
  for (let i = 0; i < s.grass.length; i++) {
    if (before[i] === 0 && s.grass[i] > 0) {
      spread++;
      assert.ok(around(i).some((j) => before[j] > 0.3), `tile ${i} sprouted with no grassy neighbour`);
    }
  }
  assert.ok(spread > 0, "nothing spread in a daylight tick");
});

test("no grazers before day 2, 8 am; then exactly two wash ashore", () => {
  const since = RULES.find((r) => r.id === "grazers").since;
  assert.equal(label(since), "Day 2, 8:00 am");
  const s = runTo(since - 1);
  assert.equal(s.grazers.length, 0);
  step(s);
  assert.equal(s.grazers.length, 2);
  assert.match(s.history.at(-1).text, /Two grazers drifted ashore/);
});

test("grazers only ever stand on sand or soil", () => {
  const s = runTo(2 * DAY + 48);
  for (let t = 0; t < 6 * DAY; t++) {
    step(s);
    for (const z of s.grazers) assert.ok(island.tile[z.at] === SOIL || island.tile[z.at] === SAND, `grazer ${z.id} in the sea or on rock`);
  }
});

test("grazers sleep at night: nobody moves or eats between two night ticks", () => {
  const s = runTo(6 * DAY + 12); // 2 am on day 6
  assert.ok(s.grazers.length > 0);
  const where = s.grazers.map((z) => z.at), grass = Float32Array.from(s.grass);
  step(s);
  assert.deepEqual(s.grazers.map((z) => z.at), where.slice(0, s.grazers.length));
  assert.deepEqual(s.grass, grass);
});

test("a grazer on lush grass eats it: the grass goes down and the grazer gets stronger", () => {
  const s = makeState();
  s.tick = 3 * DAY + 71; // noon is next
  s.marks = { arrived: true, lastLanding: 0, seed: true };
  s.grass[LANDING] = 0.9;
  s.grazers = [{ id: 1, at: LANDING, energy: 1, age: 0, born: 0 }];
  step(s, grazersOnly);
  assert.ok(s.grass[LANDING] < 0.9);
  assert.ok(s.grazers[0].energy > 1);
});

test("with nothing to eat, grazers starve, the island says so, and ten days later two more try", () => {
  const s = makeState();
  s.tick = 3 * DAY;
  s.marks = { arrived: true, lastLanding: 3 * DAY, seed: true };
  s.grazers = [{ id: 1, at: LANDING, energy: 1, age: 0, born: 0 }, { id: 2, at: LANDING, energy: 1, age: 0, born: 0 }];
  s.nextId = 3;
  runTo(9 * DAY, grazersOnly, s);
  assert.equal(s.grazers.length, 0);
  assert.ok(s.history.some((e) => /The last grazer died/.test(e.text)));
  runTo(14 * DAY, grazersOnly, s);
  assert.ok(s.history.some((e) => /Two more grazers drifted ashore/.test(e.text)));
});

test("well-fed grazers have young, and the herd grows", () => {
  const s = runTo(12 * DAY);
  assert.ok(s.grazers.length > 20, `${s.grazers.length} grazers on day 12`);
  assert.ok(s.grazers.some((z) => z.born > 2 * DAY + 48), "nobody was born on the island");
});

test("the history is in order and every line has a time on the island", () => {
  const s = runTo(20 * DAY);
  for (let k = 1; k < s.history.length; k++) assert.ok(s.history[k].tick >= s.history[k - 1].tick);
  assert.equal(s.history[0].tick, 0);
  assert.match(s.history[0].text, /island rose from the sea/);
});
