# Nightclub Nova

## The game: Club Nova

`game/` holds the club tycoon game, built with Phaser 3. You build out an isometric club with bars, DJ booths, dance floors and decorations. Patrons walk in, earn you fans and tip you.

### Playing and developing

You need [Node.js](https://nodejs.org) installed. Then, in the `game/` folder:

```bash
npm install        # first time only
npm run dev        # run the game at http://localhost:5173, reloads as you edit
npm run build      # makes dist/index.html: one file, double-click to play
npm test           # builds, then plays through the game automatically to check nothing broke
npm run build:artifact   # makes dist/artifact.html, the version published as the shareable play link
```

### Layout

| Path | What it is |
|---|---|
| `game/index.html` | Page layout: top bar, shop panel, buttons |
| `game/src/main.js` | Starts Phaser |
| `game/src/style.css` | All page styling |
| `game/src/config.js` | Tuning numbers: tile size, patron timing, save key |
| `game/src/catalog.js` | Everything buyable: props, prices, unlock levels, expansions |
| `game/src/assets.js` | Sprite image list |
| `game/src/assets/sprites/` | Sprite PNGs (4 facings per prop, patron spritesheets) |
| `game/src/sfx.js`, `icons.js`, `util.js` | Sound effects, shop icons, helpers |
| `game/src/scene/ClubScene.js` | The main scene: setup and game loop timers |
| `game/src/scene/*.js` | The scene's other methods, one file per topic: `world` (floor, walls, expansion), `placement`, `propVisuals`, `shop`, `economy`, `save`, `patrons`, `hud` |
| `game/tests/smoke.mjs` | Automated play-through test |

## Game art (Blender)

Props are modelled and rendered in Blender by scripts in `art/blender/`, so every sprite has the same camera, lighting and scale. One Blender unit is one game tile (1 m), and the shared camera in `iso_rig.py` renders a tile at exactly the game's tile size. Each build script also writes a JSON file with the sprite's size and anchor point, and the game reads those numbers directly.

```bash
pip install bpy==4.5.4 pillow      # Blender as a Python module, no Blender app needed
python art/blender/build_bar.py      # rebuilds bar.blend and the 4 bar sprites
python art/blender/build_patrons.py  # renders the 12 chibi patrons (about 5 minutes)
```

The `.blend` files are saved next to the scripts, so you can open them in Blender to look at or tweak a model.

## 2D image generator

Makes neon synthwave poster art for Nightclub Nova. Each image has a night sky with stars, a glowing "nova" burst, club light beams, a perspective grid floor and neon title text. The same seed always produces the same image.

![palettes](samples/palettes.png)

## Setup

```bash
pip install -r requirements.txt
```

## Usage

```bash
python generate.py                                    # one random poster -> output/
python generate.py --seed 42 --palette magenta        # reproducible, fixed palette
python generate.py --count 10                         # a batch of variations
python generate.py --size 1920x1080 --subtitle "FRI 10PM"   # landscape event banner
python generate.py --title "NOVA" --subtitle "LADIES NIGHT" --out flyers/
```

| Option | Default | Description |
|---|---|---|
| `--seed` | random | Seed for the first image; the rest of a batch use seed+1, seed+2, … |
| `--count` | 1 | Number of images to generate |
| `--palette` | random | `acid`, `cyber`, `ice`, `magenta`, `sunset` |
| `--size` | `1080x1350` | `WIDTHxHEIGHT` in pixels (default is an Instagram portrait) |
| `--title` / `--subtitle` | `NOVA` / `NIGHTCLUB` | The text on the image |
| `--out` | `output` | Output directory |

The fonts in `fonts/` (Tektur, Outfit) are under the SIL Open Font License.

## Bar sprite

`bar.py` draws one isometric bar piece in three parts: a front counter, an open gap for the bartender, and a back bar the same width. The back bar has a glowing glass rack, bottles and a lit bottle display. `sprites/bar_piece.png` has a transparent background. Pieces are built to line up side by side into a longer bar, as in `sprites/bar_x3_preview.png`.

```bash
python bar.py              # writes sprites/bar_piece.png and previews
python bar.py --scale 2    # double resolution
```
