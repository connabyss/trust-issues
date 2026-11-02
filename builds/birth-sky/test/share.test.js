import test from "node:test";
import assert from "node:assert/strict";
import { fromHash, toHash } from "../src/share.js";

const when = { year: 1990, month: 5, day: 17, hour: 23, minute: 30, city: "New York" };

test("a moment and a city make a short link, and come back out of it", () => {
  assert.equal(toHash(when), "#1990-05-17T23:30@New-York");
  assert.deepEqual(fromHash(toHash(when)), when);
});

test("cities with accents survive the trip", () => {
  assert.equal(fromHash(toHash({ ...when, city: "São Paulo" })).city, "São Paulo");
});

test("a broken or unknown link gives nothing instead of a wrong sky", () => {
  assert.equal(fromHash("#hello"), null);
  assert.equal(fromHash("#1990-05-17T23:30@Atlantis"), null);
  assert.equal(fromHash("#1990-13-17T23:30@New-York"), null);
  assert.equal(fromHash(""), null);
});
