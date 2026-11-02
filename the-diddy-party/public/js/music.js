(function () {
  var SRC = "audio/Kylian.webm", KEY = "diddyMusicOff";
  var a = new Audio(SRC); a.loop = true; a.volume = 0.4; a.preload = "auto";
  var off = false; try { off = localStorage.getItem(KEY) === "1"; } catch (e) {}
  function remember(v) { off = v; try { localStorage.setItem(KEY, v ? "1" : "0"); } catch (e) {} }

  var bar = document.createElement("div");
  bar.setAttribute("aria-label", "Music player");
  bar.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:50;display:flex;gap:6px;align-items:center;background:#191d18;border:1px solid #343b30;border-radius:999px;padding:6px 10px;box-shadow:0 6px 20px #0008;font:700 .8rem sans-serif;color:#f4f5ef";
  var b = "background:none;border:0;color:#b6ff3b;font-size:1.1rem;cursor:pointer;padding:2px 4px";
  bar.innerHTML = '<span id="musicHandle" title="Drag to move" style="cursor:grab;touch-action:none;user-select:none;padding:6px 8px">🎵</span><button style="' + b + '" data-a="play" aria-label="Play">▶</button><button style="' + b + '" data-a="pause" aria-label="Pause">⏸</button><button style="' + b + '" data-a="stop" aria-label="Stop">⏹</button><input type="range" min="0" max="100" value="40" aria-label="Volume" style="width:70px;accent-color:#b6ff3b">';
  document.body.appendChild(bar);
  var h = bar.querySelector("#musicHandle"), POS = "diddyMusicPos", drag = null;
function put(x, y) {                       // keep it fully on screen
  var m = 6; x = Math.max(m, Math.min(innerWidth - bar.offsetWidth - m, x)); y = Math.max(m, Math.min(innerHeight - bar.offsetHeight - m, y));
  bar.style.left = x + "px"; bar.style.top = y + "px"; bar.style.bottom = "auto";
}
try { var s = JSON.parse(localStorage.getItem(POS) || "null"); if (s) put(s[0], s[1]); } catch (e) {}
h.addEventListener("pointerdown", function (e) { var r = bar.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }; h.setPointerCapture(e.pointerId); h.style.cursor = "grabbing"; });
h.addEventListener("pointermove", function (e) { if (drag) put(e.clientX - drag.dx, e.clientY - drag.dy); });
function drop() { if (!drag) return; drag = null; h.style.cursor = "grab"; var r = bar.getBoundingClientRect(); try { localStorage.setItem(POS, JSON.stringify([r.left, r.top])); } catch (e) {} }
h.addEventListener("pointerup", drop); h.addEventListener("pointercancel", drop);
window.addEventListener("resize", function () { if (bar.style.top) { var r = bar.getBoundingClientRect(); put(r.left, r.top); } });

  bar.addEventListener("click", function (e) {
    var t = e.target.closest("[data-a]"); if (!t) return;
    if (t.dataset.a === "play") { remember(false); a.play().catch(function () {}); }
    if (t.dataset.a === "pause") { remember(true); a.pause(); }
    if (t.dataset.a === "stop") { remember(true); a.pause(); a.currentTime = 0; }
  });
  bar.querySelector("input").addEventListener("input", function (e) { a.volume = e.target.value / 100; });

  // try to start on open; if the browser blocks it, start on the first tap or key press
  if (!off) a.play().catch(function () {
    var go = function () { if (!off && a.paused) a.play().catch(function () {}); };
    document.addEventListener("pointerdown", go, { once: true });
    document.addEventListener("keydown", go, { once: true });
  });
})();
