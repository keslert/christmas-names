// One draw's show, about 30-40 seconds in four acts:
//   1. The list: the scroll unrolls and every name is written on it.
//   2. The machine: names fly off the scroll as tags into Santa's Matchmaker.
//   3. The gifts: one gift per pair pops out of the machine. The tag says who
//      gives; the gift opens on who they give to, and that person's name
//      becomes the next tag, round the loop and back to the first giver.
//   4. The Nice List: every match, sealed.
// Show.play runs it; Show.final draws the last frame on its own (after a skip).
(function (root) {
  "use strict";
  const { stagePoint, sparkle, confetti, puff } = root.Scenery;
  const Sound = root.Sound;
  const TAU = Math.PI * 2;
  const SKIP = Symbol("skip");
  const EASE = {
    out: "cubic-bezier(.16,1,.3,1)",
    back: "cubic-bezier(.34,1.56,.64,1)",
    inOut: "cubic-bezier(.65,0,.35,1)",
    in: "cubic-bezier(.55,0,1,.45)",
  };

  // Stage positions (stage pixels). The machine's SVG is drawn at 1:1.
  const MACHINE = { x: 90, y: 190 };
  const CHUTE = { x: MACHINE.x + 664, y: MACHINE.y + 678 };
  const HOPPER = { x: MACHINE.x + 310, y: MACHINE.y + 116 };
  const SPOT = { x: 1080, y: 758 };
  const LEDGER_CENTER = { x: 1380 + 250, y: 252 + 375 };
  const GIFT_COLORS = [
    ["#c9283a", "#f4c95d"],
    ["#1f7a4c", "#fff1d6"],
    ["#f2c14e", "#c9283a"],
    ["#f4efe6", "#c9283a"],
    ["#1d3f8a", "#f4c95d"],
    ["#2a9d8f", "#fff1d6"],
    ["#7a1f3d", "#f4c95d"],
  ];

  const rand = (a, b) => a + Math.random() * (b - a);
  // "Baby Girl (Ann & Tom)" -> "Baby Girl", for the porthole and the ledger.
  const shortName = (name) => name.replace(/\s*\(.*\)\s*$/, "") || name;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function h(tag, cls, parent, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    if (parent) parent.appendChild(el);
    return el;
  }
  function anim(el, frames, opts) {
    return el.animate(frames, { fill: "both", ...opts });
  }

  const measure = document.createElement("canvas").getContext("2d");
  // The largest font size up to `base` at which `text` fits in `maxWidth`.
  function fitSize(text, font, base, maxWidth) {
    measure.font = font(base);
    const width = measure.measureText(text).width;
    return width > maxWidth ? Math.floor((base * maxWidth) / width) : base;
  }

  // Keyframes along a quadratic curve p0 -> p2 bending toward p1.
  function arc(p0, p1, p2, steps, frame) {
    const frames = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      const x = u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x;
      const y = u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y;
      frames.push({ offset: t, ...frame(t, x, y) });
    }
    return frames;
  }
  const at = (x, y, rest = "") => `translate(${x}px, ${y}px) translate(-50%, -50%) ${rest}`;

  function makeRun() {
    const run = { skipped: false };
    run.wait = (ms) => new Promise((resolve, reject) => setTimeout(() => (run.skipped ? reject(SKIP) : resolve()), ms));
    run.later = (ms, fn) => setTimeout(() => run.skipped || fn(), ms);
    return run;
  }

  // Reveal timing: the first gifts take their time, then they come bam-bam-bam,
  // and the last one, closing the loop, lands a little slower. A gift never
  // goes faster than FASTEST_GIFT, so each name can still be read; a big group
  // runs longer instead (25 kids: about 26s of gifts).
  const FASTEST_GIFT = 950;
  function stepDurations(n) {
    const weights = Array.from({ length: n }, (_, i) =>
      i === n - 1 && n > 1 ? 1.6 : i === 0 ? 2.2 : i === 1 ? 1.7 : i === 2 ? 1.35 : 1
    );
    const unit = clamp(22000 / weights.reduce((a, b) => a + b, 0), FASTEST_GIFT, 1500);
    return weights.map((w) => clamp(w * unit, FASTEST_GIFT, 2800));
  }

  // ---------- Building the scene ----------
  function buildHeader(scene, title) {
    const header = h("div", "header", scene);
    const eyebrow = h("div", "eyebrow", header, "Santa's Workshop · Gift Draw");
    const titleEl = h("div", "title", header);
    titleEl.style.fontSize = fitSize(title, (s) => `italic 900 ${s}px Fraunces`, 110, 1500) + "px";
    const letters = [...title].map((ch) => h("span", null, titleEl, ch));
    const caption = h("div", "caption", header);
    return { header, eyebrow, letters, caption };
  }

  function buildScroll(scene, names) {
    const n = names.length;
    const cols = n > 18 ? 3 : n > 7 ? 2 : 1;
    const rows = Math.ceil(n / cols);
    const scroll = h("div", "scroll", scene);
    h("div", "roller", scroll);
    const paperClip = h("div", "paper-clip", scroll);
    const paper = h("div", "paper", paperClip);
    const head = h("div", "scroll-head", paper, "The Nice List");
    h("small", null, head, `${n} names`);
    const grid = h("div", "scroll-names", paper);
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    grid.style.gridTemplateRows = `repeat(${rows}, 56px)`;
    grid.style.gridAutoFlow = "column";
    const colWidth = (900 - 112 - (cols - 1) * 28) / cols - 8;
    const nameEls = names.map((name) => {
      const cell = h("div", null, grid);
      cell.style.textAlign = "center";
      const span = h("span", "scroll-name", cell, name);
      span.style.display = "inline-block";
      span.style.fontSize = fitSize(name, (s) => `700 ${s}px Caveat`, 44, colWidth) + "px";
      return span;
    });
    const rollerBottom = h("div", "roller", scroll);
    return { scroll, paperClip, rollerBottom, nameEls };
  }

  function gearPath(teeth, outer, inner, hole) {
    const step = TAU / teeth;
    let d = "";
    for (let k = 0; k < teeth; k++) {
      const a = k * step;
      const pts = [[inner, a], [outer, a + step * 0.12], [outer, a + step * 0.38], [inner, a + step * 0.5]];
      for (const [r, ang] of pts) d += `${d ? "L" : "M"}${(Math.cos(ang) * r).toFixed(1)} ${(Math.sin(ang) * r).toFixed(1)} `;
    }
    d += `Z M${hole} 0 A${hole} ${hole} 0 1 0 ${-hole} 0 A${hole} ${hole} 0 1 0 ${hole} 0 Z`;
    return d;
  }

  function machineSvg() {
    let bulbs = "";
    for (let i = 0, x = 110; x <= 510; x += 40, i++) {
      bulbs += `<rect x="${x - 5}" y="322" width="10" height="8" fill="#5c3a12"/><circle class="bulb b${i % 2}" cx="${x}" cy="316" r="9"/>`;
    }
    let bolts = "";
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      bolts += `<circle cx="${(310 + Math.cos(a) * 159).toFixed(1)}" cy="${(520 + Math.sin(a) * 159).toFixed(1)}" r="6" fill="#ffe9a3" stroke="#8a5a18" stroke-width="2"/>`;
    }
    const gauge = (x, y) => `
      <circle cx="${x}" cy="${y}" r="32" fill="#fff6e3" stroke="url(#mBrass)" stroke-width="7"/>
      <path d="M${x - 20} ${y + 8} A21 21 0 1 1 ${x + 20} ${y + 8}" fill="none" stroke="#c9283a" stroke-width="3" stroke-dasharray="3 4"/>
      <line class="needle" style="transform-origin:${x}px ${y}px" x1="${x}" y1="${y}" x2="${x}" y2="${y - 22}" stroke="#3a2412" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="${x}" cy="${y}" r="4.5" fill="#3a2412"/>`;
    return `<svg viewBox="0 0 720 820" width="720" height="820">
      <defs>
        <linearGradient id="mBody" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e2434d"/><stop offset="1" stop-color="#9c1b29"/></linearGradient>
        <linearGradient id="mShade" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>
        <linearGradient id="mBrass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0b5"/><stop offset=".45" stop-color="#e3ad45"/><stop offset="1" stop-color="#9c661c"/></linearGradient>
        <linearGradient id="mGreen" x1="0" x2="1"><stop offset="0" stop-color="#43a56b"/><stop offset="1" stop-color="#1b5534"/></linearGradient>
        <radialGradient id="mGlass"><stop offset="0" stop-color="#2c2577"/><stop offset="1" stop-color="#0c0a2a"/></radialGradient>
        <pattern id="mCandy" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><rect width="36" height="36" fill="#fff6ea"/><rect width="18" height="36" fill="#d8343f"/></pattern>
      </defs>
      <g transform="translate(578 420)"><path class="gear gear-a" d="${gearPath(14, 94, 80, 22)}" fill="url(#mBrass)" stroke="#7a4f14" stroke-width="4" fill-rule="evenodd"/></g>
      <g transform="translate(612 278)"><path class="gear gear-c" d="${gearPath(9, 50, 40, 12)}" fill="url(#mBrass)" stroke="#7a4f14" stroke-width="4" fill-rule="evenodd"/></g>
      <g transform="translate(58 690)"><path class="gear gear-b" d="${gearPath(11, 72, 60, 18)}" fill="url(#mBrass)" stroke="#7a4f14" stroke-width="4" fill-rule="evenodd"/></g>
      <rect x="120" y="770" width="92" height="36" rx="10" fill="#3a2433"/>
      <rect x="408" y="770" width="92" height="36" rx="10" fill="#3a2433"/>
      <rect x="98" y="190" width="50" height="120" fill="#3b2c4d" stroke="#1d1428" stroke-width="4"/>
      <rect x="88" y="178" width="70" height="20" rx="6" fill="url(#mBrass)" stroke="#7a4f14" stroke-width="3"/>
      <path d="M150 122 L470 122 L394 306 L226 306 Z" fill="url(#mGreen)" stroke="#123d25" stroke-width="4" stroke-linejoin="round"/>
      <path d="M182 150 L438 150 L428 174 L192 174 Z" fill="url(#mCandy)" opacity=".9"/>
      <text x="310" y="238" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="800" font-size="22" letter-spacing="4" fill="#ffe7a0">NAMES IN</text>
      <rect x="132" y="102" width="356" height="30" rx="12" fill="url(#mBrass)" stroke="#7a4f14" stroke-width="3"/>
      <ellipse cx="310" cy="112" rx="152" ry="7" fill="#10251a"/>
      <rect x="540" y="640" width="116" height="76" fill="url(#mCandy)" stroke="#5c0f19" stroke-width="4"/>
      <ellipse cx="660" cy="678" rx="20" ry="50" fill="url(#mBrass)" stroke="#7a4f14" stroke-width="4"/>
      <ellipse cx="664" cy="678" rx="9" ry="37" fill="#2a0a10"/>
      <rect x="70" y="300" width="480" height="480" rx="44" fill="url(#mBody)" stroke="#5c0f19" stroke-width="5"/>
      <rect x="70" y="300" width="480" height="480" rx="44" fill="url(#mShade)"/>
      <rect x="72" y="338" width="476" height="14" fill="url(#mBrass)"/>
      <rect x="72" y="752" width="476" height="12" fill="url(#mBrass)"/>
      ${bulbs}
      ${gauge(122, 410)}
      ${gauge(498, 410)}
      <circle cx="310" cy="520" r="172" fill="url(#mBrass)" stroke="#7a4f14" stroke-width="4"/>
      <circle cx="310" cy="520" r="146" fill="url(#mGlass)" stroke="#5b3b10" stroke-width="3"/>
      ${bolts}
      <rect x="180" y="700" width="260" height="46" rx="12" fill="url(#mBrass)" stroke="#7a4f14" stroke-width="3"/>
      <text x="310" y="731" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-style="italic" font-weight="700" font-size="25" fill="#6b1018">Santa's Matchmaker</text>
    </svg>`;
  }

  function buildMachine(scene, names) {
    const machine = h("div", "machine", scene);
    machine.style.transform = "translateY(960px)";
    const body = h("div", "machine-body", machine);
    body.innerHTML = machineSvg();
    const porthole = h("div", "porthole", body);
    const vortex = h("div", "vortex", porthole);
    // Names orbit in rings, more on the outer rings, each kept upright.
    const n = names.length;
    const radii = n > 12 ? [42, 84, 120] : n > 4 ? [56, 108] : [80];
    const total = radii.reduce((a, b) => a + b, 0);
    const counts = radii.map((r) => Math.round((n * r) / total));
    counts[counts.length - 1] += n - counts.reduce((a, b) => a + b, 0);
    const orbs = new Map();
    const rings = [];
    let next = 0;
    radii.forEach((r, k) => {
      const ring = h("div", "orbit", porthole);
      const offset = rand(0, TAU);
      const ringOrbs = [];
      for (let j = 0; j < counts[k]; j++) {
        const name = names[next++];
        const a = offset + (j / counts[k]) * TAU;
        const orb = h("div", "orb", ring);
        orb.style.left = `${Math.cos(a) * r}px`;
        orb.style.top = `${Math.sin(a) * r}px`;
        orbs.set(name, h("span", null, orb, shortName(name)));
        ringOrbs.push(orb);
      }
      rings.push({ ring, orbs: ringOrbs, dir: k % 2 ? -1 : 1, duration: 9000 + k * 3500 });
    });
    h("div", "glass", porthole);
    return { machine, body, vortex, orbs, rings };
  }

  function buildLedger(scene, pairs) {
    const n = pairs.length;
    const ledger = h("div", "ledger", scene);
    ledger.style.opacity = "0";
    h("div", "ledger-head", ledger, "Who gives to whom");
    const grid = h("div", "ledger-rows", ledger);
    const cols = n > 14 ? 2 : 1;
    const rows = Math.ceil(n / cols);
    const rowH = Math.floor(Math.min(54, 620 / rows));
    grid.style.gridTemplateRows = `repeat(${rows}, ${rowH}px)`;
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    const colWidth = (440 - (cols - 1) * 26) / cols - 22;
    const base = Math.min(cols > 1 ? 24 : 30, Math.round(rowH * 0.58));
    const rowEls = pairs.map((p) => pairRow(grid, { giver: shortName(p.giver), receiver: shortName(p.receiver) }, base, colWidth));
    return { ledger, rowEls };
  }

  function pairRow(parent, pair, base, maxWidth) {
    const row = h("div", "row", parent);
    row.style.fontSize = fitSize(`${pair.giver} → ${pair.receiver}`, (s) => `600 ${s}px Fraunces`, base, maxWidth) + "px";
    h("span", "gvr", row, pair.giver);
    h("span", "arrow", row, "→");
    h("span", "rcv", row, pair.receiver);
    return row;
  }

  function buildTag(scene) {
    const hangtag = h("div", "hangtag", scene);
    hangtag.style.opacity = "0";
    h("div", "string", hangtag);
    const card = h("div", "tag-card", hangtag);
    h("div", "tag-label", card, "From");
    const name = h("div", "tag-name", card);
    return { hangtag, tagCard: card, tagName: name };
  }
  function setTagName(c, name) {
    c.tagName.textContent = name;
    c.tagName.style.fontSize = fitSize(name, (s) => `italic 700 ${s}px Fraunces`, 54, 420) + "px";
  }

  function buildReveal(scene) {
    const reveal = h("div", "reveal", scene);
    const label = h("div", "reveal-label", reveal, "gives a gift to");
    label.style.opacity = "0";
    h("br", null, reveal);
    const name = h("div", "reveal-name", reveal);
    name.style.opacity = "0";
    return { revealLabel: label, revealName: name };
  }
  function setRevealName(c, name) {
    c.revealName.textContent = name;
    c.revealName.style.fontSize = fitSize(name, (s) => `italic 900 ${s}px Fraunces`, 116, 600) + "px";
  }

  function makeGift(scene, colorIndex) {
    const [box, ribbon] = GIFT_COLORS[colorIndex % GIFT_COLORS.length];
    const gift = h("div", "gift", scene);
    gift.style.setProperty("--box", box);
    gift.style.setProperty("--ribbon", ribbon);
    gift.style.transform = at(CHUTE.x, CHUTE.y, "scale(0)");
    const inner = h("div", "gift-inner", gift);
    h("div", "gift-body", inner);
    const lid = h("div", "gift-lid", inner);
    const bow = h("div", "bow", lid);
    h("i", null, bow);
    h("i", null, bow);
    return { gift, inner, lid };
  }

  function setCaption(c, text) {
    anim(c.caption, [{ opacity: 1 }, { opacity: 0, transform: "translateY(-8px)" }], { duration: 220, easing: EASE.in });
    c.run.later(230, () => {
      c.caption.textContent = text;
      anim(c.caption, [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], { duration: 520, easing: EASE.out });
    });
  }

  function spinAnimations(c) {
    return c.body.getAnimations({ subtree: true }).filter((a) => a.effect.getComputedTiming().iterations === Infinity);
  }
  function setMachineSpeed(c, rate) {
    for (const a of spinAnimations(c)) a.updatePlaybackRate(rate);
  }

  // ---------- Act 1: the list ----------
  async function actList(c) {
    const { run } = c;
    anim(c.eyebrow, [{ opacity: 0, transform: "translateY(-16px)", letterSpacing: "0.6em" }, { opacity: 1, transform: "none", letterSpacing: "0.34em" }], { duration: 1000, easing: EASE.out });
    c.letters.forEach((s, i) =>
      anim(s, [{ opacity: 0, transform: "translateY(70px) scale(.3) rotate(-14deg)" }, { opacity: 1, transform: "none" }], { duration: 900, delay: 150 + i * 45, easing: EASE.back })
    );
    Sound.jingle(0.05, 10, 0.06);
    Sound.bell(1046.5, 0.3, 0.12, 1.6);
    run.later(550, () => sparkle(960, 140, { count: 44, speed: 700, gravity: 140, spread: TAU }));
    await run.wait(450);

    const height = c.paperClip.offsetHeight;
    anim(c.scroll, [{ opacity: 0, transform: "translateY(30px) scale(.96)" }, { opacity: 1, transform: "none" }], { duration: 450, easing: EASE.out });
    anim(c.paperClip, [{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)" }], { duration: 1100, easing: EASE.inOut });
    anim(c.rollerBottom, [{ transform: `translateY(${-height}px)` }, { transform: "none" }], { duration: 1100, easing: EASE.inOut });
    Sound.whoosh(0.1, 1.0, 0.05, 250, 900);
    await run.wait(800);

    setCaption(c, "Every name goes on Santa's list…");
    const gap = clamp(2600 / c.names.length, 55, 150);
    c.nameEls.forEach((el, i) => {
      anim(el, [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)" }], { duration: 420, delay: i * gap, easing: "cubic-bezier(.4,0,.2,1)" });
      run.later(i * gap + 280, () => {
        const p = stagePoint(el, 1, 0.55);
        sparkle(p.x, p.y, { count: 6, speed: 170, size: [4, 9], life: [0.3, 0.7], gravity: 80 });
        Sound.plink(i);
      });
    });
    await run.wait((c.names.length - 1) * gap + 900);
  }

  // ---------- Act 2: into the machine ----------
  function flyTag(c, el, i, flight) {
    const p0 = stagePoint(el);
    const p2 = { x: HOPPER.x + rand(-70, 70), y: HOPPER.y + 6 };
    const p1 = { x: (p0.x + p2.x) / 2, y: Math.min(p0.y, p2.y) - rand(150, 280) };
    const turn = rand(220, 420) * (Math.random() < 0.5 ? -1 : 1);
    const tag = h("div", "flytag", c.scene, el.textContent);
    anim(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 160 });
    anim(
      tag,
      arc(p0, p1, p2, 18, (t, x, y) => ({
        transform: at(x, y, `rotate(${turn * t}deg) scale(${1 - 0.6 * t})`),
        opacity: t > 0.86 ? (1 - t) / 0.14 : 1,
      })),
      { duration: flight, easing: "cubic-bezier(.45,.05,.55,.95)" }
    );
    if (i % 3 === 0) Sound.whoosh(0, 0.5, 0.035, 500, 2600);
    c.run.later(flight, () => {
      tag.remove();
      const orb = c.orbs.get(el.textContent);
      if (orb) anim(orb, [{ opacity: 0, scale: "0.2" }, { opacity: 1, scale: "1" }], { duration: 420, easing: EASE.back });
      sparkle(p2.x, p2.y, { count: 4, speed: 150, size: [4, 8], life: [0.3, 0.6], gravity: 60 });
    });
  }

  function chimneyPuffs(c) {
    if (!c.machineOn) return;
    puff(MACHINE.x + 123, MACHINE.y + 176, { count: 3, spread: 18, rise: -110, size: [10, 20], color: "rgba(255,255,255,0.8)" });
    c.run.later(rand(320, 640), () => chimneyPuffs(c));
  }

  async function actMachine(c) {
    const { run } = c;
    setCaption(c, "…into Santa's Matchmaker they go…");
    anim(c.scroll, [{ transform: "none" }, { transform: "translate(470px, 26px) scale(.82)" }], { duration: 1000, easing: EASE.inOut });
    anim(c.machine, [{ transform: "translateY(960px)" }, { transform: "translateY(-26px)", offset: 0.78 }, { transform: "none" }], { duration: 1150, delay: 200, easing: "cubic-bezier(.2,.8,.3,1)" });
    Sound.whoosh(0.2, 0.9, 0.08, 150, 1200);
    await run.wait(1250);

    Sound.thump();
    puff(MACHINE.x + 166, 1000, { count: 10, spread: 90, rise: -30, color: "rgba(235,242,255,0.9)" });
    puff(MACHINE.x + 454, 1000, { count: 10, spread: 90, rise: -30, color: "rgba(235,242,255,0.9)" });
    anim(c.body, [{ transform: "scale(1.04, .94)" }, { transform: "none" }], { duration: 420, easing: EASE.back });
    await run.wait(320);

    c.machine.classList.add("on");
    c.machineOn = true;
    Sound.humStart();
    Sound.bell(392, 0, 0.14, 1.2);
    for (const { ring, orbs, dir, duration } of c.rings) {
      anim(ring, [{ transform: "rotate(0deg)" }, { transform: `rotate(${dir * 360}deg)` }], { duration, iterations: Infinity });
      for (const orb of orbs) anim(orb, [{ transform: "rotate(0deg)" }, { transform: `rotate(${-dir * 360}deg)` }], { duration, iterations: Infinity });
    }
    anim(c.vortex, [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], { duration: 6000, iterations: Infinity });
    chimneyPuffs(c);
    await run.wait(380);

    const gap = clamp(2000 / c.names.length, 45, 170);
    const flight = 950;
    c.nameEls.forEach((el, i) => run.later(i * gap, () => flyTag(c, el, i, flight)));
    await run.wait((c.names.length - 1) * gap + flight + 200);

    const height = c.paperClip.offsetHeight;
    anim(c.paperClip, [{ clipPath: "inset(0 0 0% 0)" }, { clipPath: "inset(0 0 100% 0)" }], { duration: 600, easing: EASE.inOut });
    anim(c.rollerBottom, [{ transform: "none" }, { transform: `translateY(${-height}px)` }], { duration: 600, easing: EASE.inOut });
    run.later(520, () =>
      anim(c.scroll, [{ transform: "translate(470px, 26px) scale(.82)", opacity: 1 }, { transform: "translate(1150px, -160px) scale(.5) rotate(20deg)", opacity: 0 }], { duration: 650, easing: EASE.in })
    );
    Sound.whoosh(0.5, 0.6, 0.06, 300, 2400);

    setMachineSpeed(c, 2.6);
    anim(
      c.body,
      [0, 1, 2, 3, 4, 5, 6, 7, 8].map((k) => ({ transform: k === 8 ? "none" : `translate(${k % 2 ? 7 : -7}px, ${k % 3 ? -3 : 2}px) rotate(${k % 2 ? 0.7 : -0.7}deg)` })),
      { duration: 900, easing: "linear" }
    );
    Sound.whoosh(0, 1.0, 0.05, 90, 700);
    await run.wait(1050);
  }

  // ---------- Act 3: the gifts ----------
  // The previous gift goes into the ledger, and its receiver's name rises into
  // the tag, ready to give next.
  function passOn(c, i, T) {
    const prev = c.pairs[i - 1];
    const d = Math.max(280, 0.3 * T);
    anim(c.revealName, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-150px) scale(.5)", offset: 0.6 }, { opacity: 0, transform: "translateY(-240px) scale(.4)" }], { duration: d, easing: EASE.in });
    anim(c.tagCard, [{ transform: "none" }, { transform: "rotateX(90deg)" }], { duration: d * 0.5, easing: EASE.in });
    c.run.later(d * 0.5, () => {
      setTagName(c, prev.receiver);
      anim(c.tagCard, [{ transform: "rotateX(-90deg)" }, { transform: "none" }], { duration: d * 0.8, easing: EASE.back });
      sparkle(SPOT.x, 330, { count: 10, speed: 300, size: [4, 10], gravity: 100 });
    });

    const { gift } = c.openGift;
    const row = c.rowEls[i - 1];
    const target = stagePoint(row, 0.3, 0.5);
    const fly = Math.max(320, 0.38 * T);
    anim(gift, [{ transform: at(SPOT.x, SPOT.y) }, { transform: at(target.x, target.y, "scale(.1) rotate(25deg)"), opacity: 0.3 }], { duration: fly, easing: "cubic-bezier(.5,0,.3,1)" });
    c.run.later(fly, () => {
      gift.remove();
      anim(row, [{ opacity: 0, transform: "translateX(-24px)", backgroundColor: "rgba(244,201,93,0.7)" }, { opacity: 1, transform: "none", backgroundColor: "rgba(244,201,93,0)" }], { duration: 700, easing: EASE.out });
      sparkle(target.x, target.y, { count: 6, speed: 180, size: [4, 8], life: [0.3, 0.6], gravity: 50 });
    });
  }

  async function giftStep(c, i, T) {
    const { run } = c;
    const pair = c.pairs[i];
    const fast = T < 900;
    if (i > 0) passOn(c, i, T);

    const g = makeGift(c.scene, c.colorStart + i);
    const launch = 0.36 * T;
    const lift = { x: (CHUTE.x + SPOT.x) / 2, y: Math.min(CHUTE.y, SPOT.y) - 230 };
    anim(g.gift, arc(CHUTE, lift, SPOT, 14, (t, x, y) => ({ transform: at(x, y, `rotate(${-35 * (1 - t)}deg) scale(${0.25 + 0.75 * t})`) })), { duration: launch, easing: "cubic-bezier(.3,.6,.4,1)" });
    anim(c.body, [{ transform: "scale(1.035, .965)" }, { transform: "none" }], { duration: 160 + 0.1 * T, easing: EASE.out });
    puff(CHUTE.x + 12, CHUTE.y, { count: 5, spread: 40, rise: -20, size: [8, 16] });
    Sound.whoosh(0, launch / 1000, 0.05, 600, 2600);
    await run.wait(launch);

    anim(g.inner, [{ transform: "scale(1.12, .84)" }, { transform: "scale(.95, 1.06)", offset: 0.5 }, { transform: "none" }], { duration: Math.max(220, 0.2 * T), easing: "ease-out" });
    const settle = 0.06 * T + 30;
    await run.wait(settle);

    const side = Math.random() < 0.5 ? -1 : 1;
    anim(g.lid, [{ transform: "none", opacity: 1 }, { transform: `translate(${side * rand(40, 80)}px, -200px) rotate(${side * rand(25, 45)}deg)`, opacity: 0 }], { duration: Math.max(320, 0.4 * T), easing: "cubic-bezier(.2,.7,.4,1)" });
    sparkle(SPOT.x, SPOT.y - 70, { count: fast ? 22 : 42, speed: 720, spread: Math.PI * 0.9, gravity: 420 });
    Sound.pop();
    Sound.revealBell(i);
    setRevealName(c, pair.receiver);
    if (i === 0) anim(c.revealLabel, [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 400, easing: EASE.out });
    anim(c.revealName, [{ opacity: 0, transform: "translateY(150px) scale(.2)" }, { opacity: 1, transform: "translateY(-10px) scale(1.08)", offset: 0.7 }, { opacity: 1, transform: "none" }], { duration: Math.max(380, 0.42 * T), easing: "cubic-bezier(.2,.8,.3,1)" });
    const orb = c.orbs.get(pair.receiver);
    if (orb) anim(orb, [{ opacity: 1, scale: "1" }, { opacity: 0, scale: "2.4" }], { duration: 380, easing: EASE.out });
    c.openGift = g;
    await run.wait(T - launch - settle);
  }

  async function actGifts(c) {
    const { run } = c;
    anim(c.ledger, [{ transform: "translateX(700px) rotate(6deg)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 850, easing: EASE.out });
    setTagName(c, c.pairs[0].giver);
    anim(
      c.hangtag,
      [
        { transform: "translateY(-430px)", opacity: 1, easing: EASE.in },
        { transform: "rotate(-12deg)", offset: 0.4, easing: "ease-in-out" },
        { transform: "rotate(8deg)", offset: 0.62, easing: "ease-in-out" },
        { transform: "rotate(-4deg)", offset: 0.8, easing: "ease-in-out" },
        { transform: "rotate(1.5deg)", offset: 0.92, easing: "ease-in-out" },
        { transform: "none", opacity: 1 },
      ],
      { duration: 1500 }
    );
    setCaption(c, "…and out come the gifts!");
    Sound.jingle(0.1, 6, 0.05);
    await run.wait(1000);

    const durations = stepDurations(c.pairs.length);
    for (let i = 0; i < c.pairs.length; i++) await giftStep(c, i, durations[i]);
    passOn(c, c.pairs.length, 1400);
    await run.wait(700);
    setCaption(c, `…and back to ${c.pairs[0].giver}. Every name is drawn!`);
    await run.wait(1500);
  }

  // ---------- Act 4: the Nice List ----------
  function sealSvg() {
    let edge = "";
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * TAU;
      const r = 86 + (k % 2 ? 5 : -2) + Math.sin(k * 1.7) * 3;
      edge += `${k ? "L" : "M"}${(95 + Math.cos(a) * r).toFixed(1)} ${(95 + Math.sin(a) * r).toFixed(1)} `;
    }
    let star = "";
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const r = k % 2 ? 11 : 26;
      star += `${k ? "L" : "M"}${(95 + Math.cos(a) * r).toFixed(1)} ${(95 + Math.sin(a) * r).toFixed(1)} `;
    }
    return `<svg viewBox="0 0 190 190" width="190" height="190">
      <defs>
        <radialGradient id="wax" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#e2404f"/><stop offset=".6" stop-color="#a8162a"/><stop offset="1" stop-color="#6e0a17"/></radialGradient>
        <path id="sealArc" d="M95 95 m-56 0 a56 56 0 1 1 112 0 a56 56 0 1 1 -112 0"/>
      </defs>
      <path d="${edge}Z" fill="url(#wax)"/>
      <circle cx="95" cy="95" r="70" fill="none" stroke="rgba(255,220,200,.35)" stroke-width="3"/>
      <circle cx="95" cy="95" r="42" fill="rgba(80,0,10,.25)"/>
      <text font-family="Nunito, sans-serif" font-weight="800" font-size="14" letter-spacing="2.6" fill="rgba(255,235,215,.88)"><textPath href="#sealArc">SANTA APPROVED · NORTH POLE ·</textPath></text>
      <path d="${star}Z" fill="rgba(255,232,214,.9)"/>
    </svg>`;
  }

  function buildFinal(scene, pairs) {
    const n = pairs.length;
    const sorted = pairs.slice().sort((a, b) => a.giver.localeCompare(b.giver));
    const panel = h("div", "final", scene);
    const head = h("div", "final-head", panel);
    h("small", null, head, "Santa's Nice List");
    head.append("Merry Christmas!");
    const grid = h("div", "final-rows", panel);
    const cols = n <= 6 ? 1 : n <= 14 ? 2 : n <= 27 ? 3 : 4;
    const rows = Math.ceil(n / cols);
    const rowH = Math.floor(Math.min(84, 540 / rows));
    grid.style.gridTemplateRows = `repeat(${rows}, ${rowH}px)`;
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    const colWidth = (1472 - (cols - 1) * 26) / cols - 30;
    const base = Math.min(46, Math.round(rowH * 0.56));
    const rowEls = sorted.map((p) => pairRow(grid, p, base, colWidth));
    const seal = h("div", "seal", panel);
    seal.innerHTML = sealSvg();
    return { panel, rowEls, seal };
  }

  async function actFinale(c) {
    const { run } = c;
    c.machineOn = false;
    c.machine.classList.remove("on");
    setMachineSpeed(c, 0.25);
    Sound.humStop();
    Sound.bell(523.25, 0, 0.12, 1.4);
    anim(c.machine, [{ transform: "none" }, { transform: "translateY(-20px)", offset: 0.25 }, { transform: "translateY(960px)" }], { duration: 900, delay: 150, easing: EASE.in });
    anim(c.hangtag, [{ transform: "none" }, { transform: "translateY(-560px)" }], { duration: 700, delay: 80, easing: EASE.in });
    anim(c.revealLabel, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
    const dx = 960 - LEDGER_CENTER.x;
    const dy = 600 - LEDGER_CENTER.y;
    anim(c.ledger, [{ transform: "none", opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(1.5)`, opacity: 0 }], { duration: 800, delay: 250, easing: EASE.inOut });
    anim(c.caption, [{ opacity: 1 }, { opacity: 0 }], { duration: 400, delay: 300 });
    Sound.whoosh(0.2, 0.8, 0.06, 200, 1600);
    await run.wait(700);

    const final = buildFinal(c.scene, c.pairs);
    final.seal.style.opacity = "0";
    anim(final.panel, [{ opacity: 0, transform: "translateY(50px) scale(.9)" }, { opacity: 1, transform: "none" }], { duration: 750, easing: EASE.out });
    final.rowEls.forEach((row, i) => anim(row, [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: 250 + i * 22, easing: EASE.out }));
    await run.wait(250 + final.rowEls.length * 22 + 500);

    anim(final.seal, [{ opacity: 0, transform: "scale(3.2) rotate(-60deg)" }, { opacity: 1, transform: "scale(.9) rotate(-10deg)", offset: 0.7 }, { opacity: 1, transform: "rotate(-14deg)" }], { duration: 420, easing: EASE.in });
    run.later(300, () => {
      const p = stagePoint(final.seal);
      Sound.thump(0, 0.6);
      Sound.fanfare(0.05);
      sparkle(p.x, p.y, { count: 70, speed: 850, spread: TAU, gravity: 300 });
      confetti(200);
      anim(final.panel, [{ transform: "translateY(5px)" }, { transform: "none" }], { duration: 260, easing: EASE.out });
    });
    await run.wait(1000);
  }

  // ---------- Public ----------
  function play(scene, { title, names, pairs }) {
    const run = makeRun();
    scene.innerHTML = "";
    const c = {
      run, scene, title, names, pairs,
      colorStart: Math.floor(Math.random() * GIFT_COLORS.length),
      ...buildHeader(scene, title),
      ...buildMachine(scene, names),
      ...buildLedger(scene, pairs),
      ...buildScroll(scene, names),
      ...buildTag(scene),
      ...buildReveal(scene),
    };
    for (const el of c.letters) el.style.opacity = "0";
    c.eyebrow.style.opacity = "0";
    c.scroll.style.opacity = "0";
    const done = (async () => {
      try {
        await actList(c);
        await actMachine(c);
        await actGifts(c);
        await actFinale(c);
        return true;
      } catch (e) {
        if (e === SKIP) return false;
        throw e;
      }
    })();
    return {
      done,
      skip() {
        if (run.skipped) return;
        run.skipped = true;
        Sound.humStop();
      },
    };
  }

  // The last frame on its own, for a skip or for looking back at a draw.
  function final(scene, { title, pairs }) {
    scene.innerHTML = "";
    buildHeader(scene, title);
    const f = buildFinal(scene, pairs);
    f.seal.style.transform = "rotate(-14deg)";
    anim(f.panel, [{ opacity: 0, transform: "scale(.96)" }, { opacity: 1, transform: "none" }], { duration: 450, easing: EASE.out });
  }

  root.Show = { play, final, stepDurations };
})(this);
