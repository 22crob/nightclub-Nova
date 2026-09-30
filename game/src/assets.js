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
import patronMeta from './assets/sprites/patrons/patrons.json';

// Keyed by facing in degrees.
export const BAR_SPRITES = { 0: bar0, 90: bar90, 180: bar180, 270: bar270 };
export const DJ_BOOTH_SPRITES = { 0: dj0, 90: dj90, 180: dj180, 270: dj270 };

// Chibi patrons (art/blender/build_patrons.py): one spritesheet per
// character, each holding idle / walk / dance rows facing front and back.
// PATRON_META describes the frame grid and the anchor point between the feet.
const patronSheets = import.meta.glob('./assets/sprites/patrons/patron_*.png', { eager: true, import: 'default' });
export const PATRON_SHEETS = Object.keys(patronSheets).sort().map((k) => patronSheets[k]);
export const PATRON_META = patronMeta;
