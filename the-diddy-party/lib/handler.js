/* The Diddy Party API. One handler used by Vercel (api/[...path].js) and by dev-server.js.
   Public:  GET /api/public, GET /api/poll, GET /api/photo, POST /api/register, /api/login, /api/logout, /api/vote
   Admin:   /api/admin/*  (needs ADMIN_CODE) */
"use strict";
const crypto = require("crypto");
const { getStore } = require("./store");

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";          // no 0/O/1/I/L to avoid mix-ups
const POSITIONS = ["ST", "LW", "RW", "RM", "LM", "CDM", "CAM", "CM", "RB", "LB", "CB", "GK"];
const SESSION_MS = 30 * 24 * 3600 * 1000;
const MAX_PENDING = 40, MAX_IMG_BYTES = 120 * 1024;
const DEFAULT_IMG = "images/players/default.svg";

const SEED_PLAYERS = [
  ["Geraldo", "The Finisher-ish", "ST", 87, 12, 5, 89, 86, 72, 31], ["Luca", "The Silk Merchant", "LW", 82, 9, 7, 91, 78, 83, 40],
  ["Mpho", "The Sprinter", "RW", 80, 7, 3, 94, 76, 69, 38], ["Tariq", "The Playmaker", "CM", 78, 5, 6, 73, 67, 88, 65],
  ["Dan", "The Wall (sometimes)", "CB", 76, 2, 2, 61, 54, 69, 84], ["Stefan", "Defensive Liability", "GK", 74, 1, 0, 49, 30, 55, 87],
  ["Kyle", "Shot Stopper-ish", "GK", 72, 1, 1, 55, 35, 51, 82]];

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const sha = s => crypto.createHash("sha256").update(String(s)).digest("hex");
const safeEq = (a, b) => crypto.timingSafeEqual(Buffer.from(sha(a), "hex"), Buffer.from(sha(b), "hex"));
const norm = c => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
function newCode(db) {
  for (;;) {
    let s = ""; for (let i = 0; i < 6; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
    const code = s.slice(0, 3) + "-" + s.slice(3);
    if (!db || !db.players.some(p => norm(p.code) === norm(code))) return code;
  }
}
function seed() {
  const db = {
    site: { session: { date: "", venue: "Your usual pitch" }, result: { home: 6, away: 4, note: "A tactical masterclass. Allegedly." }, ownGoals: 2, cleanSheets: 4 },
    players: [], poll: { id: 1, title: "Who cooked today?", open: true, createdAt: Date.now() }, votes: [], sessions: {}, attempts: {}
  };
  SEED_PLAYERS.forEach((p, i) => db.players.push({ id: i + 1, name: p[0], nickname: p[1], position: p[2], rating: p[3], goals: p[4], assists: p[5],
    pace: p[6], shooting: p[7], passing: p[8], defending: p[9], image: "images/players/player-" + (i + 1) + ".svg", code: newCode(db), status: "approved", createdAt: Date.now() }));
  return db;
}

// ---------- plumbing ----------
function send(res, status, obj, headers) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  for (const k in headers || {}) res.setHeader(k, headers[k]);
  res.end(JSON.stringify(obj));
}
async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {                // Vercel pre-parses the body
    let b = req.body;
    if (Buffer.isBuffer(b)) b = b.toString("utf8");
    if (typeof b === "string") { try { b = b ? JSON.parse(b) : {}; } catch (e) { throw new HttpError(400, "Bad request"); } }
    if (JSON.stringify(b).length > 300000) throw new HttpError(413, "That's too big.");
    return b && typeof b === "object" ? b : {};
  }
  return new Promise((resolve, reject) => {
    let d = "", dead = false;
    req.on("data", c => { d += c; if (d.length > 300000 && !dead) { dead = true; reject(new HttpError(413, "That's too big.")); } });
    req.on("end", () => { if (dead) return; try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(new HttpError(400, "Bad request")); } });
    req.on("error", () => reject(new HttpError(400, "Bad request")));
  });
}
function ipHash(req) {
  const xf = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return sha((xf || (req.socket && req.socket.remoteAddress) || "?") + "|diddy").slice(0, 16);
}
function bearer(req) { const h = req.headers.authorization || ""; return h.startsWith("Bearer ") ? h.slice(7) : ""; }
function authOf(db, req) {
  const t = bearer(req); if (!t) return null;
  const s = db.sessions[sha(t)];
  return s && s.exp > Date.now() ? Object.assign({ hash: sha(t) }, s) : null;
}
function startSession(db, role, playerId) {
  const token = crypto.randomBytes(24).toString("hex");
  const now = Date.now();
  for (const h of Object.keys(db.sessions)) if (db.sessions[h].exp < now) delete db.sessions[h];
  db.sessions[sha(token)] = { role, playerId: playerId || null, exp: now + SESSION_MS };
  return token;
}
function dropSessionsOf(db, playerId) { for (const h of Object.keys(db.sessions)) if (db.sessions[h].playerId === playerId) delete db.sessions[h]; }
/* attempt counters live in the db: { "login:<ip>": [timestamps] } */
function recent(db, key, windowMs) {
  const now = Date.now(); db.attempts[key] = (db.attempts[key] || []).filter(t => now - t < windowMs);
  if (!db.attempts[key].length) delete db.attempts[key];
  return (db.attempts[key] || []).length;
}
function note(db, key) { (db.attempts[key] = db.attempts[key] || []).push(Date.now()); }
function pruneAttempts(db) { const now = Date.now(); for (const k of Object.keys(db.attempts)) { db.attempts[k] = db.attempts[k].filter(t => now - t < 3600000); if (!db.attempts[k].length) delete db.attempts[k]; } }

