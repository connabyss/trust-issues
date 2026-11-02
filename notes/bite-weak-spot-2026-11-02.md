# A Bite weak spot the robot team found (2026-11-02)

The janitor's tidy-up confused the skeptic.

- Commit 6f3051ea "Fix tips rounding down by a cent" had no test. A later commit added
  test_tip_rounds_half_cent_up, which does catch it.
- `bite --free --only 6f3051ea` says: ✅ a later test notices. Correct.
- Then the janitor removed `import math`, the line right below the fix's new `from decimal ...` line.
- After that, a full `bite --free --any` run says 6f3051ea: ⚠️ NO TEST NOTICED. Wrong.

Why: recent.py today_notices() checks the old change with `git apply -R --check` on today's code. The
janitor's edit changed the patch's context lines, so the patch no longer applies, today_notices returns
None ("can't tell"), and flag() falls back to "unguarded".
Possible fix: retry with less context (e.g. `git apply -R --unidiff-zero` on a -U0 diff, or `-3`), or say
"can't tell" instead of NO TEST NOTICED. Not touched: the Bite repo needs CH's OK.
Repro: the toy project from robot_team.py (shift log shift_2026-11-02.jsonl).
