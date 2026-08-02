// /app 302s to /login unless a session cookie is present — a plain auth wall.
import { createServer } from "node:http";
createServer((req, res) => {
  const cookie = req.headers.cookie ?? "";
  if (req.url.startsWith("/app") && !cookie.includes("session=")) {
    res.writeHead(302, { location: "/login" });
    res.end();
    return;
  }
  const body = req.url.startsWith("/login")
    ? `<!doctype html><meta charset="utf-8"><title>Sign in</title><body style="font:16px sans-serif;padding:40px">
       <h1>Sign in</h1><form><input type="password" name="p"><button>Sign in</button></form></body>`
    : `<!doctype html><meta charset="utf-8"><title>Dashboard</title><body style="font:16px sans-serif;margin:0">
       <main><div class="card" style="width:1000px">Revenue</div><div class="card" style="width:1000px">Costs</div></main></body>`;
  res.writeHead(200, { "content-type": "text/html" });
  res.end(body);
}).listen(8901);
