import test from "node:test";
import assert from "node:assert/strict";
import { moon } from "../src/moon.js";

// Real moon phases from January 2024 (UTC).
test("full moon on 25 January 2024, 17:54", () => {
  assert.ok(moon(new Date(Date.UTC(2024, 0, 25, 17, 54))).lit > 0.99);
});

test("new moon on 11 January 2024, 11:57", () => {
  assert.ok(moon(new Date(Date.UTC(2024, 0, 11, 11, 57))).lit < 0.01);
});

test("first quarter on 18 January 2024, 03:53: half lit and growing", () => {
  const m = moon(new Date(Date.UTC(2024, 0, 18, 3, 53)));
  assert.ok(Math.abs(m.lit - 0.5) < 0.03, `lit ${m.lit}`);
  assert.equal(m.waxing, true);
});

test("the moon never strays far from the sun's path", () => {
  for (let day = 0; day < 60; day++) {
    const m = moon(new Date(Date.UTC(2026, 0, 1 + day)));
    assert.ok(Math.abs(m.dec) < 29.5 && m.ra >= 0 && m.ra < 360, `day ${day}: dec ${m.dec}`);
  }
});
