// The link you send: #Sam~1990-05-17T23:30@New-York+Alex~1992-11-03T06:15@London
import { CITIES } from "./cities.js";

const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-");
const two = (n) => String(n).padStart(2, "0");
export const cleanName = (s) => (s || "").replace(/[^\p{L}\p{N} '-]/gu, "").trim().slice(0, 20);

const one = (p) => `${encodeURIComponent(cleanName(p.name))}~${String(p.year).padStart(4, "0")}-${two(p.month)}-${two(p.day)}T${two(p.hour)}:${two(p.minute)}@${slug(p.city)}`;

export function toHash(a, b) {
  return `#${one(a)}+${one(b)}`;
}

function parse(part) {
  const m = /^([^~]*)~(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})@(.+)$/.exec(part);
  if (!m) return null;
  const city = CITIES.find((c) => slug(c[0]) === m[7]);
  const [year, month, day, hour, minute] = m.slice(2, 7).map(Number);
  if (!city || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  let name = "";
  try { name = cleanName(decodeURIComponent(m[1])); } catch { /* a broken name is just no name */ }
  return { name, year, month, day, hour, minute, city: city[0] };
}

export function fromHash(hash) {
  const parts = (hash || "").replace(/^#/, "").split("+");
  if (parts.length !== 2) return null;
  const [a, b] = parts.map(parse);
  return a && b ? [a, b] : null;
}
