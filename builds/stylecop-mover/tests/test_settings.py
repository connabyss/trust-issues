import json

from stylecop_mover.settings import stylecop_json

DOCS, NAMING = "StyleCop.CSharp.DocumentationRules", "StyleCop.CSharp.NamingRules"


def test_company_and_copyright_move():
    text, left = stylecop_json({(DOCS, "CompanyName"): "Lemonade Stand Ltd", (DOCS, "Copyright"): "(c) Lemonade"})
    doc = json.loads(text)["settings"]["documentationRules"]
    assert doc == {"companyName": "Lemonade Stand Ltd", "copyrightText": "(c) Lemonade"} and left == []


def test_ignore_privates_and_internals_flip_into_document_settings():
    text, _ = stylecop_json({(DOCS, "IgnorePrivates"): "True", (DOCS, "IgnoreInternals"): "False"})
    doc = json.loads(text)["settings"]["documentationRules"]
    assert doc == {"documentPrivateElements": False, "documentPrivateFields": False, "documentInternalElements": True}


def test_hungarian_prefixes_move():
    text, _ = stylecop_json({(NAMING, "Hungarian"): ["ui", "db"]})
    assert json.loads(text)["settings"]["namingRules"] == {"allowedHungarianPrefixes": ["ui", "db"]}


def test_settings_without_a_match_are_listed():
    text, left = stylecop_json({(DOCS, "IncludeFields"): "False"})
    assert left == ["DocumentationRules / IncludeFields = False"]
    assert json.loads(text)["settings"] == {} and "$schema" in json.loads(text)
