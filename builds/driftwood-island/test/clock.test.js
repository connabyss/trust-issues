import { test } from "node:test";
import assert from "node:assert/strict";
import { EPOCH_MS, tickAt, msAt, islandTime, label, sunAltitude, TICKS_PER_DAY } from "../src/clock.js";

const est = (y, mo, d, h, mi = 0) => Date.UTC(y, mo - 1, d, h + 5, mi); // a clock time in UTC-5

test("tick 0 is midnight on October 26, 2026, island time, and a day is 144 ticks", () => {
  assert.equal(EPOCH_MS, est(2026, 10, 26, 0));
  assert.equal(tickAt(est(2026, 10, 26, 0, 9)), 0);
  assert.equal(tickAt(est(2026, 10, 26, 0, 10)), 1);
  assert.equal(tickAt(est(2026, 10, 27, 0)), TICKS_PER_DAY);
  assert.equal(msAt(tickAt(est(2026, 11, 2, 13, 40))), est(2026, 11, 2, 13, 40));
});

test("island time reads like a clock", () => {
  const t = tickAt(est(2026, 11, 2, 13, 40));
  assert.deepEqual(islandTime(t), { day: 7, hour: 13, minute: 40 });
  assert.equal(label(t), "Day 7, 1:40 pm");
  assert.equal(label(0), "Day 0, 12:00 am");
  assert.equal(label(tickAt(est(2026, 10, 28, 12))), "Day 2, 12:00 pm");
});

test("the real sun: high at noon, below the horizon at midnight", () => {
  assert.ok(sunAltitude(est(2026, 11, 2, 12)) > 45);
  assert.ok(sunAltitude(est(2026, 11, 2, 0)) < -45);
});

test("noon height matches the seasons: about 48 degrees at the December solstice, 85 in June", () => {
  // At 18.5 degrees north: 90 - 18.5 - 23.44 = 48.1 in December, 90 - 18.5 + 23.44 = 94.9, so 85.1 over the south side, in June.
  assert.ok(Math.abs(sunAltitude(est(2026, 12, 21, 12, 2)) - 48.1) < 1);
  assert.ok(Math.abs(sunAltitude(est(2027, 6, 21, 12, 2)) - 85.1) < 1);
});

test("in early November the sun rises a little after 6 am and sets a little before 6 pm", () => {
  assert.ok(sunAltitude(est(2026, 11, 2, 5, 30)) < 0);
  assert.ok(sunAltitude(est(2026, 11, 2, 7, 0)) > 0);
  assert.ok(sunAltitude(est(2026, 11, 2, 17, 0)) > 0);
  assert.ok(sunAltitude(est(2026, 11, 2, 18, 30)) < 0);
});
