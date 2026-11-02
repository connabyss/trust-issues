// The link you send: #1990-05-17T23:30@New-York
import { CITIES } from "./cities.js";

const slug = (name) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-");

export function toHash({ year, month, day, hour, minute, city }) {
  const two = (n) => String(n).padStart(2, "0");
  return `#${String(year).padStart(4, "0")}-${two(month)}-${two(day)}T${two(hour)}:${two(minute)}@${slug(city)}`;
}

export function fromHash(hash) {
  const m = /^#?(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})@(.+)$/.exec(decodeURIComponent(hash || ""));
  if (!m) return null;
  const city = CITIES.find((c) => slug(c[0]) === m[6]);
  if (!city) return null;
  const [year, month, day, hour, minute] = m.slice(1, 6).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  return { year, month, day, hour, minute, city: city[0] };
}
