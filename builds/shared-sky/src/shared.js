// Two skies, one question: which stars were above both people?
import { altAz, siderealGreenwich } from "./astro.js";
import { NAMES } from "./names.js";
import { LINES, NAMED, STARS } from "./stars.js";

const RAD = Math.PI / 180;

// The point straight overhead, as a spot on the sky.
export function zenith(date, lat, lon) {
  return { ra: (siderealGreenwich(date) + lon + 360) % 360, dec: lat };
}

export function separation(a, b) { // degrees between two spots on the sky
  const c = Math.sin(a.dec * RAD) * Math.sin(b.dec * RAD) +
    Math.cos(a.dec * RAD) * Math.cos(b.dec * RAD) * Math.cos((a.ra - b.ra) * RAD);
  return Math.acos(Math.max(-1, Math.min(1, c))) / RAD;
}

// a and b: { date, lat, lon }. Each star gets who could see it: "both", "a", "b" or "" (neither).
export function compare(a, b) {
  const up = (p, ra, dec) => altAz(ra, dec, p.date, p.lat, p.lon).alt > 0;
  const who = (ra, dec) => {
    const A = up(a, ra, dec), B = up(b, ra, dec);
    return A && B ? "both" : A ? "a" : B ? "b" : "";
  };
  const stars = STARS.map(([ra, dec, mag]) => ({ ra, dec, mag, who: who(ra, dec) }));
  const visible = stars.filter((s) => s.who);
  const both = stars.filter((s) => s.who === "both");
  const named = Object.entries(NAMED).filter(([, [ra, dec]]) => who(ra, dec) === "both").map(([n]) => n);
  // A constellation is shared when every point of its lines was up for both.
  const constellations = Object.entries(LINES)
    .filter(([, segs]) => segs.flat().every(([ra, dec]) => who(ra, dec) === "both"))
    .map(([abbr]) => NAMES[abbr]);
  return {
    stars,
    shared: both.length,
    share: visible.length ? both.length / visible.length : 0, // of the stars either person could see
    named,
    constellations,
    apart: separation(zenith(a.date, a.lat, a.lon), zenith(b.date, b.lat, b.lon)),
  };
}
