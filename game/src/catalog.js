// The shop catalog: every buyable prop, shop tabs, and club expansion tiers.
import { TILE_W } from './config.js';
import barSprite from './assets/sprites/bar.json';

// capacity: how many extra patrons this prop lets the club hold at once
// (see patronCapacity() below) — bigger/more social props add more room.
// unlockLevel: the level (see levelInfo()) you need to reach before this
// prop can be bought at all. Its price (currentCost()) never moves once
// you're able to buy it — the progression is in WHICH props exist to buy
// at which tier, not in inflating a prop you already have access to.
// Omitted / 1 means available from the very start.
export const PROP_TYPES = {
  bar: {
    key: 'bar', cost: 150, color: 0x2fd0ff, label: 'Bar', unlockLevel: 1, category: 'Bars',
    staff: 'bartender', drinkPrice: 10,
    rotatable: true,
    // sprite key prefix per facing -> 'bar_0', 'bar_90', 'bar_180', 'bar_270'
    // — Blender-rendered art (back bar with bottle wall, bartender aisle,
    // customer counter; see art/blender/build_bar.py), loaded via assets.js
    // and ClubScene.preload().
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
    // Sprite size and anchor come straight from the Blender render script
    // (art/blender/build_bar.py), which models the bar at 1 unit = 1 tile
    // and calculates these from its fixed camera, so the bar fills exactly
    // its 1x3 footprint.
    displayWidth: barSprite.displayWidth,
    originX: barSprite.originX,
    originY: barSprite.originY,
  },
  // The Bars tab's own unlock-tier item, same idea as neonFloor/vipLounge/
  // neonSign: a pricier, better option that opens up once you've leveled
  // up, rather than the starter Bar just staying the only choice forever.
  // Unlike the plain Bar (no fanRate of its own — see isNearRevenueProp(),
  // which special-cases the 'bar' key so it still counts as a tip-boosting
  // revenue prop), this one earns its own passive fan rate too.
  premiumBar: { key: 'premiumBar', cost: 320, color: 0x2fa0ff, label: 'Premium Bar', fanRate: 0.8, unlockLevel: 4, category: 'Bars',
    staff: 'bartender', drinkPrice: 16 },
  dj:    {
    key: 'dj', cost: 250, label: 'DJ Booth', fanRate: 1.2, unlockLevel: 1, category: 'Booths',
    staff: 'dj',
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
