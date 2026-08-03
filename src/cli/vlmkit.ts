#!/usr/bin/env node
/**
 * vlmkit -- unified CLI entry point.
 *
 * Thin shim around `runCli()` in `./cli.ts`. The cac-based command
 * tree lives there; this file just hands argv off.
 */
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { runCli } from "./cli.ts";

// Through `handleCliError` so a usage error — including one raised while a leaf
// module reads its own argv at import time — prints one line instead of a stack.
runCli().catch(handleCliError);
