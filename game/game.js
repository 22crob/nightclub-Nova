// Club Nova — isometric tycoon prototype (Phaser 3)
// DJ booth now uses real Blender-rendered sprites (4 facings). Other props
// are still placeholder colored boxes until their assets are built.

// Tiles (and everything sized off them) were scaled down from the original
// 96x48 — the floor was reading too large on screen. Kept at the same 2:1
// iso ratio, just smaller.
const TILE_W = 64;   // tile width in px (matches the 2:1 iso ratio you're using in Blender, x2 for on-screen scale)
const TILE_H = 32;
// Any prop/patron dimension that used to be a fixed pixel number (rather
// than a formula already built on TILE_W, like the DJ booth's displayWidth)
// gets multiplied by this instead, so the whole game shrinks/grows together
// if TILE_W is ever tuned again. 96 is the original tile width those fixed
// numbers were tuned against.
const PROP_SCALE = TILE_W / 96;
// Fallback-box dimensions for a rotatable prop whose sprites failed to load
// (see drawFallbackBox()) — pulled out to a shared constant so
// rotatePlacedProp() can re-anchor that same box/label after a rotation
// without its geometry drifting out of sync with drawFallbackBox() itself.
const FALLBACK_PROP_WIDTH = TILE_W * 0.7;
const FALLBACK_PROP_HEIGHT = 40 * PROP_SCALE;
// The club's floor starts at BASE_GRID_SIZE x BASE_GRID_SIZE and can grow
// from there — see GRID_EXPANSIONS below and ClubScene.expandClub(). Any
// code that used to check a fixed GRID_SIZE now reads the scene's own
// this.gridSize instead, since that's a per-club value that changes at
// runtime and gets saved/restored (see serializeState()/loadGame()).
const BASE_GRID_SIZE = 10;

// Facings are in degrees, matching the rotation applied in Blender: 0/90/180/270.
const FACINGS = [0, 90, 180, 270];

// capacity: how many extra patrons this prop lets the club hold at once
// (see patronCapacity() below) — bigger/more social props add more room.
// unlockLevel: the level (see levelInfo()) you need to reach before this
// prop can be bought at all. Its price (currentCost()) never moves once
// you're able to buy it — the progression is in WHICH props exist to buy
// at which tier, not in inflating a prop you already have access to.
// Omitted / 1 means available from the very start.
const PROP_TYPES = {
  bar: {
    key: 'bar', cost: 150, color: 0x2fd0ff, label: 'Bar', unlockLevel: 1, category: 'Bars',
    rotatable: true,
    // sprite key prefix per facing -> 'bar_0', 'bar_90', 'bar_180', 'bar_270'
    // — real Blender-rendered art (front counter + bartender aisle + rear
    // cabinet against the wall, see ClubNova_Bar_Design.txt), same
    // base64-data-URI embedding as the DJ booth (see bar_sprites_data.js,
    // loaded before this file in index.html, and preload() below).
    sprites: { 0: 'bar_0', 90: 'bar_90', 180: 'bar_180', 270: 'bar_270' },
    // The footprint is 3 tiles long x 1 tile wide (per the user's own
    // correction — not the 2x3/6-tile block an earlier session inferred
    // from the design doc's "front counter + aisle + rear cabinet" wording,
    // which read too big once actually seated on the grid). Facing 0/180
    // run the 3-tile line along gy; rotating 90° swaps it onto gx — same
    // gx/gy-swap convention the DJ booth's footprint uses.
    footprint: {
      0: [[0, 0], [0, 1], [0, 2]],
      90: [[0, 0], [1, 0], [2, 0]],
      180: [[0, 0], [0, 1], [0, 2]],
      270: [[0, 0], [1, 0], [2, 0]],
    },
    // draw scale + vertical anchor, calibrated the SAME WAY the DJ booth's
    // is (see its own comment above): measure the booth's own actual
    // rendered width against its footprint's own on-screen diamond width,
    // then hold the bar to that identical ratio rather than assuming any
    // fixed overhang/margin number of our own. Isolated real-browser
    // measurement of the CURRENT (known-good) DJ booth gives an actual
    // rendered width of 88px against its footprint's mathematically
    // expected 96px diamond width (2-wide x 1-deep footprint via
    // gridToScreen corner projection) — i.e. it sits about 8% INSIDE its
    // tiles, not overhanging them. Applying that same 88/96 (~0.9167x)
    // ratio to the bar's 1x3 footprint (mathematically expected 128px
    // diamond width: (dxRange 1 + dyRange 3) * TILE_W/2) targets an actual
    // rendered width of ~117.33px. The raw bar_0.png's own alpha-silhouette
    // bounding box measures 453px wide on its 768px source canvas, so:
    // displayWidth = 768 * (117.33 / 453) = 198.92.
    displayWidth: 198.92273730684326,
    originX: 0.5,
    originY: 0.6732051372528076,
  },
  // The Bars tab's own unlock-tier item, same idea as neonFloor/vipLounge/
  // neonSign: a pricier, better option that opens up once you've leveled
  // up, rather than the starter Bar just staying the only choice forever.
  // Unlike the plain Bar (no fanRate of its own — see isNearRevenueProp(),
  // which special-cases the 'bar' key so it still counts as a tip-boosting
  // revenue prop), this one earns its own passive fan rate too.
  premiumBar: { key: 'premiumBar', cost: 320, color: 0x2fa0ff, label: 'Premium Bar', fanRate: 0.8, unlockLevel: 4, category: 'Bars' },
  dj:    {
    key: 'dj', cost: 250, label: 'DJ Booth', fanRate: 1.2, unlockLevel: 1, category: 'Booths',
    rotatable: true,
    // sprite key prefix per facing -> 'dj_0', 'dj_90', 'dj_180', 'dj_270'
    sprites: { 0: 'dj_0', 90: 'dj_90', 180: 'dj_180', 270: 'dj_270' },
    // draw scale + vertical anchor tuning, re-measured directly from the
    // CURRENTLY deployed dj_0.png (the earlier numbers below were
    // calibrated against an older render of this sprite that had a
    // different crop/framing, which had quietly gone stale). Measured by
    // fitting the two straight base edges in the actual alpha silhouette
    // (their slopes are exactly ±0.5, matching this game's 2:1 tile ratio)
    // and taking the midpoint between the two opposite base corners they
    // define — that midpoint is the object's true floor-center pivot,
    // independent of any occluded/rounded corner pixels: fracX=0.5 (still
    // dead center), fracY=0.6641 (was 0.6461). The long base edge measured
    // ~377.9px in the current 576px render (was ~403px in the old one),
    // so displayWidth is rescaled to match: 576 * (107.33/377.9*0.26667...
    // simplifies to) TILE_W * 1.704 so that edge again comes out to exactly
    // 2 tile-diamond-edges of on-screen distance.
    displayWidth: TILE_W * 1.704,
    originX: 0.5,
    originY: 0.6641,
    // Which second tile (relative to the clicked/anchor tile) the booth's
    // long axis occupies, per facing. Blender's world +X axis (the booth's
    // built-in long axis at facing 0) maps to the game's +gx grid
    // direction, and rotating the booth 90° in Blender swaps that axis to
    // world +Y, which maps to the grid's gy direction — so facing 0/180
    // spans along gx, facing 90/270 spans along gy.
    footprint: {
      0: [[0, 0], [1, 0]],
      90: [[0, 0], [0, 1]],
      180: [[0, 0], [1, 0]],
      270: [[0, 0], [0, 1]],
    },
  },
  // Floors are the ONLY category that grants patron capacity (see
  // patronCapacity()) — a `capacity` field on a Bars/Booths/Decorations
  // item below is inert by design. Capacity is meant to come from the
  // club's actual floor space, eventually including a future "expand the
  // club" upgrade to its physical size, not from furniture.
  dance: { key: 'dance', cost: 50,  color: 0x8a4dff, label: 'Dance Tile', fanRate: 0.4, capacity: 1, unlockLevel: 1, category: 'Floors' },
  table: { key: 'table', cost: 80,  color: 0xffb84d, label: 'Table', fanRate: 0.3, unlockLevel: 1, category: 'Booths' },
  // First real use of the unlock-gating infrastructure: a fancier, pricier
  // dance floor that only becomes buyable once you've reached level 2 (100
  // fans). Its price is still completely fixed once unlocked, same as
  // every other prop — reaching level 2 just reveals it as purchasable.
  neonFloor: { key: 'neonFloor', cost: 220, color: 0xff4de0, label: 'Neon Floor', fanRate: 0.9, capacity: 2, unlockLevel: 2, category: 'Floors', glow: true },
  // Second unlock tier: a fancier seating area that beats a plain Table on
  // fan rate, unlocked once the club hits level 3.
  vipLounge: { key: 'vipLounge', cost: 380, color: 0xffe066, label: 'VIP Lounge', fanRate: 0.6, unlockLevel: 3, category: 'Booths' },
  // First item in the Decorations tab: pure ambiance, just a fan-rate
  // boost from making the place look better.
  discoBall: { key: 'discoBall', cost: 120, color: 0xd9d9ff, label: 'Disco Ball', fanRate: 0.5, unlockLevel: 1, category: 'Decorations', glow: true, lightRig: true },
  // A cheap starter decoration — available immediately, same idea as the
  // disco ball (ambiance only, no capacity), just the entry-level option so
  // the Decorations tab isn't a single item at launch.
  plant: { key: 'plant', cost: 60, color: 0x4dff88, label: 'Potted Plant', fanRate: 0.2, unlockLevel: 1, category: 'Decorations' },
  // The Decorations tab's own unlock-tier item, mirroring neonFloor/
  // vipLounge's pattern: a pricier, better-fan-rate option that opens up
  // once you've reached level 3.
  neonSign: { key: 'neonSign', cost: 260, color: 0xff5ec9, label: 'Neon Sign', fanRate: 0.7, unlockLevel: 3, category: 'Decorations', glow: true },
};

// Tab order for the shop panel (see ClubScene.buildShop()). Decorations and
// Wallpaper have no items yet — they still get a tab, showing a "coming
// soon" placeholder, so the category structure is visibly in place before
// there's anything to put in them. "Expand" is last and isn't a set of
// placeable props at all — see ClubScene.renderExpandCard()/expandClub().
const SHOP_CATEGORIES = ['Bars', 'Booths', 'Floors', 'Decorations', 'Wallpaper', 'Expand'];

// Sequential tiers for growing the club's physical floor past its starting
// BASE_GRID_SIZE. Priced and level-gated the same way every other purchase
// in this game is — reaching the level/cash to afford the next tier is the
// actual milestone, not a formula that keeps inflating. This is the ONLY
// thing that increases the floor itself; it never grants patron capacity
// directly (see patronCapacity()) — more floor just means more room to
// place more Floors-category items, which is what actually grows capacity.
const GRID_EXPANSIONS = [
  { size: 12, cost: 600, unlockLevel: 2 },
  { size: 14, cost: 1500, unlockLevel: 4 },
  { size: 16, cost: 3000, unlockLevel: 6 },
  { size: 18, cost: 5000, unlockLevel: 8 },
];

// A 1-5 "Fame" rating shown in the shop instead of raw fan-rate/capacity
// numbers — a qualitative "how cool is this" read derived from price
// (pricier items are fancier), rather than a spec sheet the player has to
// do math on.
function fameStars(cost) {
  if (cost >= 400) return 5;
  if (cost >= 300) return 4;
  if (cost >= 200) return 3;
  if (cost >= 100) return 2;
  return 1;
}

// Non-rotatable props that are flat ground decals (no real height) rather
// than something sitting on top of a tile — rendered as a flat shaded
// diamond instead of a 3D box, both in the world (drawIsoBox) and in the
// build-bar icon (renderIsoIcon).
const FLOOR_DECAL_PROPS = new Set(['dance', 'neonFloor']);

// ---------------------------------------------------------------------
// Patron/visitor system. This is the actual gameplay loop: NPCs walk in
// at the entrance tile, wander the floor, and periodically tip — that tip
// is real cash income now, not just the old flat per-second trickle from
// having props placed. The passive fan trickle further down still runs
// as ambient "reputation from having a nice venue" growth, on top of
// this.
// ---------------------------------------------------------------------
const PATRON_SPAWN_TILE = { gx: 0, gy: 0 }; // the "door" — patrons walk in and out here
// Capacity is no longer a flat number — an empty club still draws a
// trickle of curious visitors (PATRON_BASE_CAPACITY), and every prop you
// place adds room for more (PROP_TYPES[type].capacity), up to a hard
// ceiling so a maxed-out floor doesn't spawn an unmanageable crowd. See
// patronCapacity() below.
const PATRON_BASE_CAPACITY = 3;
const PATRON_ABSOLUTE_MAX = 24;
const PATRON_SPAWN_INTERVAL = [4000, 7000]; // ms between spawn attempts
const PATRON_MOVE_INTERVAL = [1500, 3000];  // ms a patron waits between wander steps
// A patron who's actually landed somewhere worth being — a dance floor tile,
// or a tile next to a revenue prop (bar/DJ/etc, see isNearRevenueProp()) —
// sticks around noticeably longer than one standing on a random empty tile.
// Without this, arriving at the dance floor meant nothing behaviorally: a
// patron would leave a good spot on the exact same short timer as an empty
// one, so the floor never visibly had anyone actually "hanging out"
// anywhere in particular. Real base-game behavior fix, not a visual one.
const PATRON_POI_LINGER = [3500, 7000];     // ms a patron lingers at a point of interest before wandering again
const PATRON_TIP_INTERVAL = [3000, 5500];   // ms between a patron's tips
const PATRON_LIFETIME = [14000, 22000];     // ms a patron stays before heading out
// Each patron token gets its own skin tone, outfit color, and hair (color +
// style, or none at all) picked independently at spawn — see
// drawPatronSprite() — so a full floor reads as a crowd of individuals
// instead of the same handful of color-coded blobs repeating.
const PATRON_SKIN_TONES = [0xffd9b3, 0xf0b088, 0xc98a5c, 0x9c6b43, 0x6e4a30, 0x4a3120];
const PATRON_OUTFIT_COLORS = [0xff6fae, 0x6fd1ff, 0xffe36f, 0x8affc1, 0xd68aff, 0xff9f6f, 0xff4d4d, 0x4d79ff];
const PATRON_HAIR_COLORS = [0x1a1a1a, 0x3b2414, 0x6b4423, 0xd6b370, 0xb33939, 0x2d2d6b, 0xe0e0e0];
// 'none' skips the hair shape entirely (bald/shaved); everyone else gets one
// of these simple silhouettes — see drawPatronHair().
const HAIR_STYLES = ['none', 'short', 'tall', 'long'];
// A patron token's own vertical seat: how far above its tile's screen point
// its container sits (see drawPatronSprite()) — scaled with PROP_SCALE like
// every other fixed-pixel size, and pulled into a shared constant since the
// movement/departure tweens below also target this same offset to keep a
// patron from "sinking" back to the raw tile point mid-walk.
const PATRON_Y_OFFSET = 6 * PROP_SCALE;
// Standing height of the real character sprite on screen, in pixels — a
// design choice (not derived from anything else), picked so patrons read
// clearly as people without dwarfing the tiles. Roughly 2 tile-heights
// tall. The character sprite's own displayHeight is set to this constant
// directly; its width follows proportionally since Phaser scales
// uniformly. Tune this one number to make patrons bigger/smaller overall.
const CHARACTER_DISPLAY_HEIGHT = TILE_H * 2.2;

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

