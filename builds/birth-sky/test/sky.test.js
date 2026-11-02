import test from "node:test";
import assert from "node:assert/strict";
import { skyAt } from "../src/sky.js";
import { localToDate } from "../src/when.js";

const nyc = (y, m, d, h) => skyAt(localToDate(y, m, d, h, 0, "America/New_York"), 40.71, -74.01);

test("Sirius is up at midnight on New Year's in New York, but not at midnight in July", () => {
  assert.ok(nyc(2026, 1, 1, 0).named.some((s) => s.name === "Sirius"));
  assert.ok(!nyc(2026, 7, 1, 0).named.some((s) => s.name === "Sirius"));
});

test("Vega is nearly straight overhead on a summer night in New York", () => {
  const vega = nyc(2026, 8, 15, 22).named.find((s) => s.name === "Vega");
  assert.ok(vega && Math.hypot(vega.x, vega.y) < 0.2, JSON.stringify(vega));
});

test("about half the stars are up at any moment, all inside the circle", () => {
  const s = nyc(2026, 11, 2, 21);
  assert.ok(s.stars.length > 500 && s.stars.length < 1100, `${s.stars.length}`);
  assert.ok(s.stars.every((p) => Math.hypot(p.x, p.y) <= 1 + 1e-9));
  assert.ok(s.lines.length > 100);
});

test("the full moon of 25 January 2024 was up over New York that evening, fully lit", () => {
  const s = nyc(2024, 1, 25, 22);
  assert.ok(s.moon && s.moon.lit > 0.98, JSON.stringify(s.moon));
});

test("at noon on that day the full moon was below the horizon", () => {
  assert.equal(nyc(2024, 1, 25, 12).moon, null);
});
