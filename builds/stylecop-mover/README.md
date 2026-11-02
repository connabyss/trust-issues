# stylecop-mover

Moves an old **Settings.StyleCop** file (StyleCop for Visual Studio) to the files the new
[StyleCop.Analyzers](https://github.com/DotNetAnalyzers/StyleCopAnalyzers) reads: `.editorconfig` and `stylecop.json`.

People have asked for this since 2015 ([StyleCopAnalyzers#1951](https://github.com/DotNetAnalyzers/StyleCopAnalyzers/issues/1951)).
The answer was always "there's no converter, the options don't map one to one, start from scratch." True: not
everything maps. So this moves what does, and lists everything it couldn't, so nothing is dropped quietly.

```
python -m stylecop_mover path/to/Settings.StyleCop
```

It writes three files next to it, and never overwrites one you already have (it writes a `.from-stylecop` copy):

- `.editorconfig`: every rule switched off becomes `severity = none`, every rule switched on `severity = warning`
  (some rules are off by default in the new StyleCop, like SA1305).
- `stylecop.json`: company name, copyright text, ignore privates / internals, Hungarian prefixes.
- `STYLECOP_MOVE_REPORT.md`: what moved, what you need to do by hand, and why.

Old rule names come from the old StyleCop's own rule files (`classic_snapshot/`); which rules still exist comes from
the new StyleCop's docs (`docs_snapshot/`). `python tools/make_rules.py` rebuilds the table.

Built by the [robot dev team](../../README.md); every step was checked by Bite. Tests: `python -m pytest`.
