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
// The club's floor starts at BASE_GRID_SIZE x BASE_GRID_SIZE and grows a
// row at a time (EXPANSION in catalog.js, expandClub() in world.js) into
// this.gridW x this.gridH, saved with the club.
export const BASE_GRID_SIZE = 10; // a small room to start, like Nightclub City's; expand to grow

// A new club opens with its DJ booth and a staffed Starter Bar already in
// place (see placeStarterLayout()); this buys the first dance floor and more.
export const STARTING_CASH = 700;

// Room shell, modelled on the reference game's rooms: thick light-grey
// concrete walls with pale top caps, a raised floor slab with dark front
// edges, and a tiled sidewalk outside. Walls are about 1.3x a patron.
export const WALL_HEIGHT = 104; // px: about 1.3 guests tall, like Nightclub City (was 128, which felt too tall)
export const WALL_THICKNESS = 0.4; // in tiles
export const WALL_BASEBOARD = 5;
export const DOOR_HEIGHT = 90; // px: a little taller than a guest
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
// out from the walls. The line stands lineOut tiles out from the left wall,
// from the door toward the front, where the wall hides about the bottom half
// of each person (like Nightclub City's line).
// Live aquariums (tankFx.js): for each tank, its water as a box in the
// model's own units (as in art/blender/decor_batch2.py, front glass at y0),
// how many fish swim in it and their colours, and bubbles in a few streams.
export const TANKS = {
  cabinet: {
    water: { x0: -0.66, x1: 0.66, y0: -0.2, y1: -0.02, z0: 0.56, z1: 1.18 },
    swim: [0.7, 1.02], // the heights fish keep to, clear of the gravel and the lid
    fish: 5, fishScale: 0.8, colors: [0xff8a1f, 0xffe03a, 0xff4a8a, 0x5af0ff], bubbles: 6, streams: 2,
  },
};

export const STREET = {
  sidewalk: 4.5, road: 7,
  pavement: 0x55535f, grout: 0x46444f, curb: 0x7a7884, asphalt: 0x1d1b24, laneLine: 0xc9a640,
  carpet: 0x8c1426, carpetEdge: 0xd4a53a, rope: 0xb0102a, brass: 0xd4a53a,
  lampPost: 0x2a2a33, lampGlow: 0xffd77a, lampEvery: 6,
  buildings: [0x2a2438, 0x262a3a, 0x30283a, 0x232433], windowLit: 0xf2c75c, windowDark: 0x16141e,
  lineOut: 3.1, lineLength: 6, startInLine: 3, bouncerCharacter: 4,
  msPerTile: 420, admitEveryMs: 1500, partyAdmitMs: 3000, passerEveryMs: [700, 1800],
  // A livelier street: some passers-by walk in twos and threes, and small
  // groups stand chatting on the sidewalk, breaking up now and then.
  // The buildings along each back road, in order (art/blender/build_buildings.py).
  buildingRow: ['hotel', 'cocktail', 'walkup', 'noodles', 'karaoke', 'walkupDark', 'liquor', 'diner', 'tattoo', 'laundromat'],
  groupChance: 0.35, hangouts: 3, hangoutMs: [25000, 50000],
  // Strings of bulbs across the back roads (drawStringLights()): ends every
  // `every` tiles, hung `height` px up the buildings, sagging `sag` px, a
  // bulb every `spacing` tiles.
  stringLights: { every: 3, height: 150, sag: 26, spacing: 0.75, wire: 0x15131b, bulb: 0xfff1c2, glow: 0xffc96a },
};

// The floor tiles are invisible (the seamless bare floor shows through, see
// drawBareFloor()); this is only the colour they're reset to.
export const FLOOR_COLOR = 0x5d5e66;

// Each second, the club gains this share of its props' total fanRate in
// fans. The rest of a club's fans come from patrons: drinks, tips, and how
// happy they are when they leave (see mood.js).
export const PASSIVE_FAN_SHARE = 0.05; // small: fans (XP) come mostly from guests (see XP)

