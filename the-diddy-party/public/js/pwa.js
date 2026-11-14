/* Registers the service worker so the site can be installed as an app. */
if ("serviceWorker" in navigator) window.addEventListener("load", function () { navigator.serviceWorker.register("/sw.js").catch(function () {}); });
(function () {
  var cover = document.createElement("div");
  cover.style.cssText = "display:none;position:fixed;inset:0;z-index:99999;background:#10120f;color:#f4f5ef;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;font-family:system-ui,sans-serif";
  cover.innerHTML = '<img src="/images/Mbappe.png" alt="" width="96" height="96" style="border-radius:20px ; object-fit: cover"><h1 style="font-size:1.8rem;margin:12px 0 6px">Sorry, something went wrong</h1><p style="color:#a9b0a2;max-width:320px;margin:0 0 20px">We can\'t reach the club right now. Check your internet connection and try again.</p><button onclick="location.reload()" style="background:#b6ff3b;color:#11150d;border:0;border-radius:999px;padding:12px 26px;font-weight:800;font-size:1rem">Try again</button>';
  document.addEventListener("DOMContentLoaded", function () { document.body.appendChild(cover); });
  function show() { cover.style.display = "flex"; }
  function hide() { cover.style.display = "none"; }
  window.addEventListener("offline", show);
  window.addEventListener("online", function () { hide(); location.reload(); });
  if (navigator.onLine === false) show();
  // phones can be on wifi with no real internet, so also check the server once on load
  var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 8000);
  fetch("/api/public", { cache: "no-store", signal: ctl.signal })
    .then(function (r) { clearTimeout(t); if (!r.ok) show(); })
    .catch(function () { show(); });
})();
