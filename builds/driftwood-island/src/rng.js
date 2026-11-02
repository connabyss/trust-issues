// Seeded dice: the same word always rolls the same numbers.

// Turn any text into a 32-bit seed (FNV-1a). Case and outer spaces don't matter: "Mars" and " mars " are one planet.
export function seedFrom(word) {
  const text = String(word).trim().toLowerCase();
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32: a small, fast generator. Returns a function giving numbers in [0, 1).
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (n) => Math.floor(next() * n);
  next.pick = (list) => list[Math.floor(next() * list.length)];
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.chance = (p) => next() < p;
  return next;
}
