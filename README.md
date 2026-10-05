# Santa's Gift Draw

Draws Christmas gift-exchange names with a 30-40 second elf-workshop show per draw.

Live at https://christmas-names.keslert.com. Locally, open `index.html` in a browser; no server or install is needed. The fonts come from Google Fonts, so it looks best online.

Deploy: every push to `main` on GitHub (keslert/christmas-names) is a production release (Vercel project `christmas-names` in `kesler-tanners-projects`; DNS is a Cloudflare CNAME to cname.vercel-dns.com, not proxied). `.vercelignore` keeps the test, this file, and local Vercel files off the site.

- **Setup:** each draw is a card. One household per line, commas between brothers and sisters; people on the same line never draw each other. Edits save in the browser.
- **The show:** the names are written on Santa's list, fly into Santa's Matchmaker, and come out as gifts. Each gift's receiver gives the next gift, round the loop and back to the first giver. Space or "Skip to the list" jumps to the end.
- **After each draw:** Next draw, Draw again, or Edit the lists. After the last draw, "See every match" shows every list, ready to print.
- **Share:** after a draw (or on Every match), Share copies a link, or opens the share sheet on a phone. The link carries the names and matches in its `#draw=` hash, which never reaches the server. Whoever opens it gets "A gift draw for you": Watch the draw replays those exact matches, and their own saved lists are left alone.
- The latest matches stay in the browser, so a refresh loses nothing ("See the last matches" on the setup screen).

Files: `draw.js` matches names and encodes share links (pure, tested by `node draw.test.js`), `show.js` is the animation, `scenery.js` the night scene and particles, `sound.js` synthesized sound, `app.js` the screens.
