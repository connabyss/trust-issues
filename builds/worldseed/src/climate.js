// Climate: how hot and how wet each patch is, and the biome that follows from both.
import { makeNoise } from "./noise.js";

// food: how many people a patch can feed (0 = nobody can live here).
export const BIOMES = {
  deep:      { name: "deep ocean",   color: [18, 42, 92],    food: 0, sea: true },
  shallow:   { name: "shallow sea",  color: [34, 84, 140],   food: 0, sea: true },
  seaice:    { name: "sea ice",      color: [214, 228, 238], food: 0, sea: true },
  ice:       { name: "ice sheet",    color: [236, 242, 248], food: 0 },
  tundra:    { name: "tundra",       color: [150, 156, 132], food: 0.15 },
  taiga:     { name: "pine forest",  color: [52, 92, 66],    food: 0.35 },
  grassland: { name: "grassland",    color: [128, 168, 80],  food: 1 },
  forest:    { name: "forest",       color: [56, 122, 58],   food: 0.75 },
  jungle:    { name: "jungle",       color: [28, 104, 46],   food: 0.6 },
  savanna:   { name: "savanna",      color: [176, 170, 92],  food: 0.7 },
  desert:    { name: "desert",       color: [214, 190, 130], food: 0.05 },
  mountain:  { name: "mountains",    color: [118, 104, 92],  food: 0.1 },
  snowpeak:  { name: "snowy peaks",  color: [240, 240, 244], food: 0 },
};

// Distance from every land patch to the nearest sea, in degrees of arc (a flood outward from every shore).
export function distanceToSea(planet) {
  const { grid, elev } = planet;
  const dist = new Float32Array(grid.n).fill(Infinity);
  const queue = [];
  for (let i = 0; i < grid.n; i++) if (elev[i] < 0) { dist[i] = 0; queue.push(i); }
  const step = 180 / grid.h;
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    for (const j of grid.neighbors(i)) {
      if (dist[j] === Infinity) { dist[j] = dist[i] + step; queue.push(j); }
    }
  }
  return dist;
}

export function biomeOf(tempC, moist, elev) {
  if (elev < 0) return tempC < -6 ? "seaice" : elev < -0.25 ? "deep" : "shallow";
  if (elev > 0.82 || (elev > 0.6 && tempC < -2)) return "snowpeak";
  if (elev > 0.6) return "mountain";
  if (tempC < -12) return "ice";
  if (tempC < -2) return "tundra";
  if (tempC < 6) return moist > 0.3 ? "taiga" : "tundra";
  if (moist < 0.22) return tempC > 14 ? "desert" : "grassland";
  if (tempC > 22) return moist > 0.55 ? "jungle" : moist > 0.35 ? "savanna" : "desert";
  return moist > 0.5 ? "forest" : "grassland";
}

export function makeClimate(planet) {
  const { grid, elev, seed } = planet;
  const noise = makeNoise(seed ^ 0x5bd1e995);
  const sea = distanceToSea(planet);
  const temp = new Float32Array(grid.n), moist = new Float32Array(grid.n);
  const biome = new Array(grid.n);
  for (let i = 0; i < grid.n; i++) {
    const x = grid.xyz[i * 3] * 3, y = grid.xyz[i * 3 + 1] * 3, z = grid.xyz[i * 3 + 2] * 3;
    const a = Math.abs(grid.lat[i]) / 90;
    // Hot at the equator, freezing at the poles, colder the higher you climb.
    temp[i] = 30 - 58 * Math.pow(a, 1.35) - 34 * Math.max(0, elev[i]) + 4 * noise.noise3(x, y, z);
    // Wet near the sea, dry far inland, with a dry belt near 25 degrees where the world's big deserts sit.
    const coast = Math.exp(-sea[i] / 14);
    const belt = 1 - 0.55 * Math.exp(-(((Math.abs(grid.lat[i]) - 25) / 9) ** 2));
    const wobble = 0.5 + 0.5 * noise.fbm(x + 40, y, z, 3);
    moist[i] = Math.max(0, Math.min(1, (0.65 * coast + 0.45 * wobble) * belt));
    biome[i] = biomeOf(temp[i], moist[i], elev[i]);
  }
  return { temp, moist, biome, seaDist: sea };
}
