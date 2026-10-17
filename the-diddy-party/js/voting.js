/* Member voting with access codes. Talks to server.js (/api/...). */
(function () {
  var TOKEN_KEY = "diddyToken";
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var token = ""; try { token = localStorage.getItem(TOKEN_KEY) || ""; } catch (e) {}

  function api(path, opts) {
    opts = opts || {};
    var headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    return fetch("/api" + path, { method: opts.method || "GET", headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok) { var err = new Error(d.error || "Something went wrong"); err.status = r.status; throw err; }
          return d;
        });
      });
  }
  function saveToken(t) { token = t || ""; try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} }
  function msg(text, bad) { var m = $("loginMsg"); m.textContent = text || ""; m.style.color = bad ? "var(--red)" : ""; }

  function setMe(me) {
    var changed = JSON.stringify(window.diddyMe || null) !== JSON.stringify(me || null);
    window.diddyMe = me || null;
    if (changed && typeof renderPlayers === "function") renderPlayers();   // re-order the cards: yours first
  }

  function render(poll) {
    setMe(poll.me);
    $("pollTitle").textContent = "🗳️ " + poll.title;
    $("pollTag").textContent = poll.open ? "MEMBERS ONLY" : "VOTING CLOSED";
    var signedIn = !!poll.me;
    $("voteLogin").hidden = signedIn; $("voteApp").hidden = !signedIn;
    if (signedIn) {
      $("voteWho").textContent = "Signed in as " + poll.me.name + (poll.myVote ? " · you've voted (you can change it)" : " · you haven't voted yet");
      var sel = $("votePlayer");
      sel.innerHTML = poll.options.filter(function (o) { return o.id !== poll.me.id; }).map(function (o) {
        return '<option value="' + o.id + '"' + (o.id === poll.myVote ? " selected" : "") + ">" + esc(o.name) + "</option>";
      }).join("");
      sel.disabled = $("voteSubmit").disabled = !poll.open;
    }
    var rows = poll.options.map(function (o) { return { name: o.name, n: poll.counts[o.id] || 0 }; })
      .filter(function (r) { return r.n > 0; }).sort(function (a, b) { return b.n - a.n; });
    $("voteResults").innerHTML = (rows.length ? rows.map(function (r) {
      return '<div class="vote-row"><span>' + esc(r.name) + '</span><div class="vote-track"><div class="vote-fill" style="width:' + Math.round(r.n / poll.total * 100) + '%"></div></div><b>' + r.n + "</b></div>";
    }).join("") : '<p class="tiny muted">No votes yet. Be the first to cause controversy.</p>') +
      '<p class="tiny muted">' + poll.total + " of " + poll.voters + " have voted</p>";
  }

  function refresh() {
    return api("/poll").then(render).catch(function (e) {
      if (e.status === 401) { saveToken(""); return refresh(); }
      $("voteLogin").hidden = false; $("voteApp").hidden = true;
      msg("Voting needs the website server running (node server.js).", true);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!$("loginForm")) return;
    $("loginForm").addEventListener("submit", function (e) {
      e.preventDefault(); msg("Checking…");
      api("/login", { method: "POST", body: { code: $("accessCode").value } }).then(function (d) {
        saveToken(d.token); $("accessCode").value = ""; msg(""); return refresh();
      }).catch(function (err) { msg(err.status ? err.message : "Can't reach the server (run node server.js).", true); });
    });
    $("voteForm").addEventListener("submit", function (e) {
      e.preventDefault();
      api("/vote", { method: "POST", body: { choiceId: $("votePlayer").value } }).then(function (p) {
        render(p); if (window.showToast) window.showToast("Vote locked in 🗳️");
      }).catch(function (err) { alert(err.message); if (err.status === 401) { saveToken(""); refresh(); } });
    });
    $("signOutBtn").addEventListener("click", function () {
      api("/logout", { method: "POST" }).catch(function () {}).then(function () { saveToken(""); return refresh(); });
    });
    refresh();
  });
})();
