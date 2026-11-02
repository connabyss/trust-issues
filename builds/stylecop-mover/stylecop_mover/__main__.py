"""python -m stylecop_mover path/to/Settings.StyleCop

Writes .editorconfig, stylecop.json and STYLECOP_MOVE_REPORT.md next to it. A file that's already there is never
overwritten: the new one gets a .from-stylecop ending, for you to merge by hand."""
import sys
from pathlib import Path

from .editorconfig import editorconfig
from .reader import read
from .report import report
from .settings import stylecop_json


def save(path: Path, text: str) -> Path:
    if path.exists():
        path = path.with_name(path.name + ".from-stylecop")
    path.write_text(text, encoding="utf-8")
    return path


def main(argv: list) -> int:
    if len(argv) != 1:
        print(__doc__.strip())
        return 2
    src = Path(argv[0])
    if not src.is_file():
        print(f"No file at {src}")
        return 1
    old = read(src.read_text(encoding="utf-8-sig"))
    ec, skipped = editorconfig(old.turned_off, old.turned_on)
    sj, left = stylecop_json(old.analyzer_settings)
    moved = len(old.turned_off) + len(old.turned_on) - len(skipped)
    folder = src.parent
    written = [save(folder / ".editorconfig", ec), save(folder / "stylecop.json", sj),
               save(folder / "STYLECOP_MOVE_REPORT.md", report(moved, skipped, left, old.other))]
    print(f"Moved {moved} rule(s); {len(skipped) + len(left) + len(old.other)} thing(s) to do by hand.")
    for p in written:
        print("  wrote", p)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
