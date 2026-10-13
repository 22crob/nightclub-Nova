// Dance floor tile designs, drawn in code (no image files). Each design
// paints one square tile seen from above; floorFrameCanvas() then squashes
// it into the game's 2:1 diamond. Animated designs have several frames that
// the game steps through to the music (see animateFloors()).
//
// A design: { frames, speed, phase, period, draw(ctx, S, frame) } where S
// is the square's size in pixels and `speed` is how many animation ticks
// each frame lasts. `phase` says how a tile's frame relates to its
// neighbours':
//   'sync'   every tile shows the same frame
//   'random' every tile on its own beat
//   'ripple' offset by distance along the floor
//   'flow'   one pattern `period` tiles long that flows across the whole
//            floor; the draw function paints its slice of it seamlessly.
//            `frames` must be a multiple of `period`.
//   'step'   driven by dancers: frame 0 is idle, higher frames are brighter
//            (see animateFloors())
// The ladder runs simple to fancy: plain tiles first, then a gentle glow,
// tiles that animate on their own, patterns that flow across the floor,
// and finally a floor that reacts to the dancers.

// Rendered at 2x and drawn at half size, like the Blender sprites.
const SQUARE = 128;
export const FLOOR_TEX_W = 128;
export const FLOOR_TEX_H = 64;

// Small deterministic random generator, so a design looks the same every
// time it's drawn.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Thin dark seam and a soft highlight on the tile's edges, so a floor of
// many tiles still reads as tiles.
function bevel(ctx, S, light = 'rgba(255,255,255,0.18)', dark = 'rgba(0,0,0,0.45)') {
  ctx.lineWidth = 3;
  ctx.strokeStyle = dark;
  ctx.strokeRect(1.5, 1.5, S - 3, S - 3);
  ctx.strokeStyle = light;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(4, S - 4); ctx.lineTo(4, 4); ctx.lineTo(S - 4, 4);
  ctx.stroke();
}

function glowRect(ctx, x, y, w, h, color, blur) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// A frosted glass panel lit from below in `rgb`, `k` (0-1) how bright.
function litPanel(ctx, S, rgb, k) {
  const [r, g, b] = rgb;
  ctx.fillStyle = '#1c1826';
  ctx.fillRect(0, 0, S, S);
  const inset = 7;
  const glow = ctx.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S * 0.72);
  const mix = (c, t) => Math.round(40 + (c - 40) * t);
  glow.addColorStop(0, `rgb(${mix(Math.min(255, r + 60), k)},${mix(Math.min(255, g + 60), k)},${mix(Math.min(255, b + 60), k)})`);
  glow.addColorStop(1, `rgb(${mix(r, k * 0.75)},${mix(g, k * 0.75)},${mix(b, k * 0.75)})`);
  ctx.save();
  ctx.shadowColor = `rgba(${r},${g},${b},${0.8 * k})`;
  ctx.shadowBlur = 4 + 10 * k;
  ctx.fillStyle = glow;
  ctx.fillRect(inset, inset, S - inset * 2, S - inset * 2);
  ctx.restore();
  // Frosted sheen.
  const sheen = ctx.createLinearGradient(0, 0, S, S);
  sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(inset, inset, S - inset * 2, S - inset * 2);
  bevel(ctx, S, 'rgba(255,255,255,0.15)', 'rgba(0,0,0,0.6)');
}

// A slow pulse of a lit panel, all tiles together.
function pulseFloor(rgb, frames, speed) {
  return {
    frames,
    speed,
    phase: 'sync',
    draw(ctx, S, frame) {
      litPanel(ctx, S, rgb, 0.35 + 0.65 * (0.5 - 0.5 * Math.cos((frame / frames) * Math.PI * 2)));
    },
  };
}