const store = () => getStore();
/* read-modify-write with retry. fn(db) returns { status, body, save? }; throwing HttpError aborts without saving. */
async function mutate(fn) {
  for (let i = 0; i < 6; i++) {
    const { db, version } = await store().load(seed);
    const out = await fn(db);
    if (out.save === false || await store().save(db, version)) return out;
  }
  throw new HttpError(503, "The server is busy. Try again.");
}

// ---------- views ----------
const approved = db => db.players.filter(p => p.status === "approved");
const player = (db, id) => db.players.find(p => p.id === id);
function cardOf(p) {
  return { id: p.id, name: p.name, nickname: p.nickname || "", position: p.position, rating: p.rating, goals: p.goals, assists: p.assists,
    pace: p.pace, shooting: p.shooting, passing: p.passing, defending: p.defending, physical: p.physical, image: p.image || DEFAULT_IMG };
}
function pollView(db, me) {
  const pid = db.poll.id, ap = approved(db), ids = new Set(ap.map(p => p.id));
  const votes = db.votes.filter(v => v.pollId === pid && ids.has(v.voterId) && ids.has(v.choiceId));
  const counts = {}; votes.forEach(v => { counts[v.choiceId] = (counts[v.choiceId] || 0) + 1; });
  const mp = me && me.role === "player" ? player(db, me.playerId) : null;
  const meOk = mp && mp.status === "approved" ? mp : null;
  const mine = meOk ? votes.find(v => v.voterId === meOk.id) : null;
  return { id: pid, title: db.poll.title, open: db.poll.open, options: ap.map(p => ({ id: p.id, name: p.name })), counts, total: votes.length, voters: ap.length,
    me: meOk ? { id: meOk.id, name: meOk.name } : null, myVote: mine ? mine.choiceId : null };
}

