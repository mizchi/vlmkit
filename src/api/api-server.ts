#!/usr/bin/env node
/**
 * vrt API server
 *
 * Built with Hono. For local Node.js execution.
 * Structured to share the same app factory with Cloudflare Workers.
 *
 * Usage: node src/api/api-server.ts [--port 3456]
 */
import { serve } from "@hono/node-server";
import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import type { ComponentStatusMatrixQuery } from "./api-types.ts";
import { buildBenchDetectionSeries, readBenchHistory } from "../experiments/benchmark/bench-history.ts";
import { buildSnapshotStatusMatrix, parseSnapshotReport } from "../vrt/snapshot/snapshot-report.ts";
import { createApiApp } from "./api-app.ts";

const args = process.argv.slice(2);
const PORT = parseInt(args.find((_arg, index) => args[index - 1] === "--port") ?? "3456", 10);
const DEFAULT_SNAPSHOT_REPORT_PATH = "test-results/snapshots/ci/snapshot-report.json";
const ROOT = resolve(process.cwd());

async function getLocalComponentStatusMatrix(query: ComponentStatusMatrixQuery) {
  const reportPath = query.report ?? DEFAULT_SNAPSHOT_REPORT_PATH;
  const resolved = resolve(ROOT, reportPath);
  const rel = relative(ROOT, resolved);
  if (rel === ".." || rel.startsWith("../")) {
    return buildSnapshotStatusMatrix({
      timestamp: "",
      urls: [],
      labels: [],
      results: [],
    });
  }
  try {
    const report = parseSnapshotReport(await readFile(resolved, "utf-8"));
    return buildSnapshotStatusMatrix(report, {
      labels: query.label ? [query.label] : undefined,
      viewports: query.viewport ? [query.viewport] : undefined,
    });
  } catch {
    return buildSnapshotStatusMatrix({
      timestamp: "",
      urls: [],
      labels: [],
      results: [],
    });
  }
}

const app = createApiApp({
  serverUrl: `http://127.0.0.1:${PORT}`,
  listDetectionSeries: async (query) => buildBenchDetectionSeries(await readBenchHistory(), query),
  getComponentStatusMatrix: getLocalComponentStatusMatrix,
});

console.log(`vrt API server on http://127.0.0.1:${PORT}`);
serve({ fetch: app.fetch, port: PORT, hostname: "127.0.0.1" });
