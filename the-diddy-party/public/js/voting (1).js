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
    $("voteLogin").hidden = signedIn; $("memberIn").hidden = !signedIn; $("voteApp").hidden = !signedIn; $("voteHint").hidden = signedIn;
    if (signedIn) $("memberName").textContent = "✅ Signed in as " + poll.me.name;
    if (signedIn) {
      $("voteWho").textContent = "Signed in as " + poll.me.name + (poll.myVote ? " · you've voted (you can change it)" : " · you haven't voted yet");
      var sel = $("votePlayer");
      sel.innerHTML = poll.options.filter(function (o) { return o.id !== poll.me.id; }).map(function (o) {
        return '<option value="' + o.id + '"' + (o.id === poll.myVote ? " selected" : "") + ">" + esc(o.name) + "</option>";
      }).join("");
      sel.disabled = $("voteSubmit").disabled = !poll.open;
    }
    // vote counts are secret: members only see turnout, and the winner once voting has closed
    var html = '<p class="tiny muted">' + poll.total + " of " + poll.voters + " members have voted.</p>";
    if (poll.open) html += '<p class="tiny muted">🔒 Results are revealed when voting closes.</p>';
    else if (poll.winners && poll.winners.length) html += '<p class="vote-winner">🏆 ' + (poll.winners.length > 1 ? "Joint winners: " : "Winner: ") + poll.winners.map(function (w) { return esc(w.name); }).join(", ") + "</p>";
    else html += '<p class="tiny muted">Voting is closed. Nobody got a vote.</p>';
    $("voteResults").innerHTML = html;
  }

  function refresh() {
    return api("/poll").then(render).catch(function (e) {
      if (e.status === 401) { saveToken(""); return refresh(); }
      $("voteLogin").hidden = false; $("memberIn").hidden = true; $("voteApp").hidden = true; $("voteHint").hidden = false;
      msg("Can't reach the server. (Running locally? Use node dev-server.js.)", true);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!$("loginForm")) return;
    $("loginForm").addEventListener("submit", function (e) {
      e.preventDefault(); msg("Checking…");
      api("/login", { method: "POST", body: { code: $("accessCode").value } }).then(function (d) {
        saveToken(d.token); $("accessCode").value = ""; msg(""); return refresh();
      }).catch(function (err) { msg(err.status ? err.message : "Can\'t reach the server.", true); });
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
