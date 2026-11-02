// Evolution (shift 2): genes, inheritance, weather on the body, waking hours, and new kinds.
import { test } from "node:test";
import assert from "node:assert/strict";
import { RULES, DAY, runTo, fingerprint, makeState } from "../src/sim.js";
import { mutate, distance, awakeAt, weather, nameFor, coatColour, GENES } from "../src/genes.js";
import { makeRng } from "../src/rng.js";

const START = RULES.find((r) => r.id === "evolution").since;
const MIDNIGHT = (day) => day * DAY;

test("evolution starts at 6:00 am on day 7, and nothing before it carries genes", () => {
  assert.equal(START, 7 * DAY + 36);
  const s = runTo(START - 1);
  assert.ok(s.grazers.length > 0);
  assert.ok(s.grazers.every((z) => z.g === undefined));
  assert.equal(s.kinds.length, 0);
  // Taking evolution and dew out gives the very same island up to that moment.
  const without = runTo(START - 1, RULES.filter((r) => r.id !== "evolution" && r.id !== "dew"));
  assert.equal(fingerprint(without), fingerprint(s));
});

test("at the start every grazer gets genes and they're all one kind", () => {
  const s = runTo(START);
  assert.ok(s.grazers.every((z) => GENES.every((k) => z.g[k] >= 0 && z.g[k] <= 1)));
  assert.equal(s.kinds.length, 1);
  assert.ok(s.grazers.every((z) => z.kind === 1));
  assert.match(s.history.at(-1).text, /^Evolution began/);
});

test("young take after their parents: small changes, never outside 0 to 1, and the same dice give the same young", () => {
  const parent = { size: 0.5, legs: 0.02, coat: 0.98, night: 0.5 };
  const rng = makeRng(7);
  for (let k = 0; k < 500; k++) {
    const kid = mutate(parent, rng, 0.2);
    for (const g of GENES) {
      assert.ok(kid[g] >= 0 && kid[g] <= 1);
      assert.ok(Math.abs(kid[g] - parent[g]) <= 0.2 + 1e-9);
    }
  }
  assert.deepEqual(mutate(parent, makeRng(3)), mutate(parent, makeRng(3)));
  assert.notDeepEqual(mutate(parent, makeRng(3)), parent);
});

test("after the start young are born, and no two grazers share the exact same genes", () => {
  const s = runTo(START + 2 * DAY);
  const born = s.grazers.filter((z) => z.born > START);
  assert.ok(born.length > 20, "there should be young by now");
  // No two grazers are identical: the changes really happen.
  const prints = new Set(s.grazers.map((z) => GENES.map((k) => z.g[k].toFixed(6)).join()));
  assert.equal(prints.size, s.grazers.length);
});

test("weather: the sun is hardest on big dark coats, the night on small pale ones, and resting or moving halves it", () => {
  const big = { size: 0.9, legs: 0.3, coat: 0.9, night: 0.2 }, small = { size: 0.1, legs: 0.3, coat: 0.1, night: 0.2 };
  assert.ok(weather(big, true, 1, true) > 3 * weather(small, true, 1, true));
  assert.ok(weather(small, false, 0, false) > weather(big, false, 0, false));
  assert.equal(weather(big, false, 0, false), 0);
  assert.equal(weather(big, true, 1, false), weather(big, true, 1, true) / 2);
  assert.equal(weather(small, false, 0, true), weather(small, false, 0, false) / 2);
  assert.equal(weather(big, true, 0, true), 0); // dawn: no sun to speak of
});

test("waking hours: a higher night gene stays up later into the dark, and above 0.8 sleeps through the day", () => {
  const g = (night) => ({ size: 0.5, legs: 0.3, coat: 0.5, night });
  assert.ok(awakeAt(g(0.1), 40) && !awakeAt(g(0.1), -20));
  assert.ok(awakeAt(g(0.3), -20) && !awakeAt(g(0.3), -50));
  assert.ok(awakeAt(g(0.6), -60));
  assert.ok(awakeAt(g(0.7), 40) && !awakeAt(g(0.9), 40));
});

test("names say what stands out", () => {
  assert.equal(nameFor({ size: 0.9, legs: 0.7, coat: 1, night: 0.9 }), "great long-legged night black grazer");
  assert.equal(nameFor({ size: 0.5, legs: 0.3, coat: 0.5, night: 0.1 }), "dun grazer");
  assert.equal(nameFor({ size: 0.1, legs: 0.05, coat: 0, night: 0.6 }), "little stubby dusk white grazer");
  assert.deepEqual(coatColour(0), [248, 244, 232]);
  assert.deepEqual(coatColour(1), [44, 38, 36]);
});

// Evolution on its own, without the prowlers of shift 3 (they eat a lot of the night grazers this test counts).
const NO_HUNT = RULES.filter((r) => r.id !== "prowlers");

test("with nothing hunting, over two weeks the island picks: grazers awake at midnight spread, and new kinds split off and get names", () => {
  const s = makeState();
  runTo(MIDNIGHT(10), NO_HUNT, s);
  const owls0 = s.grazers.filter((z) => z.g.night > 0.5).length;
  runTo(MIDNIGHT(21), NO_HUNT, s);
  const owls = s.grazers.filter((z) => z.g.night > 0.5).length;
  assert.ok(owls > owls0 + 50, `night grazers should spread (from ${owls0} to ${owls})`);
  const named = s.kinds.filter((k) => k.named);
  assert.ok(named.length >= 4, `expected several kinds, got ${named.length}`);
  assert.equal(new Set(named.map((k) => k.name)).size, named.length, "two kinds share a name");
  const splits = s.history.filter((e) => /split off/.test(e.text));
  assert.equal(splits.length, named.length - 1);
  // A kind that's named is really different from where its parent kind began.
  for (const k of named.slice(1)) assert.ok(distance(k.g, s.kinds[k.parent - 1].g) > 0.45);
});

// Pinned the day evolution was added. Day 9 was still in the future then; once it has happened, this pin is its past.
test("evolution's own first days are pinned too", () => {
  assert.equal(fingerprint(runTo(9 * DAY + 72)), PIN9);
});
const PIN9 = "5aa24d0c";
