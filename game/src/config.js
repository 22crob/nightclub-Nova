// Shared tuning constants: tile geometry, grid size, patron behaviour,
// save keys. Everything here is plain data with no Phaser dependency.

// Tiles are 48x24 px (2:1 iso). They were 64x32; the grid was made finer to
// match Nightclub City, where furniture fills more, smaller tiles. Props,
// characters, walls and text kept their size on screen; only the grid got
// finer (the art pipeline renders models MODEL_SCALE bigger in tiles, see
// art/blender/iso_rig.py). Must match TILE_W there.
export const TILE_W = 48;
export const TILE_H = 24;
// Any prop/patron dimension that used to be a fixed pixel number (rather
// than a formula already built on TILE_W, like the DJ booth's displayWidth)
// gets multiplied by this instead, so the whole game shrinks/grows together
// if TILE_W is ever tuned again. 96 is the original tile width those fixed
// numbers were tuned against.
export const PROP_SCALE = 64 / 96; // fixed: sizes in pixels didn't change with the finer grid
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
export const BASE_GRID_SIZE = 10; // a small room to start, like Nightclub City's; expand to grow

// A new club opens with its DJ booth and a staffed Starter Bar already in
// place (see placeStarterLayout()); this buys the first dance floor and more.
export const STARTING_CASH = 700;

// Room shell, modelled on the reference game's rooms: thick light-grey
// concrete walls with pale top caps, a raised floor slab with dark front
// edges, and a tiled sidewalk outside. Walls are 4 tile-heights tall,
// about 1.3x a patron.
export const WALL_HEIGHT = 128; // px
export const WALL_THICKNESS = 0.4; // in tiles
export const WALL_BASEBOARD = 5;
export const DOOR_HEIGHT = 106; // px
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
};
// The street outside at night (see scene/street.js). Distances are in tiles
// out from the walls; lineStartGx is where the front of the line stands.
export const STREET = {
  sidewalk: 4.5, road: 7,
  pavement: 0x55535f, grout: 0x46444f, curb: 0x7a7884, asphalt: 0x1d1b24, laneLine: 0xc9a640,
  carpet: 0x8c1426, carpetEdge: 0xd4a53a, rope: 0xb0102a, brass: 0xd4a53a,
  lampPost: 0x2a2a33, lampGlow: 0xffd77a, lampEvery: 6,
  buildings: [0x2a2438, 0x262a3a, 0x30283a, 0x232433], windowLit: 0xf2c75c, windowDark: 0x16141e,
  lineStartGx: -1.4, lineLength: 6, startInLine: 3, bouncerCharacter: 0,
  msPerTile: 420, admitEveryMs: 1500, passerEveryMs: [3000, 8000],
};

// The floor tiles are invisible (the seamless bare floor shows through, see
// drawBareFloor()); this is only the colour they're reset to.
export const FLOOR_COLOR = 0x5d5e66;

// Each second, the club gains this share of its props' total fanRate in
// fans. The rest of a club's fans come from patrons: drinks, tips, and how
// happy they are when they leave (see mood.js).
export const PASSIVE_FAN_SHARE = 0.25;

// Staff wages are paid on this interval (see STAFF_TYPES in catalog.js).
export const WAGE_INTERVAL_MS = 30000;
// After a drink, how long until a patron is thirsty again and heads back
// to a bar.
export const THIRST_INTERVAL = [32000, 50000];

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
export const PATRON_SPAWN_TILE = { gx: 0, gy: 1 }; // the door, on the left wall like Nightclub City's: patrons walk in and out here
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
export const PATRON_POI_LINGER = [3500, 7000];
export const PATRON_DANCE_LINGER = [12000, 22000]; // ms a patron dances before moving on     // ms a patron lingers at a point of interest before wandering again
export const PATRON_TIP_INTERVAL = [3000, 5500];   // ms between a patron's tips
export const PATRON_LIFETIME = [45000, 65000];     // ms a patron stays before heading out (the 12x12 room takes a while to cross)
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
export const CHARACTER_DISPLAY_HEIGHT = 87.4; // px: big next to the furniture, like Nightclub City
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
export const SAVE_KEY = 'clubNovaSave_v2'; // v2: the finer grid (v1 saves don't fit it)

