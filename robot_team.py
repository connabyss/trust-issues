"""Robot dev team: four robots work one project and keep each other honest.

  writer     (Claude)  fixes bugs and commits, saying what it fixed
  skeptic    (Bite)    takes each fix back out and checks a test notices
  janitor    (vulture) sweeps dead code; keeps the sweep only if the tests stay green
  historian  (Bite)    the comeback alarm: a fix that a later commit quietly undid

Every robot line is logged to <project>/shift.jsonl as it happens. `page` turns the log into a chat page.

  python robot_team.py pick DIR              planner rolls a die on a public idea list (nobody picks)
  python robot_team.py new DIR NAME          an empty browser project for that idea (tests: node --test)
  python robot_team.py plan DIR "step" ...   planner posts the steps
  python robot_team.py build DIR "msg" "what the builder says"   builder commits one step
  python robot_team.py init DIR              v1: make the toy lemonade-stand project (planted bugs)
  python robot_team.py commit DIR "msg" "what the writer says"   writer commits its change
  python robot_team.py talk DIR ROBOT "text" [LINK]  a debate line, written by Claude in that robot's voice
  python robot_team.py say DIR ROBOT "text"  a line with no action behind it (shown as staged on the page)
  python robot_team.py skeptic DIR [SHA]     Bite checks one commit (default: the newest)
  python robot_team.py janitor DIR           sweep dead code, tests must stay green
  python robot_team.py historian DIR         look for fixes a later commit undid
  python robot_team.py page DIR OUT.html     build the chat replay page

Free: no API key. Needs git, pytest, vulture and bite (pip install bite-check pytest vulture).
"""
import datetime
import html
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

EASTERN = ZoneInfo("America/New_York")

ROBOTS = {
    "planner": ("The planner", "Claude", "🗺️"),
    "builder": ("The builder", "Claude", "🔨"),
    "writer": ("The writer", "Claude", "✍️"),
    "skeptic": ("The skeptic", "Bite", "🧐"),
    "janitor": ("The janitor", "a dead-code sweep", "🧹"),
    "historian": ("The historian", "Bite's comeback alarm", "📜"),
    "playtester": ("The playtester", "Claude, looking at the page", "🎮"),
}


def run(cmd, cwd, check=True):
    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8")
    if check and p.returncode:
        sys.exit(f"failed: {' '.join(cmd)}\n{p.stdout}\n{p.stderr}")
    return p


def git(d, *a, check=True):
    return run(["git", *a], d, check).stdout.strip()


