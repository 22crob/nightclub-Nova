// Tuning numbers for Lumen Vale. Distances are in metres (1 unit = 1 m).

export const SAVE_KEY = 'lumenValeSave_v1';

export const WORLD = {
  size: 512,          // the terrain is size x size metres, centred on 0,0
  cell: 2,            // metres per terrain grid cell
  seed: 1337,
  playRadius: 200,    // the player can't walk further than this from the centre
  waterLevel: 1.0,
  swimDepth: 1.1,     // deeper than this below the water, the player swims
};

export const VILLAGE = { x: 0, z: 0, r: 34, h: 4 };
export const LAKE = { x: 72, z: 64, r: 38 };

// Points of interest. Each one hides a Moonshard.
export const PLACES = {
  stones: { name: 'The Whispering Stones', x: -96, z: -70 },
  tower: { name: 'Old Watchtower', x: 112, z: -92 },
  island: { name: 'Lake Isle', x: LAKE.x, z: LAKE.z },
  grove: { name: 'Glowcap Grove', x: -64, z: 116 },
  ruins: { name: 'Fallen Keep', x: -150, z: 26 },
};

// Dirt paths from the village out to the places.
export const PATHS = [
  [[0, 0], [-40, -30], [-96, -60]],
  [[0, 0], [50, -40], [104, -84]],
  [[0, 0], [30, 30], [44, 46]],
  [[0, 0], [-20, 50], [-60, 104]],
  [[0, 0], [-70, 10], [-140, 24]],
];

export const PLAYER = {
  walk: 6.5,
  sprint: 11,
  swim: 3.6,
  accel: 14,
  jump: 8,
  gravity: 24,
  radius: 0.45,
  maxSlope: 1.25,     // steeper than this (rise / run) can't be walked up
  hearts: 5,
  invulnMs: 1000,
  swingMs: 380,
  hitFrom: 0.25,      // part of the swing when the blade can hit
  hitTo: 0.8,
  reach: 2.6,
};

export const CAMERA = {
  dist: 9, minDist: 4, maxDist: 18,
  pitch: 0.42, minPitch: 0.08, maxPitch: 1.25,
  lookSpeed: 0.005,
};

export const SLIMES = {
  count: 18,
  hp: 3,
  sight: 13,
  speed: 3.2,
  respawnMs: 45000,
  safeRadius: VILLAGE.r + 6,   // slimes never come into the village
  coins: [1, 3],
  nightExtra: 8,               // more slimes come out at night
};

export const DAY = {
  lengthS: 480,   // one full day and night, in seconds
  start: 0.3,     // 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
};

export const QUEST = { shards: 5, reward: 50 };
