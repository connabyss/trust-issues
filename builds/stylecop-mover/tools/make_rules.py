"""Rebuilds stylecop_mover/rules.py.

Old rule names and their numbers come from the old StyleCop's own rule files (classic_snapshot/, copied from
github.com/StyleCop/StyleCop, Project/Src/StyleCop.CSharp.Rules). Which numbers the new StyleCop.Analyzers still has
comes from its docs (docs_snapshot/, from github.com/DotNetAnalyzers/StyleCopAnalyzers/tree/master/documentation).
The names alone don't match: the new docs renamed some rules (SA1200 was UsingDirectivesMustBePlacedWithinNamespace)."""
import re
from pathlib import Path

here = Path(__file__).resolve().parent.parent


def build() -> str:
    """The text of stylecop_mover/rules.py, made from the two snapshots."""
    new_ids = set()
    for md in (here / "docs_snapshot").glob("*.md"):
        new_ids |= set(re.findall(r"^\[(SA\d{4})\]", md.read_text(encoding="utf-8-sig"), re.M))
    old = {}
    for xml in sorted((here / "classic_snapshot").glob("*.xml")):
        for name, rid in re.findall(r'<Rule\s+Name="(\w+)"\s+CheckId="(SA\d{4})"', xml.read_text(encoding="utf-8-sig")):
            old[name] = rid
    lines = ['"""Old StyleCop rule name -> its SA number, and the numbers the new StyleCop.Analyzers still has.',
             'Made by tools/make_rules.py; don\'t edit."""', "", "RULES = {"]
    lines += [f'    "{n}": "{r}",' for n, r in sorted(old.items(), key=lambda x: x[1])]
    lines += ["}", "", "IN_NEW_STYLECOP = {"]
    lines += [f'    "{r}",' for r in sorted(new_ids)]
    lines += ["}", ""]
    return "\n".join(lines)


if __name__ == "__main__":
    (here / "stylecop_mover" / "rules.py").write_text(build(), encoding="utf-8")
    print("rules.py rebuilt")
