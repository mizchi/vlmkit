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
import type {
  ApprovalListQuery,
  ApprovalOperationApiRequest,
  ComponentStatusMatrixQuery,
} from "./api-types.ts";
import { buildBenchDetectionSeries, readBenchHistory } from "../experiments/benchmark/bench-history.ts";
import {
  applyApprovalOperation,
  listApprovalManifest,
} from "../vrt/snapshot/approval-operations.ts";
import { buildSnapshotStatusMatrix, parseSnapshotReport } from "../vrt/snapshot/snapshot-report.ts";
import { createApiApp } from "./api-app.ts";

const args = process.argv.slice(2);
const PORT = parseInt(args.find((_arg, index) => args[index - 1] === "--port") ?? "3456", 10);
const DEFAULT_SNAPSHOT_REPORT_PATH = "test-results/snapshots/ci/snapshot-report.json";
const DEFAULT_APPROVAL_PATH = "approval.json";
const ROOT = resolve(process.cwd());

function resolveProjectPath(path: string | undefined, fallback: string): string | null {
  const resolved = resolve(ROOT, path ?? fallback);
  const rel = relative(ROOT, resolved);
  if (rel === ".." || rel.startsWith("../")) return null;
  return resolved;
}

async function getLocalComponentStatusMatrix(query: ComponentStatusMatrixQuery) {
  const resolved = resolveProjectPath(query.report, DEFAULT_SNAPSHOT_REPORT_PATH);
  if (!resolved) {
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

async function listLocalApprovals(query: ApprovalListQuery) {
  const resolved = resolveProjectPath(query.path, DEFAULT_APPROVAL_PATH);
  if (!resolved) {
    return {
      path: "",
      total: 0,
      rules: [],
      warnings: [],
    };
  }
  return listApprovalManifest(resolved);
}

async function applyLocalApprovalOperation(request: ApprovalOperationApiRequest) {
  const resolved = resolveProjectPath(request.path, DEFAULT_APPROVAL_PATH);
  if (!resolved) {
    throw new Error("Approval path must stay under the project root");
  }
  const operation = request.action === "add"
    ? {
      action: "add" as const,
      rule: request.rule,
      dryRun: request.dryRun,
    }
    : {
      action: "remove" as const,
      index: request.index,
      dryRun: request.dryRun,
    };
  return applyApprovalOperation(resolved, operation);
}

const app = createApiApp({
  serverUrl: `http://127.0.0.1:${PORT}`,
  listDetectionSeries: async (query) => buildBenchDetectionSeries(await readBenchHistory(), query),
  getComponentStatusMatrix: getLocalComponentStatusMatrix,
  listApprovals: listLocalApprovals,
  applyApprovalOperation: applyLocalApprovalOperation,
});

console.log(`vrt API server on http://127.0.0.1:${PORT}`);
serve({ fetch: app.fetch, port: PORT, hostname: "127.0.0.1" });