// Staff wages are paid on this interval (see STAFF_TYPES in catalog.js).
export const WAGE_INTERVAL_MS = 30000;
// After a drink, how long until a patron is thirsty again and heads back
// to a bar.
export const THIRST_INTERVAL = [60000, 110000];

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
// How many guests fit (see patronCapacity() in popularity.js): `base`, plus
// perRootPopularity x the square root of the club's popularity (8 at 0, 13 at
// 25, 18 at 100, 28 at 400), but never more than one per tilesPerGuest floor
// tiles (20 in the first 10x10 room), so a bigger room still matters later,
// and never more than `max` (a crowd that size is plenty, and phones cope).
// Balance-checked with a simulated club (October 2026).
export const CAPACITY = { base: 8, perRootPopularity: 1.0, tilesPerGuest: 5, max: 80 };
// Popularity (see popularity.js): the club's reputation. Each guest's visit
// moves it: leaving happy (mood 70+) +happy, content (40+) +content, unhappy
// +unhappy, storming out +stormOut. It sets how many guests fit
// (CAPACITY) and brings guests faster: arrivalPer faster per point, up to
// arrivalMax (so 1.6x at 400).
export const POPULARITY = { happy: 3, content: 1, unhappy: -1, stormOut: -5, arrivalPer: 0.0015, arrivalMax: 0.6 };
// Fans needed for each level (fans are the game's XP). Level L needs
// first + step*(L-1) + curve*(L-1)^2 more to reach the next one, so each
// level takes longer: 120 for level 2 (a few minutes), level 5 at 1,512,
// level 10 at 9,432. Tuned against a simulated club (about 25-30 XP a
// minute from guests, plus purchase XP): level 2 in about 3 minutes, level
// 5 in about 40, level 10 in about 4 hours of play.
export const LEVEL_FANS = { first: 200, step: 220, curve: 30 };
// Where XP (the save calls it fans) comes from: mostly good service,
// satisfied visits and successful parties, not guests just moving between
// activities; and buying things: perDollar XP for each $ spent on
// furniture, decorations, floors, wallpaper and expansions. Moving gives
// none, and selling takes back what the item gave.
// Guests: enter (walking in), drinkServed, danceDone (a dance finished),
// seated (sitting down), admire (a decoration admired); leaving happy is
// LEAVING_FANS in mood.js; a troublemaker walked out is TROUBLE.xp.
// Buying: perDollar of the price, between purchaseMin and purchaseMax, and
// majorUpgrade for an expansion row, a DJ booth upgrade or bartender
// training; only the first time you buy each item (boughtTypes, saved as
// `bought`), so buying and selling can't farm XP.
export const XP = { enter: 1, drinkServed: 2, danceDone: 2, seated: 2, admire: 3, partyPerGuest: 1, partyMax: 60, perDollar: 0.05, purchaseMin: 5, purchaseMax: 30, majorUpgrade: 40 };
// Guest visits (see scene/activities.js): a guest stays visitMs, moving
// between activities that each last about their range (ms). They finish
// what they're doing before leaving; overstayMs past that, they're sent off.
export const VISIT = {
  visitMs: [4 * 60000, 8 * 60000],
  danceMs: [30000, 90000],
  drinkMs: [20000, 45000],
  sitMs: [30000, 75000],
  chatMs: [30000, 75000],
  wanderMs: [10000, 25000],
  overstayMs: 120000,
  thirstGraceMs: 5000, // thirsty this long, they stop what they're doing for a drink
  drinkSeatChance: 0.75, // with a drink, how often a guest goes and sits down with it (if a seat is free)
};
// Kinds of guest (see activities.js): `share` is how common each is,
// `weights` how much they like each activity, `tip` multiplies their tips;
// `pricey` ones order from the top half of the drink menu, `vipSeats` ones
// head for VIP booths first, `trouble` ones are troublemakers (security.js).
// The `luxury` kinds get more common the fancier the club: their share is
// multiplied by 1 + luxury / GUEST_LUXURY.per.
export const GUEST_TYPES = [
  { key: 'regular', label: 'Regular', share: 34, tip: 1, weights: { dance: 3, drink: 3, sit: 2, chat: 3, wander: 1 } },
  { key: 'partier', label: 'Party Animal', share: 22, tip: 1, weights: { dance: 6, drink: 5, sit: 1, chat: 2, wander: 1 } },
  { key: 'social', label: 'Social Butterfly', share: 22, tip: 1, weights: { dance: 1, drink: 2, sit: 5, chat: 6, wander: 1 } },
  { key: 'bigSpender', label: 'Big Spender', share: 9, luxury: true, tip: 1.6, pricey: true, weights: { dance: 2, drink: 6, sit: 2, chat: 2, wander: 1 } },
  { key: 'highRoller', label: 'High Roller', share: 5, luxury: true, tip: 2, pricey: true, vipSeats: true, weights: { dance: 1, drink: 3, sit: 7, chat: 2, wander: 1 } },
  { key: 'vip', label: 'VIP Guest', share: 1.5, luxury: true, tip: 3, pricey: true, vipSeats: true, weights: { dance: 2, drink: 4, sit: 5, chat: 2, wander: 1 } },
  { key: 'troublemaker', label: 'Troublemaker', share: 6, tip: 0.5, trouble: true, weights: { dance: 2, drink: 3, sit: 1, chat: 4, wander: 4 } },
];
export const GUEST_LUXURY = { per: 300 };
// Happiness (see mood.js, activities.js, seating.js): seats have a comfort of
// 1-5 by price (comfortCosts: the price each star needs; VIP booths +1), and
// seated guests cheer up comfortFactor[comfort] times as fast and sit that
// much longer. Admiring a decoration gives admireMood. A guest still happy
// (stayMood+) when their visit ends stays stayLonger longer, once. A guest
// who wanted to do something and found nothing free loses nothingToDoMood,
// at most once every nothingToDoEveryMs.
export const HAPPINESS = { comfortCosts: [0, 60, 150, 300, 700], comfortFactor: [0, 0.6, 0.85, 1.1, 1.35, 1.6], admireMood: 10, stayMood: 75, stayLonger: 0.4, nothingToDoMood: 1.5, nothingToDoEveryMs: 45000 };
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
// How guests pay, like Nightclub City: a cover charge once at the door, then
// each drink (its price plus a tip of drinkTip x the price), and now and
// then a tip while they're dancing (every danceTipEvery ms, $danceTip).
export const MONEY = { cover: 5, drinkTip: [0.2, 0.5], danceTip: [1, 3], danceTipEvery: [20000, 35000] };
export const PATRON_TIP_INTERVAL = MONEY.danceTipEvery; // ms between a dancer's tips
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
// The looks every ordinary guest wears (patron_3d_<name> sheets; see
// PAINTED_PATRONS in assets.js). The owner asked for the ChatGPT-painted
// guy01 to be the only guest; empty brings back the mix below.
// Celebrities and staff keep their own looks.
export const GUEST_LOOKS = ['guy01'];
// Share of guests who are the owner's 3D model (when its sheets exist; see
// MODEL_PATRONS in assets.js), the rest being the drawn characters.
export const MODEL_PATRON_SHARE = 0.35;
// Share of guests who are the Neon Cartoon characters (NEON_PATRONS in
// assets.js); more on the test link, so they're easy to look at.
export const NEON_PATRON_SHARE = 0.3;
export const NEON_PATRON_SHARE_TEST = 0.6;
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
// The drinks the bars can serve (src/scene/drinks.js), unlocking with level:
// price per drink, fun (1-5, how much it cheers a guest up beyond a plain
// drink) and mix (how long it takes to make, times BAR.serveMs). glass and
// color draw its picture.
export const DRINKS = [
  { key: 'beer', name: 'Beer', price: 8, unlockLevel: 1, fun: 1, mix: 0.8, glass: 'mug', color: '#ffb52e' },
  { key: 'cocktail', name: 'Cocktail', price: 12, unlockLevel: 3, fun: 2, mix: 1, glass: 'cocktail', color: '#ff5fa8' },
  { key: 'shots', name: 'Shots', price: 16, unlockLevel: 6, fun: 2, mix: 0.9, glass: 'shots', color: '#ffd23f' },
  { key: 'mojito', name: 'Mojito', price: 20, unlockLevel: 10, fun: 3, mix: 1.2, glass: 'highball', color: '#b8f07a' },
  { key: 'martini', name: 'Martini', price: 26, unlockLevel: 16, fun: 3, mix: 1.3, glass: 'martini', color: '#d6f2ff' },
  { key: 'champagne', name: 'Champagne', price: 40, unlockLevel: 24, fun: 4, mix: 1.5, glass: 'flute', color: '#ffe48a' },
  { key: 'novaNeon', name: 'Nova Neon', price: 60, unlockLevel: 34, fun: 5, mix: 1.8, glass: 'neon', color: '#c04cff' },
];
// Extra mood per fun star (on top of MOOD.drinkMood).
export const DRINK_FUN_MOOD = 3;

