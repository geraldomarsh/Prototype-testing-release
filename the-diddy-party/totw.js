/* Team of the Week: every signed-in member picks a formation + 4 starters (never themselves).
   Members see nothing until the manager closes the round; then everyone sees the final team.
   Plugged into lib/handler.js with two one-line hooks. Data lives in db.team (same record as everything else). */
"use strict";

const FORMATIONS = ["1-2-1", "2-1-1", "1-1-2", "2-2", "1-3", "3-1"];     // 4 outfield players, back line first
const SLOTS = 4;

function team(db) {                      // created on first use, so existing databases need no migration
  if (!db.team || !db.team.round) db.team = { round: { id: 1, open: false, createdAt: Date.now() }, picks: [] };
  db.team.picks = db.team.picks || [];
  return db.team;
}
const current = db => { const t = team(db); return t.picks.filter(x => x.round === t.round.id); };

/* The suggested Team of the Week from all picks. Players ranked by how many members picked them;
   they are placed back-to-front by the average slot they were given. Ties at the cut-off are flagged. */
function resultOf(db, H) {
  const ap = H.approved(db), byId = new Map(ap.map(p => [p.id, p]));
  const picks = current(db).filter(x => byId.has(x.voterId));
  if (!picks.length) return null;
  const fCount = {}, pCount = {}, slotSum = {};
  picks.forEach(x => {
    fCount[x.formation] = (fCount[x.formation] || 0) + 1;
    x.slots.forEach((id, i) => { if (!byId.has(id)) return; pCount[id] = (pCount[id] || 0) + 1; slotSum[id] = (slotSum[id] || 0) + i; });
  });
  const formation = FORMATIONS.slice().sort((a, b) => (fCount[b] || 0) - (fCount[a] || 0) || FORMATIONS.indexOf(a) - FORMATIONS.indexOf(b))[0];
  const ranked = Object.keys(pCount).map(Number).sort((a, b) => pCount[b] - pCount[a] || byId.get(b).rating - byId.get(a).rating || a - b);
  const top = ranked.slice(0, SLOTS);
  const tie = ranked.length > SLOTS && pCount[ranked[SLOTS]] === pCount[ranked[SLOTS - 1]];
  const placed = top.slice().sort((a, b) => slotSum[a] / pCount[a] - slotSum[b] / pCount[b] || a - b);
  return { formation, formations: fCount, picks: picks.length, tie,
    slots: placed.map(id => ({ id, votes: pCount[id] })),
    ranking: ranked.map(id => ({ id, name: byId.get(id).name, votes: pCount[id] })) };
}

function viewFor(db, me, H) {
  const t = team(db), ap = H.approved(db);
  const mp = me && me.role === "player" ? H.player(db, me.playerId) : null;
  const meOk = mp && mp.status === "approved" ? mp : null;
  const mine = meOk ? current(db).find(x => x.voterId === meOk.id) : null;
  const out = { round: { id: t.round.id, open: t.round.open }, formations: FORMATIONS, me: meOk ? { id: meOk.id, name: meOk.name } : null,
    options: meOk ? ap.filter(p => p.id !== meOk.id).map(H.cardOf) : [],
    myPick: mine ? { formation: mine.formation, slots: mine.slots } : null,
    submitted: current(db).filter(x => ap.some(p => p.id === x.voterId)).length, members: ap.length, result: null };
  if (!t.round.open) {                    // vote counts stay secret; only the final team is shown
    const r = resultOf(db, H);
    if (r) out.result = { formation: r.formation, tie: r.tie, picks: r.picks, slots: r.slots.map(s => H.cardOf(H.player(db, s.id))) };
  }
  return out;
}

async function handle(req, res, p, q, H) {
  const m = req.method;
  if (m === "GET" && p === "/api/team-week") {
    const { db } = await H.store().load(H.seed);
    return H.send(res, 200, viewFor(db, H.authOf(db, req), H));
  }
  if (m === "POST" && p === "/api/team-week") {
    const b = await H.readBody(req);
    const out = await H.mutate(db => {
      const me = H.authOf(db, req), mp = me && me.role === "player" ? H.player(db, me.playerId) : null;
      if (!mp || mp.status !== "approved") return { status: 401, body: { error: "Enter your access code to pick a team." }, save: false };
      const t = team(db);
      if (!t.round.open) return { status: 409, body: { error: "Picks are closed." }, save: false };
      if (!FORMATIONS.includes(b.formation)) return { status: 400, body: { error: "Pick a formation." }, save: false };
      const slots = Array.isArray(b.slots) ? b.slots.map(Number) : [];
      if (slots.length !== SLOTS || slots.some(n => !Number.isInteger(n))) return { status: 400, body: { error: "Fill all " + SLOTS + " spots." }, save: false };
      if (new Set(slots).size !== SLOTS) return { status: 400, body: { error: "Each player can only be picked once." }, save: false };
      if (slots.includes(mp.id)) return { status: 400, body: { error: "You can't pick yourself." }, save: false };
      if (slots.some(id => { const x = H.player(db, id); return !x || x.status !== "approved"; })) return { status: 400, body: { error: "Unknown player." }, save: false };
      const ex = current(db).find(x => x.voterId === mp.id);
      if (ex) { ex.formation = b.formation; ex.slots = slots; ex.at = Date.now(); }
      else t.picks.push({ round: t.round.id, voterId: mp.id, formation: b.formation, slots, at: Date.now() });
      return { status: 200, body: Object.assign(viewFor(db, me, H), { saved: true }) };
    });
    return H.send(res, out.status, out.body);
  }
  throw new H.HttpError(404, "Not found");
}

/* admin routes: GET /api/admin/team-week, POST /api/admin/team-week/(open|close|new). Caller has already checked admin. */
async function admin(req, res, p, q, H) {
  const m = req.method;
  if (m === "GET" && p === "/api/admin/team-week") {
    const { db } = await H.store().load(H.seed);
    const t = team(db), ap = H.approved(db), cur = current(db), name = id => (H.player(db, id) || {}).name || "?";
    const done = new Set(cur.map(x => x.voterId));
    return H.send(res, 200, { round: t.round, members: ap.length, submitted: ap.filter(x => done.has(x.id)).length,
      waiting: ap.filter(x => !done.has(x.id)).map(x => x.name), result: resultOf(db, H) && Object.assign(resultOf(db, H), {
        slots: resultOf(db, H).slots.map(s => ({ id: s.id, name: name(s.id), votes: s.votes })) }),
      picks: cur.filter(x => ap.some(a => a.id === x.voterId)).map(x => ({ voter: name(x.voterId), formation: x.formation, slots: x.slots.map(name), at: x.at })) });
  }
  if (m === "POST" && (p === "/api/admin/team-week/open" || p === "/api/admin/team-week/close")) {
    const open = p.endsWith("/open");
    const out = await H.mutate(db => { team(db).round.open = open; return { status: 200, body: { ok: true } }; });
    return H.send(res, out.status, out.body);
  }
  if (m === "POST" && p === "/api/admin/team-week/new") {      // fresh round: old picks are dropped
    const out = await H.mutate(db => {
      const t = team(db); t.round = { id: t.round.id + 1, open: true, createdAt: Date.now() }; t.picks = [];
      return { status: 200, body: { ok: true } };
    });
    return H.send(res, out.status, out.body);
  }
  throw new H.HttpError(404, "Not found");
}

module.exports = { handle, admin, FORMATIONS };
