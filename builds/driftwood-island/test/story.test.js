// Shift 4: the island remembers families and deaths (without changing anything), and tells one grazer's story.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY, runTo, step, fingerprint } from "../src/sim.js";
import { storyOf, familyOf, heirOf, nextName, summary } from "../src/story.js";

test("grazers born on the island know their mother, and every death says how it happened", () => {
  const s = runTo(12 * DAY);
  const born = s.grazers.filter((z) => z.born > 2 * DAY + 48 && z.age < 20 * DAY);
  assert.ok(born.length > 50 && born.every((z) => typeof z.mom === "number"));
  const why = new Set();
  for (let k = 0; k < 6 * DAY; k++) { step(s); for (const d of s.died) why.add(d.why); }
  assert.ok(why.has("caught") && why.has("starved"), [...why].join());
  assert.ok([...why].every((w) => ["caught", "starved", "old age"].includes(w)));
});

test("remembering changes nothing: the island's fingerprints are the same as before", () => {
  // Same values as the pins in past.test.js and evolution.test.js, plus one in the prowler era.
  assert.equal(fingerprint(runTo(5 * DAY + 72)), "0faf6f54");
  assert.equal(fingerprint(runTo(9 * DAY + 72)), "5aa24d0c");
});

test("a grazer's story: babies, running from prowlers, its death, and an heir who carries on", () => {
  const from = 13 * DAY, s = runTo(from);
  // An adult who'll have young: the oldest grazer alive.
  const me = s.grazers.reduce((a, b) => (b.age > a.age ? b : a));
  const story = storyOf(me.id, "Pebble", from, 25 * DAY, { start: s });
  const text = story.events.map((e) => e.text).join("\n");
  assert.match(text, /Pebble (had a baby|ran from a prowler|was caught|starved|died of old age)/);
  assert.ok(story.events.every((e) => e.tick > from && e.tick <= 25 * DAY));
  assert.ok(story.events.every((e, k) => !k || e.tick >= story.events[k - 1].tick), "events are in order");
  if (story.id !== me.id) {
    assert.match(text, /carries on as Pebble II/);
    assert.equal(story.name.startsWith("Pebble "), true);
  }
});

test("the story doesn't change the island", () => {
  const a = runTo(14 * DAY);
  const me = a.grazers[0];
  const told = storyOf(me.id, "X", 14 * DAY, 16 * DAY, { start: runTo(14 * DAY) });
  assert.equal(fingerprint(told.state), fingerprint(runTo(16 * DAY)));
});

test("heirs: the oldest living child first, else the oldest living relative, else nobody", () => {
  const s = { grazers: [
    { id: 2, mom: 1, born: 50 }, { id: 3, mom: 1, born: 40 }, { id: 4, mom: 2, born: 30 }, { id: 9, mom: 7, born: 1 },
  ] };
  const fam = familyOf(s, 1);
  assert.deepEqual([...fam].sort(), [2, 3, 4]);
  assert.equal(heirOf(s, 1, fam).id, 3);
  assert.equal(heirOf({ grazers: [{ id: 4, mom: 2, born: 30 }] }, 1, new Set([2, 4])).id, 4);
  assert.equal(heirOf({ grazers: [] }, 1, new Set()), null);
  assert.equal(nextName("Pebble", 2), "Pebble II");
  assert.equal(nextName("Pebble II", 3), "Pebble III");
});

test("a grazer that isn't alive gets a plain answer, not a made-up story", () => {
  const story = storyOf(99999, "Ghost", 14 * DAY, 15 * DAY);
  assert.equal(story.alive, false);
  assert.match(story.events[0].text, /isn't alive/);
});

test("the short version: one line per life, counts that add up, and where things stand now", () => {
  const events = [
    { what: "baby", text: "", when: "a" }, { what: "baby", text: "", when: "b" }, { what: "ran", text: "", when: "c" },
    { what: "death", text: "Pebble was caught by a prowler.", when: "Day 15" },
    { what: "heir", text: "Its oldest child, #9, carries on as Pebble II.", when: "Day 15" },
    { what: "ran", text: "", when: "d" }, { what: "ran", text: "", when: "e" },
  ];
  assert.deepEqual(summary({ events, alive: true, name: "Pebble II" }), [
    { when: "Day 15", text: "Pebble had 2 babies and ran from prowlers once, then was caught by a prowler." },
    { when: "Day 15", text: "Its oldest child, #9, carries on as Pebble II." },
    { when: "now", text: "Pebble II ran from prowlers twice, and is alive." },
  ]);
  assert.deepEqual(summary({ events: [], alive: true, name: "Moss" }), [{ when: "now", text: "Moss is alive and well." }]);
});
