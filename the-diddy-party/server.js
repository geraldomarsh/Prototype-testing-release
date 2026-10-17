/* The Diddy Party: tiny server (no npm install needed, Node 18+).
   - Serves the website
   - Access-code login for each player
   - One vote per player per poll, with an admin view of who has/hasn't voted
   Run:  node server.js     then open http://localhost:3000
   Data is stored in data/db.json (back it up; don't share it: it contains the access codes). */
"use strict";
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto"), os = require("os");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DB_FILE = path.join(ROOT, "data", "db.json");
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";           // no 0/O/1/I/L to avoid mix-ups
const SEED_PLAYERS = ["Geraldo", "Luca", "Mpho", "Tariq", "Dan", "Stefan", "Kyle"];

// ---------- storage ----------
function newCode() {
  let s = ""; for (let i = 0; i < 6; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return s.slice(0, 3) + "-" + s.slice(3);
}
const norm = c => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
function load() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); } catch (e) {}
  const db = {
    admin: { code: process.env.ADMIN_CODE || newCode() },
    players: SEED_PLAYERS.map((name, i) => ({ id: i + 1, name, code: newCode() })),
    poll: { id: 1, title: "Who cooked today?", open: true, createdAt: Date.now() },
    votes: [],            // { pollId, voterId, choiceId, at }
    sessions: {}          // token -> { role, playerId, exp }
  };
  save(db); return db;
}
function save(db) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const tmp = DB_FILE + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, DB_FILE);
}
let db = load();
if (process.env.ADMIN_CODE) db.admin.code = process.env.ADMIN_CODE;

// ---------- helpers ----------
const SESSION_MS = 30 * 24 * 3600 * 1000;
function startSession(role, playerId) {
  const token = crypto.randomBytes(24).toString("hex");
  db.sessions[token] = { role, playerId: playerId || null, exp: Date.now() + SESSION_MS };
  for (const t of Object.keys(db.sessions)) if (db.sessions[t].exp < Date.now()) delete db.sessions[t];
  save(db); return token;
}
function auth(req) {
  const h = req.headers.authorization || ""; const t = h.startsWith("Bearer ") ? h.slice(7) : "";
  const s = db.sessions[t]; if (!s || s.exp < Date.now()) return null;
  return { token: t, ...s };
}
const attempts = new Map();   // ip -> [timestamps]
function tooMany(ip) {
  const now = Date.now(), arr = (attempts.get(ip) || []).filter(t => now - t < 10 * 60000);
  arr.push(now); attempts.set(ip, arr); return arr.length > 10;
}
function send(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}
function body(req) {
  return new Promise((resolve, reject) => {
    let d = ""; req.on("data", c => { d += c; if (d.length > 10000) { reject(new Error("too big")); req.destroy(); } });
    req.on("end", () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } });
  });
}
const player = id => db.players.find(p => p.id === id);
function pollView(me) {
  const pid = db.poll.id, votes = db.votes.filter(v => v.pollId === pid);
  const counts = {}; votes.forEach(v => { counts[v.choiceId] = (counts[v.choiceId] || 0) + 1; });
  const mine = me && me.role === "player" ? votes.find(v => v.voterId === me.playerId) : null;
  return {
    id: pid, title: db.poll.title, open: db.poll.open,
    options: db.players.map(p => ({ id: p.id, name: p.name })),
    counts, total: votes.length, voters: db.players.length,
    me: me && me.role === "player" ? { id: me.playerId, name: player(me.playerId)?.name } : null,
    myVote: mine ? mine.choiceId : null
  };
}

