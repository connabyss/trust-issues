# trust-issues: my dev team is 4 robots

...and one of them doesn't trust the others.

Four robots work one tiny project overnight and keep each other honest. Nobody gets to say "fixed" and walk away.

| | Robot | Who it really is | Its job |
|---|---|---|---|
| ✍️ | **The writer** | Claude | Fixes bugs, commits, and announces it a little too proudly. |
| 🧐 | **The skeptic** | [Bite](https://github.com/connabyss/bite) | Takes each fix back out and runs the tests. If they all stay green, nothing proves the fix works, and it says so. |
| 🧹 | **The janitor** | [vulture](https://github.com/jendrikseipp/vulture) | Sweeps up dead code. Keeps the sweep only if the tests stay green. |
| 📜 | **The historian** | Bite's comeback alarm | Reads the whole history and catches a fix that a later commit quietly undid. |

## The workplace

A lemonade stand's till, about 15 lines of Python, with bugs planted on purpose:

- Ordering **-3 cups** hands the customer $4.50.
- **3 cups with a 15% tip** comes to $5.17 instead of $5.18 (the computer stores 5.175 as 5.17499...).
- Typing **"summer"** instead of "SUMMER" gets no discount.

## The first shift (November 2, 2026)

Open [shifts/2026-11-02.html](shifts/2026-11-02.html) in a browser and press **Play the shift** to watch it like a group chat. The short version:

1. The writer fixes the negative cups, with a test. The skeptic undoes it, the test goes red: *"Fine. I believe you. This time."*
2. The writer fixes the tip rounding, **no test**. The skeptic: *"Prove it."* The writer adds one. Now it holds.
3. The writer fixes lowercase codes, skips the test again: *"It's one line. What could possibly go wrong?"*
4. The janitor sweeps up an unused import and an old function.
5. The writer "simplifies" the discount check. All green! (It just put the old bug back.)
6. The historian: *"Hold on. The fix is gone from today's code... The skeptic warned you about exactly this."*
7. The writer puts the fix back, **with** a test this time. The historian: *"Every fix that was made is still here."*

**What was real:** every skeptic, janitor and historian line came from a real run of Bite or vulture, and every writer line is a real commit Claude made. **What was staged:** the two lines marked "staged" on the page (the writer skipping a test, and the "simplify" that undid a fix) were done on purpose to show what happens.

**Bonus:** the janitor's tidy-up confused the skeptic and turned up a real Bite weak spot. See [notes/bite-weak-spot-2026-11-02.md](notes/bite-weak-spot-2026-11-02.md).

## Build 1: a converter people have asked for since 2015 (November 2, 2026)

In v2 nobody tells the team what to make. The planner went looking for real people asking for a tool they couldn't
find, the robots argued over four real GitHub requests, and they picked one that had been open since 2015: moving old
StyleCop settings to the new StyleCop analyzers. When a contributor closed it in October 2026, the answer was still "there is no
converter, start from scratch." Then they built one.

What we checked before saying that (November 2, 2026): GitHub repository search ("Settings.StyleCop stylecop.json",
"stylecop convert editorconfig", "stylecop migrate", "stylecop settings converter"), a web search for a NuGet package
or dotnet tool, and the StyleCop Analyzers issues and docs. We found no converter. The closest things: JetBrains
Rider and ReSharper can read a Settings.StyleCop file directly, and RempelOliveira/SA-RulesetToEditorConfig converts
the newer .ruleset files (a different format). Not finding one doesn't prove none exists.

- The tool: [builds/stylecop-mover](builds/stylecop-mover/) (24 tests).
- The chat replay: open [shifts/2026-11-02-build-1.html](shifts/2026-11-02-build-1.html) and press **Play the shift**.
- The build's own commits: [shifts/2026-11-02-build-1.commits.txt](shifts/2026-11-02-build-1.commits.txt).

Highlights: the skeptic sent work back twice (an untested rule-table maker, then an empty file that did nothing), and
the builder caught three of its own mistakes (a renamed rule, a wrong "every rule is on by default" claim, and
comments EditorConfig doesn't allow). Nothing planted, nothing staged; the debate lines are tagged "voiced by Claude".

New roles: **the planner** (Claude) finds the job and splits it into steps, **the builder** (Claude) builds one step at
a time. The skeptic lets look-only changes (pages, styles, docs) through; logic still needs a test.

## Build 2: a birth-sky map (November 2, 2026)

Build 1 was called niche, so the planner added one rule for every pitch: would a normal person play with it and send
it to a friend? GitHub's biggest fun request (bringing back Claude Code's terminal pet) already had six fan-made
answers, so the robots pitched their own ideas and the skeptic judged them. The winner: the real night sky for any
date, time and city, with the constellations and the moon's phase, and a link you can send.

- The page: [builds/birth-sky](builds/birth-sky/) (open `index.html` through a small web server; 35 tests).
- The chat replay: [shifts/2026-11-02-build-2.html](shifts/2026-11-02-build-2.html).
- The build's own commits: [shifts/2026-11-02-build-2.commits.txt](shifts/2026-11-02-build-2.commits.txt).

Highlights: one step landed with a red test (Serpens comes in two pieces, and the second overwrote the first), and
the next commit fixed it. Bite believed the moon-drawing step, yet the page drew the full moon as a dark disc: the
test counted shapes but never asked which way the light bulges. Looking at the page caught it, and a new test now
does too. The page's 41 lines of wiring script pass under the looks rule, and the README says no test covers them.

## Run your own shift

Free, no API key. You need Python 3.10+ and git.

```
pip install bite-check pytest vulture
python robot_team.py init shop                 # make the lemonade stand, bugs included
# ...fix a bug in shop/lemonade.py, then:
python robot_team.py commit shop "Fix ..." "what the writer says"
python robot_team.py skeptic shop              # Bite checks the newest commit
python robot_team.py janitor shop              # sweep dead code, tests must stay green
python robot_team.py historian shop            # any fix quietly undone?
python robot_team.py page shop shift.html      # turn the shift into a chat page
```

Every robot line is saved to `shop/shift.jsonl` as it happens. In this first version the writer is Claude doing the fixes by hand, then calling the script.

## Files

- `robot_team.py`: the whole team in one script.
- `builds/`: what the team built.
- `shifts/`: each shift's log (`.jsonl`) and its chat replay page (`.html`).
- `notes/`: things the robots turned up.
