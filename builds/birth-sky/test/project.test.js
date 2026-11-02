import test from "node:test";
import assert from "node:assert/strict";
import { project } from "../src/project.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

test("straight overhead is the middle", () => {
  const p = project(90, 123, 100);
  near(p.x, 0); near(p.y, 0);
});

test("the horizon is the edge: north at the top, east on the left", () => {
  const n = project(0, 0, 100);
  near(n.x, 0); near(n.y, -100);
  const e = project(0, 90, 100);
  near(e.x, -100); near(e.y, 0);
});

test("stars below the horizon aren't drawn", () => {
  assert.equal(project(-5, 0, 100), null);
});

test("halfway up the sky is closer to the middle than to the edge (stereographic)", () => {
  const p = project(45, 180, 100);
  assert.ok(p.y > 0 && p.y < 50, `y = ${p.y}`);
});
