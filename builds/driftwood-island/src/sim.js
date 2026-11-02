// The living part. Each rule has a start tick and does nothing before it, so adding a rule later never changes
// what already happened. Every tick, every rule rolls its own dice (seeded by the rule and the tick), so one
// rule's randomness can't shift another's.
import { makeIsland, around, W, H, SEA, SAND, SOIL, ROCK, SEED, idx } from "./island.js";
import { sunAt, TICKS_PER_DAY, islandTime } from "./clock.js";
import { makeRng, seedFrom } from "./rng.js";
import { mutate, distance, average, awakeAt, nameFor, weather } from "./genes.js";

export const DAY = TICKS_PER_DAY;
export const RULES = [
  { id: "grass", since: 0, what: "Grass grows in daylight and spreads to bare soil next to it." },
  { id: "grazers", since: 2 * DAY + 48, what: "Grazers eat grass, wander to greener ground, sleep at night, breed when fed, starve when not." },
  { id: "dew", since: 7 * DAY + 36, what: "Grass grows a little at night too, in the dew, so there's food for anything awake in the dark." },
  { id: "evolution", since: 7 * DAY + 36, what: "Babies inherit their parent's size, legs, coat and waking hours, with small changes. A line that drifts far enough from where it began becomes a new kind." },
];

const ISLAND = makeIsland();
export const island = ISLAND;

// The sun's height rounded to a tenth of a degree, so every browser agrees on it to the last digit.
export function light(tick) {
  const alt = Math.round(sunAt(tick) * 10) / 10;
  return Math.max(0, Math.min(1, alt / 60));
}
const awake = (tick) => Math.round(sunAt(tick) * 10) / 10 > -3;

export const rngFor = (ruleId, tick) => makeRng((seedFrom(ruleId) ^ SEED ^ Math.imul(tick + 1, 0x9e3779b1)) >>> 0);

