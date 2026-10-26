const ADMIN_KEY = "diddyAdminToken";
const defaultData = {
  session: { date: "", venue: "Your usual pitch" },
  result: { home: 6, away: 4, note: "A tactical masterclass. Allegedly." },
  players: [
    { id: 1, name: "Geraldo", nickname: "The Finisher-ish", position: "ST", rating: 87, image: "images/players/player-1.svg", goals: 12, assists: 5, pace: 89, shooting: 86, passing: 72, defending: 31 },
    { id: 2, name: "Luca", nickname: "The Silk Merchant", position: "LW", rating: 82, image: "images/players/player-2.svg", goals: 9, assists: 7, pace: 91, shooting: 78, passing: 83, defending: 40 },
    { id: 3, name: "Mpho", nickname: "The Sprinter", position: "RW", rating: 80, image: "images/players/player-3.svg", goals: 7, assists: 3, pace: 94, shooting: 76, passing: 69, defending: 38 },
    { id: 4, name: "Tariq", nickname: "The Playmaker", position: "CM", rating: 78, image: "images/players/player-4.svg", goals: 5, assists: 6, pace: 73, shooting: 67, passing: 88, defending: 65 },
    { id: 5, name: "Dan", nickname: "The Wall (sometimes)", position: "CB", rating: 76, image: "images/players/player-5.svg", goals: 2, assists: 2, pace: 61, shooting: 54, passing: 69, defending: 84 },
    { id: 6, name: "Stefan", nickname: "Defensive Liability", position: "GK", rating: 74, image: "images/players/player-6.svg", goals: 1, assists: 0, pace: 49, shooting: 30, passing: 55, defending: 87 },
    { id: 7, name: "Kyle", nickname: "Shot Stopper-ish", position: "GK", rating: 72, image: "images/players/player-7.svg", goals: 1, assists: 1, pace: 55, shooting: 35, passing: 51, defending: 82 }
  ],
  votes: {},
  ownGoals: 2,
  cleanSheets: 4
};
const clone = obj => JSON.parse(JSON.stringify(obj));
let data = clone(defaultData);
let loaded = false;   // don't draw the sample squad before we know whether the server has the real one
let toastTimer;

const UPDATE_VERSION = "2026-10-26"; // change this for every new update
const modal1 = document.getElementById("updateModal");

if (localStorage.getItem("seenUpdate") !== UPDATE_VERSION) {
modal1.hidden = false;
}
document.getElementById("updateClose").onclick = () => {
localStorage.setItem("seenUpdate", UPDATE_VERSION);
modal1.hidden = true;
};

function adminToken() { try { return localStorage.getItem(ADMIN_KEY) || ""; } catch { return ""; } }
function adminPost(path, body) {
  return fetch("/api" + path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + adminToken() }, body: JSON.stringify(body) })
    .then(r => r.json().catch(() => ({})).then(d => { if (!r.ok) throw new Error(r.status === 401 ? "Open the Admin page and sign in first." : (d.error || "Something went wrong.")); return d; }));
}
/* Everyone sees the shared squad + scores from the server. If the server can't be reached
   (e.g. VS Code Live Server) the built-in sample data is shown instead. */
