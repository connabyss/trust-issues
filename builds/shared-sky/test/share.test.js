import test from "node:test";
import assert from "node:assert/strict";
import { fromHash, toHash } from "../src/share.js";

const sam = { name: "Sam", year: 1990, month: 5, day: 17, hour: 23, minute: 30, city: "New York" };
const zoe = { name: "Zoë", year: 1992, month: 11, day: 3, hour: 6, minute: 15, city: "São Paulo" };

test("two people make one link, and come back out of it", () => {
  const h = toHash(sam, zoe);
  assert.ok(h.startsWith("#Sam~1990-05-17T23:30@New-York+"), h);
  assert.deepEqual(fromHash(h), [sam, zoe]);
});

test("names are optional, and anything that isn't a name is dropped", () => {
  assert.equal(fromHash(toHash({ ...sam, name: "" }, zoe))[0].name, "");
  assert.equal(fromHash(toHash({ ...sam, name: "<b>Sam</b>" }, zoe))[0].name, "bSamb");
});

test("a broken link gives nothing instead of the wrong sky", () => {
  assert.equal(fromHash("#hello"), null);
  assert.equal(fromHash(toHash(sam, zoe).replace("New-York", "Atlantis")), null);
  assert.equal(fromHash(toHash(sam, zoe).split("+")[0]), null);
  assert.equal(fromHash("#Sam~1990-05-17T23:30@New-York+%E0%A4%A~1990-05-17T23:30@London")[1].name, "");
});