// ---------- validation ----------
function text(v, min, max, label, re) {
  let s = String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim();
  if (s.length < min) throw new HttpError(400, label + " is required.");
  if (s.length > max) throw new HttpError(400, label + " is too long (max " + max + ").");
  if (re && s && !re.test(s)) throw new HttpError(400, label + " has characters we can't use.");
  return s;
}
function longText(v, min, max, label) {
  let t = String(v == null ? "" : v).replace(/\r/g, "").replace(/[\u0000-\u0009\u000b-\u001f\u007f<>]/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (t.length < min) throw new HttpError(400, label + " is too short.");
  if (t.length > max) throw new HttpError(400, label + " is too long (max " + max + " characters).");
  return t;
}
function int(v, min, max, label) {
  const n = Number(v);
  if (v === "" || v === null || v === undefined || !Number.isInteger(n) || n < min || n > max) throw new HttpError(400, label + " must be a whole number from " + min + " to " + max + ".");
  return n;
}
const NAME_RE = /^[\p{L}\p{N} .'\-]+$/u;
function nameTaken(db, name, exceptId) { return db.players.some(p => p.id !== exceptId && p.name.toLowerCase() === name.toLowerCase()); }
function parseImage(dataUrl) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!m) throw new HttpError(400, "That photo isn't a JPEG, PNG or WebP image.");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > MAX_IMG_BYTES) throw new HttpError(400, "That photo is too big. Try a smaller one.");
  const ok = (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) || buf.slice(0, 4).toString("hex") === "89504e47" || (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP");
  if (!ok) throw new HttpError(400, "That doesn't look like a real image.");
  const type = buf[0] === 0xff ? "image/jpeg" : buf[0] === 0x89 ? "image/png" : "image/webp";
  return { type, b64: m[2] };
}
const IMG_PATH_RE = /^images\/players\/[\w .\-]{1,80}\.(jpg|jpeg|png|webp|gif|svg)$/i;