// ---------- API ----------
async function api(req, res, url) {
  const ip = req.socket.remoteAddress, me = auth(req), m = req.method, p = url.pathname;
  try {
    if (m === "POST" && p === "/api/login") {
      if (tooMany(ip)) return send(res, 429, { error: "Too many attempts. Wait a few minutes." });
      const { code } = await body(req), c = norm(code);
      const pl = c && db.players.find(x => norm(x.code) === c);
      if (!pl) return send(res, 401, { error: "That code isn't right." });
      return send(res, 200, { token: startSession("player", pl.id), player: { id: pl.id, name: pl.name } });
    }
    if (m === "POST" && p === "/api/logout") {
      if (me) { delete db.sessions[me.token]; save(db); } return send(res, 200, { ok: true });
    }
    if (m === "GET" && p === "/api/poll") return send(res, 200, pollView(me));
    if (m === "POST" && p === "/api/vote") {
      if (!me || me.role !== "player") return send(res, 401, { error: "Enter your access code to vote." });
      if (!db.poll.open) return send(res, 409, { error: "Voting is closed." });
      const { choiceId } = await body(req), id = Number(choiceId);
      if (!player(id)) return send(res, 400, { error: "Unknown player." });
      if (id === me.playerId) return send(res, 400, { error: "You can't vote for yourself." });
      const pid = db.poll.id, ex = db.votes.find(v => v.pollId === pid && v.voterId === me.playerId);
      if (ex) { ex.choiceId = id; ex.at = Date.now(); } else db.votes.push({ pollId: pid, voterId: me.playerId, choiceId: id, at: Date.now() });
      save(db); return send(res, 200, pollView(me));
    }

    // ----- admin -----
    if (m === "POST" && p === "/api/admin/login") {
      if (tooMany(ip)) return send(res, 429, { error: "Too many attempts. Wait a few minutes." });
      const { code } = await body(req);
      if (norm(code) && norm(code) === norm(db.admin.code)) return send(res, 200, { token: startSession("admin") });
      return send(res, 401, { error: "That code isn't right." });
    }
    if (p.startsWith("/api/admin/")) {
      if (!me || me.role !== "admin") return send(res, 401, { error: "Admin only." });
      if (m === "GET" && p === "/api/admin/status") {
        const reveal = url.searchParams.get("reveal") === "1", pid = db.poll.id;
        const rows = db.players.map(pl => {
          const v = db.votes.find(x => x.pollId === pid && x.voterId === pl.id);
          return { id: pl.id, name: pl.name, code: pl.code, voted: !!v, at: v ? v.at : null, choice: reveal && v ? player(v.choiceId)?.name : undefined };
        });
        return send(res, 200, { poll: { id: pid, title: db.poll.title, open: db.poll.open }, players: rows,
          votedCount: rows.filter(r => r.voted).length, notVoted: rows.filter(r => !r.voted).map(r => r.name) });
      }
      if (m === "POST" && p === "/api/admin/poll") {            // start a new poll (old votes are kept in history)
        const { title } = await body(req);
        db.poll = { id: db.poll.id + 1, title: String(title || "Who cooked today?").slice(0, 80), open: true, createdAt: Date.now() };
        save(db); return send(res, 200, { ok: true });
      }
      if (m === "POST" && (p === "/api/admin/poll/close" || p === "/api/admin/poll/open")) {
        db.poll.open = p.endsWith("/open"); save(db); return send(res, 200, { ok: true });
      }
      if (m === "POST" && p === "/api/admin/players") {
        const { name } = await body(req), n = String(name || "").trim().slice(0, 30);
        if (!n) return send(res, 400, { error: "Name needed." });
        const id = Math.max(0, ...db.players.map(x => x.id)) + 1;
        db.players.push({ id, name: n, code: newCode() }); save(db); return send(res, 200, { ok: true });
      }
      let mm = p.match(/^\/api\/admin\/players\/(\d+)\/(regen|delete)$/);
      if (m === "POST" && mm) {
        const pl = player(Number(mm[1])); if (!pl) return send(res, 404, { error: "No such player." });
        if (mm[2] === "regen") {
          pl.code = newCode();
          for (const t of Object.keys(db.sessions)) if (db.sessions[t].playerId === pl.id) delete db.sessions[t];   // sign them out
        } else {
          db.players = db.players.filter(x => x.id !== pl.id);
          db.votes = db.votes.filter(v => v.voterId !== pl.id && v.choiceId !== pl.id);
          for (const t of Object.keys(db.sessions)) if (db.sessions[t].playerId === pl.id) delete db.sessions[t];
        }
        save(db); return send(res, 200, { ok: true });
      }
    }
    return send(res, 404, { error: "Not found" });
  } catch (e) { return send(res, 400, { error: "Bad request" }); }
}

// ---------- static files ----------
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".json": "application/json" };
function serve(req, res, url) {
  let rel = decodeURIComponent(url.pathname); if (rel.endsWith("/")) rel += "index.html";
  const file = path.normalize(path.join(ROOT, rel));
  const top = path.relative(ROOT, file).split(path.sep)[0];
  if (!file.startsWith(ROOT + path.sep) || ["data", "server.js", "node_modules"].includes(top) || top.startsWith(".") || !MIME[path.extname(file).toLowerCase()]) {
    res.writeHead(404); return res.end("Not found");
  }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()], "Cache-Control": "no-cache" }); res.end(buf);
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/api/")) return api(req, res, url);
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
  serve(req, res, url);
}).listen(PORT, "0.0.0.0", () => {
  console.log("\nThe Diddy Party is running:  http://localhost:" + PORT);
  for (const list of Object.values(os.networkInterfaces())) for (const i of list || [])
    if (i.family === "IPv4" && !i.internal) console.log("On your Wi-Fi (phones):      http://" + i.address + ":" + PORT);
  console.log("\nAdmin code: " + db.admin.code + "   (use it on the Admin page)");
  console.log("Player codes are on the Admin page, or in data/db.json\n");
});
