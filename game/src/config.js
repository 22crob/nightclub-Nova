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
export const BASE_GRID_SIZE = 12;

// Enough to open with a staffed bar, a DJ booth with a DJ, and a few dance
// tiles.
export const STARTING_CASH = 700;

// Room shell, modelled on the reference game's rooms: thick light-grey
// concrete walls with pale top caps, a raised floor slab with dark front
// edges, and a tiled sidewalk outside. Walls are 4 tile-heights tall,
// about 1.3x a patron.
export const WALL_HEIGHT = TILE_H * 4;
export const WALL_THICKNESS = 0.3; // in tiles
export const WALL_BASEBOARD = 5;
export const DOOR_HEIGHT = TILE_H * 3.3;
export const FLOOR_SLAB_DEPTH = 10; // px from the floor down to the sidewalk
export const ROOM_COLORS = {
  wallRight: 0x9a9aa3,
  wallLeft: 0x83838d,
  wallEnd: 0x6d6d77,
  baseboard: 0x4a4a52,
  corner: 0x6a6a74,
  cap: 0xdcdce2,
  capEdge: 0x8c8c96,
  slabRight: 0x2c2c33,
  slabLeft: 0x1f1f25,
  slabEdge: 0x3c3c45,
  door: 0x55565f,
  doorFrame: 0x2a2a30,
  doorWindow: 0x9fb8c9,
  doorBar: 0xb9bac2,
};
export const SIDEWALK = { color: 0xb4b5bc, grout: 0x8e8f97, margin: 7, slabTiles: 2 };

// Floor tiles: one colour with faint seams, so the floor reads as one
// surface (like Nightclub City's) rather than a grid of outlined squares.
export const FLOOR_COLOR = 0x5d5e66;
export const FLOOR_SEAM = { color: 0x4d4e56, alpha: 1 };

// Each second, the club gains this share of its props' total fanRate in
// fans. The rest of a club's fans come from patrons: drinks, tips, and how
// happy they are when they leave (see mood.js).
export const PASSIVE_FAN_SHARE = 0.25;

// Staff wages are paid on this interval (see STAFF_TYPES in catalog.js).
export const WAGE_INTERVAL_MS = 30000;
// After a drink, how long until a patron is thirsty again and heads back
// to a bar.
export const THIRST_INTERVAL = [20000, 30000];

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
export const PATRON_LIFETIME = [28000, 42000];     // ms a patron stays before heading out (the 12x12 room takes a while to cross)
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
// Matched to Nightclub City: there, a character stands about 1.5x as tall
// as a bar counter, so props and decorations read at the right size around
// them. (It was 3.25 at first, which made characters about 2.4 counters
// tall.)
export const CHARACTER_DISPLAY_HEIGHT = TILE_H * 2.1;
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

// How often animated dance floors step a frame (see animateFloors()).
export const FLOOR_TICK_MS = 125;

// Seating (see seating.js): the chance a patron picking somewhere to go
// heads for a free seat instead, and how long they stay seated (ms).
export const SEAT_CHANCE = 0.3;
export const SEAT_SIT_TIME = [14000, 24000];
