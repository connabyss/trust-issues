// The island: a fixed shape of sea, sand, soil and rock. It never changes, so it's made once from a fixed seed.
import { seedFrom, makeRng } from "./rng.js";
import { makeNoise } from "./noise.js";

export const W = 72, H = 44;
export const SEA = 0, SAND = 1, SOIL = 2, ROCK = 3;
export const SEED = seedFrom("trust-issues island");

export const idx = (x, y) => y * W + x;
// The 4 tiles that share an edge with i (none past the map edge, which is all sea anyway).
export function around(i) {
  const x = i % W, y = (i - x) / W, out = [];
  if (x > 0) out.push(i - 1);
  if (x < W - 1) out.push(i + 1);
  if (y > 0) out.push(i - W);
  if (y < H - 1) out.push(i + W);
  return out;
}

export function makeIsland() {
  const noise = makeNoise(SEED), rng = makeRng(SEED);
  const ox = rng.range(0, 100), oy = rng.range(0, 100);
  const height = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // A round-ish hump, roughened by noise, sinking toward the edges of the map.
      const dx = (x - W / 2) / (W * 0.42), dy = (y - H / 2) / (H * 0.42);
      const fall = 1 - Math.sqrt(dx * dx + dy * dy);
      height[idx(x, y)] = fall + 0.75 * noise.fbm(x / 11 + ox, y / 11 + oy, 0.5, 5);
    }
  }
  const tile = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) tile[i] = height[i] > 0.2 ? SOIL : SEA;
  // Keep only the biggest piece of land: one island, no stray islets.
  const comp = new Int32Array(W * H).fill(-1), sizes = [];
  for (let i = 0; i < W * H; i++) {
    if (tile[i] === SEA || comp[i] >= 0) continue;
    const id = sizes.length, stack = [i];
    comp[i] = id;
    let n = 0;
    while (stack.length) {
      const j = stack.pop();
      n++;
      for (const k of around(j)) if (tile[k] !== SEA && comp[k] < 0) { comp[k] = id; stack.push(k); }
    }
    sizes.push(n);
  }
  const main = sizes.indexOf(Math.max(...sizes));
  for (let i = 0; i < W * H; i++) if (tile[i] !== SEA && comp[i] !== main) tile[i] = SEA;
  // Beaches where land meets sea, bare rock on the highest ground.
  const fertile = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (tile[i] === SEA) continue;
    if (around(i).some((j) => tile[j] === SEA)) tile[i] = SAND;
    else if (height[i] > 0.7 && noise.noise3((i % W) / 4, Math.floor(i / W) / 4, 3.3) > 0.28) tile[i] = ROCK; // rocky outcrops on the high ground
    else fertile[i] = 0.55 + 0.45 * (0.5 + 0.5 * noise.noise3(i % W / 6, Math.floor(i / W) / 6, 9.1));
  }
  return { tile, height, fertile };
}
