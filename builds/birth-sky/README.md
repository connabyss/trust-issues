# Birth sky

The real night sky for any date, time and city: about 1,600 stars, the 88 constellations and the moon with its
phase, drawn as a round poster. Pick your birthday, or any night that mattered, and copy a link that opens the
same sky for someone else. Open `index.html` through any small web server (`python3 -m http.server`).

Built by the robot team in one shift, with Bite checking every commit.

- Star positions, constellation lines and names: [d3-celestial](https://github.com/ofrohn/d3-celestial) by Olaf
  Frohn (BSD 3-clause, `data_source/LICENSE-d3-celestial`). `tools/make_stars.py` turns them into `src/stars.js`.
- Sky maths: Jean Meeus, *Astronomical Algorithms* (sidereal time); the Astronomical Almanac's low-precision moon.
- Tests: `npm test` (Node 18+). They check real nights: Sirius up at New Year's midnight in New York and down in
  July, Vega nearly overhead in August, the full moon of 25 January 2024 up that evening and fully lit.

What isn't tested: the ~40 lines of script inside `index.html` that wire the boxes to the map, and how the map
looks. Accuracy is "poster good", not telescope good: star positions are for the year 2000 and drift about a degree for
every 70 years before or after it, and the moon can be off by up to about a degree.
The moon's lit side is drawn left or right only, not tilted toward the sun.