export const FLOOR_STYLES = {
  // A plain dark tile, the beginner's floor.
  plain: {
    frames: 1,
    draw(ctx, S) {
      const g = ctx.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, '#4a4560');
      g.addColorStop(1, '#3a3550');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      bevel(ctx, S);
    },
  },

  // The starter dance floor: worn grey vinyl squares with dull seams and a
  // few scuffs, the kind a new club makes do with.
  basic: {
    frames: 1,
    draw(ctx, S) {
      const r = rng(7);
      const n = 2, c = S / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const tone = (i + j) % 2 ? 66 : 76;
          ctx.fillStyle = `rgb(${tone},${tone - 2},${tone + 6})`;
          ctx.fillRect(i * c, j * c, c, c);
        }
      }
      ctx.strokeStyle = 'rgba(20,18,26,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(c, 0); ctx.lineTo(c, S); ctx.moveTo(0, c); ctx.lineTo(S, c);
      ctx.stroke();
      // Scuffs from dancing feet.
      ctx.strokeStyle = 'rgba(25,22,30,0.35)';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 5; k++) {
        const x = r() * S, y = r() * S, a = r() * Math.PI;
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 5);
        ctx.stroke();
      }
      bevel(ctx, S, 'rgba(255,255,255,0.1)', 'rgba(0,0,0,0.4)');
    },
  },

  // Classic black-and-white checks.
  checker: {
    frames: 1,
    draw(ctx, S) {
      const n = 4, c = S / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          ctx.fillStyle = (i + j) % 2 ? '#1c1c24' : '#ecebf2';
          ctx.fillRect(i * c, j * c, c, c);
        }
      }
      const g = ctx.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, 'rgba(255,255,255,0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0.12)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      bevel(ctx, S);
    },
  },

  // Warm wood in a basket-weave pattern.
  parquet: {
    frames: 1,
    draw(ctx, S) {
      const r = rng(7);
      const tones = ['#a8683a', '#b97a45', '#9a5c31', '#c48a52'];
      const half = S / 2, plank = half / 3;
      for (let bx = 0; bx < 2; bx++) {
        for (let by = 0; by < 2; by++) {
          const across = (bx + by) % 2 === 0;
          for (let k = 0; k < 3; k++) {
            ctx.fillStyle = tones[Math.floor(r() * tones.length)];
            const x = bx * half + (across ? 0 : k * plank);
            const y = by * half + (across ? k * plank : 0);
            const w = across ? half : plank, h = across ? plank : half;
            ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = 'rgba(70,35,15,0.25)';
            ctx.lineWidth = 1;
            for (let gl = 0; gl < 3; gl++) {
              ctx.beginPath();
              if (across) {
                const yy = y + 3 + r() * (h - 6);
                ctx.moveTo(x + 2, yy); ctx.lineTo(x + w - 2, yy + (r() - 0.5) * 2);
              } else {
                const xx = x + 3 + r() * (w - 6);
                ctx.moveTo(xx, y + 2); ctx.lineTo(xx + (r() - 0.5) * 2, y + h - 2);
              }
              ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(60,30,12,0.55)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
          }
        }
      }
      bevel(ctx, S, 'rgba(255,220,180,0.2)');
    },
  },

  // The first lit floors: a frosted panel lit from underneath that slowly
  // brightens and dims, every tile together. Soft Glow is white, then blue
  // and pink versions.
  softGlow: pulseFloor([255, 255, 255], 16, 3),
  bluePulse: pulseFloor([60, 150, 255], 12, 2),
  pinkPulse: pulseFloor([255, 70, 180], 12, 2),
  redPulse: pulseFloor([255, 30, 50], 12, 2),

  // A checkerboard of pink and blue that swaps colours on the beat.
  twoTone: {
    frames: 2,
    speed: 4,
    phase: 'ripple',
    draw(ctx, S, frame) {
      const color = frame ? [70, 170, 255] : [255, 70, 190];
      litPanel(ctx, S, color, 1);
    },
  },

  // A purple-blue galaxy flowing across the floor with twinkling stars.
  galaxy: {
    frames: 24,
    speed: 1,
    phase: 'flow',
    period: 6,
    draw(ctx, S, frame) {
      flowFill(ctx, S, frame, 24, 6, (x) => {
        const k = 0.5 + 0.5 * Math.sin(x * Math.PI * 2);
        const j = 0.5 + 0.5 * Math.sin(x * Math.PI * 4 + 1);
        return `rgb(${(30 + 120 * k * j) | 0},${(15 + 40 * j) | 0},${(70 + 150 * k) | 0})`;
      });
      const r = rng(31);
      for (let i = 0; i < 14; i++) {
        const x = r() * S, y = r() * S, tw = (i + frame) % 6;
        const a = tw < 3 ? 0.35 + tw * 0.2 : 0.95 - (tw - 3) * 0.2;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, i % 4 ? 1.6 : 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      bevel(ctx, S, 'rgba(200,170,255,0.25)', 'rgba(0,0,0,0.55)');
    },
  },

  // The first animated floor: a dark tile whose neon edge softly pulses
  // with the beat, all tiles together.
  glow: {
    frames: 8,
    speed: 2,
    phase: 'sync',
    draw(ctx, S, frame) {
      ctx.fillStyle = '#231d33';
      ctx.fillRect(0, 0, S, S);
      const k = 0.5 + 0.5 * Math.cos((frame / 8) * Math.PI * 2);
      ctx.save();
      ctx.shadowColor = '#b44dff';
      ctx.shadowBlur = 6 + 12 * k;
      ctx.strokeStyle = `rgba(200,120,255,${0.45 + 0.55 * k})`;
      ctx.lineWidth = 5;
      ctx.strokeRect(10, 10, S - 20, S - 20);
      ctx.restore();
      const inner = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.6);
      inner.addColorStop(0, `rgba(180,77,255,${0.1 + 0.2 * k})`);
      inner.addColorStop(1, 'rgba(180,77,255,0)');
      ctx.fillStyle = inner;
      ctx.fillRect(0, 0, S, S);
      bevel(ctx, S, 'rgba(255,255,255,0.08)');
    },
  },

  // The classic light-up disco floor: a 3x3 grid of glass squares that
  // change colour to the beat, each tile on its own.
  lightUp: {
    frames: 8,
    speed: 4,
    phase: 'random',
    draw(ctx, S, frame) {
      ctx.fillStyle = '#15121f';
      ctx.fillRect(0, 0, S, S);
      const colors = ['#ff3da8', '#ffd23d', '#3dd8ff', '#7d4dff', '#3dff8a', '#ff7a3d'];
      const n = 3, gap = 5, c = (S - gap * (n + 1)) / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const lit = (i * 5 + j * 3 + frame) % 4 !== 0;
          const color = colors[(i * 2 + j * 3 + frame) % colors.length];
          const x = gap + i * (c + gap), y = gap + j * (c + gap);
          if (lit) {
            glowRect(ctx, x, y, c, c, color, 12);
            const g = ctx.createLinearGradient(x, y, x + c, y + c);
            g.addColorStop(0, 'rgba(255,255,255,0.55)');
            g.addColorStop(0.5, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x, y, c, c);
          } else {
            ctx.fillStyle = '#2a2438';
            ctx.fillRect(x, y, c, c);
          }
        }
      }
      bevel(ctx, S, 'rgba(255,255,255,0.1)');
    },
  },

  // Dark tile with a neon ring that pulses outward from the centre; the
  // pulses ripple across the floor.
  neonRings: {
    frames: 8,
    speed: 2,
    phase: 'ripple',
    draw(ctx, S, frame) {
      const bg = ctx.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S * 0.75);
      bg.addColorStop(0, '#2a1240');
      bg.addColorStop(1, '#0d0818');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, S, S);
      const ring = (radius, color, width, alpha) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.arc(S / 2, S / 2, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      };
      ring(S * 0.16, '#3de0ff', 4, 0.9);
      const t = frame / 8;
      ring(S * (0.2 + t * 0.32), '#ff3dd2', 6 - t * 4, 1 - t * 0.8);
      ctx.save();
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(S / 2, S / 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      bevel(ctx, S, 'rgba(255,61,210,0.35)', 'rgba(0,0,0,0.6)');
    },
  },

  // The future batch (October 2026): a hex grid of glass cells, faint
  // cyan outlines always on, a band of light flowing across the whole floor
  // lighting the cells it passes cyan, then violet behind it.
  hexGrid: {
    frames: 16,
    speed: 1,
    phase: 'flow',
    period: 4,
    draw(ctx, S, frame) {
      ctx.fillStyle = '#0b0c16';
      ctx.fillRect(0, 0, S, S);
      const w = S / 4, rowH = S / 4, ry = rowH * 0.66;   // 4 cells across, 4 rows: repeats every tile
      const shift = (frame / 16) * 4;
      const hex = (cx, cy, inset) => {
        ctx.beginPath();
        const hw = w / 2 - inset, top = ry - inset, side = ry / 2 - inset / 2;
        ctx.moveTo(cx, cy - top); ctx.lineTo(cx + hw, cy - side); ctx.lineTo(cx + hw, cy + side);
        ctx.lineTo(cx, cy + top); ctx.lineTo(cx - hw, cy + side); ctx.lineTo(cx - hw, cy - side);
        ctx.closePath();
      };
      for (let r = -1; r <= 4; r++) {
        for (let c = -1; c <= 4; c++) {
          const cx = c * w + (r % 2 ? w / 2 : 0) + w / 4, cy = r * rowH + rowH / 2;
          const along = (cx + cy) / S;                       // across the tile in tiles, like flowFill()
          const x = ((((along - shift) / 4) % 1) + 1) % 1;
          const lead = Math.pow(Math.max(0, Math.cos(x * Math.PI * 2)), 8);
          const trail = Math.pow(Math.max(0, Math.cos((x + 0.12) * Math.PI * 2)), 6) * 0.6;
          const k = Math.max(lead, trail);
          if (k > 0.05) {
            const r1 = Math.round(40 + 20 * lead + 150 * trail), g1 = Math.round(60 + 170 * lead), b1 = Math.round(90 + 165 * k);
            ctx.save();
            ctx.shadowColor = `rgba(${r1},${g1},${b1},${k})`;
            ctx.shadowBlur = 12 * k;
            ctx.fillStyle = `rgba(${r1},${g1},${b1},${0.25 + 0.7 * k})`;
            hex(cx, cy, 3);
            ctx.fill();
            ctx.restore();
          }
          ctx.strokeStyle = `rgba(90,220,255,${0.35 + 0.5 * k})`;
          ctx.lineWidth = 2;
          hex(cx, cy, 2);
          ctx.stroke();
        }
      }
    },
  },

  // A band of light that rolls across the whole dance floor.
  wave: {
    frames: 16,
    speed: 1,
    phase: 'flow',
    period: 4,
    draw(ctx, S, frame) {
      flowFill(ctx, S, frame, 16, 4, (x) => {
        const band = Math.pow(Math.max(0, Math.cos(x * Math.PI * 2)), 6);
        const echo = Math.pow(Math.max(0, Math.cos((x - 0.5) * Math.PI * 2)), 10) * 0.5;
        const r = 25 + 230 * band + 30 * echo, g = 20 + 60 * band + 200 * echo, b = 60 + 150 * band + 230 * echo;
        return `rgb(${r | 0},${g | 0},${b | 0})`;
      });
      bevel(ctx, S, 'rgba(255,255,255,0.12)', 'rgba(0,0,0,0.55)');
    },
  },

  // A smooth rainbow flowing across the whole dance floor.
  rainbow: {
    frames: 24,
    speed: 1,
    phase: 'flow',
    period: 6,
    draw(ctx, S, frame) {
      flowFill(ctx, S, frame, 24, 6, (x) => `hsl(${(x * 360) | 0},90%,58%)`);
      const gloss = ctx.createLinearGradient(0, 0, S, S);
      gloss.addColorStop(0, 'rgba(255,255,255,0.35)');
      gloss.addColorStop(0.45, 'rgba(255,255,255,0)');
      gloss.addColorStop(1, 'rgba(0,0,0,0.15)');
      ctx.fillStyle = gloss;
      ctx.fillRect(0, 0, S, S);
      bevel(ctx, S, 'rgba(255,255,255,0.3)', 'rgba(0,0,0,0.5)');
    },
  },

  // Lights up under each dancer's feet and splashes to the tiles around
  // them. Frame 0 is idle, frames 1-7 are brighter and brighter.
  step: {
    frames: 8,
    phase: 'step',
    draw(ctx, S, frame) {
      ctx.fillStyle = '#16131f';
      ctx.fillRect(0, 0, S, S);
      const k = frame / 7;
      if (k > 0) {
        const hue = 300 - 120 * k; // purple when faint, turning teal at full
        const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.75);
        g.addColorStop(0, `hsla(${hue},100%,${55 + 25 * k}%,${0.5 + 0.5 * k})`);
        g.addColorStop(1, `hsla(${hue},100%,45%,${0.25 * k})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, S, S);
      }
      // Dotted light grid, faint when idle.
      ctx.fillStyle = `rgba(255,255,255,${0.18 + 0.6 * k})`;
      for (let i = 1; i < 4; i++) {
        for (let j = 1; j < 4; j++) {
          ctx.beginPath();
          ctx.arc((i * S) / 4, (j * S) / 4, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      bevel(ctx, S, `rgba(255,255,255,${0.1 + 0.3 * k})`, 'rgba(0,0,0,0.6)');
    },
  },

  // The October 2026 batch from the owner's five reference clubs.
  // Black-and-white waves swirling across the floor, still (01, the brick
  // street club). The waves repeat every tile, so a floor reads as one swirl.
  swirl: {
    frames: 1,
    draw(ctx, S) {
      const img = ctx.createImageData(S, S);
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const u = x / S, v = y / S;
          const w = Math.sin(2 * Math.PI * (2 * v + 0.28 * Math.sin(2 * Math.PI * u) + 0.12 * Math.sin(4 * Math.PI * (u + v))));
          const t = Math.max(0, Math.min(1, 0.5 + w * 2.2));
          const c = Math.round(26 + t * (238 - 26));
          const i = (y * S + x) * 4;
          img.data[i] = c; img.data[i + 1] = c; img.data[i + 2] = c + 4; img.data[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      const g = ctx.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, 'rgba(255,255,255,0.1)');
      g.addColorStop(1, 'rgba(0,0,0,0.12)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      bevel(ctx, S, 'rgba(255,255,255,0.1)', 'rgba(0,0,0,0.35)');
    },
  },

  // A purple light-up grid, each cell glowing pink in the middle and deep
  // purple at its edges, breathing slowly (02, the purple floor club).
  purpleHaze: {
    frames: 8,
    speed: 3,
    phase: 'sync',
    draw(ctx, S, frame) {
      ctx.fillStyle = '#12091e';
      ctx.fillRect(0, 0, S, S);
      const k = 0.55 + 0.45 * (0.5 - 0.5 * Math.cos((frame / 8) * Math.PI * 2));
      const n = 2, gap = 5, c = (S - gap * (n + 1)) / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const x = gap + i * (c + gap), y = gap + j * (c + gap);
          const g = ctx.createRadialGradient(x + c / 2, y + c / 2, 2, x + c / 2, y + c / 2, c * 0.72);
          g.addColorStop(0, `rgba(255,${Math.round(120 + 80 * k)},235,1)`);
          g.addColorStop(0.45, `rgba(220,${Math.round(60 + 40 * k)},240,1)`);
          g.addColorStop(1, `rgba(${Math.round(70 + 40 * k)},20,${Math.round(130 + 50 * k)},1)`);
          ctx.save();
          ctx.shadowColor = `rgba(200,80,255,${0.8 * k})`;
          ctx.shadowBlur = 10;
          ctx.fillStyle = g;
          ctx.fillRect(x, y, c, c);
          ctx.restore();
          const sh = ctx.createLinearGradient(x, y, x + c, y + c);
          sh.addColorStop(0, 'rgba(255,255,255,0.25)');
          sh.addColorStop(0.5, 'rgba(255,255,255,0)');
          ctx.fillStyle = sh;
          ctx.fillRect(x, y, c, c);
        }
      }
      bevel(ctx, S, 'rgba(255,180,255,0.2)', 'rgba(0,0,0,0.6)');
    },
  },

  // Dark green glass with glowing cyan circles: a ring in each tile's
  // middle and quarter rings in its corners, so the circles link up across
  // the floor (04, the art deco club). A slow glow.
  decoRings: {
    frames: 8,
    speed: 3,
    phase: 'sync',
    draw(ctx, S, frame) {
      const bg = ctx.createLinearGradient(0, 0, S, S);
      bg.addColorStop(0, '#0f3a2e');
      bg.addColorStop(1, '#082219');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, S, S);
      const k = 0.6 + 0.4 * (0.5 - 0.5 * Math.cos((frame / 8) * Math.PI * 2));
      ctx.save();
      ctx.shadowColor = '#4cf2ff';
      ctx.shadowBlur = 6 + 10 * k;
      ctx.strokeStyle = `rgba(110,240,255,${0.55 + 0.45 * k})`;
      ctx.lineWidth = 4;
      const ring = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); };
      ring(S / 2, S / 2, S * 0.26);
      for (const [x, y] of [[0, 0], [S, 0], [0, S], [S, S]]) ring(x, y, S * 0.24);
      ctx.lineWidth = 2;
      ring(S / 2, S / 2, S * 0.12);
      ctx.restore();
      ctx.fillStyle = `rgba(200,255,255,${0.7 * k})`;
      ctx.beginPath(); ctx.arc(S / 2, S / 2, 3.5, 0, Math.PI * 2); ctx.fill();
      bevel(ctx, S, 'rgba(255,255,255,0.08)', 'rgba(0,0,0,0.5)');
    },
  },

  // Red and orange light-up checks glowing in waves, a dark diamond line
  // through each tile like the border on the theatre club's floor (03).
  theatreGlow: {
    frames: 8,
    speed: 2,
    phase: 'ripple',
    draw(ctx, S, frame) {
      const k = 0.45 + 0.55 * (0.5 - 0.5 * Math.cos((frame / 8) * Math.PI * 2));
      const n = 2, c = S / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const orange = (i + j) % 2;
          const base = orange ? [255, 140, 30] : [235, 40, 30];
          const x = i * c, y = j * c;
          const g = ctx.createRadialGradient(x + c / 2, y + c / 2, 2, x + c / 2, y + c / 2, c * 0.75);
          const mix = (v, t) => Math.round(40 + (v - 40) * t);
          g.addColorStop(0, `rgb(${mix(Math.min(255, base[0] + 30), k)},${mix(Math.min(255, base[1] + 70), k)},${mix(base[2] + 40, k)})`);
          g.addColorStop(1, `rgb(${mix(base[0], k * 0.8)},${mix(base[1], k * 0.8)},${mix(base[2], k * 0.8)})`);
          ctx.fillStyle = g;
          ctx.fillRect(x, y, c, c);
        }
      }
      ctx.strokeStyle = 'rgba(60,8,4,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(S / 2, 0); ctx.lineTo(S, S / 2); ctx.lineTo(S / 2, S); ctx.lineTo(0, S / 2); ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(60,8,4,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(c, S); ctx.moveTo(0, c); ctx.lineTo(S, c); ctx.stroke();
      bevel(ctx, S, 'rgba(255,220,180,0.25)', 'rgba(40,0,0,0.6)');
    },
  },

  // The classic round-bulb light-up floor: a 3x3 grid of round lights in
  // blue, cyan and yellow blinking on and off, each tile on its own.
  bubbleLights: {
    frames: 8,
    speed: 3,
    phase: 'random',
    draw(ctx, S, frame) {
      ctx.fillStyle = '#13111c';
      ctx.fillRect(0, 0, S, S);
      const colors = ['#3d7dff', '#3de8ff', '#ffe03d'];
      const n = 3, c = S / n, r = c * 0.36;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const x = c * (i + 0.5), y = c * (j + 0.5);
          const lit = (i * 3 + j * 5 + frame) % 3 !== 0;
          const color = colors[(i + j * 2 + Math.floor(frame / 2)) % 3];
          ctx.save();
          if (lit) { ctx.shadowColor = color; ctx.shadowBlur = 14; }
          const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 1, x, y, r);
          g.addColorStop(0, lit ? '#ffffff' : '#3a3648');
          g.addColorStop(0.35, lit ? color : '#2a2638');
          g.addColorStop(1, lit ? color : '#1c1a26');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          ctx.strokeStyle = 'rgba(0,0,0,0.6)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
        }
      }
      bevel(ctx, S, 'rgba(255,255,255,0.1)', 'rgba(0,0,0,0.6)');
    },
  },

  // Icy blue light-up diamonds with a white star twinkling in each (05, the
  // ice club), each tile twinkling on its own.
  iceStar: {
    frames: 8,
    speed: 2,
    phase: 'random',
    draw(ctx, S, frame) {
      ctx.fillStyle = '#0a1630';
      ctx.fillRect(0, 0, S, S);
      const k = 0.55 + 0.45 * (0.5 - 0.5 * Math.cos((frame / 8) * Math.PI * 2));
      const g = ctx.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S * 0.55);
      g.addColorStop(0, `rgba(230,250,255,${0.6 + 0.4 * k})`);
      g.addColorStop(0.5, `rgba(110,200,255,${0.75 + 0.25 * k})`);
      g.addColorStop(1, 'rgba(30,90,200,1)');
      ctx.save();
      ctx.shadowColor = '#7fd8ff';
      ctx.shadowBlur = 8 + 8 * k;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(S / 2, 6); ctx.lineTo(S - 6, S / 2); ctx.lineTo(S / 2, S - 6); ctx.lineTo(6, S / 2); ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 2;
      ctx.stroke();
      const star = (r1, r2) => {
        ctx.beginPath();
        for (let a = 0; a < 8; a++) {
          const r = a % 2 ? r2 : r1, t = (a / 8) * Math.PI * 2 - Math.PI / 2;
          ctx.lineTo(S / 2 + Math.cos(t) * r, S / 2 + Math.sin(t) * r);
        }
        ctx.closePath();
      };
      ctx.save();
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 6 + 12 * k;
      ctx.fillStyle = '#ffffff';
      star(S * (0.16 + 0.06 * k), S * 0.05);
      ctx.fill();
      ctx.restore();
      bevel(ctx, S, 'rgba(200,240,255,0.25)', 'rgba(0,0,0,0.6)');
    },
  },
};

// Regular floors: painted onto the room's floor tile by tile (see
// floorPaint.js), under the furniture. Patrons walk on them but only dance
// on dance floors. Static, with soft seams so a painted area reads as one
// surface.
export const FLOOR_PAINTS = {
  // Plain cream tiles with grey grout, four to a floor tile: the first step
  // up from bare concrete.
  plainTile: {
    frames: 1,
    draw(ctx, S) {
      const r = rng(41);
      const h = S / 2;
      ctx.fillStyle = '#8c887e';
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          const v = 196 + Math.floor(r() * 10);
          ctx.fillStyle = `rgb(${v},${v - 6},${v - 18})`;
          ctx.fillRect(i * h + 2, j * h + 2, h - 4, h - 4);
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.fillRect(i * h + 4, j * h + 4, h - 8, 3);
        }
      }
    },
  },

  // Black glass tiles with a silver star in each, like an ice palace floor.
  starryGlass: {
    frames: 1,
    draw(ctx, S) {
      const g = ctx.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, '#20222e');
      g.addColorStop(1, '#0d0e16');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      const star = (cx, cy, R, color) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = -Math.PI / 2 + (k * Math.PI) / 5;
          const rad = k % 2 ? R * 0.42 : R;
          ctx.lineTo(cx + rad * Math.cos(a), cy + rad * Math.sin(a));
        }
        ctx.closePath();
        ctx.fill();
      };
      ctx.save();
      ctx.shadowColor = 'rgba(200,220,255,0.8)';
      ctx.shadowBlur = 8;
      star(S / 2, S / 2, S * 0.26, '#d8dde8');
      ctx.restore();
      for (const [x, y] of [[0, 0], [S, 0], [0, S], [S, S]]) star(x, y, S * 0.1, 'rgba(200,206,220,0.75)');
      const sheen = ctx.createLinearGradient(0, 0, S, S);
      sheen.addColorStop(0, 'rgba(255,255,255,0.16)');
      sheen.addColorStop(0.4, 'rgba(255,255,255,0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, S, S);
      ctx.strokeStyle = 'rgba(160,170,200,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, S - 2, S - 2);
    },
  },

  // The future batch (October 2026): a dark circuit board, thin cyan
  // traces with round pads, two of them running straight across so the
  // tiles join up.
  circuit: {
    frames: 1,
    draw(ctx, S) {
      ctx.fillStyle = '#0c1416';
      ctx.fillRect(0, 0, S, S);
      const g = ctx.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, 'rgba(40,90,100,0.25)');
      g.addColorStop(1, 'rgba(0,0,0,0.2)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      ctx.save();
      ctx.shadowColor = 'rgba(60,230,255,0.9)';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = 'rgba(70,225,255,0.85)';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      const line = (pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); };
      line([[0, 32], [S, 32]]);                    // straight across: joins the next tile
      line([[96, 0], [96, S]]);
      line([[0, 88], [40, 88], [60, 108], [60, S]]);
      line([[18, 0], [18, 14], [44, 40], [44, 60], [70, 60]]);
      line([[96, 70], [118, 70], [118, 100], [S, 100]]);
      line([[60, 32], [60, 46]]);
      ctx.fillStyle = 'rgba(160,245,255,1)';
      for (const [x, y] of [[70, 60], [60, 46], [96, 70], [44, 60], [18, 14]]) { ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = '#1a2a30';
      for (const [x, y, w, h] of [[72, 76, 18, 26], [10, 44, 22, 14], [104, 8, 18, 16]]) {   // little chips
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(70,225,255,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      }
      ctx.strokeStyle = 'rgba(70,225,255,0.12)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, S - 2, S - 2);
    },
  },

  // Plain dark concrete.
  concrete: {
    frames: 1,
    draw(ctx, S) {
      ctx.fillStyle = '#56565e';
      ctx.fillRect(0, 0, S, S);
      const r = rng(11);
      for (let k = 0; k < 260; k++) {
        ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
        ctx.fillRect(r() * S, r() * S, 2 + r() * 3, 2 + r() * 3);
      }
      seam(ctx, S);
    },
  },

  // Grey stone tiles, four to a floor tile.
  stone: {
    frames: 1,
    draw(ctx, S) {
      const r = rng(5);
      const h = S / 2;
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          const v = 112 + Math.floor(r() * 18);
          ctx.fillStyle = `rgb(${v},${v},${v + 8})`;
          ctx.fillRect(i * h, j * h, h, h);
          ctx.strokeStyle = 'rgba(40,40,48,0.6)';
          ctx.lineWidth = 2;
          ctx.strokeRect(i * h + 1, j * h + 1, h - 2, h - 2);
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(i * h + 3, j * h + 3, h - 6, 3);
        }
      }
    },
  },

  // Light oak planks.
  planks: {
    frames: 1,
    draw(ctx, S) {
      const r = rng(23);
      const n = 4;
      const w = S / n;
      for (let i = 0; i < n; i++) {
        const tone = ['#b98552', '#c4925e', '#ab7848', '#bf8b57'][i % 4];
        ctx.fillStyle = tone;
        ctx.fillRect(0, i * w, S, w);
        ctx.strokeStyle = 'rgba(80,45,20,0.25)';
        ctx.lineWidth = 1;
        for (let g = 0; g < 3; g++) {
          const y = i * w + 4 + r() * (w - 8);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.bezierCurveTo(S * 0.3, y + 2, S * 0.6, y - 2, S, y + (r() - 0.5) * 2);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(60,30,12,0.5)';
        ctx.fillRect(0, i * w, S, 1.5);
        const cut = (i % 2 ? 0.3 : 0.75) * S;
        ctx.fillRect(cut, i * w, 1.5, w);
      }
    },
  },

  // Deep red carpet with a small gold diamond pattern.
  redCarpet: {
    frames: 1,
    draw(ctx, S) {
      ctx.fillStyle = '#8e1424';
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = 'rgba(232,184,80,0.55)';
      const step = S / 4;
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          const cx = i * step + step / 2;
          const cy = j * step + step / 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy - 5); ctx.lineTo(cx + 5, cy); ctx.lineTo(cx, cy + 5); ctx.lineTo(cx - 5, cy);
          ctx.closePath();
          ctx.fill();
        }
      }
      fuzz(ctx, S, 31);
    },
  },

  // Purple carpet with soft swirls.
  purpleCarpet: {
    frames: 1,
    draw(ctx, S) {
      ctx.fillStyle = '#4b2a7a';
      ctx.fillRect(0, 0, S, S);
      ctx.strokeStyle = 'rgba(190,140,255,0.45)';
      ctx.lineWidth = 3;
      for (const [cx, cy] of [[0, 0], [S, 0], [0, S], [S, S], [S / 2, S / 2]]) {
        ctx.beginPath();
        ctx.arc(cx, cy, S * 0.22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, S * 0.12, 0, Math.PI * 2);
        ctx.stroke();
      }
      fuzz(ctx, S, 7);
    },
  },

  // White marble with grey veins.
  marble: {
    frames: 1,
    draw(ctx, S) {
      ctx.fillStyle = '#e8e6ea';
      ctx.fillRect(0, 0, S, S);
      veins(ctx, S, 'rgba(120,118,135,0.55)', 4);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(0, 0, S, S / 3);
      seam(ctx, S, 'rgba(150,150,165,0.6)');
    },
  },

  // Glossy black tiles, as black as black gets (the owner asked for a
  // deep, space-dark black): just the faintest sheen and seams.
  blackGloss: {
    frames: 1,
    draw(ctx, S) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, S, S);
      const g = ctx.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, 'rgba(255,255,255,0.06)');
      g.addColorStop(0.35, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      seam(ctx, S, 'rgba(40,38,48,0.6)');
    },
  },

  // Glossy red tiles with a wet-look shine.
  redGloss: {
    frames: 1,
    draw(ctx, S) {
      ctx.fillStyle = '#a80c1c';
      ctx.fillRect(0, 0, S, S);
      const deep = ctx.createLinearGradient(S, S, 0, 0);
      deep.addColorStop(0, 'rgba(60,0,8,0.45)');
      deep.addColorStop(0.6, 'rgba(60,0,8,0)');
      ctx.fillStyle = deep;
      ctx.fillRect(0, 0, S, S);
      const g = ctx.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, 'rgba(255,255,255,0.32)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.04)');
      g.addColorStop(0.5, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      seam(ctx, S, 'rgba(70,0,10,0.75)');
    },
  },

  // Cheetah print: small solid black spots, round and blobby, scattered
  // over a warm golden ground (they wrap across the tile edges so
  // neighbouring tiles join up).
  cheetah: {
    frames: 1,
    draw(ctx, S) {
      const g = ctx.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, '#e8b964');
      g.addColorStop(1, '#d49a44');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      const r = rng(29);
      for (let k = 0; k < 18; k++) {
        const x0 = r() * S, y0 = r() * S, rad = 4 + r() * 5, turn = r() * Math.PI, squash = 0.65 + r() * 0.35;
        for (const dx of [-S, 0, S]) {
          for (const dy of [-S, 0, S]) {
            const x = x0 + dx, y = y0 + dy;
            if (x < -10 || x > S + 10 || y < -10 || y > S + 10) continue;
            ctx.fillStyle = '#1a1006';
            ctx.beginPath();
            ctx.ellipse(x, y, rad, rad * squash, turn, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      fuzz(ctx, S, 41);
      const sheen = ctx.createLinearGradient(0, 0, S, S);
      sheen.addColorStop(0, 'rgba(255,255,255,0.12)');
      sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, S, S);
    },
  },

  // Black marble with gold veins.
  goldMarble: {
    frames: 1,
    draw(ctx, S) {
      ctx.fillStyle = '#1c1a20';
      ctx.fillRect(0, 0, S, S);
      veins(ctx, S, 'rgba(232,184,80,0.8)', 9);
      const g = ctx.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, 'rgba(255,255,255,0.12)');
      g.addColorStop(0.45, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      seam(ctx, S, 'rgba(200,160,70,0.5)');
    },
  },

  // The October 2026 batch from the owner's reference clubs.
  // Black with tiny white dots in neat staggered rows.
  pinDot: {
    frames: 1,
    draw(ctx, S) {
      const g = ctx.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, '#1a1a20');
      g.addColorStop(1, '#0e0e12');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      const n = 8, c = S / n;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const x = (i + (j % 2 ? 0.5 : 0) + 0.25) * c, y = (j + 0.5) * c;
          ctx.beginPath(); ctx.arc(x % S, y, 1.7, 0, Math.PI * 2); ctx.fill();
        }
      }
      seam(ctx, S, 'rgba(0,0,0,0.6)');
    },
  },

  // Grey steel tread plate, raised lugs in a crisscross.
  diamondPlate: {
    frames: 1,
    draw(ctx, S) {
      const g = ctx.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, '#8d939c');
      g.addColorStop(0.5, '#6c727b');
      g.addColorStop(1, '#80868f');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      const n = 4, c = S / n;
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const x = (i + 0.5) * c, y = (j + 0.5) * c;
          const a = (i + j) % 2 ? Math.PI / 4 : -Math.PI / 4;
          ctx.save();
          ctx.translate(x, y); ctx.rotate(a);
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.beginPath(); ctx.ellipse(1.5, 2.5, c * 0.36, c * 0.1, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#c9ced6';
          ctx.beginPath(); ctx.ellipse(0, 0, c * 0.36, c * 0.1, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          ctx.beginPath(); ctx.ellipse(-1, -1.5, c * 0.26, c * 0.035, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      }
      seam(ctx, S, 'rgba(40,42,48,0.6)');
    },
  },

  // Blue-grey slate flagstones, staggered (01, the brick street club).
  blueSlate: {
    frames: 1,
    draw(ctx, S) {
      const r = rng(41);
      const h = S / 2;
      const stones = [[0, 0, S * 0.6, h], [S * 0.6, 0, S * 0.4, h], [0, h, S * 0.35, h], [S * 0.35, h, S * 0.65, h]];
      for (const [x, y, w, hh] of stones) {
        const v = Math.floor(r() * 16);
        ctx.fillStyle = `rgb(${84 + v},${100 + v},${120 + v})`;
        ctx.fillRect(x, y, w, hh);
        for (let k = 0; k < 40; k++) {
          ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,20,0.1)';
          ctx.fillRect(x + r() * w, y + r() * hh, 2 + r() * 4, 1.5 + r() * 2);
        }
        ctx.strokeStyle = 'rgba(30,36,48,0.75)';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x + 1.25, y + 1.25, w - 2.5, hh - 2.5);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(x + 3, y + 3, w - 6, 2.5);
      }
    },
  },

  // Art deco fan tiles: rows of grey and white scallops with arcs inside
  // (04, the art deco club).
  decoFans: {
    frames: 1,
    draw(ctx, S) {
      ctx.fillStyle = '#d8d8de';
      ctx.fillRect(0, 0, S, S);
      const w = S / 2, h = w / 2;
      for (let row = -1; row <= 4; row++) {
        const y = row * h;
        const off = row % 2 ? w / 2 : 0;
        for (let i = -1; i <= 2; i++) {
          const cx = i * w + off + w / 2, cy = y + h;
          const grey = (((row + 4) % 2) === 0) !== (((i + 2) % 2) === 0);
          ctx.fillStyle = grey ? '#9a9ca6' : '#f2f2f6';
          ctx.strokeStyle = '#5c5e68';
          ctx.lineWidth = 2.4;
          ctx.beginPath(); ctx.arc(cx, cy, w / 2, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = grey ? 'rgba(255,255,255,0.55)' : 'rgba(90,92,104,0.45)';
          ctx.lineWidth = 1.6;
          for (const k of [0.78, 0.58, 0.38, 0.18]) { ctx.beginPath(); ctx.arc(cx, cy, (w / 2) * k, Math.PI, 0); ctx.stroke(); }
        }
      }
      seam(ctx, S, 'rgba(60,60,70,0.35)');
    },
  },

  // Black glossy tiles with a silver star in each and thin silver lines
  // (05, the ice club).
  silverStars: {
    frames: 1,
    draw(ctx, S) {
      const h = S / 2;
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          const x = i * h, y = j * h;
          const g = ctx.createLinearGradient(x, y, x + h, y + h);
          g.addColorStop(0, '#24242c');
          g.addColorStop(1, '#0c0c10');
          ctx.fillStyle = g;
          ctx.fillRect(x, y, h, h);
          const cx = x + h / 2, cy = y + h / 2;
          const sg = ctx.createLinearGradient(cx - 14, cy - 14, cx + 14, cy + 14);
          sg.addColorStop(0, '#ffffff');
          sg.addColorStop(0.5, '#a9b0ba');
          sg.addColorStop(1, '#e6e9ee');
          ctx.fillStyle = sg;
          ctx.beginPath();
          for (let a = 0; a < 8; a++) {
            const r = a % 2 ? 4 : 15, t = (a / 8) * Math.PI * 2 - Math.PI / 2;
            ctx.lineTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r);
          }
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(200,206,214,0.55)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 0.75, y + 0.75, h - 1.5, h - 1.5);
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          ctx.fillRect(x + 3, y + 3, h - 6, h * 0.3);
        }
      }
    },
  },
};

// A thin seam around a painted floor tile.
function seam(ctx, S, color = 'rgba(30,30,38,0.45)') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0.75, 0.75, S - 1.5, S - 1.5);
}

// Carpet texture: lots of tiny specks.
function fuzz(ctx, S, seed) {
  const r = rng(seed);
  for (let k = 0; k < 500; k++) {
    ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)';
    ctx.fillRect(r() * S, r() * S, 1.5, 1.5);
  }
}

// Marble veins: a few wandering lines.
function veins(ctx, S, color, seed) {
  const r = rng(seed);
  ctx.strokeStyle = color;
  for (let k = 0; k < 4; k++) {
    ctx.lineWidth = 0.8 + r() * 1.6;
    let x = r() * S;
    let y = 0;
    ctx.beginPath();
    ctx.moveTo(x, y);
    while (y < S) {
      x += (r() - 0.5) * 30;
      y += 10 + r() * 20;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// Paints a 'flow' design's slice of a pattern that repeats every `period`
// tiles along the floor's diagonal (gx + gy). color(x) gives the colour at
// position x in [0, 1) through one repeat. Neighbouring tiles join up
// seamlessly because each one is offset by its distance (see
// floorFrameFor()).
function flowFill(ctx, S, frame, frames, period, color) {
  const g = ctx.createLinearGradient(0, 0, S, S);
  const shift = (frame / frames) * period;
  for (let k = 0; k <= 32; k++) {
    const along = (k / 32) * 2; // u + v across the tile, in tiles
    const x = (((along - shift) / period) % 1 + 1) % 1;
    g.addColorStop(k / 32, color(x));
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
}

// Which frame a tile at (gx, gy) shows on animation tick `tick`, for every
// phase except 'step' (the game tracks those itself).
export function floorFrameFor(style, gx, gy, tick) {
  const st = FLOOR_STYLES[style];
  if (st.frames <= 1) return 0;
  const beat = Math.floor(tick / (st.speed || 1));
  let offset = 0;
  if (st.phase === 'random') offset = (gx * 7 + gy * 13 + gx * gy * 5) % st.frames;
  else if (st.phase === 'ripple') offset = -(gx + gy);
  else if (st.phase === 'flow') offset = -(gx + gy) * Math.round(st.frames / st.period);
  return (((beat + offset) % st.frames) + st.frames) % st.frames;
}

// One frame of a design, squashed into the 2:1 floor diamond.
export function floorFrameCanvas(style, frame = 0) {
  const square = document.createElement('canvas');
  square.width = square.height = SQUARE;
  (FLOOR_STYLES[style] || FLOOR_PAINTS[style]).draw(square.getContext('2d'), SQUARE, frame);
  const out = document.createElement('canvas');
  out.width = FLOOR_TEX_W;
  out.height = FLOOR_TEX_H;
  const ctx = out.getContext('2d');
  // Square (u along +gx, v along +gy) -> diamond: u runs down-right, v
  // down-left, from the diamond's top corner.
  const a = FLOOR_TEX_W / (2 * SQUARE), b = FLOOR_TEX_H / (2 * SQUARE);
  ctx.setTransform(a, b, -a, b, FLOOR_TEX_W / 2, 0);
  ctx.drawImage(square, 0, 0);
  return out;
}

// Texture key for a design's frame.
export function floorTextureKey(style, frame = 0) {
  return `floor_${style}_${frame}`;
}

// The bare floor of the room: one seamless sheet of old, plain concrete,
// worn and stained, with no tile lines. Drawn at 2x for the size x size
// room, as the room's diamond seen from the game's camera (see
// drawBareFloor()).
export function bareFloorCanvas(w, h = w) {
  const W = (w + h) * FLOOR_TEX_W / 2;
  const H = (w + h) * FLOOR_TEX_H / 2;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.beginPath();
  ctx.moveTo(h * FLOOR_TEX_W / 2, 0);
  ctx.lineTo(W, w * FLOOR_TEX_H / 2);
  ctx.lineTo(w * FLOOR_TEX_W / 2, H);
  ctx.lineTo(0, h * FLOOR_TEX_H / 2);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = '#4f4c4b';
  ctx.fillRect(0, 0, W, H);
  const r = rng(29);
  // Big soft patches of lighter and darker concrete, flattened 2:1 so they
  // lie on the floor.
  const blot = (x, y, rad, color) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.5);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-rad, -rad, rad * 2, rad * 2);
    ctx.restore();
  };
  const area = w * h;
  for (let i = 0; i < area * 1.2; i++) {
    const light = r() < 0.45;
    blot(r() * W, r() * H, 40 + r() * 160, light ? `rgba(255,245,230,${0.03 + r() * 0.04})` : `rgba(10,8,8,${0.05 + r() * 0.08})`);
  }
  // Old stains and scuffs.
  for (let i = 0; i < area * 0.25; i++) {
    blot(r() * W, r() * H, 10 + r() * 30, `rgba(20,14,10,${0.08 + r() * 0.1})`);
  }
  // Fine grit.
  for (let i = 0; i < area * 260; i++) {
    const a = r() * 0.1;
    ctx.fillStyle = r() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    ctx.fillRect(r() * W, r() * H, 2, 1);
  }
  beatUpFloor(ctx, w, h, r);
  return c;
}

// The wear on a new club's floor: old saw-cut joints, poured patches,
// cracks, chipped holes, spill rings and specks. Drawn in floor space (one
// unit = one tile; the transform lays it flat on the isometric floor).
function beatUpFloor(ctx, w, h, r) {
  const area = w * h;
  ctx.save();
  ctx.setTransform(FLOOR_TEX_W / 2, FLOOR_TEX_H / 2, -FLOOR_TEX_W / 2, FLOOR_TEX_H / 2, h * FLOOR_TEX_W / 2, 0);
  // Saw-cut joints every few tiles, half filled with grime.
  ctx.strokeStyle = 'rgba(12,10,10,0.35)';
  ctx.lineWidth = 0.035;
  for (let x = 4; x < w; x += 4) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 4; y < h; y += 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  // Poured repair patches in a different grey, with dark seams.
  for (let i = 0; i < Math.max(2, area * 0.025); i++) {
    const pw = 0.8 + r() * 1.8, ph = 0.6 + r() * 1.4, px = r() * (w - pw), py = r() * (h - ph);
    const tone = r() < 0.5 ? 'rgba(120,116,108,0.35)' : 'rgba(20,18,18,0.3)';
    ctx.fillStyle = tone;
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = 'rgba(10,8,8,0.45)';
    ctx.lineWidth = 0.03;
    ctx.strokeRect(px, py, pw, ph);
  }
  // Spill rings and sticky stains (circles here, flat ellipses on screen).
  for (let i = 0; i < area * 0.06; i++) {
    const x = r() * w, y = r() * h, rad = 0.12 + r() * 0.45;
    const tint = r() < 0.4 ? '60,36,12' : '14,12,12';
    ctx.fillStyle = `rgba(${tint},${0.12 + r() * 0.14})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rad, rad * (0.7 + r() * 0.3), r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${tint},${0.18 + r() * 0.15})`;
    ctx.lineWidth = 0.02;
    ctx.stroke();
  }
  // Cracks: jagged lines that wander, now and then forking; each drawn
  // twice, a light broken edge and the dark gap on top.
  const crackPaths = [];
  const crack = (x, y, ang, len, width) => {
    const pts = [[x, y]];
    for (let k = 0; k < len; k++) {
      ang += (r() - 0.5) * 1.1;
      x += Math.cos(ang) * 0.18;
      y += Math.sin(ang) * 0.18;
      pts.push([x, y]);
      if (r() < 0.08 && width > 0.015) crack(x, y, ang + (r() < 0.5 ? 0.9 : -0.9), (len - k) / 2, width * 0.6);
    }
    crackPaths.push({ pts, width });
  };
  for (let i = 0; i < area * 0.05; i++) crack(r() * w, r() * h, r() * Math.PI * 2, 6 + r() * 18, 0.045);
  for (const [color, dx, grow] of [['rgba(205,198,186,0.16)', 0.03, 1.6], ['rgba(8,6,6,0.8)', 0, 1]]) {
    ctx.strokeStyle = color;
    for (const { pts, width } of crackPaths) {
      ctx.lineWidth = width * grow;
      ctx.beginPath();
      pts.forEach(([x, y], k) => (k ? ctx.lineTo(x + dx, y + dx) : ctx.moveTo(x + dx, y + dx)));
      ctx.stroke();
    }
  }
  // Chipped holes showing the stones in the concrete.
  for (let i = 0; i < area * 0.035; i++) {
    const cx = r() * w, cy = r() * h, rad = 0.06 + r() * 0.14;
    ctx.beginPath();
    for (let a = 0; a < 7; a++) {
      const t = (a / 7) * Math.PI * 2, d = rad * (0.6 + r() * 0.6);
      if (a === 0) ctx.moveTo(cx + Math.cos(t) * d, cy + Math.sin(t) * d);
      else ctx.lineTo(cx + Math.cos(t) * d, cy + Math.sin(t) * d);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(22,19,18,0.8)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(170,164,152,0.35)';
    ctx.lineWidth = 0.015;
    ctx.stroke();
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = 'rgba(140,132,120,0.6)';
      ctx.fillRect(cx + (r() - 0.5) * rad, cy + (r() - 0.5) * rad, 0.025, 0.025);
    }
  }
  // Gum, paint flecks and old tape marks.
  for (let i = 0; i < area * 0.25; i++) {
    ctx.fillStyle = r() < 0.6 ? 'rgba(15,12,12,0.55)' : 'rgba(200,196,186,0.3)';
    ctx.beginPath();
    ctx.arc(r() * w, r() * h, 0.015 + r() * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < area * 0.01; i++) {
    ctx.fillStyle = r() < 0.5 ? 'rgba(210,190,60,0.22)' : 'rgba(200,200,200,0.16)';
    ctx.fillRect(r() * w, r() * h, 0.5 + r() * 0.8, 0.07);
  }
  ctx.restore();
}
