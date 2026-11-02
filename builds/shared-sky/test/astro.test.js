import test from "node:test";
import assert from "node:assert/strict";
import { julianDay, siderealGreenwich, altAz } from "../src/astro.js";

const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} is not within ${tol} of ${b}`);

test("noon on 1 January 2000 is Julian day 2451545", () => {
  assert.equal(julianDay(new Date(Date.UTC(2000, 0, 1, 12))), 2451545);
});

test("sidereal time matches Meeus's worked example (1987-04-10 0h UT = 13h10m46.37s)", () => {
  near(siderealGreenwich(new Date(Date.UTC(1987, 3, 10))), 197.693195, 0.0005, "GMST");
});

test("the North Star stands as high as your latitude, at any hour", () => {
  for (const hour of [0, 6, 13, 21]) {
    const { alt } = altAz(37.95, 89.264, new Date(Date.UTC(2026, 10, 2, hour)), 40.7, -74.0);
    near(alt, 40.7, 0.8, `Polaris at ${hour}h`);
  }
});

test("a star crossing the meridian at your latitude is straight overhead", () => {
  const date = new Date(Date.UTC(2026, 10, 2, 3));
  const ra = siderealGreenwich(date) + 10; // local sidereal time at longitude 10 east
  near(altAz(ra, 51.5, date, 51.5, 10).alt, 90, 1e-6, "altitude");
});

test("a star due south of the zenith has azimuth 180", () => {
  const date = new Date(Date.UTC(2026, 10, 2, 3));
  const ra = siderealGreenwich(date) - 74;
  near(altAz(ra, 0, date, 40.7, -74).az, 180, 1e-6, "azimuth");
});
