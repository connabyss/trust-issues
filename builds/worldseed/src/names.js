// Names: every people gets its own small language, so its cities and rulers sound like they belong together.
import { makeRng } from "./rng.js";

const CONSONANTS = "b c d f g h k l m n p r s t v z th sh kh ch".split(" ");
const VOWELS = "a e i o u ae ai ou ia".split(" ");
const SHAPES = ["CVC", "VC", "CVV", "V"];
const VOWEL_RUN = /[aeiouy]{3,}/;
const CONSONANT_RUN = /[^aeiouy]{3,}/;

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function pronounceable(word) {
  const raw = word.toLowerCase();
  if (/([aeiou])\1/.test(raw) || /h(?![aeiou])/.test(raw.replace(/th|sh|kh|ch/g, ""))) return false; // "aa", "uhk"
  const w = raw.replace(/th|sh|kh|ch/g, "t"); // a digraph is one sound
  return !VOWEL_RUN.test(w) && !CONSONANT_RUN.test(w);
}

export function makeLanguage(seed) {
  const rng = makeRng(seed);
  const pickSome = (list, lo, hi) => {
    const pool = [...list], out = [];
    const k = lo + rng.int(hi - lo + 1);
    while (out.length < k) out.push(pool.splice(rng.int(pool.length), 1)[0]);
    return out;
  };
  const cons = pickSome(CONSONANTS, 7, 11), vows = pickSome(VOWELS, 3, 5), shapes = pickSome(SHAPES, 1, 3);
  shapes.push("CV"); // every language can at least say "ka"
  const endings = { city: pickSome(["ar", "on", "is", "um", "a", "eth", "or", "ia", "ul", "en"], 2, 3),
    people: pickSome(["i", "an", "ese", "ar", "ites", "ari", "om"], 1, 1) };
  const used = new Set();

  function syllable() {
    return rng.pick(shapes).split("").map((ch) => (ch === "C" ? rng.pick(cons) : rng.pick(vows))).join("");
  }
  function word(minSyl, maxSyl, ending = "") {
    for (let tries = 0; tries < 800; tries++) {
      const longer = tries >= 400 ? 1 : 0; // a small language running short of words reaches for longer ones
      const n = minSyl + rng.int(maxSyl - minSyl + 1 + longer);
      let w = "";
      for (let i = 0; i < n; i++) w += syllable();
      if (/[aeiou]$/.test(w) && /^[aeiou]/.test(ending)) w = w.replace(/[aeiou]+$/, ""); // "Kaia" + "on" = "Kaion"
      w += ending;
      if (w.length < 3 || w.length > 11 + 3 * longer || !pronounceable(w) || used.has(w)) continue;
      used.add(w);
      return cap(w);
    }
    // Very rare: still nothing fresh. Reuse a name with a number, like a second city named after the first.
    const base = [...used].find((u) => !u.includes(" ")) || "ka";
    const w = cap(base) + " " + (used.size + 1);
    used.add(w);
    return w;
  }
  const root = word(2, 2);
  return {
    sounds: { cons, vows, shapes },
    people: root.replace(/[aeiou]+$/, "") + endings.people[0], // the Tavari, the Kholese
    city: () => word(1, 3, rng.pick(endings.city)),
    ruler: () => word(1, 3),
    place: () => word(2, 3),
  };
}
