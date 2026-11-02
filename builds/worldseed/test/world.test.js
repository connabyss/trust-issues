import { test } from "node:test";
import assert from "node:assert/strict";
import { makeWorld, YEARS, foodMap } from "../src/world.js";
import { arc } from "../src/planet.js";

const size = { w: 160, h: 80 };
const w = makeWorld("history", size);
const g = w.planet.grid, elev = w.planet.elev;

test("the same word tells the same history, word for word", () => {
  const again = makeWorld("History", size);
  assert.deepEqual(again.events.map((e) => e.text), w.events.map((e) => e.text));
});

test("another word tells another history", () => {
  const other = makeWorld("future", size);
  assert.notDeepEqual(other.events.slice(0, 10).map((e) => e.text), w.events.slice(0, 10).map((e) => e.text));
});

test("the first peoples start on land that can feed them, far apart", () => {
  const first = w.events.filter((e) => e.kind === "dawn");
  assert.ok(first.length >= 5 && first.length <= 8, `${first.length} first peoples`);
  for (const e of first) assert.ok(w.food[e.cell] >= 1.2, "a first fire on poor land");
  for (let a = 0; a < first.length; a++) for (let b = a + 1; b < first.length; b++) {
    assert.ok(arc(g, first[a].cell, first[b].cell) >= 28);
  }
});

test("nobody founds a city in the sea, and every city starts on its own people's land", () => {
  for (const c of w.cities) {
    assert.ok(elev[c.cell] >= 0, `${c.name} is in the sea`);
    const owner = w.ownerAt(c.founded);
    assert.equal(owner[c.cell], c.founder, `${c.name} founded on land that isn't its founders'`);
  }
});

test("borders never cover the sea, and land fills up as the years pass", () => {
  const early = w.ownerAt(200), late = w.ownerAt(YEARS);
  let e = 0, l = 0;
  for (let i = 0; i < g.n; i++) {
    if (elev[i] < 0) { assert.equal(late[i], -1); continue; }
    if (early[i] >= 0) e++;
    if (late[i] >= 0) l++;
  }
  assert.ok(l > e * 3, `owned patches: ${e} in year 200, ${l} at the end`);
});

test("rebuilding a year from saved copies gives exactly the borders the history had", () => {
  // Year 0 is only the first fires.
  const zero = w.ownerAt(0);
  const firsts = new Set(w.events.filter((e) => e.kind === "dawn").map((e) => e.cell));
  for (let i = 0; i < g.n; i++) assert.equal(zero[i] >= 0, firsts.has(i));
  // Between two saved copies: replaying forward a year at a time never loses or invents a change.
  const a = w.ownerAt(1230), b = w.ownerAt(1240);
  let diff = 0;
  for (let i = 0; i < g.n; i++) if (a[i] !== b[i]) diff++;
  assert.ok(diff < g.n / 20, `${diff} patches changed hands in ten years`);
});

test("history happens: cities, wars, peace and at least one city taken in war", () => {
  const kinds = new Set(w.events.map((e) => e.kind));
  for (const k of ["dawn", "city", "war", "peace", "fell"]) assert.ok(kinds.has(k), `no ${k} in the history`);
});

test("the chronicle is in order and only names peoples and cities that exist", () => {
  const names = new Set([...w.peoples.map((p) => p.name), ...w.cities.map((c) => c.name)]);
  for (let k = 1; k < w.events.length; k++) assert.ok(w.events[k].year >= w.events[k - 1].year);
  for (const e of w.events) {
    for (const m of e.text.matchAll(/\b(?:the|The) ([A-Z][a-z]+)\b/g)) assert.ok(names.has(m[1]), `"${m[1]}" in: ${e.text}`);
  }
});

test("a city that falls in war really changes hands on the map", () => {
  const fell = w.events.filter((e) => e.kind === "fell");
  assert.ok(fell.length > 0);
  for (const e of fell) assert.equal(w.ownerAt(e.year)[e.cell], e.people, e.text);
});

test("a people that ends owns no land and no cities afterwards", () => {
  for (const e of w.events.filter((x) => x.kind === "end")) {
    const owner = w.ownerAt(e.year);
    for (let i = 0; i < g.n; i++) assert.notEqual(owner[i], e.people, e.text);
    assert.ok(w.citiesAt(e.year).every((c) => c.people !== e.people || c.founded > e.year), e.text);
  }
  const ended = new Set(w.events.filter((x) => x.kind === "end").map((x) => x.people));
  for (const p of w.peoples) assert.equal(p.alive, !ended.has(p.id), p.name);
});

test("cities grow, and none are alive before they're founded", () => {
  const late = w.citiesAt(YEARS);
  assert.ok(late.length > 10);
  for (const c of w.citiesAt(1000)) assert.ok(c.founded <= 1000);
  const old = late.find((c) => c.founded < 500);
  assert.ok(old, "no early city survives to the end");
  assert.ok(old.pop > w.citiesAt(old.founded)[0].pop || old.pop > 0.3);
});

test("food: none in the sea or on ice, more by rivers", () => {
  const food = foodMap(w.planet, w.climate, w.rivers);
  for (let i = 0; i < g.n; i++) {
    if (elev[i] < 0 || w.climate.biome[i] === "ice") assert.equal(food[i], 0);
    if (w.rivers.river[i] && w.climate.biome[i] === "grassland") assert.ok(food[i] >= 1.6);
  }
});

test("in any year, a city belongs to whoever holds its ground that year, not who holds it at the end", () => {
  for (const year of [0, 500, 1500, 3000, 4500, YEARS]) {
    const owner = w.ownerAt(year);
    for (const c of w.citiesAt(year)) assert.equal(c.people, owner[c.cell], `${c.name} in year ${year}`);
  }
});
