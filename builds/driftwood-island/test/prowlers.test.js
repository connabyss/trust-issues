// Prowlers (shift 3): the hunt, camouflage, running away, and both sides still alive weeks later.
import { test } from "node:test";
import assert from "node:assert/strict";
import { RULES, DAY, runTo, step, cloneState, fingerprint } from "../src/sim.js";
import { camouflage, sightRange, catchChance, prowlerAwake, coatLight, GROUND_LIGHT } from "../src/prowl.js";

const START = RULES.find((r) => r.id === "prowlers").since;

test("prowlers start at 6:00 pm on day 9, after the last pinned moment, and nothing before has any", () => {
  assert.equal(START, 9 * DAY + 108);
  const s = runTo(START - 1);
  assert.equal(s.prowlers.length, 0);
  const without = runTo(START - 1, RULES.filter((r) => r.id !== "prowlers"));
  assert.equal(fingerprint(without), fingerprint(s));
  step(s);
  assert.equal(s.prowlers.length, 2);
  assert.match(s.history.at(-1).text, /prowlers swam ashore/);
});

test("camouflage: a coat like the ground hides, and in the dark a dark coat hides", () => {
  const sandCoat = 0.19; // lightness 0.8, like sand
  assert.ok(camouflage(sandCoat, GROUND_LIGHT.sand, false) > 0.95);
  assert.ok(camouflage(sandCoat, GROUND_LIGHT.grass, false) < 0.4);
  assert.ok(camouflage(1, GROUND_LIGHT.sand, true) > 0.8); // a black coat at night, even on sand
  assert.ok(camouflage(0, GROUND_LIGHT.grass, true) < 0.1); // a white coat stands out at night on grass
  assert.ok(coatLight(0) > coatLight(1));
});

test("sight: prowlers see further by day, night eyes help in the dark, and hiding shortens it", () => {
  assert.equal(sightRange(0, false, 0.5), 7);
  assert.ok(sightRange(0, true, 0.9) > sightRange(0, true, 0.1));
  assert.ok(sightRange(0.9, false, 0.5) < 2.5);
});

test("catching: big fast prowlers do better, long legs get away, and a crowd spreads the risk", () => {
  const p = { size: 0.5, legs: 0.5 }, z = { size: 0.5, legs: 0.3 };
  assert.ok(catchChance({ size: 0.9, legs: 0.9 }, z, 0) > catchChance(p, z, 0));
  assert.ok(catchChance(p, { size: 0.5, legs: 0.9 }, 0) < catchChance(p, z, 0));
  assert.ok(catchChance(p, z, 6) < catchChance(p, z, 0) / 1.8);
  assert.ok(prowlerAwake({ night: 0.9 }, -30) && !prowlerAwake({ night: 0.9 }, 30));
  assert.ok(prowlerAwake({ night: 0.5 }, -30) && prowlerAwake({ night: 0.5 }, 30));
});

test("grazers run: when a prowler is near, some grazer flees, ending further from it than it started", () => {
  const s = runTo(START + 24);
  let seen = 0;
  for (let k = 0; k < 144 && !seen; k++) {
    const before = cloneState(s);
    step(s);
    for (const z of s.grazers) {
      if (!z.fleeing) continue;
      const was = before.grazers.find((o) => o.id === z.id);
      const d = (a, b) => Math.max(Math.abs((a % 72) - (b % 72)), Math.abs(Math.floor(a / 72) - Math.floor(b / 72)));
      const near = Math.min(...before.prowlers.map((p) => d(p.at, was.at)));
      const after = Math.min(...before.prowlers.map((p) => d(p.at, z.at)));
      if (after >= near) seen++;
    }
  }
  assert.ok(seen > 0, "no grazer ran from a prowler for a whole day");
});

test("the hunt runs in cycles: prowlers boom, grazers crash, and both are still alive on day 21 and day 30", () => {
  const s = runTo(15 * DAY);
  const g15 = s.grazers.length;
  runTo(21 * DAY, RULES, s);
  assert.ok(s.grazers.length > 0 && s.prowlers.length > 0, "both alive on day 21");
  assert.ok(s.grazers.length < g15 / 4, `grazers should crash (from ${g15} to ${s.grazers.length})`);
  assert.ok(s.history.some((e) => /first grazer/.test(e.text)));
  runTo(27 * DAY, RULES, s);
  assert.ok(s.grazers.length > 200, "and recover once the prowlers starve");
  runTo(30 * DAY, RULES, s);
  assert.ok(s.grazers.length > 0 && s.prowlers.length > 0, "both alive on day 30");
});
