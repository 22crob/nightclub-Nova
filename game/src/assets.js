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

// Patrons: one spritesheet per character. The drawn ones
// (patron_00..11.png, art/sprites_from_art.py) share one frame grid,
// patrons.json: idle / walk / dance / sit rows facing front and back. The
// 3D ones from the owner's own model (patron_3d_<look>.png,
// art/blender/build_patron_model1.py) come after them, each with its own
// grid in a JSON beside it and two more clips: drink and sittalk. The
// Neon Cartoon guys (patron_neon<NN>.png, drawn in code as a cut-out puppet
// by art/characters/neon/neon_rig.py) come last, also with a JSON grid.
// patronMetaOf(i) gives any character's grid in one shape: frame size,
// anchor between the feet, standing height, and for each clip_facing its
// first frame (`starts`), with frame counts and speeds per clip.
const patronSheets = import.meta.glob('./assets/sprites/patrons/patron_*.png', { eager: true, import: 'default' });
const patronSheetMetas = import.meta.glob(['./assets/sprites/patrons/patron_3d_*.json', './assets/sprites/patrons/patron_neon*.json'], { eager: true, import: 'default' });
const drawnKeys = Object.keys(patronSheets).filter((k) => /patron_\d+\.png$/.test(k)).sort();
const modelKeys = Object.keys(patronSheets).filter((k) => /patron_3d_\w+\.png$/.test(k)).sort();
const neonKeys = Object.keys(patronSheets).filter((k) => /patron_neon\w+\.png$/.test(k)).sort();
export const PATRON_SHEETS = [...drawnKeys, ...modelKeys, ...neonKeys].map((k) => patronSheets[k]);
export const PATRON_META = patronMeta;
const drawnMeta = {
  ...patronMeta,
  starts: Object.fromEntries(Object.entries(patronMeta.rows).map(([row, r]) => [row, r * patronMeta.columns])),
};
const PATRON_METAS = [
  ...drawnKeys.map(() => drawnMeta),
  ...modelKeys.map((k) => patronSheetMetas[k.replace(/\.png$/, '.json')]),
  ...neonKeys.map((k) => patronSheetMetas[k.replace(/\.png$/, '.json')]),
];
// The characters made from the owner's 3D model.
export const MODEL_PATRONS = modelKeys.map((_, i) => drawnKeys.length + i);
// The guests painted by ChatGPT (art/blender/build_patron_painted.py):
// 3D sheets named in GUEST_LOOKS (config.js).
export const PAINTED_PATRONS = Object.fromEntries(modelKeys.map((k, i) => [k.match(/patron_3d_(\w+)\.png$/)[1], drawnKeys.length + i]));
// The Neon Cartoon characters (art/characters/neon).
export const NEON_PATRONS = neonKeys.map((_, i) => drawnKeys.length + modelKeys.length + i);
export function patronMetaOf(character) {
  return PATRON_METAS[character] || drawnMeta;
}
