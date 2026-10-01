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

// Rendered at 2x and drawn at half size. One tile along a wall moves 32 x
// 16 game pixels on screen; the wall is WALL_HEIGHT (128) tall.
const STRIP_W = 90; // a tile's true length along the wall, at 2x
const STRIP_H = 256;
export const WALL_TEX_W = 64;
export const WALL_TEX_H = STRIP_H + 32;
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
  if (side === 'left') {
    const sctx = strip.getContext('2d');
    sctx.fillStyle = 'rgba(0,0,0,0.15)';
    sctx.fillRect(0, 0, STRIP_W, STRIP_H);
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
