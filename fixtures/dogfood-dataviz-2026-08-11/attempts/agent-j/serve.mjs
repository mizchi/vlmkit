// A dev server for the ops dashboard.
//
// Serves the page and stylesheet, answers the metrics call, and — like the tile
// server in the adoption report that started all this — holds one request open
// forever. That is not a bug to fix; it is what the real deployment does, and it
// is why the page never reaches network quiescence.
//
//   node serve.mjs [port]      # default 5199, prints the URL it bound
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] ?? 5199);

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json" };

const server = createServer(async (req, res) => {
  const path = (req.url ?? "/").split("?")[0];

  // The live feed. Held open on purpose: an EventSource-shaped endpoint that
  // streams for the life of the page, so `networkidle` never fires.
  if (path === "/api/live") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    res.write(": connected\n\n");
    return; // never ended
  }

  if (path === "/api/metrics") {
    res.writeHead(200, TYPES[".json"]);
    res.end(JSON.stringify({ queueDepth: 148, p95Ms: 412, errorRate: 0.031, region: "apne1" }));
    return;
  }

  const file = path === "/" ? "index.html" : path.replace(/^\//, "");
  try {
    const body = await readFile(join(here, file));
    const ext = file.slice(file.lastIndexOf("."));
    res.writeHead(200, { "content-type": TYPES[ext] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, TYPES[".html"]);
    res.end("<h1>404</h1>");
  }
});

server.listen(port, () => console.log(`ops dashboard on http://localhost:${port}/`));
