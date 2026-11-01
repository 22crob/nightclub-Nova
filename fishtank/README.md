# Reef & River

A fish tank tycoon game: keep freshwater and saltwater tanks, breed fish for
new looks, and sell them or keep them to show off. Built with Phaser 3, all
art drawn in code. It's a separate game from Club Nova and shares nothing with
it but the repo.

## Playing and developing

You need [Node.js](https://nodejs.org). Then, in this `fishtank/` folder:

```bash
npm install   # first time only
npm run dev   # play at http://localhost:5173, reloads as you edit
npm run build # makes dist/index.html: one file, double-click to play
npm test      # builds, then plays through the game automatically
```

## How it plays

- **Tanks**: you start with a small freshwater tank and a freshwater breeding
  tank. Buy more (up to 8): bigger freshwater tanks, and from level 3
  saltwater tanks and a saltwater breeding tank.
- **Care**: food runs out and the water gets dirty over time; Feed and Clean
  keep the fish happy. Happy fish breed faster and earn more tips.
- **Breeding**: two grown-up fish of the same kind in a breeding tank lay eggs,
  which hatch into babies that grow up there. Each baby takes every trait
  (colour, second colour, pattern, fins, size, glow) from mum or dad, with a
  small chance of something new. Rarer fish are worth much more.
- **Money**: display tanks earn tips from visitors, based on how many fish,
  how rare and how well decorated (shown as stars). Fish sell for their value.
- **Fish Book**: every look you've owned or bred.

## Layout

| Path | What it is |
|---|---|
| `src/config.js` | Every tuning number and list: species, colours, patterns, tanks, decorations, levels, care rates |
| `src/genetics.js` | Fish genomes: shop fish, breeding, rarity, value, names |
| `src/state.js` | The game's rules and state, no drawing: tanks, fish, money, XP, buying, selling, saving |
| `src/fishArt.js` | Draws a fish from its genome (body and tail, so the tail can swish) |
| `src/decorArt.js` | Draws the decorations |
| `src/scene.js` | The Phaser scene: room, tank, swimming, flakes, bubbles, eggs |
| `src/ui.js`, `src/style.css`, `index.html` | The HUD, shop, cards, Fish Book and dialogs |
| `tests/smoke.mjs` | Automated play-through test |
