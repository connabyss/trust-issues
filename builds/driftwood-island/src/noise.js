// Smooth 3D noise, seeded. Sampling it on a sphere gives continents with no seam at the date line.
import { makeRng } from "./rng.js";

const GRAD = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1],
  [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

// Classic gradient ("Perlin") noise with a permutation shuffled by the seed. Values roughly in [-1, 1].
export function makeNoise(seed) {
  const rng = makeRng(seed);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = rng.int(i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const dot = (h, x, y, z) => {
    const g = GRAD[h % 12];
    return g[0] * x + g[1] * y + g[2] * z;
  };

  function noise3(x, y, z) {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    x -= X; y -= Y; z -= Z;
    const xi = X & 255, yi = Y & 255, zi = Z & 255;
    const u = fade(x), v = fade(y), w = fade(z);
    const A = perm[xi] + yi, AA = perm[A] + zi, AB = perm[A + 1] + zi;
    const B = perm[xi + 1] + yi, BA = perm[B] + zi, BB = perm[B + 1] + zi;
    return lerp(
      lerp(lerp(dot(perm[AA], x, y, z), dot(perm[BA], x - 1, y, z), u),
        lerp(dot(perm[AB], x, y - 1, z), dot(perm[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(dot(perm[AA + 1], x, y, z - 1), dot(perm[BA + 1], x - 1, y, z - 1), u),
        lerp(dot(perm[AB + 1], x, y - 1, z - 1), dot(perm[BB + 1], x - 1, y - 1, z - 1), u), v),
      w);
  }

  // Layers of noise, each finer and fainter: big continents, then coastlines, then hills.
  function fbm(x, y, z, octaves = 5) {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise3(x * freq, y * freq, z * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  }

  return { noise3, fbm };
}
