/* "My Team" section: pick a league + team, see fixtures, results and news.
   Data: TheSportsDB (free test key "3") for teams/fixtures, Google News RSS (via rss2json) for news.
   To add a league, add one line to LEAGUES. */
(function () {
  var API = "https://www.thesportsdb.com/api/v1/json/3/";
  var KEY = "diddyFavTeam";
  var LEAGUES = [
    { id: "4328", name: "English Premier League", label: "Premier League (England)" },
    { id: "4335", name: "Spanish La Liga",        label: "La Liga (Spain)" },
    { id: "4332", name: "Italian Serie A",        label: "Serie A (Italy)" },
    { id: "4331", name: "German Bundesliga",      label: "Bundesliga (Germany)" },
    { id: "4334", name: "French Ligue 1",         label: "Ligue 1 (France)" },
    { id: "4802", name: "South African Premier Soccer League", label: "Betway Premiership (South Africa)" }
  ];

  // The free TheSportsDB key only returns part of each league, so team names are listed here.
  // Edit these lists when teams get promoted/relegated. Each name is searched by name when picked.
  var TEAMS = {
    "4328": [
      "Arsenal",
      "Aston Villa",
      "Bournemouth",
      "Brentford",
      "Brighton & Hove Albion",
      "Burnley",
      "Chelsea",
      "Crystal Palace",
      "Everton",
      "Fulham",
      "Leeds United",
      "Liverpool",
      "Manchester City",
      "Manchester United",
      "Newcastle United",
      "Nottingham Forest",
      "Sunderland",
      "Tottenham Hotspur",
      "West Ham United",
      "Wolverhampton Wanderers"
    ],
    "4335": [
      "Alavés",
      "Athletic Bilbao",
      "Atlético Madrid",
      "Barcelona",
      "Celta Vigo",
      "Elche",
      "Espanyol",
      "Getafe",
      "Girona",
      "Levante",
      "Mallorca",
      "Osasuna",
      "Real Oviedo",
      "Rayo Vallecano",
      "Real Betis",
      "Real Madrid",
      "Real Sociedad",
      "Sevilla",
      "Valencia",
      "Villarreal"
    ],
    "4332": [
      "AC Milan",
      "Atalanta",
      "Bologna",
      "Cagliari",
      "Como",
      "Cremonese",
      "Fiorentina",
      "Genoa",
      "Hellas Verona",
      "Inter Milan",
      "Juventus",
      "Lazio",
      "Lecce",
      "Napoli",
      "Parma",
      "Pisa",
      "Roma",
      "Sassuolo",
      "Torino",
      "Udinese"
    ],
    "4331": [
      "Augsburg",
      "Bayer Leverkusen",
      "Bayern Munich",
      "Borussia Dortmund",
      "Borussia Mönchengladbach",
      "Eintracht Frankfurt",
      "FC Köln",
      "Freiburg",
      "Hamburger SV",
      "Heidenheim",
      "Hoffenheim",
      "Mainz 05",
      "RB Leipzig",
      "St. Pauli",
      "Stuttgart",
      "Union Berlin",
      "Werder Bremen",
      "Wolfsburg"
    ],
    "4334": [
      "Angers",
      "Auxerre",
      "Brest",
      "Le Havre",
      "Lens",
      "Lille",
      "Lorient",
      "Lyon",
      "Marseille",
      "Metz",
      "Monaco",
      "Nantes",
      "Nice",
      "Paris FC",
      "Paris Saint-Germain",
      "Rennes",
      "Strasbourg",
      "Toulouse"
    ],
    "4802": [
      "Mamelodi Sundowns",
      "Orlando Pirates",
      "Kaizer Chiefs",
      "AmaZulu",
      "Stellenbosch",
      "Sekhukhune United",
      "TS Galaxy",
      "Polokwane City",
      "Richards Bay",
      "Golden Arrows",
      "Cape Town City",
      "Durban City",
      "Magesi",
      "Chippa United",
      "Orbit College",
      "Siwelele"
    ]
  };

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  function getJSON(url, cacheMins) {
    var ck = "diddyCache:" + url;
    try {
      var c = JSON.parse(sessionStorage.getItem(ck) || "null");
      if (c && Date.now() - c.t < (cacheMins || 10) * 60000) return Promise.resolve(c.d);
    } catch (e) {}
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (d) {
      try { sessionStorage.setItem(ck, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {}
      return d;
    });
  }

  function save(team) { try { localStorage.setItem(KEY, JSON.stringify(team)); } catch (e) {} }
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }

  // ---- pickers ----
  var leagueSel, teamSel, panel, status;

  function fillLeagues(selectedId) {
    leagueSel.innerHTML = '<option value="">Choose a league…</option>' + LEAGUES.map(function (l) {
      return '<option value="' + l.id + '"' + (l.id === selectedId ? " selected" : "") + ">" + esc(l.label) + "</option>";
    }).join("");
  }

  function loadTeams(leagueId, selectedName) {
    var names = TEAMS[leagueId] || [];
    teamSel.innerHTML = names.length
      ? '<option value="">Choose your team…</option>' + names.map(function (n) {
          return '<option value="' + esc(n) + '"' + (n === selectedName ? " selected" : "") + ">" + esc(n) + "</option>";
        }).join("")
      : '<option value="">No teams listed</option>';
    teamSel.disabled = !names.length;
    return Promise.resolve();
  }

  // look a team up by name and pick the soccer result (preferring the chosen league)
  function resolveTeam(name, leagueId) {
    return getJSON(API + "searchteams.php?t=" + encodeURIComponent(name), 1440).then(function (d) {
      var list = ((d && d.teams) || []).filter(function (t) { return !t.strSport || t.strSport === "Soccer"; });
      if (!list.length) throw new Error("not found");
      var hit = list.filter(function (t) { return t.idLeague === leagueId; })[0] || list[0];
      return { id: hit.idTeam, name: hit.strTeam, badge: hit.strBadge || hit.strTeamBadge || "", leagueId: leagueId || hit.idLeague, listName: name };
    });
  }

  function searchAny(q) {
    var out = $("tmResults");
    out.innerHTML = '<li class="tm-empty">Searching…</li>';
    getJSON(API + "searchteams.php?t=" + encodeURIComponent(q), 60).then(function (d) {
      var list = ((d && d.teams) || []).filter(function (t) { return !t.strSport || t.strSport === "Soccer"; }).slice(0, 8);
      out.innerHTML = list.length ? list.map(function (t) {
        return '<li><button type="button" class="tm-result" data-id="' + esc(t.idTeam) + '" data-name="' + esc(t.strTeam) +
          '" data-badge="' + esc(t.strBadge || t.strTeamBadge || "") + '" data-league="' + esc(t.idLeague || "") + '">' +
          esc(t.strTeam) + "<small> · " + esc(t.strLeague || t.strCountry || "") + "</small></button></li>";
      }).join("") : '<li class="tm-empty">No team found. Try the full name.</li>';
    }).catch(function () { out.innerHTML = '<li class="tm-empty">Search failed. Check your connection.</li>'; });
  }

  // ---- rendering ----
  function fmtDate(e) {
    var iso = e.strTimestamp ? e.strTimestamp.replace(" ", "T") + (/Z|[+-]\d\d:?\d\d$/.test(e.strTimestamp) ? "" : "Z") : e.dateEvent;
    var d = new Date(iso);
    if (isNaN(d)) return esc(e.dateEvent || "TBC");
    return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) +
      (e.strTime && e.strTime !== "00:00:00" ? " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "");
  }

  function fixtureRow(e, team, isResult) {
    var home = e.strHomeTeam, away = e.strAwayTeam;
    var mid = isResult && e.intHomeScore != null && e.intAwayScore != null
      ? '<strong class="tm-score">' + esc(e.intHomeScore) + " – " + esc(e.intAwayScore) + "</strong>"
      : '<span class="tm-vs">vs</span>';
    var tag = "";
    if (isResult && e.intHomeScore != null && e.intAwayScore != null) {
      var h = +e.intHomeScore, a = +e.intAwayScore, mine = home === team.name ? h - a : a - h;
      tag = '<span class="tm-pill ' + (mine > 0 ? "tm-w" : mine < 0 ? "tm-l" : "tm-d") + '">' + (mine > 0 ? "W" : mine < 0 ? "L" : "D") + "</span>";
    }
    return '<li class="tm-row"><div class="tm-when">' + fmtDate(e) + (e.strLeague ? "<small>" + esc(e.strLeague) + "</small>" : "") +
      '</div><div class="tm-teams"><span class="' + (home === team.name ? "tm-me" : "") + '">' + esc(home) + "</span>" + mid +
      '<span class="' + (away === team.name ? "tm-me" : "") + '">' + esc(away) + "</span></div>" + tag + "</li>";
  }

  function renderList(el, items, team, isResult, emptyMsg) {
    el.innerHTML = items.length ? items.map(function (e) { return fixtureRow(e, team, isResult); }).join("")
      : '<li class="tm-empty">' + emptyMsg + "</li>";
  }

  function fixturesUnavailable(team) {
    var link = '<li class="tm-empty">Fixtures aren\'t available right now. <a href="https://www.google.com/search?q=' + encodeURIComponent(team.name + " fixtures") + '" target="_blank" rel="noopener noreferrer">See them on Google ↗</a></li>';
    $("tmNext").innerHTML = link;
    $("tmLast").innerHTML = '<li class="tm-empty">Results aren\'t available right now.</li>';
  }
  function loadFixtures(team) {
    getJSON(API + "eventsnext.php?id=" + team.id, 10).then(function (d) {
      renderList($("tmNext"), (d && d.events) || [], team, false, "No upcoming fixtures found.");
    }).catch(function () { $("tmNext").innerHTML = '<li class="tm-empty">Couldn\'t load fixtures.</li>'; });

    getJSON(API + "eventslast.php?id=" + team.id, 10).then(function (d) {
      var r = ((d && (d.results || d.events)) || []).slice().sort(function (a, b) { return (b.dateEvent || "").localeCompare(a.dateEvent || ""); });
      renderList($("tmLast"), r, team, true, "No recent results found.");
    }).catch(function () { $("tmLast").innerHTML = '<li class="tm-empty">Couldn\'t load results.</li>'; });

  }

  function showTeam(team) {
    $("tmPicker").hidden = true;        // collapse the picker once a team is chosen
    panel.hidden = false;
    status.textContent = "";
    $("tmBadge").src = team.badge || "";
    $("tmBadge").style.display = team.badge ? "" : "none";
    $("tmName").textContent = team.name;
    $("tmNext").innerHTML = '<li class="tm-empty">Loading…</li>';
    $("tmLast").innerHTML = '<li class="tm-empty">Loading…</li>';
    $("tmNews").innerHTML = '<li class="tm-empty">Loading…</li>';

    if (team.id) loadFixtures(team);
    else resolveTeam(team.name, team.leagueId).then(function (t) {      // the lookup failed earlier: try again
      team = t; save(t); $("tmBadge").src = t.badge || ""; $("tmBadge").style.display = t.badge ? "" : "none"; loadFixtures(t);
    }).catch(function () { fixturesUnavailable(team); });

    var rss = "https://news.google.com/rss/search?q=" + encodeURIComponent('"' + team.name + '" football') + "&hl=en";
    getJSON("https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(rss), 15).then(function (d) {
      var items = (d && d.items) || [];
      if (!items.length) { $("tmNews").innerHTML = '<li class="tm-empty">No news found right now.</li>'; return; }
      $("tmNews").innerHTML = items.slice(0, 8).map(function (n) {
        var parts = String(n.title || "").split(" - "), src = parts.length > 1 ? parts.pop() : "";
        var d2 = new Date(String(n.pubDate || "").replace(" ", "T") + "Z");
        return '<li class="tm-news"><a href="' + esc(n.link) + '" target="_blank" rel="noopener noreferrer">' + esc(parts.join(" - ")) +
          "</a><small>" + esc(src) + (src && !isNaN(d2) ? " · " : "") + (isNaN(d2) ? "" : d2.toLocaleDateString(undefined, { day: "numeric", month: "short" })) + "</small></li>";
      }).join("");
    }).catch(function () {
      $("tmNews").innerHTML = '<li class="tm-empty">Couldn\'t load news here. <a href="https://news.google.com/search?q=' + encodeURIComponent(team.name + " football") + '" target="_blank" rel="noopener noreferrer">Open Google News ↗</a></li>';
    });
  }

  function init() {
    leagueSel = $("tmLeague"); teamSel = $("tmTeam"); panel = $("tmPanel"); status = $("tmStatus");
    if (!leagueSel) return;
    var saved = load();
    fillLeagues(saved && TEAMS[saved.leagueId] ? saved.leagueId : "");
    if (saved) {
      if (TEAMS[saved.leagueId]) loadTeams(saved.leagueId, saved.listName);
      showTeam(saved);
    }

    leagueSel.addEventListener("change", function () {
      panel.hidden = true;
      if (leagueSel.value) loadTeams(leagueSel.value);
      else { teamSel.disabled = true; teamSel.innerHTML = '<option value="">Pick a league first</option>'; }
    });
    teamSel.addEventListener("change", function () {
      if (!teamSel.value) return;
      status.textContent = "Loading " + teamSel.value + "…";
      resolveTeam(teamSel.value, leagueSel.value).then(function (team) { save(team); showTeam(team); })
        .catch(function () {                       // the fixtures service didn't answer: still open the club page (news works)
          var t = { id: "", name: teamSel.value, badge: "", leagueId: leagueSel.value, listName: teamSel.value };
          save(t); showTeam(t);
        });
    });
    $("tmSearchForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var q = $("tmSearch").value.trim();
      if (q.length >= 3) searchAny(q); else status.textContent = "Type at least 3 letters.";
    });
    $("tmResults").addEventListener("click", function (e) {
      var b = e.target.closest(".tm-result"); if (!b) return;
      var team = { id: b.getAttribute("data-id"), name: b.getAttribute("data-name"), badge: b.getAttribute("data-badge"), leagueId: b.getAttribute("data-league") };
      save(team); showTeam(team); $("tmResults").innerHTML = "";
    });
    $("tmClear").addEventListener("click", function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      $("tmPicker").hidden = false; $("tmResults").innerHTML = ""; status.textContent = "";
      panel.hidden = true; leagueSel.value = ""; teamSel.disabled = true; teamSel.innerHTML = '<option value="">Pick a league first</option>';
    });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
