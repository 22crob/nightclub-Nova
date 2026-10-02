// The shop catalog: every buyable prop, shop tabs, and club expansion tiers.
import barSprite from './assets/sprites/bar.json';
import barStarterSprite from './assets/sprites/bar_starter.json';
import barWoodSprite from './assets/sprites/bar_wood.json';
import barNeonSprite from './assets/sprites/bar_neon.json';
import barIceSprite from './assets/sprites/bar_ice.json';
import boothWoodSprite from './assets/sprites/dj_wood.json';
import boothProSprite from './assets/sprites/dj_pro.json';
import boothClubSprite from './assets/sprites/dj_club.json';
import boothNeonSprite from './assets/sprites/dj_neon.json';
import boothIceSprite from './assets/sprites/dj_ice.json';
import seat_woodStool from './assets/sprites/seat_woodStool.json';
import seat_couch from './assets/sprites/seat_couch.json';
import seat_candleTable from './assets/sprites/seat_candleTable.json';
import seat_stool from './assets/sprites/seat_stool.json';
import seat_leatherCouch from './assets/sprites/seat_leatherCouch.json';
import seat_velvetBooth from './assets/sprites/seat_velvetBooth.json';
import seat_blackBooth from './assets/sprites/seat_blackBooth.json';
import seat_goldBooth from './assets/sprites/seat_goldBooth.json';
import decor_fern from './assets/sprites/decor_fern.json';
import decor_palm from './assets/sprites/decor_palm.json';
import decor_crates from './assets/sprites/decor_crates.json';
import decor_woodSpeaker from './assets/sprites/decor_woodSpeaker.json';
import decor_speaker from './assets/sprites/decor_speaker.json';
import decor_neonSpeaker from './assets/sprites/decor_neonSpeaker.json';
import decor_rope from './assets/sprites/decor_rope.json';
import decor_lava from './assets/sprites/decor_lava.json';
import decor_tube from './assets/sprites/decor_tube.json';
import decor_disco from './assets/sprites/decor_disco.json';
import decor_neonSign from './assets/sprites/decor_neonSign.json';
import decor_spotlight from './assets/sprites/decor_spotlight.json';
import decor_pool from './assets/sprites/decor_pool.json';
import decor_aquarium from './assets/sprites/decor_aquarium.json';
import decor_trophy from './assets/sprites/decor_trophy.json';
import decor_luckyCat from './assets/sprites/decor_luckyCat.json';

// The bar line-up (art/blender/build_bars.py and build_bar.py): five
// looks, from a beginner's plywood counter to an ice bar. They play the same
// ($10 drinks, one bartender); only the look, price and unlock level differ.
// Each bar is one tile wide and three deep, like Nightclub City's: back
// bar, aisle and counter. Bars placed side by side line up into one long
// bar. The footprint runs back bar, aisle, counter along gy at facings
// 0/180 and along gx at 90/270 (see barLayout()).
const BAR_FOOTPRINT = {
  0: [[0, 0], [0, 1], [0, 2]],
  90: [[0, 0], [1, 0], [2, 0]],
  180: [[0, 0], [0, 1], [0, 2]],
  270: [[0, 0], [1, 0], [2, 0]],
};
// The DJ booth line-up (art/blender/build_booths.py), paired with the bars:
// same 2x1 footprint and gameplay, only the look, price and unlock level
// differ. Every club has exactly one booth, with its DJ always playing: a
// new club starts with a free Wood Booth, and the others are upgrades that
// swap it in place (see upgradeClubBooth()). The key 'dj' stays on the
// tier-3 Club Booth so older saves keep their booth.
const BOOTH_FOOTPRINT = {
  0: [[0, 0], [1, 0], [2, 0]],
  90: [[0, 0], [0, 1], [0, 2]],
  180: [[0, 0], [1, 0], [2, 0]],
  270: [[0, 0], [0, 1], [0, 2]],
};
function boothTier(key, label, cost, unlockLevel, spriteBase, meta) {
  return {
    key, label, cost, unlockLevel, category: 'DJ Booths', fanRate: 1.2,
    staff: 'dj', rotatable: true,
    sprites: { 0: `${spriteBase}_0`, 90: `${spriteBase}_90`, 180: `${spriteBase}_180`, 270: `${spriteBase}_270` },
    footprint: BOOTH_FOOTPRINT,
    displayWidth: meta.displayWidth, originX: meta.originX, originY: meta.originY,
  };
}

