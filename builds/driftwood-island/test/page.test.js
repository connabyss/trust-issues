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
import { runTo } from "../src/sim.js";
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
    await page.clock.setFixedTime(NOON);
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
    // The island is drawn: sea blue at the corner, land somewhere in the middle.
    const px = await page.evaluate(() => {
      const c = document.getElementById("isle"), d = c.getContext("2d");
      return [d.getImageData(2, 2, 1, 1).data, d.getImageData(c.width / 2, c.height / 2, 1, 1).data].map((a) => [...a]);
    });
    assert.ok(px[0][2] > px[0][0], "the corner should be sea blue");
    assert.ok(px[1][0] > px[1][2] || px[1][1] > px[1][2], "the middle should be land");
    if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, "island-1.png") });
    // The replay runs through yesterday's night: the clock shows day 6 for a while.
    await page.click("#replay");
    await page.waitForFunction(() => document.getElementById("clock").textContent.startsWith("Day 6"));
    await page.waitForFunction(() => document.getElementById("phase").textContent === "night");
    if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, "island-2.png") });
  });
});

test("the one-file version works on its own", { skip, timeout: 60000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "isle-"));
  execFileSync(process.execPath, [new URL("../tools/bundle.mjs", import.meta.url).pathname, join(dir, "index.html")]);
  await open(dir, async (page) => {
    assert.equal(await page.textContent("#clock"), "Day 7, 12:00 pm");
  });
});
