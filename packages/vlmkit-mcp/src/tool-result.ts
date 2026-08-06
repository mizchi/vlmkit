/**
 * The MCP tool shape and its result envelope.
 *
 * Split out of `tools.ts` so `gate-tool.ts` can build tools without importing
 * the tool list — otherwise the list would import the adapter and the adapter
 * the list.
 */

import type { z } from "zod";

export interface McpToolResult {
  /** Human/agent-readable one-liner + the report, as MCP text content. */
  content: Array<{ type: "text"; text: string }>;
  /** True when the gate failed (verdict NOT ok/done). Surfaced to isError. */
  failed: boolean;
  /** The raw structured report, for tests and structured-content clients. */
  structured: unknown;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: z.ZodRawShape;
  run: (args: Record<string, unknown>) => Promise<McpToolResult>;
}

export function toolResult(summary: string, structured: unknown, failed: boolean): McpToolResult {
  return {
    content: [{ type: "text", text: `${summary}\n\n${JSON.stringify(structured, null, 2)}` }],
    failed,
    structured,
  };
}