// ---------- routes ----------
async function route(req, res, p, q) {
  const m = req.method;

  // ----- public -----
  if (m === "GET" && p === "/api/public") {
    const { db } = await store().load(seed);
    return send(res, 200, { players: approved(db).map(cardOf), site: db.site }, { "Cache-Control": "no-cache", "Vercel-CDN-Cache-Control": "s-maxage=10, stale-while-revalidate=30" });
  }
  if (m === "GET" && p === "/api/photo") {
    const k = String(q.get("k") || ""); if (!/^[a-f0-9]{16}$/.test(k)) throw new HttpError(404, "Not found");
    const img = await store().getImg(k); if (!img) throw new HttpError(404, "Not found");
    res.statusCode = 200; res.setHeader("Content-Type", img.type); res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable"); return res.end(Buffer.from(img.b64, "base64"));
  }
  if (m === "GET" && p === "/api/poll") {
    const { db } = await store().load(seed);
    return send(res, 200, pollView(db, authOf(db, req)));
  }

  if (m === "POST" && p === "/api/register") {
    const b = await readBody(req);
    if (b.website) return send(res, 200, { ok: true });                                  // honeypot: bots fill hidden fields
    const name = text(b.name, 2, 20, "Name", NAME_RE), nickname = text(b.nickname || "", 0, 28, "Nickname");
    if (!POSITIONS.includes(b.position)) throw new HttpError(400, "Pick a position.");
    const pace = int(b.pace, 40, 90, "Pace"), shooting = int(b.shooting, 40, 90, "Shooting"), passing = int(b.passing, 40, 90, "Passing"), defending = int(b.defending, 40, 90, "Defending");
    const img = b.image ? parseImage(b.image) : null;
    const ip = ipHash(req), imgKey = img ? crypto.randomBytes(8).toString("hex") : null;
    if (img) await store().putImg(imgKey, img);
    let out;
    try {
      out = await mutate(db => {
        pruneAttempts(db);
        if (recent(db, "reg:" + ip, 3600000) >= 3) throw new HttpError(429, "You've sent a few cards already. Try again later.");
        if (db.players.filter(x => x.status === "pending").length >= MAX_PENDING) throw new HttpError(429, "Too many requests waiting. Ask the manager.");
        if (nameTaken(db, name)) throw new HttpError(409, "That name is already on the squad.");
        note(db, "reg:" + ip);
        db.players.push({ id: Math.max(0, ...db.players.map(x => x.id)) + 1, name, nickname, position: b.position,
          rating: Math.round((pace + shooting + passing + defending) / 4), goals: 0, assists: 0, pace, shooting, passing, defending,
          image: imgKey ? "/api/photo?k=" + imgKey : DEFAULT_IMG, code: newCode(db), status: "pending", createdAt: Date.now() });
        return { status: 200, body: { ok: true, message: "Card received! The manager will approve it and send you your access code." } };
      });
    } catch (e) { if (imgKey) store().delImg(imgKey).catch(() => {}); throw e; }
    return send(res, out.status, out.body);
  }

  if (m === "POST" && p === "/api/login") {
    const b = await readBody(req), c = norm(b.code), ip = ipHash(req);
    const out = await mutate(db => {
      if (recent(db, "login:" + ip, 600000) >= 8) return { status: 429, body: { error: "Too many attempts. Wait a few minutes." }, save: false };
      const pl = c && db.players.find(x => x.status === "approved" && norm(x.code) === c);
      if (!pl) { note(db, "login:" + ip); pruneAttempts(db); return { status: 401, body: { error: "That code isn't right." } }; }
      return { status: 200, body: { token: startSession(db, "player", pl.id), player: { id: pl.id, name: pl.name } } };
    });
    return send(res, out.status, out.body);
  }
  if (m === "POST" && p === "/api/logout") {
    await mutate(db => { const me = authOf(db, req); if (!me) return { status: 200, body: { ok: true }, save: false }; delete db.sessions[me.hash]; return { status: 200, body: { ok: true } }; });
    return send(res, 200, { ok: true });
  }
  if (m === "POST" && p === "/api/vote") {
    const b = await readBody(req), id = Number(b.choiceId);
    const out = await mutate(db => {
      const me = authOf(db, req), mp = me && me.role === "player" ? player(db, me.playerId) : null;
      if (!mp || mp.status !== "approved") return { status: 401, body: { error: "Enter your access code to vote." }, save: false };
      if (!db.poll.open) return { status: 409, body: { error: "Voting is closed." }, save: false };
      const target = player(db, id);
      if (!target || target.status !== "approved") return { status: 400, body: { error: "Unknown player." }, save: false };
      if (id === mp.id) return { status: 400, body: { error: "You can't vote for yourself." }, save: false };
      const ex = db.votes.find(v => v.pollId === db.poll.id && v.voterId === mp.id);
      if (ex) { ex.choiceId = id; ex.at = Date.now(); } else db.votes.push({ pollId: db.poll.id, voterId: mp.id, choiceId: id, at: Date.now() });
      return { status: 200, body: pollView(db, me) };
    });
    return send(res, out.status, out.body);
  }

  if (m === "POST" && p === "/api/feedback") {
    const b = await readBody(req);
    if (b.website) return send(res, 200, { ok: true });                                  // honeypot
    if (!["bug", "question", "suggestion"].includes(b.type)) throw new HttpError(400, "Pick what this is about.");
    const message = longText(b.message, 5, 800, "Your message"), name = text(b.name || "", 0, 30, "Name"), contact = text(b.contact || "", 0, 60, "Contact"), page = text(b.page || "", 0, 60, "Page");
    const ua = String(req.headers["user-agent"] || "").replace(/[\u0000-\u001f<>]/g, "").slice(0, 120), ip = ipHash(req);
    const out = await mutate(db => {
      pruneAttempts(db); db.feedback = db.feedback || [];
      if (recent(db, "fb:" + ip, 3600000) >= 5) throw new HttpError(429, "That's a lot of messages. Try again in a while.");
      if (db.feedback.length >= 100) { const i = db.feedback.findIndex(f => f.status === "done"); if (i < 0) throw new HttpError(429, "The inbox is full right now. Please try later."); db.feedback.splice(i, 1); }
      note(db, "fb:" + ip);
      db.feedback.push({ id: Math.max(0, ...db.feedback.map(f => f.id)) + 1, type: b.type, message, name, contact, page, ua, status: "new", createdAt: Date.now() });
      return { status: 200, body: { ok: true, message: "Thanks! Your message reached the manager." } };
    });
    return send(res, out.status, out.body);
  }

  // ----- admin -----
  if (m === "POST" && p === "/api/admin/login") {
    if (!process.env.ADMIN_CODE) throw new HttpError(500, "ADMIN_CODE isn't set on the server.");
    const b = await readBody(req), ip = ipHash(req);
    const out = await mutate(db => {
      if (recent(db, "admin:" + ip, 600000) >= 6) return { status: 429, body: { error: "Too many attempts. Wait a few minutes." }, save: false };
      if (norm(b.code) && safeEq(norm(b.code), norm(process.env.ADMIN_CODE))) return { status: 200, body: { token: startSession(db, "admin") } };
      note(db, "admin:" + ip); return { status: 401, body: { error: "That code isn't right." } };
    });
    return send(res, out.status, out.body);
  }
  if (p.startsWith("/api/admin/")) return admin(req, res, p, q);
  throw new HttpError(404, "Not found");
}

