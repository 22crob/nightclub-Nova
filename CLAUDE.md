# Nightclub Nova

The main project is **Club Nova**, an isometric nightclub tycoon game in `game/` (Phaser 3 + Vite). The repo root also has two Python art generators (`generate.py` for posters, `bar.py` for an isometric bar sprite). See README.md for the layout.

See ROADMAP.md for the plan. The reference for all art, UI and gameplay is Nightclub City. Match its style with original assets; never copy its images, logo or name.

## Working on the game

- Run everything from `game/`: `npm install`, `npm run dev`, `npm test`.
- `npm test` builds `dist/index.html` and runs `tests/smoke.mjs` in headless Chromium. Run it before every commit, and add a check to it when adding a feature.
- The build is a single self-contained HTML file (vite-plugin-singlefile, all assets inlined). It must keep working when opened from disk via `file://`.
- `ClubScene` is split across `src/scene/*.js` as mixin classes, merged by `applyMixins()`. Put a new method in the file that matches its topic; `applyMixins` throws if two files define the same name.
- New buyable items go in `src/catalog.js`. Sprites go in `src/assets/sprites/` and are listed in `src/assets.js`.
- Sprite calibration (`displayWidth`, `originX`/`originY`) was measured against the actual rendered PNGs. Re-measure it if a sprite is re-rendered.
- The save format lives in `src/scene/save.js` under the key `clubNovaSave_v1`. Don't break existing saves; bump the key only if the format changes incompatibly.

## Art pipeline

- New props are modelled in Blender with a script in `art/blender/`, using `iso_rig.py` for the camera, lighting and rendering. Run it with a Python that has `bpy==4.5.4` and pillow.
- Scale is 1 Blender unit = 1 tile. Model the prop centred on the origin, inside its footprint, with its front facing -Y. Game +gx is Blender +X, and game +gy is Blender -Y.
- `render_facings()` renders facings 0/90/180/270 (the model rotated about Z), crops all four to one shared box, and writes `<name>.json` (displayWidth, originX, originY). The catalog imports that JSON, so never hand-tune these numbers.
- Check new art in the game with the footprint tiles outlined before shipping it.

## Playable link

The game is published as a private claude.ai Artifact at https://claude.ai/artifact/QfPRRyNXi3X4tXz83RVvNV. To update it, run `npm run build:artifact` and publish `game/dist/artifact.html` to that URL.

## The owner

The owner isn't a programmer. Explain changes in plain language, and show screenshots of visual changes.