def log(d, robot, text, **extra):
    ev = {"t": datetime.datetime.now().astimezone().isoformat(timespec="seconds"), "robot": robot, "text": text, **extra}
    with open(Path(d) / "shift.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps(ev, ensure_ascii=False) + "\n")
    print(f"{ROBOTS[robot][2]} {ROBOTS[robot][0]}: {text}")


def tests_pass(d):
    return run([sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider"], d, check=False).returncode == 0


# ---------- the toy project ----------

TOY_CODE = '''\
"""A lemonade stand's till."""
import math

PRICE_PER_CUP = 1.50
CODES = {"SUMMER": 0.20}


def order_total(cups, tip_percent=0, code=None):
    subtotal = cups * PRICE_PER_CUP
    if code in CODES:
        subtotal = subtotal * (1 - CODES[code])
    tip = subtotal * tip_percent / 100
    return round(subtotal + tip, 2)


def old_order_total(cups):
    return cups * 1.25
'''

TOY_TEST = '''\
from lemonade import order_total


def test_two_cups():
    assert order_total(2) == 3.0


def test_summer_code():
    assert order_total(10, code="SUMMER") == 12.0
'''


def init(d):
    d = Path(d)
    d.mkdir(parents=True, exist_ok=True)
    (d / "lemonade.py").write_text(TOY_CODE, encoding="utf-8")
    (d / "tests").mkdir(exist_ok=True)
    (d / "tests" / "test_lemonade.py").write_text(TOY_TEST, encoding="utf-8")
    (d / "pyproject.toml").write_text('[tool.pytest.ini_options]\npythonpath = ["."]\n', encoding="utf-8")
    (d / ".gitignore").write_text("shift.jsonl\nbite_proof/\n__pycache__/\n", encoding="utf-8")
    git(d, "init", "-q", "-b", "main")
    git(d, "config", "user.name", "Lemonade Stand")
    git(d, "config", "user.email", "stand@example.invalid")
    git(d, "add", "lemonade.py", "tests", "pyproject.toml", ".gitignore")
    git(d, "commit", "-q", "-m", "Lemonade stand till")
    print(f"toy project ready in {d}")


# ---------- the writer ----------

def commit(d, msg, says, robot="writer"):
    git(d, "add", "-u")
    for f in git(d, "ls-files", "--others", "--exclude-standard").splitlines():
        git(d, "add", f)
    git(d, "-c", f"user.name={ROBOTS[robot][0][4:].title()} (Claude)", "commit", "-q", "-m", msg)
    sha = git(d, "rev-parse", "--short=8", "HEAD")
    stat = git(d, "show", "--stat", "--format=", "HEAD").splitlines()[-1].strip()
    log(d, robot, says, sha=sha, subject=msg, stat=stat)


# ---------- the skeptic ----------

SKEPTIC = {
    "noticed": "Took your change back out and ran the tests. {why} went red. Fine. I believe you. This time.",
    "no_test_noticed": "Took your change back out and ran the tests. Everything stayed green. "
                       "So nothing proves it works, and nothing will notice if it disappears. Prove it: add a test "
                       "that fails without your change.",
    "its_tests_didnt_notice": "You added a test, but it still passes with your change taken out. "
                              "It tests nothing you did. Try again.",
    "tests_fail": "The tests already fail here, so I can't tell you anything. Fix that first.",
    "undone_later": "This fix is already gone from today's code.",
    "skipped": "Nothing for me to prove here: {reason}. I'll allow it.",
}


def bite(d, *args):
    p = run(["bite", "--free", "--again", "--json", *args], d, check=False)
    try:
        return json.loads(p.stdout)
    except json.JSONDecodeError:
        sys.exit(f"bite gave no JSON:\n{p.stdout[-2000:]}\n{p.stderr[-2000:]}")


LOOKS = (".css", ".html", ".svg", ".png", ".jpg", ".gif", ".ico", ".md", ".txt")


def skeptic(d, sha=None):
    sha = sha or git(d, "rev-parse", "--short=8", "HEAD")
    files = git(d, "show", "--name-only", "--format=", sha).split()
    if files and all(f.lower().endswith(LOOKS) for f in files):  # CH's rule: looks get a pass, logic needs a test
        log(d, "skeptic", "Only looks and words in this one (" + ", ".join(files) + "). Tests can't judge how "
            "things look, so it gets a pass. Logic still has to prove itself.", sha=sha, result="looks_pass")
        return
    if files and all(re.search(r"(^|/)(tests?/|test_)|\.test\.|_test\.", f) for f in files):
        log(d, "skeptic", "Only tests in this one. I check code: there's nothing here for me to take back out. "
            "A new test proves itself when it catches something.", sha=sha, result="tests_only")
        return
    r = bite(d, "--any", "--only", sha)
    hits = [c for c in r["commits"] if c["sha"].startswith(sha[:7]) or sha.startswith(c["sha"][:7])]
    if not hits:
        log(d, "skeptic", f"Nothing for me to check in {sha}. {r.get('message', '')}".strip(), sha=sha)
        return
    c = hits[0]
    why = re.search(r"\b(test_\w+)", c.get("label", "") + " " + c.get("detail", ""))
    text = SKEPTIC.get(c["result"], c["detail"]).format(why=why.group(1) if why else "A test", detail=c["detail"],
                                                 reason=re.sub(r"^Skipped:\s*", "", c["detail"]).rstrip("."))
    added = sum(int(x.split("\t")[0]) for x in git(d, "show", "--numstat", "--format=", sha).splitlines()
                if x.split("\t")[0].isdigit())
    only_deleted = files and (added == 0 or git(d, "show", "--name-only", "--diff-filter=D", "--format=", sha).split() == files)
    if c["result"] == "no_test_noticed" and only_deleted:
        text = ("You only deleted something. I put it back and every test stayed green, so it really was doing "
                "nothing. Fine.")
    part = re.search(r"but not (.+?): with only that part taken out", c.get("detail", ""))
    if c["result"] == "no_test_noticed" and part:
        text = (f"Your tests notice most of this, but not {part.group(1)}. I took just that part out and every test "
                "stayed green. If it breaks, nobody finds out. Prove it.")
    log(d, "skeptic", text, sha=sha, result=c["result"], bite_label=c["label"], bite_detail=c["detail"])


# ---------- the janitor ----------

JS_DECL = re.compile(r"^(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=)", re.M)


def js_sweep(d):
    """Top-level functions and constants in the app's own .js files whose name is used nowhere else in the project
    (code, tests, pages). Returns [(file, first line, last line, name)]."""
    src = [p for p in d.rglob("*.js") if "node_modules" not in p.parts and ".test." not in p.name]
    every = "\n".join(p.read_text(encoding="utf-8") for p in d.rglob("*")
                      if p.suffix in (".js", ".html", ".mjs") and "node_modules" not in p.parts)
    found = []
    for p in src:
        text = p.read_text(encoding="utf-8")
        lines = text.splitlines()
        for m in JS_DECL.finditer(text):
            name = m.group(1) or m.group(2)
            if len(re.findall(rf"\b{re.escape(name)}\b", every)) > 1:
                continue
            start = text.count("\n", 0, m.start())
            end = start  # the declaration ends where the braces balance and the statement closes
            depth = 0
            for i in range(start, len(lines)):
                depth += lines[i].count("{") + lines[i].count("(") - lines[i].count("}") - lines[i].count(")")
                end = i
                if depth <= 0 and (lines[i].rstrip().endswith(("}", ";", ")")) or i > start and depth == 0):
                    break
            found.append((str(p.relative_to(d)), start + 1, end + 1, name))
    return found


def janitor(d):
    d = Path(d)
    if (d / "package.json").exists():
        return janitor_js(d)
    p = run([sys.executable, "-m", "vulture", ".", "--min-confidence", "60", "--sort-by-size",
             "--exclude", "bite_proof"], d,
            check=False)
    found = []
    for line in p.stdout.splitlines():
        m = re.match(r"(.+?):(\d+): unused (import|function|variable) '(\w+)'.*?(\d+) lines?\)", line)
        if m and not re.match(r"(tests?[\\/]|test_)", m.group(1)):
            found.append((m.group(1), int(m.group(2)), m.group(3), m.group(4), int(m.group(5))))
    if not found:
        log(d, "janitor", "Swept the whole place. Nothing dead lying around.")
        return
    by_file = {}
    for f, ln, kind, name, size in found:
        by_file.setdefault(f, []).append((ln, kind, name, size))
    for f, items in by_file.items():
        path = d / f
        lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
        for ln, kind, name, size in sorted(items, reverse=True):
            del lines[ln - 1:ln - 1 + size]
        text = re.sub(r"\n{4,}", "\n\n\n", "".join(lines)).rstrip("\n") + "\n"
        path.write_text(text, encoding="utf-8")
    names = [f"{kind} {name}" for _, _, kind, name, _ in found]
    if not tests_pass(d):
        git(d, "checkout", "--", ".")
        log(d, "janitor", f"Tried to sweep up {', '.join(names)}, but the tests went red, so I put it all back.")
        return
    git(d, "add", "-u")
    git(d, "-c", "user.name=Janitor (vulture)", "commit", "-q", "-m", "Tidy up: remove unused " + ", ".join(names))
    sha = git(d, "rev-parse", "--short=8", "HEAD")
    log(d, "janitor", f"Swept up the unused {', '.join(names)}. Tests still green, so it stays swept.",
        sha=sha, swept=names)


def janitor_js(d):
    found = js_sweep(d)
    if not found:
        log(d, "janitor", "Swept the whole place. Nothing dead lying around.")
        return
    for f in {x[0] for x in found}:
        lines = (d / f).read_text(encoding="utf-8").splitlines(keepends=True)
        for _, a, b, _ in sorted((x for x in found if x[0] == f), key=lambda x: -x[1]):
            del lines[a - 1:b]
        (d / f).write_text(re.sub(r"\n{3,}", "\n\n", "".join(lines)), encoding="utf-8")
    names = [x[3] for x in found]
    if run(["npm", "test", "--silent"], d, check=False).returncode:
        git(d, "checkout", "--", ".")
        log(d, "janitor", f"Tried to sweep up {', '.join(names)}, but the tests went red, so I put it all back.")
        return
    git(d, "add", "-u")
    git(d, "-c", "user.name=Janitor", "commit", "-q", "-m", "Tidy up: remove unused " + ", ".join(names))
    sha = git(d, "rev-parse", "--short=8", "HEAD")
    log(d, "janitor", f"Swept up {', '.join(names)}: nothing anywhere uses it. Tests still green, so it stays swept.",
        sha=sha, swept=names)


# ---------- the planner: the idea comes from a dice roll, not from a person ----------

IDEAS_URL = "https://raw.githubusercontent.com/florinpop17/app-ideas/master/README.md"
# Rules fixed before any roll: an idea is rolled again only if it can't be built and tested offline in a browser.
NEEDS_OUTSIDE = re.compile(r"\b(DB|Database|Weather|GitHub|API|Calendar|Book Finder|Charity|Sales|Bank|Server|"
                           r"Chat|Login|Spell|Translator|Meme|Movie|Music|Podcast|Slack|Twitter)\b", re.I)


def pick(d, tier="1-Beginner"):
    import secrets
    import urllib.request
    text = urllib.request.urlopen(IDEAS_URL, timeout=30).read().decode("utf-8")
    ideas = [(m.group(1).strip(), m.group(2).strip()) for m in
             re.finditer(r"^\|\s*\[([^\]]+)\]\([^)]*\)\s*\|\s*([^|]+?)\s*\|\s*" + tier + r"\s*\|", text, re.M)]
    if not ideas:
        sys.exit("couldn't read the idea list")
    rolls = []
    while True:
        n = secrets.randbelow(len(ideas))
        name, what = ideas[n]
        rolls.append(f"{n + 1} ({name})")
        if not NEEDS_OUTSIDE.search(name + " " + what):
            break
    d = Path(d)
    d.mkdir(parents=True, exist_ok=True)
    extra = f" Rerolled {len(rolls) - 1}x first, because {', '.join(rolls[:-1])} needs the internet or a database." \
        if len(rolls) > 1 else ""
    (d / "IDEA.txt").write_text(f"{name}: {what}\n", encoding="utf-8")
    log(d, "planner", f"Nobody picks what we build, so I rolled a {len(ideas)}-sided die on a public list of beginner "
        f"app ideas. It came up {rolls[-1].split()[0]}: \"{name}\" ({what}).{extra}",
        roll=rolls, idea=name, source=IDEAS_URL)
    return name, what


def plan(d, *steps):
    text = "Here's the plan. " + " ".join(f"{i}) {s}" for i, s in enumerate(steps, 1)) + \
        " One step at a time, a test with each, and the skeptic checks every one."
    log(d, "planner", text, steps=list(steps))


def new_js(d, name):
    """An empty browser project: the logic in plain JavaScript files, tested with Node's own test runner."""
    d = Path(d)
    d.mkdir(parents=True, exist_ok=True)
    (d / "package.json").write_text(json.dumps({"name": re.sub(r"\W+", "-", name.lower()).strip("-"), "private": True,
                                                "type": "module", "scripts": {"test": "node --test"}}, indent=2) + "\n")
    (d / ".gitignore").write_text("shift.jsonl\nbite_proof/\nnode_modules/\n", encoding="utf-8")
    git(d, "init", "-q", "-b", "main")
    git(d, "config", "user.email", "team@example.invalid")
    git(d, "add", "package.json", ".gitignore", "IDEA.txt")
    git(d, "-c", "user.name=Planner (Claude)", "commit", "-q", "-m", "Empty project: " + name)


# ---------- the historian ----------

def historian(d):
    r = bite(d, "--free-checks", "40")  # fix claims only: undoing a "simplify" is no loss
    back = [c for c in r["commits"] if c["result"] == "undone_later"
            and re.search(r"\b(fix|fixe[sd]|bug|repair|resolve[sd]?)\b", c["subject"], re.I)]
    if not back:
        log(d, "historian", f"Read the whole history. Every fix that was made is still here.")
        return
    for c in back:
        by = (c.get("undone_by") or {}).get("sha", "")
        by_subj = (c.get("undone_by") or {}).get("subject", "")
        by_who = git(d, "log", "-1", "--format=%an", by, check=False) if by else ""
        warned = any(json.loads(l).get("result") == "no_test_noticed" and c["sha"].startswith(json.loads(l).get("sha", "-"))
                     for l in (Path(d) / "shift.jsonl").read_text(encoding="utf-8").splitlines() if l.strip())
        text = (f"Hold on. The fix \"{c['subject']}\" is gone from today's code. "
                f"{by_who or 'Someone'}'s commit \"{by_subj or 'a later one'}\" quietly put the old code back. "
                "The tests stayed green the whole time, because no test guarded it."
                + (" The skeptic warned you about exactly this." if warned else ""))
        log(d, "historian", text, sha=c["sha"][:8], result="undone_later", undone_by=by[:8])


# ---------- the page ----------

# Each robot's face, drawn in code (40x40). The circle behind it takes the robot's colour from the page.
_HEAD = ('<rect x="7" y="11" width="26" height="22" rx="7" fill="{c}" stroke="{d}" stroke-width="1.6"/>'
         '<rect x="11" y="15" width="18" height="12" rx="4" fill="#0f1720"/>'
         '<rect x="4" y="18" width="3.5" height="8" rx="1.5" fill="{d}"/><rect x="32.5" y="18" width="3.5" height="8" rx="1.5" fill="{d}"/>')
_EYES = '<circle cx="16" cy="20.5" r="2.1" fill="#7ff3ff"/><circle cx="24" cy="20.5" r="2.1" fill="#7ff3ff"/>'
_SMILE = '<path d="M16.5 24.2q3.5 2.4 7 0" stroke="#7ff3ff" stroke-width="1.4" fill="none" stroke-linecap="round"/>'
_ANT = '<path d="M20 11V6" stroke="{d}" stroke-width="1.6"/>'
FACES = {
    "writer": ("#4f86ea", "#1f4fa3", _EYES + _SMILE + _ANT
               + '<circle cx="20" cy="5" r="2" fill="#7ff3ff" stroke="#1f4fa3" stroke-width="1"/>'
               '<g transform="rotate(35 29 8)"><rect x="27.5" y="1" width="3.2" height="12" fill="#f5c542" stroke="#8a6526" stroke-width=".8"/>'
               '<path d="M27.5 13h3.2l-1.6 3z" fill="#f2d7a6" stroke="#8a6526" stroke-width=".8"/></g>'),
    "builder": ("#4f86ea", "#1f4fa3", _EYES + '<path d="M17 24.6h6" stroke="#7ff3ff" stroke-width="1.4" stroke-linecap="round"/>'
                '<path d="M8 12.5a12 9 0 0 1 24 0z" fill="#f5c542" stroke="#8a6526" stroke-width="1.2"/>'
                '<rect x="6" y="11.5" width="28" height="2.6" rx="1.3" fill="#e0a92c" stroke="#8a6526" stroke-width=".8"/>'
                '<path d="M20 4.5v7" stroke="#8a6526" stroke-width="1"/>'),
    "planner": ("#d79a22", "#7a5208", '<rect x="13" y="18.5" width="6" height="4.2" rx="1" fill="none" stroke="#7ff3ff" stroke-width="1.3"/>'
                '<rect x="21" y="18.5" width="6" height="4.2" rx="1" fill="none" stroke="#7ff3ff" stroke-width="1.3"/>'
                '<path d="M19 20.4h2" stroke="#7ff3ff" stroke-width="1.1"/><path d="M17 25.2h6" stroke="#7ff3ff" stroke-width="1.3" stroke-linecap="round"/>'
                + _ANT + '<rect x="17" y="1.5" width="6" height="5" rx="1" fill="#fff6dd" stroke="#7a5208" stroke-width="1"/>'
                '<path d="M18.3 3.4h3.4M18.3 5h2.2" stroke="#7a5208" stroke-width=".7"/>'),
    "playtester": ("#d79a22", "#7a5208", _EYES + _SMILE + '<path d="M6 19a14 12 0 0 1 28 0" fill="none" stroke="#3a2a12" stroke-width="2.2"/>'
                   '<rect x="3" y="16.5" width="5" height="9" rx="2.2" fill="#3a2a12"/><rect x="32" y="16.5" width="5" height="9" rx="2.2" fill="#3a2a12"/>'),
    "skeptic": ("#e2672a", "#8a3510", '<circle cx="16" cy="21" r="2" fill="#ffd36e"/><path d="M22.4 21h3.6" stroke="#ffd36e" stroke-width="1.8" stroke-linecap="round"/>'
                '<path d="M13.5 17.4l5-.6" stroke="#ffd36e" stroke-width="1.3" stroke-linecap="round"/>'
                '<path d="M21.8 16.4l5 1.8" stroke="#ffd36e" stroke-width="1.3" stroke-linecap="round"/>'
                '<path d="M17 25.4l6-.8" stroke="#ffd36e" stroke-width="1.3" stroke-linecap="round"/>'
                + _ANT + '<circle cx="20" cy="4.6" r="2.6" fill="#ffd36e" stroke="#8a3510" stroke-width="1"/>'
                '<path d="M19 3.6q1-1.4 2 0t-1 1.6v.4" fill="none" stroke="#8a3510" stroke-width=".7"/>'),
    "janitor": ("#38a35f", "#1d6338", _EYES + _SMILE + '<path d="M8.5 12.6a11.5 6.5 0 0 1 23 0z" fill="#1d6338"/>'
                '<path d="M8.5 12.4h17l4 2.2h-21z" fill="#14482a"/>'),
    "historian": ("#8a5fd6", "#4a2a8f", _EYES + '<circle cx="24" cy="20.5" r="3.6" fill="none" stroke="#f5c542" stroke-width="1.2"/>'
                  '<path d="M27.4 22l1.6 6" stroke="#f5c542" stroke-width=".8"/><path d="M16.5 25h7" stroke="#7ff3ff" stroke-width="1.3" stroke-linecap="round"/>'
                  + _ANT + '<circle cx="20" cy="4.4" r="2.2" fill="none" stroke="#4a2a8f" stroke-width="1.4"/>'),
}


def face(robot, cls="av"):
    c, d, extra = FACES[robot]
    return (f'<svg class="{cls}" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" class="halo"/>'
            + _HEAD.format(c=c, d=d) + extra.replace("{d}", d) + "</svg>")


PAGE = """<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>__TITLE__</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,800&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400&display=swap">
<style>
/* The night shift: a dark office header with the crew on the sill, then the team chat on paper-white. */
:root{--bg:#eef1ec;--fg:#16201a;--mut:#5a6760;--panel:#fff;--line:#d5ddd6;--ink:#0d1626;
--writer:#2f6fdb;--planner:#a2700a;--skeptic:#d2561c;--janitor:#2c8a4f;--historian:#7a4fc4;--tint:.08;
--display:"Bricolage Grotesque",ui-sans-serif,system-ui,sans-serif;
--body:"Atkinson Hyperlegible",ui-sans-serif,system-ui,sans-serif;--mono:"JetBrains Mono",ui-monospace,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0f1512;--fg:#e4ebe6;--mut:#97a59c;
--panel:#18211d;--line:#2a3630;--writer:#7aa7ff;--planner:#e8b84a;--skeptic:#ff8a52;--janitor:#5fcf8a;--historian:#b896ff;--tint:.13;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0f1512;--fg:#e4ebe6;--mut:#97a59c;--panel:#18211d;--line:#2a3630;
--writer:#7aa7ff;--planner:#e8b84a;--skeptic:#ff8a52;--janitor:#5fcf8a;--historian:#b896ff;--tint:.13;color-scheme:dark}
*{box-sizing:border-box}
html{overflow-x:clip}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 var(--body)}
a{color:var(--writer)}
.writer,.builder{--c:var(--writer)}.planner,.playtester{--c:var(--planner)}.skeptic{--c:var(--skeptic)}.janitor{--c:var(--janitor)}.historian{--c:var(--historian)}
.wrap{max-width:760px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
/* header */
header{position:relative;color:#eef2fb;background:
 radial-gradient(120% 90% at 85% 0%,#25365c 0%,transparent 60%),linear-gradient(#0b1220,#131d33);overflow:hidden}
header::before{content:"";position:absolute;inset:0;opacity:.55;pointer-events:none;
 background:repeating-linear-gradient(90deg,transparent 0 46px,rgba(255,255,255,.035) 46px 48px),
 repeating-linear-gradient(0deg,transparent 0 30px,rgba(255,255,255,.03) 30px 32px)}
.win{position:absolute;right:max(28px,calc(50% - 360px));top:26px;width:64px;height:64px;border-radius:50%;
 box-shadow:-16px 10px 0 0 #f2d88f;filter:drop-shadow(0 0 18px rgba(242,216,143,.45));transform:rotate(-8deg)}
header .wrap{position:relative;padding-top:30px}
.eyebrow{padding-right:72px;display:flex;gap:10px;align-items:center;color:#a9b6d3;font-size:.92rem;margin:0 0 10px}
.eyebrow svg{width:18px;height:18px;flex:none}
h1{font:800 clamp(2rem,6.4vw,3.1rem)/1.02 var(--display);margin:0 0 10px;text-wrap:balance;letter-spacing:-.02em;max-width:15ch}
.sub{color:#c3cde3;margin:0 0 22px;max-width:56ch;font-size:1.04rem}
.crew{display:flex;gap:2px;align-items:flex-end;margin-top:6px;position:relative;z-index:1}
.crew svg{width:58px;height:58px;margin-bottom:-12px;filter:drop-shadow(0 6px 8px rgba(0,0,0,.35))}
.crew svg .halo{fill:none}
.sill{height:14px;background:linear-gradient(#3a2a1c,#2a1e14);border-top:2px solid #5a432c;position:relative}
/* cast */
.cast{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:26px 0 22px}
.badge{display:flex;gap:12px;align-items:center;min-width:0;background:var(--panel);border:1px solid var(--line);
 border-left:4px solid var(--c);border-radius:10px;padding:10px 12px;box-shadow:0 1px 0 rgba(0,0,0,.04)}
.badge b{display:block;font:800 1rem/1.2 var(--display)}.badge span{display:block;color:var(--mut);font-size:.88rem;line-height:1.3;margin-top:2px}
@media (min-width:600px){.cast{grid-template-columns:repeat(auto-fit,minmax(132px,1fr))}.badge{flex-direction:column;text-align:center;border-left-width:1px;border-top:4px solid var(--c);padding:14px 10px 12px}.badge svg{width:52px;height:52px}}
.badge svg{width:44px;height:44px;flex:none}
.halo{fill:var(--c);opacity:.15}
/* controls */
.bar{position:sticky;top:0;z-index:5;display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 0;
 background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
button{font:700 .98rem var(--body);border:1px solid var(--line);background:var(--panel);color:var(--fg);border-radius:10px;
 padding:9px 16px;cursor:pointer;display:inline-flex;gap:8px;align-items:center;transition:transform .12s,box-shadow .12s}
button:hover{transform:translateY(-1px);box-shadow:0 3px 10px rgba(0,0,0,.08)}
button:focus-visible{outline:2px solid var(--writer);outline-offset:2px}
#play{background:var(--ink);color:#fff;border-color:var(--ink)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) #play{background:#e9eef8;color:#0d1626;border-color:#e9eef8}}
:root[data-theme="dark"] #play{background:#e9eef8;color:#0d1626;border-color:#e9eef8}
button svg{width:14px;height:14px}
.count{margin-left:auto;color:var(--mut);font-size:.88rem;font-variant-numeric:tabular-nums}
.prog{position:absolute;left:0;bottom:-1px;height:2px;background:var(--writer);width:0;transition:width .3s}
/* chat */
#chat{padding-top:6px}
.msg{display:flex;gap:11px;margin:16px 0;transition:opacity .35s,transform .35s}
.msg.off{display:none}
.msg.in{animation:pop .35s ease-out}
@keyframes pop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.msg>svg{width:40px;height:40px;flex:none;margin-top:2px}
.bub{min-width:0;flex:1;border-radius:4px 16px 16px 16px;padding:10px 14px;border:1px solid var(--line);
 background:color-mix(in srgb,var(--c) calc(var(--tint)*100%),var(--panel));box-shadow:0 1px 0 rgba(0,0,0,.03)}
.who{font:800 .95rem var(--display);color:var(--c);display:flex;flex-wrap:wrap;gap:0 8px;align-items:baseline}
.who span{color:var(--mut);font:400 .82rem var(--body)}
.who i{color:var(--mut);font:italic 400 .8rem var(--body)}
.meta{color:var(--mut);font-size:.8rem;margin-top:6px;overflow-wrap:anywhere}
code{font:.82em var(--mono);background:color-mix(in srgb,var(--fg) 7%,transparent);padding:1px 4px;border-radius:4px}
.typing{display:none;gap:11px;margin:16px 0;align-items:center}
.typing.on{display:flex}.typing svg{width:40px;height:40px}
.dots{display:inline-flex;gap:4px;padding:12px 14px;border-radius:4px 16px 16px 16px;background:var(--panel);border:1px solid var(--line)}
.dots i{width:7px;height:7px;border-radius:50%;background:var(--mut);animation:b 1s infinite}
.dots i:nth-child(2){animation-delay:.15s}.dots i:nth-child(3){animation-delay:.3s}
@keyframes b{0%,60%,100%{opacity:.3;transform:none}30%{opacity:1;transform:translateY(-3px)}}
.note{border-top:1px solid var(--line);margin:34px 0 0;padding:18px 0 28px;font-size:.94rem;color:var(--mut)}
.note b{color:var(--fg)}.note p{margin:0 0 10px;max-width:68ch}
.home{display:inline-flex;align-items:center;gap:6px;color:#eef2fb;text-decoration:none;font:700 .92rem var(--body);
 background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);border-radius:10px;padding:7px 12px 7px 9px;margin:0 0 18px}
.home:hover{background:rgba(255,255,255,.14)}.home svg{width:16px;height:16px}
.pager{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 56px}
.pager a{display:block;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px;text-decoration:none;color:var(--fg);min-width:0}
.pager a:hover{border-color:var(--writer)}
.pager small{display:block;color:var(--mut);font-size:.82rem}.pager b{font:800 1rem/1.25 var(--display)}
.pager .next{text-align:right;grid-column:2}.pager .all{grid-column:1/-1;text-align:center}
@media (max-width:520px){.crew svg{width:46px;height:46px;margin-bottom:-10px}.win{width:44px;height:44px;top:20px;right:30px;box-shadow:-11px 7px 0 0 #f2d88f}
.count{width:100%;margin:0}.badge{padding:8px 10px;gap:9px}.badge svg{width:36px;height:36px}.badge b{font-size:.92rem}.badge span{font-size:.8rem}}
@media (prefers-reduced-motion:reduce){.msg.in{animation:none}.dots i{animation:none}button{transition:none}}
</style>
<header><div class="win"></div><div class="wrap">
<a class="home" href="../"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3 5 8l5 5"/></svg>All shifts</a>
<p class="eyebrow"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="8"/><path d="M10 5v5l3 2"/></svg>__EYEBROW__</p>
<h1>__H1__</h1>
<p class="sub">__SUB__</p>
<div class="crew">__CREW__</div>
</div><div class="sill"></div></header>
<main class="wrap">
<div class="cast">__CAST__</div>
<div class="bar" style="position:sticky"><button id="play" type="button"><svg viewBox="0 0 14 14"><path d="M3 1.5v11l9.5-5.5z" fill="currentColor"/></svg>Play the shift</button>
<button id="all" type="button">Show it all</button><span class="count" id="count"></span><span class="prog" id="prog"></span></div>
<div id="chat">__MSGS__
<div class="typing" id="typing"></div></div>
<div class="note">__NOTE__</div>
<!--pager--><!--/pager-->
</main>
<script>
const ms=[...document.querySelectorAll('.msg')],ty=document.getElementById('typing'),cnt=document.getElementById('count'),
pr=document.getElementById('prog');let timers=[],shown=ms.length;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
function upd(){cnt.textContent=shown+' of '+ms.length+' messages';pr.style.width=(shown/ms.length*100)+'%'}
function stop(){timers.forEach(clearTimeout);timers=[];ty.classList.remove('on')}
document.getElementById('all').onclick=()=>{stop();ms.forEach(m=>m.classList.remove('off'));shown=ms.length;upd()};
document.getElementById('play').onclick=()=>{stop();ms.forEach(m=>m.classList.remove('in'),m=>0);ms.forEach(m=>m.classList.add('off'));shown=0;upd();
 let t=300;ms.forEach((m,i)=>{
  timers.push(setTimeout(()=>{ty.className='typing on '+m.dataset.r;ty.innerHTML=m.querySelector('svg').outerHTML+'<span class="dots"><i></i><i></i><i></i></span>';
   m.after(ty);ty.scrollIntoView({block:'nearest',behavior:reduce?'auto':'smooth'})},t));
  t+=Math.min(1600,500+m.textContent.length*6);
  timers.push(setTimeout(()=>{ty.classList.remove('on');m.classList.remove('off');m.classList.add('in');shown=i+1;upd();
   m.scrollIntoView({block:'nearest',behavior:reduce?'auto':'smooth'})},t));t+=450;});};
upd();
</script>
<!-- Cloudflare Web Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "347028dc90f94b878df232f9dd259d00"}'></script><!-- End Cloudflare Web Analytics -->
</html>"""


def page(d, out, note="", h1="My dev team is 4 robots",
         sub="And one of them doesn't trust the others. One real shift on a tiny lemonade-stand till, __DATE__."):
    evs = [json.loads(l) for l in (Path(d) / "shift.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    seen = [k for k in ROBOTS if k in {ev["robot"] for ev in evs}]
    cast = "".join(f'<div class="badge {k}">{face(k)}<div><b>{html.escape(ROBOTS[k][0])}</b>'
                   f'<span>{html.escape(ROBOTS[k][1])}</span></div></div>' for k in seen)
    crew = "".join(f'<span class="{k}" title="{html.escape(ROBOTS[k][0])}">{face(k, "")}</span>' for k in seen)
    msgs = []
    for ev in evs:
        name, who, _ = ROBOTS[ev["robot"]]
        meta = []
        if ev.get("subject"):
            meta.append(f'commit <code>{ev["sha"]}</code> “{html.escape(ev["subject"])}”')
        elif ev.get("sha"):
            meta.append(f'about <code>{ev["sha"]}</code>')
        if ev.get("bite_label"):
            meta.append(f'Bite said: {html.escape(ev["bite_label"])}')
        meta.append(datetime.datetime.fromisoformat(ev["t"]).astimezone(EASTERN).strftime("%-I:%M %p ET"))
        tag = ("<i>staged on purpose</i>" if ev.get("staged") else
               "<i>voiced by Claude</i>" if ev.get("voiced") else "")
        if ev.get("link"):
            meta.insert(0, f'<a href="{html.escape(ev["link"])}" target="_blank" rel="noopener">source</a>')
        msgs.append(f'<div class="msg {ev["robot"]}" data-r="{ev["robot"]}">{face(ev["robot"])}'
                    f'<div class="bub"><div class="who">{name} <span>{html.escape(who)}</span>{tag}</div>'
                    f'{html.escape(ev["text"])}<div class="meta">{" · ".join(meta)}</div></div></div>')
    date = datetime.datetime.fromisoformat(evs[0]["t"]).astimezone(EASTERN).strftime("%B %-d, %Y") if evs else ""
    first = datetime.datetime.fromisoformat(evs[0]["t"]).astimezone(EASTERN).strftime("%-I:%M %p") if evs else ""
    last = datetime.datetime.fromisoformat(evs[-1]["t"]).astimezone(EASTERN).strftime("%-I:%M %p ET") if evs else ""
    eyebrow = f"Night shift · {date} · {first} to {last}" if evs else "Night shift"
    Path(out).write_text(PAGE.replace("__CAST__", cast).replace("__CREW__", crew).replace("__MSGS__", "\n".join(msgs))
                         .replace("__NOTE__", note).replace("__TITLE__", html.escape(h1) + " · Trust Issues")
                         .replace("__H1__", html.escape(h1)).replace("__EYEBROW__", html.escape(eyebrow))
                         .replace("__SUB__", html.escape(sub)).replace("__DATE__", date), encoding="utf-8")
    link_shifts(Path(out).parent)
    print(f"page: {out}")


def _shift_key(p):
    m = re.match(r"(\d{4}-\d\d-\d\d)(?:-build-(\d+))?$", p.stem)
    return (m.group(1), int(m.group(2) or 0)) if m else (p.stem, 0)


def link_shifts(folder):
    """Fills the prev / next / all-shifts links at the bottom of every replay page in a folder, in shift order."""
    pages = sorted((p for p in Path(folder).glob("*.html") if re.search(r"<!--pager-->", p.read_text(encoding="utf-8"))),
                   key=_shift_key)
    titles = [re.search(r"<h1>(.*?)</h1>", p.read_text(encoding="utf-8"), re.S).group(1) for p in pages]
    for i, p in enumerate(pages):
        parts = []
        if i > 0:
            parts.append(f'<a class="prev" href="{pages[i-1].name}"><small>&larr; Previous shift</small><b>{titles[i-1]}</b></a>')
        if i + 1 < len(pages):
            parts.append(f'<a class="next" href="{pages[i+1].name}"><small>Next shift &rarr;</small><b>{titles[i+1]}</b></a>')
        parts.append('<a class="all" href="../"><b>All shifts</b></a>')
        t = p.read_text(encoding="utf-8")
        t = re.sub(r"<!--pager-->.*?<!--/pager-->", lambda m: '<!--pager--><nav class="pager" aria-label="More shifts">'
                   + "".join(parts) + "</nav><!--/pager-->", t, flags=re.S)
        p.write_text(t, encoding="utf-8")

if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    cmd, d = a[0], a[1]
    if cmd == "init":
        init(d)
    elif cmd == "commit":
        commit(d, a[2], a[3])
    elif cmd == "build":
        commit(d, a[2], a[3], "builder")
    elif cmd == "pick":
        pick(d)
    elif cmd == "plan":
        plan(d, *a[2:])
    elif cmd == "new":
        new_js(d, a[2])
    elif cmd == "say":
        log(d, a[2], a[3], staged=True)
    elif cmd == "talk":  # an opinion in the debate, written by Claude in that robot's voice (shown as "voiced")
        log(d, a[2], a[3], voiced=True, **({"link": a[4]} if len(a) > 4 else {}))
    elif cmd == "skeptic":
        skeptic(d, a[2] if len(a) > 2 else None)
    elif cmd == "janitor":
        janitor(d)
    elif cmd == "historian":
        historian(d)
    elif cmd == "page":
        page(d, a[2], *a[3:6])
    else:
        sys.exit(__doc__)
