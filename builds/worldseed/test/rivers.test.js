import { test } from "node:test";
import assert from "node:assert/strict";
import { makePlanet } from "../src/planet.js";
import { makeClimate } from "../src/climate.js";
import { makeRivers, pathToSea } from "../src/rivers.js";

const p = makePlanet("rivers", { w: 96, h: 48 });
const r = makeRivers(p, makeClimate(p));
const g = p.grid;

test("every drop of rain reaches the sea, and never goes round in a circle", () => {
  for (let i = 0; i < g.n; i++) {
    if (p.elev[i] < 0) continue;
    const path = pathToSea(p, r, i);
    assert.ok(p.elev[path[path.length - 1]] < 0, `patch ${i} never reached the sea`);
  }
});

test("water only flows to a neighbouring patch", () => {
  for (let i = 0; i < g.n; i++) {
    if (p.elev[i] < 0) continue;
    assert.ok(g.neighbors(i).includes(r.down[i]), `patch ${i} jumps to ${r.down[i]}`);
  }
});

test("rivers run downhill: never up a slope, only level across a lake", () => {
  let uphill = 0;
  for (let i = 0; i < g.n; i++) {
    if (!r.river[i]) continue;
    const j = r.down[i];
    assert.ok(r.filled[j] < r.filled[i], "the water surface must drop at every step");
    if (p.elev[j] > p.elev[i] + 1e-6 && !r.lake[j] && !r.lake[i]) uphill++;
  }
  assert.equal(uphill, 0, `${uphill} river steps climb uphill outside lakes`);
});

test("water adds up: a river carries more at its mouth than any patch upstream", () => {
  for (let i = 0; i < g.n; i++) {
    if (p.elev[i] < 0) continue;
    const j = r.down[i];
    if (p.elev[j] >= 0) assert.ok(r.flow[j] > r.flow[i]);
  }
});

test("there are real rivers, and they end in the sea", () => {
  const rivers = [...r.river].filter(Boolean).length;
  assert.ok(rivers > 20, `only ${rivers} river patches`);
  let mouths = 0;
  for (let i = 0; i < g.n; i++) if (r.river[i] && p.elev[r.down[i]] < 0) mouths++;
  assert.ok(mouths > 3, `only ${mouths} river mouths`);
});

test("a hollow in the land fills into a lake instead of trapping the water", () => {
  const q = makePlanet("rivers", { w: 24, h: 12 });
  // Dig a pit in the middle of a high plateau.
  q.elev.fill(-0.5);
  for (let y = 3; y < 9; y++) for (let x = 6; x < 18; x++) q.elev[y * 24 + x] = 0.5;
  const pit = 6 * 24 + 12;
  q.elev[pit] = 0.1;
  const rr = makeRivers(q, null);
  assert.equal(rr.lake[pit], 1);
  assert.ok(rr.filled[pit] >= 0.5);
  assert.ok(q.elev[pathToSea(q, rr, pit).at(-1)] < 0);
});
