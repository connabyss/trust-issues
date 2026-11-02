from pathlib import Path

from stylecop_mover.reader import read

SAMPLE = (Path(__file__).parent / "files" / "Settings.StyleCop").read_text(encoding="utf-8")


def test_finds_the_rules_turned_off():
    assert read(SAMPLE).turned_off == ["ElementsMustBeDocumented", "UsingDirectivesMustBePlacedWithinNamespace"]


def test_finds_the_rules_turned_on():
    assert read(SAMPLE).turned_on == ["DocumentationTextMustEndWithAPeriod"]


def test_reads_settings_and_lists():
    s = read(SAMPLE).analyzer_settings
    assert s[("StyleCop.CSharp.DocumentationRules", "CompanyName")] == "Lemonade Stand Ltd"
    assert s[("StyleCop.CSharp.NamingRules", "Hungarian")] == ["ui", "db"]


def test_keeps_what_it_doesnt_understand():
    assert any("Culture" in x for x in read(SAMPLE).other)


def test_a_file_saved_with_a_byte_order_mark_still_reads():
    assert read("﻿" + SAMPLE).turned_off
