// Genes: four numbers from 0 to 1 that every grazer carries once evolution starts, and passes to its young
// with small random changes.
//   size   big ones take bigger bites, burn more energy and overheat in the sun, but keep warm at night
//   legs   long legs search further for grass when the ground nearby is bare, and cost energy to carry
//   coat   pale to dark: dark coats soak up the sun (hot by day, warm at night), pale ones the opposite
//   night  waking hours: low sleeps at night, high sleeps by day, in between is awake at dawn and dusk too
export const GENES = ["size", "legs", "coat", "night"];

const clamp = (v) => Math.max(0, Math.min(1, v));
// A roughly bell-shaped random number around 0 (the sum of three dice), so most changes are small.
const wobble = (rng) => (rng() + rng() + rng() - 1.5) / 1.5;

export function mutate(g, rng, amount = 0.09) {
  const out = {};
  for (const k of GENES) out[k] = clamp(g[k] + wobble(rng) * amount);
  return out;
}

export function distance(a, b) {
  let d = 0;
  for (const k of GENES) d += (a[k] - b[k]) ** 2;
  return Math.sqrt(d);
}

export function average(gs) {
  const out = {};
  for (const k of GENES) out[k] = gs.reduce((t, g) => t + g[k], 0) / gs.length;
  return out;
}

// When a grazer is up, from the sun's height (degrees). Everyone is up in daylight unless night is above 0.8; a
// higher night gene keeps it up later into the dark (0.5 and up: all night), so the trait can creep, not jump.
export const awakeAt = (g, alt) => (alt > -3 ? g.night < 0.8 : alt > -3 - 120 * g.night);

const COATS = [["white", [248, 244, 232]], ["sand", [226, 204, 150]], ["dun", [176, 140, 96]], ["brown", [112, 76, 50]],
  ["black", [44, 38, 36]]];
export function coatColour(c) {
  const t = clamp(c) * (COATS.length - 1), k = Math.min(COATS.length - 2, Math.floor(t)), f = t - k;
  return COATS[k][1].map((v, j) => Math.round(v + (COATS[k + 1][1][j] - v) * f));
}
export const coatWord = (c) => COATS[Math.min(COATS.length - 1, Math.round(clamp(c) * (COATS.length - 1)))][0];

// A plain-words name from what stands out about a kind: "long-legged night rust grazer".
export function nameFor(g) {
  const words = [];
  if (g.size < 0.3) words.push("little");
  else if (g.size > 0.7) words.push("great");
  if (g.legs > 0.6) words.push("long-legged");
  else if (g.legs < 0.12) words.push("stubby");
  if (g.night > 0.8) words.push("night");
  else if (g.night > 0.5) words.push("dusk");
  words.push(coatWord(g.coat), "grazer");
  return words.join(" ");
}

// What the weather costs a body for one tick. The sun overheats big, dark grazers (half as much lying down);
// the night chills small, pale ones (half as much up and moving). `light` is 0 to 1, from the sun's height.
export function weather(g, daytime, light, up) {
  if (daytime) return light * 0.04 * (0.1 + 0.6 * g.size + 0.6 * g.coat) * (up ? 1 : 0.5);
  return 0.008 * Math.max(0, 1 - 0.6 * g.size - 0.6 * g.coat) * (up ? 0.5 : 1);
}
