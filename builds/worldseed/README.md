# Worldseed

Type a word and get a planet. Peoples light their first fires by its rivers, spread, found cities, learn iron and
sailing, go to war, catch plague, break apart and sometimes vanish, and the chronicle writes it all down while the
globe turns. Their city lights creep across the night side. Spin it, slide through 6,000 years, tap a line of the
chronicle to see where it happened, or drop a meteor and watch history take a different road from that year on.

The same word always makes the same world, meteors included, so a copied link shows a friend the same history.

## Run it

Open `index.html` through a small web server (browsers won't load the `src/` modules from a plain file):

```
python -m http.server 8000      # then open http://localhost:8000/#your-word
```

Or pack it into one file that opens on its own: `node tools/bundle.mjs worldseed.html`.

## How it works

| File | What it does |
|---|---|
| `src/rng.js`, `src/noise.js` | Seeded dice and smooth 3D noise: the word becomes every number. |
| `src/planet.js` | A 320 x 160 grid of patches over the globe, heights from noise, sea filling 60% of the surface by area. |
| `src/climate.js` | Heat by latitude and height, rain from the sea and a dry belt near 25 degrees, 13 biomes. |
| `src/rivers.js` | Rain runs downhill to the sea ("priority flood"); hollows fill into lakes. |
| `src/globe.js` | Draws the lit globe: each pixel knows its patch and its sunlight, so spinning only slides the map. |
| `src/names.js` | A small language per people, so its cities sound alike. |
| `src/world.js` | The history: peoples, cities, wars, plague, iron, sails, breakaways, meteors. 6,000 years in about a second. |
| `src/view.js` | What a given year looks like: tinted lands, border lines, night lights, the share link. |
| `src/app.js`, `index.html` | The page. |

## What the tests check (69, `npm test`)

They ask whether answers are right, not just whether something changed: every drop of rain reaches the sea and no
river runs uphill, nobody founds a city in the sea, a city that "fell" really changed hands on the map, a people that
"is no more" owns nothing after, the chronicle names only peoples and cities that exist, a city belongs to whoever
holds its ground in the year you're looking at, and the history before a meteor stays word for word the same. Two
tests open the page in a headless browser (Playwright with Chromium; they skip, and say so, when it isn't installed):
the planet draws, history runs, a dropped meteor lands in the chronicle and the link, and the one-file version works.

Not tested: how it looks (city dots, labels, the meteor streak, the stars), dragging the globe, and the speed menu.
The history is made up by dice from simple rules. It is a toy world, not a model of real history or real climate.
