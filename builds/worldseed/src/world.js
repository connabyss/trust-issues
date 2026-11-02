// Peoples and their history. A people starts as one fire by good water, spreads over the land that can feed it,
// founds cities, learns to sail, fights its neighbours, suffers plague, splits apart, and sometimes vanishes.
// Everything is decided by the word's dice, so the same word always tells the same history.
import { makePlanet, arc } from "./planet.js";
import { makeClimate, BIOMES, biomeOf } from "./climate.js";
import { makeRivers } from "./rivers.js";
import { makeLanguage } from "./names.js";
import { makeRng } from "./rng.js";

export const YEARS = 6000;
export const STEP = 10; // years per turn
export const SNAP_EVERY = 25; // turns between saved copies of the map of borders
const MAX_PEOPLES = 24;
const CITY_GAP = 7; // degrees: no two cities closer than this

// How many people each patch can feed: the biome's food, more by rivers, lakes and the coast.
export function foodMap(planet, climate, rivers) {
  const { grid, elev } = planet;
  const food = new Float32Array(grid.n);
  for (let i = 0; i < grid.n; i++) {
    if (elev[i] < 0) continue;
    let f = BIOMES[climate.biome[i]].food;
    if (f > 0 && (rivers.river[i] || rivers.lake[i])) f += 0.6;
    if (f > 0 && climate.seaDist[i] <= 180 / grid.h + 1e-6) f += 0.25;
    food[i] = f;
  }
  return food;
}

const HUES = [8, 205, 48, 280, 130, 330, 25, 175, 250, 95, 355, 60, 220, 300, 150, 15];

