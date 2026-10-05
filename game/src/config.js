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
export const STREET = {
  sidewalk: 4.5, road: 7,
  pavement: 0x55535f, grout: 0x46444f, curb: 0x7a7884, asphalt: 0x1d1b24, laneLine: 0xc9a640,
  carpet: 0x8c1426, carpetEdge: 0xd4a53a, rope: 0xb0102a, brass: 0xd4a53a,
  lampPost: 0x2a2a33, lampGlow: 0xffd77a, lampEvery: 6,
  buildings: [0x2a2438, 0x262a3a, 0x30283a, 0x232433], windowLit: 0xf2c75c, windowDark: 0x16141e,
  lineOut: 3.1, lineLength: 6, startInLine: 3, bouncerCharacter: 4,
  msPerTile: 420, admitEveryMs: 1500, partyAdmitMs: 3000, passerEveryMs: [1200, 3200],
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
// How many guests fit in the club (see patronCapacity()): `base`, plus
// `perExpansion` for every row of floor bought (see expandClub()). Staff
// don't count; celebrities do. When it's full, arrivals wait outside.
export const CAPACITY = { base: 8, perExpansion: 1 };
// Fans needed for each level: `first` to reach level 2, then `step` more
// for every level after (150, 250, 350, ... so level 5 is at 1,200 fans).
// Fans are the game's XP. Level L needs first + step*(L-1) + curve*(L-1)^2
// more fans to reach the next one, so each level takes longer.
export const LEVEL_FANS = { first: 250, step: 150, curve: 15 };
// Where XP (the save calls it fans) comes from: mostly good service,
// satisfied visits and successful parties, not guests just moving between
// activities; and buying things: perDollar XP for each $ spent on
// furniture, decorations, floors, wallpaper and expansions. Moving gives
// none, and selling takes back what the item gave.
export const XP = { drinkServed: 0.5, partyPerGuest: 1, partyMax: 60, perDollar: 0.05 };
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
};
// Kinds of guest: how much each likes each activity (relative weights), so
// they don't all follow the same routine.
export const GUEST_TYPES = [
  { key: 'dancer', label: 'Dancer', weights: { dance: 6, drink: 2, sit: 1, chat: 2, wander: 1 } },
  { key: 'barfly', label: 'Barfly', weights: { dance: 1, drink: 5, sit: 2, chat: 3, wander: 1 } },
  { key: 'social', label: 'Social butterfly', weights: { dance: 2, drink: 2, sit: 2, chat: 6, wander: 1 } },
  { key: 'chill', label: 'Chiller', weights: { dance: 1, drink: 2, sit: 6, chat: 2, wander: 2 } },
  { key: 'partier', label: 'Party animal', weights: { dance: 4, drink: 4, sit: 1, chat: 2, wander: 1 } },
];
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
export const MONEY = { cover: 5, drinkTip: [0.2, 0.5], danceTip: [2, 5], danceTipEvery: [15000, 25000] };
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
export const BARTENDERS = { levels: [1, 4, 7, 11, 15] };

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
// within lifeMs collects `amount`. size: the badge, in px.
export const BONUS = { amount: 88, everyMs: [30000, 60000], lifeMs: 8000, minMood: 70, size: 30 };

// Hovering and selecting (see selection.js): the outline glow round
// whatever's under the cursor (colour, strength), round a selected piece,
// the room the glow needs, and how opaque a pixel must be to count as hit.
export const HOVER = { color: 0xffffff, strength: 2.5, selectColor: 0x5dff8a, selectStrength: 4, padding: 10, alphaHit: 40 };

// Admiring decorations (see activities.js): now and then (weight, among the
// guest's activities) a guest stops by a decoration, looks at it for lookMs,
// then says WOW! or OUU! and offers a tip to click: tipPerDollar of the
// decoration's price, between tipMin and tipMax. The same guest won't tip
// for the same decoration again within cooldownMs.
export const ADMIRE = { weight: 1.2, lookMs: 3000, tipPerDollar: 0.08, tipMin: 5, tipMax: 40, cooldownMs: 180000 };

export const SECURITY = {
  character: 4, scale: 1.12, stepMs: 380, // all in black, like the bouncer
  argueChance: 0.12, cooldownMs: 90 * 1000, argueMs: [8000, 12000],
  settleChance: 0.7, fightMs: 3500, moodHit: 12,
  danceTogetherChance: 0.35,
};
// The Celebrity List (see celebrities.js): each unlocks at a club level and
// from then on drops in on their own now and then: one every visitEveryMs
// (the first firstVisitMs after the game opens), joining the line outside. `fame` is their stars (1-5); `character`
// is their look (a patron sheet). Celebrities tip 1 + tipPerFame x fame
// times as much and bring fansPerFame x fame extra fans leaving happy.
export const CELEBRITIES = [
  { key: 'rico', name: 'Rico Diamond', level: 5, fame: 1, character: 1 },
  { key: 'max', name: 'Max Volt', level: 8, fame: 1, character: 7 },
  { key: 'kai', name: 'DJ Kai Blaze', level: 11, fame: 2, character: 3 },
  { key: 'leo', name: 'Leo Lux', level: 14, fame: 3, character: 5 },
  { key: 'tony', name: 'Tony Fame', level: 17, fame: 4, character: 9 },
  { key: 'jett', name: 'Jett Starr', level: 20, fame: 5, character: 11 },
];
export const CELEB = { tipPerFame: 0.5, fansPerFame: 3, visitEveryMs: [120000, 240000], firstVisitMs: [45000, 90000] };
export const PARTIES = [
  { key: 'house', label: 'House Party', emoji: '🏠', cost: 60, unlockLevel: 1, arrivals: 1.3, tips: 1.25, thirst: 1.1, fans: 1.2, shade: 0x1a0b2e, crowd: 6, leaveOverMs: [10000, 70000],
    blurb: 'Invite the neighbours. A couple more guests and a friendly crowd.' },
  { key: 'hiphop', label: 'Hip Hop Night', emoji: '🎤', cost: 150, unlockLevel: 2, arrivals: 1.5, tips: 1.4, thirst: 1.3, fans: 1.4, shade: 0x2e0b12, crowd: 9, leaveOverMs: [10000, 70000],
    blurb: 'Big beats, bigger crowd. Guests drink more and tip better.' },
  { key: 'neon', label: 'Neon Night', emoji: '💜', cost: 300, unlockLevel: 4, arrivals: 1.7, tips: 1.6, thirst: 1.4, fans: 1.7, shade: 0x2a0636, crowd: 12, leaveOverMs: [10000, 70000],
    blurb: 'Glow sticks and neon paint. The whole town wants in.' },
  { key: 'gala', label: 'VIP Gala', emoji: '🥂', cost: 600, unlockLevel: 6, arrivals: 2, tips: 2, thirst: 1.5, fans: 2, shade: 0x2e2306, crowd: 15, leaveOverMs: [10000, 70000],
    blurb: 'Red carpet, champagne, the A-list. Huge tips and XP.' },
];
// A bartender's Bottoms Up! (see scene/guests.js): serves their whole line
// at once, then needs cooldownMs to recover. The game suggests it when a
// line reaches slammedLine, at most every hintEveryMs.
export const BOTTOMS_UP = { cooldownMs: 60 * 1000, slammedLine: 3, hintEveryMs: 60 * 1000 };
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
