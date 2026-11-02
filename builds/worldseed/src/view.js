// What the page shows for a given year: the painted map with borders, the lights at night, and the share link.
import { paintMap } from "./globe.js";
import { YEARS } from "./world.js";

// The map for one year: land and sea, each people's land tinted its colour, and a bright line along its borders.
export function paintYear(world, year, cache = new Map()) {
  const v = world.terrainAt(year);
  if (!cache.has(v)) cache.set(v, paintMap({ ...world.planet, elev: v.elev }, { ...world.climate, biome: v.biome }, world.rivers));
  const base = cache.get(v), out = Uint8ClampedArray.from(base);
  const owner = world.ownerAt(year), grid = world.planet.grid;
  for (let i = 0; i < grid.n; i++) {
    const p = owner[i];
    if (p < 0) continue;
    const col = world.peoples[p].color;
    const edge = grid.neighbors(i).some((j) => owner[j] !== p && v.elev[j] >= 0);
    const t = edge ? 0.75 : 0.28;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = base[i * 3 + c] * (1 - t) + col[c] * t;
  }
  return out;
}

// How bright the night is: city lights grow with the city and with the age of the world. 0..1 per patch.
export function lightsAt(world, year) {
  const grid = world.planet.grid, lights = new Float32Array(grid.n);
  const era = Math.min(1, 0.25 + year / 4000);
  const owner = world.ownerAt(year);
  for (let i = 0; i < grid.n; i++) if (owner[i] >= 0) lights[i] = 0.06 * era; // farms and villages: a faint haze
  for (const c of world.citiesAt(year)) {
    const glow = Math.min(1, 0.35 + c.pop) * era;
    const x0 = c.cell % grid.w, y0 = (c.cell - x0) / grid.w;
    const r = 1 + Math.round(2 * Math.min(1, c.pop));
    for (let dy = -r; dy <= r; dy++) {
      const y = y0 + dy;
      if (y < 0 || y >= grid.h) continue;
      for (let dx = -r; dx <= r; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > r + 0.5) continue;
        const i = grid.index(x0 + dx, y);
        lights[i] = Math.min(1, lights[i] + glow * Math.max(0.15, 1 - d / (r + 0.5)));
      }
    }
  }
  return lights;
}

// The share link: the word, plus any meteors dropped (year.patch). "#connor~2000.12345"
export function encodeHash(word, meteors = []) {
  return "#" + encodeURIComponent(word.trim()) + meteors.map((m) => `~${m.year}.${m.cell}`).join("");
}

export function decodeHash(hash, cells = Infinity) {
  const [w, ...rest] = String(hash).replace(/^#/, "").split("~");
  let word = "";
  try { word = decodeURIComponent(w); } catch { word = w; }
  const meteors = [];
  for (const r of rest) {
    const m = /^(\d+)\.(\d+)$/.exec(r);
    if (!m) continue;
    const year = Number(m[1]), cell = Number(m[2]);
    if (year > 0 && year <= YEARS && cell < cells) meteors.push({ year, cell });
  }
  return { word: word.trim(), meteors };
}

export function yearLabel(y) {
  return "Year " + Math.round(y).toLocaleString("en-US");
}
