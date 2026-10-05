// Screens: setup (edit the lists) -> one show per draw -> summary (every match).
// The lists and the latest matches are kept in localStorage, so a refresh
// mid-party loses nothing.
//
// A share link (#draw=...) opens the "shared" screen instead: its shows replay
// the matches in the link, and nothing in it touches the viewer's own lists.
(function () {
  "use strict";
  const { Draw, Show, Sound, Scenery } = window;
  const $ = (id) => document.getElementById(id);
  const scene = $("scene");

  const load = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  };
  const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  // A fresh page starts with one empty draw; nobody's names ship with the site.
  const starterDraws = () => [{ title: "Gift Draw", text: "" }];
  // An empty card draws these, its placeholder, so anyone can watch a show
  // without typing names first.
  const SAMPLE = "Dasher, Dancer, Prancer\nVixen\nComet, Cupid\nDonner, Blitzen\nRudolph";
  const namesOf = (draw) => (draw.text.trim() ? draw.text : SAMPLE);

  let draws = load("draw.lists", null) || starterDraws();
  let results = load("draw.results", []); // [{ title, names, pairs }] by draw index
  // The draws from a share link while one is open, else null.
  let shared = null;
  // What the stage is doing: null, or { index, handle, finished }.
  let current = null;

  const fontsReady = Promise.race([
    Promise.all(["italic 900 110px Fraunces", "italic 700 54px Fraunces", "600 30px Fraunces", "700 44px Caveat", "800 20px Nunito"].map((f) => document.fonts.load(f))),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]);

  // ---------- Setup ----------
  function describe(text) {
    if (!text.trim()) return { ok: true, text: "Empty, so Start draws Santa's reindeer. Type or paste your own names." };
    const households = Draw.parseHouseholds(text);
    if (!households.length) return { ok: false, text: "Type or paste the names to draw." };
    const problems = Draw.validate(households);
    if (problems.length) return { ok: false, text: problems[0] };
    const people = households.flat().length;
    const together = households.filter((h) => h.length > 1).length;
    return {
      ok: true,
      text: together ? `${people} people · ${together} families of brothers and sisters` : `${people} people · anyone can draw anyone`,
    };
  }

  function renderSetup() {
    const list = $("draws");
    list.innerHTML = "";
    draws.forEach((draw, i) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-order">Draw ${i + 1}</div>
        <input aria-label="Draw name">
        <textarea spellcheck="false" aria-label="Names"></textarea>
        <div class="card-meta"></div>
        ${draws.length > 1 ? `<button class="card-remove" title="Remove this draw">×</button>` : ""}`;
      const [input, textarea, meta] = [card.querySelector("input"), card.querySelector("textarea"), card.querySelector(".card-meta")];
      input.value = draw.title;
      textarea.value = draw.text;
      textarea.placeholder = SAMPLE;
      const refresh = () => {
        const d = describe(textarea.value);
        meta.textContent = d.text;
        meta.classList.toggle("bad", !d.ok);
      };
      input.addEventListener("input", () => {
        draw.title = input.value;
        save("draw.lists", draws);
      });
      textarea.addEventListener("input", () => {
        draw.text = textarea.value;
        save("draw.lists", draws);
        refresh();
      });
      card.querySelector(".card-remove")?.addEventListener("click", () => {
        draws.splice(i, 1);
        save("draw.lists", draws);
        renderSetup();
      });
      refresh();
      list.appendChild(card);
    });
    $("last").hidden = !results.some(Boolean);
  }

  function renderShared() {
    const list = $("shared-draws");
    list.innerHTML = "";
    shared.forEach((draw, i) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<div class="card-order">Draw ${i + 1}</div><h2></h2><div class="card-meta"></div>`;
      card.querySelector("h2").textContent = draw.title;
      card.querySelector(".card-meta").textContent = `${draw.names.length} names`;
      list.appendChild(card);
    });
  }

  function showScreen(name) {
    $("setup").hidden = name !== "setup";
    $("shared").hidden = name !== "shared";
    $("summary").hidden = name !== "summary";
    $("skip").hidden = name !== "show";
    document.body.classList.toggle("showing", name === "show");
    Scenery.fit();
  }

  function stopShow() {
    if (current && !current.finished) current.handle.skip();
    current = null;
    scene.innerHTML = "";
  }

  function showSetup() {
    stopShow();
    renderSetup();
    showScreen("setup");
  }

  function showShared() {
    stopShow();
    renderShared();
    showScreen("shared");
  }

  // Where "back" goes: the shared draw's screen, or the viewer's own lists.
  const showHome = () => (shared ? showShared() : showSetup());

  // Opens the share link in the address bar, if there is one.
  function route() {
    const code = location.hash.match(/^#draw=(.+)$/)?.[1];
    shared = code ? Draw.decodeShare(code) : null;
    if (code && !shared) history.replaceState(null, "", location.pathname + location.search);
    showHome();
  }

  function leaveShared() {
    history.replaceState(null, "", location.pathname + location.search);
    shared = null;
    showSetup();
  }

  // The finished draws as a link; old saved matches without names list their givers.
  function shareUrl() {
    const list = shared || results.filter(Boolean).map((r) => ({ ...r, names: r.names || r.pairs.map((p) => p.giver).sort() }));
    return `${location.origin}${location.pathname}#draw=${Draw.encodeShare(list)}`;
  }

  async function share(button) {
    const url = shareUrl();
    const label = button.textContent;
    const flash = (text) => {
      button.textContent = text;
      setTimeout(() => (button.textContent = label), 2000);
    };
    // Phones get their share sheet; elsewhere the link goes on the clipboard.
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: "Santa's Gift Draw", text: "Watch Santa's elves draw our gift names!", url });
      } catch {}
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      flash("Link copied ✓");
    } catch {
      prompt("Copy this link to share the draw:", url);
    }
  }

  // ---------- Shows ----------
  // A shared draw replays its matches; one of the viewer's own draws is drawn fresh.
  async function startDraw(index) {
    stopShow();
    let result = shared?.[index];
    if (!shared) {
      const draw = draws[index];
      const households = Draw.parseHouseholds(namesOf(draw));
      result = { title: draw.title, names: households.flat(), pairs: Draw.drawLoop(households) };
      results[index] = result;
      save("draw.results", results);
    }
    Sound.unlock();
    showScreen("show");
    await fontsReady;
    const handle = Show.play(scene, result);
    const run = { index, result, handle, finished: false };
    current = run;
    handle.done.then((completed) => {
      if (completed && current === run) finish(run);
    });
  }

  function skip() {
    if (!current || current.finished) return;
    current.handle.skip();
    Show.final(scene, current.result);
    finish(current);
  }

  function finish(run) {
    run.finished = true;
    $("skip").hidden = true;
    const i = run.index;
    const bar = document.createElement("div");
    bar.className = "actions";
    const button = (label, cls, onClick) => {
      const b = document.createElement("button");
      b.className = `btn ${cls}`;
      b.textContent = label;
      b.addEventListener("click", onClick);
      bar.appendChild(b);
      return b;
    };
    const list = shared || draws;
    if (i + 1 < list.length) button(`Next: ${list[i + 1].title} ▸`, "primary", () => startDraw(i + 1));
    else button("See every match ▸", "primary", showSummary);
    if (shared) {
      button("Watch again", "", () => startDraw(i));
      button("Back", "", showShared);
    } else {
      button("Draw again", "", () => {
        if (confirm(`Draw ${draws[i].title} again? These matches will be replaced.`)) startDraw(i);
      });
      button("Share", "", (e) => share(e.currentTarget));
      button("Edit the lists", "", showSetup);
    }
    scene.appendChild(bar);
    bar.animate([{ opacity: 0, transform: "translateY(20px)" }, { opacity: 1, transform: "none" }], { duration: 500, fill: "both", easing: "cubic-bezier(.16,1,.3,1)" });
  }

  // ---------- Summary ----------
  function showSummary() {
    stopShow();
    const grid = $("summary-grid");
    grid.innerHTML = "";
    for (const result of shared || results.filter(Boolean)) {
      const card = document.createElement("div");
      card.className = "card";
      const title = document.createElement("h2");
      title.textContent = result.title;
      const list = document.createElement("ol");
      for (const p of result.pairs.slice().sort((a, b) => a.giver.localeCompare(b.giver))) {
        const li = document.createElement("li");
        li.innerHTML = `<span></span><span class="arrow">→</span><span class="rcv"></span>`;
        li.children[0].textContent = p.giver;
        li.children[2].textContent = p.receiver;
        list.appendChild(li);
      }
      card.append(title, list);
      grid.appendChild(card);
    }
    showScreen("summary");
  }

  // ---------- Wiring ----------
  $("start").addEventListener("click", () => {
    const bad = draws.findIndex((d) => !describe(namesOf(d)).ok);
    if (bad >= 0) {
      const card = $("draws").children[bad];
      card.animate([{ transform: "translateX(-8px)" }, { transform: "translateX(8px)" }, { transform: "none" }], { duration: 300, iterations: 2 });
      card.querySelector("textarea").focus();
      return;
    }
    if (!draws.length) return;
    results = [];
    save("draw.results", results);
    startDraw(0);
  });
  $("add").addEventListener("click", () => {
    draws.push({ title: "New draw", text: "" });
    save("draw.lists", draws);
    renderSetup();
    $("draws").lastElementChild.querySelector("textarea").focus();
  });
  $("reset").addEventListener("click", () => {
    if (!confirm("Clear every list and start over?")) return;
    draws = starterDraws();
    save("draw.lists", draws);
    renderSetup();
  });
  $("last").addEventListener("click", showSummary);
  $("print").addEventListener("click", () => window.print());
  $("back").addEventListener("click", showHome);
  $("share").addEventListener("click", (e) => share(e.currentTarget));
  $("watch").addEventListener("click", () => startDraw(0));
  $("shared-matches").addEventListener("click", showSummary);
  $("own").addEventListener("click", leaveShared);
  addEventListener("hashchange", route);
  $("skip").addEventListener("click", skip);

  const soundButton = $("sound");
  const renderSound = () => (soundButton.textContent = Sound.muted ? "Sound off" : "Sound on");
  soundButton.addEventListener("click", () => {
    Sound.setMuted(!Sound.muted);
    renderSound();
  });
  renderSound();

  addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea")) return;
    if (current && !current.finished && (e.key === " " || e.key === "ArrowRight")) {
      e.preventDefault();
      skip();
    } else if (current && current.finished && e.key === "Enter") {
      scene.querySelector(".actions .primary")?.click();
    }
  });

  Scenery.init();
  route();
})();
