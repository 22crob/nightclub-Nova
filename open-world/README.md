# Lumen Vale

A small 3D open-world fantasy adventure that runs in the browser (Three.js + Vite).

The Moonshards that kept the village lanterns lit have been scattered across the vale. Talk to Elder Maren by the well, then follow the beams of light in the sky to find all five, fighting off slimes along the way. Treasure chests are hidden around the map, and day turns to night every eight minutes.

## Playing and developing

In this folder:

```bash
npm install        # first time only
npm run dev        # play at http://localhost:5173, reloads as you edit
npm run build      # makes dist/index.html: one file, double-click to play
npm test           # builds, then plays through the quest automatically to check nothing broke
```

## Controls

WASD or arrows walk, Shift runs, Space jumps, click or F swings the sword, E talks and opens chests. Drag the mouse to look around, and use the wheel to zoom. Phones and tablets get an on-screen stick and buttons.

## Layout

| File | What it is |
|---|---|
| `src/config.js` | Tuning numbers: world size, places, speeds, slimes, day length, quest |
| `src/materials.js` | The cartoon look: toon shading, outlines, rounded boxes, wind |
| `src/terrain.js` | The ground: hills, lake, mountains round the edge, paths, colours, where grass grows |
| `src/grass.js` | The swaying grass (a shader) |
| `src/water.js` | The water (a shader): shallows, foam, ripples |
| `src/nature.js` | Trees, bushes, rocks and flowers |
| `src/places.js` | The village, the five places, Moonshards and chests |
| `src/character.js` | The blocky people (hero and villagers) and how they move |
| `src/player.js` | Walking, jumping, swimming, the sword |
| `src/slimes.js` | The slimes |
| `src/npcs.js` | Villagers and what they say |
| `src/sky.js` | Day and night, clouds |
| `src/hud.js` | Hearts, coins, quest, minimap, messages, dialogue |
| `src/input.js` | Keyboard, mouse and touch |
| `src/game.js` | Builds the world and runs the game loop |
| `tests/smoke.mjs` | Automated play-through test |
