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
//            floor; the draw function paints its slice of it seamlessly
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
    frames: 16,
    speed: 1,
    phase: 'flow',
    period: 6,
    draw(ctx, S, frame) {
      flowFill(ctx, S, frame, 16, 6, (x) => `hsl(${(x * 360) | 0},90%,58%)`);
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
};

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
  else if (st.phase === 'flow') offset = -(gx + gy) * (st.frames / st.period);
  return (((beat + offset) % st.frames) + st.frames) % st.frames;
}

// One frame of a design, squashed into the 2:1 floor diamond.
export function floorFrameCanvas(style, frame = 0) {
  const square = document.createElement('canvas');
  square.width = square.height = SQUARE;
  FLOOR_STYLES[style].draw(square.getContext('2d'), SQUARE, frame);
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
