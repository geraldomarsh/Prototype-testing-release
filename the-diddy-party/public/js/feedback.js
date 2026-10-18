/* Feedback button: bug reports, questions and ideas go to the manager's Admin inbox. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  function out(t, bad) { var m = $("fbMsgOut"); m.textContent = t || ""; m.style.color = bad ? "var(--red)" : "var(--green)"; }
  document.addEventListener("DOMContentLoaded", function () {
    if (!$("fbBtn")) return;
    var dlg = $("fbDialog");
    $("fbBtn").addEventListener("click", function () {
      out(""); if (window.diddyMe && !$("fbName").value) $("fbName").value = window.diddyMe.name;   // signed-in members: name filled in
      dlg.showModal();
    });
    $("fbClose").addEventListener("click", function () { dlg.close(); });
    $("fbCancel").addEventListener("click", function () { dlg.close(); });
    $("fbMsg").addEventListener("input", function () { $("fbCount").textContent = this.value.length; });
    $("fbForm").addEventListener("submit", function (e) {
      e.preventDefault();
      if ($("fbMsg").value.trim().length < 5) { out("Write a few words first.", true); $("fbMsg").focus(); return; }
      $("fbSubmit").disabled = true; out("Sending…");
      fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: $("fbType").value, message: $("fbMsg").value, name: $("fbName").value, contact: $("fbContact").value,
          page: location.pathname + location.hash, website: $("fbWebsite").value }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || "Something went wrong."); return d; }); })
        .then(function (d) {
          $("fbFields").hidden = true; $("fbSubmit").hidden = true; $("fbCancel").textContent = "Done";
          out("✅ " + (d.message || "Thanks!")); if (window.showToast) window.showToast("Feedback sent. Cheers! 🙌");
        })
        .catch(function (err) { $("fbSubmit").disabled = false; out(err instanceof TypeError ? "Can't reach the server. Try again in a moment." : err.message, true); });
    });
  });
})();
