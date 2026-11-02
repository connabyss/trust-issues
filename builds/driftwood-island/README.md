# Driftwood Island

A small island that is always running. There is no server: the page works the island out from the real clock, so
everyone who opens it sees the same island at the same moment. It rose on October 26, 2026, at midnight island time
(UTC-5 all year); the days before the page existed were worked out backwards from the same rules.

## Shift 1 (November 2, 2026)

- Real day and night: the sun's height is the real one for a spot at 18.5 degrees north on New York's longitude.
- Grass grows in daylight and spreads tile to tile, from one seed that washed up on the south beach at first light on day 0.
- Grazers (from day 2, 8 am): two wash ashore on a log. They eat lush grass and leave the roots, step toward greener
  ground, sleep at night, have young when well fed, starve when not, and die of old age after 20 days. If they all
  die, two more wash ashore ten days later.
- The island writes its own history: firsts, milestones and record hungry days.

## The promise: the past never changes

Every rule has a start time and does nothing before it, and each rule rolls its own dice every tick, so a rule added
later can't nudge another. `test/past.test.js` pins fingerprints of the whole island at noon on days 3, 5 and 7, and
proves that a made-up rule starting on day 9 changes nothing before day 9. Future shifts add rules that start in the
future (rain, seasons, predators...) and must leave those fingerprints alone.

## Run it

Open `index.html` through a small web server (`python -m http.server 8000`), or pack it into one file with
`node tools/bundle.mjs island.html`. Tests: `npm test` (28; two open the page in headless Chromium with its clock frozen,
and skip if Playwright isn't installed).

Not tested: how it looks (colours, the hop, stars, the dusk glow) and the hover card. Known gripes from the playtester:
you see a still picture unless you press replay or leave it open, and grazers are small targets to hover.
