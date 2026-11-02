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

## Shift 2: evolution (November 2, 2026, from 6:00 am on day 7)

- Genes: every grazer carries size, legs, coat (white to black) and waking hours, and its young take after it with
  small random changes (`src/genes.js`).
- Reasons to differ: the sun overheats big, dark grazers; the night chills small, pale ones; grass grows a little in
  the dew at night, so staying up late can pay. Long legs search further for grass but cost energy to carry.
- Kinds: a newborn far enough from its kind's founder joins the nearest living kind, or starts a new one. A new kind
  gets a name (from what stands out about it) and a history line once 10 of it are alive at once.
- The page draws every grazer from its genes, lists every kind, and can fast-forward the week ahead (labelled as a
  preview: a rule added later could change it).
- What the rules give, if nothing new is added: night grazers spread from day 11, and by day 21 several kinds live
  side by side. Coat colour mostly matters for heat for now; nothing hunts yet.

## Shift 3: prowlers (November 2, 2026, from 6:00 pm on day 9)

- Two prowlers swim ashore on the north beach. Each tick an awake prowler chases the nearest grazer it can see, and
  catches it more often when it's big and fast, less often when the grazer has long legs or a crowd around it.
- Camouflage (`src/prowl.js`): a coat close to the ground's lightness, or a dark coat at night, shortens how far a
  prowler sees it. Prowlers with night eyes see further in the dark.
- Grazers within 2 tiles of an awake prowler run, and long legs run further.
- Prowlers have young, evolve size, speed and hunting hours, starve, and die of old age after 25 days. If they all
  die, two more swim ashore ten days later.
- What the rules give: boom and crash. Prowlers peak near 50, grazers fall to a few dozen, prowlers starve back to a
  handful, grazers recover to hundreds, and round again. Both are still alive on day 50 (tested to day 30).
- The page draws prowlers (orange eyes at night), a faint line to whoever they're chasing, a red burst at a catch,
  and can follow one prowler.

## The promise: the past never changes

Every rule has a start time and does nothing before it, and each rule rolls its own dice every tick, so a rule added
later can't nudge another. `test/past.test.js` pins fingerprints of the whole island at noon on days 3 and 5 and at 5:50 am on day 7 (noon on
day 7 was pinned in shift 1, but it was still in the future when evolution was added at 2 am that day, so the pin moved
to the last moment that had happened), and
proves that a made-up rule starting on day 9 changes nothing before day 9. Future shifts add rules that start in the
future (rain, seasons, predators...) and must leave those fingerprints alone. `test/evolution.test.js` also pins noon on day 9,
so the next shift must start after that. Prowlers start at 6:00 pm on day 9.

## Run it

Open `index.html` through a small web server (`python -m http.server 8000`), or pack it into one file with
`node tools/bundle.mjs island.html`. Tests: `npm test` (44; two open the page in headless Chromium with its clock frozen,
and skip if Playwright isn't installed).

Not tested: how it looks (colours, sizes, the animation, stars, the dusk glow) and the hover card. Known gripes from
the playtester: the kinds are all shades of brown, so they're hard to tell apart on the map, and with hundreds of
grazers the camera pulls all the way out.