// Regular floors (FLOOR_PAINTS in floors.js) are painted onto the room's
// floor tile by tile, under the furniture (see floorPaint.js); the price is
// per tile. Looks only: patrons dance on dance floors, not these.
function paintTier(key, label, cost, unlockLevel, paintStyle) {
  return { key, label, cost, unlockLevel, category: 'Floors', paintStyle };
}

function floorTier(key, label, cost, unlockLevel, floorStyle) {
  return { key, label, cost, unlockLevel, category: 'Dance Floors', fanRate: 0.4, capacity: 1, floorStyle };
}

// Decorations (art/blender/build_decor.py): one tile unless noted, all
// rotatable, each adding a little to the fan rate (fancier = a bit more).
// The disco ball also throws coloured lights on the floor.
const DECOR_SPRITES = {
  fern: decor_fern, palm: decor_palm, crates: decor_crates, woodSpeaker: decor_woodSpeaker,
  speaker: decor_speaker, neonSpeaker: decor_neonSpeaker, rope: decor_rope, lava: decor_lava,
  tube: decor_tube, disco: decor_disco, neonSign: decor_neonSign, spotlight: decor_spotlight,
  pool: decor_pool, aquarium: decor_aquarium, trophy: decor_trophy, luckyCat: decor_luckyCat,
};
function decorTier(key, label, cost, unlockLevel, model, fanRate, extra = {}) {
  const meta = DECOR_SPRITES[model];
  const base = `decor_${model}`;
  return {
    key, label, cost, unlockLevel, category: 'Decorations', fanRate, rotatable: true,
    sprites: { 0: `${base}_0`, 90: `${base}_90`, 180: `${base}_180`, 270: `${base}_270` },
    displayWidth: meta.displayWidth, originX: meta.originX, originY: meta.originY,
    ...extra,
  };
}

// Seating (art/blender/build_seating.py): patrons walk over and sit down,
// which slowly cheers them up (see seating.js). Drawn in two layers with
// seated patrons between them; unlike a bar, the front layer is always the
// nearer one, because the render already moved any backrest that faces the
// camera into it. `seats` are seat positions in Blender units at facing 0,
// relative to the piece's centre; `sitLift` raises a seated patron (stools).
const SEAT_SPRITES = {
  woodStool: seat_woodStool, couch: seat_couch, candleTable: seat_candleTable, stool: seat_stool,
  leatherCouch: seat_leatherCouch, velvetBooth: seat_velvetBooth, blackBooth: seat_blackBooth, goldBooth: seat_goldBooth,
};
const SQUARE_3X3 = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]];
const BOOTH_3X3 = { 0: SQUARE_3X3, 90: SQUARE_3X3, 180: SQUARE_3X3, 270: SQUARE_3X3 };
function seatTier(key, label, cost, unlockLevel, model, fanRate, footprint = null) {
  const meta = SEAT_SPRITES[model];
  const base = `seat_${model}`;
  const facings = (suffix) => ({ 0: `${base}${suffix}_0`, 90: `${base}${suffix}_90`, 180: `${base}${suffix}_180`, 270: `${base}${suffix}_270` });
  return {
    key, label, cost, unlockLevel, category: 'Seating', fanRate, rotatable: true,
    sprites: facings(''),
    layerSprites: meta.layers ? Object.fromEntries(meta.layers.map((layer) => [layer, facings(`_${layer}`)])) : null,
    frontAlwaysNear: true,
    seats: meta.seats, sitLift: meta.sitLift,
    ...(footprint ? { footprint } : {}),
    displayWidth: meta.displayWidth, originX: meta.originX, originY: meta.originY,
  };
}

// Wallpaper is painted onto one wall section (a tile wide) at a time; the
// price is per section. Looks only, no gameplay effect.
function wallTier(key, label, cost, unlockLevel, wallStyle) {
  return { key, label, cost, unlockLevel, category: 'Wallpaper', wallStyle };
}

