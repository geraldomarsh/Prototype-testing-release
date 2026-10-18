/* Admin: squad editor, match log and season settings. Everything is saved on the server.
   js/admin-voting.js handles the admin sign-in and tells this file (via "admin-status") when to draw. */
(function () {
  var KEY = "diddyAdminToken", players = [], site = null, feedback = [], toastTimer;
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  function toast(msg) { var el = $("#toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2800); }
  function api(path, body) {
    var token = ""; try { token = localStorage.getItem(KEY) || ""; } catch (e) {}
    return fetch("/api" + path, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: body === undefined ? undefined : JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || "Something went wrong."); return d; }); });
  }
  function reload() { window.dispatchEvent(new Event("admin-reload")); }
  function num(id, min, max) {
    var el = document.getElementById(id), n = Number(el.value);
    if (el.value === "" || !Number.isInteger(n) || n < min || n > max) throw Error(((el.labels && el.labels[0] && el.labels[0].textContent) || id) + ": enter a whole number from " + min + " to " + max + ".");
    return n;
  }
  var members = function () { return players.filter(function (p) { return p.status === "approved"; }); };

  function render() {
    var m = members();
    $("#summaryPlayers").textContent = m.length;
    $("#summaryGoals").textContent = m.reduce(function (s, p) { return s + (+p.goals || 0); }, 0);
    $("#summaryAssists").textContent = m.reduce(function (s, p) { return s + (+p.assists || 0); }, 0);
    $("#adminPlayerList").innerHTML = m.length ? m.map(function (p) {
      return '<article class="admin-player-row"><span class="admin-player-emoji"><img src="' + esc(p.image) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit"></span><div class="admin-player-info"><strong>' + esc(p.name) +
        "</strong><small>" + esc(p.nickname || "No nickname") + " · " + esc(p.position) + " · OVR " + p.rating + " · ⚽ " + p.goals + " · 🪄 " + p.assists +
        '</small></div><div class="admin-player-actions"><button type="button" data-edit="' + p.id + '">Edit</button><button type="button" class="delete-player" data-delete="' + p.id + '">×</button></div></article>';
    }).join("") : '<div class="empty-state">No players yet. Add the first menace above.</div>';
    $("#matchStatsFields").innerHTML = m.map(function (p) {
      return '<div class="match-stat-row"><span class="match-stat-name">' + esc(p.name) + '</span><div><label for="g' + p.id + '">Goals</label><input id="g' + p.id + '" type="number" min="0" max="99" value="0" data-g="' + p.id + '"></div><div><label for="a' + p.id + '">Assists</label><input id="a' + p.id + '" type="number" min="0" max="99" value="0" data-a="' + p.id + '"></div></div>';
    }).join("");
    if (site) { $("#cleanSheetsInput").value = site.cleanSheets; $("#ownGoalsInput").value = site.ownGoals; }
  }
  var TYPES = { bug: "🐞 Bug", question: "❓ Question", suggestion: "💡 Idea" };
  function renderFeedback() {
    var showDone = $("#fbShowDone").checked, open = feedback.filter(function (f) { return f.status !== "done"; }).length;
    $("#fbTitle").textContent = "Feedback" + (open ? " (" + open + " new)" : "");
    var list = feedback.filter(function (f) { return showDone || f.status !== "done"; }).slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
    $("#fbList").innerHTML = list.length ? list.map(function (f) {
      return '<article class="fb-item' + (f.status === "done" ? " is-done" : "") + '"><div class="fb-meta"><strong>' + (TYPES[f.type] || esc(f.type)) + "</strong><span>" +
        new Date(f.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + "</span>" +
        (f.name ? "<span>👤 " + esc(f.name) + "</span>" : "") + (f.contact ? "<span>✉ " + esc(f.contact) + "</span>" : "") + (f.page ? "<span>" + esc(f.page) + "</span>" : "") +
        '</div><p class="fb-msg">' + esc(f.message) + '</p><div class="fb-meta"><span>' + esc(f.ua || "") + '</span></div>' +
        '<button type="button" class="button button-ghost button-small" data-fb="' + (f.status === "done" ? "reopen" : "done") + '" data-id="' + f.id + '">' + (f.status === "done" ? "Re-open" : "✓ Done") + "</button> " +
        '<button type="button" class="button button-ghost button-small" data-fb="delete" data-id="' + f.id + '">Delete</button></article>';
    }).join("") : '<p class="tiny muted">Nothing here. Quiet inbox.</p>';
  }
  function resetForm() {
    $("#playerForm").reset(); $("#playerId").value = "";
    $("#playerRating").value = 75; ["#playerPace", "#playerShooting", "#playerPassing", "#playerDefending"].forEach(function (s) { $(s).value = 70; });
    $("#playerGoals").value = 0; $("#playerAssists").value = 0;
    $("#savePlayerBtn").textContent = "＋ Add player"; $("#cancelEditBtn").hidden = true;
  }
  function edit(id) {
    var p = players.filter(function (x) { return x.id === +id; })[0]; if (!p) return;
    var map = { playerId: "id", playerName: "name", playerNickname: "nickname", playerPosition: "position", playerImage: "image", playerRating: "rating", playerGoals: "goals", playerAssists: "assists", playerPace: "pace", playerShooting: "shooting", playerPassing: "passing", playerDefending: "defending" };
    Object.keys(map).forEach(function (f) { document.getElementById(f).value = p[map[f]] == null ? "" : p[map[f]]; });
    $("#savePlayerBtn").textContent = "Save player changes"; $("#cancelEditBtn").hidden = false; $("#playerManagement").scrollIntoView({ behavior: "smooth" });
  }

  window.addEventListener("admin-status", function (e) { players = e.detail.players; site = e.detail.site; feedback = e.detail.feedback || []; render(); renderFeedback(); });

  document.addEventListener("DOMContentLoaded", function () {
    $("#menuToggle").addEventListener("click", function () { var n = $("#mainNav"), o = n.classList.toggle("open"); this.setAttribute("aria-expanded", String(o)); });

    $("#fbShowDone").addEventListener("change", renderFeedback);
    $("#fbList").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-fb]"); if (!b) return;
      if (b.dataset.fb === "delete" && !confirm("Delete this message?")) return;
      api("/admin/feedback/" + b.dataset.id + "/" + b.dataset.fb, {}).then(reload).catch(function (err) { toast(err.message); });
    });
    $("#playerForm").addEventListener("submit", function (e) {
      e.preventDefault();
      try {
        var body = { id: $("#playerId").value || undefined, name: $("#playerName").value.trim(), nickname: $("#playerNickname").value.trim(), position: $("#playerPosition").value,
          image: $("#playerImage").value.trim() || undefined, rating: num("playerRating", 1, 99), goals: num("playerGoals", 0, 9999), assists: num("playerAssists", 0, 9999),
          pace: num("playerPace", 1, 99), shooting: num("playerShooting", 1, 99), passing: num("playerPassing", 1, 99), defending: num("playerDefending", 1, 99), physical: num("playerPhysical", 1, 99) };
        if (!body.name) throw Error("Player name is required.");
        var isNew = !body.id;
        api("/admin/player", body).then(function () { resetForm(); reload(); toast(isNew ? "Player added to the circus. 🎪" : "Player updated. Stats department online."); }).catch(function (err) { toast(err.message); });
      } catch (err) { toast(err.message); }
    });
    $("#cancelEditBtn").addEventListener("click", resetForm);
    $("#adminPlayerList").addEventListener("click", function (e) {
      var eb = e.target.closest("[data-edit]"), db = e.target.closest("[data-delete]");
      if (eb) return edit(eb.dataset.edit);
      if (db) {
        var p = players.filter(function (x) { return x.id === +db.dataset.delete; })[0];
        if (!p || !confirm("Remove " + p.name + " from the squad? Their votes go too.")) return;
        api("/admin/players/" + p.id + "/delete", {}).then(function () { reload(); toast("Player removed from the squad."); }).catch(function (err) { toast(err.message); });
      }
    });
    $("#matchForm").addEventListener("submit", function (e) {
      e.preventDefault();
      try {
        var stats = members().map(function (p) { return { id: p.id, g: num("g" + p.id, 0, 99), a: num("a" + p.id, 0, 99) }; });
        var body = { home: num("matchHome", 0, 99), away: num("matchAway", 0, 99), note: $("#matchNote").value.trim(), venue: $("#matchVenue").value.trim(), stats: stats };
        api("/admin/match", body).then(function () {
          $("#matchForm").reset(); $("#matchHome").value = 0; $("#matchAway").value = 0;
          document.querySelectorAll("[data-g],[data-a]").forEach(function (x) { x.value = 0; });
          reload(); toast("Match logged! Check the homepage. ⚽");
        }).catch(function (err) { toast(err.message); });
      } catch (err) { toast(err.message); }
    });
    $("#settingsForm").addEventListener("submit", function (e) {
      e.preventDefault();
      try {
        api("/admin/site", { cleanSheets: num("cleanSheetsInput", 0, 9999), ownGoals: num("ownGoalsInput", 0, 9999) })
          .then(function () { reload(); toast("Season settings saved."); }).catch(function (err) { toast(err.message); });
      } catch (err) { toast(err.message); }
    });
    $("#exportBtn").addEventListener("click", function () {
      api("/admin/export").then(function (d) {
        var url = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }));
        var a = document.createElement("a"); a.href = url; a.download = "the-diddy-party-backup.json"; a.click(); URL.revokeObjectURL(url);
        toast("Backup downloaded. It contains the access codes, so keep it private.");
      }).catch(function (err) { toast(err.message); });
    });
  });
})();
