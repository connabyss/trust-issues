// The page in a real (headless) browser, with its clock frozen at noon on November 2, 2026, island time.
// Needs Playwright with Chromium. Without it these tests are skipped, and say so.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { runTo, DAY } from "../src/sim.js";
import { storyOf, summary } from "../src/story.js";
import { tickAt } from "../src/clock.js";

let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { /* not installed */ }
const skip = chromium ? false : "Playwright isn't installed";
const NOON = Date.UTC(2026, 10, 2, 17, 0); // noon, island time

function serve(root) {
  return new Promise((ok) => {
    const s = createServer(async (req, res) => {
      const path = new URL(req.url, "http://x").pathname;
      let body;
      try { body = await readFile(join(root, path === "/" ? "index.html" : path)); } catch { res.writeHead(404).end(); return; }
      res.writeHead(200, { "content-type": extname(path) === ".js" ? "text/javascript" : "text/html" }).end(body);
    }).listen(0, "127.0.0.1", () => ok(s));
  });
}

async function open(root, fn) {
  const server = await serve(root), browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.clock.install({ time: NOON });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => document.getElementById("clock").textContent.startsWith("Day 7"));
    await fn(page);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); server.close(); }
}

test("the page shows the same island the rules give for that moment", { skip, timeout: 60000 }, async () => {
  const expected = runTo(tickAt(NOON));
  await open(new URL("..", import.meta.url).pathname, async (page) => {
    assert.equal(await page.textContent("#clock"), "Day 7, 12:00 pm");
    assert.equal(await page.textContent("#phase"), "day");
    assert.equal(await page.textContent("#count"), String(expected.grazers.length));
    assert.equal(await page.locator("#history li").count(), expected.history.length);
    assert.match(await page.textContent("#history li:last-child"), /island rose from the sea/);
    // The island is drawn close up: both sea blue and green grass show somewhere on the map.
    const seen = await page.evaluate(() => {
      const c = document.getElementById("isle"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let sea = 0, grass = 0;
      for (let i = 0; i < d.length; i += 4 * 97) { if (d[i + 2] > d[i] + 40) sea++; if (d[i + 1] > d[i] + 30 && d[i + 1] > d[i + 2] + 30) grass++; }
      return { sea, grass };
    });
    assert.ok(seen.sea > 20, "some sea should show");
    assert.ok(seen.grass > 20, "some grass should show");
    // Always moving: the picture changes from one moment to the next even when the island's own clock doesn't.
    const frame = () => page.evaluate(() => { const c = document.getElementById("isle"); return c.toDataURL(); });
    const a = await frame();
    await page.clock.runFor(700);
    assert.notEqual(await frame(), a, "the map should be moving");
    if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, "island-1.png") });
    // The replay runs through yesterday's night: the clock shows day 6 for a while.
    await page.click("#replay");
    await page.waitForFunction(() => document.getElementById("clock").textContent.startsWith("Day 6"));
    await page.waitForFunction(() => document.getElementById("phase").textContent === "night");
    if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, "island-2.png") });
  });
});

test("fast-forward shows the week ahead, kinds splitting off, then comes back to now", { skip, timeout: 90000 }, async () => {
  await open(new URL("..", import.meta.url).pathname, async (page) => {
    assert.equal(await page.locator("#kinds li").count(), 1); // noon on day 7: evolution has started, one kind
    assert.equal(await page.textContent("#prowl"), "0");
    await page.click("#ff");
    assert.equal(await page.getAttribute("#ff", "aria-pressed"), "true");
    assert.ok(await page.isVisible(".preview-tag"));
    // Normal speed: a day in about 20 seconds. Pause holds the moment still.
    await page.clock.runFor(20000);
    assert.match(await page.textContent("#clock"), /^Day 8,/);
    await page.click('[data-speed="pause"]');
    const held = await page.textContent("#clock");
    await page.clock.runFor(5000);
    assert.equal(await page.textContent("#clock"), held);
    await page.click('[data-speed="fast"]');
    await page.clock.runFor(30000);
    assert.match(await page.textContent("#clock"), /^Day 1[2-4],/);
    assert.ok(await page.locator("#kinds li").count() >= 3, "kinds should have split off by then");
    assert.match(await page.textContent("#history"), /split off/);
    // By then the prowlers have landed (6 pm on day 9), and the camera can follow one.
    assert.match(await page.textContent("#history"), /prowlers swam ashore/);
    assert.ok(Number(await page.textContent("#prowl")) > 0);
    await page.click("#hunt");
    assert.equal(await page.getAttribute("#hunt", "aria-pressed"), "true");
    // Prowlers are on the map, and the camera closes in on one of them.
    await page.click('[data-speed="pause"]');
    await page.clock.runFor(6000);
    const cam = await page.evaluate(() => {
      const i = window.__island, v = i.view, s = i.shown;
      const near = Math.min(...s.prowlers.map((p) => Math.hypot((p.at % 72) + 0.5 - v.x, Math.floor(p.at / 72) + 0.5 - v.y)));
      return { near, prowlersDrawn: i.drawn.filter((d) => d.prowler).length };
    });
    assert.ok(cam.prowlersDrawn > 0, "prowlers should be drawn");
    assert.ok(cam.near < 2, `the camera should be on a prowler (${cam.near.toFixed(1)} tiles off)`);
    await page.click('[data-speed="fast"]');
    await page.clock.runFor(15000);
    assert.equal(await page.textContent("#clock"), "Day 7, 12:00 pm");
    assert.equal(await page.locator("#kinds li").count(), 1);
    assert.ok(!(await page.isVisible(".preview-tag")));
  });
});

