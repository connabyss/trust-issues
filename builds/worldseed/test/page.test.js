// The whole page in a real (headless) browser: it draws a planet, history runs, and a meteor lands.
// Needs Playwright with Chromium. Without it this test is skipped, and says so.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";

let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { /* not installed */ }

const TYPES = { ".html": "text/html", ".js": "text/javascript" };
function serve(root) {
  return new Promise((ok) => {
    const s = createServer(async (req, res) => {
      const path = new URL(req.url, "http://x").pathname;
      try {
        const body = await readFile(join(root, path === "/" ? "index.html" : path));
        res.writeHead(200, { "content-type": TYPES[extname(path) || ".html"] || "application/octet-stream" }).end(body);
      } catch { res.writeHead(404).end(); }
    }).listen(0, "127.0.0.1", () => ok(s));
  });
}

test("the page draws a planet, history runs, and a dropped meteor lands in the chronicle",
  { skip: chromium ? false : "Playwright isn't installed", timeout: 90000 }, async () => {
    const server = await serve(new URL("..", import.meta.url).pathname);
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(`http://127.0.0.1:${server.address().port}/#orbit`);
      await page.waitForFunction(() => document.querySelectorAll("#log li").length > 5, null, { timeout: 30000 });
      assert.equal(await page.inputValue("#word"), "orbit");
      // The middle of the globe is drawn (not empty space), and the corner is space.
      const px = await page.evaluate(() => {
        const c = document.getElementById("globe"), d = c.getContext("2d");
        const mid = d.getImageData(c.width * 0.35, c.height / 2, 1, 1).data, corner = d.getImageData(1, 1, 1, 1).data;
        return { mid: mid[0] + mid[1] + mid[2], corner: corner[0] + corner[1] + corner[2] };
      });
      assert.ok(px.mid > 60 && px.corner < 30, JSON.stringify(px));
      if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, "page-1.png") });
      // Drop a meteor in the middle of the planet.
      await page.click("#meteor");
      const box = await page.locator("#marks").boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForFunction(() => [...document.querySelectorAll("#log .ev-meteor")].length > 0, null, { timeout: 30000 });
      assert.match(await page.evaluate(() => location.hash), /^#orbit~\d+\.\d+$/);
      if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, "page-2.png") });
      // Scrub to the end of time: the year reads 6,000.
      await page.locator("#time").fill("6000");
      await page.waitForFunction(() => document.getElementById("year").textContent === "Year 6,000");
      if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, "page-3.png") });
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      server.close();
    }
  });

test("the one-file version works on its own: no src folder, still a planet and a history",
  { skip: chromium ? false : "Playwright isn't installed", timeout: 90000 }, async () => {
    const dir = mkdtempSync(join(tmpdir(), "ws-one-"));
    execFileSync(process.execPath, [new URL("../tools/bundle.mjs", import.meta.url).pathname, join(dir, "index.html")]);
    assert.ok(!readFileSync(join(dir, "index.html"), "utf8").includes("./src/"), "the one-file page still points at src/");
    const server = await serve(dir);
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(`http://127.0.0.1:${server.address().port}/#assata`);
      await page.waitForFunction(() => document.querySelectorAll("#log li").length > 5, null, { timeout: 30000 });
      assert.equal(await page.inputValue("#word"), "assata");
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      server.close();
    }
  });
