import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFrom, makeRng } from "../src/rng.js";
import { makeNoise } from "../src/noise.js";

test("the same word always gives the same seed and the same rolls", () => {
  assert.equal(seedFrom("Orbit"), seedFrom("Orbit"));
  assert.equal(seedFrom("  orbit "), seedFrom("Orbit"));
  const a = makeRng(seedFrom("pebble")), b = makeRng(seedFrom("pebble"));
  for (let i = 0; i < 50; i++) assert.equal(a(), b());
});

test("different words give different seeds and different rolls", () => {
  const words = ["a", "b", "mars", "Mars!", "orbit", "assata", "huey", "pebble", "ocean", "worldseed"];
  assert.equal(new Set(words.map(seedFrom)).size, words.length);
  assert.notEqual(makeRng(seedFrom("a"))(), makeRng(seedFrom("b"))());
});

test("rolls stay in [0, 1) and spread evenly", () => {
  const r = makeRng(42);
  const bins = new Array(10).fill(0);
  for (let i = 0; i < 20000; i++) {
    const x = r();
    assert.ok(x >= 0 && x < 1);
    bins[Math.floor(x * 10)]++;
  }
  for (const n of bins) assert.ok(n > 1700 && n < 2300, `uneven bin: ${n}`);
  for (let i = 0; i < 1000; i++) {
    const k = r.int(6);
    assert.ok(Number.isInteger(k) && k >= 0 && k < 6);
  }
});

test("noise is the same for the same seed, different for another", () => {
  const a = makeNoise(7), b = makeNoise(7), c = makeNoise(8);
  let differs = 0;
  for (let i = 0; i < 100; i++) {
    const x = i * 0.37, y = i * 0.11, z = i * 0.73;
    assert.equal(a.fbm(x, y, z), b.fbm(x, y, z));
    if (Math.abs(a.fbm(x, y, z) - c.fbm(x, y, z)) > 1e-6) differs++;
  }
  assert.ok(differs > 90);
});

test("noise is smooth: a tiny step makes a tiny change, but it does vary", () => {
  const n = makeNoise(99);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < 2000; i++) {
    const x = i * 0.0131, y = Math.sin(i) * 3, z = Math.cos(i * 0.7) * 3;
    const v = n.noise3(x, y, z);
    assert.ok(v >= -1.01 && v <= 1.01);
    assert.ok(Math.abs(n.noise3(x + 0.001, y, z) - v) < 0.01, "jumped on a tiny step");
    lo = Math.min(lo, v); hi = Math.max(hi, v);
  }
  assert.ok(hi - lo > 0.8, "noise barely varies");
});
