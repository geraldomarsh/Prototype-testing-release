/* Admin: access codes + who has voted. Needs server.js running. */
(function () {
  var KEY = "diddyAdminToken", token = "";
  try { token = localStorage.getItem(KEY) || ""; } catch (e) {}
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  function api(path, opts) {
    opts = opts || {};
    var h = { "Content-Type": "application/json" }; if (token) h.Authorization = "Bearer " + token;
    return fetch("/api" + path, { method: opts.method || "GET", headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) { var e = new Error(d.error || "Error"); e.status = r.status; throw e; } return d; }); });
  }
  function say(t, bad) { var m = $("avMsg"); m.textContent = t || ""; m.style.color = bad ? "var(--red)" : ""; }
  function fmt(ts) { return ts ? new Date(ts).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"; }

  function load() {
    var reveal = $("avReveal").checked ? "?reveal=1" : "";
    return api("/admin/status" + reveal).then(function (s) {
      $("avLogin").hidden = true; $("avPanel").hidden = false; say("");
      $("avTitle").textContent = s.poll.title + (s.poll.open ? "" : " (closed)");
      $("avCount").textContent = s.votedCount + " of " + s.players.length + " have voted";
      $("avNot").textContent = s.notVoted.length ? "Still to vote: " + s.notVoted.join(", ") : "Everyone has voted 🎉";
      $("avToggle").textContent = s.poll.open ? "Close voting" : "Re-open voting";
      $("avToggle").dataset.open = s.poll.open ? "1" : "0";
      $("avRows").innerHTML = s.players.map(function (p) {
        return "<tr><td>" + esc(p.name) + '</td><td><code class="av-code">' + esc(p.code) + "</code></td><td>" +
          (p.voted ? "✅ " + fmt(p.at) : "❌ not yet") + "</td>" + ($("avReveal").checked ? "<td>" + esc(p.choice || "") + "</td>" : "") +
          '<td class="av-actions"><button type="button" class="button button-ghost button-small" data-act="copy" data-id="' + p.id + '" data-code="' + esc(p.code) + '">Copy code</button> ' +
          '<button type="button" class="button button-ghost button-small" data-act="regen" data-id="' + p.id + '">New code</button> ' +
          '<button type="button" class="button button-ghost button-small" data-act="delete" data-id="' + p.id + '" data-name="' + esc(p.name) + '">Remove</button></td></tr>';
      }).join("");
      $("avHead").innerHTML = "<th>Player</th><th>Access code</th><th>Voted?</th>" + ($("avReveal").checked ? "<th>Voted for</th>" : "") + "<th></th>";
      window.__notVoted = s.notVoted;
    }).catch(function (e) {
      $("avLogin").hidden = false; $("avPanel").hidden = true;
      if (e.status === 401) { token = ""; try { localStorage.removeItem(KEY); } catch (x) {} if (e.message !== "Admin only.") say(e.message, true); }
      else say("Can't reach the server. Run node server.js and open the site from it.", true);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!$("avLoginForm")) return;
    $("avLoginForm").addEventListener("submit", function (e) {
      e.preventDefault(); say("Checking…");
      api("/admin/login", { method: "POST", body: { code: $("avCode").value } }).then(function (d) {
        token = d.token; try { localStorage.setItem(KEY, token); } catch (x) {} $("avCode").value = ""; return load();
      }).catch(function (err) { say(err.status ? err.message : "Can't reach the server (run node server.js).", true); });
    });
    $("avReveal").addEventListener("change", load);
    $("avRefresh").addEventListener("click", load);
    $("avSignOut").addEventListener("click", function () { token = ""; try { localStorage.removeItem(KEY); } catch (x) {} load(); });
    $("avToggle").addEventListener("click", function () {
      api("/admin/poll/" + (this.dataset.open === "1" ? "close" : "open"), { method: "POST" }).then(load);
    });
    $("avNew").addEventListener("submit", function (e) {
      e.preventDefault();
      if (!confirm("Start a new poll? Everyone can vote again. Old votes are kept in the history.")) return;
      api("/admin/poll", { method: "POST", body: { title: $("avNewTitle").value } }).then(function () { $("avNewTitle").value = ""; load(); });
    });
    $("avAdd").addEventListener("submit", function (e) {
      e.preventDefault();
      api("/admin/players", { method: "POST", body: { name: $("avAddName").value } }).then(function () { $("avAddName").value = ""; load(); }).catch(function (x) { say(x.message, true); });
    });
    $("avCopyNot").addEventListener("click", function () {
      var t = (window.__notVoted || []).length ? "Still to vote: " + window.__notVoted.join(", ") : "Everyone has voted!";
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { say("Copied: " + t); }).catch(function () { say(t); });
    });
    $("avRows").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var id = b.dataset.id, act = b.dataset.act;
      if (act === "copy") { (navigator.clipboard ? navigator.clipboard.writeText(b.dataset.code) : Promise.reject()).then(function () { say("Code copied"); }).catch(function () { say("Code: " + b.dataset.code); }); }
      if (act === "regen" && confirm("Make a new code? The old one stops working.")) api("/admin/players/" + id + "/regen", { method: "POST" }).then(load);
      if (act === "delete" && confirm("Remove " + b.dataset.name + " from voting?")) api("/admin/players/" + id + "/delete", { method: "POST" }).then(load);
    });
    load();
  });
})();
