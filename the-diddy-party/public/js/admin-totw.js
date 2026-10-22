/* Admin: Team of the Week. Needs <section id="totwAdmin"> inside the signed-in part of admin.html. Draws after js/admin-voting.js signs in. */
(function () {
  var KEY = "diddyAdminToken", $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  function api(path, method) {
    var t = ""; try { t = localStorage.getItem(KEY) || ""; } catch (e) {}
    return fetch("/api" + path, { method: method || "GET", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t }, body: method ? "{}" : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || "Error"); return d; }); });
  }
  function say(t, bad) { var m = $("twaMsg"); if (m) { m.textContent = t || ""; m.style.color = bad ? "var(--red)" : ""; } }

  function draw(d) {
    var r = d.result, open = d.round.open;
    $("twaState").textContent = (open ? "Picks are OPEN" : "Picks are closed") + " · round " + d.round.id;
    $("twaCount").textContent = d.submitted + " of " + d.members + " members have picked" + (d.waiting.length ? ". Still to pick: " + d.waiting.join(", ") : ".");
    $("twaToggle").textContent = open ? "Close picks (reveal team to everyone)" : "Re-open picks";
    $("twaToggle").dataset.open = open ? "1" : "0";
    if (!r) { $("twaResult").innerHTML = '<p class="tiny muted">No picks yet.</p>'; $("twaPicks").innerHTML = ""; return; }
    var max = Math.max.apply(null, r.ranking.map(function (x) { return x.votes; }));
    $("twaResult").innerHTML =
      "<h3>Suggested Team of the Week · " + esc(r.formation) + "</h3>" +
      '<p class="tiny muted">Most popular formation, then the four most-picked players, placed back to front by where members put them.' + (r.tie ? " ⚠️ Tied at the last spot, the higher rating got it." : "") + "</p>" +
      "<ol>" + r.slots.map(function (s) { return "<li><b>" + esc(s.name) + "</b> · " + s.votes + " of " + r.picks + " picks</li>"; }).join("") + "</ol>" +
      "<h3>All players by picks</h3>" + r.ranking.map(function (x) {
        return '<div class="vote-row" style="grid-template-columns:90px 1fr 24px"><span>' + esc(x.name) + '</span><div class="vote-track"><div class="vote-fill" style="width:' + Math.round(x.votes / max * 100) + '%"></div></div><b>' + x.votes + "</b></div>";
      }).join("") +
      '<h3>Formations</h3><p class="tiny">' + Object.keys(r.formations).map(function (f) { return esc(f) + " × " + r.formations[f]; }).join(" · ") + "</p>";
    $("twaPicks").innerHTML = "<summary>Each member's team (" + d.picks.length + ")</summary>" + d.picks.map(function (p) {
      return '<p class="tiny"><b>' + esc(p.voter) + "</b> · " + esc(p.formation) + ": " + p.slots.map(esc).join(", ") + "</p>";
    }).join("");
  }
  function load() { return api("/admin/team-week").then(function (d) { draw(d); say(""); }).catch(function (e) { say(e.message, true); }); }

  document.addEventListener("DOMContentLoaded", function () {
    if (!$("totwAdmin")) return;
    $("twaToggle").addEventListener("click", function () {
      api("/admin/team-week/" + ($("twaToggle").dataset.open === "1" ? "close" : "open"), "POST").then(load).catch(function (e) { say(e.message, true); });
    });
    $("twaNew").addEventListener("click", function () {
      if (!confirm("Start a new round? This clears everyone's current picks.")) return;
      api("/admin/team-week/new", "POST").then(load).catch(function (e) { say(e.message, true); });
    });
    $("twaRefresh").addEventListener("click", load);
    window.addEventListener("admin-status", load);       // fires once the admin is signed in
  });
})();