// The daily gift (src/scene/daily.js): one a day, a 7-day streak. Cash grows
// by cashPerLevel of itself for every level past 1.
export const DAILY = {
  cashPerLevel: 0.15,
  rewards: [
    { cash: 100 }, { cash: 150, xp: 10 }, { cash: 200 }, { cash: 250, xp: 25 },
    { cash: 300 }, { cash: 400, xp: 50 }, { cash: 600, xp: 100, decor: true },
  ],
};

// The club's name on its neon sign outside (src/scene/clubName.js).
// The sign stands on top of the right wall: fromBack is where its back end
// starts along the wall (gx, from the back corner), postsTall its posts (px).
export const CLUB_SIGN = { defaultName: 'Club Nova', maxLength: 22, fontSize: 30, resolution: 2, chaseMs: 450, postsTall: 12, fromBack: 0.6 };

export const SAVE_KEY = 'clubNovaSave_v2'; // v2: the finer grid (v1 saves don't fit it)

// Test mode (src/scene/testMode.js): the same game opened at .../test/ (or
// with ?test in the address) starts at the top level with lots of cash, on
// its own save so the real club is never touched.
export const TEST_MODE = typeof location !== 'undefined'
  && (/\/test\/(index\.html)?$/.test(location.pathname) || new URLSearchParams(location.search).has('test'));
export const TEST = { saveKey: 'clubNovaSave_v2_test', cash: 10000000, popularity: 400 };

// Fraction of a prop's fixed cost refunded when you right-click to sell it
// back (see sellProp()).
export const SELL_REFUND_RATIO = 0.5;

// How often animated dance floors step a frame (see animateFloors()).
export const FLOOR_TICK_MS = 125;


