/* Draggable, throwable, tappable football in the hero pitch.
   - Drag it with mouse or finger and let go to throw it.
   - Tap / click it to kick it up and bounce.
   Tweak the numbers in PHYSICS below. */
(function () {
  var PHYSICS = {
    gravity: 1900,      // px/s^2 pulling the ball down
    bounce: 0.72,       // energy kept after hitting the floor (0-1)
    wallBounce: 0.8,    // energy kept after hitting a side/top
    airDrag: 0.15,      // slows the ball in the air
    rollFriction: 2.2,  // slows the ball while it rolls on the floor
    kick: 950,          // upward speed of a tap
    maxThrow: 2600,     // speed limit for throws
    floatRadius: 51.3,   // size of the centre zone (px): let go inside it and the ball floats
    floatPull: 6,       // how quickly it drifts to the centre (higher = snappier)
    floatBob: 10        // how far it bobs up and down while floating (px)
  };

  var ball = document.querySelector(".football");
  var arena = document.querySelector(".hero-art");
  if (!ball || !arena) return;

  var x = 0, y = 0, vx = 0, vy = 0, rot = -18, vr = 0;
  var live = false, dragging = false, floating = false, raf = 0, last = 0;
  var grab = { dx: 0, dy: 0 }, trail = [], down = null;

  // glowing ring in the centre of the pitch, shown while dragging
  var zone = document.createElement("div");
  zone.className = "ball-zone";
  zone.setAttribute("aria-hidden", "true");
  zone.style.width = zone.style.height = PHYSICS.floatRadius * 2 + "px";
  arena.appendChild(zone);

  function inZone() {
    var s = size(), cx = x + s.w / 2, cy = y + s.h / 2;
    return Math.hypot(cx - arena.clientWidth / 2, cy - arena.clientHeight / 2) < PHYSICS.floatRadius;
  }
  function setFloating(on) {
    floating = on;
    ball.classList.toggle("is-floating", on);
  }

  function size() { return { w: ball.offsetWidth, h: ball.offsetHeight }; }
  function bounds() {
    var s = size();
    return { maxX: Math.max(0, arena.clientWidth - s.w), maxY: Math.max(0, arena.clientHeight - s.h - 6) };
  }
  function draw() { ball.style.transform = "translate(" + x + "px," + y + "px) rotate(" + rot + "deg)"; }

  function goLive() {
    if (live) return;
    var a = arena.getBoundingClientRect(), b = ball.getBoundingClientRect();
    x = b.left - a.left; y = b.top - a.top;      // start from where the ball currently is
    ball.classList.add("is-live");
    ball.style.left = "0px"; ball.style.top = "0px";
    live = true; draw();
  }

  function step(now) {
    var dt = Math.min(0.034, (now - last) / 1000); last = now;
    var b = bounds();
    if (!dragging && floating) {
      var s = size(), t = now / 1000;
      var tx = (arena.clientWidth - s.w) / 2;
      var ty = (arena.clientHeight - s.h) / 2 - 8 + Math.sin(t * 2) * PHYSICS.floatBob;
      var k = Math.min(1, PHYSICS.floatPull * dt);
      x += (tx - x) * k; y += (ty - y) * k;
      rot += (Math.sin(t * 1.3) * 12 - 6 - rot) * Math.min(1, 2 * dt);   // gentle sway
      vx = vy = vr = 0;
    } else if (!dragging) {
      vy += PHYSICS.gravity * dt;
      var drag = Math.max(0, 1 - PHYSICS.airDrag * dt);
      vx *= drag; vy *= drag;
      x += vx * dt; y += vy * dt; rot += vr * dt;

      if (x < 0)      { x = 0;      vx = Math.abs(vx) * PHYSICS.wallBounce;  vr = -vr * 0.6; }
      if (x > b.maxX) { x = b.maxX; vx = -Math.abs(vx) * PHYSICS.wallBounce; vr = -vr * 0.6; }
      if (y < 0)      { y = 0;      vy = Math.abs(vy) * PHYSICS.wallBounce; }
      if (y >= b.maxY) {
        y = b.maxY;
        if (Math.abs(vy) > 90) { vy = -vy * PHYSICS.bounce; } else { vy = 0; }
        vx *= Math.max(0, 1 - PHYSICS.rollFriction * dt);
        vr = vx * 0.9;                                   // roll in the direction of travel
      }
      if (y >= b.maxY && vy === 0 && Math.abs(vx) < 8) { vx = 0; vr = 0; }
    }
    draw();
    var resting = !dragging && !floating && y >= b.maxY && vy === 0 && vx === 0;
    if (resting) { raf = 0; return; }                    // stop the loop when settled
    raf = requestAnimationFrame(step);
  }
  function run() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); } }

  function pt(e) { var a = arena.getBoundingClientRect(); return { x: e.clientX - a.left, y: e.clientY - a.top, t: performance.now() }; }

  ball.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    goLive();
    ball.setPointerCapture(e.pointerId);
    var p = pt(e);
    dragging = true; setFloating(false); vx = vy = vr = 0;
    arena.classList.add("ball-dragging");
    grab.dx = p.x - x; grab.dy = p.y - y;
    trail = [p]; down = { x: p.x, y: p.y, t: p.t, moved: 0 };
    ball.classList.add("is-grabbed");
    run();
  });

  ball.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    var p = pt(e), b = bounds();
    x = Math.min(b.maxX, Math.max(0, p.x - grab.dx));
    y = Math.min(b.maxY, Math.max(0, p.y - grab.dy));
    down.moved = Math.max(down.moved, Math.hypot(p.x - down.x, p.y - down.y));
    zone.classList.toggle("is-hot", inZone());
    trail.push(p); while (trail.length > 2 && p.t - trail[0].t > 90) trail.shift();
  });

  function release(e) {
    if (!dragging) return;
    dragging = false; ball.classList.remove("is-grabbed");
    arena.classList.remove("ball-dragging"); zone.classList.remove("is-hot");
    var p = pt(e), isTap = down.moved < 8 && p.t - down.t < 350;
    if (isTap) {
      // kick: up, and sideways depending on which side of the ball was tapped
      var s = size(), off = (p.x - (x + s.w / 2)) / (s.w / 2);          // -1 (left edge) .. 1 (right edge)
      vy = -PHYSICS.kick * (0.85 + Math.random() * 0.3);
      vx = -off * 380 + (Math.random() - 0.5) * 220;
      vr = vx * 1.2;
    } else {
      var a = trail[0], b = trail[trail.length - 1], dt = Math.max(0.016, (b.t - a.t) / 1000);
      var tvx = (b.x - a.x) / dt, tvy = (b.y - a.y) / dt, sp = Math.hypot(tvx, tvy);
      if (sp > PHYSICS.maxThrow) { tvx *= PHYSICS.maxThrow / sp; tvy *= PHYSICS.maxThrow / sp; }
      vx = tvx; vy = tvy; vr = vx * 0.9;
      if (inZone()) setFloating(true);          // let go in the middle: it floats
    }
    run();
  }
  ball.addEventListener("pointerup", release);
  ball.addEventListener("pointercancel", release);
  ball.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  window.addEventListener("resize", function () {
    if (!live) return;
    var b = bounds(); x = Math.min(x, b.maxX); y = Math.min(y, b.maxY); draw(); run();
  });
})();

