// Star maths: where a star sits in the sky for a given moment and place.
// Formulas from Jean Meeus, "Astronomical Algorithms" (chapters 7, 12 and 13).

const RAD = Math.PI / 180;

export function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

const wrap360 = (deg) => ((deg % 360) + 360) % 360;

// Greenwich mean sidereal time, in degrees (Meeus 12.4).
export function siderealGreenwich(date) {
  const jd = julianDay(date);
  const t = (jd - 2451545.0) / 36525;
  return wrap360(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t - (t * t * t) / 38710000);
}

// Altitude above the horizon and azimuth (0 = north, 90 = east), in degrees, for a star at right ascension `ra`
// and declination `dec` (degrees), seen from latitude `lat` and longitude `lon` (east positive).
export function altAz(ra, dec, date, lat, lon) {
  const ha = (siderealGreenwich(date) + lon - ra) * RAD;
  const d = dec * RAD;
  const p = lat * RAD;
  const alt = Math.asin(Math.sin(d) * Math.sin(p) + Math.cos(d) * Math.cos(p) * Math.cos(ha));
  const az = Math.atan2(-Math.cos(d) * Math.sin(ha), Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.cos(ha) * Math.sin(p));
  return { alt: alt / RAD, az: wrap360(az / RAD) };
}
