// Drawing the globe: a round planet seen from space, lit by a sun on one side, dark on the other.
// The heavy maths (which patch of the map each pixel shows, how lit it is) is worked out once per view.
// Turning the planet then only slides the map underneath, so it spins smoothly.
import { toXyz } from "./planet.js";
import { BIOMES } from "./climate.js";

const SUN = norm([-0.9, 0.25, 0.38]); // from the upper left, a little in front: a clear night side on the right

function norm(v) { const l = Math.hypot(...v); return v.map((x) => x / l); }
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function makeView(size, tiltDeg = 18) {
  const t = tiltDeg * Math.PI / 180, ct = Math.cos(t), st = Math.sin(t);
  const c = size / 2, R = size / 2 * 0.86;
  const n = size * size;
  const lat = new Float32Array(n), lonBase = new Float32Array(n), day = new Float32Array(n), inside = new Uint8Array(n);
  const glow = new Float32Array(n);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const k = py * size + px;
      const nx = (px + 0.5 - c) / R, ny = -(py + 0.5 - c) / R, r2 = nx * nx + ny * ny;
      if (r2 > 1) {
        // A thin halo of air around the planet, brighter on the sunny side.
        const r = Math.sqrt(r2);
        if (r < 1.1) glow[k] = Math.pow(1 - (r - 1) / 0.1, 2) * (0.35 + 0.65 * smooth(-0.6, 0.8, (nx * SUN[0] + ny * SUN[1]) / r));
        continue;
      }
      const nz = Math.sqrt(1 - r2);
      inside[k] = 1;
      // Tilt toward the viewer, so the north pole leans in a little.
      const bx = nx, by = ny * ct + nz * st, bz = -ny * st + nz * ct;
      lat[k] = Math.asin(Math.max(-1, Math.min(1, by))) * 180 / Math.PI;
      lonBase[k] = Math.atan2(bx, bz) * 180 / Math.PI;
      const sun = nx * SUN[0] + ny * SUN[1] + nz * SUN[2];
      day[k] = smooth(-0.12, 0.18, sun) * (0.35 + 0.65 * Math.max(0, sun)) + 0.0;
      glow[k] = Math.pow(1 - nz, 3) * 0.6; // the air looks thicker toward the edge
    }
  }
  return { size, tiltDeg, c, R, ct, st, lat, lonBase, day, inside, glow };
}

// Which map patch sits under screen pixel (px, py) when longitude `centerLon` faces us? -1 if the pixel misses.
export function pick(view, grid, px, py, centerLon) {
  const k = Math.floor(py) * view.size + Math.floor(px);
  if (px < 0 || py < 0 || px >= view.size || py >= view.size || !view.inside[k]) return -1;
  return cellAt(grid, view.lat[k], view.lonBase[k] + centerLon);
}

export function cellAt(grid, lat, lon) {
  const y = Math.min(grid.h - 1, Math.max(0, Math.floor((90 - lat) / 180 * grid.h)));
  const x = ((Math.floor((lon + 180) / 360 * grid.w) % grid.w) + grid.w) % grid.w;
  return y * grid.w + x;
}

// Where on screen a place is, or null if it's round the back of the planet.
export function project(view, lat, lon, centerLon) {
  const [bx, by, bz] = toXyz(lat, lon - centerLon);
  const ny = by * view.ct - bz * view.st, nz = by * view.st + bz * view.ct;
  if (nz < 0) return null;
  return { x: view.c + bx * view.R, y: view.c - ny * view.R, front: nz };
}

// Paint the planet's flat map: biome colours, shaded hills, rivers and lakes. RGB, 3 bytes per patch.
export function paintMap(planet, climate, rivers) {
  const { grid, elev } = planet;
  const out = new Uint8ClampedArray(grid.n * 3);
  for (let i = 0; i < grid.n; i++) {
    let [r, g, b] = BIOMES[climate.biome[i]].color;
    if (elev[i] < 0 && climate.biome[i] !== "seaice") {
      // Sea fades smoothly from light at the shore to dark in the deeps.
      const t = Math.min(1, -elev[i] / 0.5), s = BIOMES.shallow.color, dp = BIOMES.deep.color;
      r = s[0] + (dp[0] - s[0]) * t; g = s[1] + (dp[1] - s[1]) * t; b = s[2] + (dp[2] - s[2]) * t;
    } else {
      // Light the slopes that face north-west, shade the others, so mountains stand up.
      const x = i % grid.w, y = (i - x) / grid.w;
      const nw = elev[grid.index(x - 1, Math.max(0, y - 1))];
      const s = 1 + Math.max(-0.35, Math.min(0.35, (elev[i] - nw) * 6));
      r *= s; g *= s; b *= s;
      if (rivers && (rivers.river[i] || rivers.lake[i])) { r = 44; g = 98; b = 160; }
    }
    out[i * 3] = r; out[i * 3 + 1] = g; out[i * 3 + 2] = b;
  }
  return out;
}

// Draw one frame into an RGBA buffer. `lights` (0..1 per patch) glow only where it's night.
export function render(view, grid, map, lights, centerLon, out) {
  const { size, lat, lonBase, day, inside, glow } = view;
  const { w, h } = grid;
  for (let k = 0; k < size * size; k++) {
    const o = k * 4;
    if (!inside[k]) {
      const a = glow[k];
      out[o] = 110; out[o + 1] = 170; out[o + 2] = 255; out[o + 3] = a * 200;
      continue;
    }
    // Blend the four nearest map patches, so coastlines are smooth instead of blocky squares.
    const fy = Math.max(0, Math.min(h - 1.001, (90 - lat[k]) / 180 * h - 0.5));
    let fx = (lonBase[k] + centerLon + 180) / 360 * w - 0.5;
    fx -= Math.floor(fx / w) * w;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const x1 = (x0 + 1) % w, y1 = y0 + 1;
    const i00 = y0 * w + x0, i10 = y0 * w + x1, i01 = y1 * w + x0, i11 = y1 * w + x1;
    const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
    const d = day[k], night = 1 - smooth(0, 0.25, d);
    const lit = lights ? (lights[i00] * w00 + lights[i10] * w10 + lights[i01] * w01 + lights[i11] * w11) * night : 0;
    const a = glow[k];
    const ch = (c) => map[i00 * 3 + c] * w00 + map[i10 * 3 + c] * w10 + map[i01 * 3 + c] * w01 + map[i11 * 3 + c] * w11;
    out[o] = ch(0) * (0.03 + d) + lit * 255 + a * 60;
    out[o + 1] = ch(1) * (0.04 + d) + lit * 196 + a * 100;
    out[o + 2] = ch(2) * (0.07 + d) + lit * 110 + a * 160;
    out[o + 3] = 255;
  }
  return out;
}

export { SUN };
