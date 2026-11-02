import { test } from "node:test";
import assert from "node:assert/strict";
import { makeIsland, around, W, H, SEA, SAND, SOIL, ROCK } from "../src/island.js";

const isl = makeIsland();
const count = (t) => isl.tile.filter((v) => v === t).length;

test("the island is the same every time it's made", () => {
  assert.deepEqual(makeIsland().tile, isl.tile);
});

test("it's one island: every land tile reaches every other by land", () => {
  const land = [...isl.tile.keys()].filter((i) => isl.tile[i] !== SEA);
  const seen = new Set([land[0]]), stack = [land[0]];
  while (stack.length) for (const j of around(stack.pop())) if (isl.tile[j] !== SEA && !seen.has(j)) { seen.add(j); stack.push(j); }
  assert.equal(seen.size, land.length);
});

test("a decent size, with sea all round the edge of the map", () => {
  const land = W * H - count(SEA);
  assert.ok(land > W * H * 0.25 && land < W * H * 0.6, `${land} land tiles`);
  for (let x = 0; x < W; x++) { assert.equal(isl.tile[x], SEA); assert.equal(isl.tile[(H - 1) * W + x], SEA); }
  for (let y = 0; y < H; y++) { assert.equal(isl.tile[y * W], SEA); assert.equal(isl.tile[y * W + W - 1], SEA); }
});

test("sand is exactly the land that touches the sea", () => {
  for (let i = 0; i < W * H; i++) {
    if (isl.tile[i] === SEA) continue;
    assert.equal(isl.tile[i] === SAND, around(i).some((j) => isl.tile[j] === SEA));
  }
});

test("mostly soil, a little rock, and only soil can grow things", () => {
  assert.ok(count(SOIL) > count(SAND) && count(ROCK) > 0 && count(ROCK) < count(SOIL) / 5, `${count(SOIL)} soil, ${count(ROCK)} rock`);
  for (let i = 0; i < W * H; i++) {
    if (isl.tile[i] === SOIL) assert.ok(isl.fertile[i] >= 0.55 && isl.fertile[i] <= 1);
    else assert.equal(isl.fertile[i], 0);
  }
});
