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
- `shifts/`: each shift's log (`.jsonl`) and its chat replay page (`.html`).
- `notes/`: things the robots turned up.
