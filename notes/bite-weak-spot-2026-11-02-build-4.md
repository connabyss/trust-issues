# A Bite weak spot found during build 4 (2026-11-02)

A test that runs a script as its own program counts as "couldn't load", not "caught".

- Commit 50f0305 "Draw the globe" added `tools/snapshot.mjs`. A later commit added `test/snapshot.test.js`, which runs
  `node tools/snapshot.mjs ...` with `execFileSync` and checks the picture it writes.
- Delete `tools/snapshot.mjs` today and `npm test` goes red: 31 pass, 1 fail.
- Yet `bite --free --any --only 50f0305` says ⚠️ PART NOT NOTICED: "not the new file tools/snapshot.mjs ... every test
  still passes".

Why (checked with bite 1.0.0): with the file gone, Node's output says `Cannot find module`. `bite.load_failure()`
matches that in `LOAD_ERRORS`, and no line matches `CHECK_FAILS` (the failure is a thrown error from the child process,
not an assertion), so `today_notices()` returns None ("can't tell") and the part stays flagged.

Repro: the build-4 project (builds/worldseed), commit 50f0305, Bite 1.0.0. Not touched: the Bite repo needs CH's OK.
Possible fix: when the missing module is the very file the change took out, a failing test that names it is noticing
the change, not a broken setup.

Second example, same shift: commit "The page: type a word..." added `tools/bundle.mjs`; the next commit's test runs it with
`execFileSync`. Delete the file and `npm test` gives 68 pass, 1 fail with `Error: Cannot find module '.../tools/bundle.mjs'`,
yet Bite reports PART NOT NOTICED for it.
