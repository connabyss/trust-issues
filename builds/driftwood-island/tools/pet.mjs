#!/usr/bin/env node
// Your Driftwood Island grazer, in one line: for Claude Code's status line, or any terminal.
//
//   node tools/pet.mjs                    one line about your grazer (what Claude Code's status line runs)
//   node tools/pet.mjs adopt [ID] [NAME]  adopt grazer #ID (the number the page shows), or a random one
//   node tools/pet.mjs story              what happened to it since you last asked
//
// It keeps your grazer and a saved copy of the island in ~/.driftwood (or $DRIFTWOOD_HOME), and steps the saved
// copy forward to now, so each call is quick. The island is the same one the page shows.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { runTo, step, DAY } from "../src/sim.js";
import { tickAt, label, sunAt } from "../src/clock.js";
import { awakeAt } from "../src/genes.js";
import { toJSON, fromJSON } from "../src/save.js";
import { storyOf, summary, familyOf } from "../src/story.js";

const HOME = process.env.DRIFTWOOD_HOME || join(homedir(), ".driftwood");
const PET = join(HOME, "pet.json"), SAVE = join(HOME, "island.json");
const read = (f) => { try { return readFileSync(f, "utf8"); } catch { return null; } };
const NOW = () => (process.env.DRIFTWOOD_NOW ? Number(process.env.DRIFTWOOD_NOW) : Date.now());

// The island now: from the saved copy if there is one that isn't from the future, else from day 0. With a pet, the
// same story the page tells moves it on, so if your grazer died on the way its heir takes over.
function islandNow(pet) {
  const target = tickAt(NOW());
  let s = read(SAVE) && fromJSON(read(SAVE));
  if (!s || s.tick > target || (pet && s.tick < pet.seen)) s = null;
  if (!s) s = runTo(pet ? Math.min(pet.seen, target) : target);
  if (pet && !pet.ended && s.tick < target) {
    const told = storyOf(pet.id, pet.name, s.tick, target, { start: s, family: pet.family, generation: pet.generation });
    Object.assign(pet, { id: told.id, name: told.name, family: told.family, generation: told.generation, seen: target });
    if (!told.alive) pet.ended = true;
    s = told.state;
  }
  while (s.tick < target) step(s);
  mkdirSync(HOME, { recursive: true });
  writeFileSync(SAVE, toJSON(s));
  return s;
}

function mood(z, s) {
  if (z.fleeing) return "running from a prowler!";
  if (!awakeAt(z.g || { night: 0 }, Math.round(sunAt(s.tick) * 10) / 10)) return "asleep";
  if (z.energy < 0.3) return "starving";
  return s.grass[z.at] > 0.45 ? "grazing" : "looking for grass";
}

function near(z, s) {
  const d = (a, b) => Math.max(Math.abs((a % 72) - (b % 72)), Math.abs(Math.floor(a / 72) - Math.floor(b / 72)));
  return s.prowlers.filter((p) => d(p.at, z.at) <= 6).length;
}

export function line(pet, s) {
  if (!pet) return "Driftwood Island: no grazer yet. Adopt one: node tools/pet.mjs adopt";
  const z = s.grazers.find((g) => g.id === pet.id);
  if (!z) return `${pet.name}'s line has ended (${label(s.tick)}). Adopt another: node tools/pet.mjs adopt`;
  const kind = z.kind && s.kinds[z.kind - 1], days = Math.floor(z.age / DAY), p = near(z, s);
  return [`🐑 ${pet.name}`, kind && kind.named ? kind.name : null, `${days}d old`, mood(z, s),
    p ? `${p} prowler${p === 1 ? "" : "s"} near` : null, label(s.tick)].filter(Boolean).join(" · ");
}

function main(args) {
  let pet = read(PET) && JSON.parse(read(PET));
  if (args[0] === "adopt") {
    const s = islandNow(null);
    const id = args[1] ? Number(args[1]) : s.grazers[Math.floor(Math.random() * s.grazers.length)]?.id;
    const z = s.grazers.find((g) => g.id === id);
    if (!z) { console.log(`There's no grazer #${args[1]} alive right now (${label(s.tick)}).`); return 1; }
    pet = { id, name: args.slice(2).join(" ") || "Pebble", since: s.tick, seen: s.tick, family: [...familyOf(s, id)] };
    mkdirSync(HOME, { recursive: true });
    writeFileSync(PET, JSON.stringify(pet));
    console.log(`You adopted grazer #${id}, ${pet.name}.`);
    console.log(line(pet, s));
    return 0;
  }
  if (args[0] === "story") {
    if (!pet) { console.log("No grazer yet. Adopt one: node tools/pet.mjs adopt"); return 0; }
    if (pet.ended) { console.log(`${pet.name}'s line has ended. Adopt another: node tools/pet.mjs adopt`); return 0; }
    const target = tickAt(NOW()), from = Math.max(pet.seen, target - 14 * DAY);
    const told = storyOf(pet.id, pet.name, from, target, { family: pet.family, generation: pet.generation });
    const lines = summary(told);
    console.log(lines.length ? lines.map((l) => `${l.when}: ${l.text}`).join("\n") : `Nothing new since ${label(pet.seen)}.`);
    Object.assign(pet, { id: told.id, name: told.name, family: told.family, generation: told.generation, seen: target });
    if (!told.alive) pet.ended = true;
    writeFileSync(PET, JSON.stringify(pet));
    writeFileSync(SAVE, toJSON(told.state));
    return 0;
  }
  const s = islandNow(pet);
  if (pet) writeFileSync(PET, JSON.stringify(pet));
  console.log(line(pet, s));
  return 0;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  process.exitCode = main(process.argv.slice(2));
}
