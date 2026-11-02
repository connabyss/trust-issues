import json
import shutil
import subprocess
import sys
from pathlib import Path

SAMPLE = Path(__file__).parent / "files" / "Settings.StyleCop"
ROOT = Path(__file__).parent.parent


def run(folder: Path, *args):
    return subprocess.run([sys.executable, "-m", "stylecop_mover", *args], cwd=ROOT, capture_output=True, text=True,
                          env={"PYTHONPATH": str(ROOT), "PATH": ""})


def test_moves_a_whole_file(tmp_path):
    shutil.copy(SAMPLE, tmp_path / "Settings.StyleCop")
    p = run(tmp_path, str(tmp_path / "Settings.StyleCop"))
    assert p.returncode == 0, p.stderr
    assert "dotnet_diagnostic.SA1600.severity = none" in (tmp_path / ".editorconfig").read_text()
    doc = json.loads((tmp_path / "stylecop.json").read_text())["settings"]["documentationRules"]
    assert doc["companyName"] == "Lemonade Stand Ltd"
    assert "IncludeFields" in (tmp_path / "STYLECOP_MOVE_REPORT.md").read_text()


def test_never_overwrites_an_existing_file(tmp_path):
    shutil.copy(SAMPLE, tmp_path / "Settings.StyleCop")
    (tmp_path / ".editorconfig").write_text("root = true\n")
    run(tmp_path, str(tmp_path / "Settings.StyleCop"))
    assert (tmp_path / ".editorconfig").read_text() == "root = true\n"
    assert "SA1600" in (tmp_path / ".editorconfig.from-stylecop").read_text()


def test_a_missing_file_says_so(tmp_path):
    p = run(tmp_path, str(tmp_path / "nope"))
    assert p.returncode == 1 and "No file at" in p.stdout


def test_no_argument_prints_how_to_use():
    p = run(ROOT)
    assert p.returncode == 2 and "python -m stylecop_mover" in p.stdout
