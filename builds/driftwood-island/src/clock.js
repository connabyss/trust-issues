// Island time. The island rose at midnight on October 26, 2026, island time (UTC-5, all year, no clock changes).
// Time moves in ten-minute ticks: tick 0 is that midnight, and 144 ticks make a day.

export const EPOCH_MS = Date.UTC(2026, 9, 26, 5, 0, 0);
export const TICK_MS = 10 * 60 * 1000;
export const TICKS_PER_DAY = 144;
// Where the island sits: on the same longitude as New York, so its noon is about noon Eastern Standard Time.
export const PLACE = { lat: 18.5, lon: -75 };

export const tickAt = (ms) => Math.floor((ms - EPOCH_MS) / TICK_MS);
export const msAt = (tick) => EPOCH_MS + tick * TICK_MS;

export function islandTime(tick) {
  const day = Math.floor(tick / TICKS_PER_DAY);
  const mins = (tick - day * TICKS_PER_DAY) * 10;
  return { day, hour: Math.floor(mins / 60), minute: mins % 60 };
}

export function label(tick) {
  const { day, hour, minute } = islandTime(tick);
  const h12 = ((hour + 11) % 12) + 1;
  return `Day ${day}, ${h12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}`;
}

const rad = Math.PI / 180;

// How high the real sun stands over the island, in degrees (below 0 is night). The standard low-precision formula
// (good to about a degree), the same one almanacs give for "the sun's position".
export function sunAltitude(ms, lat = PLACE.lat, lon = PLACE.lon) {
  const n = ms / 86400000 + 2440587.5 - 2451545.0; // days since noon, January 1, 2000
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * rad;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const eps = (23.439 - 0.0000004 * n) * rad;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const gmst = (280.46061837 + 360.98564736629 * n) % 360;
  const hourAngle = (gmst + lon) * rad - ra;
  const alt = Math.asin(Math.sin(lat * rad) * Math.sin(dec) + Math.cos(lat * rad) * Math.cos(dec) * Math.cos(hourAngle));
  return alt / rad;
}

export const sunAt = (tick) => sunAltitude(msAt(tick));
