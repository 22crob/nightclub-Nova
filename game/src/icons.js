// Shop / selection-chip icon rendering (plain <canvas>, no Phaser).
import { SPRITE_URLS } from './assets.js';
import { PROP_TYPES } from './catalog.js';
import { FLOOR_STYLES, floorFrameCanvas } from './floors.js';
import { WALL_STYLES, wallSwatchCanvas } from './walls.js';

// Renders a small PNG data-URL of a prop's base color as a mini isometric
// box (or a flat diamond for `isFlat` ground-decal props, e.g. the dance
// floor) using plain <canvas> — completely separate from Phaser, so the
// build-bar icons can be built before the game canvas even exists, and so
// they read as little 3D chips instead of flat color swatches, matching
// the shaded boxes drawn for placed props in ClubScene.drawIsoBox().
export function renderIsoIcon(color, isFlat) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const shade = (hex, factor) => {
    const r = (hex >> 16) & 0xff, g = (hex >> 8) & 0xff, b = hex & 0xff;
    const blend = (c) => (factor >= 0
      ? Math.round(c + (255 - c) * factor)
      : Math.round(c * (1 + factor)));
    return `rgb(${blend(r)},${blend(g)},${blend(b)})`;
  };

  const cx = size / 2;
  const hw = size * 0.36;
  const hh = hw * 0.5; // same 2:1 diamond ratio as the game's tiles
  const propH = isFlat ? 0 : size * 0.32;
  const baseY = size * 0.68;

  const gTop = { x: cx, y: baseY - hh };
  const gRight = { x: cx + hw, y: baseY };
  const gBottom = { x: cx, y: baseY + hh };
  const gLeft = { x: cx - hw, y: baseY };
  const lift = (p) => ({ x: p.x, y: p.y - propH });
  const tTop = lift(gTop), tRight = lift(gRight), tBottom = lift(gBottom), tLeft = lift(gLeft);

  const topColor = shade(color, 0.35);
  const rightColor = shade(color, -0.08);
  const leftColor = shade(color, -0.32);

  const poly = (pts, fill) => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };

  if (isFlat) {
    poly([gTop, gRight, gBottom, gLeft], topColor);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    poly([gLeft, gBottom, tBottom, tLeft], leftColor);
    poly([gRight, gBottom, tBottom, tRight], rightColor);
    poly([tTop, tRight, tBottom, tLeft], topColor);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tLeft.x, tLeft.y);
    ctx.lineTo(tTop.x, tTop.y);
    ctx.lineTo(tRight.x, tRight.y);
    ctx.lineTo(gRight.x, gRight.y);
    ctx.lineTo(gBottom.x, gBottom.y);
    ctx.lineTo(gLeft.x, gLeft.y);
    ctx.lineTo(tLeft.x, tLeft.y);
    ctx.moveTo(tBottom.x, tBottom.y);
    ctx.lineTo(gBottom.x, gBottom.y);
    ctx.stroke();
  }

  return canvas.toDataURL();
}

// Real sprite art for a rotatable prop (see assets.js), used as a plain
// image URL rather than a Phaser texture, since the two spots that use this
// (renderShopItems()'s prop buttons and updateSelectedChip()'s "currently
// holding" pill) build plain HTML <div> icons, not Phaser game objects.
// Returns null for anything without real art yet, so those callers fall
// back to the rendered iso-box chip from renderIsoIcon() above instead.
const floorIcons = {};
export function realSpriteIconFor(key) {
  const def = PROP_TYPES[key];
  if (def && def.floorStyle) {
    // A lit frame for animated floors, so the icon shows them in action.
    const style = def.floorStyle;
    const frame = Math.min(FLOOR_STYLES[style].frames - 1, FLOOR_STYLES[style].phase === 'step' ? 7 : 2);
    return (floorIcons[key] ||= floorFrameCanvas(style, frame).toDataURL());
  }
  if (def && def.wallStyle) {
    const frame = Math.min(WALL_STYLES[def.wallStyle].frames - 1, 2);
    return (floorIcons[key] ||= wallSwatchCanvas(def.wallStyle, frame).toDataURL());
  }
  return (def && def.sprites && SPRITE_URLS[def.sprites[0]]) || null;
}
