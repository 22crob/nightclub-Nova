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

// The buildings across the street (art/blender/build_buildings.py): for
// each, its width along the road and, per facing, the picture's size and
// where the building's centre on the ground lands in it.
const buildingMetas = import.meta.glob('./assets/sprites/bldg_*.json', { eager: true, import: 'default' });
export const BUILDING_META = Object.fromEntries(
  Object.entries(buildingMetas).map(([path, meta]) => [path.split('/').pop().replace(/^bldg_|\.json$/g, ''), meta]),
);

// Patrons: one spritesheet per character, the hand-drawn cut-out puppets
// (patron_cut_<name>.png from art/characters/cutout/cutout_rig.py, each
// with its own grid in a JSON beside it: frame size, anchor between the
// feet, standing height, and for each clip_facing its first frame
// (`starts`), with frame counts and speeds per clip). The older guest
// sheets (the first drawn guys, the 3D-model guys, the Neon Cartoon guy)
// were taken out in October 2026 to keep the page small; their scripts are
// gone too. patrons.json is the old drawn grid, kept as the fallback.
const patronSheets = import.meta.glob('./assets/sprites/patrons/patron_cut_*.png', { eager: true, import: 'default' });
const patronSheetMetas = import.meta.glob('./assets/sprites/patrons/patron_cut_*.json', { eager: true, import: 'default' });
const cutKeys = Object.keys(patronSheets).sort();
export const PATRON_SHEETS = cutKeys.map((k) => patronSheets[k]);
export const PATRON_META = patronMeta;
const drawnMeta = {
  ...patronMeta,
  starts: Object.fromEntries(Object.entries(patronMeta.rows).map(([row, r]) => [row, r * patronMeta.columns])),
};
const PATRON_METAS = cutKeys.map((k) => patronSheetMetas[k.replace(/\.png$/, '.json')]);
// The cut-out guests by name (guy01, suit01...): their character index.
export const CUTOUT_PATRONS = Object.fromEntries(cutKeys.map((k, i) => [k.match(/patron_cut_(\w+)\.png$/)[1], i]));
export function patronMetaOf(character) {
  return PATRON_METAS[character] || drawnMeta;
}
