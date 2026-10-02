// Wallpaper designs, drawn in code (no image files), like the dance floors
// in floors.js. Each design paints one tile-wide strip of wall seen
// straight on; wallFrameCanvas() then shears it onto the left or right
// back wall. Animated designs step through frames while a DJ plays.
//
// A design: { frames, speed, phase, period, draw(ctx, W, H, frame) } where
// W x H is the strip in pixels (W = one tile along the wall). `phase` works
// as in floors.js: 'sync', 'random', or 'flow' (one pattern `period` wall
// tiles long that flows along the whole wall; `frames` must be a multiple
// of `period`). Every design draws its own baseboard at the bottom.

import { DOOR_HEIGHT, TILE_H, TILE_W, WALL_HEIGHT } from './config.js';

// Rendered at 2x and drawn at half size. One tile along a wall moves
// TILE_W/2 x TILE_H/2 game pixels on screen; the wall is WALL_HEIGHT tall.
const STRIP_W = Math.round((TILE_W * 2) / Math.SQRT2); // a tile's true length along the wall, at 2x
const STRIP_H = WALL_HEIGHT * 2;
export const WALL_TEX_W = TILE_W;
export const WALL_TEX_H = STRIP_H + TILE_H;
const BASEBOARD = 10;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function baseboard(ctx, W, H, color = '#3a3a42') {
  ctx.fillStyle = color;
  ctx.fillRect(0, H - BASEBOARD, W, BASEBOARD);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(0, H - BASEBOARD, W, 2);
}

