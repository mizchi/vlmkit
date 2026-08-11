// REPRODUCIBILITY PROBE — not part of the CI setup.
//
// Same page + stylesheet + held-open /api/live as serve.mjs, but /api/metrics
// returns fresh random numbers on every request, which is what the real
// deployment does. Used to answer: "does a gate verdict move when the metric
// values move?" Run on a spare port and point the same gate plan at it.
//
//   node serve-jitter.mjs 5203
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] ?? 5203);
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json" };
const ri = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

const server = createServer(async (req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  if (path === "/api/live") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    res.write(": connected\n\n");
    return; // never ended, exactly like serve.mjs
  }
  if (path === "/api/metrics") {
    const body = { queueDepth: ri(4, 98412), p95Ms: ri(7, 19833), errorRate: ri(1, 9999) / 10000, region: "apne1" };
    console.log("metrics", JSON.stringify(body));
    res.writeHead(200, TYPES[".json"]);
    res.end(JSON.stringify(body));
    return;
  }
  const file = path === "/" ? "index.html" : path.replace(/^\//, "");
  try {
    const b = await readFile(join(here, file));
    res.writeHead(200, { "content-type": TYPES[file.slice(file.lastIndexOf("."))] ?? "application/octet-stream" });
    res.end(b);
  } catch {
    res.writeHead(404, TYPES[".html"]);
    res.end("<h1>404</h1>");
  }
});
server.listen(port, () => console.log(`jitter server on http://localhost:${port}/`));