async function admin(req, res, p, q) {
  const m = req.method;
  const { db: peek } = await store().load(seed);
  const who = authOf(peek, req);
  if (!who || who.role !== "admin") throw new HttpError(401, "Admin only.");

  if (m === "GET" && p === "/api/admin/status") {
    const db = peek, reveal = q.get("reveal") === "1", pid = db.poll.id, ap = approved(db);
    const rows = db.players.map(pl => {
      const v = db.votes.find(x => x.pollId === pid && x.voterId === pl.id);
      return Object.assign(cardOf(pl), { code: pl.code, status: pl.status, createdAt: pl.createdAt, voted: !!v && pl.status === "approved", at: v ? v.at : null,
        choice: reveal && v ? (player(db, v.choiceId) || {}).name : undefined });
    });
    return send(res, 200, { poll: { id: pid, title: db.poll.title, open: db.poll.open }, site: db.site, players: rows, feedback: db.feedback || [],
      votedCount: rows.filter(r => r.voted).length, notVoted: rows.filter(r => r.status === "approved" && !r.voted).map(r => r.name), approvedCount: ap.length });
  }
  if (m === "GET" && p === "/api/admin/export") {
    const out = JSON.parse(JSON.stringify(peek)); delete out.sessions; delete out.attempts;
    return send(res, 200, out);
  }
  const b = m === "POST" ? await readBody(req) : {};
  const done = o => send(res, o.status, o.body);

  if (m === "POST" && p === "/api/admin/poll") return done(await mutate(db => {
    db.poll = { id: db.poll.id + 1, title: text(b.title || "Who cooked today?", 1, 80, "Title"), open: true, createdAt: Date.now() };
    return { status: 200, body: { ok: true } };
  }));
  if (m === "POST" && (p === "/api/admin/poll/close" || p === "/api/admin/poll/open")) return done(await mutate(db => {
    db.poll.open = p.endsWith("/open"); return { status: 200, body: { ok: true } };
  }));
  if (m === "POST" && p === "/api/admin/players") return done(await mutate(db => {         // quick add by name
    const name = text(b.name, 2, 20, "Name", NAME_RE); if (nameTaken(db, name)) throw new HttpError(409, "That name is already on the squad.");
    db.players.push({ id: Math.max(0, ...db.players.map(x => x.id)) + 1, name, nickname: "", position: "ALL", rating: 60, goals: 0, assists: 0, pace: 60, shooting: 60, passing: 60, defending: 60,
      image: DEFAULT_IMG, code: newCode(db), status: "approved", createdAt: Date.now() });
    return { status: 200, body: { ok: true } };
  }));
  let mm = p.match(/^\/api\/admin\/players\/(\d+)\/(regen|delete|approve|reject)$/);
  if (m === "POST" && mm) {
    let imgToDrop = null;
    const out = await mutate(db => {
      const pl = player(db, Number(mm[1])); if (!pl) throw new HttpError(404, "No such player.");
      if (mm[2] === "regen") { pl.code = newCode(db); dropSessionsOf(db, pl.id); }
      else if (mm[2] === "approve") { pl.status = "approved"; }
      else {
        db.players = db.players.filter(x => x.id !== pl.id);
        db.votes = db.votes.filter(v => v.voterId !== pl.id && v.choiceId !== pl.id); dropSessionsOf(db, pl.id);
        const k = /^\/api\/photo\?k=([a-f0-9]{16})$/.exec(pl.image || ""); imgToDrop = k ? k[1] : null;
      }
      return { status: 200, body: { ok: true } };
    });
    if (imgToDrop) store().delImg(imgToDrop).catch(() => {});
    return done(out);
  }
  mm = p.match(/^\/api\/admin\/feedback\/(\d+)\/(done|reopen|delete)$/);
  if (m === "POST" && mm) return done(await mutate(db => {
    db.feedback = db.feedback || []; const f = db.feedback.find(x => x.id === Number(mm[1])); if (!f) throw new HttpError(404, "No such message.");
    if (mm[2] === "delete") db.feedback = db.feedback.filter(x => x !== f); else f.status = mm[2] === "done" ? "done" : "new";
    return { status: 200, body: { ok: true } };
  }));
  if (m === "POST" && p === "/api/admin/player") return done(await mutate(db => {            // full card editor
    const name = text(b.name, 2, 20, "Name", NAME_RE), id = b.id ? Number(b.id) : 0;
    const ex = id ? player(db, id) : null; if (id && !ex) throw new HttpError(404, "No such player.");
    if (nameTaken(db, name, ex ? ex.id : 0)) throw new HttpError(409, "That name is already on the squad.");
    let image = ex ? ex.image : DEFAULT_IMG;
    if (b.image && b.image !== image) { if (!IMG_PATH_RE.test(b.image)) throw new HttpError(400, "Photo must be a file in images/players/ (e.g. images/players/Ethan.jpg)."); image = b.image; }
    const card = { name, nickname: text(b.nickname || "", 0, 28, "Nickname"), position: POSITIONS.includes(b.position) ? b.position : "ALL", rating: int(b.rating, 1, 99, "Overall"),
      goals: int(b.goals, 0, 9999, "Goals"), assists: int(b.assists, 0, 9999, "Assists"), pace: int(b.pace, 1, 99, "Pace"), shooting: int(b.shooting, 1, 99, "Shooting"),
      passing: int(b.passing, 1, 99, "Passing"), defending: int(b.defending, 1, 99, "Defending"), image };
    if (ex) Object.assign(ex, card);
    else db.players.push(Object.assign({ id: Math.max(0, ...db.players.map(x => x.id)) + 1, code: newCode(db), status: "approved", createdAt: Date.now() }, card));
    return { status: 200, body: { ok: true } };
  }));
  if (m === "POST" && p === "/api/admin/match") return done(await mutate(db => {
    const home = int(b.home, 0, 99, "Our score"), away = int(b.away, 0, 99, "Their score"), stats = Array.isArray(b.stats) ? b.stats : [];
    let goals = 0; const parsed = stats.map(s => { const g = int(s.g, 0, 99, "Goals"), a = int(s.a, 0, 99, "Assists"); goals += g; return { id: Number(s.id), g, a }; });
    if (goals > home) throw new HttpError(400, "Player goals (" + goals + ") exceed your team's score (" + home + "). Check entries.");
    parsed.forEach(s => { const pl = player(db, s.id); if (pl) { pl.goals += s.g; pl.assists += s.a; } });
    db.site.result = { home, away, note: text(b.note || "", 0, 100, "Match report") || "Match logged. Details under investigation." };
    const venue = text(b.venue || "", 0, 70, "Venue"); if (venue) db.site.session.venue = venue;
    return { status: 200, body: { ok: true } };
  }));
  if (m === "POST" && p === "/api/admin/site") return done(await mutate(db => {
    if (b.session) db.site.session = { date: String(b.session.date || "").slice(0, 25), venue: text(b.session.venue || "Venue TBC", 0, 70, "Venue") || "Venue TBC" };
    if (b.result) db.site.result = { home: int(b.result.home, 0, 99, "Score"), away: int(b.result.away, 0, 99, "Score"), note: text(b.result.note || "", 0, 100, "Match report") || "No match report. Suspicious." };
    if (b.ownGoals !== undefined) db.site.ownGoals = int(b.ownGoals, 0, 9999, "Own goals");
    if (b.cleanSheets !== undefined) db.site.cleanSheets = int(b.cleanSheets, 0, 9999, "Clean sheets");
    return { status: 200, body: { ok: true } };
  }));
  throw new HttpError(404, "Not found");
}

async function handle(req, res) {
  try {
    const url = new URL(req.url, "http://x");
    await route(req, res, url.pathname.replace(/\/+$/, ""), url.searchParams);
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    const status = e.status || 500;
    send(res, status, { error: e instanceof HttpError || e.status ? e.message : "Something went wrong on the server." });
  }
}
module.exports = { handle, seed };