// Bars: customers queue in a straight line out from the counter, at most
// this many (the first one is ordering).
export const BAR_QUEUE_LENGTH = 4;
// Bar service (see bars.js): a bartender walks walkMsPerUnit per bar unit
// to a customer and takes serveMs to make the drink. Customers never give
// up before patienceMs; after that, every patienceCheckMs each one gives up
// with giveUpChance (showing an angry face for angryMs, losing giveUpMood),
// except the patient ones (patientShare of customers), who keep waiting.
export const BAR = {
  serveMs: 3000, walkMsPerUnit: 380,
  patienceMs: 20000, patienceCheckMs: 2500, giveUpChance: 0.3, patientShare: 0.4, angryMs: 2000, giveUpMood: 8,
};
// How many bartenders you may hire: one more at each of these levels (one
// to start, two at level 4, ... five at level 15). Extra bartenders can work
// another bar or join a long bar that already has one.
export const BARTENDERS = { levels: [1, 5, 10, 16, 23, 30] };

// Bass Boost (see boost.js): for durationMs, guests are danceWeight times
// as keen to dance, dancers tip `speedUp` times as often and `tipMultiplier`
// times as much, and about joinShare of the crowd heads for the dance floor
// over the first few seconds (staggerMs). Guests already dancing go wild
// for exciteMs (dancing excitedEnergy times faster, with excitePops heart
// eyes or ! over their heads), then dance `energy` times faster for the
// rest of the boost, and keep going danceExtendMs longer. Then
// cooldownMs before it's ready.
export const BOOST = { durationMs: 60000, cooldownMs: 180000, speedUp: 1.5, tipMultiplier: 1.5, danceChance: 0.75, danceWeight: 5, joinShare: 0.65, staggerMs: [250, 2500], danceExtendMs: [20000, 40000], energy: 1.2, exciteMs: 10000, excitedEnergy: 1.8, excitePops: [2, 3] };
// Drink Rush (see scene/boost.js): for durationMs, guests are drinkWeight
// times as keen on a drink, and about joinShare of them head for the bars
// over the first few seconds (staggerMs). Then cooldownMs before it's ready.
// The drink meter on the right edge: purple liquid that fills as drinks
// are served (perDrink), tips come in (perTip) and bonuses are clicked
// (perBonus). When it reaches `full`, drinks cost `priceMultiplier` times
// as much for `doubleMs`, while it drains; then it starts again from empty.
export const METER = { full: 100, perDrink: 2, perTip: 1, perBonus: 5, doubleMs: 30000, priceMultiplier: 2 };
export const RUSH = { durationMs: 45000, cooldownMs: 180000, drinkWeight: 5, joinShare: 0.65, staggerMs: [250, 2500] };

// Mood lighting (see lighting.js): how much the floor and walls are dimmed,
// and the coloured glow under lights. The owner found the glows too strong
// in spots, so they're off for now (`glows: false`).
// Parties (see scene/parties.js): one at a time; a countdown, then
// PARTY_LENGTH_MS of party. crowd: how many extra guests turn up and line
// up outside; leaveOverMs: after
// the party, its guests head home over this spread.
// arrivals/tips/thirst/fans: multipliers (arrivals: guests come this much
// faster; thirst: they want drinks this much sooner; fans: fans from happy
// leavers). shade tints the room's mood lighting.
export const PARTY_LENGTH_MS = 3 * 60 * 1000;
export const PARTY_COUNTDOWN_MS = 10 * 1000; // from paying to the party starting
// Guests getting along (or not). Dancers side by side sometimes dance
// together. Now and then a chat turns into an argument (💢): the security
// guard inside walks over and usually calms it down (settleChance); if not,
// or if they're still at it after argueMs, it's a short cartoon fight
// (fightMs) and security throws one of them out. At most one at a time,
// and never within cooldownMs of the last.
// Quick reactions over guests' heads (see reactions.js): icon size and how
// far it floats (px), how long it lasts and the random delay before it
// shows (ms), and how often a happy dancer shows one (more often during a
// Bass Boost), if their mood is at least danceMinMood.
export const REACTIONS = {
  size: 24, rise: 26, lifeMs: [1100, 1800], delayMs: [0, 700],
  danceEveryMs: [9000, 20000], danceEveryBoostMs: [3500, 8000], danceMinMood: 50,
};

// Clickable guest bonuses (see bonuses.js): a happy guest (mood at least
// minMood) offers a high five or fist bump about every everyMs; clicking it
// within lifeMs collects `amount`. size: the high five / fist bump badge,
// tipSize: a decoration tip coin, in px.
export const BONUS = { amount: 88, everyMs: [45000, 75000], lifeMs: 8000, minMood: 70, size: 60, tipSize: 30 };