// localStorage key for the save file. Bumping this (v1 -> v2) is the
// escape hatch if the save shape ever changes incompatibly — old saves
// under the old key are just ignored rather than crashing on load.
const SAVE_KEY = 'clubNovaSave_v1';

// Fraction of a prop's fixed cost refunded when you right-click to sell it
// back (see sellProp()).
const SELL_REFUND_RATIO = 0.5;

// Renders a small PNG data-URL of a prop's base color as a mini isometric
// box (or a flat diamond for `isFlat` ground-decal props, e.g. the dance
// floor) using plain <canvas> — completely separate from Phaser, so the
// build-bar icons can be built before the game canvas even exists, and so
// they read as little 3D chips instead of flat color swatches, matching
// the shaded boxes drawn for placed props in ClubScene.drawIsoBox().
function renderIsoIcon(color, isFlat) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const shade = (hex, factor) => {
    const r = (hex >> 16) & 0xff, g = (hex >> 8) & 0xff, b = hex & 0xff;
    const blend = (c) => (factor >= 0
      ? Math.round(c + (255 - c) * factor)
      : Math.round(c * (1 + factor)));
    return `rgb(${blend(r)},${blend(g)},${blend(b)})`;
  };

  const cx = size / 2;
  const hw = size * 0.36;
  const hh = hw * 0.5; // same 2:1 diamond ratio as the game's tiles
  const propH = isFlat ? 0 : size * 0.32;
  const baseY = size * 0.68;

  const gTop = { x: cx, y: baseY - hh };
  const gRight = { x: cx + hw, y: baseY };
  const gBottom = { x: cx, y: baseY + hh };
  const gLeft = { x: cx - hw, y: baseY };
  const lift = (p) => ({ x: p.x, y: p.y - propH });
  const tTop = lift(gTop), tRight = lift(gRight), tBottom = lift(gBottom), tLeft = lift(gLeft);

  const topColor = shade(color, 0.35);
  const rightColor = shade(color, -0.08);
  const leftColor = shade(color, -0.32);

  const poly = (pts, fill) => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };

  if (isFlat) {
    poly([gTop, gRight, gBottom, gLeft], topColor);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    poly([gLeft, gBottom, tBottom, tLeft], leftColor);
    poly([gRight, gBottom, tBottom, tRight], rightColor);
    poly([tTop, tRight, tBottom, tLeft], topColor);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tLeft.x, tLeft.y);
    ctx.lineTo(tTop.x, tTop.y);
    ctx.lineTo(tRight.x, tRight.y);
    ctx.lineTo(gRight.x, gRight.y);
    ctx.lineTo(gBottom.x, gBottom.y);
    ctx.lineTo(gLeft.x, gLeft.y);
    ctx.lineTo(tLeft.x, tLeft.y);
    ctx.moveTo(tBottom.x, tBottom.y);
    ctx.lineTo(gBottom.x, gBottom.y);
    ctx.stroke();
  }

  return canvas.toDataURL();
}

// Real sprite art for a rotatable prop, if it loaded — embedded as a
// base64 data URI in its own <key>_sprites_data.js (see preload() below)
// rather than a Phaser texture, since the two spots that use this
// (renderShopItems()'s prop buttons and updateSelectedChip()'s "currently
// holding" pill) build plain HTML <div> icons, not Phaser game objects.
// Returns null for anything without real art yet, so those callers fall
// back to the rendered iso-box chip from renderIsoIcon() above instead.
const REAL_SPRITE_ICON_SOURCES = {
  dj: () => (typeof DJ_BOOTH_SPRITES !== 'undefined' ? DJ_BOOTH_SPRITES : null),
  bar: () => (typeof BAR_SPRITES !== 'undefined' ? BAR_SPRITES : null),
};
function realSpriteIconFor(key) {
  const source = REAL_SPRITE_ICON_SOURCES[key];
  const sprites = source ? source() : null;
  return sprites && sprites[0] ? sprites[0] : null;
}

// ---------------------------------------------------------------------
// Sound effects — plain Web Audio oscillators with a short attack/decay
// envelope, not audio files, so the game stays a single self-contained
// page (no assets to load, nothing that can 404 or trip a CORS issue).
// Muted state is a device preference, not club progress, so it's kept
// under its own localStorage key instead of living in the save file.
// ---------------------------------------------------------------------
const SFX_MUTE_KEY = 'clubNovaMuted_v1';
const SFX = {
  ctx: null,
  muted: (() => {
    try { return localStorage.getItem(SFX_MUTE_KEY) === '1'; } catch (e) { return false; }
  })(),

  // Browsers refuse to make sound until a real user gesture has happened.
  // Safe to call repeatedly — only builds the AudioContext once.
  unlock() {
    if (this.ctx) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
    } catch (e) {
      this.ctx = null; // Web Audio unsupported — every SFX call below becomes a silent no-op
    }
  },

  setMuted(muted) {
    this.muted = muted;
    try { localStorage.setItem(SFX_MUTE_KEY, muted ? '1' : '0'); } catch (e) { /* best-effort */ }
  },

  // One short oscillator "blip" with a quick linear attack and exponential
  // decay, so it reads as a soft percussive hit rather than a harsh beep.
  tone(freq, { duration = 0.12, type = 'sine', gain = 0.15, delay = 0 } = {}) {
    if (this.muted || !this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  },

  place() { this.tone(220, { duration: 0.1, type: 'triangle', gain: 0.18 }); },
  sell() {
    this.tone(320, { duration: 0.09, type: 'triangle', gain: 0.14 });
    this.tone(200, { duration: 0.12, type: 'triangle', gain: 0.12, delay: 0.05 });
  },
  tip() {
    this.tone(880, { duration: 0.08, type: 'sine', gain: 0.12 });
    this.tone(1320, { duration: 0.14, type: 'sine', gain: 0.12, delay: 0.06 });
  },
  denied() { this.tone(140, { duration: 0.1, type: 'square', gain: 0.08 }); },
  expand() {
    // A low-to-high "whoosh" of three quick notes — distinct from both the
    // single blip of a normal placement and levelUp()'s longer fanfare,
    // since growing the floor itself is a bigger, rarer purchase than any
    // one prop but isn't tied to a level-up moment.
    this.tone(220, { duration: 0.1, type: 'sawtooth', gain: 0.12, delay: 0 });
    this.tone(330, { duration: 0.1, type: 'sawtooth', gain: 0.14, delay: 0.08 });
    this.tone(440, { duration: 0.2, type: 'sawtooth', gain: 0.16, delay: 0.16 });
  },
  levelUp() {
    // A short ascending 4-note fanfare — a bigger moment than a tip or a
    // placement, so it gets more notes and a brighter waveform.
    this.tone(523, { duration: 0.12, type: 'triangle', gain: 0.16, delay: 0 });
    this.tone(659, { duration: 0.12, type: 'triangle', gain: 0.16, delay: 0.1 });
    this.tone(784, { duration: 0.12, type: 'triangle', gain: 0.16, delay: 0.2 });
    this.tone(1047, { duration: 0.22, type: 'triangle', gain: 0.18, delay: 0.32 });
  },
};

class ClubScene extends Phaser.Scene {
  constructor() {
    super('club');
    this.cash = 500;
    this.fans = 0;
    this.selectedProp = 'bar';
    this.currentFacing = 0; // facing used for the NEXT rotatable prop placed
    this.placed = {}; // "gx,gy" -> { type, facing, gameObject, label }
    // The club's current floor size — grows via expandClub()/GRID_EXPANSIONS
    // and is saved/restored like any other piece of club state. Set for
    // real (possibly from a save) in create(), before the tile grid below
    // is built.
    this.gridSize = BASE_GRID_SIZE;
    this.hoverTile = null; // { gx, gy } currently under the mouse, or null
    this.ghost = null; // preview sprite shown while hovering an empty tile with a rotatable prop selected
    this.highlightedTiles = []; // tile polygons currently tinted as "this is what will be placed on"
    this.hoveredPropLabel = null; // the one placed-prop name label currently shown, if any — see updateHoveredPropLabel()
    this.patrons = []; // active visitor NPCs — see the patron system block above PROP_TYPES
  }

  preload() {
    // DJ booth sprites are embedded as base64 data URIs (see
    // dj_sprites_data.js, loaded before this file in index.html) rather
    // than loaded as external image files. Opening this game via a plain
    // double-clicked index.html uses the file:// protocol, and browsers
    // block Phaser's normal image-loading fetch for file:// URLs (CORS) —
    // data URIs sidestep that entirely, no local server needed.
    // NOTE: each of these three blocks guards independently (no early
    // `return` on a missing file) so one missing/failed data file — say
    // dj_sprites_data.js not loading — can't also silently skip loading
    // the others (bar sprites, patron sprites) further down.
    if (typeof DJ_BOOTH_SPRITES === 'undefined') {
      console.error('[Club Nova] dj_sprites_data.js did not load — DJ booth will use the fallback box.');
    } else {
      for (const facing of FACINGS) {
        const key = PROP_TYPES.dj.sprites[facing];
        if (DJ_BOOTH_SPRITES[facing]) {
          this.load.image(key, DJ_BOOTH_SPRITES[facing]);
        }
      }
    }

    // Bar sprites (see bar_sprites_data.js) — same base64-data-URI
    // embedding as the DJ booth, for the same file:// CORS reason. Real
    // Blender-rendered art (front counter + aisle + rear cabinet, see
    // ClubNova_Bar_Design.txt) replacing the old flat colored-box bar.
    if (typeof BAR_SPRITES === 'undefined') {
      console.error('[Club Nova] bar_sprites_data.js did not load — Bar will use the fallback box.');
    } else {
      for (const facing of FACINGS) {
        const key = PROP_TYPES.bar.sprites[facing];
        if (BAR_SPRITES[facing]) {
          this.load.image(key, BAR_SPRITES[facing]);
        }
      }
    }

    // Patron character sprites (see character_sprites_data.js) — same
    // base64-data-URI approach as the DJ booth, for the same file://
    // CORS reason. Each is a grid spritesheet: one shared character
    // model, one clip per animation (walk / dance).
    if (typeof CHARACTER_SPRITES === 'undefined') {
      console.error('[Club Nova] character_sprites_data.js did not load — patrons will use the fallback token.');
      return;
    }
    for (const name of ['walk', 'dance']) {
      const info = CHARACTER_ANIM_INFO[name];
      this.load.spritesheet(`patron_${name}`, CHARACTER_SPRITES[name], {
        frameWidth: info.frameWidth,
        frameHeight: info.frameHeight,
      });
    }
  }

  create() {
    this.cameras.main.setBackgroundColor('#0a0612');

    // World container we can drag around
    this.world = this.add.container(this.scale.width / 2, 160);

    this.tileLayer = this.add.container(0, 0);
    this.wallLayer = this.add.container(0, 0);
    this.propLayer = this.add.container(0, 0);
    this.patronLayer = this.add.container(0, 0);
    this.ghostLayer = this.add.container(0, 0);
    this.world.add(this.tileLayer);
    this.world.add(this.wallLayer);
    this.world.add(this.propLayer);
    this.world.add(this.patronLayer);
    this.world.add(this.ghostLayer);

    // If there's a save with an already-expanded club, size the grid to
    // match it up front — otherwise the floor would always start at
    // BASE_GRID_SIZE and only reach its real size after loadGame() (further
    // down) re-runs the expansion, which would work but momentarily builds
    // (and throws away) a smaller grid than the save actually has.
    this.gridSize = this.peekSavedGridSize() || BASE_GRID_SIZE;

    this.tiles = {};
    this.buildTiles(this.gridSize);
    this.buildWalls(this.gridSize);
    this.buildDoor();

    // Restore a previous save, if there is one — must happen after the
    // tile grid and layers above exist (restoreProp draws into propLayer)
    // but before updateUI() below so the very first render already shows
    // the restored cash/fans instead of flashing the fresh-game defaults.
    this.loadGame();

    // Baseline for level-up detection (see updateUI()) — set from whatever
    // level the restored save (or a fresh level-1 game) actually starts
    // at, so loading a save already at level 3 doesn't fire three
    // "level up!" celebrations on the very first frame.
    this.currentLevel = this.levelInfo().level;

    // Hover/placement is driven entirely off the raw mouse position, not
    // per-tile hit zones. Every frame we convert the pointer's screen
    // position straight into a grid cell with screenToGrid(), and that
    // SAME number is used for the hover highlight, the ghost preview, and
    // the tile that actually gets placed on click. Previously, hover used
    // one code path (per-tile polygon hit-tests) and click used another
    // (the gx/gy baked into that tile's own listener closure) — those two
    // paths could disagree right at a tile boundary, which is what made
    // the booth appear to place on "the tile next to" the one you were
    // hovering. With one shared calculation, that can't happen anymore.
    this.isDragging = false;
    let dragStart = null;

    this.input.on('pointerdown', (p) => {
      SFX.unlock(); // first real user gesture — safe/cheap to call every time
      dragStart = { x: p.x, y: p.y, wx: this.world.x, wy: this.world.y };
      this.isDragging = false;
    });

    this.input.on('pointermove', (p) => {
      if (dragStart) {
        const dx = p.x - dragStart.x;
        const dy = p.y - dragStart.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) {
          this.isDragging = true;
          this.world.x = dragStart.wx + dx;
          this.world.y = dragStart.wy + dy;
        }
      }
      this.updateHoverFromPointer(p);
    });

