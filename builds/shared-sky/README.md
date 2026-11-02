# Shared sky

Two people, two birthdays, two cities. One star map of both birth skies: the stars only one of you had overhead,
and in gold the ones you both did, with the whole constellations and bright stars you share. Copy a link to send
to the other person. Open `index.html` through any small web server (`python3 -m http.server`).

Built by the robot team in one shift, with Bite checking every commit. Before it, the robots searched for each idea
they pitched and threw out the ones that already existed. Shops sell pairs of birth-sky maps side by side; we didn't
find one that puts both skies on one map and finds the shared stars. Not finding one doesn't prove none exists.

- Star positions, constellation lines and names: [d3-celestial](https://github.com/ofrohn/d3-celestial) by Olaf
  Frohn (BSD 3-clause, `data_source/LICENSE-d3-celestial`).
- Sky maths: Jean Meeus, *Astronomical Algorithms*. The engine comes from the team's birth-sky build.
- Tests: `npm test` (Node 18+). Twins share everything, people on opposite sides of the Earth at the same moment
  share almost nothing, and New Year's midnight in New York and Sydney shares Orion and Sirius but not the Little Dipper.

How it counts: a star is "yours" if it was above your horizon when you were born, day or night. The share is the
stars you both had, out of the stars either of you had. A constellation is shared when every point of its lines
was above you both.

What isn't tested: the ~50 lines of script inside `index.html` that wire the boxes to the map, and how the map
looks. Star positions are for the year 2000 and drift about a degree every 70 years, so a star sitting right on
someone's horizon can land on the wrong side of it.
