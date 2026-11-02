// Prowlers: the island's hunters (shift 3). The pure parts live here so they can be tested on their own.
// A prowler's genes: size (bigger catches more often, burns more), legs (faster), night (when it hunts).

const clamp = (v) => Math.max(0, Math.min(1, v));

// How light a coat or the ground is, 0 (black) to 1 (white).
export const coatLight = (coat) => 0.95 - 0.8 * clamp(coat);
export const GROUND_LIGHT = { sand: 0.8, soil: 0.42, grass: 0.4, rock: 0.5 };

// How well a grazer blends in, 0 (stands out) to 1 (invisible): a coat close to the ground's lightness, and in the
// dark a dark coat, hide it.
export function camouflage(coat, groundLight, dark) {
  const day = clamp(1 - 2 * Math.abs(coatLight(coat) - groundLight));
  return dark ? Math.max(day, clamp(1 - coatLight(coat))) : day;
}

// How far (in tiles) a prowler spots a grazer: up to 7 tiles in daylight, 4 in the dark, less the better it hides.
// A prowler with night eyes (high night gene) loses less in the dark.
export function sightRange(camo, dark, night) {
  const base = dark ? 4 + 3 * clamp(night) : 7;
  return base * (1 - 0.75 * clamp(camo));
}

// The chance a prowler on the grazer's tile catches it: bigger and faster prowlers do better, long-legged grazers
// get away more, and every other grazer within one tile spreads the risk.
export function catchChance(p, z, neighbours) {
  const c = 0.55 + 0.35 * p.size + 0.3 * p.legs - 0.45 * z.legs - 0.15 * z.size;
  return clamp(c) / (1 + 0.15 * neighbours);
}

// When a prowler is up: low night hunts by day, high night by night, the middle at dawn and dusk too.
export const prowlerAwake = (g, alt) => (alt > -3 ? g.night < 0.7 : g.night > 0.35);
