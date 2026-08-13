// The console's dev server. `/api/orders` answers with live data whose values move,
// and `/api/stream` is held open for the life of the page.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = join(dirname(fileURLToPath(import.meta.url)), "public");
const port = Number(process.argv[2] ?? 4310);
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8" };
let tick = 0;

createServer(async (req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  if (path === "/api/stream") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    res.write(": open\n\n");
    return; // never ended, on purpose
  }
  if (path === "/api/orders") {
    tick++;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify([
      { id: `A-${1000 + tick}`, customer: "Acme GmbH", total: `$${(120 + tick).toFixed(2)}`, state: "open" },
      { id: `A-${1001 + tick}`, customer: "Northwind", total: `$${(87 + tick).toFixed(2)}`, state: "shipped" },
      { id: `A-${1002 + tick}`, customer: "Contoso", total: `$${(64 + tick).toFixed(2)}`, state: "cancelled" },
    ]));
    return;
  }
  const file = path === "/" ? "index.html" : path.replace(/^\//, "");
  try {
    const body = await readFile(join(here, file));
    res.writeHead(200, { "content-type": TYPES[file.slice(file.lastIndexOf("."))] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, TYPES[".html"]);
    res.end("<h1>404</h1>");
  }
}).listen(port, () => console.log(`orders console on http://localhost:${port}/`));
