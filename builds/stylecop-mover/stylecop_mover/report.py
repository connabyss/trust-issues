"""The plain-words report of what moved and what didn't."""


def report(moved_rules: int, skipped_rules: list, left_settings: list, other: list) -> str:
    out = ["# What stylecop-mover moved", "",
           f"- {moved_rules} rule switch(es) moved to .editorconfig (off = severity none, on = severity warning).", ""]
    if skipped_rules or left_settings or other:
        out += ["## Couldn't move (do these by hand)", ""]
        out += [f"- Rule {name}: {why}" for name, why in skipped_rules]
        out += [f"- Setting {s}: no matching setting in the new StyleCop" for s in left_settings]
        out += [f"- {o.split(':', 1)[0]}: not a rule or analyzer setting" for o in other]
        out.append("")
    else:
        out += ["Everything moved.", ""]
    out += ["## Next", "", "- Add stylecop.json to your project as an AdditionalFiles item, or the analyzers won't see it.",
            "- Delete Settings.StyleCop once you're happy: the new analyzers don't read it.", ""]
    return "\n".join(out)