// Hovering and selecting (see selection.js): the outline glow round
// whatever's under the cursor (colour, strength), round a selected piece,
// the room the glow needs, and how opaque a pixel must be to count as hit.
// Phones and tablets: a tap may move tapSlop px before it counts as a drag;
// a finger that just misses a guest, the DJ or a piece still picks it if it's
// within reach px (objectNear() in selection.js); bonus badges take a tap
// bonusReach times their size from their middle (bonusAt()).
export const TOUCH = { tapSlop: 14, reach: 18, bonusReach: 1.1 };

export const HOVER = { color: 0xffffff, strength: 2.5, selectColor: 0x5dff8a, selectStrength: 4, padding: 10, alphaHit: 40 };

// Admiring decorations (see activities.js): now and then (weight, among the
// guest's activities) a guest stops by a decoration, looks at it for lookMs,
// then says WOW! or OUU! and offers a tip to click: tipPerDollar of the
// decoration's price, between tipMin and tipMax. The same guest won't tip
// for the same decoration again within cooldownMs.
export const ADMIRE = { weight: 1.2, lookMs: 3000, tipPerDollar: 0.08, tipMin: 5, tipMax: 40, cooldownMs: 180000 };

// Goals (see goals.js), in order: three show at a time, and each pays its
// cash and XP when done. `stat` is what's counted (see bumpGoal() and the
// live ones in goalProgress()): drinks, bought, decorBought, bonuses,
// boosts, rushes, dancersAtOnce, parties, expansions, happyGuests, level,
// fullClub, hired, celebs, capacity, rating, admired.
export const GOALS = [
  { id: 'drinks5', text: 'Serve 5 drinks', stat: 'drinks', target: 5, cash: 40, xp: 10 },
  { id: 'decor1', text: 'Buy a decoration', stat: 'decorBought', target: 1, cash: 30, xp: 5 },
  { id: 'boost1', text: 'Use Bass Boost', stat: 'boosts', target: 1, cash: 40, xp: 10 },
  { id: 'bonus1', text: 'Catch a high five', stat: 'bonuses', target: 1, cash: 30, xp: 5 },
  { id: 'rush1', text: 'Start a Drink Rush', stat: 'rushes', target: 1, cash: 40, xp: 10 },
  { id: 'dance4', text: 'Get 4 guests dancing at once', stat: 'dancersAtOnce', target: 4, cash: 60, xp: 15 },
  { id: 'happy10', text: 'Send 10 guests home happy', stat: 'happyGuests', target: 10, cash: 80, xp: 15 },
  { id: 'party1', text: 'Throw a party', stat: 'parties', target: 1, cash: 80, xp: 20 },
  { id: 'drinks25', text: 'Serve 25 drinks', stat: 'drinks', target: 25, cash: 100, xp: 20 },
  { id: 'full1', text: 'Fill your club to the limit', stat: 'fullClub', target: 1, cash: 80, xp: 15 },
  { id: 'expand1', text: 'Expand your club', stat: 'expansions', target: 1, cash: 100, xp: 20 },
  { id: 'level3', text: 'Reach level 3', stat: 'level', target: 3, cash: 150, xp: 0 },
  { id: 'admire3', text: 'Collect 3 tips from guests admiring decorations', stat: 'admired', target: 3, cash: 80, xp: 15 },
  { id: 'buy10', text: 'Buy 10 things for your club', stat: 'bought', target: 10, cash: 120, xp: 25 },
  { id: 'bonus10', text: 'Catch 10 high fives', stat: 'bonuses', target: 10, cash: 150, xp: 25 },
  { id: 'dance8', text: 'Get 8 guests dancing at once', stat: 'dancersAtOnce', target: 8, cash: 150, xp: 30 },
  { id: 'cap12', text: 'Get popular enough to fit 12 guests', stat: 'capacity', target: 12, cash: 200, xp: 30 },
  { id: 'drinks100', text: 'Serve 100 drinks', stat: 'drinks', target: 100, cash: 250, xp: 40 },
  { id: 'parties3', text: 'Throw 3 parties', stat: 'parties', target: 3, cash: 200, xp: 40 },
  { id: 'hire2', text: 'Hire a second bartender', stat: 'hired', target: 1, cash: 150, xp: 25 },
  { id: 'level5', text: 'Reach level 5', stat: 'level', target: 5, cash: 300, xp: 0 },
  { id: 'celeb1', text: 'Have a celebrity visit', stat: 'celebs', target: 1, cash: 250, xp: 40 },
  { id: 'rating4', text: 'Earn a 4-star club rating', stat: 'rating', target: 4, cash: 300, xp: 50 },
  { id: 'happy100', text: 'Send 100 guests home happy', stat: 'happyGuests', target: 100, cash: 400, xp: 60 },
  { id: 'drinks250', text: 'Serve 250 drinks', stat: 'drinks', target: 250, cash: 500, xp: 80 },
  { id: 'cap16', text: 'Get popular enough to fit 16 guests', stat: 'capacity', target: 16, cash: 500, xp: 80 },
  { id: 'celebs5', text: 'Have 5 celebrity visits', stat: 'celebs', target: 5, cash: 600, xp: 100 },
  { id: 'level8', text: 'Reach level 8', stat: 'level', target: 8, cash: 800, xp: 0 },
  { id: 'parties10', text: 'Throw 10 parties', stat: 'parties', target: 10, cash: 800, xp: 120 },
  { id: 'level10', text: 'Reach level 10', stat: 'level', target: 10, cash: 1500, xp: 0 },
];

