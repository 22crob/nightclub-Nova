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

// The bar line-up (art/blender/build_bars.py and build_bar.py): five
// looks, from a beginner's plywood counter to an ice bar. They play the same
// (1x3 footprint, $10 drinks, one bartender); only the look, price and
// unlock level differ. The footprint runs back bar, aisle, counter along gy
// at facings 0/180 and along gx at 90/270.
const BAR_FOOTPRINT = {
  0: [[0, 0], [0, 1], [0, 2]],
  90: [[0, 0], [1, 0], [2, 0]],
  180: [[0, 0], [0, 1], [0, 2]],
  270: [[0, 0], [1, 0], [2, 0]],
};
// The DJ booth line-up (art/blender/build_booths.py), paired with the bars:
// same 2x1 footprint and gameplay (a DJ plays music and the booth earns
// fans), only the look, price and unlock level differ. The key 'dj' stays
// on the tier-3 Club Booth so older saves keep their booth.
const BOOTH_FOOTPRINT = {
  0: [[0, 0], [1, 0]],
  90: [[0, 0], [0, 1]],
  180: [[0, 0], [1, 0]],
  270: [[0, 0], [0, 1]],
};
function boothTier(key, label, cost, unlockLevel, spriteBase, meta) {
  return {
    key, label, cost, unlockLevel, category: 'Booths', fanRate: 1.2,
    staff: 'dj', rotatable: true,
    sprites: { 0: `${spriteBase}_0`, 90: `${spriteBase}_90`, 180: `${spriteBase}_180`, 270: `${spriteBase}_270` },
    footprint: BOOTH_FOOTPRINT,
    displayWidth: meta.displayWidth, originX: meta.originX, originY: meta.originY,
  };
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
export const SHOP_CATEGORIES = ['Bars', 'Booths', 'Floors', 'Decorations', 'Wallpaper', 'Staff', 'Expand'];

// Staff. A prop with `staff` needs one of these working at it: a bar sells
// drinks only with a bartender, and a DJ booth plays music (making the dance
// floor and the booth earn fans, and patrons dance) only with a DJ. Hiring
// costs `hireCost` once; `wage` is paid every WAGE_INTERVAL_MS (config.js).
// `character` is which patron spritesheet they wear.
export const STAFF_TYPES = {
  bartender: { key: 'bartender', label: 'Bartender', hireCost: 50, wage: 4, character: 8 },
  dj: { key: 'dj', label: 'DJ', hireCost: 80, wage: 6, character: 0 },
};

// Sequential tiers for growing the club's physical floor past its starting
// BASE_GRID_SIZE. Priced and level-gated the same way every other purchase
// in this game is — reaching the level/cash to afford the next tier is the
// actual milestone, not a formula that keeps inflating. This is the ONLY
// thing that increases the floor itself; it never grants patron capacity
// directly (see patronCapacity()) — more floor just means more room to
// place more Floors-category items, which is what actually grows capacity.
export const GRID_EXPANSIONS = [
  { size: 14, cost: 600, unlockLevel: 2 },
  { size: 16, cost: 1500, unlockLevel: 4 },
  { size: 18, cost: 3000, unlockLevel: 6 },
  { size: 20, cost: 5000, unlockLevel: 8 },
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

// Non-rotatable props that are flat ground decals (no real height) rather
// than something sitting on top of a tile — rendered as a flat shaded
// diamond instead of a 3D box, both in the world (drawIsoBox) and in the
// build-bar icon (renderIsoIcon).
export const FLOOR_DECAL_PROPS = new Set(['dance', 'neonFloor']);
