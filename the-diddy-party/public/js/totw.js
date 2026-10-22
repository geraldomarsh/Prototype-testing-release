/* Team of the Week (home page). Members pick a formation and 4 starters by dragging (or tapping) players onto a pitch.
   Needs <section id="totw" hidden></section> in index.html. Loads its own stylesheet. */
(function () {
  var root = document.getElementById("totw"); if (!root) return;
  var link = document.createElement("link"); link.rel = "stylesheet"; link.href = "css/totw.css"; document.head.appendChild(link);

  var TOKEN_KEY = "diddyToken", SLOTS = 4;
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var getToken = function () { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } };

  var view = null;                       // last server view
  var formation = "2-2", slots = [null, null, null, null], selected = null, msg = "", msgBad = false, saving = false;
  var drag = null, lastHandled = 0;

  function api(path, opts) {
    opts = opts || {}; var h = { "Content-Type": "application/json" }, t = getToken(); if (t) h.Authorization = "Bearer " + t;
    return fetch("/api" + path, { method: opts.method || "GET", headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var e = new Error(d.error || "Something went wrong"); e.status = r.status; throw e; } return d; }); });
  }

  /* where the 4 spots sit for a formation like "1-2-1" (lines from your own goal up the pitch). Slot order = back to front, left to right. */
  function layout(f) {
    var lines = f.split("-").map(Number), n = lines.length, ys = n === 2 ? [74, 30] : [78, 52, 26], out = [];
    lines.forEach(function (c, li) {
      var xs = c === 1 ? [50] : c === 2 ? [30, 70] : [18, 50, 82];
      xs.forEach(function (x) { out.push({ x: x, y: ys[li] }); });
    });
    return out;
  }
  function byId(id) { return (view.options || []).filter(function (o) { return o.id === id; })[0]; }

  function tokenHTML(p, extra) {
    return '<span class="tw-token' + (extra || "") + '" data-id="' + p.id + '"><img src="' + esc(p.image) + '" alt=""><b>' + esc(p.name) + "</b><small>" + p.rating + "</small></span>";
  }
  function pitchHTML(f, cards, interactive) {
    var pos = layout(f), html = '<div class="tw-pitch" id="' + (interactive ? "twPitch" : "twFinalPitch") + '"><i class="tw-box top"></i><i class="tw-box bot"></i>';
    pos.forEach(function (s, i) {
      var p = cards[i];
      html += '<div class="tw-slot' + (interactive ? "" : " tw-final") + '" data-i="' + i + '" style="left:' + s.x + "%;top:" + s.y + '%">' +
        (p ? tokenHTML(p) : '<span class="tw-empty">' + (interactive ? "+" : "") + "</span>") + "</div>";
    });
    return html + "</div>";
  }

  function render() {
    if (drag && drag.on) return;
    if (!view) { root.hidden = true; return; }
    var r = view.round;
    if (!r.open && !view.result) { root.hidden = true; return; }
    root.hidden = false;
    if (!r.open) {                        // final team, shown to everyone
      root.innerHTML = '<p class="eyebrow">⭐ TEAM OF THE WEEK · PICKS CLOSED</p><h2>The people\'s four · ' + esc(view.result.formation) + "</h2>" +
        '<p class="tiny muted">Chosen by ' + view.result.picks + " member" + (view.result.picks === 1 ? "" : "s") + (view.result.tie ? ". Level on votes for the last spot, so the higher rating got it" : "") + ".</p>" +
        '<div class="totw-layout">' + pitchHTML(view.result.formation, view.result.slots, false) + "</div>";
      return;
    }
    if (!view.me) {
      root.innerHTML = '<p class="eyebrow">⭐ TEAM OF THE WEEK</p><h2>Pick your starting four</h2><p class="muted">Sign in with your access code at the top of the page to build your Team of the Week. 🔒 Picks stay secret until the manager closes the round.</p>';
      return;
    }
    var placed = {}; slots.forEach(function (id) { if (id) placed[id] = 1; });
    var cards = slots.map(function (id) { return id ? byId(id) : null; });
    var pool = view.options.filter(function (o) { return !placed[o.id]; });
    var full = slots.every(Boolean);
    root.innerHTML = '<p class="eyebrow">⭐ TEAM OF THE WEEK · PICKS OPEN</p><h2>Pick your starting four</h2>' +
      '<p class="tiny muted">Choose a formation, then drag players onto the pitch (or tap a player, then tap a spot). You can\'t pick yourself. Your team stays secret until the manager closes the round' + (view.myPick ? ". You can change yours until then" : "") + ".</p>" +
      '<div class="tw-formations" role="group" aria-label="Formation">' + view.formations.map(function (f) { return '<button type="button" data-f="' + f + '" aria-pressed="' + (f === formation) + '">' + f + "</button>"; }).join("") + "</div>" +
      '<div class="totw-layout has-pool">' + pitchHTML(formation, cards, true) +
      '<div class="tw-poolwrap"><h3>Your squad (' + pool.length + ')</h3><div class="tw-pool" id="twPool">' +
      (pool.length ? pool.map(function (p) { return '<span class="tw-chip' + (selected === p.id ? " selected" : "") + '" data-id="' + p.id + '"><img src="' + esc(p.image) + '" alt=""><b>' + esc(p.name) + "</b><small>" + esc(p.position) + " · " + p.rating + "</small></span>"; }).join("") : '<p class="tiny muted">Everyone is on the pitch.</p>') +
      '</div><div class="tw-actions"><button type="button" class="button button-green" id="twSave"' + (full && !saving ? "" : " disabled") + ">" + (saving ? "Saving…" : view.myPick ? "Update my team" : "Lock in my team") + '</button><button type="button" class="button button-ghost button-small" id="twClear">Clear pitch</button>' +
      '<span class="tiny" id="twMsg" style="' + (msgBad ? "color:var(--red)" : "") + '">' + esc(msg || (full ? "" : (SLOTS - slots.filter(Boolean).length) + " more to pick")) + "</span></div></div></div>";
    if (selected) root.querySelectorAll(".tw-slot").forEach(function (s) { s.classList.add("target"); });
  }

  /* ----- state changes ----- */
  function setMsg(t, bad) { msg = t || ""; msgBad = !!bad; }
  function place(id, i, fromSlot) {
    if (fromSlot != null && fromSlot !== i) { var tmp = slots[i]; slots[i] = id; slots[fromSlot] = tmp; }
    else slots[i] = id;
    selected = null; setMsg("");
  }
  function removeFrom(i) { slots[i] = null; selected = null; setMsg(""); }

  /* ----- drag & drop (pointer events: mouse, touch and pen). Touch needs a short press to start so the page can still scroll. ----- */
  root.addEventListener("pointerdown", function (e) {
    var el = e.target.closest && e.target.closest(".tw-chip,.tw-token"); if (!el || !view || !view.round.open || (e.pointerType === "mouse" && e.button !== 0)) return;
    var slotEl = el.closest(".tw-slot");
    drag = { id: Number(el.dataset.id), from: slotEl ? Number(slotEl.dataset.i) : null, el: el, x: e.clientX, y: e.clientY, touch: e.pointerType !== "mouse", on: false, pid: e.pointerId, ghost: null, timer: null };
    if (drag.touch) drag.timer = setTimeout(function () { if (drag) begin(); }, 200);
  });
  function begin() {
    if (!drag || drag.on) return;
    drag.on = true; clearTimeout(drag.timer); document.body.classList.add("tw-dragging");
    var p = byId(drag.id), g = document.createElement("div"); g.className = "tw-ghost";
    g.innerHTML = '<img src="' + esc(p.image) + '" alt=""><b>' + esc(p.name) + "</b>"; document.body.appendChild(g); drag.ghost = g;
    drag.el.classList.add("dragging"); moveGhost(drag.x, drag.y);
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) {} }
  }
  function moveGhost(x, y) {
    drag.ghost.style.left = x + "px"; drag.ghost.style.top = y + "px";
    var s = slotAt(x, y); root.querySelectorAll(".tw-slot.over").forEach(function (n) { if (n !== s) n.classList.remove("over"); }); if (s) s.classList.add("over");
  }
  function slotAt(x, y) { var el = document.elementFromPoint(x, y); return el && el.closest ? el.closest("#twPitch .tw-slot") : null; }
  document.addEventListener("pointermove", function (e) {
    if (!drag || e.pointerId !== drag.pid) return;
    var dist = Math.hypot(e.clientX - drag.x, e.clientY - drag.y);
    if (!drag.on) {
      if (drag.touch) { if (dist > 10) { clearTimeout(drag.timer); drag = null; } return; }     // finger moved first: it's a scroll
      if (dist > 5) begin(); else return;
    }
    drag.x = e.clientX; drag.y = e.clientY; moveGhost(e.clientX, e.clientY);
  });
  document.addEventListener("touchmove", function (e) { if (drag && drag.on && e.cancelable) e.preventDefault(); }, { passive: false });
  function finish(e, cancelled) {
    if (!drag || e.pointerId !== drag.pid) return;
    var d = drag; clearTimeout(d.timer); drag = null;
    document.body.classList.remove("tw-dragging"); if (d.ghost) d.ghost.remove();
    lastHandled = Date.now();
    if (d.on) {
      if (!cancelled) { var s = slotAt(e.clientX, e.clientY); if (s) place(d.id, Number(s.dataset.i), d.from); else if (d.from != null) removeFrom(d.from); }
    } else if (!cancelled) {                                                              // a tap
      if (d.from == null) selected = selected === d.id ? null : d.id;
      else if (selected) place(selected, d.from, null);
      else removeFrom(d.from);
    }
    render();
  }
  document.addEventListener("pointerup", function (e) { finish(e, false); });
  document.addEventListener("pointercancel", function (e) { finish(e, true); });
  root.addEventListener("contextmenu", function (e) { if (e.target.closest(".tw-chip,.tw-token")) e.preventDefault(); });
  root.addEventListener("dragstart", function (e) { e.preventDefault(); });

  /* ----- clicks: empty spots, formation, save, clear ----- */
  root.addEventListener("click", function (e) {
    var t = e.target;
    if (t.closest("[data-f]")) { formation = t.closest("[data-f]").dataset.f; setMsg(""); return render(); }
    if (t.closest("#twClear")) { slots = [null, null, null, null]; selected = null; setMsg(""); return render(); }
    if (t.closest("#twSave")) return save();
    var s = t.closest(".tw-slot");
    if (s && !s.querySelector(".tw-token") && selected && Date.now() - lastHandled > 60) { place(selected, Number(s.dataset.i), null); render(); }
  });

  function save() {
    if (saving || !slots.every(Boolean)) return;
    saving = true; setMsg(""); render();
    api("/team-week", { method: "POST", body: { formation: formation, slots: slots } }).then(function (d) {
      saving = false; view = d; setMsg("Saved ✓ You can change it until the manager closes the round."); render();
      if (window.showToast) window.showToast("Team of the Week locked in ⭐");
    }).catch(function (err) { saving = false; setMsg(err.message, true); render(); if (err.status === 401) load(); });
  }

  function adopt(d) {
    var sameRound = view && view.round.id === d.round.id && view.me && d.me && view.me.id === d.me.id;
    view = d;
    if (!sameRound || !drag) {
      if (!sameRound) { selected = null; msg = ""; }
      if (d.myPick && !sameRound) { formation = d.myPick.formation; slots = d.myPick.slots.slice(); }
      else if (!sameRound) { slots = [null, null, null, null]; }
      slots = slots.map(function (id) { return id && byId(id) ? id : null; });     // drop anyone who's no longer available
    }
    render();
  }
  function load() { return api("/team-week").then(adopt).catch(function () { /* server unreachable: leave the section as it is */ }); }

  var lastTok = getToken();
  setInterval(function () { var t = getToken(); if (t !== lastTok) { lastTok = t; view = null; load(); } }, 1000);     // sign in / out elsewhere on the page
  document.addEventListener("visibilitychange", function () { if (!document.hidden && !(drag && drag.on) && !saving) load(); });
  load();
})();
