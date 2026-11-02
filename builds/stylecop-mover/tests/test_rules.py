from stylecop_mover.rules import IN_NEW_STYLECOP, RULES


def test_known_rules_have_their_numbers():
    assert RULES["ElementsMustBeDocumented"] == "SA1600"
    assert RULES["PrefixLocalCallsWithThis"] == "SA1101"


def test_a_rule_the_new_docs_renamed_still_maps():
    # The new docs call SA1200 UsingDirectivesMustBePlacedCorrectly; old settings files use the old name.
    assert RULES["UsingDirectivesMustBePlacedWithinNamespace"] == "SA1200"


def test_the_new_stylecop_still_has_most_of_them():
    assert "SA1600" in IN_NEW_STYLECOP and len(set(RULES.values()) & IN_NEW_STYLECOP) > 150


def test_the_table_matches_its_sources():
    # rules.py is made by tools/make_rules.py: if the maker breaks or a snapshot changes, this goes red.
    from pathlib import Path
    from tools.make_rules import build
    assert build() == (Path(__file__).parent.parent / "stylecop_mover" / "rules.py").read_text(encoding="utf-8")