(function () {
  var BALLS = [
    { name: "Classic", src: "images/footballs/WC 2014.png" },
    { name: "Gold",    src: "images/footballs/Prem.png" },
    { name: "Neon",    src: "images/footballs/UCl Ball.png"},
    //{ name: "Classic", src: "images/footballs/WC 2018.png" },
    { name: "Classic", src: "images/footballs/La Liga.png" },
    { name: "Classic", src: "images/footballs/WC 2026.png" }
  ];
  var KEY = "diddyBall";
  var img = document.querySelector(".football img");
  var box = document.getElementById("ballPicker");
  if (!img || !box) return;

  var saved = 0;
  try { saved = +localStorage.getItem(KEY) || 0; } catch (e) {}
  if (!BALLS[saved]) saved = 0;

  function choose(i) {
    img.src = BALLS[i].src;
    [].forEach.call(box.children, function (b, n) {
      b.classList.toggle("is-picked", n === i);
      b.setAttribute("aria-pressed", n === i ? "true" : "false");
    });
    try { localStorage.setItem(KEY, i); } catch (e) {}
  }

  BALLS.forEach(function (ball, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.title = ball.name;
    b.innerHTML = '<img src="' + ball.src + '" alt="' + ball.name + '" draggable="false">';
    b.addEventListener("click", function () { choose(i); });
    box.appendChild(b);
  });
  choose(saved);
})();
