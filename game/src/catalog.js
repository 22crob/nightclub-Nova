// The shop catalog: every buyable prop, shop tabs, and club expansion tiers.
import barSprite from './assets/sprites/bar.json';
import barStarterSprite from './assets/sprites/bar_starter.json';
import barWoodSprite from './assets/sprites/bar_wood.json';
import barNeonSprite from './assets/sprites/bar_neon.json';
import barIceSprite from './assets/sprites/bar_ice.json';
import bar_tikiSprite from './assets/sprites/bar_tiki.json';
import bar_surfSprite from './assets/sprites/bar_surf.json';
import bar_dinerSprite from './assets/sprites/bar_diner.json';
import bar_gardenSprite from './assets/sprites/bar_garden.json';
import bar_warehouseSprite from './assets/sprites/bar_warehouse.json';
import bar_speakeasySprite from './assets/sprites/bar_speakeasy.json';
import bar_discoSprite from './assets/sprites/bar_disco.json';
import bar_candySprite from './assets/sprites/bar_candy.json';
import bar_marbleSprite from './assets/sprites/bar_marble.json';
import bar_cyberSprite from './assets/sprites/bar_cyber.json';
import boothWoodSprite from './assets/sprites/dj_wood.json';
import boothProSprite from './assets/sprites/dj_pro.json';
import boothClubSprite from './assets/sprites/dj_club.json';
import boothNeonSprite from './assets/sprites/dj_neon.json';
import boothIceSprite from './assets/sprites/dj_ice.json';
import boothCrateSprite from './assets/sprites/dj_crate.json';
import boothBrickSprite from './assets/sprites/dj_brick.json';
import boothTheatreSprite from './assets/sprites/dj_theatre.json';
import boothTrussSprite from './assets/sprites/dj_truss.json';
import boothScreenSprite from './assets/sprites/dj_screen.json';
import boothDecoSprite from './assets/sprites/dj_deco.json';
import boothHoloSprite from './assets/sprites/dj_holo.json';
import seat_woodStool from './assets/sprites/seat_woodStool.json';
import seat_couch from './assets/sprites/seat_couch.json';
import decor_bottleShelf from './assets/sprites/decor_bottleShelf.json';
import decor_trussLights from './assets/sprites/decor_trussLights.json';
import decor_glassDivider from './assets/sprites/decor_glassDivider.json';
import decor_bubbleColumn from './assets/sprites/decor_bubbleColumn.json';
import decor_ribbon from './assets/sprites/decor_ribbon.json';
import decor_tankTube from './assets/sprites/decor_tankTube.json';
import decor_popStar from './assets/sprites/decor_popStar.json';
import decor_cubeStack from './assets/sprites/decor_cubeStack.json';
import decor_tankCabinet from './assets/sprites/decor_tankCabinet.json';
import decor_rapper from './assets/sprites/decor_rapper.json';
import decor_tankHex from './assets/sprites/decor_tankHex.json';
import decor_tankLong from './assets/sprites/decor_tankLong.json';
import decor_rocker from './assets/sprites/decor_rocker.json';
import decor_jellyBowl from './assets/sprites/decor_jellyBowl.json';
import decor_tankArch from './assets/sprites/decor_tankArch.json';
import dj_rack from './assets/sprites/dj_rack.json';
import dj_glowFront from './assets/sprites/dj_glowFront.json';
import dj_facet from './assets/sprites/dj_facet.json';
import dj_curve from './assets/sprites/dj_curve.json';
import dj_capsule from './assets/sprites/dj_capsule.json';
import dj_glass from './assets/sprites/dj_glass.json';
import seat_facetBooth from './assets/sprites/seat_facetBooth.json';
import seat_candleTable from './assets/sprites/seat_candleTable.json';
import seat_standingTable from './assets/sprites/seat_standingTable.json';
import seat_stool from './assets/sprites/seat_stool.json';
import seat_leatherCouch from './assets/sprites/seat_leatherCouch.json';
import seat_velvetBooth from './assets/sprites/seat_velvetBooth.json';
import seat_blackBooth from './assets/sprites/seat_blackBooth.json';
import seat_goldBooth from './assets/sprites/seat_goldBooth.json';
import seat_beerBench from './assets/sprites/seat_beerBench.json';
import seat_chesterfield from './assets/sprites/seat_chesterfield.json';
import seat_cruiserSofa from './assets/sprites/seat_cruiserSofa.json';
import seat_woodLounge from './assets/sprites/seat_woodLounge.json';
import seat_tikiHut from './assets/sprites/seat_tikiHut.json';
import seat_decoSofa from './assets/sprites/seat_decoSofa.json';
import seat_tulipLounge from './assets/sprites/seat_tulipLounge.json';
import seat_bathtubSofa from './assets/sprites/seat_bathtubSofa.json';
import seat_glowLounge from './assets/sprites/seat_glowLounge.json';
import seat_fireSectional from './assets/sprites/seat_fireSectional.json';
import seat_kissSofa from './assets/sprites/seat_kissSofa.json';
import seat_gardenGazebo from './assets/sprites/seat_gardenGazebo.json';
import seat_cubeBench from './assets/sprites/seat_cubeBench.json';
import seat_iglooBooth from './assets/sprites/seat_iglooBooth.json';
import seat_donutLounge from './assets/sprites/seat_donutLounge.json';
import seat_rattanSeat from './assets/sprites/seat_rattanSeat.json';
import seat_birdcageBooth from './assets/sprites/seat_birdcageBooth.json';
import seat_shellBooth from './assets/sprites/seat_shellBooth.json';
import seat_cloudBed from './assets/sprites/seat_cloudBed.json';
import seat_discoStage from './assets/sprites/seat_discoStage.json';
import seat_galaxyPods from './assets/sprites/seat_galaxyPods.json';
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
import decor_barrel from './assets/sprites/decor_barrel.json';
import decor_streetLamp from './assets/sprites/decor_streetLamp.json';
import decor_globeLamp from './assets/sprites/decor_globeLamp.json';
import decor_globeLampPink from './assets/sprites/decor_globeLampPink.json';
import decor_crystal from './assets/sprites/decor_crystal.json';
import decor_crystalPink from './assets/sprites/decor_crystalPink.json';
import decor_glowPlinth from './assets/sprites/decor_glowPlinth.json';
import decor_stack from './assets/sprites/decor_stack.json';
import decor_stackPurple from './assets/sprites/decor_stackPurple.json';
import decor_partition from './assets/sprites/decor_partition.json';
import decor_tank from './assets/sprites/decor_tank.json';
import decor_tankBlue from './assets/sprites/decor_tankBlue.json';
import decor_gargoyle from './assets/sprites/decor_gargoyle.json';
import decor_robot from './assets/sprites/decor_robot.json';
import decor_catStatue from './assets/sprites/decor_catStatue.json';
import decor_waterfall from './assets/sprites/decor_waterfall.json';
import decor_pagoda from './assets/sprites/decor_pagoda.json';

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
// differ. They're shop items like any other (the owner's rule): bought,
// placed, moved, put away and sold, each with its own DJ playing; a club
// always keeps at least one (a new club starts with a free Wood Booth, see
// ensureClubBooth()). The key 'dj' stays on the tier-3 Club Booth so older
// saves keep their booth.
const BOOTH_FOOTPRINT = {
  0: [[0, 0], [1, 0], [2, 0]],
  90: [[0, 0], [0, 1], [0, 2]],
  180: [[0, 0], [1, 0], [2, 0]],
  270: [[0, 0], [0, 1], [0, 2]],
};
// DJ booths are compact 2 x 1 desks, like Nightclub City's (the couches
// still use the 3-long BOOTH_FOOTPRINT above).
const DJ_FOOTPRINT = {
  0: [[0, 0], [1, 0]],
  90: [[0, 0], [0, 1]],
  180: [[0, 0], [1, 0]],
  270: [[0, 0], [0, 1]],
};
// Two-tile decorations (the wide aquariums, the glass divider).
const WIDE_2X1 = DJ_FOOTPRINT;
// The DJ's own tiles, behind the desk (the opposite side from the crowd,
// which faces +gy at 0, +gx at 90, -gy at 180, -gx at 270): part of the
// booth's footprint, so nobody walks or builds there, but not part of the
// desk's art (see getFootprint()).
const DJ_BACK = {
  0: [[0, -1], [1, -1]],
  90: [[-1, 0], [-1, 1]],
  180: [[0, 1], [1, 1]],
  270: [[1, 0], [1, 1]],
};
function boothTier(key, label, cost, unlockLevel, spriteBase, meta) {
  return {
    key, label, cost, unlockLevel, category: 'DJ Booths', fanRate: 1.2,
    staff: 'dj', rotatable: true,
    sprites: { 0: `${spriteBase}_0`, 90: `${spriteBase}_90`, 180: `${spriteBase}_180`, 270: `${spriteBase}_270` },
    footprint: DJ_FOOTPRINT,
    backTiles: DJ_BACK,
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
  // The October 2026 batch, from the owner's main reference screenshots.
  barrel: decor_barrel,
  streetLamp: decor_streetLamp,
  globeLamp: decor_globeLamp,
  globeLampPink: decor_globeLampPink,
  crystal: decor_crystal,
  crystalPink: decor_crystalPink,
  glowPlinth: decor_glowPlinth,
  stack: decor_stack,
  stackPurple: decor_stackPurple,
  partition: decor_partition,
  tank: decor_tank,
  tankBlue: decor_tankBlue,
  gargoyle: decor_gargoyle,
  robot: decor_robot,
  catStatue: decor_catStatue,
  waterfall: decor_waterfall,
  pagoda: decor_pagoda,
  // The owner's own sketches (October 2026, art/blender/decor_batch2.py).
  bottleShelf: decor_bottleShelf,
  trussLights: decor_trussLights,
  glassDivider: decor_glassDivider,
  bubbleColumn: decor_bubbleColumn,
  ribbon: decor_ribbon,
  tankTube: decor_tankTube,
  popStar: decor_popStar,
  cubeStack: decor_cubeStack,
  tankCabinet: decor_tankCabinet,
  rapper: decor_rapper,
  tankHex: decor_tankHex,
  tankLong: decor_tankLong,
  rocker: decor_rocker,
  jellyBowl: decor_jellyBowl,
  tankArch: decor_tankArch,
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
// relative to the piece's centre, with an optional third number for the way
// that seat faces (degrees from the piece's front, like its facings); `sitLift`
// raises a seated patron (stools).
const SEAT_SPRITES = {
  woodStool: seat_woodStool, couch: seat_couch, candleTable: seat_candleTable, standingTable: seat_standingTable, stool: seat_stool,
  leatherCouch: seat_leatherCouch, velvetBooth: seat_velvetBooth, blackBooth: seat_blackBooth, goldBooth: seat_goldBooth,
  // More booths and sofas (art/blender/seating_designs.py), each its own shape.
  beerBench: seat_beerBench,
  chesterfield: seat_chesterfield,
  cruiserSofa: seat_cruiserSofa,
  woodLounge: seat_woodLounge,
  tikiHut: seat_tikiHut,
  decoSofa: seat_decoSofa,
  tulipLounge: seat_tulipLounge,
  bathtubSofa: seat_bathtubSofa,
  glowLounge: seat_glowLounge,
  fireSectional: seat_fireSectional,
  kissSofa: seat_kissSofa,
  gardenGazebo: seat_gardenGazebo,
  cubeBench: seat_cubeBench,
  iglooBooth: seat_iglooBooth,
  donutLounge: seat_donutLounge,
  rattanSeat: seat_rattanSeat,
  birdcageBooth: seat_birdcageBooth,
  shellBooth: seat_shellBooth,
  cloudBed: seat_cloudBed,
  discoStage: seat_discoStage,
  galaxyPods: seat_galaxyPods,
  facetBooth: seat_facetBooth,
};
const SQUARE_3X3 = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]];
const BOOTH_3X3 = { 0: SQUARE_3X3, 90: SQUARE_3X3, 180: SQUARE_3X3, 270: SQUARE_3X3 };
// The Wood Lounge: 3 wide and 2 deep, so a row of them makes one long booth.
const LOUNGE_3X2 = {
  0: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  90: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]],
  180: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  270: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]],
};
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
    // Per facing and seat, where the "in front of this seat" cut-out sits in
    // the piece's image (build_seating.py occluders()); see seatOccluder().
    occluders: meta.occluders || null,
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
  woodBar: barTier('woodBar', 'Wood Bar', 130, 3, 'bar_wood', barWoodSprite),
  bar: barTier('bar', 'Pub Bar', 150, 9, 'bar', barSprite),
  neonBar: barTier('neonBar', 'Neon Bar', 260, 25, 'bar_neon', barNeonSprite),
  iceBar: barTier('iceBar', 'Ice Bar', 400, 30, 'bar_ice', barIceSprite),
  // The ten themed bars (art/blender/bar_designs.py).
  tikiBar: barTier('tikiBar', 'Tiki Bar', 220, 19, 'bar_tiki', bar_tikiSprite),
  surfBar: barTier('surfBar', 'Surf Shack Bar', 300, 16, 'bar_surf', bar_surfSprite),
  dinerBar: barTier('dinerBar', 'Retro Diner Bar', 340, 11, 'bar_diner', bar_dinerSprite),
  gardenBar: barTier('gardenBar', 'Garden Bar', 380, 14, 'bar_garden', bar_gardenSprite),
  breweryBar: barTier('breweryBar', 'Brewery Bar', 420, 6, 'bar_warehouse', bar_warehouseSprite),
  speakeasyBar: barTier('speakeasyBar', 'Speakeasy Bar', 500, 22, 'bar_speakeasy', bar_speakeasySprite),
  discoBar: barTier('discoBar', 'Disco Bar', 560, 33, 'bar_disco', bar_discoSprite),
  candyBar: barTier('candyBar', 'Candy Bar', 620, 27, 'bar_candy', bar_candySprite),
  marbleBar: barTier('marbleBar', 'Marble Lounge Bar', 750, 36, 'bar_marble', bar_marbleSprite),
  cyberBar: barTier('cyberBar', 'Cyber Bar', 900, 39, 'bar_cyber', bar_cyberSprite),
  woodBooth: boothTier('woodBooth', 'Wood Booth', 180, 1, 'dj_wood', boothWoodSprite),
  crateBooth: boothTier('crateBooth', 'Crate Booth', 195, 3, 'dj_crate', boothCrateSprite),
  proBooth: boothTier('proBooth', 'Pro Booth', 215, 7, 'dj_pro', boothProSprite),
  brickBooth: boothTier('brickBooth', 'Brick Booth', 230, 10, 'dj_brick', boothBrickSprite),
  dj: boothTier('dj', 'Club Booth', 250, 13, 'dj_club', boothClubSprite),
  theatreBooth: boothTier('theatreBooth', 'Theatre Booth', 300, 16, 'dj_theatre', boothTheatreSprite),
  neonBooth: boothTier('neonBooth', 'Neon Booth', 380, 21, 'dj_neon', boothNeonSprite),
  trussBooth: boothTier('trussBooth', 'Truss Booth', 440, 24, 'dj_truss', boothTrussSprite),
  screenBooth: boothTier('screenBooth', 'LED Screen Booth', 500, 27, 'dj_screen', boothScreenSprite),
  iceBooth: boothTier('iceBooth', 'Ice Booth', 550, 29, 'dj_ice', boothIceSprite),
  decoBooth: boothTier('decoBooth', 'Art Deco Booth', 650, 33, 'dj_deco', boothDecoSprite),
  holoBooth: boothTier('holoBooth', 'Holo Booth', 800, 38, 'dj_holo', boothHoloSprite),
  // The owner's sketched DJ sets (art/blender/booth_batch2.py), the fanciest.
  rackBooth: boothTier('rackBooth', 'Steel Rack Booth', 900, 41, 'dj_rack', dj_rack),
  glowPanelBooth: boothTier('glowPanelBooth', 'Glow Panel Booth', 1000, 44, 'dj_glowFront', dj_glowFront),
  facetBooth: boothTier('facetBooth', 'Faceted Booth', 1100, 47, 'dj_facet', dj_facet),
  curveBooth: boothTier('curveBooth', 'Curve Booth', 1200, 50, 'dj_curve', dj_curve),
  capsuleBooth: boothTier('capsuleBooth', 'Capsule Booth', 1350, 53, 'dj_capsule', dj_capsule),
  glassBooth: boothTier('glassBooth', 'Glass Booth', 1500, 56, 'dj_glass', dj_glass),
  // Floors take turns unlocking, one a level: a regular floor on odd
  // levels and a dance floor on even ones (the last two are both dance
  // floors), simple to fancy, so they sit side by side in the shop. Level 1
  // also has the Basic Floor, the dance floor a new club starts with.
  // Regular floors:
  fpConcrete: paintTier('fpConcrete', 'Concrete', 3, 1, 'concrete'),
  fpTile: paintTier('fpTile', 'Plain Tile', 4, 2, 'plainTile'),
  fpStone: paintTier('fpStone', 'Stone Tiles', 5, 4, 'stone'),
  fpWood: paintTier('fpWood', 'Wood Planks', 6, 7, 'planks'),
  fpRedCarpet: paintTier('fpRedCarpet', 'Red Carpet', 7, 10, 'redCarpet'),
  fpPurpleCarpet: paintTier('fpPurpleCarpet', 'Purple Carpet', 9, 13, 'purpleCarpet'),
  fpMarble: paintTier('fpMarble', 'Marble', 12, 17, 'marble'),
  fpBlackGloss: paintTier('fpBlackGloss', 'Black Gloss', 15, 23, 'blackGloss'),
  fpGoldMarble: paintTier('fpGoldMarble', 'Gold Marble', 20, 29, 'goldMarble'),
  fpStarry: paintTier('fpStarry', 'Starry Glass', 24, 35, 'starryGlass'),
  // Dance floors (src/floors.js, drawn in code): simple to fancy, all with
  // the same gameplay. Floors are the ONLY
  // category that grants patron capacity (see patronCapacity()); a
  // `capacity` field on a Bars/Booths/Decorations item is inert by design.
  // 'dance' and 'neonFloor' are the keys of the two original floors, kept
  // so older saves load them as Checker and Light-Up.
  basicFloor: floorTier('basicFloor', 'Basic Floor', 15, 1, 'basic'),
  plainFloor: floorTier('plainFloor', 'Plain Floor', 20, 3, 'plain'),
  dance: floorTier('dance', 'Checker Floor', 25, 4, 'checker'),
  softGlowFloor: floorTier('softGlowFloor', 'Soft Glow', 30, 5, 'softGlow'),
  woodFloor: floorTier('woodFloor', 'Wood Floor', 35, 6, 'parquet'),
  bluePulseFloor: floorTier('bluePulseFloor', 'Blue Pulse', 40, 7, 'bluePulse'),
  pinkPulseFloor: floorTier('pinkPulseFloor', 'Pink Pulse', 45, 8, 'pinkPulse'),
  twoToneFloor: floorTier('twoToneFloor', 'Two-Tone Blink', 50, 11, 'twoTone'),
  glowFloor: floorTier('glowFloor', 'Glow Floor', 55, 14, 'glow'),
  neonFloor: floorTier('neonFloor', 'Light-Up Floor', 70, 17, 'lightUp'),
  ringFloor: floorTier('ringFloor', 'Neon Rings', 90, 20, 'neonRings'),
  waveFloor: floorTier('waveFloor', 'Color Wave', 110, 24, 'wave'),
  rainbowFloor: floorTier('rainbowFloor', 'Rainbow Flow', 130, 28, 'rainbow'),
  stepFloor: floorTier('stepFloor', 'Step Floor', 155, 32, 'step'),
  galaxyFloor: floorTier('galaxyFloor', 'Galaxy Swirl', 185, 37, 'galaxy'),
  // Seating, simple to fancy. 'table' and 'vipLounge' are the keys of the
  // original placeholder Table and VIP Lounge, kept for old saves.
  woodStool: seatTier('woodStool', 'Wood Stool', 40, 1, 'woodStool', 0.1),
  couch: seatTier('couch', 'Fabric Couch', 90, 2, 'couch', 0.2, BOOTH_FOOTPRINT),
  standingTable: seatTier('standingTable', 'Standing Table', 50, 1, 'standingTable', 0.1),
  table: seatTier('table', 'Candle Table', 60, 4, 'candleTable', 0.2),
  barStool: seatTier('barStool', 'Chrome Bar Stool', 70, 7, 'stool', 0.2),
  leatherCouch: seatTier('leatherCouch', 'Leather Couch', 160, 9, 'leatherCouch', 0.3, BOOTH_FOOTPRINT),
  vipLounge: seatTier('vipLounge', 'Red Velvet Booth', 280, 10, 'velvetBooth', 0.5, BOOTH_3X3),
  blackBooth: seatTier('blackBooth', 'Black Leather Booth', 360, 14, 'blackBooth', 0.6, BOOTH_3X3),
  goldBooth: seatTier('goldBooth', 'Gold VIP Booth', 500, 20, 'goldBooth', 0.8, BOOTH_3X3),
  // More booths and sofas, each its own shape, a couple a level up to 20.
  beerBench: seatTier('beerBench', 'Beer Hall Bench', 120, 5, 'beerBench', 0.25, BOOTH_FOOTPRINT),
  chesterfield: seatTier('chesterfield', 'Chesterfield', 180, 8, 'chesterfield', 0.3, BOOTH_FOOTPRINT),
  cruiserSofa: seatTier('cruiserSofa', 'Cruiser Car Seat', 220, 11, 'cruiserSofa', 0.35, BOOTH_FOOTPRINT),
  woodLounge: seatTier('woodLounge', 'Wood Lounge', 300, 12, 'woodLounge', 0.45, LOUNGE_3X2),
  tikiHut: seatTier('tikiHut', 'Tiki Hut', 380, 15, 'tikiHut', 0.5, BOOTH_3X3),
  decoSofa: seatTier('decoSofa', 'Art Deco Sofa', 260, 13, 'decoSofa', 0.4, BOOTH_FOOTPRINT),
  tulipLounge: seatTier('tulipLounge', 'Tulip Lounge', 420, 18, 'tulipLounge', 0.55, BOOTH_3X3),
  bathtubSofa: seatTier('bathtubSofa', 'Bathtub Sofa', 300, 16, 'bathtubSofa', 0.45, BOOTH_FOOTPRINT),
  glowLounge: seatTier('glowLounge', 'Glow Lounge', 520, 23, 'glowLounge', 0.6, BOOTH_3X3),
  fireSectional: seatTier('fireSectional', 'Fire Pit Sectional', 480, 21, 'fireSectional', 0.6, BOOTH_3X3),
  kissSofa: seatTier('kissSofa', 'Kiss Sofa', 350, 17, 'kissSofa', 0.5, BOOTH_FOOTPRINT),
  gardenGazebo: seatTier('gardenGazebo', 'Garden Gazebo', 600, 24, 'gardenGazebo', 0.7, BOOTH_3X3),
  cubeBench: seatTier('cubeBench', 'LED Cube Bench', 380, 19, 'cubeBench', 0.55, BOOTH_FOOTPRINT),
  iglooBooth: seatTier('iglooBooth', 'Igloo', 700, 25, 'iglooBooth', 0.75, BOOTH_3X3),
  donutLounge: seatTier('donutLounge', 'Donut Lounge', 750, 26, 'donutLounge', 0.8, BOOTH_3X3),
  rattanSeat: seatTier('rattanSeat', 'Peacock Love Seat', 450, 22, 'rattanSeat', 0.6, BOOTH_FOOTPRINT),
  birdcageBooth: seatTier('birdcageBooth', 'Birdcage', 850, 28, 'birdcageBooth', 0.85, BOOTH_3X3),
  shellBooth: seatTier('shellBooth', 'Giant Clam', 900, 30, 'shellBooth', 0.9, BOOTH_3X3),
  cloudBed: seatTier('cloudBed', 'Cloud Nine Bed', 1000, 32, 'cloudBed', 0.95, BOOTH_3X3),
  discoStage: seatTier('discoStage', 'Disco Stage', 1200, 34, 'discoStage', 1.0, BOOTH_3X3),
  gemLounge: seatTier('gemLounge', 'Gem Lounge', 1450, 39, 'facetBooth', 1.15, BOOTH_3X3), // the owner's Booth 7 sketch
  galaxyPods: seatTier('galaxyPods', 'Galaxy Egg Pods', 1350, 36, 'galaxyPods', 1.1, BOOTH_3X3),
  // Decorations, simple to fancy. 'plant', 'discoBall' and 'neonSign' are
  // the keys of the original placeholder decorations, kept for old saves.
  crates: decorTier('crates', 'Beer Crates', 40, 1, 'crates', 0.15),
  plant: decorTier('plant', 'Potted Fern', 50, 1, 'fern', 0.2),
  woodSpeaker: decorTier('woodSpeaker', 'Wood Speaker', 80, 2, 'woodSpeaker', 0.3, { speakerCones: 'woodSpeaker' }),
  discoBall: decorTier('discoBall', 'Disco Ball', 120, 6, 'disco', 0.45, { lightRig: true, discoGlow: true }), // glows (createDiscoGlow())
  velvetRope: decorTier('velvetRope', 'Velvet Rope', 90, 3, 'rope', 0.3),
  palm: decorTier('palm', 'Palm Tree', 110, 5, 'palm', 0.35),
  lavaLamp: decorTier('lavaLamp', 'Lava Lamp', 140, 8, 'lava', 0.45),
  speakerTower: decorTier('speakerTower', 'Speaker Tower', 160, 9, 'speaker', 0.5, { speakerCones: 'speaker' }),
  neonSign: decorTier('neonSign', 'Neon Sign', 200, 11, 'neonSign', 0.6),
  glowTube: decorTier('glowTube', 'Glow Tube', 220, 13, 'tube', 0.6),
  poolTable: decorTier('poolTable', 'Pool Table', 300, 15, 'pool', 0.7, { footprint: BOOTH_FOOTPRINT }),
  spotlight: decorTier('spotlight', 'Spotlight', 260, 18, 'spotlight', 0.7, { spotBeam: true }), // shines a beam (createSpotBeam())
  aquarium: decorTier('aquarium', 'Aquarium', 350, 22, 'aquarium', 0.8, { tankFx: 'aquarium' }),
  neonSpeaker: decorTier('neonSpeaker', 'Neon Speaker', 380, 26, 'neonSpeaker', 0.85, { speakerCones: 'neonSpeaker' }),
  trophy: decorTier('trophy', 'Gold Trophy', 450, 31, 'trophy', 0.9),
  luckyCat: decorTier('luckyCat', 'Lucky Cat', 550, 35, 'luckyCat', 1.0),
  // The October 2026 batch (art/references/main): simple pieces early,
  // glowing showpieces later, some in two colours.
  barrel: decorTier('barrel', 'Oak Barrel', 70, 4, 'barrel', 0.25),
  streetLamp: decorTier('streetLamp', 'Street Lamp', 120, 7, 'streetLamp', 0.4),
  globeLamp: decorTier('globeLamp', 'Globe Lamp', 170, 10, 'globeLamp', 0.5),
  crystal: decorTier('crystal', 'Crystal Column', 210, 12, 'crystal', 0.55),
  glowPlinth: decorTier('glowPlinth', 'Glow Plinth', 230, 14, 'glowPlinth', 0.6),
  globeLampPink: decorTier('globeLampPink', 'Pink Globe Lamp', 250, 16, 'globeLampPink', 0.62),
  speakerStack: decorTier('speakerStack', 'Speaker Stack', 280, 17, 'stack', 0.65, { speakerCones: 'stack' }),
  crystalPink: decorTier('crystalPink', 'Pink Crystal Column', 300, 20, 'crystalPink', 0.7),
  partition: decorTier('partition', 'Glass Screen', 320, 21, 'partition', 0.72),
  liquidTank: decorTier('liquidTank', 'Purple Liquid Tank', 380, 24, 'tank', 0.8, { tankFx: 'liquid' }),
  gargoyle: decorTier('gargoyle', 'Gargoyle', 400, 25, 'gargoyle', 0.82),
  speakerStackPurple: decorTier('speakerStackPurple', 'Purple Speaker Stack', 420, 27, 'stackPurple', 0.85, { speakerCones: 'stackPurple' }),
  robot: decorTier('robot', 'Retro Robot', 460, 28, 'robot', 0.88),
  catStatue: decorTier('catStatue', 'Cat Statue', 480, 30, 'catStatue', 0.9),
  waterfall: decorTier('waterfall', 'Glass Waterfall', 560, 33, 'waterfall', 1.0),
  liquidTankBlue: decorTier('liquidTankBlue', 'Blue Liquid Tank', 520, 34, 'tankBlue', 0.95, { tankFx: 'liquid' }),
  pagoda: decorTier('pagoda', 'Pagoda Statue', 650, 38, 'pagoda', 1.1),
  // The owner's own sketches (October 2026): one every two levels past the
  // rest (there's no level cap).
  bottleCabinet: decorTier('bottleCabinet', 'Bottle Cabinet', 800, 40, 'bottleShelf', 1.12, { footprint: WIDE_2X1 }),
  trussLights: decorTier('trussLights', 'Truss Spotlights', 850, 42, 'trussLights', 1.14, { footprint: BOOTH_FOOTPRINT, sweepBeams: 'truss' }),
  glassDivider: decorTier('glassDivider', 'Glass Divider', 900, 44, 'glassDivider', 1.16, { footprint: WIDE_2X1 }),
  bubbleColumn: decorTier('bubbleColumn', 'Bubble Column', 950, 46, 'bubbleColumn', 1.18, { tankFx: 'column' }),
  ribbon: decorTier('ribbon', 'Ribbon Sculpture', 1000, 48, 'ribbon', 1.2),
  tubeAquarium: decorTier('tubeAquarium', 'Tube Aquarium', 1050, 50, 'tankTube', 1.22, { tankFx: 'tube' }),
  popStar: decorTier('popStar', 'Pop Star Statue', 1100, 52, 'popStar', 1.24),
  glowCubes: decorTier('glowCubes', 'Glow Cubes', 1150, 54, 'cubeStack', 1.26),
  cabinetAquarium: decorTier('cabinetAquarium', 'Cabinet Aquarium', 1200, 56, 'tankCabinet', 1.28, { footprint: WIDE_2X1, tankFx: 'cabinet' }),
  rapperStatue: decorTier('rapperStatue', 'Rapper Statue', 1250, 58, 'rapper', 1.3),
  hexAquarium: decorTier('hexAquarium', 'Hex Aquarium', 1300, 60, 'tankHex', 1.32, { tankFx: 'hex' }),
  longAquarium: decorTier('longAquarium', 'Long Aquarium', 1350, 62, 'tankLong', 1.34, { footprint: BOOTH_FOOTPRINT, tankFx: 'long' }),
  rockStar: decorTier('rockStar', 'Rock Star Statue', 1400, 64, 'rocker', 1.36),
  jellyTank: decorTier('jellyTank', 'Jellyfish Tank', 1500, 66, 'jellyBowl', 1.38, { footprint: WIDE_2X1, tankFx: 'jelly' }),
  archAquarium: decorTier('archAquarium', 'Arch Aquarium', 1600, 68, 'tankArch', 1.4, { footprint: WIDE_2X1, tankFx: 'arch' }),
  // Wallpaper (src/walls.js, drawn in code): simple to fancy across the
  // first ten levels.
  wpPaint: wallTier('wpPaint', 'Paint', 8, 1, 'paint'),
  wpOldBrick: wallTier('wpOldBrick', 'Old Brick', 6, 2, 'oldBrick'),
  wpCinder: wallTier('wpCinder', 'Cinder Block', 9, 3, 'cinderBlock'),
  wpBrick: wallTier('wpBrick', 'Brick', 11, 4, 'brick'),
  wpStripes: wallTier('wpStripes', 'Stripes', 15, 5, 'stripes'),
  wpSubway: wallTier('wpSubway', 'Subway Tile', 16, 6, 'subwayTile'),
  wpWainscot: wallTier('wpWainscot', 'Wood Panel', 19, 8, 'wainscot'),
  wpPlanks: wallTier('wpPlanks', 'Wood Planks', 20, 9, 'woodPlanks'),
  wpDots: wallTier('wpDots', 'Retro Dots', 22, 10, 'retroDots'),
  wpVelvet: wallTier('wpVelvet', 'Velvet', 30, 12, 'damask'),
  wpTheatre: wallTier('wpTheatre', 'Theatre Red', 34, 14, 'theatreRed'),
  wpNeon: wallTier('wpNeon', 'Neon Strip', 38, 15, 'neonStrip'),
  wpSpeakers: wallTier('wpSpeakers', 'Speaker Wall', 42, 17, 'speakerWall'),
  wpEq: wallTier('wpEq', 'Equalizer', 45, 19, 'equalizer'),
  wpArches: wallTier('wpArches', 'Black Arches', 50, 21, 'blackArches'),
  wpMirror: wallTier('wpMirror', 'Mirror Tiles', 56, 23, 'mirror'),
  wpBottles: wallTier('wpBottles', 'Bottle Shelf', 64, 25, 'bottleShelf'),
  wpChevron: wallTier('wpChevron', 'Neon Chevron', 71, 27, 'chevron'),
  wpPurpleGlow: wallTier('wpPurpleGlow', 'Purple Glow', 80, 29, 'purpleGlow'),
  wpLed: wallTier('wpLed', 'LED Wall', 90, 31, 'ledWall'),
  wpIce: wallTier('wpIce', 'Ice Panels', 96, 33, 'icePanels'),
  wpLedDots: wallTier('wpLedDots', 'LED Lights', 100, 35, 'ledDots'),
  wpHolo: wallTier('wpHolo', 'Holo Wall', 110, 38, 'holo'),
};