function barTier(key, label, cost, unlockLevel, spriteBase, meta) {
  return {
    key, label, cost, unlockLevel, category: 'Bars', color: 0x2fd0ff,
    staff: 'bartender', drinkPrice: 10, rotatable: true,
    sprites: { 0: `${spriteBase}_0`, 90: `${spriteBase}_90`, 180: `${spriteBase}_180`, 270: `${spriteBase}_270` },
    // Drawn in two layers, back bar and front counter, so the bartender
    // stands between them (see createPropVisual()).
    layerSprites: meta.layers ? Object.fromEntries(meta.layers.map((layer) => [layer,
      { 0: `${spriteBase}_${layer}_0`, 90: `${spriteBase}_${layer}_90`, 180: `${spriteBase}_${layer}_180`, 270: `${spriteBase}_${layer}_270` }])) : null,
    footprint: BAR_FOOTPRINT,
    displayWidth: meta.displayWidth, originX: meta.originX, originY: meta.originY,
  };
}

// capacity: how many extra patrons this prop lets the club hold at once
// (see patronCapacity() below) — bigger/more social props add more room.
// unlockLevel: the level (see levelInfo()) you need to reach before this
// prop can be bought at all. Its price (currentCost()) never moves once
// you're able to buy it — the progression is in WHICH props exist to buy
// at which tier, not in inflating a prop you already have access to.
// Omitted / 1 means available from the very start.
export const PROP_TYPES = {
  starterBar: barTier('starterBar', 'Starter Bar', 100, 1, 'bar_starter', barStarterSprite),
  woodBar: barTier('woodBar', 'Wood Bar', 130, 2, 'bar_wood', barWoodSprite),
  bar: barTier('bar', 'Pub Bar', 150, 3, 'bar', barSprite),
  neonBar: barTier('neonBar', 'Neon Bar', 260, 5, 'bar_neon', barNeonSprite),
  iceBar: barTier('iceBar', 'Ice Bar', 400, 7, 'bar_ice', barIceSprite),
  woodBooth: boothTier('woodBooth', 'Wood Booth', 180, 1, 'dj_wood', boothWoodSprite),
  proBooth: boothTier('proBooth', 'Pro Booth', 215, 2, 'dj_pro', boothProSprite),
  dj: boothTier('dj', 'Club Booth', 250, 3, 'dj_club', boothClubSprite),
  neonBooth: boothTier('neonBooth', 'Neon Booth', 380, 5, 'dj_neon', boothNeonSprite),
  iceBooth: boothTier('iceBooth', 'Ice Booth', 550, 7, 'dj_ice', boothIceSprite),
  // Regular floors, simple to fancy.
  fpConcrete: paintTier('fpConcrete', 'Concrete', 3, 1, 'concrete'),
  fpStone: paintTier('fpStone', 'Stone Tiles', 5, 1, 'stone'),
  fpWood: paintTier('fpWood', 'Wood Planks', 6, 2, 'planks'),
  fpRedCarpet: paintTier('fpRedCarpet', 'Red Carpet', 7, 2, 'redCarpet'),
  fpPurpleCarpet: paintTier('fpPurpleCarpet', 'Purple Carpet', 9, 3, 'purpleCarpet'),
  fpMarble: paintTier('fpMarble', 'Marble', 12, 4, 'marble'),
  fpBlackGloss: paintTier('fpBlackGloss', 'Black Gloss', 15, 5, 'blackGloss'),
  fpGoldMarble: paintTier('fpGoldMarble', 'Gold Marble', 20, 7, 'goldMarble'),
  // Dance floors (src/floors.js, drawn in code): simple to fancy across the
  // first ten levels, all with the same gameplay. Floors are the ONLY
  // category that grants patron capacity (see patronCapacity()); a
  // `capacity` field on a Bars/Booths/Decorations item is inert by design.
  // 'dance' and 'neonFloor' are the keys of the two original floors, kept
  // so older saves load them as Checker and Light-Up.
  plainFloor: floorTier('plainFloor', 'Plain Floor', 20, 1, 'plain'),
  dance: floorTier('dance', 'Checker Floor', 25, 1, 'checker'),
  woodFloor: floorTier('woodFloor', 'Wood Floor', 35, 2, 'parquet'),
  glowFloor: floorTier('glowFloor', 'Glow Floor', 55, 3, 'glow'),
  neonFloor: floorTier('neonFloor', 'Light-Up Floor', 70, 4, 'lightUp'),
  ringFloor: floorTier('ringFloor', 'Neon Rings', 90, 5, 'neonRings'),
  waveFloor: floorTier('waveFloor', 'Color Wave', 110, 6, 'wave'),
  rainbowFloor: floorTier('rainbowFloor', 'Rainbow Flow', 130, 8, 'rainbow'),
  stepFloor: floorTier('stepFloor', 'Step Floor', 155, 10, 'step'),
  // Seating, simple to fancy. 'table' and 'vipLounge' are the keys of the
  // original placeholder Table and VIP Lounge, kept for old saves.
  woodStool: seatTier('woodStool', 'Wood Stool', 40, 1, 'woodStool', 0.1),
  couch: seatTier('couch', 'Fabric Couch', 90, 1, 'couch', 0.2, BOOTH_FOOTPRINT),
  table: seatTier('table', 'Candle Table', 60, 2, 'candleTable', 0.2),
  barStool: seatTier('barStool', 'Chrome Bar Stool', 70, 3, 'stool', 0.2),
  leatherCouch: seatTier('leatherCouch', 'Leather Couch', 160, 3, 'leatherCouch', 0.3, BOOTH_FOOTPRINT),
  vipLounge: seatTier('vipLounge', 'Red Velvet Booth', 280, 4, 'velvetBooth', 0.5, BOOTH_3X3),
  blackBooth: seatTier('blackBooth', 'Black Leather Booth', 360, 6, 'blackBooth', 0.6, BOOTH_3X3),
  goldBooth: seatTier('goldBooth', 'Gold VIP Booth', 500, 8, 'goldBooth', 0.8, BOOTH_3X3),
  // Decorations, simple to fancy. 'plant', 'discoBall' and 'neonSign' are
  // the keys of the original placeholder decorations, kept for old saves.
  crates: decorTier('crates', 'Beer Crates', 40, 1, 'crates', 0.15),
  plant: decorTier('plant', 'Potted Fern', 50, 1, 'fern', 0.2),
  woodSpeaker: decorTier('woodSpeaker', 'Wood Speaker', 80, 1, 'woodSpeaker', 0.3),
  discoBall: decorTier('discoBall', 'Disco Ball', 120, 1, 'disco', 0.45, { lightRig: true }),
  velvetRope: decorTier('velvetRope', 'Velvet Rope', 90, 2, 'rope', 0.3),
  palm: decorTier('palm', 'Palm Tree', 110, 2, 'palm', 0.35),
  lavaLamp: decorTier('lavaLamp', 'Lava Lamp', 140, 3, 'lava', 0.45),
  speakerTower: decorTier('speakerTower', 'Speaker Tower', 160, 3, 'speaker', 0.5),
  neonSign: decorTier('neonSign', 'Neon Sign', 200, 4, 'neonSign', 0.6),
  glowTube: decorTier('glowTube', 'Glow Tube', 220, 4, 'tube', 0.6),
  poolTable: decorTier('poolTable', 'Pool Table', 300, 5, 'pool', 0.7, { footprint: BOOTH_FOOTPRINT }),
  spotlight: decorTier('spotlight', 'Spotlight', 260, 6, 'spotlight', 0.7),
  aquarium: decorTier('aquarium', 'Aquarium', 350, 6, 'aquarium', 0.8),
  neonSpeaker: decorTier('neonSpeaker', 'Neon Speaker', 380, 7, 'neonSpeaker', 0.85),
  trophy: decorTier('trophy', 'Gold Trophy', 450, 8, 'trophy', 0.9),
  luckyCat: decorTier('luckyCat', 'Lucky Cat', 550, 9, 'luckyCat', 1.0),
  // Wallpaper (src/walls.js, drawn in code): simple to fancy across the
  // first ten levels.
  wpPaint: wallTier('wpPaint', 'Paint', 8, 1, 'paint'),
  wpBrick: wallTier('wpBrick', 'Brick', 11, 1, 'brick'),
  wpStripes: wallTier('wpStripes', 'Stripes', 15, 2, 'stripes'),
  wpWainscot: wallTier('wpWainscot', 'Wood Panel', 19, 2, 'wainscot'),
  wpDots: wallTier('wpDots', 'Retro Dots', 22, 3, 'retroDots'),
  wpVelvet: wallTier('wpVelvet', 'Velvet', 30, 4, 'damask'),
  wpNeon: wallTier('wpNeon', 'Neon Strip', 38, 5, 'neonStrip'),
  wpEq: wallTier('wpEq', 'Equalizer', 45, 6, 'equalizer'),
  wpMirror: wallTier('wpMirror', 'Mirror Tiles', 56, 7, 'mirror'),
  wpChevron: wallTier('wpChevron', 'Neon Chevron', 71, 9, 'chevron'),
  wpLed: wallTier('wpLed', 'LED Wall', 90, 10, 'ledWall'),
};

