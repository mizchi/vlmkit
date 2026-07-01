# Markup Loop Project Example

This is a minimal standalone UI project that reproduces the drop-in markup loop.

Run from the repository root:

```sh
node examples/markup-loop-project/run.mjs
```

The script starts a local dashboard app, then runs:

```sh
vlmkit markup-loop init
vlmkit markup-loop observe
vlmkit markup-loop doctor
vlmkit markup-loop run --dry-run
```

It intentionally uses `--dry-run` for the final step so the example is deterministic
and does not require an LLM API key. To run generation for real, start the server
and run `pnpm exec vlmkit markup-loop run` from this directory with a configured
provider key.
