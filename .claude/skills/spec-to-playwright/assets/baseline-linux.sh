#!/usr/bin/env sh
# Generate VRT baselines inside the official Playwright linux container so they
# match CI. Key fixes (learned the hard way):
#  - `-v /work/node_modules` anonymous volume: keep the host's (e.g. darwin)
#    binaries out of the linux container, else `@rollup/rollup-linux-*` is missing
#    and the vite webServer crashes.
#  - `--ipc=host`: chromium shared memory.
# Native arch only. Do NOT add `--platform=linux/amd64` on Apple Silicon: the
# emulated amd64 chromium gets SIGKILLed. Generate amd64 baselines on real amd64.
set -eu
docker run --rm --network host --ipc=host \
  -v "$PWD":/work -v /work/node_modules -w /work \
  mcr.microsoft.com/playwright:v1.61.1-noble \
  sh -c "corepack enable && pnpm install --frozen-lockfile=false && pnpm exec playwright test --update-snapshots"
