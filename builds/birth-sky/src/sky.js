// Everything to draw for one moment and place, on a circle of radius 1 (see project.js).
import { altAz } from "./astro.js";
import { moon } from "./moon.js";
import { project } from "./project.js";
import { LINES, NAMED, STARS } from "./stars.js";

export function skyAt(date, lat, lon) {
  const place = (ra, dec) => {
    const { alt, az } = altAz(ra, dec, date, lat, lon);
    return project(alt, az, 1);
  };
  const stars = [];
  for (const [ra, dec, mag] of STARS) {
    const p = place(ra, dec);
    if (p) stars.push({ ...p, mag });
  }
  const lines = [];
  for (const segments of Object.values(LINES)) {
    for (const seg of segments) {
      for (let i = 1; i < seg.length; i++) {
        const a = place(...seg[i - 1]);
        const b = place(...seg[i]);
        if (a && b) lines.push([a, b]); // only lines with both ends above the horizon
      }
    }
  }
  const named = [];
  for (const [name, [ra, dec]] of Object.entries(NAMED)) {
    const p = place(ra, dec);
    if (p) named.push({ name, ...p });
  }
  const m = moon(date);
  const mp = place(m.ra, m.dec);
  return { stars, lines, named, moon: mp ? { ...mp, lit: m.lit, waxing: m.waxing } : null };
}