    this.input.on('pointerup', (p) => {
      const wasDragging = this.isDragging;
      dragStart = null;
      this.isDragging = false;
      if (wasDragging || !this.hoverTile) return;
      if (p.event.button === 0) {
        this.placeProp(this.hoverTile.gx, this.hoverTile.gy);
      } else if (p.event.button === 2) {
        this.sellProp(this.hoverTile.gx, this.hoverTile.gy);
      }
    });

    // R: rotate. If hovering a placed rotatable prop, rotate that prop.
    // Otherwise, rotate the "pending" facing used for the next placement.
    this.input.keyboard.on('keydown-R', () => this.handleRotateKey());

    // ESC: quick way to stop holding whatever's selected, same as
    // re-clicking it in the shop.
    this.input.keyboard.on('keydown-ESC', () => this.deselectProp());

    this.cashText = document.getElementById('cashVal');
    this.fansText = document.getElementById('fansVal');
    this.levelText = document.getElementById('levelVal');
    this.xpBarFill = document.getElementById('xpBarFill');
    this.placedText = document.getElementById('placedVal');
    this.buildShop();
    this.updateUI();

    // Mute toggle — a device preference (SFX.muted), not club state, so it
    // lives outside the save file and just needs its icon synced on load.
    this.muteButton = document.getElementById('muteButton');
    if (this.muteButton) {
      this.updateMuteButton();
      this.muteButton.addEventListener('click', () => {
        SFX.unlock();
        SFX.setMuted(!SFX.muted);
        this.updateMuteButton();
      });
    }

    // Outline layer for the "which tiles will this actually occupy" marker
    // — always drawn on top of props/ghost so a tall sprite's artwork can
    // never visually hide which floor tiles are claimed.
    this.footprintOutline = this.add.graphics().setDepth(9999);
    this.world.add(this.footprintOutline);