test("adopt a grazer by clicking it, name it, and the page follows it and remembers it", { skip, timeout: 60000 }, async () => {
  await open(new URL("..", import.meta.url).pathname, async (page) => {
    assert.ok(await page.isVisible("#pet-none"));
    await page.clock.runFor(500);
    const target = await page.evaluate(() => {
      const c = document.getElementById("isle"), r = c.getBoundingClientRect(), k = r.width / c.width;
      const d = window.__island.drawn.find((x) => !x.prowler && x.sx > 40 && x.sy > 40 && x.sx < c.width - 40 && x.sy < c.height - 40);
      return { id: d.id, x: r.left + d.sx * k, y: r.top + d.sy * k };
    });
    await page.mouse.move(target.x, target.y);
    await page.mouse.click(target.x, target.y);
    assert.ok(await page.isVisible("#adopt-form"));
    assert.equal(await page.textContent("#adopt-id"), String(target.id));
    await page.fill("#adopt-name", "Pebble");
    await page.click('#adopt-form button[type="submit"]');
    assert.ok(await page.isVisible("#pet-card"));
    assert.equal(await page.textContent("#pet-name"), "Pebble");
    assert.match(await page.textContent("#pet-line"), new RegExp(`^#${target.id} · `));
    assert.equal(await page.getAttribute("#mine", "aria-pressed"), "true");
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("driftwood-pet")));
    assert.equal(saved.id, target.id);
    assert.equal(saved.name, "Pebble");
  });
});

test("coming back: 'while you were away' tells your grazer's last day, the same story the rules give", { skip, timeout: 60000 }, async () => {
  const seen = tickAt(NOON) - DAY, s = runTo(seen);
  const me = s.grazers.reduce((a, b) => (b.age > a.age ? b : a));
  const expected = summary(storyOf(me.id, "Moss", seen, tickAt(NOON)));
  const server = await serve(new URL("..", import.meta.url).pathname), browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.addInitScript((pet) => localStorage.setItem("driftwood-pet", JSON.stringify(pet)), { id: me.id, name: "Moss", since: seen, seen });
    await page.clock.install({ time: NOON });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => document.getElementById("clock").textContent.startsWith("Day 7"));
    assert.ok(await page.isVisible("#away"));
    const shown = await page.$$eval("#away-list li", (lis) => lis.map((li) => li.lastChild.textContent));
    assert.deepEqual(shown, expected.map((e) => e.text));
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem("driftwood-pet")));
    assert.equal(after.seen, tickAt(NOON));
  } finally { await browser.close(); server.close(); }
});

test("the one-file version works on its own", { skip, timeout: 60000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "isle-"));
  execFileSync(process.execPath, [new URL("../tools/bundle.mjs", import.meta.url).pathname, join(dir, "index.html")]);
  const expected = runTo(tickAt(NOON));
  await open(dir, async (page) => {
    assert.equal(await page.textContent("#clock"), "Day 7, 12:00 pm");
    // Same island as the module version: same herd, and a real share of green (not "NaN%").
    assert.equal(await page.textContent("#count"), String(expected.grazers.length));
    assert.match(await page.textContent("#green"), /^\d+%$/);
    assert.equal(await page.locator("#history li").count(), expected.history.length);
    assert.ok(await page.evaluate(() => document.getElementById("isle").clientHeight > 100), "the map should be on the page");
  });
});
