// Sprite image URLs. Vite turns each import into a URL for `npm run dev`,
// and into an embedded data URI in the single-file build (see
// vite.config.js), so the built index.html still works when opened
// straight from disk.
import patronMeta from './assets/sprites/patrons/patrons.json';

// Every prop sprite, by file name without '.png' (for example 'bar_0',
// 'bar_neon_90'). A catalog item's `sprites` names its four facings, and
// the matching size/anchor JSON sits next to the PNGs.
const spriteFiles = import.meta.glob('./assets/sprites/*.png', { eager: true, import: 'default' });
export const SPRITE_URLS = Object.fromEntries(
  Object.entries(spriteFiles).map(([path, url]) => [path.split('/').pop().replace(/\.png$/, ''), url]),
);

// Chibi patrons (art/blender/build_patrons.py): one spritesheet per
// character, each holding idle / walk / dance rows facing front and back.
// PATRON_META describes the frame grid and the anchor point between the feet.
const patronSheets = import.meta.glob('./assets/sprites/patrons/patron_*.png', { eager: true, import: 'default' });
export const PATRON_SHEETS = Object.keys(patronSheets).sort().map((k) => patronSheets[k]);
export const PATRON_META = patronMeta;
