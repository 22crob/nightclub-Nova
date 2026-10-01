// Dance floor tile designs, drawn in code (no image files). Each design
// paints one square tile seen from above; floorFrameCanvas() then squashes
// it into the game's 2:1 diamond. Animated designs have several frames that
// the game steps through to the music (see animateFloors()).
//
// A design: { frames, phase, draw(ctx, S, frame) } where S is the square's
// size in pixels. `phase` says how neighbouring tiles are offset in time:
// 'ripple' (by distance along the floor, so waves roll across it) or
// 'random' (every tile on its own beat).

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
      // A little gloss.
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
            // Grain.
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

  // Bubblegum terrazzo with colourful confetti chips.
  confetti: {
    frames: 1,
    draw(ctx, S) {
      ctx.fillStyle = '#ffb3d1';
      ctx.fillRect(0, 0, S, S);
      const r = rng(42);
      const colors = ['#ffffff', '#ffe14d', '#4dd2ff', '#7a4dff', '#ff4d8d', '#3ce0a0'];
      for (let k = 0; k < 70; k++) {
        ctx.save();
        ctx.translate(r() * S, r() * S);
        ctx.rotate(r() * Math.PI);
        ctx.fillStyle = colors[Math.floor(r() * colors.length)];
        const w = 3 + r() * 7, h = 2 + r() * 4;
        ctx.beginPath();
        ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 3); ctx.lineTo(w / 3, h / 2); ctx.lineTo(-w / 2, h / 3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      bevel(ctx, S);
    },
  },

  // The classic light-up disco floor: a 3x3 grid of glass squares that
  // change colour to the beat.
  lightUp: {
    frames: 8,
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

  // Dark tile with a neon ring that pulses outward from the centre.
  neonRings: {
    frames: 8,
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
      // Fixed inner ring, then the pulse.
      ring(S * 0.16, '#3de0ff', 4, 0.9);
      const t = frame / 8;
      ring(S * (0.2 + t * 0.32), frame % 2 ? '#ff3dd2' : '#3de0ff', 6 - t * 4, 1 - t * 0.7);
      ring(S * (0.2 + ((t + 0.5) % 1) * 0.32), '#ff3dd2', 6 - ((t + 0.5) % 1) * 4, 1 - ((t + 0.5) % 1) * 0.7);
      // Centre dot.
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

  // Deep space: a purple nebula and twinkling stars.
  galaxy: {
    frames: 8,
    phase: 'random',
    draw(ctx, S, frame) {
      ctx.fillStyle = '#0b0920';
      ctx.fillRect(0, 0, S, S);
      const r = rng(99);
      const blobs = [['rgba(140,60,255,0.55)', 0.3, 0.35, 0.5], ['rgba(255,60,170,0.4)', 0.7, 0.65, 0.45], ['rgba(60,160,255,0.35)', 0.75, 0.2, 0.35]];
      for (const [color, bx, by, br] of blobs) {
        const g = ctx.createRadialGradient(bx * S, by * S, 0, bx * S, by * S, br * S);
        g.addColorStop(0, color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, S, S);
      }
      for (let k = 0; k < 40; k++) {
        const x = r() * S, y = r() * S, size = 0.6 + r() * 1.6;
        const twinkle = 0.35 + 0.65 * Math.abs(Math.sin((frame / 8) * Math.PI * 2 + r() * 6.28));
        ctx.globalAlpha = twinkle;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      // A few bigger sparkle stars.
      for (let k = 0; k < 3; k++) {
        const x = 15 + r() * (S - 30), y = 15 + r() * (S - 30);
        const a = 0.3 + 0.7 * Math.abs(Math.sin((frame / 8) * Math.PI * 2 + k * 2));
        ctx.globalAlpha = a;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y);
        ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      bevel(ctx, S, 'rgba(180,140,255,0.25)', 'rgba(0,0,0,0.6)');
    },
  },

  // Black and gold art deco fans with a shimmer that sweeps across.
  goldDeco: {
    frames: 8,
    phase: 'ripple',
    draw(ctx, S, frame) {
      ctx.fillStyle = '#121014';
      ctx.fillRect(0, 0, S, S);
      const half = S / 2;
      const gold = ctx.createLinearGradient(0, 0, S, S);
      gold.addColorStop(0, '#fff0a8');
      gold.addColorStop(0.5, '#d9a52e');
      gold.addColorStop(1, '#9c6d14');
      ctx.strokeStyle = gold;
      for (let bx = 0; bx < 2; bx++) {
        for (let by = 0; by < 2; by++) {
          const cx = bx * half + half / 2, cy = by * half + half;
          for (let k = 1; k <= 4; k++) {
            ctx.lineWidth = k === 4 ? 3 : 2;
            ctx.beginPath();
            ctx.arc(cx, cy, (half / 2) * (k / 4), Math.PI, 0);
            ctx.stroke();
          }
          // Fan spokes.
          ctx.lineWidth = 1.5;
          for (let a = 1; a < 6; a++) {
            const ang = Math.PI + (a / 6) * Math.PI;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(ang) * half / 2, cy + Math.sin(ang) * half / 2);
            ctx.stroke();
          }
        }
      }
      // Shimmer band.
      const p = (frame / 8) * 2 * S - S / 2;
      const sh = ctx.createLinearGradient(p - 30, p - 30, p + 30, p + 30);
      sh.addColorStop(0, 'rgba(255,240,180,0)');
      sh.addColorStop(0.5, 'rgba(255,240,180,0.45)');
      sh.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = sh;
      ctx.fillRect(0, 0, S, S);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#c99526';
      ctx.strokeRect(2, 2, S - 4, S - 4);
    },
  },

  // Frosted glass with cracks, and a cold shine that glides across.
  ice: {
    frames: 8,
    phase: 'ripple',
    draw(ctx, S, frame) {
      const bg = ctx.createLinearGradient(0, 0, S, S);
      bg.addColorStop(0, '#e6fbff');
      bg.addColorStop(0.5, '#9fe3f7');
      bg.addColorStop(1, '#6cc4e8');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, S, S);
      // Glowing core light under the glass.
      const core = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.5);
      core.addColorStop(0, 'rgba(255,255,255,0.7)');
      core.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, S, S);
      // Frost cracks.
      const r = rng(5);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1.2;
      for (let k = 0; k < 6; k++) {
        let x = r() * S, y = r() * S;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let s = 0; s < 4; s++) {
          x += (r() - 0.5) * 30; y += (r() - 0.5) * 30;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // Shine band.
      const p = (frame / 8) * 2 * S - S / 2;
      const sh = ctx.createLinearGradient(p - 24, p - 24, p + 24, p + 24);
      sh.addColorStop(0, 'rgba(255,255,255,0)');
      sh.addColorStop(0.5, 'rgba(255,255,255,0.6)');
      sh.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sh;
      ctx.fillRect(0, 0, S, S);
      bevel(ctx, S, 'rgba(255,255,255,0.8)', 'rgba(40,110,160,0.6)');
    },
  },
};

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
