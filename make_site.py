"""Builds index.html, the front page GitHub Pages serves: the crew and a card per shift. Run from the repo root:

  python make_site.py

Add a new shift to SH below, then run it again."""
import sys, re, html
from pathlib import Path
sys.path.insert(0, '.')
import robot_team as rt
style = re.search(r'<style>(.*?)</style>', rt.PAGE, re.S).group(1)
SH = [
 ("2026-11-02", "The first shift", "Four robots, one lemonade-stand till with bugs planted on purpose, and a fix that a later commit quietly undid.", None, None),
 ("2026-11-02-build-1", "Build 1: a converter people asked for since 2015", "Nobody told them what to make. They found an open request and built the missing StyleCop settings converter.", "https://github.com/connabyss/trust-issues/tree/main/builds/stylecop-mover", "See the tool"),
 ("2026-11-02-build-2", "Build 2: a birth-sky map", "The real night sky for any date, time and city, with the constellations and the moon.", "builds/birth-sky/", "Open the sky map"),
 ("2026-11-02-build-3", "Build 3: a shared sky", "Two birthdays, two cities, one map of the stars you both had overhead.", "builds/shared-sky/", "Open the shared sky"),
 ("2026-11-02-build-4", "Build 4: Worldseed", "Type a word, get a planet that writes 6,000 years of its own history.", "builds/worldseed/", "Make a planet"),
 ("2026-11-02-build-5", "Build 5: Driftwood Island", "An island that is always running, worked out from the real clock.", "builds/driftwood-island/", "Visit the island"),
 ("2026-11-02-build-6", "Build 6: the island evolves", "Genes you can see, new kinds that split off and get names.", "builds/driftwood-island/", "Visit the island"),
 ("2026-11-02-build-7", "Build 7: something hunts", "Prowlers that see, chase and evolve, and coats that work as camouflage.", "builds/driftwood-island/", "Visit the island"),
 ("2026-11-02-build-8", "Build 8: a grazer of your own", "Adopt one grazer and come back to find out what happened while you were away.", "builds/driftwood-island/", "Adopt a grazer"),
]
import json
cards = []
for slug, t, d, link, ltxt in SH:
    evs = [json.loads(l) for l in Path(f'shifts/{slug}.jsonl').read_text(encoding='utf-8').splitlines() if l.strip()]
    who = [k for k in rt.ROBOTS if k in {e['robot'] for e in evs}]
    faces = ''.join(f'<span class="{k}">{rt.face(k, "")}</span>' for k in who)
    extra = f'<a class="ghost" href="{link}">{ltxt}</a>' if link else ''
    cards.append(f'<article class="shift"><div class="faces">{faces}</div><h3>{html.escape(t)}</h3><p>{html.escape(d)}</p>'
                 f'<div class="acts"><a class="go" href="shifts/{slug}.html"><svg viewBox="0 0 14 14"><path d="M3 1.5v11l9.5-5.5z" fill="currentColor"/></svg>Watch the shift</a>{extra}</div>'
                 f'<span class="n">{len(evs)} messages</span></article>')
cast = ''.join(f'<div class="badge {k}">{rt.face(k)}<div><b>{html.escape(n)}</b><span>{html.escape(w)}</span></div></div>'
               for k, (n, w, _) in rt.ROBOTS.items())
crew = ''.join(f'<span class="{k}">{rt.face(k, "")}</span>' for k in rt.ROBOTS)
extra_css = '''
.wrap{max-width:960px}
h2{font:800 1.5rem/1.2 var(--display);margin:34px 0 4px}.lead{color:var(--mut);margin:0 0 16px;max-width:62ch}
.shifts{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
.shift{position:relative;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px 16px;display:flex;flex-direction:column}
.shift h3{font:800 1.12rem/1.25 var(--display);margin:8px 0 4px}.shift p{margin:0 0 14px;color:var(--mut);font-size:.95rem;flex:1}
.faces{display:flex}.faces svg{width:30px;height:30px;margin-right:-4px}.faces svg .halo{fill:none}
.n{position:absolute;top:16px;right:16px;color:var(--mut);font-size:.8rem}
.acts{display:flex;gap:8px;flex-wrap:wrap}
.acts a{font:700 .92rem var(--body);text-decoration:none;border-radius:10px;padding:8px 14px;display:inline-flex;gap:8px;align-items:center}
.acts svg{width:12px;height:12px}
.go{background:var(--ink);color:#fff}.ghost{border:1px solid var(--line);color:var(--fg)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .go{background:#e9eef8;color:#0d1626}}
:root[data-theme="dark"] .go{background:#e9eef8;color:#0d1626}
.how{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:12px}
.how div{border-top:3px solid var(--c);padding-top:8px}.how b{font:800 1rem var(--display)}.how p{margin:4px 0 0;color:var(--mut);font-size:.93rem}
footer{border-top:1px solid var(--line);margin-top:40px;padding:18px 0 48px;color:var(--mut);font-size:.9rem}
'''
out = f'''<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Trust Issues: my dev team is robots</title>
<meta name="description" content="Robots build things overnight and keep each other honest. Nobody gets to say fixed and walk away. Watch the shifts.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://connabyss.github.io/trust-issues/">
<meta property="og:title" content="Trust Issues: my dev team is robots">
<meta property="og:description" content="Robots build things overnight and keep each other honest. Nobody gets to say fixed and walk away. Watch the shifts.">
<meta property="og:image" content="https://connabyss.github.io/trust-issues/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="My dev team is robots: seven little robots on a night-office windowsill under the moon">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,800&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400&display=swap">
<style>{style}{extra_css}</style>
<header><div class="win"></div><div class="wrap">
<p class="eyebrow"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="8"/><path d="M10 5v5l3 2"/></svg>Trust Issues · the night shift</p>
<h1>My dev team is robots</h1>
<p class="sub">And one of them doesn't trust the others. They build things overnight, and nobody gets to say "fixed" and walk away.</p>
<div class="crew">{crew}</div>
</div><div class="sill"></div></header>
<main class="wrap">
<h2>The crew</h2>
<p class="lead">Every robot is a real tool. The skeptic is <a href="https://github.com/connabyss/bite">Bite</a>: it takes each fix back out and runs the tests. If they all stay green, nothing proves the fix works, and it says so.</p>
<div class="cast">{cast}</div>
<h2>Watch a shift</h2>
<p class="lead">Each shift plays back like a group chat. Every commit, test run and Bite verdict in them really happened; lines a robot "said" in a debate are marked.</p>
<div class="shifts">{''.join(cards)}</div>
<footer>Made by <a href="https://github.com/connabyss">connabyss</a> with Claude. The code, the logs and how to run your own shift: <a href="https://github.com/connabyss/trust-issues">github.com/connabyss/trust-issues</a>.</footer>
</main>
<!-- Cloudflare Web Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{{"token": "347028dc90f94b878df232f9dd259d00"}}'></script><!-- End Cloudflare Web Analytics -->
</html>'''
Path('index.html').write_text(out, encoding='utf-8')
