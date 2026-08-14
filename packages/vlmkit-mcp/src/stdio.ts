#!/usr/bin/env node
/**
 * stdio entry point for the vlmkit MCP server.
 * Run via `vlmkit mcp` (CLI subcommand) or directly with
 * `node --experimental-strip-types packages/vlmkit-mcp/src/stdio.ts`.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createVlmkitMcpServer } from "./server.ts";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";

export async function runStdioServer(): Promise<void> {
  const server = createVlmkitMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (isCliEntry(import.meta.url, "mcp-stdio")) {
  runStdioServer().catch((err) => {
    process.stderr.write(`vlmkit mcp failed: ${String(err)}\n`);
    process.exit(1);
  });
}
