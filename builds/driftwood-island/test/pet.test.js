// The status-line pet: the saved island, and the command Claude Code runs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runTo, step, fingerprint, DAY } from "../src/sim.js";
import { toJSON, fromJSON } from "../src/save.js";
import { msAt } from "../src/clock.js";
import { storyOf } from "../src/story.js";
import { line } from "../tools/pet.mjs";

const PET = new URL("../tools/pet.mjs", import.meta.url).pathname;
const run = (home, tick, ...args) => execFileSync(process.execPath, [PET, ...args], {
  env: { ...process.env, DRIFTWOOD_HOME: home, DRIFTWOOD_NOW: String(msAt(tick) + 1000) }, encoding: "utf8" }).trim();

test("a saved island comes back exactly, and steps on exactly like the real one", () => {
  const s = runTo(12 * DAY + 30), back = fromJSON(toJSON(s));
  assert.equal(fingerprint(back), fingerprint(s));
  for (let k = 0; k < 200; k++) { step(s); step(back); }
  assert.equal(fingerprint(back), fingerprint(s));
  assert.equal(fromJSON(toJSON(s).replace(/"rules":"[^"]*"/, '"rules":"old"')), null, "a save from other rules is thrown away");
});

test("adopt, then the status line: one line about your grazer, from the same island the page shows", () => {
  const home = mkdtempSync(join(tmpdir(), "dw-")), t0 = 10 * DAY + 72;
  const s0 = runTo(t0), me = s0.grazers[0];
  assert.match(run(home, t0, "adopt", String(me.id), "Pebble"), new RegExp(`adopted grazer #${me.id}, Pebble`));
  const t1 = t0 + 30, out = run(home, t1);
  const s1 = runTo(t1);
  assert.equal(out, line({ id: me.id, name: "Pebble" }, s1));
  assert.match(out, /^🐑 Pebble · /);
  assert.equal(fingerprint(fromJSON(readFileSync(join(home, "island.json"), "utf8"))), fingerprint(s1));
});

test("the status line follows the heir when your grazer dies, the same heir the story names", () => {
  const home = mkdtempSync(join(tmpdir(), "dw-")), t0 = 13 * DAY;
  const me = runTo(t0).grazers.reduce((a, b) => (b.age > a.age ? b : a));
  run(home, t0, "adopt", String(me.id), "Pebble");
  const t1 = 17 * DAY, out = run(home, t1);
  const told = storyOf(me.id, "Pebble", t0, t1);
  assert.notEqual(told.id, me.id, "this grazer should have died by day 17 (the test needs one that does)");
  assert.ok(out.startsWith(`🐑 ${told.name} · `), out);
  assert.equal(JSON.parse(readFileSync(join(home, "pet.json"), "utf8")).id, told.id);
});

test("no grazer yet, or a number that isn't alive: a plain answer", () => {
  const home = mkdtempSync(join(tmpdir(), "dw-"));
  assert.match(run(home, 10 * DAY), /no grazer yet/);
  assert.throws(() => run(home, 10 * DAY, "adopt", "999999"), (e) => /There's no grazer #999999/.test(e.stdout) && e.status === 1);
});
