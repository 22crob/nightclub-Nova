// Shared tuning constants: tile geometry, grid size, patron behaviour,
// save keys. Everything here is plain data with no Phaser dependency.

// Tiles (and everything sized off them) were scaled down from the original
// 96x48 — the floor was reading too large on screen. Kept at the same 2:1
// iso ratio, just smaller.
export const TILE_W = 64;   // tile width in px (matches the 2:1 iso ratio you're using in Blender, x2 for on-screen scale)
export const TILE_H = 32;
// Any prop/patron dimension that used to be a fixed pixel number (rather
// than a formula already built on TILE_W, like the DJ booth's displayWidth)
// gets multiplied by this instead, so the whole game shrinks/grows together
// if TILE_W is ever tuned again. 96 is the original tile width those fixed
// numbers were tuned against.
export const PROP_SCALE = TILE_W / 96;
// Fallback-box dimensions for a rotatable prop whose sprites failed to load
// (see drawFallbackBox()) — pulled out to a shared constant so
// rotatePlacedProp() can re-anchor that same box/label after a rotation
// without its geometry drifting out of sync with drawFallbackBox() itself.
export const FALLBACK_PROP_WIDTH = TILE_W * 0.7;
export const FALLBACK_PROP_HEIGHT = 40 * PROP_SCALE;
// The club's floor starts at BASE_GRID_SIZE x BASE_GRID_SIZE and can grow
// from there — see GRID_EXPANSIONS below and ClubScene.expandClub(). Any
// code that used to check a fixed GRID_SIZE now reads the scene's own
// this.gridSize instead, since that's a per-club value that changes at
// runtime and gets saved/restored (see serializeState()/loadGame()).
export const BASE_GRID_SIZE = 10;

// Back walls: plain painted walls, 4 tile-heights tall (about 3.3 m at the
// Blender art scale of 1 tile = 1 m), comfortably above the 2.3 m bar.
export const WALL_HEIGHT = TILE_H * 4;
export const WALL_BASEBOARD = 6;
export const WALL_COLORS = {
  right: 0x34323c,
  left: 0x29272f,
  baseboard: 0x17161b,
  topEdge: 0x4a4755,
  doorFrame: 0x4a4755,
};

// Facings are in degrees, matching the rotation applied in Blender: 0/90/180/270.
export const FACINGS = [0, 90, 180, 270];

// ---------------------------------------------------------------------
// Patron/visitor system. This is the actual gameplay loop: NPCs walk in
// at the entrance tile, wander the floor, and periodically tip — that tip
// is real cash income now, not just the old flat per-second trickle from
// having props placed. The passive fan trickle further down still runs
// as ambient "reputation from having a nice venue" growth, on top of
// this.
// ---------------------------------------------------------------------
export const PATRON_SPAWN_TILE = { gx: 0, gy: 0 }; // the "door" — patrons walk in and out here
// Capacity is no longer a flat number — an empty club still draws a
// trickle of curious visitors (PATRON_BASE_CAPACITY), and every prop you
// place adds room for more (PROP_TYPES[type].capacity), up to a hard
// ceiling so a maxed-out floor doesn't spawn an unmanageable crowd. See
// patronCapacity() below.
export const PATRON_BASE_CAPACITY = 3;
export const PATRON_ABSOLUTE_MAX = 24;
export const PATRON_SPAWN_INTERVAL = [4000, 7000]; // ms between spawn attempts
export const PATRON_MOVE_INTERVAL = [1500, 3000];  // ms a patron waits between wander steps
// A patron who's actually landed somewhere worth being — a dance floor tile,
// or a tile next to a revenue prop (bar/DJ/etc, see isNearRevenueProp()) —
// sticks around noticeably longer than one standing on a random empty tile.
// Without this, arriving at the dance floor meant nothing behaviorally: a
// patron would leave a good spot on the exact same short timer as an empty
// one, so the floor never visibly had anyone actually "hanging out"
// anywhere in particular. Real base-game behavior fix, not a visual one.
export const PATRON_POI_LINGER = [3500, 7000];     // ms a patron lingers at a point of interest before wandering again
export const PATRON_TIP_INTERVAL = [3000, 5500];   // ms between a patron's tips
export const PATRON_LIFETIME = [14000, 22000];     // ms a patron stays before heading out
// Each patron token gets its own skin tone, outfit color, and hair (color +
// style, or none at all) picked independently at spawn — see
// drawPatronSprite() — so a full floor reads as a crowd of individuals
// instead of the same handful of color-coded blobs repeating.
export const PATRON_SKIN_TONES = [0xffd9b3, 0xf0b088, 0xc98a5c, 0x9c6b43, 0x6e4a30, 0x4a3120];
export const PATRON_OUTFIT_COLORS = [0xff6fae, 0x6fd1ff, 0xffe36f, 0x8affc1, 0xd68aff, 0xff9f6f, 0xff4d4d, 0x4d79ff];
export const PATRON_HAIR_COLORS = [0x1a1a1a, 0x3b2414, 0x6b4423, 0xd6b370, 0xb33939, 0x2d2d6b, 0xe0e0e0];
// 'none' skips the hair shape entirely (bald/shaved); everyone else gets one
// of these simple silhouettes — see drawPatronHair().
export const HAIR_STYLES = ['none', 'short', 'tall', 'long'];
// A patron token's own vertical seat: how far above its tile's screen point
// its container sits (see drawPatronSprite()) — scaled with PROP_SCALE like
// every other fixed-pixel size, and pulled into a shared constant since the
// movement/departure tweens below also target this same offset to keep a
// patron from "sinking" back to the raw tile point mid-walk.
export const PATRON_Y_OFFSET = 6 * PROP_SCALE;
// Standing height of the real character sprite on screen, in pixels — a
// design choice (not derived from anything else), picked so patrons read
// clearly as people without dwarfing the tiles. Roughly 2 tile-heights
// tall. The character sprite's own displayHeight is set to this constant
// directly; its width follows proportionally since Phaser scales
// uniformly. Tune this one number to make patrons bigger/smaller overall.
// Set to 3 tile-heights to match Nightclub City's chunky characters: the
// back walls (WALL_HEIGHT) come out about 1.3x a patron's height, and a bar
// counter reaches about waist height.
export const CHARACTER_DISPLAY_HEIGHT = TILE_H * 3;
// How far above a patron's feet their tip / drink popups start.
export const PATRON_POPUP_Y = CHARACTER_DISPLAY_HEIGHT * 0.8;

// Camera zoom: the club starts zoomed in, and the mouse wheel or the +/-
// buttons zoom between these limits.
export const ZOOM_DEFAULT = 1.35;
export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 2.2;


// localStorage key for the save file. Bumping this (v1 -> v2) is the
// escape hatch if the save shape ever changes incompatibly — old saves
// under the old key are just ignored rather than crashing on load.
export const SAVE_KEY = 'clubNovaSave_v1';

// Fraction of a prop's fixed cost refunded when you right-click to sell it
// back (see sellProp()).
export const SELL_REFUND_RATIO = 0.5;
