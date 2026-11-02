// The story of one grazer (yours) between two moments: what happened to it, and who carries on when it dies.
// This only watches the island; it never changes it, so everyone's island stays the same.
import { RULES, runTo, step, DAY } from "./sim.js";
import { label } from "./clock.js";

const WHY = {
  caught: (n) => `${n} was caught by a prowler.`,
  starved: (n) => `${n} starved.`,
  "old age": (n) => `${n} died of old age, after a long life.`,
};

// Living grazers in `id`'s family: its young, their young, and so on.
export function familyOf(s, id) {
  const fam = new Set([id]);
  for (let grew = true; grew;) {
    grew = false;
    for (const z of s.grazers) if (z.mom !== undefined && fam.has(z.mom) && !fam.has(z.id)) { fam.add(z.id); grew = true; }
  }
  fam.delete(id);
  return fam;
}

// Who takes over when a grazer dies: its oldest living child, else the oldest living one of its family.
export function heirOf(s, id, family) {
  const alive = s.grazers.filter((z) => family.has(z.id));
  if (!alive.length) return null;
  const kids = alive.filter((z) => z.mom === id);
  const pool = kids.length ? kids : alive;
  return pool.reduce((a, b) => (b.born < a.born || (b.born === a.born && b.id < a.id) ? b : a));
}

// Follow grazer `id` (called `name`) from tick `from` to tick `to`. Returns { events, id, name, alive, state }:
// `id` and `name` are whoever you follow at the end (an heir, if yours died). `start` lets a caller pass the island
// already worked out to `from`, which is faster; it gets moved on, so pass a copy if you need to keep it.
export function storyOf(id, name, from, to, { rules = RULES, start = null, family: known = null, generation: gen = null } = {}) {
  const s = start || runTo(from, rules);
  const events = [], tell = (text, what = "note") => events.push({ tick: s.tick, when: label(s.tick), text, what });
  let me = s.grazers.find((z) => z.id === id);
  if (!me) return { events: [{ tick: s.tick, when: label(s.tick), text: `${name} isn't alive at this moment.` }], id, name, alive: false, state: s };
  // Its family so far: passed in (remembered from last time, dead links included), or worked out from who's alive.
  const family = new Set(known || familyOf(s, id));
  let lastRan = -Infinity, kidsBorn = 0, generation = gen || generationOf(name), wasNamed = !!(s.kinds[me.kind - 1] || {}).named;
  while (s.tick < to) {
    step(s, rules);
    for (const z of s.grazers) {
      if (z.born !== s.tick || z.mom === undefined || !(family.has(z.mom) || z.mom === me.id)) continue;
      family.add(z.id);
      if (z.mom === me.id) { kidsBorn++; tell(kidsBorn === 1 ? `${name} had a baby, #${z.id}.` : `${name} had another baby, #${z.id} (${kidsBorn} so far).`, "baby"); }
    }
    const death = s.died.find((d) => d.id === me.id);
    if (death) {
      tell(WHY[death.why](name), "death");
      const heir = heirOf(s, me.id, family);
      if (!heir) { tell(`${name}'s line has ended. Adopt a new grazer to keep watching.`, "end"); return { events, id: me.id, name, alive: false, state: s, family: [], generation }; }
      generation++;
      const kid = heir.mom === me.id;
      name = nextName(name, generation);
      kidsBorn = 0;
      tell(`${kid ? "Its oldest child" : "Its oldest living relative"}, #${heir.id}, carries on as ${name}.`, "heir");
      me = heir;
      family.delete(heir.id);
      wasNamed = !!(s.kinds[me.kind - 1] || {}).named;
      lastRan = -Infinity;
      continue;
    }
    me = s.grazers.find((z) => z.id === me.id);
    if (me.fleeing && s.tick - lastRan > DAY / 4) { tell(`${name} ran from a prowler.`, "ran"); lastRan = s.tick; }
    const kind = s.kinds[me.kind - 1];
    if (kind && kind.named && !wasNamed) {
      tell(kind.parent ? `${name}'s family became a new kind: the ${kind.name}.` : `Evolution began. ${name} is one of the ${kind.name}s.`, "kind");
    }
    wasNamed = !!(kind && kind.named);
  }
  return { events, id: me.id, name, alive: true, state: s, family: [...family], generation };
}

// Pebble, then Pebble II, Pebble III... (a name that already ends in a numeral gets the next one).
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
// Which generation a name says it is: "Pebble" is 1, "Pebble III" is 3.
export function generationOf(name) {
  const m = name.match(/ (I|II|III|IV|V|VI|VII|VIII|IX|X|\d+)$/);
  return !m ? 1 : ROMAN.includes(m[1]) ? ROMAN.indexOf(m[1]) : Number(m[1]);
}
export function nextName(name, generation) {
  const base = name.replace(/ (I|II|III|IV|V|VI|VII|VIII|IX|X|\d+)$/, "");
  return `${base} ${ROMAN[generation] || generation}`;
}

// The short version, for "while you were away": one line per life (babies, close calls, how it ended), plus heirs
// and new kinds.
export function summary(story) {
  const out = [];
  let babies = 0, ran = 0;
  const bits = () => {
    const b = [];
    if (babies) b.push(`had ${babies} ${babies === 1 ? "baby" : "babies"}`);
    if (ran) b.push(`ran from prowlers ${ran === 1 ? "once" : ran === 2 ? "twice" : `${ran} times`}`);
    babies = 0; ran = 0;
    return b.join(" and ");
  };
  for (const e of story.events) {
    if (e.what === "baby") babies++;
    else if (e.what === "ran") ran++;
    else if (e.what === "death") {
      const m = e.text.match(/^(.*?) (was caught.*|starved.*|died of old age.*)$/), b = bits();
      out.push({ when: e.when, text: b && m ? `${m[1]} ${b}, then ${m[2]}` : e.text });
    } else out.push({ when: e.when, text: e.text });
  }
  if (story.alive) {
    const b = bits();
    out.push({ when: "now", text: b ? `${story.name} ${b}, and is alive.` : `${story.name} is alive and well.` });
  }
  return out;
}
