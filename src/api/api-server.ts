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
import { buildBenchDetectionSeries, readBenchHistory } from "../experiments/benchmark/bench-history.ts";
import { createApiApp } from "./api-app.ts";

const args = process.argv.slice(2);
const PORT = parseInt(args.find((_arg, index) => args[index - 1] === "--port") ?? "3456", 10);

const app = createApiApp({
  serverUrl: `http://127.0.0.1:${PORT}`,
  listDetectionSeries: async (query) => buildBenchDetectionSeries(await readBenchHistory(), query),
});

console.log(`vrt API server on http://127.0.0.1:${PORT}`);
serve({ fetch: app.fetch, port: PORT, hostname: "127.0.0.1" });