// Fraction of a prop's fixed cost refunded when you right-click to sell it
// back (see sellProp()).
export const SELL_REFUND_RATIO = 0.5;

// How often animated dance floors step a frame (see animateFloors()).
export const FLOOR_TICK_MS = 125;

// Seating (see seating.js): the chance a patron picking somewhere to go
// heads for a free seat instead, and how long they stay seated (ms).
export const SEAT_CHANCE = 0.3;

// Bars: customers queue in a straight line out from the counter, at most
// this many (the first one is ordering). DRINK_RUN_CHANCE is how often a
// patron who isn't thirsty yet still goes for a drink.
export const BAR_QUEUE_LENGTH = 4;
export const DRINK_RUN_CHANCE = 0.1;

// Drop the Bass (see boost.js): a free party boost with a cooldown. During
// it, tips and thirst run `speedUp` times faster, tips are `tipMultiplier`
// times bigger, and patrons head for the dance floor `danceChance` of the
// time.
export const BOOST = { durationMs: 90000, cooldownMs: 300000, speedUp: 2, tipMultiplier: 2, danceChance: 0.75 };

// Mood lighting (see lighting.js): how much the floor and walls are dimmed,
// and the coloured glow under lights. The owner found the glows too strong
// in spots, so they're off for now (`glows: false`).
// Club nights (see scene/nights.js): each night runs 9 PM to 3 AM in
// lengthMs of real time; the last lastCallMs are last call (no new guests).
// At closing, guests get closeWaitMs to walk out before the summary.
// Stars come from the night's average vibe: one, plus one for each of
// starVibes reached; each rating gives starFans bonus fans.
export const NIGHT = {
  lengthMs: 4 * 60 * 1000,
  lastCallMs: 35 * 1000,
  closeWaitMs: 20 * 1000,
  startHour: 21,
  hours: 6,
  closedShade: 0.25, // the room's dimming between nights (1 = full night dimming)
  starVibes: [40, 55, 70, 85],
  starFans: [0, 2, 5, 8, 12],
  verdicts: ['A quiet one.', 'Not bad.', 'Good night!', 'Great night!', 'Legendary night!'],
};
// Parties (see scene/parties.js): thrown once a night while the doors are
// open, they last the rest of it. capacity: extra guests allowed in;
// arrivals/tips/thirst/fans: multipliers (arrivals: guests come this much
// faster; thirst: they want drinks this much sooner; fans: fans from happy
// leavers). shade tints the room's mood lighting.
export const PARTIES = [
  { key: 'house', label: 'House Party', emoji: '🏠', cost: 60, unlockLevel: 1, capacity: 2, arrivals: 1.3, tips: 1.25, thirst: 1.1, fans: 1.2, shade: 0x1a0b2e,
    blurb: 'Invite the neighbours. A couple more guests and a friendly crowd.' },
  { key: 'hiphop', label: 'Hip Hop Night', emoji: '🎤', cost: 150, unlockLevel: 2, capacity: 3, arrivals: 1.5, tips: 1.4, thirst: 1.3, fans: 1.4, shade: 0x2e0b12,
    blurb: 'Big beats, bigger crowd. Guests drink more and tip better.' },
  { key: 'neon', label: 'Neon Night', emoji: '💜', cost: 300, unlockLevel: 4, capacity: 4, arrivals: 1.7, tips: 1.6, thirst: 1.4, fans: 1.7, shade: 0x2a0636,
    blurb: 'Glow sticks and neon paint. The whole town wants in.' },
  { key: 'gala', label: 'VIP Gala', emoji: '🥂', cost: 600, unlockLevel: 6, capacity: 6, arrivals: 2, tips: 2, thirst: 1.5, fans: 2, shade: 0x2e2306,
    blurb: 'Red carpet, champagne, the A-list. Huge tips and fans.' },
];
export const MOOD_LIGHTING = { color: 0x0b0418, floorAlpha: 0.3, wallAlpha: 0.2, glows: false, glowAlpha: 0.55 };
export const SEAT_SIT_TIME = [14000, 24000];
