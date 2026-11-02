// Render a planet to a PNG-ready PPM so the team can look at it without a browser.
// node tools/snapshot.mjs WORD OUT.ppm [centerLon] [size]
import { writeFileSync } from "node:fs";
import { makePlanet } from "../src/planet.js";
import { makeClimate } from "../src/climate.js";
import { makeRivers } from "../src/rivers.js";
import { makeView, paintMap, render } from "../src/globe.js";

const [word = "worldseed", out = "snap.ppm", lon = "0", size = "480"] = process.argv.slice(2);
const p = makePlanet(word), c = makeClimate(p), r = makeRivers(p, c);
const v = makeView(+size), buf = new Uint8ClampedArray(+size * +size * 4);
render(v, p.grid, paintMap(p, c, r), null, +lon, buf);
const rgb = Buffer.alloc(+size * +size * 3);
for (let k = 0; k < +size * +size; k++) {
  const a = buf[k * 4 + 3] / 255;
  for (let ch = 0; ch < 3; ch++) rgb[k * 3 + ch] = buf[k * 4 + ch] * a + 6 * (1 - a);
}
writeFileSync(out, Buffer.concat([Buffer.from(`P6 ${size} ${size} 255\n`), rgb]));
