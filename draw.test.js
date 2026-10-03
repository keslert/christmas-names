// node draw.test.js — checks the rules every draw must keep.
const assert = require("node:assert/strict");
const { parseHouseholds, validate, drawLoop } = require("./draw.js");
const { DEFAULT_DRAWS } = require("./lists.js");

function seeded(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function checkDraw(households, pairs) {
  const names = households.flat();
  const houseOf = new Map(households.flatMap((h, i) => h.map((n) => [n, i])));
  assert.equal(pairs.length, names.length);
  assert.deepEqual(new Set(pairs.map((p) => p.giver)), new Set(names), "everyone gives once");
  assert.deepEqual(new Set(pairs.map((p) => p.receiver)), new Set(names), "everyone receives once");
  for (const [i, p] of pairs.entries()) {
    assert.notEqual(houseOf.get(p.giver), houseOf.get(p.receiver), `${p.giver} drew their own household`);
    assert.equal(pairs[(i + 1) % pairs.length].giver, p.receiver, "pairs run in loop order");
  }
}

for (const draw of DEFAULT_DRAWS) {
  const households = parseHouseholds(draw.text);
  assert.deepEqual(validate(households), [], draw.title);
  for (let seed = 1; seed <= 500; seed++) checkDraw(households, drawLoop(households, seeded(seed)));
}

// Tightly constrained: half the list is one household.
const tight = parseHouseholds("A, B, C\nD\nE\nF");
for (let seed = 1; seed <= 200; seed++) checkDraw(tight, drawLoop(tight, seeded(seed)));

assert.match(validate(parseHouseholds("A, B, C\nD"))[0], /at most half/);
assert.match(validate(parseHouseholds("A\na"))[0], /listed twice/);
assert.match(validate(parseHouseholds("A"))[0], /at least two/);
assert.equal(parseHouseholds("  A ,B\n\n C ").length, 2);

console.log("draw rules hold");
