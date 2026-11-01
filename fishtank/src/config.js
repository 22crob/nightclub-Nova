// Reef & River: every tuning number and list in one place.

export const SAVE_KEY = 'reefRiverSave_v1';
export const START_CASH = 300;
export const MAX_TANKS = 8;
// Time away is caught up when the game is opened again, up to this much.
export const OFFLINE_MAX_MS = 20 * 60 * 1000;

// Total XP needed to reach each level (index 0 = level 1).
export const LEVEL_XP = [0, 50, 150, 300, 500, 800, 1200, 1700, 2300, 3000, 4000, 5200, 6600, 8200, 10000];
export const MAX_LEVEL = LEVEL_XP.length;

export const XP = {
  perDollarSpent: 0.1, // buying fish, tanks and decorations
  perDollarSold: 0.2, // selling fish
  hatch: 4, // each baby that hatches
  newLook: 15, // a baby that looks like nothing in your Fish Book yet
  grownUp: 3, // a baby growing up
  feed: 2, // feeding a hungry tank
  clean: 3, // cleaning a dirty tank
};

export const WATER = {
  fresh: { name: 'Freshwater', short: 'Fresh', top: '#7fd6c8', mid: '#2f9aa8', bottom: '#165466', sand: ['#8a6a48', '#a7835a', '#6b5038', '#c09a6a'], icon: '🌿' },
  salt: { name: 'Saltwater', short: 'Salt', top: '#7fe0ff', mid: '#1f8fd6', bottom: '#0b3d86', sand: ['#f1dfb2', '#e6cf98', '#fff1cc', '#d8bd84'], icon: '🐚' },
};

// Colours. `tier` is how rare the colour is when it isn't natural for the
// species (0 common .. 3 very rare).
export const COLORS = {
  orange: { name: 'Orange', hex: '#ff8a2a', tier: 0 },
  yellow: { name: 'Yellow', hex: '#ffd23f', tier: 0 },
  red: { name: 'Red', hex: '#e8433a', tier: 0 },
  blue: { name: 'Blue', hex: '#3c8dde', tier: 0 },
  silver: { name: 'Silver', hex: '#c3cfda', tier: 0 },
  white: { name: 'White', hex: '#f7f7f2', tier: 0 },
  black: { name: 'Black', hex: '#33333f', tier: 0 },
  green: { name: 'Green', hex: '#4fc36b', tier: 1 },
  pink: { name: 'Pink', hex: '#ff7bb5', tier: 1 },
  teal: { name: 'Teal', hex: '#22c3bd', tier: 1 },
  purple: { name: 'Purple', hex: '#9b5de5', tier: 2 },
  gold: { name: 'Gold', hex: '#ffbf1a', tier: 2, shine: true },
  electric: { name: 'Electric Blue', hex: '#19c8ff', tier: 2 },
  midnight: { name: 'Midnight', hex: '#2b3290', tier: 2 },
  rainbow: { name: 'Rainbow', hex: '#ff5fa2', tier: 3, rainbow: true },
  ghost: { name: 'Ghost', hex: '#e9f6ff', tier: 3, ghost: true },
};

export const PATTERNS = {
  solid: { name: 'Solid', adj: '', tier: 0 },
  stripes: { name: 'Stripes', adj: 'Striped', tier: 0 },
  spots: { name: 'Spots', adj: 'Spotted', tier: 0 },
  bands: { name: 'Bands', adj: 'Banded', tier: 0 },
  twotone: { name: 'Two-tone', adj: 'Two-tone', tier: 1 },
  gradient: { name: 'Fade', adj: 'Fade', tier: 1 },
  marble: { name: 'Marble', adj: 'Marbled', tier: 2 },
  starry: { name: 'Starry', adj: 'Starry', tier: 3 },
};

// Fin shapes, in order: a baby's fins can only mutate one step.
export const FINS = ['short', 'long', 'veil'];
export const FIN_NAMES = { short: 'Short fins', long: 'Long fins', veil: 'Veiltail' };

export const RARITY = [
  { name: 'Common', color: '#b9c4cf', mult: 1 },
  { name: 'Uncommon', color: '#5fe07a', mult: 2.2 },
  { name: 'Rare', color: '#3fb5ff', mult: 5 },
  { name: 'Epic', color: '#c77dff', mult: 12 },
  { name: 'Legendary', color: '#ffc21a', mult: 30 },
];

