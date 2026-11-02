import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makePlanet } from "../src/planet.js";

test("the real planet is fine enough to look sharp: at least 300 patches round the equator", () => {
  const p = makePlanet("detail");
  assert.ok(p.grid.w >= 300 && p.grid.h === p.grid.w / 2, `${p.grid.w} x ${p.grid.h}`);
});

test("the snapshot tool writes a picture: a planet in the middle, dark space in the corners", () => {
  const out = join(mkdtempSync(join(tmpdir(), "ws-")), "s.ppm");
  execFileSync(process.execPath, ["tools/snapshot.mjs", "snapshot", out, "0", "120"]);
  const buf = readFileSync(out);
  const head = "P6 120 120 255\n";
  assert.equal(buf.subarray(0, head.length).toString(), head);
  const px = (x, y) => { const o = head.length + (y * 120 + x) * 3; return buf[o] + buf[o + 1] + buf[o + 2]; };
  assert.ok(px(0, 0) < 30, "corner should be space");
  assert.ok(px(40, 60) > px(0, 0) + 50, `the sunny middle-left should show the planet (${px(40, 60)})`);
});
