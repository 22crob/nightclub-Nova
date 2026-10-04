# Nightclub Nova

The main project is **Club Nova**, an isometric nightclub tycoon game in `game/` (Phaser 3 + Vite). The repo root also has two Python art generators (`generate.py` for posters, `bar.py` for an isometric bar sprite). See README.md for the layout.

See ROADMAP.md for the plan. The reference for all art, UI and gameplay is Nightclub City; art/REFERENCE_NOTES.md lists what we take from the owner's screenshots. Match its style with original assets; never copy its images, logo or name.

## Working on the game

- Run everything from `game/`: `npm install`, `npm run dev`, `npm test`.
- `npm test` builds `dist/index.html` and runs `tests/smoke.mjs` in headless Chromium. Run it before every commit, and add a check to it when adding a feature.
- The build is a single self-contained HTML file (vite-plugin-singlefile, all assets inlined). It must keep working when opened from disk via `file://`.
- `ClubScene` is split across `src/scene/*.js` as mixin classes, merged by `applyMixins()`. Put a new method in the file that matches its topic; `applyMixins` throws if two files define the same name.
- New buyable items go in `src/catalog.js`. Sprites go in `src/assets/sprites/` and are listed in `src/assets.js`.
- Flat surfaces (dance floors, and later wallpaper) are drawn in code, not Blender: designs live in `src/floors.js` / `src/walls.js` and are added to the catalog with `floorTier()` / `wallTier()`. Painted wall sections are saved under `wallpaper` in the save. Regular floors (`FLOOR_PAINTS`, `paintTier()`) are painted tile by tile like wallpaper (`src/scene/floorPaint.js`, saved under `floorPaint`); dance floors (`floorTier()`) are placed props, and the only tiles patrons dance on. A `flow` design needs `frames` to be a multiple of `period`.
- Sprite calibration (`displayWidth`, `originX`/`originY`) was measured against the actual rendered PNGs. Re-measure it if a sprite is re-rendered.
- The bare room is old brick walls (`oldBrick` in walls.js, drawn under any wallpaper by `drawBareWalls()`) and one seamless worn-concrete floor (`bareFloorCanvas()` in floors.js, `drawBareFloor()`). Floor tiles are invisible polygons, only tinted while highlighted. A new club (no save) gets `placeStarterLayout()`: the booth on the left wall and a staffed Starter Bar on the right wall.
- The street outside (road, sidewalk, buildings, velvet-rope line, bouncer, passers-by) is `src/scene/street.js`, settings in `STREET` in config.js. New patrons join the line there and go in at the door; leavers walk off down the street.
- The club always has exactly one DJ booth with a permanent DJ (`ensureClubBooth()` / `upgradeClubBooth()` in `staff.js`); only bartenders are hired. Music is `src/music.js`, and the Drop the Bass boost is `src/scene/boost.js`.
- Club nights are `src/scene/nights.js`, settings in `NIGHT` in config.js. Only `doorsOpen()` lets guests in; `clubOpen()` is false between nights, which stops music, wages and passive fans. Income for the night's summary goes through `noteIncome()`.
- Parties are `src/scene/parties.js`, the list in `PARTIES` in config.js. Their effects go through `partyEffect(name, none)` (capacity, arrivals, tips, thirst, fans); a party ends with the night.
- The save format lives in `src/scene/save.js` under the key `clubNovaSave_v2` (v2 came with the finer grid; v1 saves don't fit it). Don't break existing saves; bump the key only if the format changes incompatibly.

## Art pipeline

- New props are modelled in Blender with a script in `art/blender/`, using `iso_rig.py` for the camera, lighting and rendering. Run it with a Python that has `bpy==4.5.4` and pillow.
- Models are built at the original scale (1 Blender unit = one of the old 64 px tiles); `render_facings()` scales them by `iso_rig.MODEL_SCALE` (4/3) onto the game's finer 48 px tiles, so a model covers about a third more tiles than its size in units, and footprints in the catalog are in game tiles (bars 1x3, DJ booths/couches/pool table 3x1, curved booths 3x3). `iso_rig.make_bar_piece()` squeezes a bar module horizontally to fit exactly 1x3 tiles, so bars placed in a row line up into one long bar. Model the prop centred on the origin with its front facing -Y. Game +gx is Blender +X, and game +gy is Blender -Y.
- `render_facings()` renders facings 0/90/180/270 (the model rotated about Z), crops all four to one shared box, and writes `<name>.json` (displayWidth, originX, originY). The catalog imports that JSON, so never hand-tune these numbers.
- Check new art in the game with the footprint tiles outlined before shipping it.
- After rendering new art, run `python3 art/compress_sprites.py` to shrink the PNGs (keeps the build well under the play link's 16 MB).
- Decorations are in `build_decor.py`. `--preview DIR name...` renders facing 0 only, for a quick look before the full render. For scale: a bar counter is 1.0 tall and a patron about 1.5. Avoid `metal=1` materials (they render black with no environment) and faces that sit exactly on top of each other.
- Every prop render gets dark Freestyle outlines (`iso_rig.add_outlines()`, called by `render_facings()`), like Nightclub City's drawn art. Glowing parts (emission) are left without outlines so neon stays bright.
- Seating is in `build_seating.py`. Parts named `Back*` (backrests) go behind seated patrons unless they face the camera at that facing; everything else is the front layer, which the game always draws on top (`frontAlwaysNear`). Each piece lists its `seats` and `sitLift` in its JSON. Patrons sitting is in `src/scene/seating.js`.
- Bars render in two layers too (`render_facings(..., layers=split_counter(root))`): `<name>_back_*` and `<name>_front_*`. The game draws whichever is nearer the camera on top, with the bartender between them. Any prop staff stand inside should do the same.
- Patrons are drawn art (front view left, back view right, on white): every outfit is the same base guy with different clothes and hair. `art/sprites_from_art.py IMAGE INDEX` cuts him into head, body, arms and legs and animates them into a sheet (idle/walk/dance/sit x front/back; layout, frame counts and fps in `patrons.json`). Sit frames keep the torso where it is standing and fold the legs up under the hips, so seats calibrated for a standing patron still fit; `art/recolor_patron.py` makes extra patrons by changing skin tone and clothes colour. Sheets 0-5 are the drawn outfits, 6-11 recolours. Front faces screen down-left and back faces up-right; the game mirrors both for the other diagonals. (`build_patrons.py` is the old Blender chibi generator, no longer used.)
- Shelved 3D patron experiment: the owner's Mixamo character (`art/mixamo/walk.fbx`, a blank untextured model) and `art/blender/build_patron3d.py`, which colours him, adds hair and a painted face, pins the walk in place and renders `patron_12.png` in the drawn sheets' frame grid. The owner judged it not good enough, so it is not in the game. Bringing it back needs that sheet plus game code (see commit 990efdd).

## Playable link

The game is published as a private claude.ai Artifact at https://claude.ai/artifact/QfPRRyNXi3X4tXz83RVvNV. To update it, run `npm run build:artifact` and publish `game/dist/artifact.html` to that URL.

## The owner

The owner isn't a programmer. Explain changes in plain language, and show screenshots of visual changes.
