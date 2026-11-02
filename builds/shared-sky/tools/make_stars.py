"""Rebuilds src/stars.js from data_source/ (d3-celestial's data, BSD licence, see LICENSE-d3-celestial):
every star of magnitude 5 or brighter, the constellation lines, and names for the brightest stars."""
import json
from pathlib import Path

here = Path(__file__).resolve().parent.parent
src = here / "data_source"


def build() -> str:
    feats = json.loads((src / "stars.6.json").read_text())["features"]
    names = json.loads((src / "starnames.json").read_text())
    stars, named = [], {}
    for f in sorted(feats, key=lambda f: f["properties"]["mag"]):
        mag = f["properties"]["mag"]
        if mag > 5:
            continue
        lon, dec = f["geometry"]["coordinates"]
        stars.append([round(lon % 360, 4), round(dec, 4), mag])
        name = names.get(str(f["id"]), {}).get("name", "")
        if mag <= 1.5 and name:
            named[name] = [round(lon % 360, 4), round(dec, 4), mag]
    lines = {}
    for f in json.loads((src / "constellations.lines.json").read_text())["features"]:
        # Serpens comes in two separate pieces (head and tail), listed twice: keep both.
        lines.setdefault(f["id"], []).extend([[round(lon % 360, 4), round(dec, 4)] for lon, dec in seg]
                                             for seg in f["geometry"]["coordinates"])
    return ("// Made by tools/make_stars.py from d3-celestial's data (BSD licence). Don't edit.\n"
            "// Each star: [right ascension in degrees, declination in degrees, magnitude], brightest first.\n"
            f"export const STARS = {json.dumps(stars, separators=(',', ':'))};\n"
            f"export const NAMED = {json.dumps(named, separators=(',', ':'))};\n"
            f"export const LINES = {json.dumps(lines, separators=(',', ':'))};\n")


if __name__ == "__main__":
    (here / "src" / "stars.js").write_text(build())
    print("src/stars.js rebuilt")
