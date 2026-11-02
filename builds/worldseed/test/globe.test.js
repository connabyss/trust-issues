import { test } from "node:test";
import assert from "node:assert/strict";
import { makeGrid } from "../src/planet.js";
import { makeView, pick, project, render, cellAt, SUN } from "../src/globe.js";

const grid = makeGrid(72, 36);
const flat = (v) => new Uint8ClampedArray(grid.n * 3).fill(v);

test("with no tilt, the middle of the picture is the place facing us", () => {
  const v = makeView(101, 0);
  for (const lon of [0, 90, -135]) {
    assert.equal(pick(v, grid, 50, 50, lon), cellAt(grid, 0, lon));
  }
});

test("tilting leans the north pole toward us: the middle shows that latitude", () => {
  const v = makeView(101, 30);
  assert.equal(pick(v, grid, 50, 50, 0), cellAt(grid, 30, 0));
});

test("a place shown on screen and a click on that spot agree, all round the visible side", () => {
  const v = makeView(400, 18);
  let checked = 0;
  for (let lat = -57.5; lat <= 60; lat += 15) { // patch centres, not their edges
    for (let lon = -167.5; lon <= 180; lon += 20) {
      const s = project(v, lat, lon, 40);
      if (!s || s.front < 0.2) continue; // skip the very edge, where a pixel covers many patches
      assert.equal(pick(v, grid, s.x, s.y, 40), cellAt(grid, lat, lon), `${lat},${lon}`);
      checked++;
    }
  }
  assert.ok(checked > 40);
});

test("places round the back of the planet aren't drawn, and clicks off the planet hit nothing", () => {
  const v = makeView(200, 0);
  assert.equal(project(v, 0, 180, 0), null);
  assert.ok(project(v, 0, 0, 0));
  assert.equal(pick(v, grid, 2, 2, 0), -1);
});

test("the sunny side is bright and the far side is dark", () => {
  const v = makeView(200, 0), out = new Uint8ClampedArray(200 * 200 * 4);
  render(v, grid, flat(200), null, 0, out);
  const at = (nx, ny) => { const px = Math.round(100 + nx * v.R * 0.9), py = Math.round(100 - ny * v.R * 0.9); return out[(py * 200 + px) * 4]; };
  const sunny = at(SUN[0], SUN[1]), dark = at(-SUN[0], -SUN[1]);
  assert.ok(sunny > 150, `sunny side ${sunny}`);
  assert.ok(dark < 40, `night side ${dark}`);
});

test("city lights glow on the night side only, never in daylight", () => {
  const v = makeView(200, 0), out = new Uint8ClampedArray(200 * 200 * 4);
  render(v, grid, flat(0), new Float32Array(grid.n).fill(1), 0, out);
  let nightLit = 0, dayLit = 0;
  for (let k = 0; k < 200 * 200; k++) {
    if (!v.inside[k]) continue;
    const r = out[k * 4] - v.glow[k] * 60;
    if (v.day[k] > 0.4 && r > 40) dayLit++;
    if (v.day[k] < 0.02 && r > 200) nightLit++;
  }
  assert.equal(dayLit, 0);
  assert.ok(nightLit > 1000, `${nightLit} night pixels lit`);
});

test("spinning slides the map: the patch in the middle moves east by the turn", () => {
  const v = makeView(101, 0);
  const a = pick(v, grid, 50, 50, 0), b = pick(v, grid, 50, 50, 90);
  assert.equal((b % grid.w) - (a % grid.w), grid.w / 4);
});