// Mood lighting (see lighting.js): props that give off light cast a soft
// glow on the floor around them: [colour, radius in tiles].
const PROP_LIGHTS = {
  bar: [0xffa050, 1.4], neonBar: [0xc040ff, 2.0], iceBar: [0x60c8ff, 2.0],
  proBooth: [0xffb45a, 1.0], dj: [0xff60c0, 1.2], neonBooth: [0xc040ff, 1.8], iceBooth: [0x60c8ff, 1.8],
  lavaLamp: [0xff3a28, 1.5], glowTube: [0x30c0ff, 1.6], neonSign: [0xff40c0, 1.6], aquarium: [0x3080ff, 1.5],
  speakerTower: [0x30e0ff, 0.9], neonSpeaker: [0xc040ff, 1.3], discoBall: [0xc8c8ff, 1.2], spotlight: [0xfff0c0, 1.6],
  trophy: [0xffc040, 0.9], table: [0xffa040, 1.0], vipLounge: [0xffa040, 1.3], blackBooth: [0xffa040, 1.3],
  goldBooth: [0xffc060, 1.8],
};
for (const [key, light] of Object.entries(PROP_LIGHTS)) PROP_TYPES[key].light = light;

// Tab order for the shop panel (see ClubScene.buildShop()). A tab with no
// items shows a "coming soon" placeholder. "Expand" is last and isn't a set of
// placeable props at all — see ClubScene.renderExpandCard()/expandClub().
export const SHOP_CATEGORIES = ['Bars', 'DJ Booths', 'Seating', 'Floors', 'Dance Floors', 'Decorations', 'Wallpaper', 'Staff', 'Expand'];