// Mood lighting (see lighting.js): props that give off light cast a soft
// glow on the floor around them: [colour, radius in tiles].
const PROP_LIGHTS = {
  bar: [0xffa050, 1.4], neonBar: [0xc040ff, 2.0], iceBar: [0x60c8ff, 2.0],
  tikiBar: [0xff8a1f, 1.5], dinerBar: [0xff3b5a, 1.4], breweryBar: [0xffb04a, 1.3], speakeasyBar: [0xffb04a, 1.4],
  discoBar: [0xff60c0, 2.0], candyBar: [0xff9ad0, 1.4], cyberBar: [0x23e4ff, 2.0], surfBar: [0xffd23f, 1.2],
  proBooth: [0xffb45a, 1.0], dj: [0xff60c0, 1.2], neonBooth: [0xc040ff, 1.8], iceBooth: [0x60c8ff, 1.8],
  lavaLamp: [0xff3a28, 1.5], glowTube: [0x30c0ff, 1.6], neonSign: [0xff40c0, 1.6], aquarium: [0x3080ff, 1.5],
  speakerTower: [0x30e0ff, 0.9], neonSpeaker: [0xc040ff, 1.3], discoBall: [0xc8c8ff, 1.2], spotlight: [0xfff0c0, 1.6],
  trophy: [0xffc040, 0.9], table: [0xffa040, 1.0], vipLounge: [0xffa040, 1.3], blackBooth: [0xffa040, 1.3],
  goldBooth: [0xffc060, 1.8],
  theatreBooth: [0xffc060, 1.2], trussBooth: [0xfff0c0, 1.5], screenBooth: [0x80c0ff, 1.8], decoBooth: [0xffc060, 1.3],
  holoBooth: [0xff80ff, 2.0],
  trussLights: [0xff80c0, 1.8],
  bubbleColumn: [0x6a7cff, 1.4],
  glowCubes: [0x30e0ff, 1.2],
  bottleCabinet: [0xffd8a0, 1.2],
  glassDivider: [0xff60c0, 1.1],
  cabinetAquarium: [0x3080ff, 1.5],
  tubeAquarium: [0x30e0c0, 1.4],
  hexAquarium: [0xa060ff, 1.4],
  longAquarium: [0x30c0ff, 1.7],
  jellyTank: [0xc060ff, 1.6],
  archAquarium: [0xff60c0, 1.6],
  glowPanelBooth: [0xb07aff, 1.8],
  curveBooth: [0xff40a0, 1.6],
  facetBooth: [0xffc060, 1.2],
  rackBooth: [0x50d8ff, 1.2],
  capsuleBooth: [0x40d8ff, 1.8],
  glassBooth: [0x80c8ff, 1.9],
  gemLounge: [0xff50b0, 1.3],
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
// The VIP booths: the only seats you can show a guest to from their card
// (see seatGuest() in scene/guests.js), like Nightclub City's booths.
export const VIP_BOOTHS = new Set(['vipLounge', 'blackBooth', 'goldBooth',
  'woodLounge', 'tikiHut', 'tulipLounge', 'glowLounge', 'fireSectional', 'gardenGazebo', 'iglooBooth', 'donutLounge', 'birdcageBooth', 'shellBooth', 'cloudBed', 'discoStage', 'galaxyPods', 'gemLounge']);

// Expanding adds one row of floor along one of the room's two open edges at
// a time (see expandClub()). How long a wall can get depends on your level:
// each entry is the longest side allowed from that level on. A row costs
// perTile for each tile in it, plus perTileGrowth more per tile for every
// row the wall already has past the starting size.
export const EXPANSION = {
  // One more row per wall every couple of levels, so a club can't outgrow
  // its level by saving up (the owner asked for that).
  limits: [
    { level: 1, size: 10 }, { level: 3, size: 11 }, { level: 5, size: 12 }, { level: 7, size: 13 },
    { level: 9, size: 14 }, { level: 11, size: 15 }, { level: 13, size: 16 }, { level: 15, size: 17 },
    { level: 17, size: 18 }, { level: 19, size: 19 }, { level: 22, size: 20 }, { level: 25, size: 21 },
    { level: 28, size: 22 }, { level: 31, size: 23 }, { level: 34, size: 24 }, { level: 37, size: 25 },
    { level: 40, size: 26 },
  ],
  perTile: 10,
  perTileGrowth: 6,
};

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

// Items taken out of the game: a save that still has one gets this much
// cash back for each, placed or in the inventory (see loadSaveData()).
export const REMOVED_ITEMS = { throneBooth: 1500 };
