import { test } from "node:test";
import assert from "node:assert/strict";
import { makeWorld, YEARS } from "../src/world.js";
import { paintYear, lightsAt, encodeHash, decodeHash, yearLabel } from "../src/view.js";
import { paintMap } from "../src/globe.js";

const w = makeWorld("view", { w: 160, h: 80 });
const g = w.planet.grid;

test("a people's land is tinted its colour, and the wild is left as it is", () => {
  const year = 3000, owner = w.ownerAt(year), map = paintYear(w, year);
  const base = paintMap(w.planet, w.climate, w.rivers);
  let tinted = 0, wild = 0;
  for (let i = 0; i < g.n; i++) {
    const same = map[i * 3] === base[i * 3] && map[i * 3 + 1] === base[i * 3 + 1] && map[i * 3 + 2] === base[i * 3 + 2];
    if (owner[i] < 0) { assert.ok(same, "unowned land got painted"); wild++; continue; }
    const col = w.peoples[owner[i]].color;
    const before = Math.abs(base[i * 3] - col[0]) + Math.abs(base[i * 3 + 1] - col[1]) + Math.abs(base[i * 3 + 2] - col[2]);
    const after = Math.abs(map[i * 3] - col[0]) + Math.abs(map[i * 3 + 1] - col[1]) + Math.abs(map[i * 3 + 2] - col[2]);
    assert.ok(after <= before, "owned land should move toward its people's colour");
    tinted++;
  }
  assert.ok(tinted > 100 && wild > 100);
});

test("borders are drawn stronger than the inside of a country", () => {
  const year = 4000, owner = w.ownerAt(year), map = paintYear(w, year);
  const base = paintMap(w.planet, w.climate, w.rivers);
  const shift = (i) => Math.abs(map[i * 3] - base[i * 3]) + Math.abs(map[i * 3 + 1] - base[i * 3 + 1]) + Math.abs(map[i * 3 + 2] - base[i * 3 + 2]);
  let edge = 0, ne = 0, inner = 0, ni = 0;
  for (let i = 0; i < g.n; i++) {
    if (owner[i] < 0) continue;
    const isEdge = g.neighbors(i).some((j) => owner[j] !== owner[i] && w.planet.elev[j] >= 0);
    if (isEdge) { edge += shift(i); ne++; } else { inner += shift(i); ni++; }
  }
  assert.ok(edge / ne > 1.8 * (inner / ni), `edge ${edge / ne} inner ${inner / ni}`);
});

test("no lights before anyone lives there, lights only on lived-in land, brightest in cities", () => {
  const owner = w.ownerAt(YEARS), lights = lightsAt(w, YEARS);
  let lit = 0;
  for (let i = 0; i < g.n; i++) {
    if (w.planet.elev[i] < 0) assert.ok(lights[i] === 0 || w.citiesAt(YEARS).some((c) => Math.abs((c.cell % g.w) - (i % g.w)) <= 3), "a light far out at sea");
    if (lights[i] > 0) lit++;
    assert.ok(lights[i] >= 0 && lights[i] <= 1);
    if (owner[i] < 0 && lights[i] > 0) assert.ok(w.citiesAt(YEARS).some((c) => Math.abs(c.cell - i) < 4 * g.w), "light in the wild");
  }
  assert.ok(lit > 200);
  const city = w.citiesAt(YEARS)[0];
  const countryside = [...lights.keys()].find((i) => owner[i] >= 0 && w.citiesAt(YEARS).every((c) => Math.abs((c.cell % g.w) - (i % g.w)) > 5 || Math.abs(Math.floor(c.cell / g.w) - Math.floor(i / g.w)) > 5));
  assert.ok(lights[city.cell] > lights[countryside] * 3);
});

test("the night gets brighter as the world gets older", () => {
  const sum = (y) => lightsAt(w, y).reduce((s, v) => s + v, 0);
  assert.ok(sum(500) < sum(2500) && sum(2500) < sum(5500));
});

test("the share link brings back the same word and meteors", () => {
  const meteors = [{ year: 2000, cell: 1234 }, { year: 4500, cell: 99 }];
  const h = encodeHash("Big Cat ☄", meteors);
  assert.deepEqual(decodeHash(h), { word: "Big Cat ☄", meteors });
  assert.deepEqual(decodeHash("#mars"), { word: "mars", meteors: [] });
});

test("a broken or hostile link is ignored, not obeyed", () => {
  assert.deepEqual(decodeHash("#mars~abc~-5.3~99999.1~200.999999", 1000).meteors, []);
  assert.deepEqual(decodeHash("#%E0%A4%A"), { word: "%E0%A4%A", meteors: [] });
});

test("years read like years", () => {
  assert.equal(yearLabel(0), "Year 0");
  assert.equal(yearLabel(1240.4), "Year 1,240");
});

test("the lights of a year don't know the future: a meteor in year 5000 changes nothing about year 3000", () => {
  const later = makeWorld("view", { w: 160, h: 80, meteors: [{ year: 5000, cell: w.citiesAt(4990)[0].cell }] });
  for (const y of [1000, 3000, 4990]) assert.deepEqual(lightsAt(later, y), lightsAt(w, y), `year ${y}`);
});
