import { test } from "node:test";
import assert from "node:assert/strict";
import { makePlanet } from "../src/planet.js";
import { makeClimate, biomeOf, BIOMES, distanceToSea } from "../src/climate.js";

const p = makePlanet("climate", { w: 96, h: 48 });
const c = makeClimate(p);
const g = p.grid;
const mean = (pick) => { let s = 0, n = 0; for (let i = 0; i < g.n; i++) if (pick(i)) { s += c.temp[i]; n++; } return s / n; };

test("the equator is hot and the poles are freezing", () => {
  const eq = mean((i) => Math.abs(g.lat[i]) < 10), pole = mean((i) => Math.abs(g.lat[i]) > 75);
  assert.ok(eq > 20, `equator ${eq}`);
  assert.ok(pole < -10, `poles ${pole}`);
});

test("climbing a mountain makes it colder than the lowland at the same latitude", () => {
  let colder = 0, pairs = 0;
  for (let y = 0; y < g.h; y++) {
    let hi = -1, lo = -1;
    for (let x = 0; x < g.w; x++) {
      const i = y * g.w + x;
      if (p.elev[i] > 0.6 && (hi < 0 || p.elev[i] > p.elev[hi])) hi = i;
      if (p.elev[i] >= 0 && p.elev[i] < 0.1) lo = i;
    }
    if (hi >= 0 && lo >= 0) { pairs++; if (c.temp[hi] < c.temp[lo]) colder++; }
  }
  assert.ok(pairs > 3 && colder === pairs, `${colder} of ${pairs} peaks colder`);
});

test("distance to the sea: 0 in the sea, grows inland one patch at a time", () => {
  const d = distanceToSea(p);
  for (let i = 0; i < g.n; i++) {
    if (p.elev[i] < 0) { assert.equal(d[i], 0); continue; }
    assert.ok(d[i] > 0);
    const nearest = Math.min(...g.neighbors(i).map((j) => d[j]));
    assert.ok(Math.abs(d[i] - nearest - 180 / g.h) < 1e-4, "a land patch should be one step further than its closest neighbour");
  }
});

test("the coast is wetter than deep inland", () => {
  let coast = 0, nc = 0, inland = 0, ni = 0;
  for (let i = 0; i < g.n; i++) {
    if (p.elev[i] < 0 || Math.abs(g.lat[i]) > 60) continue;
    if (c.seaDist[i] < 5) { coast += c.moist[i]; nc++; } else if (c.seaDist[i] > 9) { inland += c.moist[i]; ni++; }
  }
  assert.ok(nc > 0 && ni > 0);
  assert.ok(coast / nc > inland / ni + 0.15, `coast ${coast / nc} inland ${inland / ni}`);
});

test("biomes make sense: sea stays sea, no jungle in the cold, no ice in the heat", () => {
  for (let i = 0; i < g.n; i++) {
    const b = BIOMES[c.biome[i]];
    assert.ok(b, `unknown biome ${c.biome[i]}`);
    assert.equal(Boolean(b.sea), p.elev[i] < 0, "land and sea biomes must match the shoreline");
    if (c.biome[i] === "jungle") assert.ok(c.temp[i] > 22);
    if (c.biome[i] === "ice" || c.biome[i] === "seaice") assert.ok(c.temp[i] < -5);
  }
  assert.equal(biomeOf(28, 0.8, 0.2), "jungle");
  assert.equal(biomeOf(28, 0.1, 0.2), "desert");
  assert.equal(biomeOf(-20, 0.5, 0.1), "ice");
  assert.equal(biomeOf(15, 0.4, 0.95), "snowpeak");
  assert.equal(biomeOf(15, 0.4, -0.5), "deep");
});

test("a planet has variety: at least six different biomes on land", () => {
  const land = new Set(c.biome.filter((b) => !BIOMES[b].sea));
  assert.ok(land.size >= 6, [...land].join(", "));
});