// Species. `colors` / `colors2` / `patterns` are what the kind normally
// looks like (anything else counts as unusual and adds rarity). `size` is
// how big it's drawn; `breedMs` how long a happy pair takes to lay eggs;
// `growMs` how long a baby takes to grow up; `base` its sell price when
// common and grown.
export const SPECIES = {
  guppy: {
    name: 'Guppy', water: 'fresh', level: 1, price: 20, base: 12, size: 0.42, speed: 1.15,
    colors: ['orange', 'yellow', 'blue', 'red'], colors2: ['black', 'yellow', 'blue'], patterns: ['solid', 'spots'], fins: 'long',
    breedMs: 45000, growMs: 90000, clutch: [2, 4],
  },
  goldfish: {
    name: 'Goldfish', water: 'fresh', level: 1, price: 35, base: 20, size: 0.6, speed: 0.75,
    colors: ['orange', 'red', 'white'], colors2: ['white', 'orange'], patterns: ['solid', 'twotone'], fins: 'long',
    breedMs: 70000, growMs: 120000, clutch: [2, 3],
  },
  betta: {
    name: 'Betta', water: 'fresh', level: 2, price: 60, base: 35, size: 0.58, speed: 0.7,
    colors: ['red', 'blue', 'purple'], colors2: ['black', 'red', 'blue'], patterns: ['solid', 'gradient'], fins: 'veil',
    breedMs: 90000, growMs: 150000, clutch: [2, 3],
  },
  clownfish: {
    name: 'Clownfish', water: 'salt', level: 3, price: 90, base: 55, size: 0.52, speed: 0.95,
    colors: ['orange'], colors2: ['white'], patterns: ['bands'], fins: 'short',
    breedMs: 100000, growMs: 160000, clutch: [2, 3],
  },
  tang: {
    name: 'Tang', water: 'salt', level: 4, price: 150, base: 90, size: 0.72, speed: 1.1,
    colors: ['blue', 'yellow'], colors2: ['black', 'yellow'], patterns: ['solid', 'twotone'], fins: 'short',
    breedMs: 130000, growMs: 190000, clutch: [1, 2],
  },
  puffer: {
    name: 'Pufferfish', water: 'salt', level: 5, price: 220, base: 130, size: 0.62, speed: 0.55,
    colors: ['yellow', 'silver'], colors2: ['black', 'orange'], patterns: ['spots'], fins: 'short',
    breedMs: 160000, growMs: 220000, clutch: [1, 2],
  },
};

// Tanks. `cap` is how many fish fit; a breeding tank holds two grown-ups
// (`cap`) plus up to `fry` babies.
export const TANKS = {
  fresh_small: { name: 'Small Freshwater Tank', water: 'fresh', kind: 'display', width: 0.6, cap: 6, decor: 6, price: 150, level: 1 },
  fresh_breed: { name: 'Freshwater Breeding Tank', water: 'fresh', kind: 'breeding', width: 0.48, cap: 2, fry: 8, decor: 3, price: 250, level: 1 },
  fresh_medium: { name: 'Freshwater Tank', water: 'fresh', kind: 'display', width: 0.75, cap: 10, decor: 6, price: 500, level: 2 },
  salt_medium: { name: 'Saltwater Tank', water: 'salt', kind: 'display', width: 0.75, cap: 8, decor: 6, price: 1200, level: 3 },
  salt_breed: { name: 'Saltwater Breeding Tank', water: 'salt', kind: 'breeding', width: 0.48, cap: 2, fry: 6, decor: 3, price: 800, level: 3 },
  fresh_large: { name: 'Big Freshwater Tank', water: 'fresh', kind: 'display', width: 0.9, cap: 16, decor: 8, price: 1800, level: 5 },
  salt_large: { name: 'Big Saltwater Tank', water: 'salt', kind: 'display', width: 0.9, cap: 14, decor: 8, price: 3200, level: 6 },
  salt_show: { name: 'Grand Reef Show Tank', water: 'salt', kind: 'display', width: 0.98, cap: 22, decor: 12, price: 8000, level: 8 },
};

// Decorations, drawn in decorArt.js. `water` 'any' fits both kinds of tank.
// `beauty` adds to the tank's rating and visitor tips.
export const DECOR = {
  plant: { name: 'Water Plant', water: 'fresh', level: 1, price: 25, beauty: 1, sway: true },
  rock: { name: 'River Rocks', water: 'any', level: 1, price: 20, beauty: 1 },
  bubbler: { name: 'Bubbler', water: 'any', level: 1, price: 40, beauty: 1, bubbles: true },
  redplant: { name: 'Red Plant', water: 'fresh', level: 2, price: 45, beauty: 2, sway: true },
  driftwood: { name: 'Driftwood', water: 'fresh', level: 2, price: 60, beauty: 2 },
  castle: { name: 'Little Castle', water: 'any', level: 2, price: 90, beauty: 3 },
  starfish: { name: 'Starfish', water: 'salt', level: 3, price: 50, beauty: 2 },
  coral: { name: 'Branch Coral', water: 'salt', level: 3, price: 80, beauty: 3, sway: true },
  braincoral: { name: 'Brain Coral', water: 'salt', level: 3, price: 70, beauty: 2 },
  chest: { name: 'Treasure Chest', water: 'any', level: 4, price: 120, beauty: 3, bubbles: true },
  anemone: { name: 'Sea Anemone', water: 'salt', level: 4, price: 110, beauty: 3, sway: true },
  clam: { name: 'Giant Clam', water: 'salt', level: 5, price: 160, beauty: 4 },
  seafan: { name: 'Sea Fan', water: 'salt', level: 6, price: 180, beauty: 4, sway: true },
  ship: { name: 'Sunken Ship', water: 'any', level: 7, price: 400, beauty: 7, bubbles: true },
};

// Care: how fast food runs out and the water gets dirty (per second; the
// numbers grow with the number of fish in the tank).
export const CARE = {
  foodDrainBase: 0.5 / 480, foodDrainPerFish: 0.1 / 480,
  dirtBase: 0.3 / 720, dirtPerFish: 0.08 / 720,
  breedMinHappy: 0.5, // a breeding pair only gets on with it when this happy
  eggHatchMs: 15000,
  incomeEveryMs: 10000, // visitors tip for display tanks
};