function verticalShade(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(255,255,255,0.08)');
  g.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export const WALL_STYLES = {
  // Plain painted wall in a soft plum.
  paint: {
    frames: 1,
    draw(ctx, W, H) {
      ctx.fillStyle = '#6e5f8e';
      ctx.fillRect(0, 0, W, H);
      verticalShade(ctx, W, H);
      baseboard(ctx, W, H);
    },
  },

  // Red brick.
  brick: {
    frames: 1,
    draw(ctx, W, H) {
      ctx.fillStyle = '#8d8a86';
      ctx.fillRect(0, 0, W, H);
      const r = rng(3);
      const bh = 16, bw = W / 2, gap = 3;
      for (let row = 0; row * bh < H; row++) {
        const off = row % 2 ? bw / 2 : 0;
        for (let k = -1; k < 3; k++) {
          const tone = 150 + Math.floor(r() * 40);
          ctx.fillStyle = `rgb(${tone},${Math.floor(tone * 0.42)},${Math.floor(tone * 0.33)})`;
          ctx.fillRect(k * bw + off + gap / 2, row * bh + gap / 2, bw - gap, bh - gap);
        }
      }
      verticalShade(ctx, W, H);
      baseboard(ctx, W, H, '#2e2e33');
    },
  },

  // Classic vertical stripes with a gold pinstripe.
  stripes: {
    frames: 1,
    draw(ctx, W, H) {
      const n = 4, sw = W / n;
      for (let k = 0; k < n; k++) {
        ctx.fillStyle = k % 2 ? '#1f5f6b' : '#2c8a96';
        ctx.fillRect(k * sw, 0, sw, H);
      }
      ctx.fillStyle = '#e6c25a';
      for (let k = 0; k < n; k += 2) ctx.fillRect(k * sw + sw - 1.5, 0, 3, H);
      verticalShade(ctx, W, H);
      baseboard(ctx, W, H, '#1a2e33');
    },
  },

  // Wood panelling on the lower part, cream paint above.
  wainscot: {
    frames: 1,
    draw(ctx, W, H) {
      const rail = H * 0.58;
      ctx.fillStyle = '#e8dcc0';
      ctx.fillRect(0, 0, W, rail);
      ctx.fillStyle = '#8a5530';
      ctx.fillRect(0, rail, W, H - rail);
      // Raised panel.
      ctx.fillStyle = '#9c6438';
      ctx.fillRect(10, rail + 14, W - 20, H - rail - BASEBOARD - 26);
      ctx.strokeStyle = 'rgba(50,25,10,0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(10, rail + 14, W - 20, H - rail - BASEBOARD - 26);
      // Chair rail.
      ctx.fillStyle = '#6e4122';
      ctx.fillRect(0, rail - 4, W, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(0, rail - 4, W, 2);
      verticalShade(ctx, W, H);
      baseboard(ctx, W, H, '#4a2c16');
    },
  },

  // Pop-art dots on orange.
  retroDots: {
    frames: 1,
    draw(ctx, W, H) {
      ctx.fillStyle = '#ff8a3d';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff1d6';
      const step = W / 3;
      for (let row = 0; row * step < H + step; row++) {
        const off = row % 2 ? step / 2 : 0;
        for (let k = -1; k < 4; k++) {
          ctx.beginPath();
          ctx.arc(k * step + off + step / 2, row * step + step / 2, step * 0.28, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      verticalShade(ctx, W, H);
      baseboard(ctx, W, H, '#5a2a10');
    },
  },

  // Deep velvet with a gold lattice.
  damask: {
    frames: 1,
    draw(ctx, W, H) {
      const bg = ctx.createLinearGradient(0, 0, W, 0);
      bg.addColorStop(0, '#5a1530');
      bg.addColorStop(0.5, '#6e1c3b');
      bg.addColorStop(1, '#5a1530');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      const cw = W / 2, ch = cw * 1.5;
      ctx.strokeStyle = 'rgba(230,190,90,0.75)';
      ctx.lineWidth = 1.5;
      for (let row = -1; row * ch < H + ch; row++) {
        for (let k = 0; k < 2; k++) {
          const cx = k * cw + cw / 2, cy = row * ch + (k % 2 ? ch / 2 : 0);
          ctx.beginPath();
          ctx.moveTo(cx, cy - ch / 2); ctx.lineTo(cx + cw / 2, cy); ctx.lineTo(cx, cy + ch / 2); ctx.lineTo(cx - cw / 2, cy);
          ctx.closePath();
          ctx.stroke();
          // Little four-petal flower in each diamond.
          ctx.fillStyle = 'rgba(230,190,90,0.85)';
          for (let a = 0; a < 4; a++) {
            ctx.beginPath();
            ctx.ellipse(cx + Math.cos(a * Math.PI / 2) * 5, cy + Math.sin(a * Math.PI / 2) * 5, 4, 2.2, a * Math.PI / 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      verticalShade(ctx, W, H);
      baseboard(ctx, W, H, '#2a0a16');
    },
  },

  // The first animated wall: neon tubes that glow brighter on the beat.
  neonStrip: {
    frames: 8,
    speed: 2,
    phase: 'sync',
    draw(ctx, W, H, frame) {
      ctx.fillStyle = '#26232f';
      ctx.fillRect(0, 0, W, H);
      verticalShade(ctx, W, H);
      const k = 0.5 + 0.5 * Math.cos((frame / 8) * Math.PI * 2);
      const tube = (y, color) => {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 8 + 14 * k;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.6 + 0.4 * k;
        ctx.fillRect(0, y, W, 5);
        ctx.restore();
        ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.4 * k})`;
        ctx.fillRect(0, y + 1.5, W, 2);
      };
      tube(H * 0.32, '#ff3dd2');
      tube(H * 0.62, '#3de0ff');
      baseboard(ctx, W, H, '#16141c');
    },
  },

  // Equalizer bars bouncing to the music.
  equalizer: {
    frames: 8,
    speed: 1,
    phase: 'random',
    draw(ctx, W, H, frame) {
      ctx.fillStyle = '#14121c';
      ctx.fillRect(0, 0, W, H);
      const bars = 3, bw = W / bars, cell = 10;
      const top = H * 0.2, bottom = H - BASEBOARD - 12;
      const cells = Math.floor((bottom - top) / cell);
      for (let b = 0; b < bars; b++) {
        const level = 0.25 + 0.75 * Math.abs(Math.sin((frame / 8) * Math.PI * 2 + b * 1.7 + (b * b) * 0.9));
        const lit = Math.round(cells * level);
        for (let c = 0; c < cells; c++) {
          const y = bottom - (c + 1) * cell;
          const f = c / cells;
          const color = f > 0.8 ? '#ff3d5a' : f > 0.55 ? '#ffd23d' : '#3dff8a';
          ctx.fillStyle = c < lit ? color : 'rgba(255,255,255,0.06)';
          ctx.fillRect(b * bw + 6, y + 2, bw - 12, cell - 4);
        }
      }
      baseboard(ctx, W, H, '#0c0b10');
    },
  },

  // Mirror tiles with a glint that glides along the wall.
  mirror: {
    frames: 16,
    speed: 1,
    phase: 'flow',
    period: 4,
    draw(ctx, W, H, frame) {
      const n = 3, c = W / n;
      const shift = (frame / 16) * 4;
      for (let row = 0; row * c < H; row++) {
        for (let k = 0; k < n; k++) {
          const g = ctx.createLinearGradient(k * c, row * c, k * c + c, row * c + c);
          g.addColorStop(0, '#e9eef7');
          g.addColorStop(0.5, '#a9b4c8');
          g.addColorStop(1, '#7d879c');
          ctx.fillStyle = g;
          ctx.fillRect(k * c + 1, row * c + 1, c - 2, c - 2);
        }
      }
      // A bright glint band, part of one pattern 4 tiles long.
      ctx.save();
      for (let x = 0; x < W; x += 3) {
        const pos = (((x / W - shift) / 4) % 1 + 1) % 1;
        const a = Math.pow(Math.max(0, Math.cos(pos * Math.PI * 2)), 12);
        if (a < 0.02) continue;
        ctx.fillStyle = `rgba(255,255,255,${0.75 * a})`;
        ctx.fillRect(x, 0, 3, H);
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(30,30,45,0.6)';
      for (let k = 1; k < n; k++) ctx.fillRect(k * c - 1, 0, 2, H);
      baseboard(ctx, W, H, '#2a2e3a');
    },
  },

  // Neon chevrons that flow along the wall.
  chevron: {
    frames: 16,
    speed: 1,
    phase: 'flow',
    period: 2,
    draw(ctx, W, H, frame) {
      ctx.fillStyle = '#16121f';
      ctx.fillRect(0, 0, W, H);
      // Columns every half tile, alternating pink and blue; `shift` slides
      // them along one 2-tile repeat.
      const shift = (frame / 16) * 2 * W;
      const colors = ['#ff3dd2', '#3de0ff'];
      ctx.lineWidth = 5;
      for (let c = -6; c <= 2; c++) {
        const x = c * (W / 2) + shift;
        if (x < -24 || x > W + 4) continue;
        const color = colors[((c % 2) + 2) % 2];
        ctx.save();
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        for (let y = H * 0.15; y < H * 0.85; y += 28) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + 18, y + 14);
          ctx.lineTo(x, y + 28);
        }
        ctx.stroke();
        ctx.restore();
      }
      baseboard(ctx, W, H, '#0c0a12');
    },
  },

  // A wall of LEDs showing a rainbow wave that flows along the wall.
  ledWall: {
    frames: 24,
    speed: 1,
    phase: 'flow',
    period: 6,
    draw(ctx, W, H, frame) {
      ctx.fillStyle = '#0a0a10';
      ctx.fillRect(0, 0, W, H);
      const shift = (frame / 24) * 6;
      const dot = 9;
      const rows = Math.floor((H - BASEBOARD) / dot);
      for (let cx = 0; cx < W / dot; cx++) {
        const pos = (cx * dot) / W - shift; // in wall tiles
        const phase = (pos / 6) * Math.PI * 2;
        const wave = 0.5 + 0.32 * Math.sin(phase) + 0.1 * Math.sin(phase * 3);
        for (let ry = 0; ry < rows; ry++) {
          const y = ry / rows;
          const near = Math.abs(y - (1 - wave));
          const hue = ((((pos / 6) % 1) + 1) % 1) * 360;
          const lit = near < 0.07 ? 1 : y > 1 - wave ? 0.35 : 0.05;
          ctx.fillStyle = `hsla(${hue | 0},100%,${lit > 0.5 ? 65 : 50}%,${lit})`;
          ctx.beginPath();
          ctx.arc(cx * dot + dot / 2, ry * dot + dot / 2, dot * 0.36, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      baseboard(ctx, W, H, '#050508');
    },
  },
};

// One frame of a design, sheared onto a wall. 'right' is the wall along
// gx (running down-right on screen), 'left' the wall along gy (down-left),
// which is also drawn a little darker, as the room's walls are.
export function wallFrameCanvas(style, frame = 0, side = 'right') {
  const strip = document.createElement('canvas');
  strip.width = STRIP_W;
  strip.height = STRIP_H;
  WALL_STYLES[style].draw(strip.getContext('2d'), STRIP_W, STRIP_H, frame);
  return shearOntoWall(strip, side);
}

// Shears a flat strip (one tile of wall, seen straight on) onto the left or
// right back wall.
function shearOntoWall(strip, side) {
  if (side === 'left') {
    const sctx = strip.getContext('2d');
    sctx.globalCompositeOperation = 'source-atop'; // darken only what's drawn
    sctx.fillStyle = 'rgba(0,0,0,0.15)';
    sctx.fillRect(0, 0, STRIP_W, STRIP_H);
    sctx.globalCompositeOperation = 'source-over';
  }
  const out = document.createElement('canvas');
  out.width = WALL_TEX_W;
  out.height = WALL_TEX_H;
  const ctx = out.getContext('2d');
  const a = WALL_TEX_W / STRIP_W, b = (WALL_TEX_H - STRIP_H) / STRIP_W;
  if (side === 'right') ctx.setTransform(a, b, 0, 1, 0, 0);
  else ctx.setTransform(-a, b, 0, 1, WALL_TEX_W, 0);
  ctx.drawImage(strip, 0, 0);
  return out;
}

// The club's front door, like Nightclub City's: a single brushed-steel
// door with riveted edges, a small glowing porthole, a gold push plate and
// a chrome handle, set into one tile of wall.
export function doorCanvas(side = 'left') {
  const strip = document.createElement('canvas');
  strip.width = STRIP_W;
  strip.height = STRIP_H;
  const ctx = strip.getContext('2d');
  const W = STRIP_W;
  const H = STRIP_H;
  const dh = DOOR_HEIGHT * 2;
  const x0 = 7, x1 = W - 7, top = H - dh;
  // Frame.
  ctx.fillStyle = '#1b1d24';
  ctx.fillRect(x0 - 5, top - 5, x1 - x0 + 10, dh + 5);
  ctx.fillStyle = '#5a5f6b';
  ctx.fillRect(x0 - 3, top - 3, x1 - x0 + 6, 2);
  // Brushed steel leaf.
  const steel = ctx.createLinearGradient(x0, 0, x1, 0);
  steel.addColorStop(0, '#7d8390');
  steel.addColorStop(0.45, '#b9bfca');
  steel.addColorStop(0.55, '#a7adb9');
  steel.addColorStop(1, '#6b717d');
  ctx.fillStyle = steel;
  ctx.fillRect(x0, top, x1 - x0, dh);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  for (let x = x0 + 3; x < x1; x += 4) {
    ctx.beginPath(); ctx.moveTo(x, top + 2); ctx.lineTo(x, H - 2); ctx.stroke();
  }
  // Riveted border.
  ctx.strokeStyle = 'rgba(40,42,50,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x0 + 4, top + 4, x1 - x0 - 8, dh - 8);
  ctx.fillStyle = '#e6e9ef';
  for (let y = top + 9; y < H - 6; y += 13) {
    for (const x of [x0 + 7, x1 - 7]) {
      ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Glowing porthole.
  const cx = W / 2, cy = top + dh * 0.24, r = 9;
  const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
  glow.addColorStop(0, '#ffd6ff');
  glow.addColorStop(0.5, '#d27cff');
  glow.addColorStop(1, '#6a2aa8');
  ctx.save();
  ctx.shadowColor = '#d27cff';
  ctx.shadowBlur = 10;
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.75, r, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#2a2c34';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.75 + 1.5, r + 1.5, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#dfe3ea';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.75 + 3, r + 3, 0, 0, Math.PI * 2); ctx.stroke();
  // Gold push plate and a chrome handle.
  const py = top + dh * 0.52;
  const plate = ctx.createLinearGradient(x0 + 4, 0, x0 + 12, 0);
  plate.addColorStop(0, '#fff0a8');
  plate.addColorStop(1, '#c98a14');
  ctx.fillStyle = plate;
  ctx.fillRect(x0 + 4, py - 16, 8, 32);
  ctx.fillStyle = '#e9edf3';
  ctx.fillRect(x1 - 12, py - 12, 4, 24);
  ctx.fillStyle = '#5a5f6b';
  ctx.fillRect(x1 - 13, py - 13, 6, 2);
  ctx.fillRect(x1 - 13, py + 11, 6, 2);
  // Kick plate.
  ctx.fillStyle = 'rgba(30,32,40,0.55)';
  ctx.fillRect(x0 + 2, H - 22, x1 - x0 - 4, 18);
  return shearOntoWall(strip, side);
}

// A flat square sample of a design, for shop icons.
export function wallSwatchCanvas(style, frame = 0) {
  const strip = document.createElement('canvas');
  strip.width = STRIP_W;
  strip.height = STRIP_H;
  WALL_STYLES[style].draw(strip.getContext('2d'), STRIP_W, STRIP_H, frame);
  const out = document.createElement('canvas');
  out.width = out.height = STRIP_W;
  out.getContext('2d').drawImage(strip, 0, STRIP_H * 0.25, STRIP_W, STRIP_W, 0, 0, STRIP_W, STRIP_W);
  return out;
}

// Which frame wall tile number `index` (counted along its wall) shows on
// animation tick `tick`.
export function wallFrameFor(style, index, tick) {
  const st = WALL_STYLES[style];
  if (st.frames <= 1) return 0;
  const beat = Math.floor(tick / (st.speed || 1));
  let offset = 0;
  if (st.phase === 'random') offset = (index * 5 + 3) % st.frames;
  else if (st.phase === 'flow') offset = -index * Math.round(st.frames / st.period);
  return (((beat + offset) % st.frames) + st.frames) % st.frames;
}

export function wallTextureKey(style, frame, side) {
  return `wall_${style}_${side}_${frame}`;
}
