# Nightclub Nova

The main project is **Club Nova**, an isometric nightclub tycoon game in `game/` (Phaser 3 + Vite). The repo root also has two Python art generators (`generate.py` for posters, `bar.py` for an isometric bar sprite). See README.md for the layout.

## Working on the game

- Run everything from `game/`: `npm install`, `npm run dev`, `npm test`.
- `npm test` builds `dist/index.html` and runs `tests/smoke.mjs` in headless Chromium. Run it before every commit, and add a check to it when adding a feature.
- The build is a single self-contained HTML file (vite-plugin-singlefile, all assets inlined). It must keep working when opened from disk via `file://`.
- `ClubScene` is split across `src/scene/*.js` as mixin classes, merged by `applyMixins()`. Put a new method in the file that matches its topic; `applyMixins` throws if two files define the same name.
- New buyable items go in `src/catalog.js`. Sprites go in `src/assets/sprites/` and are listed in `src/assets.js`.
- Sprite calibration (`displayWidth`, `originX`/`originY`) was measured against the actual rendered PNGs. Re-measure it if a sprite is re-rendered.
- The save format lives in `src/scene/save.js` under the key `clubNovaSave_v1`. Don't break existing saves; bump the key only if the format changes incompatibly.

## The owner

The owner isn't a programmer. Explain changes in plain language, and show screenshots of visual changes.
