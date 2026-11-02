(function () {
  var SRC = "audio/theme.mp3", KEY = "diddyMusicOff";
  var a = new Audio(SRC); a.loop = true; a.volume = 0.4; a.preload = "auto";
  var off = false; try { off = localStorage.getItem(KEY) === "1"; } catch (e) {}
  function remember(v) { off = v; try { localStorage.setItem(KEY, v ? "1" : "0"); } catch (e) {} }

  var bar = document.createElement("div");
  bar.setAttribute("aria-label", "Music player");
  bar.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:50;display:flex;gap:6px;align-items:center;background:#191d18;border:1px solid #343b30;border-radius:999px;padding:6px 10px;box-shadow:0 6px 20px #0008;font:700 .8rem sans-serif;color:#f4f5ef";
  var b = "background:none;border:0;color:#b6ff3b;font-size:1.1rem;cursor:pointer;padding:2px 4px";
  bar.innerHTML = '🎵 <button style="' + b + '" data-a="play" aria-label="Play">▶</button><button style="' + b + '" data-a="pause" aria-label="Pause">⏸</button><button style="' + b + '" data-a="stop" aria-label="Stop">⏹</button><input type="range" min="0" max="100" value="40" aria-label="Volume" style="width:70px;accent-color:#b6ff3b">';
  document.body.appendChild(bar);

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
