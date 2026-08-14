/**
 * vlmkit MCP server — registers the deterministic verification gates
 * (tools.ts) onto an McpServer. Transport-agnostic; stdio.ts and any
 * HTTP transport share this.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TOOLS } from "./tools.ts";

export function createVlmkitMcpServer(): McpServer {
  const server = new McpServer(
    { name: "vlmkit", version: "0.10.0" },
    {
      instructions:
        "vlmkit exposes deterministic (no-VLM) verification gates for markup: verify_markup (done-condition verdict + kickback), check_interactions (a11y-event state map + optional --reference behavioral contract), scan_handlers (wired event surface + pointer-only-control detection), check_copy (copy fidelity). Use these to gate generated/edited UI: the kickback text is the next-fix list. A residual is real unless the tool itself marks it pixel-confirmed/demoted.",
    },
  );

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      async (args: Record<string, unknown>) => {
        const r = await tool.run(args);
        return {
          content: r.content,
          isError: r.failed,
        };
      },
    );
  }

  return server;
}
