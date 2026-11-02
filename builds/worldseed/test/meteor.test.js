import { test } from "node:test";
import assert from "node:assert/strict";
import { makeWorld } from "../src/world.js";
import { arc } from "../src/planet.js";

const size = { w: 160, h: 80 };
const calm = makeWorld("meteor", size);
// Aim at the biggest city alive in year 2000.
const target = calm.citiesAt(2000).sort((a, b) => b.pop - a.pop)[0];
const strike = { year: 2000, cell: target.cell, radius: 6 };
const hit = makeWorld("meteor", { ...size, meteors: [strike] });
const g = hit.planet.grid;

test("history before the meteor is untouched, word for word", () => {
  const before = (w) => w.events.filter((e) => e.year < 2000).map((e) => e.text);
  assert.deepEqual(before(hit), before(calm));
});

test("the meteor wipes out the city it lands on, and the chronicle says so by name", () => {
  const e = hit.events.find((x) => x.kind === "meteor");
  assert.ok(e, "no meteor in the chronicle");
  assert.equal(e.year, 2000);
  assert.match(e.text, new RegExp(target.name));
  assert.ok(!hit.citiesAt(2000).some((c) => c.id === target.id), `${target.name} still standing`);
  for (const c of hit.citiesAt(2000)) assert.ok(arc(g, c.cell, strike.cell) > strike.radius, `${c.name} survived inside the blast`);
});

test("it leaves a crater: lower ground inside, a raised rim, nobody living in it", () => {
  const before = hit.terrainAt(1990).elev, after = hit.terrainAt(2000).elev;
  assert.ok(after[strike.cell] < before[strike.cell] - 0.09 && after[strike.cell] < 0, "no crater lake at the strike");
  let rim = 0;
  const owner = hit.ownerAt(2000);
  for (let i = 0; i < g.n; i++) {
    const d = arc(g, i, strike.cell);
    if (d <= strike.radius) { assert.ok(after[i] <= before[i]); assert.equal(owner[i], -1); }
    else if (d <= strike.radius * 1.3 && before[i] >= 0 && after[i] > before[i]) rim++;
    else if (d > strike.radius * 1.3) assert.equal(after[i], before[i]);
  }
  assert.ok(rim > 0, "no raised rim");
  // A scorched ring you can see from space, around the lake.
  let ring = 0;
  for (let i = 0; i < g.n; i++) if (hit.terrainAt(2000).biome[i] === "crater") ring++;
  assert.ok(ring > 10, `${ring} scorched patches`);
});

test("after the meteor, history takes a different road", () => {
  const after = (w) => w.events.filter((e) => e.year > 2000).map((e) => e.text).slice(0, 20);
  assert.notDeepEqual(after(hit), after(calm));
});

test("the burnt ground heals: someone lives in the crater again within a thousand years", () => {
  const owner = hit.ownerAt(3200);
  let back = 0;
  for (let i = 0; i < g.n; i++) if (arc(g, i, strike.cell) <= strike.radius && owner[i] >= 0) back++;
  assert.ok(back > 0);
});

test("a meteor on empty land still leaves its mark in the chronicle", () => {
  const owner = calm.ownerAt(100);
  let empty = -1;
  for (let i = 0; i < g.n && empty < 0; i++) {
    if (calm.planet.elev[i] > 0.1 && owner[i] < 0 && calm.cities.every((c) => arc(g, c.cell, i) > 8)) empty = i;
  }
  const w = makeWorld("meteor", { ...size, meteors: [{ year: 100, cell: empty, radius: 3 }] });
  assert.match(w.events.find((e) => e.kind === "meteor").text, /empty land/);
});

test("a crater on land stays land you can see: a scorched bowl, not a hole into the sea", () => {
  const before = hit.terrainAt(1990), after = hit.terrainAt(2000);
  let land = 0, scorched = 0;
  for (let i = 0; i < g.n; i++) {
    const d = arc(g, i, strike.cell);
    if (d > strike.radius || d < strike.radius * 0.3 || before.elev[i] < 0) continue;
    land++;
    if (after.elev[i] >= 0 && after.biome[i] === "crater") scorched++;
  }
  assert.ok(land > 10 && scorched / land > 0.9, `${scorched} of ${land} hit land patches are a scorched bowl`);
});

test("a meteor dropped from the page (no size given) is big enough to see: 10 degrees across the blast", () => {
  const w = makeWorld("meteor", { ...size, meteors: [{ year: 2000, cell: strike.cell }] });
  const owner = w.ownerAt(2000);
  let far = 0;
  for (let i = 0; i < g.n; i++) {
    const d = arc(g, i, strike.cell);
    if (d > 8 && d < 9.5 && w.planet.elev[i] >= 0) { assert.equal(owner[i], -1); far++; }
  }
  assert.ok(far > 0);
});
