// Sprite image URLs. Vite turns each import into a URL for `npm run dev`,
// and into an embedded data URI in the single-file build (see
// vite.config.js), so the built index.html still works when opened
// straight from disk.
import bar0 from './assets/sprites/bar_0.png';
import bar90 from './assets/sprites/bar_90.png';
import bar180 from './assets/sprites/bar_180.png';
import bar270 from './assets/sprites/bar_270.png';
import dj0 from './assets/sprites/dj_0.png';
import dj90 from './assets/sprites/dj_90.png';
import dj180 from './assets/sprites/dj_180.png';
import dj270 from './assets/sprites/dj_270.png';
import patronWalk from './assets/sprites/patron_walk.png';
import patronDance from './assets/sprites/patron_dance.png';

// Keyed by facing in degrees.
export const BAR_SPRITES = { 0: bar0, 90: bar90, 180: bar180, 270: bar270 };
export const DJ_BOOTH_SPRITES = { 0: dj0, 90: dj90, 180: dj180, 270: dj270 };

// Patron spritesheets: one shared character model (Mixamo rig), one grid
// spritesheet per animation clip, rendered at the game's 2:1 camera angle.
export const CHARACTER_SPRITES = { walk: patronWalk, dance: patronDance };
export const CHARACTER_ANIM_INFO = {
  walk: { frameWidth: 68, frameHeight: 140, count: 8, originX: 0.5954, originY: 0.908 },
  dance: { frameWidth: 110, frameHeight: 140, count: 96, originX: 0.5995, originY: 0.8683 },
};