// Staff. A prop with `staff` needs one of these working at it: a bar sells
// drinks only with a bartender, and a DJ booth plays music (making the dance
// floor and the booth earn fans, and patrons dance) only with a DJ. Hiring
// costs `hireCost` once; `wage` is paid every WAGE_INTERVAL_MS (config.js).
// `character` is which patron spritesheet they wear.
export const STAFF_TYPES = {
  bartender: { key: 'bartender', label: 'Bartender', hireCost: 50, wage: 4, character: 8 },
  // Every club has one DJ from the start who never stops playing: not
  // hired, never paid, never quits (see ensureClubBooth()).
  dj: { key: 'dj', label: 'DJ', hireCost: 0, wage: 0, character: 0, permanent: true },
};

// Sequential tiers for growing the club's physical floor past its starting
// BASE_GRID_SIZE. Priced and level-gated the same way every other purchase
// in this game is — reaching the level/cash to afford the next tier is the
// actual milestone, not a formula that keeps inflating. This is the ONLY
// thing that increases the floor itself; it never grants patron capacity
// directly (see patronCapacity()) — more floor just means more room to
// place more Floors-category items, which is what actually grows capacity.
export const GRID_EXPANSIONS = [
  { size: 19, cost: 600, unlockLevel: 2 },
  { size: 21, cost: 1500, unlockLevel: 4 },
  { size: 24, cost: 3000, unlockLevel: 6 },
  { size: 27, cost: 5000, unlockLevel: 8 },
];

// A 1-5 "Fame" rating shown in the shop instead of raw fan-rate/capacity
// numbers — a qualitative "how cool is this" read derived from price
// (pricier items are fancier), rather than a spec sheet the player has to
// do math on.
export function fameStars(cost) {
  if (cost >= 400) return 5;
  if (cost >= 300) return 4;
  if (cost >= 200) return 3;
  if (cost >= 100) return 2;
  return 1;
}

// Dance floor tiles: flat on the ground, patrons dance on them.
export const FLOOR_DECAL_PROPS = new Set(Object.keys(PROP_TYPES).filter((k) => PROP_TYPES[k].floorStyle));
