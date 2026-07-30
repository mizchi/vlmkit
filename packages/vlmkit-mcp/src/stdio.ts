#!/usr/bin/env node
/**
 * stdio entry point for the vlmkit MCP server.
 * Run via `vlmkit mcp` (CLI subcommand) or directly with
 * `node --experimental-strip-types packages/vlmkit-mcp/src/stdio.ts`.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createVlmkitMcpServer } from "./server.ts";

export async function runStdioServer(): Promise<void> {
  const server = createVlmkitMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "mcp-stdio" ||
  (process.argv[1] ? process.argv[1].endsWith("stdio.ts") || process.argv[1].endsWith("stdio.js") : false);
if (isCliEntry) {
  runStdioServer().catch((err) => {
    process.stderr.write(`vlmkit mcp failed: ${String(err)}\n`);
    process.exit(1);
  });
}