function hsl(h, s, l) {
  const a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

export function makeWorld(word, { meteors = [], size } = {}) {
  const planet = makePlanet(word, size);
  const { grid } = planet;
  const elev = Float32Array.from(planet.elev); // changes when a meteor lands
  const climate = makeClimate(planet);
  const rivers = makeRivers(planet, climate);
  const food = foodMap(planet, climate, rivers);
  const baseFood = Float32Array.from(food);
  const owner = new Int16Array(grid.n).fill(-1);
  const scorched = new Int16Array(grid.n); // turns until a meteor's burn heals
  const rng0 = makeRng(planet.seed ^ 0x2545f491);
  let rng = rng0;
  const peoples = [], cities = [], events = [];
  const changes = { turn: [], cell: [], to: [] }; // every border change, in order, to rebuild any year
  const snaps = [];
  const elevVersions = [{ turn: 0, elev: Float32Array.from(elev), biome: [...climate.biome] }];
  const wars = new Map(); // "a,b" -> { until, since }
  const truce = new Map();
  const cityAt = new Int32Array(grid.n).fill(-1);
  let turn = 0;

  const year = () => turn * STEP;
  const say = (kind, text, cell, extra = {}) => events.push({ year: year(), kind, text, cell, ...extra });
  const pairKey = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);
  const living = () => peoples.filter((p) => p.alive);

  function setOwner(i, p) {
    if (owner[i] === p) return;
    if (owner[i] >= 0) peoples[owner[i]].cells--;
    owner[i] = p;
    if (p >= 0) { peoples[p].cells++; peoples[p].frontier.push(i); }
    // Land that empties (a meteor, a fallen people) is open again: its neighbours can spread back into it.
    if (p < 0) for (const j of grid.neighbors(i)) if (owner[j] >= 0) peoples[owner[j]].frontier.push(j);
    changes.turn.push(turn); changes.cell.push(i); changes.to.push(p);
  }

  function nearCity(i, gap = CITY_GAP) {
    return cities.some((c) => c.alive && arc(grid, c.cell, i) < gap);
  }

  function where(i) {
    if (rivers.river[i] && climate.seaDist[i] <= 180 / grid.h + 1e-6) return "where a river meets the sea";
    if (rivers.river[i]) return "on a river";
    if (rivers.lake[i]) return "on the shore of a lake";
    if (climate.seaDist[i] <= 180 / grid.h + 1e-6) return "on the coast";
    return "in the " + BIOMES[climate.biome[i]].name;
  }

  function foundCity(p, i, how = "founded") {
    const P = peoples[p];
    const c = { id: cities.length, name: P.lang.city(), cell: i, people: p, founder: p, founded: year(), fell: null, alive: true,
      pops: [], owners: [[year(), p]] };
    cities.push(c);
    cityAt[i] = c.id;
    P.cities.push(c.id);
    if (how === "first") say("dawn", `The ${P.name} lit their first fires at ${c.name}, ${where(i)}.`, i, { people: p, city: c.id });
    else if (how === "colony") say("colony", `${P.name} sailors crossed the open sea and founded ${c.name} on a far shore.`, i, { people: p, city: c.id });
    else say("city", `The ${P.name} founded ${c.name}, ${where(i)}.`, i, { people: p, city: c.id });
    return c;
  }

  function addPeople(lang, color, capitalCell, how, from) {
    const p = peoples.length;
    const P = { id: p, name: lang.people, lang, color, alive: true, cells: 0, frontier: [], cities: [], born: year(),
      sail: false, iron: false, golden: 0, ruler: lang.ruler() };
    peoples.push(P);
    if (how === "first") { setOwner(capitalCell, p); foundCity(p, capitalCell, "first"); }
    return P;
  }

  // ---- the first peoples: on the best-fed patches by water, far apart ----
  const seedCount = 5 + rng.int(4);
  const spots = [];
  for (let i = 0; i < grid.n; i++) if (food[i] >= 1.2 && Math.abs(grid.lat[i]) < 60) spots.push(i);
  for (let tries = 0; tries < 4000 && peoples.length < seedCount && spots.length; tries++) {
    const i = rng.pick(spots);
    if (peoples.some((P) => arc(grid, cities[P.cities[0]].cell, i) < 28)) continue;
    const lang = makeLanguage(planet.seed + 7919 * (peoples.length + 1));
    addPeople(lang, hsl(HUES[peoples.length % HUES.length], 0.75, 0.55), i, "first");
  }

  function strength(P) {
    return (P.cells + 25 * P.cities.filter((c) => cities[c].alive).length) * (P.iron ? 1.4 : 1) * (P.golden > 0 ? 1.3 : 1);
  }

  function loseCity(c, to, text) {
    if (to >= 0) {
      const from = peoples[c.people];
      from.cities = from.cities.filter((x) => x !== c.id);
      c.people = to;
      c.owners.push([year(), to]);
      peoples[to].cities.push(c.id);
      say("fell", text || `${c.name} fell to the ${peoples[to].name}.`, c.cell, { people: to, city: c.id, from: from.id });
    } else {
      c.alive = false;
      c.fell = year();
      cityAt[c.cell] = -1;
      peoples[c.people].cities = peoples[c.people].cities.filter((x) => x !== c.id);
    }
  }

  function fall(P, by) {
    P.alive = false;
    for (const c of [...P.cities]) loseCity(cities[c], -1);
    for (let i = 0; i < grid.n; i++) if (owner[i] === P.id) setOwner(i, -1);
    say("end", by ? `The ${P.name} are no more. The ${peoples[by].name} took the last of their land.`
      : `The ${P.name} are no more. Their fields went back to the wild.`, null, { people: P.id });
  }

  // ---- one turn: ten years ----
  function expand(P) {
    const tries = 3 + 2 * P.cities.length * (P.golden > 0 ? 1.6 : 1);
    for (let t = 0; t < tries && P.frontier.length; t++) {
      const k = rng.int(P.frontier.length), f = P.frontier[k];
      if (owner[f] !== P.id) { P.frontier[k] = P.frontier[P.frontier.length - 1]; P.frontier.pop(); continue; }
      const ns = grid.neighbors(f).filter((j) => elev[j] >= 0 && owner[j] !== P.id);
      if (!ns.length) { P.frontier[k] = P.frontier[P.frontier.length - 1]; P.frontier.pop(); continue; }
      const j = rng.pick(ns);
      if (owner[j] === -1) {
        if (!scorched[j] && rng() < 0.08 + 0.8 * Math.min(1, food[j])) setOwner(j, P.id); // nobody settles burning ground
      } else if (wars.has(pairKey(P.id, owner[j]))) {
        const D = peoples[owner[j]];
        const odds = strength(P) / (strength(P) + strength(D));
        if (rng() < odds * 0.9) {
          setOwner(j, P.id);
          if (cityAt[j] >= 0) {
            loseCity(cities[cityAt[j]], P.id);
            if (!D.cities.length) fall(D, P.id);
          }
        }
      }
    }
  }

  function settle(P) {
    if (rng() > 0.2 + 0.05 * Math.min(6, P.cities.length)) return;
    for (let t = 0; t < 30; t++) {
      const i = P.frontier[rng.int(P.frontier.length)];
      if (i === undefined || owner[i] !== P.id || food[i] < 0.9 || nearCity(i)) continue;
      foundCity(P.id, i);
      return;
    }
  }

  function sail(P) {
    if (!P.sail) {
      if (year() > 1200 && P.cities.length >= 3 && rng() < 0.01) {
        P.sail = true;
        say("sail", `The ${P.name} learned to sail the open sea.`, cities[P.cities[0]].cell, { people: P.id });
      }
      return;
    }
    if (rng() > 0.04) return;
    // A ship leaves from one of their coastal cities and lands on empty, fertile coast within reach.
    const from = cities[rng.pick(P.cities)].cell;
    for (let t = 0; t < 60; t++) {
      const i = rng.int(grid.n);
      if (owner[i] !== -1 || food[i] < 1 || climate.seaDist[i] > 180 / grid.h + 1e-6) continue;
      const d = arc(grid, from, i);
      if (d < 10 || d > 70 || nearCity(i)) continue;
      setOwner(i, P.id);
      foundCity(P.id, i, "colony");
      return;
    }
  }

  function contacts() {
    const seen = new Set();
    for (let i = 0; i < grid.n; i++) {
      const a = owner[i];
      if (a < 0) continue;
      for (const j of grid.neighbors(i)) {
        const b = owner[j];
        if (b >= 0 && b !== a) seen.add(pairKey(a, b));
      }
    }
    return seen;
  }

  let border = new Set();
  function politics() {
    if (turn % 5 === 0) border = contacts();
    for (const [k, w] of wars) {
      if (turn < w.until) continue;
      wars.delete(k);
      truce.set(k, turn + 20 + rng.int(30));
      const [a, b] = k.split(",").map(Number);
      if (peoples[a].alive && peoples[b].alive) {
        say("peace", `The ${peoples[a].name} and the ${peoples[b].name} made peace after ${(turn - w.since) * STEP} years of war.`,
          null, { people: a, other: b });
      }
    }
    for (const k of border) {
      if (wars.has(k) || (truce.get(k) || 0) > turn || rng() > 0.012) continue;
      const [a, b] = k.split(",").map(Number);
      if (!peoples[a].alive || !peoples[b].alive) continue;
      const [att, def] = strength(peoples[a]) >= strength(peoples[b]) ? [a, b] : [b, a];
      wars.set(k, { since: turn, until: turn + 3 + rng.int(12) });
      const target = peoples[def].cities.length ? cities[rng.pick(peoples[def].cities)] : null;
      say("war", `War: the ${peoples[att].name} marched on the ${peoples[def].name}${target ? `, aiming for ${target.name}` : ""}.`,
        target ? target.cell : null, { people: att, other: def });
    }
  }

  function fortune(P) {
    if (P.golden > 0) P.golden--;
    if (!P.iron && year() > 800 && rng() < 0.006) {
      P.iron = true;
      say("iron", `The ${P.name} learned to work iron. Their neighbours took note.`, cities[P.cities[0]].cell, { people: P.id });
    }
    if (P.golden === 0 && P.cities.length >= 2 && rng() < 0.004) {
      P.golden = 10 + rng.int(15);
      P.ruler = P.lang.ruler();
      const seat = cities[P.cities[0]];
      say("golden", `A golden age for the ${P.name}: under ${P.ruler}, ${seat.name} grew rich and its lights burned all night.`,
        seat.cell, { people: P.id });
    }
    if (P.cities.length >= 3 && rng() < 0.003) {
      const c = cities[P.cities[P.cities.length - 1]];
      loseCity(c, -1);
      say("plague", `Plague swept through the ${P.name}. ${c.name} was left empty.`, c.cell, { people: P.id, city: c.id });
      if (!P.cities.length) fall(P);
    }
    // A big people can break apart: the far cities go their own way, with their own name.
    if (P.cities.length >= 6 && P.cells > 900 && peoples.length < MAX_PEOPLES && rng() < 0.004) {
      const seat = cities[P.cities[0]].cell;
      const far = P.cities.map((c) => cities[c]).sort((x, y) => arc(grid, y.cell, seat) - arc(grid, x.cell, seat));
      const lead = far[0];
      const lang = makeLanguage(planet.seed + 104729 * (peoples.length + 1));
      const Q = addPeople(lang, hsl(HUES[peoples.length % HUES.length], 0.7, 0.58), lead.cell, "split");
      for (let i = 0; i < grid.n; i++) {
        if (owner[i] !== P.id) continue;
        if (arc(grid, i, lead.cell) < arc(grid, i, seat)) setOwner(i, Q.id);
      }
      for (const c of far) { // every city on the land that left goes with it
        if (owner[c.cell] !== Q.id) continue;
        P.cities = P.cities.filter((x) => x !== c.id);
        c.people = Q.id;
        c.owners.push([year(), Q.id]);
        Q.cities.push(c.id);
      }
      say("split", `The ${P.name} of ${lead.name} broke away and named themselves the ${Q.name}.`, lead.cell,
        { people: Q.id, from: P.id });
      wars.set(pairKey(P.id, Q.id), { since: turn, until: turn + 4 + rng.int(8) });
    }
  }

  function growCities() {
    for (const c of cities) {
      if (!c.alive) continue;
      const cap = 0.3 + 0.7 * Math.min(1, year() / 4000) + (peoples[c.people].golden > 0 ? 0.3 : 0);
      const last = c.pops.length ? c.pops[c.pops.length - 1][1] : 0.05;
      c.pops.push([year(), last + (cap - last) * 0.05]);
    }
  }

  function landMeteor(m) {
    const r = m.radius || 10;
    const hit = [];
    for (let i = 0; i < grid.n; i++) {
      const d = arc(grid, i, m.cell);
      if (d > r * 1.3) continue;
      if (d <= r) {
        hit.push(i);
        // Land sinks into a scorched bowl with a small lake in the middle; the sea just splashes.
        if (elev[i] >= 0) elev[i] = d < r * 0.3 ? Math.min(elev[i] - 0.1, -0.04) : Math.min(elev[i], Math.max(0.005, elev[i] - 0.3 * (1 - (d / r) ** 2)));
        scorched[i] = 30;
        food[i] = 0;
        if (owner[i] >= 0) setOwner(i, -1);
      } else if (elev[i] >= 0) {
        elev[i] = Math.min(1, elev[i] + 0.15); // the rim
      }
    }
    const biome = [...elevVersions[elevVersions.length - 1].biome];
    for (let i = 0; i < grid.n; i++) {
      if (arc(grid, i, m.cell) <= r * 1.3) {
        biome[i] = scorched[i] ? (elev[i] < 0 ? biomeOf(climate.temp[i], climate.moist[i], elev[i]) : "crater")
          : biomeOf(climate.temp[i], climate.moist[i], elev[i]);
      }
    }
    elevVersions.push({ turn, elev: Float32Array.from(elev), biome });
    const lost = cities.filter((c) => c.alive && arc(grid, c.cell, m.cell) <= r);
    const victims = [...new Set(lost.map((c) => c.people))];
    for (const c of lost) loseCity(c, -1);
    const names = lost.map((c) => c.name);
    const text = names.length
      ? `A star fell from the sky. ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` and ${names.length - 3} more` : ""} ${names.length > 1 ? "were" : "was"} gone in a day.`
      : "A star fell from the sky onto empty land. The ground still smokes.";
    say("meteor", text, m.cell, { lost: lost.map((c) => c.id) });
    for (const p of victims) if (peoples[p].alive && !peoples[p].cities.length) fall(peoples[p]);
    // From here on, history takes a different road.
    rng = makeRng((planet.seed ^ (m.cell * 2654435761) ^ (turn * 40503)) >>> 0);
  }

  const byTurn = new Map();
  for (const m of meteors) {
    const t = Math.max(1, Math.round(m.year / STEP));
    if (!byTurn.has(t)) byTurn.set(t, []);
    byTurn.get(t).push(m);
  }

  snaps.push({ turn: 0, owner: Int16Array.from(owner), change: 0 });
  growCities();
  for (turn = 1; turn <= YEARS / STEP; turn++) {
    for (const m of byTurn.get(turn) || []) landMeteor(m);
    for (let i = 0; i < grid.n; i++) {
      if (scorched[i] > 0 && --scorched[i] === 0) food[i] = baseFood[i] * 0.7;
    }
    politics();
    for (const P of living()) {
      expand(P);
      if (!P.alive) continue;
      settle(P);
      sail(P);
      fortune(P);
    }
    growCities();
    if (turn % SNAP_EVERY === 0) snaps.push({ turn, owner: Int16Array.from(owner), change: changes.turn.length });
  }
  turn = YEARS / STEP;

  // Rebuild the borders for any year: start from the closest saved copy, replay the changes after it.
  function ownerAt(y) {
    const t = Math.max(0, Math.min(YEARS / STEP, Math.floor(y / STEP)));
    let s = snaps[0];
    for (const x of snaps) if (x.turn <= t) s = x;
    const out = Int16Array.from(s.owner);
    for (let k = s.change; k < changes.turn.length && changes.turn[k] <= t; k++) out[changes.cell[k]] = changes.to[k];
    return out;
  }

  function terrainAt(y) {
    const t = Math.floor(y / STEP);
    let v = elevVersions[0];
    for (const x of elevVersions) if (x.turn <= t) v = x;
    return v;
  }

  function citiesAt(y) {
    return cities.filter((c) => c.founded <= y && (c.fell === null || c.fell > y)).map((c) => {
      let pop = 0.05, people = c.founder;
      for (const [yy, p] of c.pops) { if (yy > y) break; pop = p; }
      for (const [yy, p] of c.owners) { if (yy > y) break; people = p; }
      return { ...c, pop, people };
    });
  }

  return { word: planet.word, planet, climate, rivers, food: baseFood, peoples, cities, events, ownerAt, terrainAt,
    citiesAt };
}

BIOMES.crater = { name: "scorched crater", color: [42, 26, 22], food: 0 };