// Where things wash ashore: the soil tile nearest the middle of the south beach.
export const LANDING = (() => {
  let best = -1, bd = Infinity;
  for (let i = 0; i < W * H; i++) {
    if (ISLAND.tile[i] !== SOIL) continue;
    const x = i % W, y = (i - x) / W, d = (x - W / 2) ** 2 + (H - y) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
})();

export function makeState() {
  return { tick: -1, grass: new Float32Array(W * H), grazers: [], nextId: 1, history: [], marks: {}, starvedToday: 0,
    kinds: [], evo: false };
}

export function cloneState(s) {
  return { ...s, grass: Float32Array.from(s.grass), grazers: s.grazers.map((g) => ({ ...g })), history: [...s.history],
    marks: { ...s.marks }, kinds: s.kinds.map((k) => ({ ...k })) };
}

const soilCount = ISLAND.tile.filter((t) => t === SOIL).length;
const say = (s, text) => s.history.push({ tick: s.tick, text });

// ---- the rules ----

function grass(s, tick) {
  const L = light(tick);
  if (L === 0) return;
  const rng = rngFor("grass", tick), g = s.grass, next = Float32Array.from(g);
  if (!s.marks.seed) {
    next[LANDING] = 0.15;
    s.marks.seed = true;
    say(s, "A seed washed up on the south beach and took root.");
  }
  for (let i = 0; i < W * H; i++) {
    if (ISLAND.tile[i] !== SOIL) continue;
    if (g[i] > 0) next[i] = Math.min(1, g[i] + 0.12 * ISLAND.fertile[i] * L * g[i] * (1 - g[i]) + 0.0008 * L);
    if (g[i] > 0.3) {
      for (const j of around(i)) if (ISLAND.tile[j] === SOIL && g[j] === 0 && next[j] === 0 && rng() < 0.4 * L) next[j] = 0.15;
    }
  }
  s.grass = next;
  let green = 0;
  for (let i = 0; i < W * H; i++) if (next[i] > 0.25) green++;
  for (const [share, text] of [[0.1, "A tenth of the island is green."], [0.5, "Half the island is green."],
    [0.9, "The island is green from shore to shore."]]) {
    if (!s.marks["green" + share] && green >= soilCount * share) { s.marks["green" + share] = true; say(s, text); }
  }
}

const MAX_GRAZERS = 600;
const walkable = (i) => ISLAND.tile[i] === SOIL || ISLAND.tile[i] === SAND;

function grazers(s, tick) {
  if (s.evo) return evolvedGrazers(s, tick);
  const rng = rngFor("grazers", tick), up = awake(tick);
  if (!s.marks.arrived || (s.grazers.length === 0 && (tick - s.marks.lastLanding) >= 10 * DAY && up)) {
    if (!up) return;
    const beach = around(LANDING).find((j) => walkable(j)) ?? LANDING;
    for (let k = 0; k < 2; k++) s.grazers.push({ id: s.nextId++, at: k ? beach : LANDING, energy: 1, age: 3 * DAY, born: tick });
    say(s, s.marks.arrived ? "Two more grazers drifted ashore on a log. The island tries again." : "Two grazers drifted ashore on a log.");
    s.marks.arrived = true;
    s.marks.lastLanding = tick;
  }
  const babies = [];
  for (const z of s.grazers) {
    z.age++;
    if (!up) { z.energy -= 0.006; continue; } // asleep
    const here = s.grass[z.at];
    if (here > 0.45) { // they only eat lush grass, and leave the roots to grow back
      const bite = Math.min(here - 0.3, 0.15);
      s.grass[z.at] = here - bite;
      z.energy = Math.min(2, z.energy + bite * 1.8);
    } else {
      // Look at the four tiles around and step to the greenest (with a little randomness so they spread out).
      let best = z.at, bv = here + rng() * 0.05;
      for (const j of around(z.at)) {
        if (!walkable(j)) continue;
        const v = s.grass[j] + rng() * 0.05;
        if (v > bv) { bv = v; best = j; }
      }
      z.at = best;
    }
    z.energy -= 0.02;
    if (z.energy > 1.4 && z.age > 2 * DAY && s.grazers.length + babies.length < MAX_GRAZERS && rng() < 0.006) {
      z.energy -= 0.8;
      const spot = around(z.at).filter(walkable);
      babies.push({ id: s.nextId++, at: spot.length ? spot[Math.floor(rng() * spot.length)] : z.at, energy: 0.8, age: 0, born: tick });
      if (!s.marks.firstBirth) { s.marks.firstBirth = true; say(s, "The first grazer was born on the island."); }
    }
  }
  const before = s.grazers.length;
  s.grazers = s.grazers.filter((z) => {
    if (z.energy <= 0) { s.starvedToday++; return false; }
    if (z.age > 20 * DAY) return false; // old age
    return true;
  }).concat(babies);
  for (const n of [10, 25, 50, 100, 200, 400]) {
    if (!s.marks["pop" + n] && s.grazers.length >= n) { s.marks["pop" + n] = true; say(s, `There are now ${n} grazers.`); }
  }
  if (before > 0 && s.grazers.length === 0) say(s, "The last grazer died. The island is quiet.");
  if ((tick + 1) % DAY === 0) {
    // Only the worst days make the history: a new record for hunger.
    if (s.starvedToday >= 5 && s.starvedToday > (s.marks.worstDay || 0) * 1.25) {
      say(s, `The hungriest day yet: ${s.starvedToday} grazers starved.`);
      s.marks.worstDay = s.starvedToday;
    }
    s.starvedToday = 0;
  }
}

// ---- evolution: from its start, grazers carry genes (see genes.js) and the grazer rule above hands over to this one ----

const MAX_EVOLVED = 1500;
const SPLIT = 0.45;
const NAMED = 10; // a new line gets a name, and a place in the history, once 10 of it are alive at once // how far a newborn's genes must be from its kind's founder to start a new kind

function newKind(s, g, parent, tick, at) {
  const kind = { id: s.kinds.length + 1, name: nameFor(g), g, parent, born: tick, at, count: 0, peak: 0, gone: null, named: false };
  s.kinds.push(kind);
  return kind;
}

// Where on the island a spot is, in words.
function region(i) {
  const x = (i % W) / W - 0.5, y = Math.floor(i / W) / H - 0.5;
  if (Math.abs(x) < 0.12 && Math.abs(y) < 0.12) return "the middle";
  return Math.abs(y) > Math.abs(x) ? (y < 0 ? "the north" : "the south") : (x < 0 ? "the west" : "the east");
}

// A kind gets its name when it's named: what stands out about it, and where it began if that name is taken.
function giveName(s, k) {
  const taken = new Set(s.kinds.filter((o) => o.named && o !== k).map((o) => o.name));
  let name = nameFor(k.g);
  if (taken.has(name)) name = `${name} of ${region(k.at)}`;
  for (let n = 2; taken.has(name); n++) name = `${nameFor(k.g)} of ${region(k.at)} ${n}`;
  k.name = name;
  k.named = true;
}

function evolution(s, tick) {
  if (s.evo) return;
  // The first tick: every grazer alive gets genes, a little different from its neighbours', and they're all one kind.
  const rng = rngFor("evolution", tick);
  const base = { size: 0.5, legs: 0.3, coat: 0.5, night: 0.2 };
  for (const z of s.grazers) z.g = mutate(base, rng, 0.25);
  const kind = newKind(s, s.grazers.length ? average(s.grazers.map((z) => z.g)) : base, 0, tick, LANDING);
  for (const z of s.grazers) z.kind = kind.id;
  kind.count = kind.peak = s.grazers.length;
  giveName(s, kind);
  s.evo = true;
  say(s, `Evolution began: from today, young grazers take after their parents, with small changes. All ${s.grazers.length} are one kind for now, the ${kind.name}s.`);
}

function evolvedGrazers(s, tick) {
  const rng = rngFor("grazers-evolved", tick), alt = Math.round(sunAt(tick) * 10) / 10, daytime = alt > -3, L = light(tick);
  if (s.grazers.length === 0 && (tick - s.marks.lastLanding) >= 10 * DAY && daytime) {
    const beach = around(LANDING).find((j) => walkable(j)) ?? LANDING, g = s.kinds[0].g;
    for (let k = 0; k < 2; k++) s.grazers.push({ id: s.nextId++, at: k ? beach : LANDING, energy: 1, age: 3 * DAY, born: tick, g, kind: 1 });
    say(s, "Two more grazers drifted ashore on a log. The island tries again.");
    s.marks.lastLanding = tick;
  }
  const kinds = new Map(s.kinds.map((k) => [k.id, k])), babies = [];
  for (const z of s.grazers) {
    const g = z.g;
    z.age++;
    const up = awakeAt(g, alt);
    z.energy -= weather(g, daytime, L, up);
    if (!up) { z.energy -= 0.004 + 0.004 * g.size; continue; }
    const here = s.grass[z.at];
    if (here > 0.45) {
      // Bigger mouths take more; in the dark only night-eyed grazers eat well.
      const bite = Math.min(here - 0.3, 0.07 + 0.13 * g.size) * (daytime ? 1 : 0.35 + 0.65 * g.night);
      s.grass[z.at] = here - bite;
      z.energy = Math.min(2, z.energy + bite * 1.8);
    } else {
      // Search for grass: one step to the greenest neighbour, and long legs keep going.
      const steps = 1 + Math.floor(g.legs * 3);
      for (let n = 0; n < steps; n++) {
        let best = z.at, bv = s.grass[z.at] + rng() * 0.05;
        for (const j of around(z.at)) {
          if (!walkable(j)) continue;
          const v = s.grass[j] + rng() * 0.05;
          if (v > bv) { bv = v; best = j; }
        }
        z.at = best;
        if (s.grass[best] > 0.45) break;
      }
    }
    z.energy -= 0.012 + 0.012 * g.size + 0.01 * g.legs;
    if (z.energy > 1.2 + 0.3 * g.size && z.age > DAY * 0.75 && s.grazers.length + babies.length < MAX_EVOLVED && rng() < 0.02) {
      z.energy -= 0.7;
      const spot = around(z.at).filter(walkable), bg = mutate(g, rng, 0.2);
      const baby = { id: s.nextId++, at: spot.length ? spot[Math.floor(rng() * spot.length)] : z.at, energy: 0.6 + 0.3 * g.size,
        age: 0, born: tick, g: bg, kind: z.kind };
      const mine = kinds.get(z.kind);
      if (distance(bg, mine.g) > SPLIT) {
        // Too different from its own kind. If a living kind is close, it belongs to that one; if not, it starts one.
        let near = null, nd = SPLIT;
        for (const k of s.kinds) if (k.count > 0 && k !== mine && distance(bg, k.g) < nd) { nd = distance(bg, k.g); near = k; }
        const k = near || newKind(s, bg, mine.id, tick, baby.at);
        kinds.set(k.id, k);
        baby.kind = k.id;
        k.count++; // so the next baby this tick can find it
      }
      babies.push(baby);
    }
  }
  const before = s.grazers.length;
  s.grazers = s.grazers.filter((z) => {
    if (z.energy <= 0) { s.starvedToday++; return false; }
    return z.age <= (14 + 6 * z.g.size) * DAY; // old age: big ones live longer
  }).concat(babies);
  for (const k of s.kinds) k.count = 0;
  for (const z of s.grazers) kinds.get(z.kind).count++;
  for (const k of s.kinds) {
    k.peak = Math.max(k.peak, k.count);
    if (!k.named && k.count >= NAMED) {
      giveName(s, k);
      say(s, `A new kind has split off from the ${s.kinds[k.parent - 1].name}s: the ${k.name}.`);
    }
    if (k.count === 0 && k.gone === null && k.born < tick) {
      k.gone = tick;
      if (k.named) say(s, `The ${k.name}s died out.`);
    }
    if (k.count > 0 && k.gone !== null) k.gone = null; // only if a log brings the first kind back
  }
  for (const n of [10, 25, 50, 100, 200, 400]) {
    if (!s.marks["pop" + n] && s.grazers.length >= n) { s.marks["pop" + n] = true; say(s, `There are now ${n} grazers.`); }
  }
  if (before > 0 && s.grazers.length === 0) say(s, "The last grazer died. The island is quiet.");
  if ((tick + 1) % DAY === 0) {
    if (s.starvedToday >= 5 && s.starvedToday > (s.marks.worstDay || 0) * 1.25) {
      say(s, `The hungriest day yet: ${s.starvedToday} grazers starved.`);
      s.marks.worstDay = s.starvedToday;
    }
    s.starvedToday = 0;
  }
}

// Dew: at night, grass that's already there grows a little (slower than in sunshine).
function dew(s, tick) {
  if (Math.round(sunAt(tick) * 10) / 10 > -3) return;
  const g = s.grass;
  for (let i = 0; i < W * H; i++) if (g[i] > 0 && g[i] < 1) g[i] = Math.min(1, g[i] + 0.006 * ISLAND.fertile[i]);
}

const RUN = { grass, grazers, evolution, dew };

// Move the world forward one tick, applying only the rules that have started.
// `extra` lets a test plug in a rule that isn't part of the island (to prove a later rule can't touch the past).
export function step(s, rules = RULES, extra = {}) {
  s.tick++;
  if (s.tick === 0) say(s, "The island rose from the sea: sand, soil and rock, and nothing living.");
  for (const r of rules) if (s.tick >= r.since) (RUN[r.id] || extra[r.id])(s, s.tick);
  return s;
}

export function runTo(tick, rules = RULES, s = makeState(), extra = {}) {
  while (s.tick < tick) step(s, rules, extra);
  return s;
}

// A short fingerprint of the whole world at this moment (grass to 4 decimals, every grazer, the history).
export function fingerprint(s) {
  let h = 0x811c9dc5;
  const mix = (n) => { h ^= n >>> 0; h = Math.imul(h, 0x01000193); };
  mix(s.tick);
  for (let i = 0; i < s.grass.length; i++) mix(Math.round(s.grass[i] * 10000));
  for (const z of s.grazers) {
    mix(z.id); mix(z.at); mix(Math.round(z.energy * 10000)); mix(z.age);
    if (z.g) for (const v of Object.values(z.g)) mix(Math.round(v * 10000)); // genes exist only once evolution starts
  }
  for (const e of s.history) { mix(e.tick); for (const ch of e.text) mix(ch.charCodeAt(0)); }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export { islandTime };
