/* Local test server (no npm install, Node 18+). Serves public/ and the same API Vercel runs,
   storing data in data/ on your computer.   Run:  node dev-server.js   then open http://localhost:3000
   Set SUPABASE_URL + SUPABASE_SERVICE_KEY to test against your real Supabase instead. */
"use strict";
const http = require("http"), fs = require("fs"), path = require("path"), os = require("os"), crypto = require("crypto");
if (!process.env.ADMIN_CODE) { const a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 6; i++) s += a[crypto.randomInt(a.length)]; process.env.ADMIN_CODE = s.slice(0, 3) + "-" + s.slice(3); process.env.__ADMIN_GENERATED = "1"; }
const { handle } = require("./lib/handler");
const PORT = Number(process.env.PORT) || 3000, ROOT = path.join(__dirname, "public");
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".json": "application/json" };
http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/api/")) return handle(req, res);
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
  let rel = decodeURIComponent(url.pathname); if (rel.endsWith("/")) rel += "index.html";
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT + path.sep) || !MIME[path.extname(file).toLowerCase()]) { res.writeHead(404); return res.end("Not found"); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()], "Cache-Control": "no-cache" }); res.end(buf);
  });
}).listen(PORT, "0.0.0.0", () => {
  console.log("\nThe Diddy Party (local):  http://localhost:" + PORT);
  for (const list of Object.values(os.networkInterfaces())) for (const i of list || [])
    if (i.family === "IPv4" && !i.internal) console.log("On your Wi-Fi (phones):   http://" + i.address + ":" + PORT);
  console.log("\nAdmin code: " + process.env.ADMIN_CODE + (process.env.__ADMIN_GENERATED ? "   (random this run; set ADMIN_CODE to keep it)" : ""));
  console.log("Data folder: data/ (player codes live in data/db.json; don't commit it)\n");
});