    // Passive fan growth from placed dance tiles / DJ booth
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        const rate = this.totalFanRate();
        if (rate > 0) {
          this.fans += rate;
          this.updateUI();
        }
      },
    });

    // Patron character animations (walk / dance) — registered once here
    // rather than per-patron, since Phaser anims are shared definitions
    // keyed by name; every patron's sprite just plays one of these two.
    if (this.hasCharacterSprites()) {
      this.anims.create({
        key: 'patron-walk',
        frames: this.anims.generateFrameNumbers('patron_walk', { start: 0, end: CHARACTER_ANIM_INFO.walk.count - 1 }),
        frameRate: 8,
        repeat: -1,
      });
      this.anims.create({
        key: 'patron-dance',
        frames: this.anims.generateFrameNumbers('patron_dance', { start: 0, end: CHARACTER_ANIM_INFO.dance.count - 1 }),
        frameRate: 8,
        repeat: -1,
      });
    }

    // Patron spawn loop — attempts a new arrival at a randomized interval
    // (self-rescheduling rather than a fixed-period timer, so spawns don't
    // land in an obvious metronomic rhythm).
    this.scheduleNextPatronSpawn();

    // Patron behavior tick — movement, tipping, and departure are all
    // driven off wall-clock timestamps checked here for every patron at
    // once, rather than one Phaser timer per patron.
    this.time.addEvent({
      delay: 400,
      loop: true,
      callback: () => this.tickPatrons(),
    });

    // Cash/fans drift upward continuously from patron tips, not just on
    // discrete actions like placing a prop, so on top of the save-on-action
    // calls elsewhere (placeProp, rotatePlacedProp) an autosave timer keeps
    // that drift from being lost. Also save on tab close as a last resort.
    this.time.addEvent({
      delay: 6000,
      loop: true,
      callback: () => this.saveGame(),
    });
    window.addEventListener('beforeunload', () => this.saveGame());
  }

  gridToScreen(gx, gy) {
    return {
      sx: (gx - gy) * (TILE_W / 2),
      sy: (gx + gy) * (TILE_H / 2),
    };
  }

  // Builds any tile in [0, upToSize) x [0, upToSize) that doesn't already
  // exist in this.tiles yet. Called once for the whole starting grid in
  // create(), and again with a bigger upToSize from expandClub() — in that
  // second case every already-built tile is skipped, so this only ever
  // adds the newly exposed strip of floor rather than rebuilding anything.
  buildTiles(upToSize) {
    for (let gx = 0; gx < upToSize; gx++) {
      for (let gy = 0; gy < upToSize; gy++) {
        const key = `${gx},${gy}`;
        if (this.tiles[key]) continue;
        const { sx, sy } = this.gridToScreen(gx, gy);
        // IMPORTANT: Phaser's Polygon shape computes its bounds/origin
        // incorrectly when any of its points are negative (a documented
        // Phaser quirk) — this silently renders the shape offset from the
        // (x,y) position you gave it. Our diamond points used to be
        // centered on (0,0) (e.g. -24, -48), which is exactly that trap:
        // the outline (drawn with plain Graphics, unaffected by this
        // Polygon-specific bug) was rendering in the true correct spot the
        // whole time, while every tile's actual fill/hit area was quietly
        // shifted — which is why the purple highlight and the green
        // footprint outline could never visually agree. Using all
        // non-negative points (and shifting the origin math to match)
        // sidesteps the bug entirely.
        const tile = this.add.polygon(
          sx, sy,
          [TILE_W / 2, 0, TILE_W, TILE_H / 2, TILE_W / 2, TILE_H, 0, TILE_H / 2],
          0x1b1030, 1
        );
        tile.setStrokeStyle(1, 0x4a2a70, 0.8);
        tile.gx = gx;
        tile.gy = gy;
        this.tileLayer.add(tile);
        this.tiles[key] = tile;
      }
    }
  }

  // Draws the two "back" walls that frame the floor — along the gx=0 and
  // gy=0 edges, the ones that sit furthest from this fixed camera angle —
  // leaving the (0,0) corner tile's two edges open as a one-tile doorway
  // gap (see buildDoor(), and PATRON_SPAWN_TILE which is that same tile).
  // Styled after a classic isometric-club look: a solid wall panel with a
  // row of small neon triangle "flags" strung along its top edge.
  //
  // Built with plain Graphics rather than the Polygon shape buildTiles()
  // uses: Polygon only renders correctly (see the note there) when it's
  // positioned at a small, non-negative (x,y) with non-negative local
  // points — fine for floor tiles sitting right at the world origin, but a
  // wall's top edge sits `wallHeight` px ABOVE its tile, which pushes the
  // whole shape's position well into negative Y for tiles near the front
  // of the grid and reintroduces the same mis-render. Graphics draws
  // exactly the absolute points given, so each segment is built straight
  // from its tile's real screen corners with no origin translation to get
  // wrong.
  //
  // Redraws everything from scratch every call (cheap — this only ever
  // runs from create() and on the rare expandClub() purchase, never per
  // frame) rather than tracking which segments already exist, since a
  // single Graphics object can't have individual old segments "skipped".
  buildWalls(upToSize) {
    const wallHeight = TILE_H * 3; // a solid, room-defining wall — tall relative to the floor tiles, same ballpark as a standing patron sprite plus some headroom
    const flagSpacing = 10; // px along the top edge between neon flags
    const flagSize = 6;
    if (!this.wallGraphics) {
      this.wallGraphics = this.add.graphics();
      this.wallLayer.add(this.wallGraphics);
    }
    const g = this.wallGraphics;
    g.clear();

    const drawWallQuad = (groundNear, groundFar, fillColor, flagColor) => {
      const topNear = [groundNear[0], groundNear[1] - wallHeight];
      const topFar = [groundFar[0], groundFar[1] - wallHeight];
      g.fillStyle(fillColor, 1);
      g.lineStyle(1, 0x5a3590, 0.9);
      g.beginPath();
      g.moveTo(groundNear[0], groundNear[1]);
      g.lineTo(groundFar[0], groundFar[1]);
      g.lineTo(topFar[0], topFar[1]);
      g.lineTo(topNear[0], topNear[1]);
      g.closePath();
      g.fillPath();
      g.strokePath();

      // A string of small neon triangle "flags" hanging along the wall's
      // top edge, evenly spaced — the festive trim line from the reference
      // look, built from plain triangles rather than a new art asset.
      const dx = topFar[0] - topNear[0];
      const dy = topFar[1] - topNear[1];
      const segLen = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.round(segLen / flagSpacing));
      g.fillStyle(flagColor, 0.9);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const fx = topNear[0] + dx * t;
        const fy = topNear[1] + dy * t;
        g.beginPath();
        g.moveTo(fx - flagSize / 2, fy);
        g.moveTo(fx - flagSize / 2, fy);
        g.lineTo(fx + flagSize / 2, fy);
        g.lineTo(fx, fy + flagSize);
        g.closePath();
        g.fillPath();
      }
    };

    // gridToScreen(gx,gy) is the CENTER of that tile's diamond (that's what
    // screenToGrid()'s hit-testing assumes, and what every sprite/container
    // is positioned by) — so a tile's four corners sit at that center ±half
    // a tile width/height, NOT at center+(raw offset) the way these two
    // loops used to compute them. That off-by-half-a-tile bug shifted every
    // wall panel down-and-right of the actual floor edge, which is exactly
    // why the wall looked like it was standing "in front of" the floor line
    // instead of meeting it.

    // Right-hand back wall, one segment per gx along gy=0, standing on
    // each tile's top-right edge (the edge that would otherwise border the
    // nonexistent gy=-1 neighbor). gx=0 is skipped — that's the doorway.
    for (let gx = 1; gx < upToSize; gx++) {
      const { sx, sy } = this.gridToScreen(gx, 0);
      const top = [sx, sy - TILE_H / 2];
      const right = [sx + TILE_W / 2, sy];
      drawWallQuad(top, right, 0x3a3a46, 0xff4de0);
    }

    // Left-hand back wall, one segment per gy along gx=0, standing on each
    // tile's top-left edge (the edge that would otherwise border the
    // nonexistent gx=-1 neighbor). gy=0 is skipped — the other half of the
    // doorway gap.
    for (let gy = 1; gy < upToSize; gy++) {
      const { sx, sy } = this.gridToScreen(0, gy);
      const left = [sx - TILE_W / 2, sy];
      const top = [sx, sy - TILE_H / 2];
      // A touch darker than the right wall so the two faces read as
      // distinct surfaces, not one flat color wrapping the corner.
      drawWallQuad(left, top, 0x2e2e38, 0xff4de0);
    }
  }

  // A doorway sitting in the one-tile gap the back walls leave open at
  // (0,0) — the exact tile patrons already spawn and despawn on
  // (PATRON_SPAWN_TILE) — drawn as an actual dark opening in the wall
  // (rather than a glow effect) so it reads as a real door. Called once
  // from create(); the door's tile never moves, so unlike the walls/floor
  // there's nothing for expandClub() to extend later.
  //
  // Built from the SAME two ground-edge points buildWalls() would have
  // used for this tile (its top-right and top-left edges), rather than an
  // axis-aligned rectangle floating over the tile's top corner. A plain
  // rectangle's bottom is a flat horizontal line, but the floor boundary
  // here is a shallow "V" (the tile's top corner sits higher than its left
  // and right corners) — that mismatch is exactly what left a wedge of
  // bare void between the door and the floor grid lines. Using the tile's
  // real corners means the opening's edges land exactly on top of where
  // the neighboring wall segments start, with no gap or overlap either way.
  buildDoor() {
    const { sx, sy } = this.gridToScreen(PATRON_SPAWN_TILE.gx, PATRON_SPAWN_TILE.gy);
    const wallHeight = TILE_H * 3; // matches buildWalls() so the opening's top edge lines up with the walls flanking it
    // (sx,sy) is this tile's CENTER (see the note in buildWalls()) — corners
    // sit at center ± half a tile width/height, not at center+(raw offset).
    const apex = [sx, sy - TILE_H / 2]; // this tile's top corner — where the two skipped wall segments would have met
    const right = [sx + TILE_W / 2, sy]; // its top-right corner (start of the right-hand wall run)
    const left = [sx - TILE_W / 2, sy]; // its top-left corner (start of the left-hand wall run)

    if (!this.doorGraphics) {
      this.doorGraphics = this.add.graphics();
      this.wallLayer.add(this.doorGraphics);
    }
    const g = this.doorGraphics;
    g.clear();

    const drawOpeningQuad = (groundNear, groundFar) => {
      const topNear = [groundNear[0], groundNear[1] - wallHeight];
      const topFar = [groundFar[0], groundFar[1] - wallHeight];
      g.fillStyle(0x0d0818, 1);
      g.lineStyle(2, 0x5a3590, 1);
      g.beginPath();
      g.moveTo(groundNear[0], groundNear[1]);
      g.lineTo(groundFar[0], groundFar[1]);
      g.lineTo(topFar[0], topFar[1]);
      g.lineTo(topNear[0], topNear[1]);
      g.closePath();
      g.fillPath();
      g.strokePath();
    };

    // Same two edges the wall loops in buildWalls() skip for this tile —
    // filling them in dark instead of wall-gray is what makes this read as
    // an opening rather than a solid corner.
    drawOpeningQuad(apex, right);
    drawOpeningQuad(apex, left);

    const label = this.add.text(apex[0], apex[1] - wallHeight - 6, 'ENTRANCE', {
      fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#ff9fe8',
    }).setOrigin(0.5, 1);
    this.wallLayer.add(label);
  }

  // A lightweight peek at the save file for just its gridSize, called
  // before the tile grid is built (see create()) — reading the WHOLE save
  // that early isn't possible yet (loadGame() needs the grid/layers to
  // already exist so restoreProp() has somewhere to draw into). Returns
  // null on any missing/corrupt/pre-expansion save, which just means
  // "start at BASE_GRID_SIZE", same as a first-ever play session.
  peekSavedGridSize() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (typeof data.gridSize === 'number' && data.gridSize >= BASE_GRID_SIZE) return data.gridSize;
    } catch (e) { /* corrupted save — loadGame() below will also hit and log this */ }
    return null;
  }

  // The next not-yet-reached tier in GRID_EXPANSIONS, or null once the club
  // is already at (or somehow past) the largest defined size.
  nextExpansion() {
    return GRID_EXPANSIONS.find((tier) => tier.size > this.gridSize) || null;
  }

  // Buys the next grid-size tier, if there is one, it's unlocked, and it's
  // affordable — an instant purchase (no placement step) triggered from the
  // shop's Expand tab (see renderExpandCard()). Returns true on a
  // successful expansion so the caller can react (closing the shop, etc.).
  expandClub() {
    const tier = this.nextExpansion();
    if (!tier) return false; // already at max size
    if (this.levelInfo().level < tier.unlockLevel) { SFX.denied(); return false; }
    if (this.cash < tier.cost) { SFX.denied(); return false; }

    this.cash -= tier.cost;
    this.gridSize = tier.size;
    this.buildTiles(this.gridSize);
    this.buildWalls(this.gridSize); // extend the back walls to the newly exposed edge

    // This is a bigger, rarer purchase than any single prop — give it its
    // own sound and a celebration banner (same showToast() used for
    // leveling up) instead of the same quiet blip every $50 dance tile
    // gets, so spending $600-5000 on more floor actually feels like
    // something happened.
    SFX.expand();
    this.showToast(`🏗️ Club expanded to ${tier.size}×${tier.size}!`);
    this.updateUI();
    this.saveGame();
    return true;
  }

  // Inverse of gridToScreen: given a point in world-local space (already
  // adjusted for the world container's pan offset), find which tile it
  // falls in. Solves sx=(gx-gy)*(TILE_W/2), sy=(gx+gy)*(TILE_H/2) for
  // gx,gy, then rounds to the nearest whole tile.
  screenToGrid(localX, localY) {
    const gxF = (localX / (TILE_W / 2) + localY / (TILE_H / 2)) / 2;
    const gyF = (localY / (TILE_H / 2) - localX / (TILE_W / 2)) / 2;
    return { gx: Math.round(gxF), gy: Math.round(gyF) };
  }

  // Single source of truth for "which tile is the mouse over right now".
  // Called on every pointermove; updates the hover highlight and the
  // ghost preview together so they can never fall out of sync with each
  // other or with what a click would actually place.
  updateHoverFromPointer(pointer) {
    const localX = pointer.x - this.world.x;
    const localY = pointer.y - this.world.y;
    const { gx, gy } = this.screenToGrid(localX, localY);
    const onGrid = gx >= 0 && gx < this.gridSize && gy >= 0 && gy < this.gridSize;
    const next = onGrid ? { gx, gy } : null;

    const same = (!this.hoverTile && !next) ||
      (this.hoverTile && next && this.hoverTile.gx === next.gx && this.hoverTile.gy === next.gy);
    if (same) return;

    this.hoverTile = next;
    // Tile highlighting itself now lives entirely in updateGhost(), driven
    // off the SAME footprint tiles the ghost/outline use — there is no
    // separate "which single tile is hovered" fill anymore. That old,
    // separate system was the actual bug: it highlighted the raw hovered
    // tile while the footprint (and the booth itself) were computed
    // independently, so on a tall sprite the two could visually read as
    // different tiles even though the code never disagreed about the
    // number itself. Highlighting exactly the footprint tiles makes that
    // impossible by construction.
    this.updateGhost();
    this.updateHoveredPropLabel(next);
  }

  // Shows the name label for whichever placed prop the cursor is currently
  // over, and hides whichever one was shown before — every prop's label
  // itself starts hidden (see drawFallbackBox()/drawIsoBox()), so at most
  // one is ever visible at a time instead of a floor full of them stacking
  // into unreadable clutter. A multi-tile prop's label is the same shared
  // object under all of its tiles, so hovering any tile of it just shows
  // that one label again rather than double-showing anything.
  updateHoveredPropLabel(hoverTile) {
    const placed = hoverTile ? this.placed[`${hoverTile.gx},${hoverTile.gy}`] : null;
    const nextLabel = placed && placed.label ? placed.label : null;
    if (nextLabel === this.hoveredPropLabel) return;
    if (this.hoveredPropLabel) this.hoveredPropLabel.setVisible(false);
    if (nextLabel) nextLabel.setVisible(true);
    this.hoveredPropLabel = nextLabel;
  }

  // Grid tiles a prop occupies, given the tile that was clicked/hovered
  // (the "anchor") and the current facing. Single-tile props just occupy
  // the one tile they were placed on.
  getFootprint(propType, facing, gx, gy) {
    const def = PROP_TYPES[propType];
    if (!def.footprint) return [[gx, gy]];
    const offsets = def.footprint[facing] || [[0, 0]];
    return offsets.map(([dx, dy]) => [gx + dx, gy + dy]);
  }

  // True only if every tile in the footprint is on the grid and empty.
  footprintValid(tiles) {
    return tiles.every(([tx, ty]) => (
      tx >= 0 && tx < this.gridSize && ty >= 0 && ty < this.gridSize && !this.placed[`${tx},${ty}`]
    ));
  }

  // Screen position at the center of a footprint (the midpoint between
  // tile centers for a multi-tile prop, or just that tile's center for a
  // single-tile one) — this is where the sprite's origin point gets drawn.
  footprintCenter(tiles) {
    const avgGx = tiles.reduce((s, [tx]) => s + tx, 0) / tiles.length;
    const avgGy = tiles.reduce((s, [, ty]) => s + ty, 0) / tiles.length;
    return this.gridToScreen(avgGx, avgGy);
  }

  // True once the player's level has reached this prop's unlockLevel
  // (defaults to 1 — available from the start — if a type doesn't set one).
  isUnlocked(type) {
    const unlockLevel = PROP_TYPES[type].unlockLevel || 1;
    return this.levelInfo().level >= unlockLevel;
  }

  // Selecting the item that's already selected is how you back out of
  // build mode — clicking it again in the shop deselects rather than doing
  // nothing, since otherwise there was no way to stop holding an item short
  // of buying/picking a different one.
  selectProp(key) {
    if (this.selectedProp === key) { this.deselectProp(); return; }
    if (!this.isUnlocked(key)) { SFX.denied(); return; } // can't select something you haven't unlocked yet
    this.selectedProp = key;
    this.updateGhost();
    this.updateShopUI();
  }

  deselectProp() {
    this.selectedProp = null;
    this.updateGhost();
    this.updateShopUI();
  }

  // Builds the categorized shop once: a tab per SHOP_CATEGORIES entry (a
  // real one right now is just Bars/Booths/Floors — Decorations and
  // Wallpaper are empty placeholders until there's content for them), plus
  // wiring for the toggle button that opens the panel and the close
  // button/backdrop that dismiss it. The panel starts open on whichever
  // category the currently selected prop belongs to.
  buildShop() {
    this.shopToggle = document.getElementById('shopToggle');
    this.shopOverlay = document.getElementById('shopOverlay');
    this.shopClose = document.getElementById('shopClose');
    this.shopTabsEl = document.getElementById('shopTabs');
    this.shopItemsEl = document.getElementById('shopItems');
    this.selectedChip = document.getElementById('selectedChip');
    if (!this.shopToggle || !this.shopOverlay || !this.shopTabsEl || !this.shopItemsEl) return; // older/debug HTML — skip silently

    this.shopTabsEl.innerHTML = '';
    this.shopTabButtons = {};
    for (const category of SHOP_CATEGORIES) {
      const tab = document.createElement('div');
      tab.className = 'shopTab';
      tab.textContent = category;
      tab.addEventListener('click', () => this.setShopCategory(category));
      this.shopTabsEl.appendChild(tab);
      this.shopTabButtons[category] = tab;
    }

    this.shopToggle.addEventListener('click', () => this.openShop());
    if (this.shopClose) this.shopClose.addEventListener('click', () => this.closeShop());
    // Clicking the dark backdrop (but not the panel itself) also closes it.
    this.shopOverlay.addEventListener('click', (e) => {
      if (e.target === this.shopOverlay) this.closeShop();
    });

    this.setShopCategory((PROP_TYPES[this.selectedProp] && PROP_TYPES[this.selectedProp].category) || SHOP_CATEGORIES[0]);
    this.updateSelectedChip();
  }

  openShop() {
    if (this.shopOverlay) this.shopOverlay.classList.add('open');
  }

  closeShop() {
    if (this.shopOverlay) this.shopOverlay.classList.remove('open');
  }

  // Switches the active tab and re-renders that category's items. Item
  // buttons only exist in the DOM for whichever category is currently
  // showing — updateShopUI() below only needs to keep those in sync.
  setShopCategory(category) {
    this.activeShopCategory = category;
    if (this.shopTabButtons) {
      for (const cat in this.shopTabButtons) {
        this.shopTabButtons[cat].classList.toggle('active', cat === category);
      }
    }
    this.renderShopItems(category);
  }

  // Renders one category's items as the same circular icon buttons the old
  // flat build bar used (dark circle, gold ring, cost pill) — click one to
  // select it, no keyboard shortcut involved.
  renderShopItems(category) {
    if (!this.shopItemsEl) return;
    this.shopItemsEl.innerHTML = '';
    this.shopButtons = {};
    this.shopCosts = {};

    // The Expand tab isn't a set of placeable props at all — it's a single
    // instant-purchase upgrade card for growing the club's grid size. See
    // renderExpandCard()/expandClub().
    if (category === 'Expand') {
      this.renderExpandCard();
      return;
    }

    const keysInCategory = Object.keys(PROP_TYPES).filter((k) => PROP_TYPES[k].category === category);
    if (keysInCategory.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'emptyCategory';
      empty.textContent = 'No items yet — coming soon!';
      this.shopItemsEl.appendChild(empty);
      return;
    }

    for (const key of keysInCategory) {
      const def = PROP_TYPES[key];

      const slot = document.createElement('div');
      slot.className = 'propSlot';

      const button = document.createElement('div');
      button.className = 'propButton';

      const icon = document.createElement('div');
      icon.className = 'icon';
      const realIcon = realSpriteIconFor(key);
      if (realIcon) {
        icon.style.backgroundImage = `url(${realIcon})`;
      } else {
        // Non-sprite props get a little rendered iso-box chip instead of a
        // flat color swatch, so the shop matches the shaded boxes the
        // props actually appear as once placed in the world.
        // NOTE: `background` is a shorthand — setting it here would reset
        // backgroundImage (just set above) back to none, leaving an empty
        // circle. Use backgroundColor instead so it only fills in behind
        // the icon's transparent PNG margins without wiping the image out.
        icon.style.backgroundImage = `url(${renderIsoIcon(def.color, FLOOR_DECAL_PROPS.has(key))})`;
        icon.style.backgroundColor = '#120a1f';
      }
      button.appendChild(icon);

      const label = document.createElement('div');
      label.className = 'propLabel';
      label.textContent = def.label;

      const cost = document.createElement('div');
      cost.className = 'propCost';
      cost.textContent = this.isUnlocked(key) ? `💰 ${this.currentCost(key)}` : `🔒 Lv ${def.unlockLevel || 1}`; // overwritten immediately by updateShopUI() below too, but correct from the first frame

      button.addEventListener('click', () => {
        const wasSelected = this.selectedProp === key;
        this.selectProp(key);
        // Only get out of the way once something was actually just picked.
        // selectProp() silently no-ops (just a denied blip) on a locked
        // item, and clicking the CURRENT selection again is a deselect, not
        // a pick — closing the whole shop in either case used to leave the
        // player having to reopen it just to try a different item, or to
        // keep browsing after clearing their selection.
        if (!wasSelected && this.selectedProp === key) this.closeShop();
      });
      slot.appendChild(button);
      slot.appendChild(label);
      slot.appendChild(cost);

      // A qualitative "Fame" rating instead of raw stat numbers — how cool
      // the item is, not a spreadsheet of exactly what it does. Only a
      // Floors item also gets a plain-language capacity note, since
      // capacity is strictly a flooring thing (see patronCapacity()).
      const stats = document.createElement('div');
      stats.className = 'propStats';
      const stars = fameStars(def.cost);
      let statsText = '✨ ' + '★'.repeat(stars) + '☆'.repeat(5 - stars);
      if (def.category === 'Floors' && def.capacity) statsText += `  🧱 +${def.capacity} floor space`;
      stats.textContent = statsText;
      slot.appendChild(stats);

      this.shopItemsEl.appendChild(slot);
      this.shopButtons[key] = button;
      this.shopCosts[key] = cost;
    }
    this.updateShopUI();
  }

  // Renders the Expand tab's single card: current floor size, the next
  // tier's size/cost/lock state, and a buy button that fires expandClub()
  // directly — there's no "select then place" step here, buying IS the
  // action. Re-rendered wholesale (rather than patched in place like the
  // prop buttons) any time it needs to refresh, since it's cheap and only
  // exists while this one tab is open.
  renderExpandCard() {
    // This gets called both from renderShopItems() (opening/switching to
    // the tab) AND from updateShopUI() (refreshing it while it's already
    // open, e.g. every second from the passive fan-rate tick) — clearing
    // the container here, rather than relying on the caller to have done
    // it, is what keeps a repeat call from stacking a second/third/Nth
    // card on top of the first instead of replacing it.
    this.shopItemsEl.innerHTML = '';
    const tier = this.nextExpansion();

    const card = document.createElement('div');
    card.className = 'expandCard';

    const current = document.createElement('div');
    current.className = 'expandCurrent';
    current.textContent = `Current floor: ${this.gridSize}×${this.gridSize}`;
    card.appendChild(current);

    if (!tier) {
      const maxed = document.createElement('div');
      maxed.className = 'expandMaxed';
      maxed.textContent = '🏆 Maximum club size reached!';
      card.appendChild(maxed);
      this.shopItemsEl.appendChild(card);
      return;
    }

    const unlocked = this.levelInfo().level >= tier.unlockLevel;
    const afford = this.cash >= tier.cost;

    const next = document.createElement('div');
    next.className = 'expandNext';
    next.textContent = `Next size: ${tier.size}×${tier.size}`;
    card.appendChild(next);

    const button = document.createElement('div');
    button.className = 'expandButton';
    button.classList.toggle('unaffordable', unlocked && !afford);
    button.classList.toggle('locked', !unlocked);
    button.textContent = unlocked ? `💰 Expand for ${tier.cost}` : `🔒 Unlocks at Lv ${tier.unlockLevel}`;
    button.addEventListener('click', () => {
      if (this.expandClub()) this.closeShop(); // successful purchase — get out of the way so the player can see the new floor
    });
    card.appendChild(button);

    this.shopItemsEl.appendChild(card);
  }

  // Keeps the active tab's "selected" highlight, "can't afford it" dim
  // state, "locked until you level up" state, and the displayed price/
  // unlock text all in sync — called whenever selection, cash, fans
  // (level), or placed props change, since any of those can affect what's
  // shown. Also keeps the always-visible "currently holding" chip current,
  // since that one has to reflect the selection even while the shop panel
  // (and thus these buttons) is closed.
  updateShopUI() {
    // The Expand tab has no prop buttons to patch — just re-render its one
    // card so its price/lock state stays current with cash/level changes
    // while it's the open tab.
    if (this.activeShopCategory === 'Expand' && this.shopItemsEl) {
      this.renderExpandCard();
    }
    if (this.shopButtons) {
      for (const key in this.shopButtons) {
        const unlocked = this.isUnlocked(key);
        const cost = this.currentCost(key);
        this.shopButtons[key].classList.toggle('selected', unlocked && key === this.selectedProp);
        this.shopButtons[key].classList.toggle('unaffordable', unlocked && this.cash < cost);
        this.shopButtons[key].classList.toggle('locked', !unlocked);
        if (this.shopCosts[key]) {
          this.shopCosts[key].textContent = unlocked
            ? `💰 ${cost}`
            : `🔒 Lv ${PROP_TYPES[key].unlockLevel || 1}`;
        }
      }
    }
    this.updateSelectedChip();
  }

  // The small pill above the shop button showing what you're about to
  // place — the shop panel itself is only open while picking, so this is
  // the only persistent reminder of the current selection.
  updateSelectedChip() {
    if (!this.selectedChip) return;
    const key = this.selectedProp;
    const def = PROP_TYPES[key];
    if (!def) {
      this.selectedChip.textContent = 'Nothing selected — open the shop to build';
      return;
    }

    const icon = document.createElement('div');
    icon.className = 'chipIcon';
    const realIcon = realSpriteIconFor(key);
    if (realIcon) {
      icon.style.backgroundImage = `url(${realIcon})`;
    } else {
      icon.style.backgroundImage = `url(${renderIsoIcon(def.color, FLOOR_DECAL_PROPS.has(key))})`;
    }

    const text = document.createElement('span');
    const unlocked = this.isUnlocked(key);
    text.innerHTML = unlocked
      ? `${def.label} <span class="chipCost">$${this.currentCost(key)}</span>`
      : `${def.label} <span class="chipCost">🔒 Lv ${def.unlockLevel || 1}</span>`;

    this.selectedChip.innerHTML = '';
    this.selectedChip.appendChild(icon);
    this.selectedChip.appendChild(text);
  }

  // A prop's price is fixed forever, baked into its own definition
  // (PROP_TYPES[type].cost) — not dynamic, not tied to how many you own,
  // not tied to your current level. A $50 dance tile is $50 whether you
  // just started or you're level 24. The progression is meant to live in
  // WHICH props exist at which unlock tier (a level-1 starter item is
  // cheap; a "cool one" unlocked later costs more because it's defined
  // that way) — not in a formula that inflates existing items over time.
  // This wrapper exists as the one place that decision lives, so future
  // per-item unlock-tier pricing has a single hook instead of scattering
  // `PROP_TYPES[type].cost` through placeProp/updateShopUI/buildShopUI.
  currentCost(type) {
    return PROP_TYPES[type].cost;
  }

  // Derives a lightweight level + progress bar from the fan count, since
  // the game doesn't track a separate XP stat. Every 100 fans is one level;
  // the remainder within the current level drives the XP bar fill.
  levelInfo() {
    const fansFloor = Math.floor(this.fans);
    const level = Math.floor(fansFloor / 100) + 1;
    const progress = fansFloor % 100;
    return { level, progress };
  }

  // Returns the texture key to use for a given prop type + facing, falling
  // back to the 0° sprite if that facing's image failed to load (e.g. the
  // other 3 rotation renders haven't been dropped in yet).
  spriteKeyFor(propType, facing) {
    const def = PROP_TYPES[propType];
    const key = def.sprites[facing];
    if (this.textures.exists(key)) return key;
    return def.sprites[0];
  }

  // True only if at least one facing's texture actually loaded. Used to
  // fall back to a plain colored box instead of Phaser's broken-image
  // placeholder if the sprites failed to load for any reason.
  hasAnySprite(propType) {
    const def = PROP_TYPES[propType];
    return FACINGS.some((f) => this.textures.exists(def.sprites[f]));
  }

  // True only if both patron animation spritesheets actually loaded —
  // same fallback reasoning as hasAnySprite() above, so a failed load
  // drops back to the plain colored-primitive patron token instead of a
  // broken-image sprite.
  hasCharacterSprites() {
    return this.textures.exists('patron_walk') && this.textures.exists('patron_dance');
  }

  drawFallbackBox(sx, sy, def) {
    const propW = FALLBACK_PROP_WIDTH;
    const propH = FALLBACK_PROP_HEIGHT;
    const box = this.add.rectangle(sx, sy - propH / 2, propW, propH, 0xff2fd0, 1)
      .setStrokeStyle(2, 0xffffff, 0.25);
    // Hidden by default — shown only while this specific prop is hovered
    // (see updateHoverFromPointer()). A floor packed with small props used
    // to have every one of their name labels visible and stacked on top of
    // each other at once; showing just the one under the cursor keeps the
    // club readable at a glance while still naming anything you point at.
    const label = this.add.text(sx, sy - propH - 10, def.label + ' (sprite missing)', {
      fontFamily: 'Arial', fontSize: '10px', color: '#ffffff',
    }).setOrigin(0.5, 1).setAlpha(0.85).setVisible(false);
    return { box, label };
  }

  // Lightens (factor > 0) or darkens (factor < 0) a 0xRRGGBB color toward
  // white/black by that fraction — cheap fake lighting so a single base
  // color per prop can still yield a bright top, mid-tone right face and
  // dark left face.
  shadeColor(color, factor) {
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    const blend = (c) => (factor >= 0
      ? Math.round(c + (255 - c) * factor)
      : Math.round(c * (1 + factor)));
    return (blend(r) << 16) | (blend(g) << 8) | blend(b);
  }

  // Draws a small pseudo-3D box for sprite-less props (bar, table): a
  // bright top cap plus a mid-tone right face and dark left face meeting
  // at the tile's front corner, so they read with real depth instead of a
  // flat 2D rectangle. A thin prop (propH <= 10, i.e. the dance floor
  // decal) skips the sides entirely and is just a flat shaded diamond
  // flush with the ground, since it has no real height to show.
  drawIsoBox(sx, sy, def, propW, propH) {
    const g = this.add.graphics();
    const hw = propW / 2;
    const hh = hw * (TILE_H / TILE_W); // keep the same 2:1 diamond ratio as a tile

    const topColor = this.shadeColor(def.color, 0.35);
    const rightColor = this.shadeColor(def.color, -0.08);
    const leftColor = this.shadeColor(def.color, -0.32);

    // The footprint diamond's four corners at ground level.
    const gTop = { x: sx, y: sy - hh };
    const gRight = { x: sx + hw, y: sy };
    const gBottom = { x: sx, y: sy + hh };
    const gLeft = { x: sx - hw, y: sy };
    // Same diamond lifted straight up by the box's height — its top cap.
    const lift = (p) => ({ x: p.x, y: p.y - propH });
    const tTop = lift(gTop), tRight = lift(gRight), tBottom = lift(gBottom), tLeft = lift(gLeft);

    if (propH <= 10) {
      g.fillStyle(topColor, 1);
      g.beginPath();
      g.moveTo(gTop.x, gTop.y);
      g.lineTo(gRight.x, gRight.y);
      g.lineTo(gBottom.x, gBottom.y);
      g.lineTo(gLeft.x, gLeft.y);
      g.closePath();
      g.fillPath();
      g.lineStyle(2, 0xffffff, 0.25);
      g.strokePath();
    } else {
      // Left face, between the left and front (bottom) ground corners.
      g.fillStyle(leftColor, 1);
      g.beginPath();
      g.moveTo(gLeft.x, gLeft.y);
      g.lineTo(gBottom.x, gBottom.y);
      g.lineTo(tBottom.x, tBottom.y);
      g.lineTo(tLeft.x, tLeft.y);
      g.closePath();
      g.fillPath();

      // Right face, between the right and front (bottom) ground corners.
      g.fillStyle(rightColor, 1);
      g.beginPath();
      g.moveTo(gRight.x, gRight.y);
      g.lineTo(gBottom.x, gBottom.y);
      g.lineTo(tBottom.x, tBottom.y);
      g.lineTo(tRight.x, tRight.y);
      g.closePath();
      g.fillPath();

      // Top cap.
      g.fillStyle(topColor, 1);
      g.beginPath();
      g.moveTo(tTop.x, tTop.y);
      g.lineTo(tRight.x, tRight.y);
      g.lineTo(tBottom.x, tBottom.y);
      g.lineTo(tLeft.x, tLeft.y);
      g.closePath();
      g.fillPath();

      // Dark outline along the visible silhouette for definition.
      g.lineStyle(2, 0x000000, 0.4);
      g.beginPath();
      g.moveTo(tLeft.x, tLeft.y);
      g.lineTo(tTop.x, tTop.y);
      g.lineTo(tRight.x, tRight.y);
      g.lineTo(gRight.x, gRight.y);
      g.lineTo(gBottom.x, gBottom.y);
      g.lineTo(gLeft.x, gLeft.y);
      g.lineTo(tLeft.x, tLeft.y);
      g.moveTo(tBottom.x, tBottom.y);
      g.lineTo(gBottom.x, gBottom.y);
      g.strokePath();
    }

    // Hidden by default — see the matching note in drawFallbackBox() above;
    // both label paths use the same hover-to-reveal behavior.
    const label = this.add.text(sx, tTop.y - 10, def.label, {
      fontFamily: 'Arial', fontSize: '10px', color: '#ffffff',
    }).setOrigin(0.5, 1).setAlpha(0.85).setVisible(false);

    return { box: g, label };
  }

  // A slowly-rotating wash of colored light cast across the floor from a
  // Disco Ball's tile — three narrow, very translucent wedges spaced evenly
  // around a full circle, spinning together as one unit. Drawn onto
  // tileLayer (below props/patrons, right on the floor) rather than a new
  // top-level layer, so it reads as light falling ON the floor instead of
  // an object that could ever visually block or sort oddly against a prop
  // or patron standing in the beam's path.
  createDiscoLightRig(sx, sy) {
    const colors = [0xff4de0, 0x4de0ff, 0xfff34d];
    const radius = TILE_W * 1.8;
    const wedgeHalfAngle = Phaser.Math.DegToRad(13);
    const container = this.add.container(sx, sy);
    colors.forEach((color, i) => {
      const wedge = this.add.graphics();
      wedge.fillStyle(color, 0.1);
      wedge.beginPath();
      wedge.moveTo(0, 0);
      wedge.arc(0, 0, radius, -wedgeHalfAngle, wedgeHalfAngle, false);
      wedge.closePath();
      wedge.fillPath();
      wedge.angle = i * (360 / colors.length); // evenly spaced around the circle
      container.add(wedge);
    });
    this.tileLayer.add(container);

    const tween = this.tweens.add({
      targets: container,
      angle: 360,
      duration: 7000,
      repeat: -1,
      ease: 'Linear',
    });

    return { container, tween };
  }

  handleRotateKey() {
    if (this.hoverTile) {
      const tileKey = `${this.hoverTile.gx},${this.hoverTile.gy}`;
      const placed = this.placed[tileKey];
      if (placed && PROP_TYPES[placed.type].rotatable) {
        this.rotatePlacedProp(tileKey);
        return;
      }
    }
    // Nothing placed/rotatable under the cursor — rotate the pending
    // facing instead, so the next prop you place comes in already turned.
    const idx = FACINGS.indexOf(this.currentFacing);
    this.currentFacing = FACINGS[(idx + 1) % FACINGS.length];
    this.updateGhost();
  }

  rotatePlacedProp(tileKey) {
    const placed = this.placed[tileKey];
    // A multi-tile prop's shared record is stored under every tile it
    // occupies; always pivot around its original anchor tile so rotating
    // from a "second" tile doesn't shift the piece.
    const [agx, agy] = placed.anchor;
    const idx = FACINGS.indexOf(placed.facing);
    const newFacing = FACINGS[(idx + 1) % FACINGS.length];
    const newTiles = this.getFootprint(placed.type, newFacing, agx, agy);

    // Free the old tiles first so the new footprint's validity check
    // doesn't see the prop's own current tiles as "occupied".
    for (const [tx, ty] of placed.tiles) delete this.placed[`${tx},${ty}`];
    if (!this.footprintValid(newTiles)) {
      // Can't rotate in place (would overlap something else or fall off
      // the grid) — put the old occupancy back and leave it as-is.
      for (const [tx, ty] of placed.tiles) this.placed[`${tx},${ty}`] = placed;
      return;
    }

    placed.facing = newFacing;
    placed.tiles = newTiles;
    for (const [tx, ty] of newTiles) this.placed[`${tx},${ty}`] = placed;

    const { sx, sy } = this.footprintCenter(newTiles);
    // The real sprite image swaps to that facing's texture. The fallback
    // box (drawFallbackBox(), used when this prop's sprites failed to load)
    // is a plain Rectangle shape with no facing-specific art and no
    // .setTexture() at all — just move it (and its label) to the new
    // footprint center instead, using the same offsets drawFallbackBox()
    // placed them at originally.
    if (typeof placed.gameObject.setTexture === 'function') {
      const texKey = this.spriteKeyFor(placed.type, placed.facing);
      placed.gameObject.setTexture(texKey);
      placed.gameObject.setPosition(sx, sy);
    } else {
      placed.gameObject.setPosition(sx, sy - FALLBACK_PROP_HEIGHT / 2);
      if (placed.label) placed.label.setPosition(sx, sy - FALLBACK_PROP_HEIGHT - 10);
    }
    this.saveGame();
  }

  // Draws a bright outline around exactly the tiles a footprint occupies,
  // on the top-most layer, so a tall sprite's artwork can never visually
  // hide (or make you doubt) which floor tiles are actually claimed.
  drawFootprintOutline(tiles, color) {
    this.footprintOutline.clear();
    this.footprintOutline.lineStyle(3, color, 1);
    for (const [tx, ty] of tiles) {
      const { sx, sy } = this.gridToScreen(tx, ty);
      this.footprintOutline.strokePoints([
        { x: sx, y: sy - TILE_H / 2 },
        { x: sx + TILE_W / 2, y: sy },
        { x: sx, y: sy + TILE_H / 2 },
        { x: sx - TILE_W / 2, y: sy },
      ], true);
    }
  }

  updateGhost() {
    if (this.ghost) {
      this.ghost.destroy();
      this.ghost = null;
    }
    this.footprintOutline.clear();
    // Un-tint whatever tiles were highlighted for the LAST hover/facing/
    // prop combo before computing the new set — the highlight always
    // tracks the current footprint exactly, nothing else touches tile fills.
    for (const t of this.highlightedTiles) t.setFillStyle(0x1b1030, 1);
    this.highlightedTiles = [];

    // With nothing to place, show the normal system cursor so the player
    // can still see where they're pointing.
    this.game.canvas.style.cursor = 'default';
    if (!this.selectedProp || !this.hoverTile) return; // deselected (see deselectProp()) — no ghost/highlight to show

    const def = PROP_TYPES[this.selectedProp];

    const { gx, gy } = this.hoverTile;
    const facing = def.rotatable ? this.currentFacing : 0;
    // This is THE ONLY place footprint tiles get computed for hover
    // feedback, and it's the exact same call placeProp() makes. The tile
    // highlight below, the ghost sprite, and the green outline all draw
    // from this one array — they cannot disagree about which tiles are
    // involved because there's only one array now.
    const tiles = this.getFootprint(this.selectedProp, facing, gx, gy);
    const valid = this.footprintValid(tiles);

    // Tint exactly the tiles this click would occupy — purple if it's a
    // legal placement, dim red if it's blocked (occupied or off-grid).
    const fillColor = valid ? 0x3a2060 : 0x5a1030;
    for (const [tx, ty] of tiles) {
      const t = this.tiles[`${tx},${ty}`];
      if (t) {
        t.setFillStyle(fillColor, 1);
        this.highlightedTiles.push(t);
      }
    }
    if (!valid) return; // occupied or off-grid — no ghost sprite, just the red tint
    if (!def.rotatable || !this.hasAnySprite(this.selectedProp)) return; // placeholder-box props have no sprite ghost

    const { sx, sy } = this.footprintCenter(tiles);
    const texKey = this.spriteKeyFor(this.selectedProp, facing);
    const img = this.add.image(sx, sy, texKey);
    img.setOrigin(def.originX, def.originY);
    img.setDisplaySize(def.displayWidth, def.displayWidth * (img.height / img.width));
    img.setAlpha(0.5);
    this.ghostLayer.add(img);
    this.ghost = img;
    // Green outline reinforces the same tiles, drawn on the highest-depth
    // graphics layer so it always shows through the booth's artwork
    // instead of being hidden behind it.
    this.drawFootprintOutline(tiles, 0x00ff88);
    // The normal system cursor stays visible here (see the 'default' set
    // at the top of this method) even with the translucent ghost booth
    // showing — hiding it used to make the pointer vanish for as long as
    // a rotatable prop (currently just the DJ Booth) stayed selected,
    // which read as the mouse being stuck/broken rather than intentional.
  }

  // Builds the actual on-screen game object(s) for a prop — real sprite,
  // sprite-failed-to-load fallback box, or a plain placeholder box for
  // props with no art yet. Pulled out of placeProp() so restoreProp() (used
  // when loading a save) can create the identical visual without also
  // running placeProp's cost check, since a restored prop was already paid
  // for in a previous session.
  createPropVisual(type, facing, tiles) {
    const def = PROP_TYPES[type];
    const { sx, sy } = this.footprintCenter(tiles);

    let gameObject;
    let label;
    if (def.rotatable && this.hasAnySprite(type)) {
      const texKey = this.spriteKeyFor(type, facing);
      const img = this.add.image(sx, sy, texKey);
      img.setOrigin(def.originX, def.originY);
      img.setDisplaySize(def.displayWidth, def.displayWidth * (img.height / img.width));
      this.propLayer.add(img);
      gameObject = img;
    } else if (def.rotatable) {
      // sprites failed to load — fall back to a labeled box rather than
      // Phaser's broken-image placeholder
      const result = this.drawFallbackBox(sx, sy, def);
      this.propLayer.add(result.box);
      this.propLayer.add(result.label);
      gameObject = result.box;
      label = result.label;
    } else {
      const propW = TILE_W * 0.7;
      const propH = FLOOR_DECAL_PROPS.has(def.key) ? 8 * PROP_SCALE : 40 * PROP_SCALE;
      const result = this.drawIsoBox(sx, sy, def, propW, propH);
      this.propLayer.add(result.box);
      this.propLayer.add(result.label);
      gameObject = result.box;
      label = result.label;
    }

    if (def.glow) {
      // Neon/disco decorations (neonFloor, discoBall, neonSign) breathe
      // gently instead of sitting as one flat static color — a cheap way to
      // make the club feel alive without needing real animated art for
      // them. Each instance's duration is jittered a bit so a row of them
      // doesn't all pulse in perfect lockstep.
      this.tweens.add({
        targets: gameObject,
        alpha: 0.55 + Math.random() * 0.1,
        duration: 900 + Math.random() * 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    let lightRig;
    if (def.lightRig) {
      lightRig = this.createDiscoLightRig(sx, sy);
    }

    return { gameObject, label, lightRig };
  }

  placeProp(gx, gy) {
    if (!this.selectedProp) return; // nothing selected (see deselectProp()) — an empty-handed click does nothing
    if (!this.isUnlocked(this.selectedProp)) { SFX.denied(); return; } // shouldn't normally be reachable — selectProp() already blocks this — but never place something not yet unlocked
    const def = PROP_TYPES[this.selectedProp];
    const cost = this.currentCost(this.selectedProp); // fixed price for this item — see currentCost()
    if (this.cash < cost) { SFX.denied(); return; }

    const tiles = this.getFootprint(this.selectedProp, this.currentFacing, gx, gy);
    if (!this.footprintValid(tiles)) { SFX.denied(); return; } // occupied or off-grid

    this.cash -= cost;
    const facing = def.rotatable ? this.currentFacing : 0;
    const { gameObject, label, lightRig } = this.createPropVisual(this.selectedProp, facing, tiles);

    const record = {
      type: this.selectedProp,
      facing,
      gameObject,
      label,
      lightRig,
      tiles,
      anchor: [gx, gy],
    };
    for (const [tx, ty] of tiles) {
      this.placed[`${tx},${ty}`] = record;
    }

    SFX.place();
    this.updateGhost();
    this.updateUI();
    this.saveGame();
  }

  // Right-clicking a placed prop sells it back for a fraction of its fixed
  // price — enough that rearranging your club isn't a total loss, but not
  // full price, so buy-then-sell isn't a way to print money.
  sellProp(gx, gy) {
    const key = `${gx},${gy}`;
    const placed = this.placed[key];
    if (!placed) return; // nothing here to sell

    const refund = Math.round(PROP_TYPES[placed.type].cost * SELL_REFUND_RATIO);
    this.cash += refund;

    // The record is stored under every tile a multi-tile prop occupies —
    // free all of them, not just the tile that was clicked.
    for (const [tx, ty] of placed.tiles) delete this.placed[`${tx},${ty}`];
    placed.gameObject.destroy();
    if (placed.label) {
      // Selling the one prop whose label is currently shown (the player was
      // hovering it to right-click-sell it) would otherwise leave a
      // destroyed object referenced as "currently shown" — clear it so a
      // later hover doesn't try to hide an already-destroyed label.
      if (this.hoveredPropLabel === placed.label) this.hoveredPropLabel = null;
      placed.label.destroy();
    }
    if (placed.lightRig) {
      // Stop the rotation tween before destroying its target — otherwise
      // the tween keeps a dead reference around until it next ticks.
      placed.lightRig.tween.remove();
      placed.lightRig.container.destroy();
    }

    SFX.sell();
    this.updateGhost(); // the hover tint/ghost may be stale now that this tile is free
    this.updateUI();
    this.saveGame();
  }

  // Recreates one prop from a save entry — same visual as placeProp() but
  // skips the cost check (already paid for in the saved session). Silently
  // drops a prop that no longer fits (e.g. a hand-edited or corrupted save
  // claims a tile that's somehow already taken) rather than throwing and
  // aborting the rest of the load.
  restoreProp(type, facing, anchor) {
    const tiles = this.getFootprint(type, facing, anchor[0], anchor[1]);
    if (!this.footprintValid(tiles)) {
      console.warn('[Club Nova] skipped restoring a saved prop that no longer fits:', type, anchor);
      return;
    }
    const { gameObject, label, lightRig } = this.createPropVisual(type, facing, tiles);
    const record = { type, facing, gameObject, label, lightRig, tiles, anchor };
    for (const [tx, ty] of tiles) {
      this.placed[`${tx},${ty}`] = record;
    }
  }

  // Number of distinct placed props, deduped by record identity so a
  // multi-tile prop (the 2-tile DJ booth) counts once, not once per tile —
  // same dedup pattern as the fan-rate timer in create().
  placedCount() {
    const counted = new Set();
    for (const key in this.placed) counted.add(this.placed[key]);
    return counted.size;
  }

  // ---------------------------------------------------------------------
  // Save / load. Patrons are deliberately NOT saved — they're transient
  // visitors, not part of the club's persistent state, so a reload just
  // starts with an empty floor that fills back up as new patrons spawn.
  // ---------------------------------------------------------------------

  // Builds the plain-object save shape: cash, fans, and one entry per
  // distinct placed prop (deduped the same way placedCount() dedupes a
  // multi-tile prop's record, which is stored once per occupied tile).
  serializeState() {
    const seen = new Set();
    const placedList = [];
    for (const key in this.placed) {
      const rec = this.placed[key];
      if (seen.has(rec)) continue;
      seen.add(rec);
      placedList.push({ type: rec.type, facing: rec.facing, anchor: rec.anchor });
    }
    return { cash: this.cash, fans: this.fans, gridSize: this.gridSize, placed: placedList };
  }

  saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.serializeState()));
    } catch (e) {
      // Private-browsing quota errors, storage disabled, etc. — saving is
      // best-effort and should never break gameplay if it fails.
      console.error('[Club Nova] save failed:', e);
    }
  }

  loadGame() {
    let raw;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch (e) {
      console.error('[Club Nova] could not read save:', e);
      return;
    }
    if (!raw) return; // first time playing, or storage was cleared

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error('[Club Nova] save data was corrupted, starting fresh:', e);
      return;
    }

    if (typeof data.cash === 'number') this.cash = data.cash;
    if (typeof data.fans === 'number') this.fans = data.fans;
    // Already set once, before the tile grid was built, by
    // peekSavedGridSize() in create() — re-applying it here is just
    // defensive (e.g. if this.gridSize somehow got out of sync) and never
    // shrinks it, since a corrupt/missing value just leaves it as-is.
    if (typeof data.gridSize === 'number' && data.gridSize > this.gridSize) this.gridSize = data.gridSize;
    if (Array.isArray(data.placed)) {
      for (const entry of data.placed) {
        if (!entry || !PROP_TYPES[entry.type] || !Array.isArray(entry.anchor)) continue;
        this.restoreProp(entry.type, entry.facing, entry.anchor);
      }
    }
  }

  // ---------------------------------------------------------------------
  // Patron system
  // ---------------------------------------------------------------------

  scheduleNextPatronSpawn() {
    this.time.delayedCall(randRange(...PATRON_SPAWN_INTERVAL), () => {
      this.trySpawnPatron();
      this.scheduleNextPatronSpawn();
    });
  }

  // True if any current (non-departing) patron already occupies this tile
  // — checked before both spawning and choosing a wander destination so
  // two patrons never target the same tile.
  patronTileOccupied(gx, gy) {
    return this.patrons.some((p) => !p.leaving && p.gx === gx && p.gy === gy);
  }

  // Sums every placed prop's fanRate (dance tiles, DJ booth, neon floor —
  // anything with one), deduped by record identity so a multi-tile prop
  // only counts once. Used by the once-a-second passive growth timer.
  // (There's deliberately no offline-progress catch-up in loadGame() — see
  // the test/comment near "no offline progress" in the save/load tests —
  // fans only grow while the game is actually open and running.)
  totalFanRate() {
    let rate = 0;
    const counted = new Set();
    for (const key in this.placed) {
      const p = this.placed[key];
      if (counted.has(p)) continue;
      counted.add(p);
      const def = PROP_TYPES[p.type];
      if (def.fanRate) rate += def.fanRate;
    }
    return rate;
  }

  // How many patrons the club can currently hold: a small base draw plus
  // each placed FLOOR's capacity contribution. Capacity is strictly a
  // flooring thing, not a furniture thing — a Bar, DJ Booth, Table, VIP
  // Lounge, or Disco Ball makes the club more fun/profitable (fan rate,
  // better tips) but doesn't let it hold more people; only actual floor
  // space (the Floors category — dance tiles, neon floor, and eventually
  // expanding the club's physical size) does that. Gating on `category`
  // here rather than trusting every item's own `capacity` field to be
  // zeroed correctly means a future non-Floors item can't accidentally
  // grant capacity just by having that field set. Deduped by record
  // identity so a multi-tile prop (the DJ booth) only counts once — same
  // dedup pattern as placedCount() and the fan-rate timer.
  patronCapacity() {
    let capacity = PATRON_BASE_CAPACITY;
    const counted = new Set();
    for (const key in this.placed) {
      const rec = this.placed[key];
      if (counted.has(rec)) continue;
      counted.add(rec);
      const def = PROP_TYPES[rec.type];
      if (def.category === 'Floors') capacity += def.capacity || 0;
    }
    return Math.min(capacity, PATRON_ABSOLUTE_MAX);
  }

  trySpawnPatron() {
    if (this.patrons.length >= this.patronCapacity()) return;
    const { gx, gy } = PATRON_SPAWN_TILE;
    if (this.isBlockingProp(gx, gy)) return; // door tile has a blocking prop on it — skip this attempt
    if (this.patronTileOccupied(gx, gy)) return; // someone's already standing right there

    const { sx, sy } = this.gridToScreen(gx, gy);
    // Small per-patron size variety (+/-15%) so bodies don't all read as
    // identical cutouts. Stored on the patron (not just baked into the
    // container's scale) because faceTowardScreenX() below has to re-apply
    // it every time it flips the container to face left/right.
    const scaleVariance = 0.9 + Math.random() * 0.25;
    const container = this.drawPatronSprite(sx, sy, scaleVariance);
    this.patronLayer.add(container);

    const now = this.time.now;
    const patron = {
      gx, gy,
      container,
      scaleVariance,
      spawnedAt: now,
      despawnAt: now + randRange(...PATRON_LIFETIME),
      nextMoveAt: now + randRange(...PATRON_MOVE_INTERVAL),
      nextTipAt: now + randRange(...PATRON_TIP_INTERVAL),
      moving: false,
      leaving: false,
    };
    this.patrons.push(patron);
    this.updateUI(); // refresh the patrons-on-floor readout right away, not on the next tip/tick

    // Small idle bob so a patron standing still doesn't read as frozen —
    // only for the fallback primitive token. The real character sprite
    // already has its own walk/dance/idle motion, and bobbing its
    // container would fight with the precise floor-contact anchor the
    // sprite's origin gives us for no benefit.
    if (!this.hasCharacterSprites()) {
      this.tweens.add({
        targets: container,
        y: container.y - 4 * PROP_SCALE,
        duration: 500 + Math.random() * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  // Real character sprite (see character_sprites_data.js / the Character
  // Art Pipeline doc) — a drop shadow plus one animated sprite. The sprite
  // uses the walk clip's own calibrated floor-contact origin (originX/Y),
  // so its feet land exactly on the tile's screen point with no manual
  // offset needed — unlike the fallback token below, which needs
  // PATRON_Y_OFFSET as a hand-tuned fudge factor. Starts in the 'idle'
  // state (see setPatronAnimation()); the first wander move kicks off
  // walking.
  drawPatronCharacterSprite(sx, sy, scaleVariance) {
    const container = this.add.container(sx, sy);
    const shadow = this.add.ellipse(0, 2 * PROP_SCALE, 22 * PROP_SCALE, 9 * PROP_SCALE, 0x000000, 0.35);
    const info = CHARACTER_ANIM_INFO.walk;
    const sprite = this.add.sprite(0, 0, 'patron_walk', 0);
    sprite.setOrigin(info.originX, info.originY);
    sprite.setScale(CHARACTER_DISPLAY_HEIGHT / info.frameHeight);
    container.add([shadow, sprite]);
    container.setScale(scaleVariance);
    container.patronSprite = sprite;
    container.patronAnimState = 'idle';
    return container;
  }

  // Switches a patron's character sprite between its three visual states:
  // 'walk' (wandering between tiles), 'dance' (parked on a dance-floor
  // tile), and 'idle' (parked anywhere else) — a no-op for the fallback
  // primitive token, which has no patronSprite. Guards on the state
  // actually changing so this can be called every tick without
  // restarting an already-playing animation.
  setPatronAnimation(patron, state) {
    const container = patron.container;
    const sprite = container.patronSprite;
    if (!sprite || container.patronAnimState === state) return;
    container.patronAnimState = state;
    if (state === 'idle') {
      const info = CHARACTER_ANIM_INFO.walk;
      if (sprite.texture.key !== 'patron_walk') sprite.setTexture('patron_walk');
      sprite.setOrigin(info.originX, info.originY);
      sprite.anims.stop();
      sprite.setFrame(0);
      return;
    }
    const info = CHARACTER_ANIM_INFO[state];
    sprite.setTexture(`patron_${state}`);
    sprite.setOrigin(info.originX, info.originY);
    sprite.play(`patron-${state}`);
  }

  // True if the given tile has one of the actual dance-floor prop types on
  // it (same set used to render flat ground decals) — plain empty floor or
  // furniture tiles don't count, only the tiles meant for dancing.
  isDanceFloorTile(gx, gy) {
    const rec = this.placed[`${gx},${gy}`];
    return !!rec && FLOOR_DECAL_PROPS.has(rec.type);
  }

  // Picks the real character sprite when it loaded, else the old
  // colored-primitive token.
  drawPatronSprite(sx, sy, scaleVariance) {
    if (this.hasCharacterSprites()) {
      return this.drawPatronCharacterSprite(sx, sy, scaleVariance);
    }
    return this.drawPatronFallbackToken(sx, sy, scaleVariance);
  }

  // Builds one patron's on-screen body: a drop shadow, an oval torso (the
  // outfit), a round head (the skin tone), and optionally a hair shape on
  // top — all simple primitives, same stand-in approach as the colored-box
  // props, but each patron rolls its own skin/outfit/hair independently so
  // a full floor reads as a crowd rather than repeating color-coded tokens.
  // The face dot is the only asymmetric detail on this token — everything
  // else is left/right symmetric, so it's what actually reads as a facing
  // direction once the container gets horizontally flipped in
  // movePatronRandomly() (via faceTowardScreenX(), which also re-applies
  // scaleVariance so a flip doesn't undo this patron's size roll).
  // Used only as a fallback when the real character sprites (see
  // drawPatronCharacterSprite()) failed to load.
  drawPatronFallbackToken(sx, sy, scaleVariance) {
    const skin = Phaser.Utils.Array.GetRandom(PATRON_SKIN_TONES);
    const outfit = Phaser.Utils.Array.GetRandom(PATRON_OUTFIT_COLORS);
    const hairStyle = Phaser.Utils.Array.GetRandom(HAIR_STYLES);
    const hairColor = Phaser.Utils.Array.GetRandom(PATRON_HAIR_COLORS);

    const container = this.add.container(sx, sy - PATRON_Y_OFFSET);
    const shadow = this.add.ellipse(0, 9 * PROP_SCALE, 22 * PROP_SCALE, 9 * PROP_SCALE, 0x000000, 0.35);
    const body = this.add.ellipse(0, 0, 16 * PROP_SCALE, 20 * PROP_SCALE, outfit, 1).setStrokeStyle(1.5, 0x0a0612, 0.9);
    const head = this.add.ellipse(0, -14 * PROP_SCALE, 12 * PROP_SCALE, 12 * PROP_SCALE, skin, 1).setStrokeStyle(1.5, 0x0a0612, 0.9);
    const face = this.add.ellipse(4 * PROP_SCALE, -14 * PROP_SCALE, 4 * PROP_SCALE, 4 * PROP_SCALE, 0xffffff, 0.9);
    container.add([shadow, body, head, face]);
    if (hairStyle !== 'none') {
      container.add(this.drawPatronHair(hairStyle, hairColor));
    }
    container.setScale(scaleVariance);
    return container;
  }

  // One of a few simple hair silhouettes sitting just above the head
  // ellipse, built from the same primitives as the rest of the token (no
  // new art assets) so a bald result and a full head of hair cost the same.
  drawPatronHair(style, color) {
    const headTop = -14 * PROP_SCALE;
    if (style === 'short') {
      return this.add.ellipse(0, headTop - 4 * PROP_SCALE, 12 * PROP_SCALE, 7 * PROP_SCALE, color, 1);
    }
    if (style === 'tall') {
      return this.add.ellipse(0, headTop - 7 * PROP_SCALE, 10 * PROP_SCALE, 11 * PROP_SCALE, color, 1);
    }
    // 'long' — hair that spills out past the sides of the head.
    return this.add.ellipse(0, headTop - 2 * PROP_SCALE, 16 * PROP_SCALE, 9 * PROP_SCALE, color, 1);
  }

  // Runs every 400ms for every active patron: advance departures, pick a
  // new wander step when it's time, and collect tips on schedule.
  tickPatrons() {
    const now = this.time.now;
    for (let i = this.patrons.length - 1; i >= 0; i--) {
      const patron = this.patrons[i];
      if (patron.leaving) {
        // Normal progress toward the door is chained directly through
        // movePatronRandomly()'s own onComplete, not this tick — this only
        // catches a departure that got boxed in for a moment and needs a
        // retry (see the options.length === 0 branch there).
        if (!patron.moving && now >= patron.nextMoveAt) this.movePatronRandomly(patron);
        continue;
      }

      if (now >= patron.despawnAt) {
        this.startPatronDeparture(patron);
        continue;
      }
      if (!patron.moving && now >= patron.nextMoveAt) {
        this.movePatronRandomly(patron);
      }
      if (now >= patron.nextTipAt) {
        this.collectPatronTip(patron);
        patron.nextTipAt = now + randRange(...PATRON_TIP_INTERVAL);
      }
    }
  }

  // Isometric movement never has a purely "up" or "down" screen direction
  // — every one of the 4 grid-neighbor moves has a nonzero horizontal
  // screen component (see gridToScreen's math) — so left/right is the one
  // cheap, always-meaningful cue: flip the container horizontally to face
  // whichever way its screen x is actually headed. targetScreenX is
  // compared against the container's CURRENT x, i.e. before this move's
  // tween starts moving it.
  faceTowardScreenX(patron, targetScreenX) {
    const facingRight = targetScreenX >= patron.container.x;
    patron.container.scaleX = (facingRight ? 1 : -1) * patron.scaleVariance;
  }

  // Picks a far-off open (prop-free) tile anywhere on the current grid for
  // the patron to roam toward. Tries a handful of random samples first
  // (cheap, and biased toward "somewhere else on the floor" since the grid
  // is mostly open); falls back to scanning every tile if the grid is
  // dense with props, and finally just stays put if genuinely nothing else
  // is open.
  // True only for props that physically block a tile — a bar counter, a
  // table, the DJ booth. Floor decals (dance tiles, neon floor) are placed
  // records too but are meant to be walked on, not around, so they don't
  // count as blocking.
  isBlockingProp(gx, gy) {
    const rec = this.placed[`${gx},${gy}`];
    if (!rec) return false;
    return !FLOOR_DECAL_PROPS.has(rec.type);
  }

  // Finds a walkable tile actually worth heading toward: right on a dance
  // floor tile if the club has one, or the open tile next to a bar/booth so
  // a patron can hang out by it (which also happens to be where tips pay
  // best — see isNearRevenueProp()). Returns null if nothing like that is
  // placed yet, so callers can fall back to plain wandering.
  pickPointOfInterestTile() {
    const danceTiles = [];
    const hangoutTiles = [];
    // Walk this.placed by KEY (one entry per occupied grid tile) rather
    // than deduping by record identity — every key already names one real
    // tile, which is exactly the granularity a dance-floor or bar/booth
    // neighbor search needs, and it works whether or not a record carries
    // its own .tiles list (test fixtures often don't).
    for (const key in this.placed) {
      const rec = this.placed[key];
      const def = PROP_TYPES[rec.type];
      if (!def) continue;
      const [tx, ty] = key.split(',').map(Number);
      if (FLOOR_DECAL_PROPS.has(rec.type)) {
        danceTiles.push([tx, ty]);
      } else if (def.category === 'Bars' || def.category === 'Booths') {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = tx + dx;
          const ny = ty + dy;
          if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize && !this.isBlockingProp(nx, ny)) {
            hangoutTiles.push([nx, ny]);
          }
        }
      }
    }
    // Dance floors are the main draw when there's one on the floor; bar/
    // booth-adjacent spots are the fallback attraction; ties go random.
    if (danceTiles.length > 0 && Math.random() < 0.55) return Phaser.Utils.Array.GetRandom(danceTiles);
    if (hangoutTiles.length > 0) return Phaser.Utils.Array.GetRandom(hangoutTiles);
    if (danceTiles.length > 0) return Phaser.Utils.Array.GetRandom(danceTiles);
    return null;
  }

  // Gives a patron somewhere purposeful to walk to, rather than any random
  // spot on the floor: most of the time a real point of interest (dance
  // floor, bar/booth hangout spot — see pickPointOfInterestTile()), so the
  // crowd visibly gathers around the club's attractions instead of just
  // drifting; the rest of the time (or once nothing new is worth visiting)
  // a plain open tile so patrons still spread out across the whole floor.
  pickRoamTarget(patron) {
    const poi = this.pickPointOfInterestTile();
    if (poi && Math.random() < 0.7) {
      [patron.targetGx, patron.targetGy] = poi;
      return;
    }
    for (let i = 0; i < 12; i++) {
      const tx = Phaser.Math.Between(0, this.gridSize - 1);
      const ty = Phaser.Math.Between(0, this.gridSize - 1);
      if (!this.isBlockingProp(tx, ty)) {
        patron.targetGx = tx;
        patron.targetGy = ty;
        return;
      }
    }
    const open = [];
    for (let gx = 0; gx < this.gridSize; gx++) {
      for (let gy = 0; gy < this.gridSize; gy++) {
        if (!this.isBlockingProp(gx, gy)) open.push([gx, gy]);
      }
    }
    if (open.length > 0) {
      const [tx, ty] = Phaser.Utils.Array.GetRandom(open);
      patron.targetGx = tx;
      patron.targetGy = ty;
    } else if (poi) {
      [patron.targetGx, patron.targetGy] = poi;
    } else {
      patron.targetGx = patron.gx;
      patron.targetGy = patron.gy;
    }
  }

  // Picks an open neighboring tile (on-grid, no prop, no other patron
  // already headed there) and tweens the patron to it. Rather than a pure
  // random walk (which statistically keeps a patron clustered near its
  // spawn point — displacement only grows as sqrt(steps)), each patron
  // roams toward a standing target tile picked with pickRoamTarget(),
  // greedily choosing whichever legal neighbor cuts the Manhattan distance
  // to that target the most, re-targeting once it arrives. The target
  // tile is claimed on patron.gx/gy the moment the tween STARTS, not when
  // it finishes, so a second patron's move check the same tick can't also
  // pick it.
  movePatronRandomly(patron) {
    // A hop is already animating this patron's container — never start a
    // second tween on top of it. Every legitimate chaining call already
    // sets patron.moving = false as the first thing its tween's onComplete
    // does, before calling back in here, so this only ever actually blocks
    // a call while a hop is genuinely still in flight (e.g. a patron's
    // lifetime expiring mid-hop used to fire this via
    // startPatronDeparture() while the previous hop's tween hadn't finished
    // yet, stacking two competing tweens on the same container's x/y).
    if (patron.moving) return;

    // A leaving patron already has its target pinned to the door by
    // startPatronDeparture() — never let this pick it a fresh roam target
    // instead, or it would wander off rather than actually heading out.
    if (!patron.leaving && (patron.targetGx === undefined ||
        (patron.gx === patron.targetGx && patron.gy === patron.targetGy))) {
      this.pickRoamTarget(patron);
    }

    // Someone else already parked on this patron's target tile — a popular
    // single hangout spot (the one tile next to the club's only bar, say)
    // can easily draw more than one patron's pick at once. Without this,
    // the patron would greedily close the distance down to 1 tile away and
    // then just sit there forever: "arrived" only fires on the exact target
    // tile, which is now permanently unreachable, so pickRoamTarget() would
    // never run again. Re-target (a few tries, in case the fresh pick is
    // ALSO occupied) instead of camping next to someone else's spot.
    if (!patron.leaving && patron.targetGx !== undefined &&
        !(patron.gx === patron.targetGx && patron.gy === patron.targetGy)) {
      let guard = 0;
      while (this.patronTileOccupied(patron.targetGx, patron.targetGy) && guard < 5) {
        this.pickRoamTarget(patron);
        guard++;
      }
    }

    const options = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dy]) => [patron.gx + dx, patron.gy + dy])
      .filter(([tx, ty]) => (
        tx >= 0 && tx < this.gridSize && ty >= 0 && ty < this.gridSize &&
        !this.isBlockingProp(tx, ty) &&
        !this.patronTileOccupied(tx, ty)
      ));
    if (options.length === 0) {
      // Boxed in for the moment — try again shortly rather than getting
      // permanently stuck waiting on nextMoveAt from before.
      patron.nextMoveAt = this.time.now + 800;
      return;
    }

    let best = options[0];
    let bestDist = Infinity;
    const ties = [];
    for (const opt of options) {
      const dist = Math.abs(opt[0] - patron.targetGx) + Math.abs(opt[1] - patron.targetGy);
      if (dist < bestDist) {
        bestDist = dist;
        ties.length = 0;
        ties.push(opt);
      } else if (dist === bestDist) {
        ties.push(opt);
      }
    }
    best = Phaser.Utils.Array.GetRandom(ties);
    const [tx, ty] = best;
    patron.moving = true;
    patron.gx = tx;
    patron.gy = ty;
    const { sx, sy } = this.gridToScreen(tx, ty);
    this.faceTowardScreenX(patron, sx);
    this.setPatronAnimation(patron, 'walk');
    this.tweens.add({
      targets: patron.container,
      x: sx,
      y: this.patronSeatY(sy, patron.container),
      duration: 650 + Math.random() * 250,
      ease: 'Linear', // constant speed so back-to-back hops below read as one
                       // continuous glide across the floor, not a series of
                       // little decelerate-then-reaccelerate steps
      onComplete: () => {
        patron.moving = false;
        const arrived = patron.gx === patron.targetGx && patron.gy === patron.targetGy;
        if (patron.leaving) {
          patron.departureHops = (patron.departureHops || 0) + 1;
          // The hop cap is a safety valve for the rare case where the exact
          // door tile stays occupied the whole time (rather than circling
          // forever waiting for it to clear, just leave from right there) —
          // NOT meant to cut off a legitimately long walk. It has to scale
          // with the club's current floor size: the longest possible walk
          // to the door is (gridSize-1)*2 hops (opposite corner, on the
          // BASE 10x10 floor that's 18), and a maxed-out expanded club
          // (18x18) needs up to 34. A fixed cap of 20 used to make patrons
          // on the far side of an expanded club simply vanish mid-walk,
          // nowhere near the door yet — a real, visible bug, not just an
          // edge case.
          const maxDepartureHops = (this.gridSize - 1) * 2 + 10;
          if (arrived || patron.departureHops > maxDepartureHops) {
            // Actually reached the door on foot — now it can vanish.
            this.finalizeDeparture(patron);
          } else {
            // Still walking out — keep chaining toward the door exactly
            // like a normal roam journey, just without ever picking a new
            // target once it arrives.
            this.movePatronRandomly(patron);
          }
          return;
        }
        if (arrived) {
          // Reached the spot it was roaming toward — stand/mingle here for a
          // bit before picking a fresh target. A genuine point of interest
          // (dancing, or parked next to a bar/DJ/etc.) earns a much longer
          // dwell than a random empty tile, so patrons visibly linger at
          // the good spots instead of drifting off on the same short timer
          // everywhere.
          const atPOI = this.isDanceFloorTile(tx, ty) || this.isNearRevenueProp(tx, ty);
          patron.nextMoveAt = this.time.now + randRange(...(atPOI ? PATRON_POI_LINGER : PATRON_MOVE_INTERVAL));
          this.setPatronAnimation(patron, this.isDanceFloorTile(tx, ty) ? 'dance' : 'idle');
          // Landed right next to an actual bar — play the "walked up and
          // ordered a drink" beat (see showDrinkOrderPopup()) once, right as
          // they arrive, rather than only ever seeing a silent "+$X" appear
          // out of nowhere sometime later on their own tip timer.
          if (this.isBarAdjacent(tx, ty)) this.showDrinkOrderPopup(patron);
        } else if (this.time.now >= patron.despawnAt) {
          // Time's up mid-journey — head for the door instead of
          // continuing to roam toward the old target.
          this.startPatronDeparture(patron);
        } else {
          // Still mid-journey toward its target — chain directly into the
          // next hop's tween right here instead of just flagging it ready
          // and waiting for tickPatrons' next 400ms pass to notice. That
          // wait was small but showed up as a visible hitch/stutter at
          // every tile boundary; calling straight through removes the gap
          // entirely so multi-tile roaming reads as one smooth walk.
          this.setPatronAnimation(patron, 'walk');
          this.movePatronRandomly(patron);
        }
      },
    });
  }

  // The real character sprite is anchored via its own calibrated origin
  // (see drawPatronCharacterSprite()), so its container sits right at the
  // tile's screen point; the fallback primitive token still needs the
  // hand-tuned PATRON_Y_OFFSET fudge factor. Movement/departure tweens
  // both target whichever one applies through this helper so neither
  // patron kind "sinks" or "floats" relative to its tile mid-animation.
  patronSeatY(sy, container) {
    return container.patronSprite ? sy : sy - PATRON_Y_OFFSET;
  }

  // True if the patron's own tile or one of its 4 neighbors has a
  // revenue-generating prop on it (the bar, or anything with a fanRate —
  // the DJ booth and dance tiles) — being near the action pays better.
  isNearRevenueProp(gx, gy) {
    const cells = [[gx, gy], [gx + 1, gy], [gx - 1, gy], [gx, gy + 1], [gx, gy - 1]];
    return cells.some(([tx, ty]) => {
      const rec = this.placed[`${tx},${ty}`];
      if (!rec) return false;
      const def = PROP_TYPES[rec.type];
      return !!(def.fanRate || def.key === 'bar');
    });
  }

  // Narrower than isNearRevenueProp() (which also counts the DJ booth and
  // dance floors) — true only next to an actual Bar/Premium Bar. Used just
  // to decide when a patron's arrival plays the "walked up and ordered a
  // drink" beat (showDrinkOrderPopup()) and when a later tip pop-up gets a
  // drink icon instead of a plain $ — doesn't affect the tip's economy math
  // at all, isNearRevenueProp() still owns that.
  isBarAdjacent(gx, gy) {
    const cells = [[gx, gy], [gx + 1, gy], [gx - 1, gy], [gx, gy + 1], [gx, gy - 1]];
    return cells.some(([tx, ty]) => {
      const rec = this.placed[`${tx},${ty}`];
      return !!rec && PROP_TYPES[rec.type].category === 'Bars';
    });
  }

  collectPatronTip(patron) {
    const nearRevenue = this.isNearRevenueProp(patron.gx, patron.gy);
    const base = 4 + Math.random() * 6; // $4-10 base tip
    const amount = Math.round(nearRevenue ? base * 2.2 : base);
    this.cash += amount;
    this.fans += nearRevenue ? 0.4 : 0.1;
    SFX.tip();
    this.updateUI();
    this.showTipPopup(patron, amount, this.isBarAdjacent(patron.gx, patron.gy));
  }

  showTipPopup(patron, amount, atBar) {
    const { x, y } = patron.container;
    // Right next to an actual bar, this doubles as "paying for the drink"
    // rather than a generic tip — a little 🍹 alongside the amount instead
    // of just the $ text sells that without changing the amount itself.
    const text = this.add.text(x, y - 24 * PROP_SCALE, atBar ? `🍹 +$${amount}` : `+$${amount}`, {
      fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: '#7dffc4',
    }).setOrigin(0.5, 1);
    this.patronLayer.add(text);
    this.tweens.add({
      targets: text,
      y: y - 46 * PROP_SCALE,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  // The moment a patron settles in right next to an actual bar (see
  // isBarAdjacent()) — a quick "🍹" the instant they arrive, separate from
  // showTipPopup()'s "+$X"/"🍹 +$X" which fires later on the patron's own
  // independent tip timer (collectPatronTip()). Together they read as
  // "walked up to the bar, ordered a drink, then paid for it" without the
  // two moments needing to be the same event under the hood.
  showDrinkOrderPopup(patron) {
    const { x, y } = patron.container;
    const icon = this.add.text(x, y - 24 * PROP_SCALE, '🍹', {
      fontSize: '16px',
    }).setOrigin(0.5, 1);
    this.patronLayer.add(icon);
    this.tweens.add({
      targets: icon,
      y: y - 44 * PROP_SCALE,
      alpha: 0,
      duration: 1100,
      delay: 250,
      ease: 'Cubic.easeOut',
      onComplete: () => icon.destroy(),
    });
  }

  // Sends a patron walking back to the door tile, on foot, tile by tile,
  // the same way it walks anywhere else on the floor — not a single
  // straight-line dash across the room. Pins its roam target to the door
  // and hands it to the normal movePatronRandomly() chain; that function's
  // onComplete checks patron.leaving and routes the final arrival to
  // finalizeDeparture() below instead of picking a fresh destination.
  startPatronDeparture(patron) {
    if (patron.leaving) return; // already on its way out
    patron.leaving = true;
    patron.targetGx = PATRON_SPAWN_TILE.gx;
    patron.targetGy = PATRON_SPAWN_TILE.gy;
    // A patron's lifetime (despawnAt) is checked on a plain wall-clock timer
    // (see tickPatrons()), completely independent of whatever hop it might
    // already be mid-animation on — so this can fire while patron.moving is
    // still true. It used to force patron.moving back to false right here
    // and immediately start walking toward the door, which stacked a SECOND
    // tween on the same container's x/y right on top of the one already
    // running — a real Phaser footgun (both tweens then fight over the
    // container's position, and the earlier one's onComplete firing later
    // could even trigger a duplicate finalizeDeparture()). Leaving
    // patron.moving untouched and only acting immediately when nothing is
    // actually in flight avoids that: if a hop IS in flight, its own
    // onComplete (which checks patron.leaving fresh every time) picks up
    // the now-correct door target the moment that hop genuinely finishes.
    if (patron.moving) return;
    if (patron.gx === patron.targetGx && patron.gy === patron.targetGy) {
      this.finalizeDeparture(patron); // already standing right on the door
      return;
    }
    this.movePatronRandomly(patron);
  }

  // The patron has actually walked to the door tile — fade it out in place
  // and drop it from the active list.
  finalizeDeparture(patron) {
    this.tweens.add({
      targets: patron.container,
      alpha: 0,
      duration: 400,
      ease: 'Sine.easeIn',
      onComplete: () => {
        patron.container.destroy();
        const idx = this.patrons.indexOf(patron);
        if (idx !== -1) this.patrons.splice(idx, 1);
        this.updateUI(); // refresh the patrons-on-floor readout right away
      },
    });
  }

  updateUI() {
    this.cashText.textContent = Math.floor(this.cash);
    this.fansText.textContent = Math.floor(this.fans);
    // Repurposed as a "patrons on the floor / capacity" readout rather than
    // a raw placed-prop count, since capacity (see patronCapacity()) is the
    // number that actually matters for how much the club can earn.
    if (this.placedText) this.placedText.textContent = `${this.patrons.length}/${this.patronCapacity()}`;

    const { level, progress } = this.levelInfo();
    if (this.levelText) this.levelText.textContent = level;
    if (this.xpBarFill) this.xpBarFill.style.width = `${progress}%`;
    // this.currentLevel starts out set (in create(), right after loadGame())
    // to whatever level the game actually opened at, so this only fires
    // for a level actually crossed during THIS play session — never once
    // on load, and never for time that passed while the game was closed.
    if (level > this.currentLevel) this.onLevelUp(level);
    this.currentLevel = level;

    this.updateShopUI();
  }

  updateMuteButton() {
    if (!this.muteButton) return;
    this.muteButton.textContent = SFX.muted ? '🔇' : '🔊';
    this.muteButton.classList.toggle('muted', SFX.muted);
  }

  // Celebrates hitting a new level: a fanfare plus a banner naming
  // anything that just became buyable at this level (see PROP_TYPES'
  // unlockLevel), since that's the actual payoff of leveling up and is
  // otherwise easy to miss — the shop icon just quietly stops being greyed
  // out.
  onLevelUp(level) {
    SFX.levelUp();
    const newlyUnlocked = Object.values(PROP_TYPES)
      .filter((def) => def.unlockLevel === level)
      .map((def) => def.label);
    const message = newlyUnlocked.length
      ? `🎉 Level ${level}! ${newlyUnlocked.join(', ')} unlocked!`
      : `🎉 Level ${level}!`;
    this.showToast(message);
  }

  // Shows a brief DOM banner (see #toast in index.html) — plain HTML/CSS,
  // not a Phaser object, so no game-canvas layer is needed for it to work.
  showToast(message, durationMs = 4000) {
    const el = document.getElementById('toast');
    if (!el) return; // older/debug HTML without the toast element — skip silently
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), durationMs);
  }
}

const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: document.body,
  backgroundColor: '#0a0612',
  disableContextMenu: true, // right-click sells a placed prop instead of opening the browser menu
  scene: [ClubScene],
};

window.addEventListener('load', () => new Phaser.Game(config));
