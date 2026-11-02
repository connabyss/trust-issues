import test from "node:test";
import assert from "node:assert/strict";
import { drawSky, starSize } from "../src/render.js";

// A pretend canvas that writes down what it was asked to draw.
function fakeCtx() {
  const calls = [];
  const ctx = new Proxy({ calls }, {
    get: (t, k) => (k in t ? t[k] : (...a) => calls.push([k, ...a])),
    set: (t, k, v) => ((t[k] = v), true),
  });
  return ctx;
}

const sky = {
  stars: [{ x: 0, y: 0, mag: 0 }, { x: 0.5, y: 0, mag: 4 }],
  lines: [[{ x: 0, y: 0 }, { x: 0.5, y: 0 }]],
  named: [{ name: "Vega", x: 0, y: 0 }],
  moon: null,
};

test("every star, line and name ends up on the canvas, inside the circle", () => {
  const ctx = fakeCtx();
  drawSky(ctx, sky, 800);
  const arcs = ctx.calls.filter((c) => c[0] === "arc");
  assert.equal(arcs.length, 2 /* night + rim */ + 2 /* stars */);
  assert.deepEqual(ctx.calls.find((c) => c[0] === "fillText").slice(1, 2), ["Vega"]);
  assert.equal(ctx.calls.filter((c) => c[0] === "lineTo").length, 1);
  const [, x, y] = arcs[1]; // the star at the middle of the sky sits at the middle of the canvas
  assert.deepEqual([x, y], [400, 400]);
});

test("brighter stars are drawn bigger", () => {
  assert.ok(starSize(0, 1) > starSize(4, 1));
  assert.ok(starSize(6, 1) > 0);
});

test("the moon is drawn when it is up", () => {
  const ctx = fakeCtx();
  drawSky(ctx, { ...sky, moon: { x: 0.2, y: 0.2, lit: 0.5, waxing: true } }, 800);
  assert.equal(ctx.calls.filter((c) => c[0] === "ellipse").length, 1);
});

// Which way the edge of the lit part curves: past the middle line (gibbous, full) or short of it (crescent).
const curve = (lit, waxing) => {
  const ctx = fakeCtx();
  drawSky(ctx, { ...sky, moon: { x: 0, y: 0, lit, waxing } }, 800);
  return ctx.calls.find((c) => c[0] === "ellipse")[8]; // anticlockwise?
};

test("a full moon is lit all the way across, a thin crescent only at the edge", () => {
  // waxing: lit on the right. Going clockwise from the bottom passes the left side, so the light reaches past the middle.
  assert.equal(curve(1, true), false, "full waxing moon must bulge to the left");
  assert.equal(curve(0.1, true), true, "thin waxing crescent must stay on the right");
  assert.equal(curve(1, false), true, "full waning moon must bulge to the right");
  assert.equal(curve(0.1, false), false, "thin waning crescent must stay on the left");
});
