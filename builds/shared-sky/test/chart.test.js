import test from "node:test";
import assert from "node:assert/strict";
import { drawShared, horizon, midpoint, view } from "../src/chart.js";
import { separation } from "../src/shared.js";

test("the middle of the view is the middle of the chart, and the reach is the rim", () => {
  const place = view({ ra: 100, dec: 20 }, 120);
  const mid = place(100, 20);
  assert.ok(Math.abs(mid.x) < 1e-9 && Math.abs(mid.y) < 1e-9);
  const rim = place(100, 20 - 119.999);
  assert.ok(Math.abs(Math.hypot(rim.x, rim.y) - 1) < 1e-4);
  assert.equal(place(100 + 180, -20), null); // straight behind: off the chart
});

test("north is up and east is on the left, like looking up", () => {
  const place = view({ ra: 0, dec: 0 }, 90);
  assert.ok(place(0, 10).y < 0); // north: up
  assert.ok(place(10, 0).x < 0); // east (more right ascension): left
});

test("the edge of a sky is 90 degrees from overhead all the way round", () => {
  const z = { ra: 45, dec: 40 };
  for (const h of horizon(z, 36)) assert.ok(Math.abs(separation(z, h) - 90) < 1e-6);
});

test("halfway between two spots is the same distance from both", () => {
  const a = { ra: 10, dec: 40 }, b = { ra: 200, dec: -30 };
  const m = midpoint(a, b);
  assert.ok(Math.abs(separation(a, m) - separation(b, m)) < 1e-6);
});

test("stars are painted in the colour of who saw them", () => {
  const fills = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : () => { if (k === "fill") fills.push(t.fillStyle); }),
    set: (t, k, v) => ((t[k] = v), true),
  });
  const z = { ra: 0, dec: 0 };
  const cmp = { apart: 0, stars: [{ ra: 0, dec: 0, mag: 1, who: "both" }, { ra: 5, dec: 0, mag: 2, who: "a" }, { ra: 0, dec: 5, mag: 2, who: "" }] };
  drawShared(ctx, cmp, z, z, 800, { a: "A", b: "B", both: "GOLD", none: "DIM", night: "NIGHT" });
  assert.deepEqual(fills, ["NIGHT", "GOLD", "A", "DIM"]);
});
