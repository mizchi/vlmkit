#!/usr/bin/env bash
# The whole CI job. One command, no flags to review:  ./ci.sh
#
# `cd "$(dirname "$0")"` is not cosmetic: relative paths inside
# vlmkit.gates.json (--har dashboard.har) are resolved against the PROCESS CWD,
# not against the config file, so running `gates run --config <path>` from the
# repo root fails with a raw Playwright ENOENT stack trace. See log.md.
set -euo pipefail
cd "$(dirname "$0")"

PORT=5202
node serve.mjs "$PORT" &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  curl --fail --silent "http://localhost:$PORT/" >/dev/null && break
  sleep 1
done
curl --fail --silent "http://localhost:$PORT/" >/dev/null

VLMKIT=${VLMKIT:-"node --experimental-strip-types /home/user/vlmkit/src/cli/vlmkit.ts"}
$VLMKIT gates run --output gate-logs --show-output
