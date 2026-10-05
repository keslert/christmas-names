// Gift-exchange matching.
//
// A draw is one loop: everyone gives to the next person and the last gives to
// the first. Nobody draws themselves or anyone in their own household. The
// loop is chosen uniformly from all valid loops by rejection sampling, with a
// randomized search as a fallback for tightly constrained lists.
//
// Input text: one household per line, commas between people in a household.
//   Dasher, Dancer, Prancer
//   Rudolph
(function (root) {
  "use strict";

  function parseHouseholds(text) {
    return String(text)
      .split("\n")
      .map((line) => line.split(",").map((s) => s.trim()).filter(Boolean))
      .filter((house) => house.length > 0);
  }

  function formatHouseholds(households) {
    return households.map((house) => house.join(", ")).join("\n");
  }

  // Returns a list of problems; empty means the list can be drawn.
  function validate(households) {
    const names = households.flat();
    const problems = [];
    if (names.length < 2) problems.push("Add at least two names.");
    const seen = new Set();
    for (const name of names) {
      const key = name.toLowerCase();
      if (seen.has(key)) problems.push(`${name} is listed twice.`);
      seen.add(key);
    }
    const largest = households.reduce((a, b) => (b.length > a.length ? b : a), []);
    if (names.length >= 2 && largest.length * 2 > names.length) {
      problems.push(
        `${largest.join(", ")} can't all draw outside their household: a household can be at most half the list.`
      );
    }
    return problems;
  }

  function shuffle(items, random) {
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function isValidLoop(order) {
    for (let i = 0; i < order.length; i++) {
      const next = order[(i + 1) % order.length];
      if (order[i].house === next.house) return false;
    }
    return true;
  }

  // Randomized depth-first search for a loop; used only when sampling keeps missing.
  function searchLoop(people, random) {
    const n = people.length;
    const order = [];
    const used = new Array(n).fill(false);
    const start = Math.floor(random() * n);
    order.push(people[start]);
    used[start] = true;
    function step() {
      if (order.length === n) return order[n - 1].house !== order[0].house;
      const last = order[order.length - 1];
      for (const i of shuffle([...Array(n).keys()], random)) {
        if (used[i] || people[i].house === last.house) continue;
        used[i] = true;
        order.push(people[i]);
        if (step()) return true;
        order.pop();
        used[i] = false;
      }
      return false;
    }
    return step() ? order : null;
  }

  // Returns pairs in loop order: pairs[i].receiver === pairs[i + 1].giver,
  // and the last receiver is the first giver.
  function drawLoop(households, random = Math.random) {
    const problems = validate(households);
    if (problems.length) throw new Error(problems.join(" "));
    const people = households.flatMap((house, h) => house.map((name) => ({ name, house: h })));
    let order = null;
    for (let tries = 0; tries < 20000 && !order; tries++) {
      const candidate = shuffle(people, random);
      if (isValidLoop(candidate)) order = candidate;
    }
    if (!order) order = searchLoop(people, random);
    if (!order) throw new Error("No valid draw exists for this list.");
    return order.map((p, i) => ({ giver: p.name, receiver: order[(i + 1) % order.length].name }));
  }

  // A share link carries finished draws in its hash (the part of a URL that
  // never reaches the server), so whoever opens it replays the same matches.
  // Each draw is its title, its names in list order, and the loop as indexes
  // into those names: { v: 1, d: [{ t, n, o }] }, as JSON in base64url.
  function encodeShare(results) {
    const d = results.map(({ title, names, pairs }) => {
      const index = new Map(names.map((name, i) => [name, i]));
      return { t: title, n: names, o: pairs.map((p) => index.get(p.giver)) };
    });
    const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, d }));
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  // The draws in a share link, or null if it isn't one this page can play.
  function decodeShare(code) {
    try {
      const binary = atob(String(code).replace(/-/g, "+").replace(/_/g, "/"));
      const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0))));
      if (data.v !== 1 || !Array.isArray(data.d) || !data.d.length) return null;
      const draws = data.d.map(({ t, n, o }) => {
        const ok =
          typeof t === "string" && Array.isArray(n) && n.length >= 2 && n.every((x) => typeof x === "string") &&
          Array.isArray(o) && o.length === n.length && new Set(o).size === n.length &&
          o.every((i) => Number.isInteger(i) && i >= 0 && i < n.length);
        if (!ok) return null;
        return { title: t, names: n, pairs: o.map((k, i) => ({ giver: n[k], receiver: n[o[(i + 1) % o.length]] })) };
      });
      return draws.every(Boolean) ? draws : null;
    } catch {
      return null;
    }
  }

  const api = { parseHouseholds, formatHouseholds, validate, drawLoop, encodeShare, decodeShare };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Draw = api;
})(this);
