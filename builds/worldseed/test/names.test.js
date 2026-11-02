import { test } from "node:test";
import assert from "node:assert/strict";
import { makeLanguage, pronounceable } from "../src/names.js";

test("the same seed speaks the same language", () => {
  const a = makeLanguage(5), b = makeLanguage(5);
  assert.equal(a.people, b.people);
  for (let i = 0; i < 20; i++) assert.equal(a.city(), b.city());
});

test("names can be said out loud: no three vowels or three consonants in a row, sensible length", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const lang = makeLanguage(seed);
    for (let i = 0; i < 30; i++) {
      for (const name of [lang.city(), lang.ruler(), lang.place()]) {
        assert.ok(pronounceable(name.replace(/ \d+$/, "")), `${name} (seed ${seed})`);
        assert.match(name, /^[A-Z][a-z]+( \d+)?$/);
        assert.ok(name.replace(/ \d+$/, "").length >= 3 && name.length <= 18, name);
      }
    }
  }
  assert.equal(pronounceable("Strkla"), false);
  assert.equal(pronounceable("Aeiou"), false);
  assert.equal(pronounceable("Thalor"), true);
});

test("a language never names two cities the same", () => {
  const lang = makeLanguage(77), seen = new Set();
  for (let i = 0; i < 300; i++) {
    const c = lang.city();
    assert.ok(!seen.has(c), `${c} twice`);
    seen.add(c);
  }
});

test("different peoples sound different: their letters don't match", () => {
  const letters = (seed) => {
    const lang = makeLanguage(seed), count = {};
    for (let i = 0; i < 60; i++) for (const ch of lang.city().toLowerCase()) count[ch] = (count[ch] || 0) + 1;
    return count;
  };
  const a = letters(1), b = letters(2);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let shared = 0, total = 0;
  for (const k of keys) { shared += Math.min(a[k] || 0, b[k] || 0); total += Math.max(a[k] || 0, b[k] || 0); }
  assert.ok(shared / total < 0.6, `letter overlap ${shared / total}`);
});

test("a people has a proper name of its own", () => {
  const lang = makeLanguage(9);
  assert.match(lang.people, /^[A-Z][a-z]{2,}$/);
});

test("a language has enough words for 40 cities without falling back to numbered names", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const lang = makeLanguage(seed);
    for (let i = 0; i < 40; i++) {
      const c = lang.city();
      assert.ok(!/ \d+$/.test(c), `${c} (seed ${seed}, city ${i + 1})`);
    }
  }
});
