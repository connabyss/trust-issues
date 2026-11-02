"""Reads an old Settings.StyleCop file."""
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field


@dataclass
class OldSettings:
    turned_off: list = field(default_factory=list)  # rule names with Enabled = False
    turned_on: list = field(default_factory=list)  # rule names with Enabled = True
    analyzer_settings: dict = field(default_factory=dict)  # (analyzer, property name) -> value
    other: list = field(default_factory=list)  # anything else in the file, as "where: what"


def read(text: str) -> OldSettings:
    root = ET.fromstring(text.lstrip("﻿"))
    s = OldSettings()
    for analyzer in root.iter("Analyzer"):
        aid = analyzer.get("AnalyzerId", "")
        for rule in analyzer.iter("Rule"):
            for prop in rule.iter("BooleanProperty"):
                if prop.get("Name") == "Enabled":
                    on = (prop.text or "").strip().lower() == "true"
                    (s.turned_on if on else s.turned_off).append(rule.get("Name"))
        for settings in analyzer.findall("AnalyzerSettings"):
            for prop in settings:
                name = prop.get("Name")
                if prop.tag == "CollectionProperty":
                    s.analyzer_settings[(aid, name)] = [(v.text or "").strip() for v in prop.iter("Value")]
                else:
                    s.analyzer_settings[(aid, name)] = (prop.text or "").strip()
    for child in root:
        if child.tag != "Analyzers":
            s.other.append(f"{child.tag}: {ET.tostring(child, encoding='unicode').strip()[:200]}")
    return s
