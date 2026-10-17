/* Storage for The Diddy Party.
   One JSON "database" document + one small row per photo.
   - Supabase (online, used on Vercel): table `kv` (see supabase-setup.sql), talked to over plain HTTPS.
   - Local file (dev-server.js): data/db.json, so you can test with no account.
   save() is compare-and-swap on a version number, so two people voting at the same moment
   can't overwrite each other: the loser is retried by the caller. */
"use strict";
const fs = require("fs"), path = require("path");

function supabaseStore() {
  const base = process.env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/";
  const key = process.env.SUPABASE_SERVICE_KEY;
  async function rest(p, opts) {
    opts = opts || {};
    const r = await fetch(base + p, {
      method: opts.method || "GET",
      headers: Object.assign({ apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" }, opts.headers || {}),
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
    });
    const text = await r.text();
    if (!r.ok) throw new Error("Database error " + r.status + ": " + text.slice(0, 200));
    return text ? JSON.parse(text) : null;
  }
  const imgKey = k => encodeURIComponent("img:" + k);
  return {
    async load(seed) {
      let rows = await rest("kv?key=eq.db&select=value,version");
      if (!rows.length) {
        await rest("kv", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: { key: "db", value: seed(), version: 1 } });
        rows = await rest("kv?key=eq.db&select=value,version");
      }
      return { db: rows[0].value, version: rows[0].version };
    },
    async save(db, version) {
      const rows = await rest("kv?key=eq.db&version=eq." + version + "&select=version", {
        method: "PATCH", headers: { Prefer: "return=representation" }, body: { value: db, version: version + 1 } });
      return Array.isArray(rows) && rows.length === 1;
    },
    async getImg(k) { const r = await rest("kv?key=eq." + imgKey(k) + "&select=value"); return r.length ? r[0].value : null; },
    async putImg(k, val) { await rest("kv", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: { key: "img:" + k, value: val, version: 1 } }); },
    async delImg(k) { await rest("kv?key=eq." + imgKey(k), { method: "DELETE", headers: { Prefer: "return=minimal" } }); }
  };
}

function fileStore(dir) {
  const file = path.join(dir, "db.json"), imgDir = path.join(dir, "img");
  return {
    async load(seed) {
      try { const j = JSON.parse(fs.readFileSync(file, "utf8")); return { db: j.db, version: j.version }; } catch (e) {}
      const j = { version: 1, db: seed() }; fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(j, null, 2));
      return { db: j.db, version: 1 };
    },
    async save(db, version) {
      let cur = 0; try { cur = JSON.parse(fs.readFileSync(file, "utf8")).version; } catch (e) {}
      if (cur !== version) return false;
      fs.mkdirSync(dir, { recursive: true });
      const tmp = file + ".tmp"; fs.writeFileSync(tmp, JSON.stringify({ version: version + 1, db }, null, 2)); fs.renameSync(tmp, file);
      return true;
    },
    async getImg(k) { try { return JSON.parse(fs.readFileSync(path.join(imgDir, k + ".json"), "utf8")); } catch (e) { return null; } },
    async putImg(k, val) { fs.mkdirSync(imgDir, { recursive: true }); fs.writeFileSync(path.join(imgDir, k + ".json"), JSON.stringify(val)); },
    async delImg(k) { try { fs.unlinkSync(path.join(imgDir, k + ".json")); } catch (e) {} }
  };
}

let cached;
function getStore() {
  if (cached) return cached;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) cached = supabaseStore();
  else if (process.env.VERCEL) throw Object.assign(new Error("Database not configured: set SUPABASE_URL and SUPABASE_SERVICE_KEY in Vercel."), { status: 500 });
  else cached = fileStore(process.env.DATA_DIR || path.join(__dirname, "..", "data"));
  return cached;
}
module.exports = { getStore, fileStore, supabaseStore };
