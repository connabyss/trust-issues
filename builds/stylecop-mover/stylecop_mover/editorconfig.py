"""Turns the old file's switched-off rules into .editorconfig lines for the new StyleCop.Analyzers."""
from .rules import IN_NEW_STYLECOP, RULES


def editorconfig(turned_off: list, turned_on: tuple = ()) -> tuple:
    """Returns (the .editorconfig text, rule names that couldn't be moved, each with why). Rules switched on are
    written too: the new StyleCop has some rules off by default (SA1305, for one)."""
    lines, skipped = ["[*.cs]", "# Moved from Settings.StyleCop by stylecop-mover"], []
    for name, severity in [(n, "none") for n in turned_off] + [(n, "warning") for n in turned_on]:
        rid = RULES.get(name)
        if not rid:
            skipped.append((name, "not a rule the old StyleCop shipped (a custom rule?)"))
        elif rid not in IN_NEW_STYLECOP:
            skipped.append((name, f"{rid} is not in the new StyleCop.Analyzers"))
        else:
            # The EditorConfig spec only allows comments on their own line, so the old name goes above.
            lines += [f"# {name}", f"dotnet_diagnostic.{rid}.severity = {severity}"]
    return "\n".join(lines) + "\n", skipped
