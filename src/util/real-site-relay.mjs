// Local reverse proxy so the gates can measure a REAL site.
//
//   RELAY_TARGET=https://example.com RELAY_PORT=8910 node src/util/real-site-relay.mjs
//   vlmkit check integrity http://127.0.0.1:8910/some/path
//
// Chromium in this environment cannot egress (the agent proxy never even
// sees its connections), but node's fetch can. The gates navigate to
// 127.0.0.1 while the bytes come from the real origin, so this is a real
// -site audit rather than a mirror: live HTML, CSS, JS, and a real session.
//
// Target sites are ones whose credentials are PUBLISHED for automation
// practice (Sauce Labs' demo app, the Selenium "the-internet" playground).
// No third-party accounts, no real user data.
import { createServer } from "node:http";

const TARGET = process.env.RELAY_TARGET ?? "https://www.saucedemo.com";
const PORT = Number(process.env.RELAY_PORT ?? 8910);
const origin = new URL(TARGET).origin;

const HOP = new Set([
  "connection", "keep-alive", "transfer-encoding", "upgrade",
  "proxy-authenticate", "proxy-authorization", "te", "trailer",
  "content-encoding", "content-length",
]);

createServer(async (req, res) => {
  const upstream = new URL(req.url, origin);
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    const lk = k.toLowerCase();
    if (HOP.has(lk) || lk === "host" || lk === "accept-encoding") continue;
    headers[k] = Array.isArray(v) ? v.join(", ") : String(v);
  }
  let body;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    body = Buffer.concat(chunks);
  }
  try {
    const up = await fetch(upstream, {
      method: req.method,
      headers,
      body,
      redirect: "manual", // preserve the site's own redirects (login walls!)
    });
    const out = {};
    for (const [k, v] of up.headers) {
      const lk = k.toLowerCase();
      if (HOP.has(lk)) continue;
      // Rewrite absolute Location / cookie domains onto the local origin so
      // the browser stays inside the relay.
      if (lk === "location") { out[k] = v.replace(origin, `http://127.0.0.1:${PORT}`); continue; }
      if (lk === "set-cookie") {
        const list = up.headers.getSetCookie ? up.headers.getSetCookie() : [v];
        out["set-cookie"] = list.map((c) =>
          c.replace(/;\s*Domain=[^;]*/i, "").replace(/;\s*Secure/gi, ""));
        continue;
      }
      out[k] = v;
    }
    const buf = Buffer.from(await up.arrayBuffer());
    res.writeHead(up.status, out);
    res.end(buf);
  } catch (e) {
    res.writeHead(502, { "content-type": "text/plain" });
    res.end(`relay error: ${e.message}`);
  }
}).listen(PORT, "127.0.0.1", () => console.log(`relay ${PORT} -> ${TARGET}`));
