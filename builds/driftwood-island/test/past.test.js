// The island's past must never change. These fingerprints were taken when shift 1 was built (November 2, 2026).
// If a new rule or a fix changes one of them, it rewrote history: give the new rule a later start instead.
import { test } from "node:test";
import assert from "node:assert/strict";
import { RULES, DAY, makeState, runTo, fingerprint, cloneState, step } from "../src/sim.js";

// Noon on days 3 and 5, and 5:50 am on day 7 (the last moment before evolution, which starts at 6:00 am on day 7).
// Noon on day 7 was pinned too, but it was still in the future when evolution was added (at 2 am on day 7), so
// that pin moved to the last moment that had already happened.
const PINNED = { [3 * DAY + 72]: "cd73c9b3", [5 * DAY + 72]: "0faf6f54", [7 * DAY + 35]: "484ad2c8" };

test("the island's past is pinned: days 3, 5 and 7 (up to evolution) look exactly as they did when shift 1 was built", () => {
  const s = makeState();
  for (const [tick, print] of Object.entries(PINNED)) {
    runTo(Number(tick), RULES, s);
    assert.equal(fingerprint(s), print, `tick ${tick} changed`);
  }
});

test("a rule added later changes nothing before its start, and does change things after", () => {
  const since = 9 * DAY;
  const blight = { id: "blight", since };
  // A made-up drastic rule: from its start, all grass dies. Plugged in the way a real new rule would be.
  const rules = [...RULES, blight];
  const plain = runTo(since - 1);
  const withIt = runTo(since - 1, rules, makeState(), { blight: (s) => s.grass.fill(0) });
  assert.equal(fingerprint(withIt), fingerprint(plain));
  runTo(since, rules, withIt, { blight: (s) => s.grass.fill(0) });
  runTo(since, RULES, plain);
  assert.notEqual(fingerprint(withIt), fingerprint(plain));
});

test("rules are listed in the order they start, and none starts before the island", () => {
  for (let k = 0; k < RULES.length; k++) {
    assert.ok(RULES[k].since >= 0);
    if (k) assert.ok(RULES[k].since >= RULES[k - 1].since);
  }
});

test("the fingerprint notices a single grazer taking a single step", () => {
  const s = runTo(4 * DAY + 72), t = cloneState(s);
  assert.equal(fingerprint(t), fingerprint(s));
  t.grazers[0].at += 1;
  assert.notEqual(fingerprint(t), fingerprint(s));
});

test("copying the world and moving the copy on leaves the original alone", () => {
  const s = runTo(4 * DAY + 72), before = fingerprint(s), t = cloneState(s);
  step(t);
  assert.equal(fingerprint(s), before);
  assert.notEqual(fingerprint(t), before);
});
