import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { STARS, NAMED, LINES } from "../src/stars.js";

test("about 1,600 stars, brightest first, Sirius at the top", () => {
  assert.ok(STARS.length > 1500 && STARS.length < 1700, `${STARS.length} stars`);
  assert.deepEqual(STARS[0], [101.2872, -16.7161, -1.44]);
  assert.ok(STARS.every((s, i) => i === 0 || STARS[i - 1][2] <= s[2]));
});

test("the famous stars have names, in the right place", () => {
  assert.deepEqual(NAMED.Betelgeuse.slice(0, 2), [88.7929, 7.4071]);
  assert.ok(NAMED.Vega && NAMED.Polaris === undefined, "only stars of magnitude 1.5 or brighter are named");
});

test("Orion and the Big Dipper's bear have their lines", () => {
  assert.ok(LINES.Ori.length > 0 && LINES.UMa.length > 0);
  assert.equal(Object.keys(LINES).length, 88, "the 88 official constellations");
});

test("Serpens keeps both halves of the snake", () => {
  // The catalog lists Serpens twice (head and tail are separate pieces of sky). The head reaches north of +15.
  const decs = LINES.Ser.flat().map((p) => p[1]);
  assert.ok(Math.max(...decs) > 15 && Math.min(...decs) < -10, `Serpens spans ${Math.min(...decs)} to ${Math.max(...decs)}`);
});

test("stars.js is exactly what the maker builds from the catalog", () => {
  const made = execFileSync("python3", ["-c", "import sys; sys.path.insert(0, 'tools'); import make_stars; sys.stdout.write(make_stars.build())"]);
  assert.equal(made.toString(), readFileSync(new URL("../src/stars.js", import.meta.url), "utf8"));
});
