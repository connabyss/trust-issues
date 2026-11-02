// Where the moon was, and how full. Low-precision formulas from the Astronomical Almanac (good to a few tenths of
// a degree, plenty for a picture).
import { julianDay } from "./astro.js";

const RAD = Math.PI / 180;
const sin = (deg) => Math.sin(deg * RAD);
const cos = (deg) => Math.cos(deg * RAD);
const wrap360 = (deg) => ((deg % 360) + 360) % 360;

function sunLongitude(n) {
  const g = 357.528 + 0.9856003 * n;
  return wrap360(280.46 + 0.9856474 * n + 1.915 * sin(g) + 0.02 * sin(2 * g));
}

export function moon(date) {
  const n = julianDay(date) - 2451545.0;
  const t = n / 36525;
  const lon = wrap360(218.32 + 481267.881 * t + 6.29 * sin(135.0 + 477198.87 * t) - 1.27 * sin(259.3 - 413335.36 * t)
    + 0.66 * sin(235.7 + 890534.22 * t) + 0.21 * sin(269.9 + 954397.74 * t) - 0.19 * sin(357.5 + 35999.05 * t)
    - 0.11 * sin(186.5 + 966404.03 * t));
  const lat = 5.13 * sin(93.3 + 483202.02 * t) + 0.28 * sin(228.2 + 960400.89 * t) - 0.28 * sin(318.3 + 6003.15 * t)
    - 0.17 * sin(217.6 - 407332.21 * t);
  const eps = 23.439 - 0.0000004 * n;
  const ra = wrap360(Math.atan2(sin(lon) * cos(eps) - Math.tan(lat * RAD) * sin(eps), cos(lon)) / RAD);
  const dec = Math.asin(sin(lat) * cos(eps) + cos(lat) * sin(eps) * sin(lon)) / RAD;
  const elong = wrap360(lon - sunLongitude(n));
  const lit = (1 - cos(lat) * cos(elong)) / 2;
  return { ra, dec, lit, waxing: elong < 180 };
}
