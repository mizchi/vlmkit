# Adopt vlmkit into the orders console

You have joined a team that owns `consumer/` — an internal orders console. It is not
your code and you are not here to redesign it. Your job is the one a platform engineer
gets on their first week:

> "We keep shipping visual and accessibility regressions that our tests don't catch.
> Somebody recommended vlmkit. Evaluate it: get it running against our console, get
> whatever it finds in front of us, and get it into CI as something we'd actually keep.
>
> Three hard constraints.
>
> **One: do not break `pnpm test`.** That suite is what the whole team runs before
> pushing. If adopting a tool makes our own tests fail, we revert the tool, not our
> tests. Run it before you start so you know what green looks like.
>
> **Two: whatever you add has to be reviewable.** Assume I read the diff and nothing
> else. If the knowledge lives in a command you typed once, it is not adopted.
>
> **Three: don't edit the console to make a check pass.** If a check reports something,
> that's a finding for us to triage — write it down. The one exception is if you're
> confident a check is reporting something that is not actually a problem; then say so
> and say why."

## Where things are

- `consumer/` — the console. Run its server with `node consumer/serve.mjs 4310`
  (prints the URL). Run its test suite with `cd consumer && pnpm test` — that works
  offline with no install, so there is no excuse for not checking it.
- vlmkit is not published anywhere you can reach. Invoke it from the checkout you are
  sitting in: `node --experimental-strip-types src/cli/vlmkit.ts <args>`, run from
  `/home/user/vlmkit`. Treat that as the equivalent of `npx vlmkit`.

## What to hand back

1. A committed configuration under `consumer/` that a CI job can run as one short
   command, and the command.
2. A written list of what vlmkit found, separating "this is a real problem in our
   console" from "this is the tool being wrong or unhelpful".
3. Evidence that `pnpm test` still passes.
