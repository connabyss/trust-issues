from stylecop_mover.editorconfig import editorconfig


def test_turned_off_rules_become_severity_none():
    text, skipped = editorconfig(["ElementsMustBeDocumented", "UsingDirectivesMustBePlacedWithinNamespace"])
    assert "dotnet_diagnostic.SA1600.severity = none" in text
    assert "dotnet_diagnostic.SA1200.severity = none" in text
    assert text.startswith("[*.cs]") and skipped == []


def test_unknown_rules_are_listed_not_dropped():
    text, skipped = editorconfig(["MyTeamsOwnRule"])
    assert "MyTeamsOwnRule" not in text
    assert skipped[0][0] == "MyTeamsOwnRule"


def test_a_rule_the_new_stylecop_dropped_is_listed():
    text, skipped = editorconfig(["DoNotSplitNullConditionalOperators"])
    assert "SA1029" not in text.split("\n", 2)[2]
    assert skipped == [("DoNotSplitNullConditionalOperators", "SA1029 is not in the new StyleCop.Analyzers")]


def test_a_switched_on_rule_is_written_too():
    # SA1305 (no Hungarian notation) is off by default in the new StyleCop, so "on" has to be moved as well.
    text, _ = editorconfig([], ["FieldNamesMustNotUseHungarianNotation"])
    assert "dotnet_diagnostic.SA1305.severity = warning" in text


def test_comments_sit_on_their_own_line():
    text, _ = editorconfig(["ElementsMustBeDocumented"])
    assert "# ElementsMustBeDocumented\ndotnet_diagnostic.SA1600.severity = none\n" in text
    assert all("#" not in line for line in text.splitlines() if "=" in line)
