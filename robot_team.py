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

PAGE = """<title>Robot Dev Team</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,750&family=Atkinson+Hyperlegible:wght@400;700&family=JetBrains+Mono:wght@400&display=swap">
<style>
/* Layout: one narrow chat column, a cast strip on top, the log reads like a team chat transcript */
:root{--bg:#f3f5f2;--fg:#17201b;--mut:#5d6a62;--panel:#ffffff;--line:#d9e0da;
--writer:#2f6fdb;--planner:#a2700a;--skeptic:#d2561c;--janitor:#2c8a4f;--historian:#7a4fc4;--tint:.10;
--display:"Bricolage Grotesque",ui-sans-serif,system-ui,sans-serif;
--body:"Atkinson Hyperlegible",ui-sans-serif,system-ui,sans-serif;--mono:"JetBrains Mono",ui-monospace,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#121815;--fg:#e4ebe6;--mut:#94a39a;
--panel:#1b2420;--line:#2c3832;--writer:#7aa7ff;--planner:#e8b84a;--skeptic:#ff8a52;--janitor:#5fcf8a;--historian:#b896ff;--tint:.16;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#121815;--fg:#e4ebe6;--mut:#94a39a;--panel:#1b2420;--line:#2c3832;
--writer:#7aa7ff;--planner:#e8b84a;--skeptic:#ff8a52;--janitor:#5fcf8a;--historian:#b896ff;--tint:.16;color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--fg);font:16px/1.55 var(--body)}
main{max-width:720px;margin:0 auto;padding-block:28px 64px;padding-left:max(16px,env(safe-area-inset-left,0px));
padding-right:max(16px,env(safe-area-inset-right,0px))}
h1{font:750 clamp(1.7rem,5vw,2.4rem)/1.1 var(--display);margin:0 0 6px;text-wrap:balance;letter-spacing:-.01em}
.sub{color:var(--mut);margin:0 0 22px;max-width:60ch}
.cast{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:22px}
.cast div{display:flex;gap:10px;align-items:center;min-width:0;font-size:.9rem;color:var(--mut)}
.cast b{display:block;color:var(--fg)}
.av{flex:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:var(--bg);
font:750 .95rem var(--display);background:var(--c)}
.writer,.builder{--c:var(--writer)}.planner{--c:var(--planner)}.skeptic{--c:var(--skeptic)}.janitor{--c:var(--janitor)}.historian{--c:var(--historian)}
.bar{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 6px}
button{font:inherit;border:1px solid var(--line);background:var(--panel);color:var(--fg);border-radius:8px;
padding:6px 12px;cursor:pointer}button:focus-visible{outline:2px solid var(--writer);outline-offset:2px}
.msg{display:flex;gap:10px;margin:14px 0;transition:opacity .35s,transform .35s}
.msg.off{opacity:0;transform:translateY(6px)}
.bub{min-width:0;border-radius:4px 14px 14px 14px;padding:9px 13px;border:1px solid var(--line);
background:color-mix(in srgb,var(--c) calc(var(--tint)*100%),var(--panel))}
.who{font:750 .9rem var(--display);color:var(--c)}.who span{color:var(--mut);font:400 .8rem var(--body)}
.staged{font:400 .72rem var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--mut);
border:1px dashed var(--line);border-radius:6px;padding:0 6px;margin-left:6px}
.meta{color:var(--mut);font-size:.8rem;margin-top:4px;overflow-wrap:anywhere}
code{font:.82em var(--mono)}
.note{border-top:1px solid var(--line);margin-top:28px;padding-top:14px;font-size:.92rem;color:var(--mut)}
.note b{color:var(--fg)}.note p{margin:0 0 10px;max-width:65ch}
@media (prefers-reduced-motion:reduce){.msg{transition:none}}
</style>
<main>
<h1>__H1__</h1>
<p class="sub">__SUB__</p>
<div class="cast">__CAST__</div>
<div class="bar"><button id="play" type="button">Play the shift</button><button id="all" type="button">Show it all</button></div>
<div id="chat">__MSGS__</div>
<div class="note">__NOTE__</div>
</main>
<script>
const ms=[...document.querySelectorAll('.msg')];let timers=[];
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
document.getElementById('all').onclick=()=>{timers.forEach(clearTimeout);ms.forEach(m=>m.classList.remove('off'))};
document.getElementById('play').onclick=()=>{timers.forEach(clearTimeout);ms.forEach(m=>m.classList.add('off'));
timers=ms.map((m,i)=>setTimeout(()=>{m.classList.remove('off');m.scrollIntoView({block:'nearest',behavior:reduce?'auto':'smooth'})},400+i*1600));};
</script>"""


def page(d, out, note="", h1="My dev team is 4 robots",
         sub="And one of them doesn't trust the others. One real shift on a tiny lemonade-stand till, __DATE__."):
    evs = [json.loads(l) for l in (Path(d) / "shift.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    seen = {ev["robot"] for ev in evs}
    cast = "".join(f'<div class="{k}"><span class="av">{n.split()[-1][0].upper()}</span>'
                   f'<span><b>{html.escape(n)}</b>{html.escape(w)}</span></div>'
                   for k, (n, w, _) in ROBOTS.items() if k in seen)
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
        tag = ('<span class="staged">staged</span>' if ev.get("staged") else
               '<span class="staged">voiced by Claude</span>' if ev.get("voiced") else "")
        if ev.get("link"):
            meta.insert(0, f'<a href="{html.escape(ev["link"])}" target="_blank" rel="noopener">source</a>')
        msgs.append(f'<div class="msg {ev["robot"]}"><span class="av">{name.split()[-1][0].upper()}</span>'
                    f'<div class="bub"><div class="who">{name} <span>{html.escape(who)}</span>{tag}</div>'
                    f'{html.escape(ev["text"])}<div class="meta">{" · ".join(meta)}</div></div></div>')
    date = datetime.datetime.fromisoformat(evs[0]["t"]).astimezone(EASTERN).strftime("%B %-d, %Y") if evs else ""
    Path(out).write_text(PAGE.replace("__CAST__", cast).replace("__MSGS__", "\n".join(msgs))
                         .replace("__NOTE__", note).replace("__H1__", html.escape(h1))
                         .replace("__SUB__", html.escape(sub)).replace("__DATE__", date), encoding="utf-8")
    print(f"page: {out}")


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
