"""Moves the old analyzer settings that have a match into the new stylecop.json."""
import json

SCHEMA = ("https://raw.githubusercontent.com/DotNetAnalyzers/StyleCopAnalyzers/master/"
          "StyleCop.Analyzers/StyleCop.Analyzers/Settings/stylecop.schema.json")
DOCS, NAMING = "StyleCop.CSharp.DocumentationRules", "StyleCop.CSharp.NamingRules"


def yes(value: str) -> bool:
    return str(value).strip().lower() == "true"


def stylecop_json(analyzer_settings: dict) -> tuple:
    """Returns (the stylecop.json text, settings that couldn't be moved as "analyzer / name = value")."""
    doc, naming, left = {}, {}, []
    for (analyzer, name), value in analyzer_settings.items():
        if (analyzer, name) == (DOCS, "CompanyName") and value:
            doc["companyName"] = value
        elif (analyzer, name) == (DOCS, "Copyright") and value:
            doc["copyrightText"] = value
        elif (analyzer, name) == (DOCS, "IgnorePrivates"):
            doc["documentPrivateElements"] = doc["documentPrivateFields"] = not yes(value)
        elif (analyzer, name) == (DOCS, "IgnoreInternals"):
            doc["documentInternalElements"] = not yes(value)
        elif (analyzer, name) == (NAMING, "Hungarian"):
            naming["allowedHungarianPrefixes"] = list(value)
        else:
            left.append(f"{analyzer.rsplit('.', 1)[-1]} / {name} = {value}")
    settings = {}
    if doc:
        settings["documentationRules"] = doc
    if naming:
        settings["namingRules"] = naming
    return json.dumps({"$schema": SCHEMA, "settings": settings}, indent=2) + "\n", left
