# motion-heldout: pages the motion tools were not built on

25 pages written on 2026-11-02 by an agent that never saw the checker's code, its fixtures or its
reports, only `inspect motion --help` for flag names. For each of ten defect classes from
motion-repair rounds 1-14 there is a broken page that shows the defect in another form (Web
Animations API, the individual `translate` / `rotate` / `scale` properties, SVG, `offset-path`,
`inset-inline-start`, `CSS.registerProperty`, `[hidden]`) and a correct page built to look like
the defect (a clip-path wipe, an arc that is meant to rise, a pendulum about its top edge, a steps()
loader). Four plain pages have ordinary motion. `cases.json` holds each brief, the arguments a user
would pass from it, and since the first run the verdict expected of `inspect motion` and
`check animation`; `packages/vlmkit-markup/src/inspect/motion-heldout.test.ts` holds both to it.

The first run (report `docs/reports/2026-11-02-motion-heldout-v1.md`) found 2 broken pages passed,
1 refused with an error, 4 correct pages failed and 2 correct pages flagged by `check animation`.
Every one was fixed. The set is no longer held out: the next check of the same kind needs pages
nobody has tuned against.
