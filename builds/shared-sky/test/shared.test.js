import test from "node:test";
import assert from "node:assert/strict";
import { compare, separation, zenith } from "../src/shared.js";
import { NAMES } from "../src/names.js";
import { LINES } from "../src/stars.js";
import { localToDate } from "../src/when.js";

const at = (y, m, d, h, tz, lat, lon) => ({ date: localToDate(y, m, d, h, 0, tz), lat, lon });
const nyc = at(1990, 1, 1, 0, "America/New_York", 40.71, -74.01);

test("every constellation has a name", () => {
  assert.equal(Object.keys(NAMES).length, 88);
  for (const abbr of Object.keys(LINES)) assert.ok(NAMES[abbr], abbr);
});

test("two people born at the same moment in the same place share the whole sky", () => {
  const r = compare(nyc, nyc);
  assert.equal(r.share, 1);
  assert.ok(r.constellations.includes("Orion"));
  assert.ok(r.apart < 1e-6);
});

test("people on opposite sides of the Earth at the same moment share almost nothing", () => {
  const madrid = { date: new Date("2026-01-01T00:00Z"), lat: 40.42, lon: -3.70 };
  const opposite = { date: madrid.date, lat: -40.42, lon: 176.30 }; // near Wellington
  const r = compare(madrid, opposite);
  assert.ok(r.apart > 179, `${r.apart}`);
  assert.ok(r.share < 0.02, `${r.share}`);
  assert.deepEqual(r.constellations, []);
});

test("New Year's midnight in New York and in Sydney: both saw Sirius, only New York saw the North Star's neighbours", () => {
  const sydney = at(1990, 1, 1, 0, "Australia/Sydney", -33.87, 151.21);
  const r = compare(nyc, sydney);
  assert.ok(r.named.includes("Sirius"));
  assert.ok(r.constellations.includes("Orion"));
  assert.ok(!r.constellations.includes("Ursa Minor"));
  assert.ok(r.share > 0.2 && r.share < 0.8, `${r.share}`);
});

test("the spot overhead is at your latitude", () => {
  assert.equal(zenith(new Date(), 51.5, 0).dec, 51.5);
  assert.ok(Math.abs(separation({ ra: 0, dec: 0 }, { ra: 90, dec: 0 }) - 90) < 1e-9);
});
