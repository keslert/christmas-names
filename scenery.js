// The night scene behind every screen, and the particle effects in front of it.
// The stage is a fixed 1920x1080 box scaled to fit the window, so every
// position in the show is in stage pixels. The backdrop (sky, hills, far snow)
// is the same size but scaled to cover the window, so no window shape shows bars.
// On a phone held upright the show turns a quarter turn clockwise (body.turned),
// so it fills the screen and reads once the phone is turned sideways.
(function (root) {
  "use strict";
  const W = 1920;
  const H = 1080;
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  let stage;
  let backdrop;
  let scale = 1;
  let turned = false;
  const layers = {};

  function fitStage() {
    turned = document.body.classList.contains("showing") && innerHeight > innerWidth;
    document.body.classList.toggle("turned", turned);
    const [w, h] = turned ? [innerHeight, innerWidth] : [innerWidth, innerHeight];
    scale = Math.min(w / W, h / H);
    const cover = Math.max(w / W, h / H);
    const turn = turned ? " rotate(90deg)" : "";
    stage.style.transform = `translate(-50%, -50%)${turn} scale(${scale})`;
    backdrop.style.transform = `translate(-50%, -50%)${turn} scale(${cover})`;
    for (const [id, s] of [["stars", cover], ["front", scale]]) {
      const { canvas, g } = layers[id];
      const k = Math.min(2, (devicePixelRatio || 1) * s);
      canvas.width = Math.round(W * k);
      canvas.height = Math.round(H * k);
      g.setTransform(k, 0, 0, k, 0, 0);
    }
  }

  // Where an element sits on the stage, in stage pixels. ax/ay pick the
  // anchor: 0.5, 0.5 is the center.
  function stagePoint(el, ax = 0.5, ay = 0.5) {
    const s = stage.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (!turned) {
      return {
        x: (r.left + r.width * ax - s.left) / scale,
        y: (r.top + r.height * ay - s.top) / scale,
      };
    }
    // Turned clockwise: the stage's x runs down the screen and its y runs right to left.
    return {
      x: (r.top + r.height * ax - s.top) / scale,
      y: (s.right - (r.right - r.width * ay)) / scale,
    };
  }

  // ---------- Hills, trees, and cottages ----------
  function ridge(base, amp, freq, phase) {
    let d = `M0 ${380}`;
    for (let x = 0; x <= W; x += 16) {
      const y = base - amp * (Math.sin(x * freq + phase) * 0.6 + Math.sin(x * freq * 2.3 + phase * 1.7) * 0.4);
      d += ` L${x} ${y.toFixed(1)}`;
    }
    return d + ` L${W} 380 Z`;
  }
  function ridgeY(base, amp, freq, phase, x) {
    return base - amp * (Math.sin(x * freq + phase) * 0.6 + Math.sin(x * freq * 2.3 + phase * 1.7) * 0.4);
  }
  function pine(x, y, h, fill, snow) {
    const w = h * 0.5;
    let out = `<rect x="${x - h * 0.04}" y="${y - h * 0.12}" width="${h * 0.08}" height="${h * 0.14}" fill="#2a1d1a"/>`;
    for (let t = 0; t < 3; t++) {
      const top = y - h + t * h * 0.24;
      const tierW = w * (0.55 + t * 0.25);
      const bottom = top + h * 0.45;
      out += `<path d="M${x} ${top} L${x + tierW / 2} ${bottom} L${x - tierW / 2} ${bottom} Z" fill="${fill}"/>`;
      if (snow) out += `<path d="M${x} ${top} L${x + tierW * 0.16} ${top + h * 0.13} L${x - tierW * 0.16} ${top + h * 0.13} Z" fill="#eef4ff" opacity=".9"/>`;
    }
    return out;
  }
  function cottage(x, y, s) {
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <rect x="-40" y="-46" width="80" height="50" fill="#5b3a3a"/>
      <path d="M-50 -44 L0 -84 L50 -44 Z" fill="#e9f0fb"/>
      <rect x="20" y="-86" width="12" height="26" fill="#4a2f2f"/>
      <rect x="-28" y="-34" width="18" height="18" rx="2" fill="#ffcf6b" class="window"/>
      <rect x="10" y="-34" width="18" height="18" rx="2" fill="#ffb84d" class="window"/>
    </g>`;
  }
  function buildHills() {
    const far = [250, 34, 0.0031, 1.2];
    const mid = [292, 26, 0.0042, 3.1];
    const near = [338, 18, 0.0055, 0.4];
    let trees = "";
    for (let x = 20; x < W; x += rand(38, 70)) {
      trees += pine(x, ridgeY(...far, x) + 6, rand(50, 80), "#16294a", false);
    }
    let nearTrees = "";
    const spots = [70, 150, 230, 860, 930, 1110, 1700, 1790, 1860];
    for (const x of spots) nearTrees += pine(x, ridgeY(...near, x) + 10, rand(90, 130), "#123a3a", true);
    const houses = cottage(1500, ridgeY(...mid, 1500) + 8, 0.9) + cottage(1600, ridgeY(...mid, 1600) + 10, 0.7) + cottage(1210, ridgeY(...mid, 1210) + 8, 0.75);
    return `<svg class="hills" viewBox="0 0 ${W} 380" preserveAspectRatio="none">
      <defs>
        <linearGradient id="snowNear" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#eef4fd"/><stop offset="1" stop-color="#a9bede"/></linearGradient>
        <linearGradient id="snowMid" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#b9cbe8"/><stop offset="1" stop-color="#7d96c0"/></linearGradient>
        <radialGradient id="windowGlow"><stop offset="0" stop-color="#ffcf6b" stop-opacity=".6"/><stop offset="1" stop-color="#ffcf6b" stop-opacity="0"/></radialGradient>
      </defs>
      <path d="${ridge(...far)}" fill="#2b4677"/>
      ${trees}
      <path d="${ridge(...mid)}" fill="url(#snowMid)"/>
      ${houses}
      <path d="${ridge(...near)}" fill="url(#snowNear)"/>
      ${nearTrees}
    </svg>`;
  }

  // ---------- Stars and snow ----------
  const stars = Array.from({ length: 230 }, () => ({
    x: rand(0, W),
    y: Math.pow(Math.random(), 1.5) * 760,
    r: rand(0.5, 1.9),
    phase: rand(0, TAU),
    speed: rand(0.6, 2.2),
  }));
  function flake(top) {
    const z = Math.pow(Math.random(), 1.6);
    return { x: rand(-50, W + 50), y: top ? rand(-H, 0) : rand(0, H), z, r: 1 + z * 3.4, vy: 22 + z * 70, sway: rand(10, 40), phase: rand(0, TAU) };
  }
  const flakes = Array.from({ length: 240 }, () => flake(false));

  // ---------- Particles ----------
  const particles = [];
  const GOLD = ["#fff6d0", "#ffd66b", "#f4c95d", "#ffffff", "#ffe9a8"];
  const CONFETTI = ["#e5525a", "#f4c95d", "#3fae6e", "#ffffff", "#6fb6ff", "#ff9ec3"];

  function sparkle(x, y, opts = {}) {
    const { count = 26, speed = 520, spread = TAU, angle = -Math.PI / 2, colors = GOLD, size = [6, 15], life = [0.5, 1.1], gravity = 260 } = opts;
    for (let i = 0; i < count; i++) {
      const a = angle + rand(-spread / 2, spread / 2);
      const v = speed * rand(0.25, 1);
      particles.push({ kind: "spark", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity, drag: 2.4, size: rand(...size), rot: rand(0, TAU), spin: rand(-6, 6), color: pick(colors), age: 0, life: rand(...life) });
    }
  }
  function confetti(count = 160) {
    for (let i = 0; i < count; i++) {
      particles.push({ kind: "confetti", x: rand(0, W), y: rand(-300, -20), vx: rand(-60, 60), vy: rand(120, 320), gravity: 120, drag: 0.4, size: rand(9, 16), rot: rand(0, TAU), spin: rand(-8, 8), flip: rand(0, TAU), flipSpeed: rand(5, 12), color: pick(CONFETTI), age: 0, life: rand(3.5, 5.5) });
    }
  }
  function puff(x, y, opts = {}) {
    const { count = 8, color = "rgba(255,255,255,0.8)", spread = 60, rise = -60, size = [14, 30] } = opts;
    for (let i = 0; i < count; i++) {
      particles.push({ kind: "puff", x: x + rand(-spread / 4, spread / 4), y, vx: rand(-spread, spread), vy: rise * rand(0.5, 1.4), gravity: 0, drag: 1.8, size: rand(...size), grow: rand(30, 60), color, age: 0, life: rand(0.6, 1.2) });
    }
  }

  function drawSpark(g, p, alpha) {
    const s = p.size * (1 - p.age / p.life) + 1;
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.rot);
    g.globalAlpha = alpha;
    g.fillStyle = p.color;
    g.beginPath();
    g.moveTo(0, -s);
    g.quadraticCurveTo(0, 0, s, 0);
    g.quadraticCurveTo(0, 0, 0, s);
    g.quadraticCurveTo(0, 0, -s, 0);
    g.quadraticCurveTo(0, 0, 0, -s);
    g.fill();
    g.globalAlpha = alpha * 0.35;
    g.beginPath();
    g.arc(0, 0, s * 0.9, 0, TAU);
    g.fill();
    g.restore();
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;

    const sg = layers.stars.g;
    sg.clearRect(0, 0, W, H);
    for (const s of stars) {
      sg.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(t * s.speed + s.phase));
      sg.fillStyle = "#fffbe8";
      sg.beginPath();
      sg.arc(s.x, s.y, s.r, 0, TAU);
      sg.fill();
    }
    sg.globalAlpha = 1;

    // Far flakes fall behind the show, near ones in front of it.
    const g = layers.front.g;
    g.clearRect(0, 0, W, H);
    for (const f of flakes) {
      f.y += f.vy * dt;
      f.phase += dt * 0.8;
      if (f.y > H + 10) Object.assign(f, flake(true), { y: -10 });
      const layer = f.z < 0.55 ? sg : g;
      layer.fillStyle = "#ffffff";
      layer.globalAlpha = 0.35 + f.z * 0.55;
      layer.beginPath();
      layer.arc(f.x + Math.sin(f.phase) * f.sway, f.y, f.r, 0, TAU);
      layer.fill();
    }
    sg.globalAlpha = 1;
    g.globalAlpha = 1;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        particles.splice(i, 1);
        continue;
      }
      p.vx -= p.vx * p.drag * dt;
      p.vy -= p.vy * p.drag * dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += (p.spin || 0) * dt;
      const k = p.age / p.life;
      if (p.kind === "spark") {
        g.globalCompositeOperation = "lighter";
        drawSpark(g, p, 1 - k * k);
        g.globalCompositeOperation = "source-over";
      } else if (p.kind === "confetti") {
        p.flip += p.flipSpeed * dt;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.scale(1, Math.cos(p.flip));
        g.globalAlpha = k > 0.8 ? (1 - k) * 5 : 1;
        g.fillStyle = p.color;
        g.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
        g.restore();
      } else if (p.kind === "puff") {
        g.globalAlpha = 0.55 * (1 - k);
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(p.x, p.y, p.size + p.grow * k, 0, TAU);
        g.fill();
        g.globalAlpha = 1;
      }
    }
    requestAnimationFrame(frame);
  }

  function init() {
    stage = document.getElementById("stage");
    stage.insertAdjacentHTML("beforebegin", `<div id="backdrop">
      <div class="sky"></div>
      <div class="aurora"><i></i><i></i><i></i></div>
      <canvas id="stars"></canvas>
      <div class="moon"></div>
      ${buildHills()}
    </div>`);
    backdrop = document.getElementById("backdrop");
    for (const id of ["stars", "front"]) {
      const canvas = document.getElementById(id);
      layers[id] = { canvas, g: canvas.getContext("2d") };
    }
    fitStage();
    addEventListener("resize", fitStage);
    requestAnimationFrame(frame);
  }

  root.Scenery = { init, fit: fitStage, stagePoint, sparkle, confetti, puff, W, H };
})(this);
