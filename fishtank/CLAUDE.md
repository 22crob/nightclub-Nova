# Reef & River (fishtank/)

A fish tank tycoon, separate from Club Nova (the repo root's CLAUDE.md is about Club Nova; only its general rules apply here: the owner isn't a programmer, explain in plain language and show screenshots of visual changes). See README.md for the layout and how it plays. Original game: no copied art, names or logos from other fish games.

- Run everything from `fishtank/`: `npm install`, `npm run dev`, `npm test`. Run `npm test` before every commit and add a check when adding a feature. The build is one self-contained `dist/index.html` that must work from `file://`.
- Rules live in `src/state.js`, with no drawing; it fires events (`onEvent`: 'change' (with `rebuild` when the tank view must be redrawn), 'tip', 'eggs', 'hatch', 'grown', 'fed', 'cleaned', 'levelUp') that `scene.js` and `ui.js` listen to. Actions return `{ ok, msg }`. Tests call state functions directly (exposed on `window.__reef`), since headless Chromium runs the game clock slowly.
- All tuning (species, colours, patterns, tanks, decorations, levels, care rates) is in `src/config.js`. A new species needs a shape in `SHAPES` in fishArt.js; a new decoration needs a drawing in `ART` in decorArt.js.
- Genetics (`src/genetics.js`): a genome is `{ species, color, color2, pattern, fins, glow, size, seed }`. Rarity counts only what's unusual for the species (`rarityScore()`), so each kind's normal look is Common. The Fish Book is `G.discovered`, keyed by `lookKey()`.
- Breeding tanks: `parentsIn()` is the pair (grown-ups not born there), `youngIn()` the babies plus grown-up babies that haven't moved out (`f.young`); grown-up babies take over as parents when a parent place is free.
- Fish are drawn in code, facing right, as a body and a tail picture (`fishTextures()`), cached per look. `fishThumb()` gives a cropped picture for cards.
- Save key `reefRiverSave_v1` in localStorage; time away is caught up on load (up to `OFFLINE_MAX_MS`). Don't break existing saves; `load()` drops anything it doesn't recognise.
- Playable link: https://claude.ai/artifact/DxrVAxYQYCaQ8dejwZuB12. To update it, run `npm run build`, strip the outer `<!DOCTYPE>`/`<html>`/`<head>`/`<body>` tags and the charset/viewport metas from `dist/index.html` (the artifact host adds its own), and publish that file to the same link.
