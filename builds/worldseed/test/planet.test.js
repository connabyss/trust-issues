import { test } from "node:test";
import assert from "node:assert/strict";
import { makePlanet, makeGrid, oceanShare, toXyz, arc } from "../src/planet.js";

const small = { w: 96, h: 48 };

test("the same word always makes the same planet", () => {
  const a = makePlanet("Connor", small), b = makePlanet("connor", small);
  assert.deepEqual(a.elev, b.elev);
});

test("different words make different planets, not the same land shuffled a little", () => {
  const a = makePlanet("mars", small), b = makePlanet("venus", small);
  let same = 0;
  for (let i = 0; i < a.elev.length; i++) if ((a.elev[i] >= 0) === (b.elev[i] >= 0)) same++;
  assert.ok(same / a.elev.length < 0.8, `land and sea agree on ${same} of ${a.elev.length} patches`);
});

test("about 60% of the surface is ocean, counted by ground covered, for many words", () => {
  for (const word of ["a", "pebble", "assata", "huey", "worldseed", "LACRIMOSA"]) {
    const share = oceanShare(makePlanet(word, small));
    assert.ok(Math.abs(share - 0.6) < 0.02, `${word}: ${share}`);
  }
});

test("heights run from the deepest sea (-1) to the highest peak (1)", () => {
  const p = makePlanet("pebble", small);
  assert.equal(Math.max(...p.elev), 1);
  assert.equal(Math.min(...p.elev), -1);
});

test("no seam at the date line: the two edges of the map are neighbours on the globe", () => {
  const p = makePlanet("seam", small), { w, h } = p.grid;
  let jump = 0, inside = 0;
  for (let y = 0; y < h; y++) {
    jump += Math.abs(p.elev[y * w] - p.elev[y * w + w - 1]);
    inside += Math.abs(p.elev[y * w + w / 2] - p.elev[y * w + w / 2 - 1]);
  }
  assert.ok(jump < inside * 1.5 + 0.5, `edge jump ${jump} vs inside ${inside}`);
});

test("grid geometry: neighbours wrap east-west, poles have fewer, distances are right", () => {
  const g = makeGrid(8, 4);
  assert.deepEqual(g.neighbors(g.index(0, 1)).sort((a, b) => a - b),
    [g.index(7, 0), g.index(0, 0), g.index(1, 0), g.index(7, 1), g.index(1, 1), g.index(7, 2), g.index(0, 2), g.index(1, 2)]
      .sort((a, b) => a - b));
  assert.equal(g.neighbors(g.index(3, 0)).length, 5);
  const [x, y, z] = toXyz(90, 0);
  assert.ok(Math.abs(y - 1) < 1e-9 && Math.abs(x) < 1e-9 && Math.abs(z) < 1e-9);
  // Opposite patches across the equator line are almost half a world apart.
  assert.ok(Math.abs(arc(g, g.index(0, 1), g.index(4, 2)) - 180) < 50);
  assert.ok(arc(g, g.index(0, 1), g.index(0, 1)) < 1e-6);
});
