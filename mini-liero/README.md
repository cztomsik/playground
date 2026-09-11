# mini-liero

A tiny Liero-style arena shooter in plain HTML + JS. No build steps — just open it.

## Run

    open index.html

or serve the directory (e.g. `python3 -m http.server`) and visit localhost.

## Controls

- W / S or Up / Down — thrust / reverse
- A / D or Left / Right — turn
- Mouse — aim turret, click / hold to fire

You fight 3 bots (rust, mud, bone). Kills are tracked; you respawn in 2s.
Watch out — your own blasts hurt you too.

## Files

- `index.html` — page + HUD
- `js/terrain.js` — destructible rock map (offscreen canvas + alpha buffer,
  O(1) solidity queries, jagged explosion carving)
- `js/particles.js` — explosion fire and flashes
- `js/player.js` — tank physics, hull/rock collision, bot AI
  (roam, hunt, lead shots, line-of-sight check before firing)
- `js/game.js` — game loop, projectiles, camera + screen shake,
  minimap, HUD, WebAudio synth sounds

## Test

Headless smoke test (stubbed DOM/canvas in a `vm` context): terrain sanity,
movement, firing, blast carving, and a 60s bot-vs-bot battle.

    node test/smoke.js
