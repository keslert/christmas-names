// The family's lists, drawn in this order. One household per line; people on
// the same line never draw each other.
(function (root) {
  "use strict";
  const DEFAULT_DRAWS = [
    {
      title: "The Kids",
      text: [
        "Savvy, Summer, Sydney, Sheldon",
        "John-Mark, Christian, August, Odette",
        "Fenton, Winston, Eleanor, Adeline, Ashton",
        "Luke, Jens, Baby Girl (Tay & Becca)",
        "Lucas, Ledger, Copeland",
        "Jack, Henry, Ralph",
        "Leticia",
        "Edward, James",
      ].join("\n"),
    },
    {
      title: "The Women",
      text: ["Shannah", "Tiffany", "Jane", "Rebecca", "MarKette", "Sarah", "Janaya", "Abby", "Rylynn", "Angel"].join("\n"),
    },
    {
      title: "The Men",
      text: ["Skyler", "Chandler", "Kesler", "Tayler", "Tylee", "Drexler", "Brinler", "Stetler", "Kohler", "Wyatt"].join("\n"),
    },
  ];
  if (typeof module !== "undefined" && module.exports) module.exports = { DEFAULT_DRAWS };
  else root.DEFAULT_DRAWS = DEFAULT_DRAWS;
})(this);
