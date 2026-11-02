import test from "node:test";
import assert from "node:assert/strict";
import { localToDate } from "../src/when.js";
import { CITIES } from "../src/cities.js";

test("9 pm on the 4th of July in New York is 1 am UTC the next day (summer time)", () => {
  assert.equal(localToDate(2026, 7, 4, 21, 0, "America/New_York").toISOString(), "2026-07-05T01:00:00.000Z");
});

test("winter in New York is five hours behind UTC", () => {
  assert.equal(localToDate(1990, 1, 15, 23, 30, "America/New_York").toISOString(), "1990-01-16T04:30:00.000Z");
});

test("Tokyo is nine hours ahead, and the date goes back a day", () => {
  assert.equal(localToDate(2000, 1, 1, 3, 0, "Asia/Tokyo").toISOString(), "1999-12-31T18:00:00.000Z");
});

test("the hour after the clocks go forward still lands right", () => {
  assert.equal(localToDate(2026, 3, 8, 3, 30, "America/New_York").toISOString(), "2026-03-08T07:30:00.000Z");
});

test("every city has a real time zone and sane coordinates", () => {
  for (const [name, lat, lon, tz] of CITIES) {
    assert.doesNotThrow(() => new Intl.DateTimeFormat("en-US", { timeZone: tz }), name);
    assert.ok(Math.abs(lat) <= 90 && Math.abs(lon) <= 180, name);
  }
});
