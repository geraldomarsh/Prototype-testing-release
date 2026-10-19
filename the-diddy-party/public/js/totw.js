/* Team of the Week. Edit WEEK and TOTW below each week.
   row 1 = top of the pitch (attack), row 2 = middle, row 3 = goalkeeper. Use as many as you like per row. */
(function () {
  var WEEK = "Week 12";
  var TOTW = [
    { name: "Geraldo", role: "ST", note: "2 goals",       image: "images/players/player-1.svg", row: 1 },
    { name: "Luca",    role: "LM", note: "3 assists",     image: "images/players/player-2.svg", row: 2 },
    { name: "Mpho",    role: "RM", note: "Man of the match", image: "images/players/player-3.svg", row: 2 },
    { name: "Dan",     role: "GK", note: "Clean sheet",   image: "images/players/player-5.svg", row: 3, gk: true }
  ];
  var el = document.getElementById("totwPitch"); if (!el) return;
  var wk = document.getElementById("totwWeek"); if (wk) wk.textContent = WEEK;
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var rows = {};
  TOTW.forEach(function (p) { (rows[p.row] = rows[p.row] || []).push(p); });
  var html = '<div class="totw-title">TEAM OF THE WEEK<small>' + esc(WEEK) + '</small></div>' +
    '<div class="halfway"></div><div class="circle"></div><div class="box"></div><div class="six"></div>';
  Object.keys(rows).sort(function (a, b) { return a - b; }).forEach(function (r) {
    html += '<div class="totw-row">' + rows[r].map(function (p) {
      return '<div class="totw-player' + (p.gk ? ' totw-gk' : '') + '">' +
        '<div class="totw-photo"><img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" onerror="this.onerror=null;this.src=\'images/players/default.svg\'"></div>' +
        '<div class="totw-name">' + esc(p.name) + '</div>' +
        '<div class="totw-note">' + esc(p.role) + (p.note ? ' · ' + esc(p.note) : '') + '</div></div>';
    }).join("") + '</div>';
  });
  el.innerHTML = html;
})();