function loadRemote() {
  const grid = document.querySelector("#playerGrid");
  grid.innerHTML = '<p class="muted">Loading the squad…</p>';
  return fetch("/api/public").then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(d => {
    data.players = d.players; data.poll = d.poll || null; Object.assign(data, { session: d.site.session, result: d.site.result, ownGoals: d.site.ownGoals, cleanSheets: d.site.cleanSheets });
    loaded = true; renderAll();
  }).catch(() => { loaded = true; renderAll(); });
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}
function isMe(player) {
  const me = window.diddyMe;               // set by js/voting.js when someone signs in with their access code
  return !!(me && String(player.name).trim().toLowerCase() === String(me.name).trim().toLowerCase());
}
function setText(selector, value) {          // does nothing if you removed that element from index.html
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}
function isWinner(player) { return !!(data.poll && data.poll.winners && data.poll.winners.includes(player.id)); }
function cardHTML(player) {
  return `
    <article class="player-card${isMe(player) ? " is-me" : ""}${isWinner(player) ? " is-winner" : ""}">
      ${isWinner(player) ? '<span class="win-badge">👑 WINNER</span>' : ""}${isMe(player) ? '<span class="me-badge">YOU</span>' : ""}
      <div class="player-top"><div><div class="rating">${player.rating}</div><div class="position">${escapeHTML(player.position)} · OVR</div></div><span class="tag">${player.goals} ⚽</span></div>
      <div class="player-photo"><img src="${escapeHTML(player.image || `images/players/player-${player.id}.svg`)}" alt="${escapeHTML(player.name)}" loading="lazy" onerror="this.onerror=null;this.src='images/players/default.svg'"></div>
      <h3>${escapeHTML(player.name)}</h3><p class="nickname">${escapeHTML(player.nickname)}</p>
      <div class="mini-stats">
        <div class="mini-stat"><span>PAC</span><b>${player.pace}</b></div><div class="mini-stat"><span>SHO</span><b>${player.shooting}</b></div>
        <div class="mini-stat"><span>PAS</span><b>${player.passing}</b></div><div class="mini-stat"><span>DEF</span><b>${player.defending}</b></div>
        <div class="mini-stat"><span>AST</span><b>${player.assists}</b></div><div class="mini-stat"><span>PHY</span><b>${player.physical || 0}</b></div>
      </div>
    </article>`;
}
function renderPlayers() {
  if (!loaded) return;
  const grid = document.querySelector("#playerGrid");
  // the signed-in player's own card goes first
  const list = [...data.players].sort((a, b) => Number(isMe(b)) - Number(isMe(a)));
  grid.innerHTML = list.map(cardHTML).join("");
  const note = document.querySelector("#myCardNote");
  if (note) note.hidden = !(window.diddyMe && data.players.some(isMe));
  renderWinner();
}
/* the poll winner(s), pinned near the top once voting has closed */
function renderWinner() {
  const box = document.querySelector("#potd");
  if (!box) return;
  const winners = loaded && data.poll && !data.poll.open ? data.players.filter(isWinner) : [];
  box.hidden = !winners.length;
  if (!winners.length) return;
  setText("#potdTitle", data.poll.title + (winners.length > 1 ? " (joint winners)" : ""));
  document.querySelector("#potdCards").innerHTML = winners.map(cardHTML).join("");
}
function renderLeaderboard() {
  const sorted = [...data.players].sort((a, b) => b.goals - a.goals || b.assists - a.assists);
  { const lb = document.querySelector("#leaderboardBody"); if (lb) lb.innerHTML = sorted.map((p, i) => `
    <tr><td>${i === 0 ? "👑" : String(i + 1).padStart(2, "0")}</td><td>${escapeHTML(p.name)}</td><td>${escapeHTML(p.position)}</td><td>${p.goals}</td><td>${p.assists}</td><td class="ovr">${p.rating}</td></tr>`).join(""); }
  const scorer = sorted[0];
  setText("#topScorerName", scorer?.name || "No one yet");
  setText("#topScorerGoals", scorer?.goals ?? 0);
  setText("#totalGoals", data.players.reduce((sum, p) => sum + p.goals, 0));
  setText("#totalAssists", data.players.reduce((sum, p) => sum + p.assists, 0));
  setText("#cleanSheets", data.cleanSheets);
  setText("#ownGoals", data.ownGoals);
}
function renderResult() {
  setText("#homeScore", data.result.home);
  setText("#awayScore", data.result.away);
  setText("#resultCaption", data.result.note || "No match report. Suspicious.");
}
function renderSession() {
  const date = { set textContent(v) { setText("#nextDate", v); } };
  if (data.session.date) {
    const parsed = new Date(data.session.date);
    date.textContent = Number.isNaN(parsed.getTime()) ? "Date to be confirmed" : parsed.toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } else date.textContent = "Add your date";
  setText("#venue", data.session.venue || "Venue TBC");
}
function renderVotes() { /* voting is handled by js/voting.js (access codes + server) */ }
function renderAll() {                        // each part is separate, so one broken part can't stop the others
  [renderPlayers, renderLeaderboard, renderResult, renderSession, renderVotes].forEach(fn => { try { fn(); } catch (err) { console.error(fn.name, err); } });
}
function openDialog(id) { document.querySelector(id).showModal(); }

