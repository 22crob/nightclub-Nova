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

  // The bare walls of a new club (see drawBareWalls()): faded, stained old
  // wallpaper, torn away in places down to cracked plaster. Three
  // variations (frames), picked per wall section so the tears don't repeat.
  tornPaper: {
    frames: 3,
    draw(ctx, W, H, frame) {
      const r = rng(41 + frame * 97);
      // Faded paper: dull stripes and a ghost of a printed pattern.
      ctx.fillStyle = '#7a705a';
      ctx.fillRect(0, 0, W, H);
      const n = 8, sw = W / n;
      for (let k = 0; k < n; k += 2) {
        ctx.fillStyle = 'rgba(40,34,24,0.2)';
        ctx.fillRect(k * sw, 0, sw, H);
      }
      ctx.fillStyle = 'rgba(210,195,160,0.08)';
      for (let y = 18; y < H; y += 36) {
        for (let k = 0; k < n; k += 2) {
          const x = k * sw + sw / 2 + (Math.floor(y / 36) % 2 ? sw : 0);
          ctx.beginPath();
          ctx.moveTo(x, y - 6); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 5, y);
          ctx.fill();
        }
      }
      // Water stains running down from the top.
      for (let k = 0; k < 2; k++) {
        const x = r() * W, len = H * (0.3 + r() * 0.4);
        const g = ctx.createLinearGradient(0, 0, 0, len);
        g.addColorStop(0, 'rgba(70,52,28,0.35)');
        g.addColorStop(1, 'rgba(70,52,28,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, len * 0.4, 8 + r() * 14, len * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Torn patches: the paper ripped away down to plaster, with old
      // brick showing through, a pale curled paper edge on top and a
      // shadow inside the hole. Kept inside the strip.
      const patches = 1 + (frame % 2);
      for (let k = 0; k < patches; k++) {
        const rx = 10 + r() * 6, ry = 13 + r() * 10;
        const cx = rx + 4 + r() * (W - 2 * rx - 8), cy = 30 + k * (H * 0.4) + r() * (H * 0.3);
        const pts = [];
        for (let a = 0; a < 14; a++) {
          const t = (a / 14) * Math.PI * 2 + (r() - 0.5) * 0.3, j = 0.62 + r() * 0.45; // ragged
          pts.push([cx + Math.cos(t) * rx * j, cy + Math.sin(t) * ry * j]);
        }
        const path = () => { ctx.beginPath(); pts.forEach(([x, y], q) => (q ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
        ctx.save();
        path();
        ctx.clip();
        ctx.fillStyle = '#8a8478';
        ctx.fillRect(cx - rx * 1.3, cy - ry * 1.3, rx * 2.6, ry * 2.6);
        for (let by = cy - ry * 1.3; by < cy + ry * 1.3; by += 9) {
          const off = Math.floor(by / 9) % 2 ? 6 : 0;
          for (let bx = cx - rx * 1.3 - off; bx < cx + rx * 1.3; bx += 13) {
            ctx.fillStyle = r() < 0.6 ? '#7a4b38' : '#6b3f30';
            ctx.fillRect(bx + 1, by + 1, 11, 7);
          }
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; // shadow under the top edge
        ctx.lineWidth = 5;
        ctx.beginPath();
        pts.slice(7).concat([pts[0]]).forEach(([x, y], q) => (q ? ctx.lineTo(x, y + 2) : ctx.moveTo(x, y + 2)));
        ctx.stroke();
        ctx.restore();
        // The paper's torn edge, pale where it curls back along the top.
        ctx.strokeStyle = '#cfc4a4';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        pts.slice(7).concat([pts[0]]).forEach(([x, y], q) => (q ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      // Scuffs and a couple of old nail holes.
      ctx.fillStyle = 'rgba(20,16,10,0.55)';
      for (let k = 0; k < 3; k++) ctx.fillRect(r() * W, 20 + r() * (H - 60), 2, 2);
      ctx.strokeStyle = 'rgba(30,24,16,0.3)';
      ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        const x = r() * W, y = H * 0.55 + r() * H * 0.35;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 10 + r() * 10, y + r() * 4 - 2); ctx.stroke();
      }
      // A strip peeling off along the top on some sections.
      if (frame === 1) {
        ctx.fillStyle = '#8a8478';
        ctx.fillRect(0, 0, W, 12);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, 12, W, 3);
        ctx.fillStyle = '#b3a886'; // the flap's pale back, curling down
        ctx.beginPath();
        ctx.moveTo(W * 0.1, 12); ctx.lineTo(W * 0.6, 12); ctx.quadraticCurveTo(W * 0.5, 30, W * 0.3, 34); ctx.closePath();
        ctx.fill();
      }
      // Grime, darker toward the floor.
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,0.05)');
      g.addColorStop(0.65, 'rgba(0,0,0,0.15)');
      g.addColorStop(1, 'rgba(0,0,0,0.42)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      baseboard(ctx, W, H, '#2a2622');
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(r() * W * 0.6, H - BASEBOARD, 12, 3); // a chip in the skirting
    },
  },

  // Old, dark, sooty brick, like a club in a converted warehouse basement.
  oldBrick: {
    frames: 1,
    draw(ctx, W, H) {
      ctx.fillStyle = '#1c1a1d'; // mortar
      ctx.fillRect(0, 0, W, H);
      const r = rng(11);
      const bh = 14, bw = W / 2, gap = 3;
      for (let row = 0; row * bh < H; row++) {
        const off = row % 2 ? bw / 2 : 0;
        for (let k = -1; k < 3; k++) {
          const tone = 46 + Math.floor(r() * 22);
          const warm = r() * 8;
          ctx.fillStyle = `rgb(${tone + warm},${tone},${tone + 2})`;
          ctx.fillRect(k * bw + off + gap / 2, row * bh + gap / 2, bw - gap, bh - gap);
          // A worn top edge on some bricks.
          if (r() < 0.5) {
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.fillRect(k * bw + off + gap / 2, row * bh + gap / 2, bw - gap, 2);
          }
        }
      }
      // Grime: darker toward the floor.
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.7, 'rgba(0,0,0,0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      baseboard(ctx, W, H, '#141316');
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

  // Holographic panels: a soft rainbow sheen that drifts along the wall,
  // between thin silver frames.
  holo: {
    frames: 24,
    speed: 2,
    phase: 'flow',
    period: 4,
    draw(ctx, W, H, frame) {
      const shift = (frame / 24) * 4;
      const g = ctx.createLinearGradient(0, 0, W, H);
      for (let k = 0; k <= 8; k++) {
        const pos = (k / 8) - shift;
        const hue = ((((pos / 4) % 1) + 1) % 1) * 360;
        g.addColorStop(k / 8, `hsl(${(hue + (k * 12)) | 0},70%,72%)`);
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const shine = ctx.createLinearGradient(0, 0, W, 0);
      shine.addColorStop(0, 'rgba(255,255,255,0.35)');
      shine.addColorStop(0.5, 'rgba(255,255,255,0.05)');
      shine.addColorStop(1, 'rgba(255,255,255,0.3)');
      ctx.fillStyle = shine;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#e8ecf4';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, W - 4, H - BASEBOARD - 4);
      ctx.strokeStyle = 'rgba(80,90,120,0.5)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(5, 5, W - 10, H - BASEBOARD - 10);
      baseboard(ctx, W, H, '#c8ccd8');
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
  // --- The October 2026 batch, from the owner's reference clubs ----------

  // Grey cinder blocks, a cheap first step up from the torn paper.
  cinderBlock: {
    frames: 1,
    draw(ctx, W, H) {
      ctx.fillStyle = '#4a4a4c'; // mortar
      ctx.fillRect(0, 0, W, H);
      const r = rng(41);
      const bh = 26, bw = W, gap = 3;
      for (let row = 0; row * bh < H; row++) {
        const off = row % 2 ? bw / 2 : 0;
        for (let k = -1; k < 2; k++) {
          const tone = 112 + Math.floor(r() * 18);
          const x = k * bw + off + gap / 2, y = row * bh + gap / 2;
          ctx.fillStyle = `rgb(${tone},${tone},${tone - 4})`;
          ctx.fillRect(x, y, bw - gap, bh - gap);
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fillRect(x, y, bw - gap, 2);
          // Pitted surface.
          for (let i = 0; i < 18; i++) {
            ctx.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.12})`;
            ctx.fillRect(x + r() * (bw - gap), y + 2 + r() * (bh - gap - 3), 2, 2);
          }
        }
      }
      verticalShade(ctx, W, H);
      baseboard(ctx, W, H, '#2e2e31');
    },
  },

  // White subway tiles with dark grout, a little grubby low down.
  subwayTile: {
    frames: 1,
    draw(ctx, W, H) {
      ctx.fillStyle = '#5d6168';
      ctx.fillRect(0, 0, W, H);
      const th = 11, tw = W / 3, gap = 2;
      for (let row = 0; row * th < H; row++) {
        const off = row % 2 ? tw / 2 : 0;
        for (let k = -1; k < 4; k++) {
          const x = k * tw + off + gap / 2, y = row * th + gap / 2;
          const g = ctx.createLinearGradient(0, y, 0, y + th);
          g.addColorStop(0, '#f4f6f4');
          g.addColorStop(1, '#d5dad6');
          ctx.fillStyle = g;
          ctx.fillRect(x, y, tw - gap, th - gap);
        }
      }
      const grime = ctx.createLinearGradient(0, 0, 0, H);
      grime.addColorStop(0.55, 'rgba(70,60,40,0)');
      grime.addColorStop(1, 'rgba(70,60,40,0.3)');
      ctx.fillStyle = grime;
      ctx.fillRect(0, 0, W, H);
      baseboard(ctx, W, H, '#2b2d33');
    },
  },

  // Rough wooden planks running across, like a beer hall.
  woodPlanks: {
    frames: 1,
    draw(ctx, W, H) {
      const r = rng(57);
      const ph = 17;
      for (let row = 0; row * ph < H; row++) {
        const tone = 0.85 + r() * 0.3;
        ctx.fillStyle = `rgb(${(128 * tone) | 0},${(80 * tone) | 0},${(46 * tone) | 0})`;
        ctx.fillRect(0, row * ph, W, ph);
        // Grain.
        ctx.strokeStyle = 'rgba(60,32,14,0.35)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const y = row * ph + 3 + r() * (ph - 6);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.bezierCurveTo(W * 0.3, y + r() * 3 - 1.5, W * 0.7, y + r() * 3 - 1.5, W, y);
          ctx.stroke();
        }
        // Seam and a butt joint somewhere along the plank.
        ctx.fillStyle = 'rgba(30,14,4,0.75)';
        ctx.fillRect(0, row * ph + ph - 2, W, 2);
        ctx.fillRect((r() * W) | 0, row * ph, 2, ph);
        ctx.fillStyle = '#2a1a10';
        ctx.fillRect(6, row * ph + ph / 2 - 1, 2, 2); // nails
        ctx.fillRect(W - 8, row * ph + ph / 2 - 1, 2, 2);
      }
      verticalShade(ctx, W, H);
      baseboard(ctx, W, H, '#3a2210');
    },
  },

  // Theatre red: deep red panels framed in gold, like the red-floor club.
  theatreRed: {
    frames: 1,
    draw(ctx, W, H) {
      const bg = ctx.createLinearGradient(0, 0, W, 0);
      bg.addColorStop(0, '#6a0c14');
      bg.addColorStop(0.5, '#8c1420');
      bg.addColorStop(1, '#6a0c14');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      const top = 16, bot = H - BASEBOARD - 12;
      ctx.strokeStyle = '#e2b44c';
      ctx.lineWidth = 3;
      ctx.strokeRect(9, top, W - 18, bot - top);
      ctx.strokeStyle = 'rgba(255,230,150,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(14, top + 5, W - 28, bot - top - 10);
      // Gold rosette in the middle of the panel.
      const cx = W / 2, cy = (top + bot) / 2;
      ctx.fillStyle = '#e2b44c';
      for (let a = 0; a < 8; a++) {
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a * Math.PI / 4) * 6, cy + Math.sin(a * Math.PI / 4) * 6, 4, 2, a * Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fff0b8';
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
      // Gold picture rail at the top.
      ctx.fillStyle = '#c9952e';
      ctx.fillRect(0, 4, W, 5);
      ctx.fillStyle = 'rgba(255,240,180,0.6)';
      ctx.fillRect(0, 4, W, 1.5);
      verticalShade(ctx, W, H);
      baseboard(ctx, W, H, '#3a0608');
    },
  },

  // A wall of speaker cabinets, black boxes with yellow and cyan cones.
  speakerWall: {
    frames: 1,
    draw(ctx, W, H) {
      ctx.fillStyle = '#0d0d10';
      ctx.fillRect(0, 0, W, H);
      const bh = (H - BASEBOARD) / 4;
      for (let row = 0; row < 4; row++) {
        const y = row * bh;
        ctx.fillStyle = '#1d1d22';
        ctx.fillRect(2, y + 2, W - 4, bh - 4);
        ctx.strokeStyle = '#3a3a44';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(2, y + 2, W - 4, bh - 4);
        const ring = row % 2 ? '#3de0ff' : '#ffd23d';
        const big = row % 2 === 0;
        const cones = big ? [[W / 2, y + bh / 2, bh * 0.36]] : [[W * 0.28, y + bh / 2, bh * 0.26], [W * 0.72, y + bh / 2, bh * 0.26]];
        for (const [cx, cy, rad] of cones) {
          ctx.fillStyle = ring;
          ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
          const g = ctx.createRadialGradient(cx - rad * 0.2, cy - rad * 0.2, 0, cx, cy, rad * 0.82);
          g.addColorStop(0, '#4a4a54');
          g.addColorStop(1, '#0a0a0c');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(cx, cy, rad * 0.82, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#2a2a30';
          ctx.beginPath(); ctx.arc(cx, cy, rad * 0.25, 0, Math.PI * 2); ctx.fill();
        }
      }
      baseboard(ctx, W, H, '#050507');
    },
  },

  // Black with tall grey arch silhouettes, like the Art Deco club.
  blackArches: {
    frames: 1,
    draw(ctx, W, H) {
      ctx.fillStyle = '#121116';
      ctx.fillRect(0, 0, W, H);
      const x0 = 12, x1 = W - 12, top = 24, bot = H - BASEBOARD - 6;
      const rad = (x1 - x0) / 2;
      const arch = (inset) => {
        ctx.beginPath();
        ctx.moveTo(x0 + inset, bot);
        ctx.lineTo(x0 + inset, top + rad);
        ctx.arc(W / 2, top + rad, rad - inset, Math.PI, 0);
        ctx.lineTo(x1 - inset, bot);
        ctx.closePath();
      };
      arch(0);
      ctx.fillStyle = '#3a3a44';
      ctx.fill();
      arch(4);
      ctx.fillStyle = '#26252e';
      ctx.fill();
      // A thin gold keystone line.
      ctx.fillStyle = '#c9a046';
      ctx.fillRect(W / 2 - 2, top - 2, 4, 8);
      verticalShade(ctx, W, H);
      baseboard(ctx, W, H, '#08080b');
    },
  },

  // Backlit white shelves full of bottles, as behind the best bars.
  bottleShelf: {
    // Little lit windows set into the wall at head height, each a recess
    // with a bottle or two standing in it: shadowed top and sides, a sill
    // in front, warm light from the back (the owner found painted-on
    // shelves too flat). Dark panelling below.
    frames: 1,
    draw(ctx, W, H) {
      ctx.fillStyle = '#16111a';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(0, 0, W, 2);
      const top = Math.round(H * 0.2), bottom = Math.round(H * 0.6);
      ctx.fillStyle = '#1e1622';
      ctx.fillRect(0, bottom + 10, W, H - bottom - 10);
      const rows = 2, cols = 2;
      const gap = 6, cw = (W - gap * (cols + 1)) / cols, ch = (bottom - top - gap * (rows + 1)) / rows;
      const r = rng(73);
      const colors = ['#2f8a3a', '#7a3a12', '#c8d4dc', '#3a5ab8', '#a01a3a', '#d8a030', '#5a2a78'];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = gap + col * (cw + gap), y = top + gap + row * (ch + gap);
          const d = 5; // how deep the recess looks
          // the frame round the window
          ctx.fillStyle = '#2c2026';
          ctx.fillRect(x - 2, y - 2, cw + 4, ch + 4);
          // the lit back of the recess
          const back = ctx.createRadialGradient(x + cw / 2, y + ch * 0.75, 2, x + cw / 2, y + ch * 0.6, ch);
          back.addColorStop(0, '#ffcf80');
          back.addColorStop(1, '#8a4a1c');
          ctx.fillStyle = back;
          ctx.fillRect(x, y, cw, ch);
          // inner walls: the ceiling in shadow, the left side lit, the right darker
          ctx.fillStyle = 'rgba(20,8,4,0.75)';
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cw, y); ctx.lineTo(x + cw - d, y + d); ctx.lineTo(x + d, y + d); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,190,110,0.35)';
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + d, y + d); ctx.lineTo(x + d, y + ch); ctx.lineTo(x, y + ch); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(30,10,4,0.5)';
          ctx.beginPath(); ctx.moveTo(x + cw, y); ctx.lineTo(x + cw - d, y + d); ctx.lineTo(x + cw - d, y + ch); ctx.lineTo(x + cw, y + ch); ctx.closePath(); ctx.fill();
          // one or two bottles standing on the recess floor, with shadows
          const n = 1 + (r() < 0.6 ? 1 : 0);
          for (let k = 0; k < n; k++) {
            const bw = 7 + r() * 2, bh = ch * (0.55 + r() * 0.2);
            const bx = x + d + 2 + (n === 1 ? (cw - 2 * d - 4 - bw) / 2 : k * (cw - 2 * d - 4 - bw));
            const by = y + ch - 2 - bh;
            ctx.fillStyle = 'rgba(40,16,4,0.45)';
            ctx.fillRect(bx + 3, by + bh * 0.3, bw, bh * 0.7); // shadow on the back
            ctx.fillStyle = colors[(r() * colors.length) | 0];
            const body = by + bh * 0.36;
            ctx.fillRect(bx, body, bw, by + bh - body);
            ctx.beginPath(); ctx.ellipse(bx + bw / 2, body, bw / 2, bh * 0.1, 0, Math.PI, 0); ctx.fill();
            ctx.fillRect(bx + bw / 2 - 1.5, by, 3, bh * 0.3);
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.fillRect(bx + 1.5, body + 2, 1.5, (by + bh - body) * 0.7);
            ctx.fillStyle = 'rgba(255,236,200,0.8)';
            ctx.fillRect(bx + 1, body + (by + bh - body) * 0.45, bw - 2, 3);
          }
          // the sill in front
          ctx.fillStyle = '#3a2a30';
          ctx.fillRect(x - 3, y + ch, cw + 6, 3);
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fillRect(x - 3, y + ch, cw + 6, 1);
        }
      }
      // a dado rail between the windows and the panelling
      ctx.fillStyle = '#2c2026';
      ctx.fillRect(0, bottom + 6, W, 4);
      baseboard(ctx, W, H, '#0c0a10');
    },
  },

  // Dark wall with glowing purple panels.
  purpleGlow: {
    frames: 1,
    draw(ctx, W, H) {
      ctx.fillStyle = '#100a1c';
      ctx.fillRect(0, 0, W, H);
      const top = 14, bot = H - BASEBOARD - 10, x0 = 10, x1 = W - 10;
      ctx.save();
      ctx.shadowColor = '#b24bff';
      ctx.shadowBlur = 16;
      const g = ctx.createLinearGradient(0, top, 0, bot);
      g.addColorStop(0, '#d08cff');
      g.addColorStop(0.5, '#9a3cf0');
      g.addColorStop(1, '#5a14b8');
      ctx.fillStyle = g;
      ctx.fillRect(x0, top, x1 - x0, bot - top);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x0 + 4, top + 4, 3, bot - top - 8);
      ctx.strokeStyle = '#e8c8ff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x0, top, x1 - x0, bot - top);
      baseboard(ctx, W, H, '#07040c');
    },
  },

  // Icy blue glowing panels with frosty cracks, like the ice club.
  icePanels: {
    frames: 1,
    draw(ctx, W, H) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#bfeaff');
      g.addColorStop(0.5, '#5ab8f0');
      g.addColorStop(1, '#1e5aa8');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const r = rng(91);
      // Blocks of ice.
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      const bh = (H - BASEBOARD) / 3;
      for (let row = 0; row < 3; row++) ctx.strokeRect(3, row * bh + 3, W - 6, bh - 6);
      // Frosty cracks.
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        let x = r() * W, y = r() * (H - BASEBOARD);
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 4; k++) { x += r() * 16 - 8; y += r() * 14 - 4; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      const shine = ctx.createLinearGradient(0, 0, W, 0);
      shine.addColorStop(0, 'rgba(255,255,255,0.3)');
      shine.addColorStop(0.4, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine;
      ctx.fillRect(0, 0, W, H);
      baseboard(ctx, W, H, '#dff4ff');
    },
  },

  // Black wall covered in small white lights that twinkle now and then.
  ledDots: {
    frames: 8,
    speed: 3,
    phase: 'random',
    draw(ctx, W, H, frame) {
      ctx.fillStyle = '#08080c';
      ctx.fillRect(0, 0, W, H);
      const r = rng(7);
      const step = 10;
      for (let y = step / 2; y < H - BASEBOARD; y += step) {
        for (let x = step / 2; x < W; x += step) {
          const seed = r();
          const twinkle = ((seed * 8) | 0) === frame;
          ctx.fillStyle = twinkle ? 'rgba(255,255,255,1)' : `rgba(255,250,235,${0.35 + seed * 0.3})`;
          ctx.beginPath();
          ctx.arc(x, y, twinkle ? 2.2 : 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      baseboard(ctx, W, H, '#030305');
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

// ---------------------------------------------------------------------------
// Wall decorations (the owner asked for them, October 2026): things hung on
// a wall section over whatever wallpaper is there, drawn the same way as a
// wallpaper strip but on a see-through background, then sheared onto the
// wall. One per section (see scene/wallDecor.js). Animated ones step while a
// DJ plays, like animated wallpaper.

// A soft glow behind a shape (drawn first).
function glowRect(ctx, x, y, w, h, color, blur) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// An upright LED tube on two chrome brackets, its light pulsing.
function ledPole(rgb) {
  return {
    frames: 6,
    speed: 1,
    phase: 'flow',
    period: 6,
    draw(ctx, W, H, frame) {
      const k = 0.6 + 0.4 * Math.sin((frame / 6) * Math.PI * 2);
      const [r, g, b] = rgb;
      const x = W / 2 - 4, top = H * 0.06, bot = H - BASEBOARD - 10;
      // light washing the wall
      const wash = ctx.createRadialGradient(W / 2, (top + bot) / 2, 4, W / 2, (top + bot) / 2, W * 0.9);
      wash.addColorStop(0, `rgba(${r},${g},${b},${0.35 * k})`);
      wash.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = wash;
      ctx.fillRect(0, top - 10, W, bot - top + 20);
      glowRect(ctx, x, top, 8, bot - top, `rgba(${r},${g},${b},${0.9 * k})`, 18);
      ctx.fillStyle = `rgb(${Math.min(255, r + 120)},${Math.min(255, g + 120)},${Math.min(255, b + 120)})`;
      ctx.fillRect(x + 2.5, top + 2, 3, bot - top - 4);
      for (const y of [top - 4, bot - 4]) { // end caps and brackets
        ctx.fillStyle = '#c8ccd6';
        ctx.fillRect(x - 3, y, 14, 8);
        ctx.fillStyle = '#6a6e78';
        ctx.fillRect(x - 3, y + 6, 14, 2);
      }
    },
  };
}

export const WALL_DECOR = {
  // A fern in a woven pot, hung on a cord from the top of the wall, its
  // fronds spilling over.
  hangingFern: {
    frames: 1,
    draw(ctx, W, H) {
      const cx = W / 2, potY = H * 0.36;
      ctx.strokeStyle = '#d8c8a8';
      ctx.lineWidth = 1.5;
      for (const dx of [-18, 0, 18]) { ctx.beginPath(); ctx.moveTo(cx, 4); ctx.lineTo(cx + dx, potY); ctx.stroke(); }
      const r = rng(11);
      for (let k = 0; k < 14; k++) { // trailing fronds
        const a = -Math.PI / 2 + (r() - 0.5) * 3.6;
        const len = 30 + r() * 45;
        const down = Math.abs(Math.sin(a)) < 0.5 || r() < 0.5;
        ctx.strokeStyle = r() < 0.5 ? '#3f9a3a' : '#2f7a2c';
        ctx.lineWidth = 4;
        ctx.beginPath();
        const sx = cx + (r() - 0.5) * 26, sy = potY - 4;
        ctx.moveTo(sx, sy);
        const ex = sx + Math.cos(a) * len * 0.6, ey = sy + (down ? len : -len * 0.5);
        ctx.quadraticCurveTo(sx + Math.cos(a) * len, sy - 6, ex, ey);
        ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        for (let t = 0.3; t <= 1; t += 0.18) {
          const px = sx + (ex - sx) * t, py = sy + (ey - sy) * t;
          ctx.beginPath(); ctx.ellipse(px, py, 6, 3, a + t, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.fillStyle = '#c8a26a'; // the pot
      ctx.beginPath(); ctx.moveTo(cx - 22, potY - 4); ctx.lineTo(cx + 22, potY - 4); ctx.lineTo(cx + 15, potY + 22); ctx.lineTo(cx - 15, potY + 22); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(90,60,30,0.5)';
      for (let y = potY; y < potY + 22; y += 4) ctx.fillRect(cx - 20 + (y - potY) * 0.3, y, 40 - (y - potY) * 0.6, 1.5);
    },
  },

  // Three glass globe pendants on long cords, warm bulbs glowing.
  pendantLights: {
    frames: 1,
    draw(ctx, W, H) {
      for (const [x, drop] of [[W * 0.22, 0.34], [W * 0.5, 0.48], [W * 0.78, 0.3]]) {
        const y = H * drop;
        ctx.strokeStyle = '#1a1a1e';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y - 12); ctx.stroke();
        const glow = ctx.createRadialGradient(x, y, 2, x, y, 40);
        glow.addColorStop(0, 'rgba(255,200,110,0.8)');
        glow.addColorStop(1, 'rgba(255,200,110,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - 40, y - 40, 80, 80);
        ctx.fillStyle = '#2a2a30';
        ctx.fillRect(x - 4, y - 16, 8, 5);
        ctx.fillStyle = 'rgba(255,236,190,0.55)';
        ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffe2a0';
        ctx.beginPath(); ctx.arc(x, y + 1, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.arc(x - 4, y - 4, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    },
  },

  ledPoleCyan: ledPole([40, 220, 255]),
  ledPolePink: ledPole([255, 60, 190]),

  // A pink neon heart on a clear backing, flickering now and then.
  neonHeart: {
    frames: 4,
    speed: 2,
    phase: 'random',
    draw(ctx, W, H, frame) {
      const on = frame !== 3 ? 1 : 0.55;
      const cx = W / 2, cy = H * 0.38, s = W * 0.44;
      ctx.fillStyle = 'rgba(200,220,255,0.12)';
      ctx.fillRect(cx - s - 8, cy - s - 6, s * 2 + 16, s * 2 + 10);
      ctx.save();
      ctx.shadowColor = `rgba(255,60,170,${on})`;
      ctx.shadowBlur = 22;
      ctx.strokeStyle = `rgba(255,${120 + 80 * on},${210 + 30 * on},${on})`;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(cx, cy + s * 0.9);
      ctx.bezierCurveTo(cx - s * 1.4, cy - s * 0.1, cx - s * 0.6, cy - s * 1.1, cx, cy - s * 0.35);
      ctx.bezierCurveTo(cx + s * 0.6, cy - s * 1.1, cx + s * 1.4, cy - s * 0.1, cx, cy + s * 0.9);
      ctx.stroke();
      ctx.restore();
    },
  },

  // A small black speaker on a wall bracket, its cones ringed in cyan.
  wallSpeaker: {
    frames: 1,
    draw(ctx, W, H) {
      const x = W / 2 - 22, y = H * 0.16, w = 44, h = 66;
      ctx.fillStyle = '#5a5e68';
      ctx.fillRect(W / 2 - 3, y - 10, 6, 12);
      ctx.fillStyle = '#18181e';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#3a3a44';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
      for (const [cy, rad] of [[y + 18, 10], [y + 45, 15]]) {
        ctx.save();
        ctx.shadowColor = '#2ad8ff';
        ctx.shadowBlur = 8;
        ctx.strokeStyle = '#2ad8ff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(W / 2, cy, rad, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#2a2a32';
        ctx.beginPath(); ctx.arc(W / 2, cy, rad - 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0c0c10';
        ctx.beginPath(); ctx.arc(W / 2, cy, rad * 0.35, 0, Math.PI * 2); ctx.fill();
      }
    },
  },

  // Fairy lights draped in swoops across the top of the wall, twinkling.
  fairyLights: {
    frames: 4,
    speed: 2,
    phase: 'random',
    draw(ctx, W, H, frame) {
      const colors = ['#ff5fb8', '#5fd8ff', '#ffe36f', '#9cff7a', '#c88cff'];
      const sag = (x, base, depth) => base + depth * Math.sin((x / W) * Math.PI);
      for (const [base, depth, seed] of [[H * 0.08, 18, 3], [H * 0.2, 14, 7]]) {
        ctx.strokeStyle = '#2a2a30';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 2) { const y = sag(x, base, depth); if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke();
        const r = rng(seed);
        for (let i = 0; i < 6; i++) {
          const x = (i + 0.5) * (W / 6), y = sag(x, base, depth) + 3;
          const lit = (i + frame + seed) % 4 !== 0;
          const c = colors[(i + seed) % colors.length];
          if (lit) {
            const glow = ctx.createRadialGradient(x, y, 1, x, y, 13);
            glow.addColorStop(0, c);
            glow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = glow;
            ctx.fillRect(x - 13, y - 13, 26, 26);
          }
          ctx.globalAlpha = lit ? 1 : 0.45;
          ctx.fillStyle = c;
          ctx.beginPath(); ctx.arc(x, y, 3.8, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          r();
        }
      }
    },
  },
};

// One frame of a wall decoration, sheared onto the left or right wall.
export function wallDecorCanvas(style, frame = 0, side = 'right') {
  const strip = document.createElement('canvas');
  strip.width = STRIP_W;
  strip.height = STRIP_H;
  WALL_DECOR[style].draw(strip.getContext('2d'), STRIP_W, STRIP_H, frame);
  return shearOntoWall(strip, side);
}

// The shop's picture of a wall decoration: the whole strip on a dark wall.
export function wallDecorSwatch(style, frame = 0) {
  const strip = document.createElement('canvas');
  strip.width = STRIP_W;
  strip.height = STRIP_H;
  WALL_DECOR[style].draw(strip.getContext('2d'), STRIP_W, STRIP_H, frame);
  const size = 96;
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#1c1624';
  ctx.fillRect(0, 0, size, size);
  const k = size / STRIP_H;
  ctx.drawImage(strip, (size - STRIP_W * k) / 2, 0, STRIP_W * k, size);
  return out;
}

export function wallDecorFrameFor(style, index, tick) {
  const st = WALL_DECOR[style];
  if (st.frames <= 1) return 0;
  const beat = Math.floor(tick / (st.speed || 1));
  let offset = 0;
  if (st.phase === 'random') offset = (index * 5 + 3) % st.frames;
  else if (st.phase === 'flow') offset = -index * Math.round(st.frames / st.period);
  return (((beat + offset) % st.frames) + st.frames) % st.frames;
}

export function wallDecorKey(style, frame, side) {
  return `wallDecor_${style}_${frame}_${side}`;
}
