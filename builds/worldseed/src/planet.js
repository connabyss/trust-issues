// The planet: a globe cut into a grid of patches (like a world map), each with a height.
// Height 0 is the shoreline: below 0 is sea, above 0 is land.
import { seedFrom, makeRng } from "./rng.js";
import { makeNoise } from "./noise.js";

export const OCEAN_SHARE = 0.6;

// A grid of w x h patches. Row 0 is the north, column 0 starts at longitude -180.
export function makeGrid(w, h) {
  const n = w * h;
  const lat = new Float32Array(n), lon = new Float32Array(n), area = new Float32Array(n);
  const xyz = new Float32Array(n * 3);
  for (let y = 0; y < h; y++) {
    const la = 90 - (y + 0.5) * 180 / h;
    for (let x = 0; x < w; x++) {
      const lo = -180 + (x + 0.5) * 360 / w;
      const i = y * w + x;
      lat[i] = la; lon[i] = lo;
      area[i] = Math.cos(la * Math.PI / 180); // patches near the poles cover less ground
      const [px, py, pz] = toXyz(la, lo);
      xyz[i * 3] = px; xyz[i * 3 + 1] = py; xyz[i * 3 + 2] = pz;
    }
  }
  // The 8 patches around i. East and west wrap round the globe; north and south stop at the poles.
  function neighbors(i) {
    const x = i % w, y = (i - x) / w, out = [];
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        out.push(yy * w + ((x + dx + w) % w));
      }
    }
    return out;
  }
  return { w, h, n, lat, lon, area, xyz, neighbors, index: (x, y) => y * w + ((x % w) + w) % w };
}

// Latitude and longitude (degrees) to a point on the unit sphere. y points to the north pole.
export function toXyz(latDeg, lonDeg) {
  const la = latDeg * Math.PI / 180, lo = lonDeg * Math.PI / 180;
  return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
}

// Great-circle distance between two patches, in degrees of arc.
export function arc(grid, i, j) {
  const a = grid.xyz, d = a[i * 3] * a[j * 3] + a[i * 3 + 1] * a[j * 3 + 1] + a[i * 3 + 2] * a[j * 3 + 2];
  return Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI;
}

// The height below which `share` of the planet's surface lies, counting each patch by the ground it covers.
export function levelFor(heights, area, share) {
  const order = Array.from(heights.keys()).sort((a, b) => heights[a] - heights[b]);
  const total = area.reduce((s, v) => s + v, 0);
  let acc = 0;
  for (const i of order) {
    acc += area[i];
    if (acc >= total * share) return heights[i];
  }
  return heights[order[order.length - 1]];
}

export function makePlanet(word, { w = 320, h = 160 } = {}) {
  const seed = seedFrom(word);
  const grid = makeGrid(w, h);
  const noise = makeNoise(seed);
  const rng = makeRng(seed ^ 0x9e3779b9);
  // Each planet gets its own scale and roughness, so worlds look different, not just shuffled.
  const scale = rng.range(1.2, 2.2), rough = rng.range(0.35, 0.65);
  const ox = rng.range(-50, 50), oy = rng.range(-50, 50), oz = rng.range(-50, 50);
  const raw = new Float32Array(grid.n);
  for (let i = 0; i < grid.n; i++) {
    const x = grid.xyz[i * 3] * scale + ox, y = grid.xyz[i * 3 + 1] * scale + oy, z = grid.xyz[i * 3 + 2] * scale + oz;
    const base = noise.fbm(x, y, z, 6);
    const ridge = 1 - Math.abs(noise.noise3(x * 2.3 + 11, y * 2.3, z * 2.3)); // sharp ridges for mountain ranges
    raw[i] = base + rough * Math.max(0, base) * ridge * ridge;
  }
  const sea = levelFor(raw, grid.area, OCEAN_SHARE);
  let top = 0, bottom = 0;
  for (let i = 0; i < grid.n; i++) {
    raw[i] -= sea;
    top = Math.max(top, raw[i]);
    bottom = Math.min(bottom, raw[i]);
  }
  // Scale so the highest peak is 1 and the deepest sea is -1, keeping the shoreline at 0.
  const elev = new Float32Array(grid.n);
  for (let i = 0; i < grid.n; i++) elev[i] = raw[i] >= 0 ? raw[i] / top : -raw[i] / bottom;
  return { word: String(word), seed, grid, elev };
}

// Share of the surface (by ground, not patches) that is under water.
export function oceanShare(planet) {
  const { grid, elev } = planet;
  let wet = 0, all = 0;
  for (let i = 0; i < grid.n; i++) {
    all += grid.area[i];
    if (elev[i] < 0) wet += grid.area[i];
  }
  return wet / all;
}