// Bouncers (security.js): the club starts with one; levels lets you hire
// one more at each of the later levels, for hireCost (first is the house
// guard, free) and `wage` every WAGE_INTERVAL_MS like bartenders.
// characters are their looks (patron sheets), all in black.
export const BOUNCERS = { levels: [1, 8, 18, 30], hireCost: [0, 300, 900, 2000], wage: 3, characters: [4, 4, 4, 4] };
// Troublemakers (security.js, the 'troublemaker' GUEST_TYPES). Every annoyEveryMs
// one bothers the guests within annoyRange tiles (annoyMood off their mood).
// A bouncer within detectRange tiles of one who has caused trouble walks
// over and walks them out the door, for `xp` XP.
export const TROUBLE = { annoyEveryMs: [7000, 12000], annoyRange: 2, annoyMood: 6, detectRange: 8, xp: 5 };
export const SECURITY = {
  character: 4, scale: 1.12, stepMs: 380, // all in black, like the bouncer
  argueChance: 0.12, cooldownMs: 90 * 1000, argueMs: [8000, 12000],
  settleChance: 0.7, fightMs: 3500, moodHit: 12,
  danceTogetherChance: 0.35,
};
// Achievements (see achievements.js): badges for milestones, shown on the
// trophy wall (the 🏅 tab on the left). `stat` is a goal counter (goalStats,
// bumped where things happen) or a live value (level, popularity, luxury,
// wall: the longer wall); reaching `target` pays `cash` and `xp` once.
export const ACHIEVEMENTS = [
  { id: 'drinks50', icon: '🍺', name: 'Barkeep', text: 'Serve 50 drinks', stat: 'drinks', target: 50, cash: 150, xp: 25 },
  { id: 'drinks500', icon: '🍸', name: 'Mixologist', text: 'Serve 500 drinks', stat: 'drinks', target: 500, cash: 800, xp: 120 },
  { id: 'drinks5000', icon: '🥂', name: 'Legend of the Bar', text: 'Serve 5,000 drinks', stat: 'drinks', target: 5000, cash: 5000, xp: 600 },
  { id: 'happy25', icon: '😊', name: 'Good Times', text: '25 guests leave happy', stat: 'happyGuests', target: 25, cash: 150, xp: 25 },
  { id: 'happy250', icon: '😍', name: 'Crowd Pleaser', text: '250 guests leave happy', stat: 'happyGuests', target: 250, cash: 1000, xp: 150 },
  { id: 'happy2500', icon: '🌟', name: 'Best Night Ever', text: '2,500 guests leave happy', stat: 'happyGuests', target: 2500, cash: 6000, xp: 700 },
  { id: 'party1', icon: '🎉', name: 'Party Starter', text: 'Throw your first party', stat: 'parties', target: 1, cash: 100, xp: 20 },
  { id: 'party10', icon: '🪩', name: 'Party Machine', text: 'Throw 10 parties', stat: 'parties', target: 10, cash: 1200, xp: 150 },
  { id: 'celeb1', icon: '⭐', name: 'Star Struck', text: 'A celebrity visits your club', stat: 'celebs', target: 1, cash: 250, xp: 40 },
  { id: 'celeb10', icon: '🎬', name: 'A-List Hangout', text: '10 celebrity visits', stat: 'celebs', target: 10, cash: 2000, xp: 250 },
  { id: 'walkout1', icon: '🚪', name: 'Not Tonight', text: 'Your bouncers walk out a troublemaker', stat: 'walkouts', target: 1, cash: 100, xp: 20 },
  { id: 'walkout25', icon: '🛡️', name: 'Safe and Sound', text: 'Walk out 25 troublemakers', stat: 'walkouts', target: 25, cash: 1000, xp: 120 },
  { id: 'bonus25', icon: '✋', name: 'High Five!', text: 'Catch 25 high fives', stat: 'bonuses', target: 25, cash: 200, xp: 30 },
  { id: 'bonus250', icon: '🙌', name: 'Quick Hands', text: 'Catch 250 high fives', stat: 'bonuses', target: 250, cash: 1500, xp: 180 },
  { id: 'level10', icon: '🔟', name: 'Rising Star', text: 'Reach level 10', stat: 'level', target: 10, cash: 500, xp: 0 },
  { id: 'level20', icon: '💫', name: 'Hot Spot', text: 'Reach level 20', stat: 'level', target: 20, cash: 2000, xp: 0 },
  { id: 'level30', icon: '🔥', name: 'Talk of the Town', text: 'Reach level 30', stat: 'level', target: 30, cash: 5000, xp: 0 },
  { id: 'level40', icon: '👑', name: 'Nightlife Royalty', text: 'Reach level 40', stat: 'level', target: 40, cash: 10000, xp: 0 },
  { id: 'pop100', icon: '💖', name: 'Getting Noticed', text: 'Reach 100 popularity', stat: 'popularity', target: 100, cash: 300, xp: 50 },
  { id: 'pop1000', icon: '💘', name: 'Everyone Wants In', text: 'Reach 1,000 popularity', stat: 'popularity', target: 1000, cash: 2500, xp: 300 },
  { id: 'lux500', icon: '💎', name: 'Classy', text: 'Reach 500 luxury', stat: 'luxury', target: 500, cash: 500, xp: 80 },
  { id: 'lux3000', icon: '💍', name: 'Pure Luxury', text: 'Reach 3,000 luxury', stat: 'luxury', target: 3000, cash: 3000, xp: 350 },
  { id: 'wall15', icon: '🏗️', name: 'Moving On Up', text: 'Grow a wall to 15 tiles', stat: 'wall', target: 15, cash: 600, xp: 80 },
  { id: 'wall22', icon: '🏙️', name: 'Mega Club', text: 'Grow a wall to 22 tiles', stat: 'wall', target: 22, cash: 4000, xp: 400 },
];

