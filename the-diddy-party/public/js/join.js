/* "Join the squad": anyone can send their card; the manager approves it in Admin. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var photo = "";   // resized JPEG data URL

  /* the stat sliders are optional: if you delete them from index.html, every stat defaults to 60 */
  function val(id) { var el = $(id); return el ? el.value : 60; }
  function ovr() {
    if (!$("joinOvr")) return;
    var v = ["joinPace", "joinSho", "joinPas", "joinDef"].map(function (id) {
      var el = $(id); if (!el) return 60; el.nextElementSibling.textContent = el.value; return Number(el.value);
    });
    $("joinOvr").textContent = Math.round(v.reduce(function (a, b) { return a + b; }, 0) / 4);
  }
  function msg(t, bad) { var m = $("joinMsg"); m.textContent = t || ""; m.style.color = bad ? "var(--red)" : "var(--green)"; }

  /* centre-crop to a square and shrink, so uploads stay small (about 20 KB) */
  function squareJpeg(file, size) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(img.width, img.height), c = document.createElement("canvas");
        c.width = c.height = size;
        c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 3, s, s, 0, 0, size, size);
        URL.revokeObjectURL(url); resolve(c.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("That image couldn't be read. Try a JPEG or PNG.")); };
      img.src = url;
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!$("joinBtn")) return;
    var dlg = $("joinDialog");
    $("joinBtn").addEventListener("click", function () { msg(""); dlg.showModal(); });
    $("joinClose").addEventListener("click", function () { dlg.close(); });
    $("joinCancel").addEventListener("click", function () { dlg.close(); });
    ["joinPace", "joinSho", "joinPas", "joinDef"].forEach(function (id) { if ($(id)) $(id).addEventListener("input", ovr); });
    ovr();

    $("joinPhoto").addEventListener("change", function () {
      var f = this.files && this.files[0]; photo = "";
      if (!f) { $("joinPreview").src = "images/players/default.svg"; return; }
      squareJpeg(f, 256).then(function (d) { photo = d; $("joinPreview").src = d; msg(""); })
        .catch(function (e) { $("joinPreview").src = "images/players/default.svg"; msg(e.message, true); });
    });

    $("joinForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var name = $("joinName").value.trim();
      if (name.length < 2) { msg("Add your name (at least 2 letters).", true); $("joinName").focus(); return; }
      $("joinSubmit").disabled = true; msg("Sending…");
      fetch("/api/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name, nickname: $("joinNick") ? $("joinNick").value : "", position: $("joinPos").value, image: photo || undefined, website: $("joinWebsite") ? $("joinWebsite").value : "",
          pace: val("joinPace"), shooting: val("joinSho"), passing: val("joinPas"), defending: val("joinDef") })
      }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || "Something went wrong."); return d; }); })
        .then(function (d) {
          $("joinFields").hidden = true; $("joinSubmit").hidden = true; $("joinCancel").textContent = "Done";
          msg("✅ " + (d.message || "Card received! The manager will approve it and send you your access code."));
          if (window.showToast) window.showToast("Card sent. Waiting for the manager ⏳");
        })
        .catch(function (err) { $("joinSubmit").disabled = false; msg(err instanceof TypeError ? "Can't reach the server. Try again in a moment." : err.message, true); });
    });
  });
})();