document.querySelector("#menuToggle").addEventListener("click", () => {
  const nav = document.querySelector("#mainNav");
  const open = nav.classList.toggle("open");
  document.querySelector("#menuToggle").setAttribute("aria-expanded", String(open));
});
document.querySelectorAll("#mainNav a").forEach(link => link.addEventListener("click", () => {
  document.querySelector("#mainNav").classList.remove("open");
  document.querySelector("#menuToggle").setAttribute("aria-expanded", "false");
}));
document.querySelector("#editSessionBtn").addEventListener("click", () => {
  document.querySelector("#sessionDate").value = data.session.date;
  document.querySelector("#sessionVenue").value = data.session.venue === "Your usual pitch" ? "" : data.session.venue;
  openDialog("#sessionDialog");
});
document.querySelector("#sessionForm").addEventListener("submit", event => {
  if (event.submitter?.id !== "saveSessionBtn") return;
  event.preventDefault();
  const session = { date: document.querySelector("#sessionDate").value, venue: document.querySelector("#sessionVenue").value.trim() || "Venue TBC" };
  adminPost("/admin/site", { session }).then(() => { data.session = session; renderSession(); document.querySelector("#sessionDialog").close(); showToast("Session details updated. Coach is cooking. 🧑‍🍳"); })
    .catch(err => showToast(err.message));
});
document.querySelector("#editResultBtn").addEventListener("click", () => {
  document.querySelector("#newHomeScore").value = data.result.home;
  document.querySelector("#newAwayScore").value = data.result.away;
  document.querySelector("#resultNote").value = data.result.note;
  openDialog("#resultDialog");
});
document.querySelector("#resultForm").addEventListener("submit", event => {
  if (event.submitter?.id !== "saveResultBtn") return;
  event.preventDefault();
  const home = Number(document.querySelector("#newHomeScore").value);
  const away = Number(document.querySelector("#newAwayScore").value);
  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0 || home > 99 || away > 99) {
    showToast("Scores must be whole numbers between 0 and 99."); return;
  }
  const result = { home, away, note: document.querySelector("#resultNote").value.trim() || "No match report. Suspicious." };
  adminPost("/admin/site", { result }).then(() => { data.result = result; renderResult(); document.querySelector("#resultDialog").close(); showToast("Result saved. VAR has left the chat. ⚽"); })
    .catch(err => showToast(err.message));
});
const banter = [
  "Your first touch has a long-distance relationship with the ball.",
  "You shoot like the goal owes you money. It doesn't.",
  "The GPS on your passes is still searching for a destination.",
  "Your defensive positioning is more of a philosophical concept.",
  "You have the confidence of prime Messi and the weak foot of a garden chair.",
  "The keeper saw that shot coming in the group chat yesterday.",
  "You don't lose possession. You make charitable donations.",
  "That was less a nutmeg and more a light snack.",
  "Your heat map is just a picture of the bench.",
  "Tiki-taka? More like kick-it-to-someone-and-hope."
];
document.querySelector("#banterBtn").addEventListener("click", () => {
  const node = document.querySelector("#banterText");
  let next = node.textContent;
  while (banter.length > 1 && next === node.textContent) next = banter[Math.floor(Math.random() * banter.length)];
  node.textContent = next; showToast("Fresh nonsense generated. Share responsibly. 😭");
});
// only the signed-in manager sees the edit buttons (the server checks the admin sign-in too)
if (!adminToken()) document.querySelectorAll("#editSessionBtn, #editResultBtn").forEach(el => { el.hidden = true; });
loadRemote();

window.showToast = showToast;
