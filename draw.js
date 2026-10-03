// Gift-exchange matching.
//
// A draw is one loop: everyone gives to the next person and the last gives to
// the first. Nobody draws themselves or anyone in their own household. The
// loop is chosen uniformly from all valid loops by rejection sampling, with a
// randomized search as a fallback for tightly constrained lists.
//
// Input text: one household per line, commas between people in a household.
//   Savvy, Summer, Sydney, Sheldon
//   Leticia
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

  const api = { parseHouseholds, formatHouseholds, validate, drawLoop };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Draw = api;
})(this);