// The Celebrity List (see celebrities.js): each unlocks at a club level and
// from then on drops in on their own now and then: one every visitEveryMs
// (the first firstVisitMs after the game opens), joining the line outside. `fame` is their stars (1-5); `character`
// is their look (a patron sheet). Celebrities tip 1 + tipPerFame x fame
// times as much and bring fansPerFame x fame extra fans leaving happy.
export const CELEBRITIES = [
  { key: 'rico', name: 'Rico Diamond', level: 8, fame: 1, character: 1 },
  { key: 'max', name: 'Max Volt', level: 13, fame: 1, character: 7 },
  { key: 'kai', name: 'DJ Kai Blaze', level: 18, fame: 2, character: 3 },
  { key: 'leo', name: 'Leo Lux', level: 24, fame: 3, character: 5 },
  { key: 'tony', name: 'Tony Fame', level: 30, fame: 4, character: 9 },
  { key: 'jett', name: 'Jett Starr', level: 37, fame: 5, character: 11 },
];
// Celebrities (see celebrities.js). The first visit is by invitation only:
// inviteCost by fame (index = stars), and they turn up inviteArriveMs later.
// How good a time they have adds to their liking for the club (0-100,
// `liking`: mood above or below 50 times `mood`, a VIP booth seat, a drink
// on the house, `perStar` for each star the club is rated above 3, minus
// `stormedOut` if they leave angry). Once they've been, they come back on
// their own if they like the club at least minLikingToReturn: every
// returnEveryMs[0] at that, down to returnEveryMs[1] at full liking (give
// or take returnJitter). At regularLiking they're a VIP regular. When one
// walks in, guests inside get star eyes or go wild, and fanTipChance of
// them throw a tip of fanTip dollars.
export const CELEB = {
  tipPerFame: 0.5, fansPerFame: 3,
  inviteCost: [0, 250, 500, 1000, 1800, 3000], inviteArriveMs: [5000, 12000],
  liking: { mood: 0.4, vipSeat: 10, onTheHouse: 8, perStar: 4, stormedOut: 25 },
  minLikingToReturn: 10, returnEveryMs: [600000, 120000], returnJitter: 0.3, regularLiking: 70,
  fanTipChance: 0.45, fanTip: [5, 20],
};
export const PARTIES = [
  { key: 'house', label: 'House Party', emoji: '🏠', cost: 60, unlockLevel: 1, arrivals: 1.3, tips: 1.25, thirst: 1.1, fans: 1.2, shade: 0x1a0b2e, crowd: 6, leaveOverMs: [10000, 70000],
    blurb: 'Invite the neighbours. A couple more guests and a friendly crowd.' },
  { key: 'hiphop', label: 'Hip Hop Night', emoji: '🎤', cost: 150, unlockLevel: 5, arrivals: 1.5, tips: 1.4, thirst: 1.3, fans: 1.4, shade: 0x2e0b12, crowd: 9, leaveOverMs: [10000, 70000],
    blurb: 'Big beats, bigger crowd. Guests drink more and tip better.' },
  { key: 'neon', label: 'Neon Night', emoji: '💜', cost: 300, unlockLevel: 12, arrivals: 1.7, tips: 1.6, thirst: 1.4, fans: 1.7, shade: 0x2a0636, crowd: 12, leaveOverMs: [10000, 70000],
    blurb: 'Glow sticks and neon paint. The whole town wants in.' },
  { key: 'gala', label: 'VIP Gala', emoji: '🥂', cost: 600, unlockLevel: 20, arrivals: 2, tips: 2, thirst: 1.5, fans: 2, shade: 0x2e2306, crowd: 15, leaveOverMs: [10000, 70000],
    blurb: 'Red carpet, champagne, the A-list. Huge tips and XP.' },
  { key: 'glow', label: 'Glow Party', emoji: '✨', cost: 900, unlockLevel: 26, arrivals: 2.2, tips: 2.2, thirst: 1.6, fans: 2.2, shade: 0x062a2e, crowd: 17, leaveOverMs: [10000, 70000],
    blurb: 'Glow sticks for everyone and the lights down low. A packed, happy floor.' },
  { key: 'masquerade', label: 'Masquerade Ball', emoji: '🎭', cost: 1300, unlockLevel: 33, arrivals: 2.4, tips: 2.5, thirst: 1.6, fans: 2.4, shade: 0x2e0624, crowd: 19, leaveOverMs: [10000, 70000],
    blurb: 'Masks, gowns and mystery. The fanciest guests in town, tipping big.' },
  { key: 'rave', label: 'Neon Rave', emoji: '🌈', cost: 1800, unlockLevel: 39, arrivals: 2.7, tips: 2.7, thirst: 1.8, fans: 2.7, shade: 0x0a062e, crowd: 22, leaveOverMs: [10000, 70000],
    blurb: 'The biggest night of the year: lasers, bass and a line round the block.' },
];
// A bartender's Bottoms Up! (see scene/guests.js): for durationMs they mix
// and walk `speed` times as fast, then need cooldownMs to recover. When a
// line reaches slammedLine the bartender says so in a speech bubble (at
// most every hintEveryMs), suggesting it.
export const BOTTOMS_UP = { durationMs: 30 * 1000, speed: 2, cooldownMs: 90 * 1000, slammedLine: 3, hintEveryMs: 60 * 1000, sayMs: 4500 };
// DJ, bar and seating upgrades (src/scene/upgrades.js).
// A better DJ booth entertains more: dancers have fun djQuality times as fast,
// from qualityMin (the cheapest booth) to qualityMax (the priciest).
// Song Dedication (guest card): the DJ plays one for that guest, +dedicationMood
// mood and +dedicationFun fun, then needs dedicationCooldownMs.
export const DJ = { qualityMin: 0.8, qualityMax: 1.5, dedicationMood: 25, dedicationFun: 25, dedicationCooldownMs: 120 * 1000 };
// Bar Tricks (bartender card): for durationMs that bar's tips are
// tipMultiplier times bigger, and guests within range tiles cheer up by
// cheerMood; then cooldownMs.
export const BAR_TRICKS = { durationMs: 30 * 1000, cooldownMs: 120 * 1000, tipMultiplier: 1.5, cheerMood: 8, range: 4 };
// Bartender training (Staff panel): each level makes every bartender work
// speedPer faster. Level n costs costs[n-1] and unlocks at levels[n-1].
export const BAR_TRAINING = { costs: [400, 1200, 3000], levels: [3, 8, 15], speedPer: 0.2 };
// Drink stock (Staff panel): every drink served uses one; the bars hold
// base + perBarUnit per bar unit. Restocking costs costPerDrink a drink. At
// lowShare the bartender warns, and with none left they can't serve. The
// bars hold base + perGuest per guest the club fits: about 12-20 minutes
// of drinks at any size (balance-checked with a simulated club).
export const DRINK_STOCK = { base: 30, perGuest: 6, costPerDrink: 2, lowShare: 0.2, warnEveryMs: 60 * 1000 };
// VIP booths: a high roller, VIP guest or celebrity who sits at one pays a
// reservation of feeShare of the booth's price (at least feeMin).
export const VIP_BOOTH = { feeShare: 0.1, feeMin: 20 };
// Luxury (see luxury() in economy.js): a tenth of what everything placed,
// painted and papered cost. Each point raises tips by luxuryTipPerPoint,
// up to luxuryTipMax extra.
export const LUXURY = { perDollar: 0.1, tipPerPoint: 0.001, tipMax: 1 };
// The DJ's songs (see scene/songs.js and TRACKS in music.js): each plays
// lengthMs, then the next one starts. Liking a song gives likeFans, once a
// song; a new song gives everyone dancing newSongFun fun.
export const SONGS = { lengthMs: 60 * 1000, likeFans: 1, newSongFun: 10 };
// The club's star rating (see rating.js). The club runs one endless night;
// every sampleMs it gets stars for how happy the crowd was (one, plus one
// for each of starVibes its average vibe reached) and starFans bonus fans.
// The rating is the average of the last `samples` of those. Each star above
// 3 brings guests arrivalsPerStar faster (and each below, slower).
export const RATING = { samples: 5, sampleMs: 60 * 1000, starVibes: [40, 55, 70, 85], starFans: [0, 0, 1, 1, 2], arrivalsPerStar: 0.08 };
export const MOOD_LIGHTING = { color: 0x0b0418, floorAlpha: 0.3, wallAlpha: 0.2, glows: false, glowAlpha: 0.55 };
