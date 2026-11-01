// Draws fish in code from their genome: cartoon bodies with dark outlines,
// markings, fins and an eye. Each fish is two pictures, the body and the
// tail (so the tail can swish), facing right.
import { COLORS } from './config.js';
import { seededRand } from './genetics.js';

export const BODY_W = 230;
export const BODY_H = 190;
export const BODY_CX = 115;
export const BODY_CY = 95;
export const TAIL_W = 140;
export const TAIL_H = 190;
export const TAIL_JX = 134; // where the tail joins the body, in the tail picture

// Body shapes. L = body length, h = height as a share of L, nose = how
// pointed (0 round .. 1 sharp), tail = tail type and size, dorsal / anal =
// fin sizes.
const SHAPES = {
  guppy: { L: 110, h: 0.36, nose: 0.55, tail: 'fan', tailSize: 1.05, dorsal: 0.7, anal: 0.4 },
  goldfish: { L: 110, h: 0.64, nose: 0.25, tail: 'double', tailSize: 0.85, dorsal: 0.9, anal: 0.45 },
  betta: { L: 110, h: 0.38, nose: 0.45, tail: 'veil', tailSize: 0.82, dorsal: 1.15, anal: 1.25 },
  clownfish: { L: 110, h: 0.5, nose: 0.3, tail: 'round', tailSize: 0.8, dorsal: 0.75, anal: 0.5, humps: true },
  tang: { L: 110, h: 0.78, nose: 0.7, tail: 'fork', tailSize: 0.85, dorsal: 0.5, anal: 0.45, longFins: true },
  puffer: { L: 96, h: 0.8, nose: 0.1, tail: 'round', tailSize: 0.55, dorsal: 0.45, anal: 0.35, spikes: true, bigEye: true },
};
const FIN_MULT = { short: 0.78, long: 1.0, veil: 1.5 };

export const shapeOf = (species) => SHAPES[species];

// --- colour helpers ---
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(hex, toHex, t) {
  const a = rgb(hex), b = rgb(toHex);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
const dark = (hex, t) => mix(hex, '#000000', t);
const light = (hex, t) => mix(hex, '#ffffff', t);
const RAINBOW = ['#ff4f6d', '#ff9f2e', '#ffe04a', '#52e07a', '#3fb5ff', '#a66bff'];

function baseFill(ctx, colorKey, x0, x1) {
  const c = COLORS[colorKey];
  if (c.rainbow) {
    const gr = ctx.createLinearGradient(x1, 0, x0, 0);
    RAINBOW.forEach((h, i) => gr.addColorStop(i / (RAINBOW.length - 1), h));
    return gr;
  }
  return c.hex;
}
const outlineOf = (colorKey) => (COLORS[colorKey].ghost ? '#7fa9cc' : COLORS[colorKey].rainbow ? '#5a2a6a' : dark(COLORS[colorKey].hex, 0.55));

// --- the body ---
function bodyPath(ctx, s) {
  const { L } = s;
  const h = s.h * L;
  const hx = L / 2;
  const k = 0.95 - s.nose * 0.35; // how far forward the body stays full height
  ctx.beginPath();
  ctx.moveTo(hx, h * 0.04);
  ctx.bezierCurveTo(hx * k, -h * 0.66, -L * 0.18, -h * 0.62, -hx, -h * 0.15);
  ctx.lineTo(-hx, h * 0.15);
  ctx.bezierCurveTo(-L * 0.18, h * 0.62, hx * k, h * 0.62, hx, h * 0.04);
  ctx.closePath();
}

// Where the top and bottom of the body are at x (near enough for fins).
const bodyEdge = (s, x) => (s.h * s.L) / 2 * Math.sqrt(Math.max(0, 1 - (x / (s.L / 2)) ** 2)) * 0.92;

function finPath(ctx, s, x0, x1, height, up, flow) {
  const dir = up ? -1 : 1;
  const y0 = dir * bodyEdge(s, x0) * 0.8;
  const y1 = dir * bodyEdge(s, x1) * 0.8;
  const peakX = x0 + (x1 - x0) * 0.35;
  const peakY = dir * (bodyEdge(s, peakX) + height);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(x1 - (x1 - x0) * 0.1, peakY, peakX, peakY);
  if (flow) ctx.quadraticCurveTo(x0 - height * 0.5, peakY + dir * height * 0.3, x0 - height * 0.2, dir * (bodyEdge(s, x0) + height * 0.25));
  else ctx.quadraticCurveTo(x0, peakY * 0.7 + y0 * 0.3, x0, y0);
  ctx.closePath();
}

function drawFins(ctx, g, s, finColor, outline) {
  const L = s.L, h = s.h * L;
  const fm = FIN_MULT[g.fins];
  const flow = g.fins === 'veil';
  ctx.save();
  ctx.fillStyle = finColor;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.95;
  const fins = [];
  if (s.humps) {
    fins.push([-L * 0.05, L * 0.16, h * 0.28 * fm, true]);
    fins.push([-L * 0.32, -L * 0.04, h * 0.36 * fm, true]);
  } else if (s.longFins) {
    fins.push([-L * 0.42, L * 0.2, h * 0.2 * fm * s.dorsal * 1.6, true]);
    fins.push([-L * 0.4, L * 0.08, h * 0.2 * fm * s.anal * 1.6, false]);
  } else {
    fins.push([-L * 0.25, L * 0.1, h * 0.42 * s.dorsal * fm, true]);
    fins.push([-L * 0.36, -L * 0.08, h * 0.42 * s.anal * fm, false]);
  }
  for (const [x0, x1, ht, up] of fins) {
    finPath(ctx, s, x0, x1, Math.max(5, ht), up, flow);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawMarkings(ctx, g, s) {
  const L = s.L, h = s.h * L;
  const c2 = baseFill(ctx, g.color2, -L / 2, L / 2);
  const r = seededRand(g.seed || 1);
  ctx.fillStyle = c2;
  switch (g.pattern) {
    case 'stripes': {
      ctx.globalAlpha = 0.92;
      for (let i = 0; i < 5; i++) {
        const x = -L * 0.33 + i * L * 0.15;
        ctx.beginPath();
        ctx.moveTo(x - 3, -h);
        ctx.quadraticCurveTo(x + 6, 0, x - 3, h);
        ctx.lineTo(x + 4, h);
        ctx.quadraticCurveTo(x + 13, 0, x + 4, -h);
        ctx.fill();
      }
      break;
    }
    case 'bands': {
      for (const fx of [0.27, -0.02, -0.36]) {
        const x = fx * L;
        const w = L * (fx < -0.3 ? 0.07 : 0.1);
        ctx.beginPath();
        ctx.moveTo(x - w / 2, -h);
        ctx.quadraticCurveTo(x + w * 0.8, 0, x - w / 2, h);
        ctx.lineTo(x + w / 2, h);
        ctx.quadraticCurveTo(x + w * 1.6, 0, x + w / 2, -h);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#1d1d24';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      break;
    }
    case 'spots': {
      const n = 10 + Math.floor(r() * 9);
      for (let i = 0; i < n; i++) {
        const x = (r() - 0.6) * L * 0.85, y = (r() - 0.5) * h * 0.9;
        ctx.beginPath();
        ctx.arc(x, y, 2.5 + r() * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'twotone': {
      const split = -L * (0.02 + r() * 0.12);
      ctx.beginPath();
      ctx.moveTo(split + h * 0.25, -h);
      ctx.lineTo(split - h * 0.2, h);
      ctx.lineTo(-L, h);
      ctx.lineTo(-L, -h);
      ctx.fill();
      break;
    }
    case 'gradient': {
      const gr = ctx.createLinearGradient(L * 0.3, 0, -L / 2, 0);
      const hex = COLORS[g.color2].rainbow ? '#a66bff' : COLORS[g.color2].hex;
      gr.addColorStop(0, hex + '00');
      gr.addColorStop(1, hex);
      ctx.fillStyle = gr;
      ctx.fillRect(-L, -h, L * 2, h * 2);
      break;
    }
    case 'marble': {
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.ellipse((r() - 0.55) * L * 0.8, (r() - 0.5) * h * 0.8, 5 + r() * 12, 3 + r() * 7, r() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(20,20,30,0.45)';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse((r() - 0.55) * L * 0.8, (r() - 0.5) * h * 0.8, 3 + r() * 6, 2 + r() * 4, r() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'starry': {
      ctx.fillStyle = 'rgba(10,10,40,0.45)';
      ctx.fillRect(-L, -h, L * 2, h * 2);
      for (let i = 0; i < 28; i++) {
        ctx.fillStyle = i % 4 === 0 ? c2 : '#ffffff';
        ctx.beginPath();
        ctx.arc((r() - 0.55) * L * 0.9, (r() - 0.5) * h * 0.9, 0.8 + r() * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    default:
  }
  ctx.globalAlpha = 1;
}

function drawBody(ctx, g, s) {
  const L = s.L, h = s.h * L;
  const col = COLORS[g.color];
  const outline = outlineOf(g.color);
  const finBase = col.rainbow ? '#ff9f2e' : col.hex;
  const finColor = g.pattern === 'solid' || g.pattern === 'spots' || g.pattern === 'bands' ? light(finBase, 0.15) : light(COLORS[g.color2].rainbow ? '#3fb5ff' : COLORS[g.color2].hex, 0.1);
  if (col.ghost) ctx.globalAlpha = 0.72;
  drawFins(ctx, g, s, finColor, outline);

  if (g.glow) {
    ctx.save();
    ctx.shadowColor = light(col.rainbow ? '#ffe04a' : col.hex, 0.4);
    ctx.shadowBlur = 30;
    bodyPath(ctx, s);
    ctx.fillStyle = finBase;
    for (let i = 0; i < 4; i++) ctx.fill();
    ctx.restore();
  }

  ctx.save();
  bodyPath(ctx, s);
  ctx.fillStyle = baseFill(ctx, g.color, -L / 2, L / 2);
  ctx.fill();
  ctx.clip();
  drawMarkings(ctx, g, s);
  // Shading: light on top, a little darker underneath.
  const sh = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  sh.addColorStop(0, 'rgba(255,255,255,0.38)');
  sh.addColorStop(0.45, 'rgba(255,255,255,0)');
  sh.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = sh;
  ctx.fillRect(-L, -h, L * 2, h * 2);
  if (col.shine) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-L * 0.02, -h * 0.22, L * 0.28, h * 0.07, -0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  bodyPath(ctx, s);
  ctx.strokeStyle = outline;
  ctx.lineWidth = 3.5;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();

  // Gill line and the little side fin.
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(L * 0.36, 0, h * 0.32, Math.PI * 0.7, Math.PI * 1.3);
  ctx.stroke();
  ctx.fillStyle = light(finColor.startsWith('#') ? finColor : '#ffffff', 0.3);
  ctx.globalAlpha = col.ghost ? 0.5 : 0.75;
  ctx.beginPath();
  ctx.moveTo(L * 0.2, h * 0.08);
  ctx.quadraticCurveTo(L * 0.02, h * 0.06, L * 0.02, h * 0.3);
  ctx.quadraticCurveTo(L * 0.14, h * 0.26, L * 0.2, h * 0.08);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (s.spikes) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2;
    const r = seededRand(7);
    for (let i = 0; i < 14; i++) {
      const a = Math.PI * (0.15 + r() * 1.7);
      const x = Math.cos(a) * L * 0.36 - L * 0.04, y = Math.sin(a) * h * 0.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x * 1.12, y * 1.12);
      ctx.stroke();
    }
  }

  // The eye and mouth.
  const er = Math.max(5, h * (s.bigEye ? 0.17 : 0.13));
  const ex = L / 2 - L * (s.bigEye ? 0.2 : 0.17), ey = -h * 0.1;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1b1b22';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ex, ey, er, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1b1b22';
  ctx.beginPath();
  ctx.arc(ex + er * 0.25, ey + er * 0.05, er * 0.58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(ex + er * 0.42, ey - er * 0.25, er * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(L / 2 - 6, h * 0.14, 4, Math.PI * 0.6, Math.PI * 1.1);
  ctx.stroke();
}

// --- the tail ---
function tailPath(ctx, type, tl, th, flow) {
  ctx.beginPath();
  ctx.moveTo(0, -th * 0.18);
  switch (type) {
    case 'fork':
      ctx.quadraticCurveTo(-tl * 0.5, -th * 0.4, -tl, -th);
      ctx.quadraticCurveTo(-tl * 0.62, -th * 0.2, -tl * 0.55, 0);
      ctx.quadraticCurveTo(-tl * 0.62, th * 0.2, -tl, th);
      ctx.quadraticCurveTo(-tl * 0.5, th * 0.4, 0, th * 0.18);
      break;
    case 'double':
      ctx.quadraticCurveTo(-tl * 0.4, -th * 0.6, -tl, -th * 0.95);
      ctx.quadraticCurveTo(-tl * 1.05, -th * 0.3, -tl * 0.6, -th * 0.05);
      ctx.quadraticCurveTo(-tl * 0.75, th * 0.1, -tl * 0.95, th * 0.85);
      ctx.quadraticCurveTo(-tl * 0.4, th * 0.6, 0, th * 0.18);
      break;
    case 'round':
      ctx.quadraticCurveTo(-tl * 0.4, -th * 0.9, -tl * 0.85, -th * 0.7);
      ctx.quadraticCurveTo(-tl * 1.15, 0, -tl * 0.85, th * 0.7);
      ctx.quadraticCurveTo(-tl * 0.4, th * 0.9, 0, th * 0.18);
      break;
    case 'veil':
      ctx.quadraticCurveTo(-tl * 0.5, -th * 0.8, -tl, -th * 0.55);
      ctx.bezierCurveTo(-tl * 1.15, 0, -tl * 0.8, th * 0.6, -tl * 0.75, th * 1.25);
      ctx.quadraticCurveTo(-tl * 0.35, th * 0.6, 0, th * 0.18);
      break;
    default: // fan
      ctx.quadraticCurveTo(-tl * 0.5, -th * 0.6, -tl, -th);
      if (flow) ctx.bezierCurveTo(-tl * 1.25, -th * 0.3, -tl * 1.25, th * 0.5, -tl * 0.95, th * 1.1);
      else ctx.quadraticCurveTo(-tl * 1.25, 0, -tl, th);
      ctx.quadraticCurveTo(-tl * 0.5, th * 0.6, 0, th * 0.18);
  }
  ctx.closePath();
}

function drawTail(ctx, g, s) {
  const L = s.L, h = s.h * L;
  const fm = FIN_MULT[g.fins];
  const type = g.fins === 'veil' && s.tail === 'fan' ? 'fan' : g.fins === 'veil' ? 'veil' : s.tail;
  const tl = Math.min(120, L * 0.36 * s.tailSize * fm);
  const tall = { fan: 0.9, double: 0.8, round: 0.75, fork: 0.95, veil: 0.7 }[type];
  const th = Math.min(type === 'veil' ? 66 : 86, tl * tall + h * 0.12);
  const col = COLORS[g.color];
  const outline = outlineOf(g.color);
  if (col.ghost) ctx.globalAlpha = 0.7;
  if (g.glow) {
    ctx.save();
    ctx.shadowColor = light(col.rainbow ? '#ffe04a' : col.hex, 0.4);
    ctx.shadowBlur = 26;
    tailPath(ctx, type, tl, th, g.fins === 'veil');
    ctx.fillStyle = col.rainbow ? '#a66bff' : col.hex;
    for (let i = 0; i < 3; i++) ctx.fill();
    ctx.restore();
  }
  tailPath(ctx, type, tl, th, g.fins === 'veil');
  let fill;
  if (col.rainbow || COLORS[g.color2].rainbow) {
    fill = ctx.createLinearGradient(0, -th, 0, th);
    RAINBOW.forEach((c, i) => fill.addColorStop(i / (RAINBOW.length - 1), c));
  } else if (g.pattern === 'solid' || g.pattern === 'bands') {
    fill = ctx.createLinearGradient(0, 0, -tl, 0);
    fill.addColorStop(0, col.hex);
    fill.addColorStop(1, light(col.hex, 0.25));
  } else {
    fill = ctx.createLinearGradient(0, 0, -tl, 0);
    fill.addColorStop(0, col.hex);
    fill.addColorStop(1, COLORS[g.color2].hex);
  }
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1.5;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-tl * 1.2, (i / 3) * th * 1.1);
    ctx.stroke();
  }
  if (g.pattern === 'spots') {
    const r = seededRand((g.seed || 1) + 99);
    ctx.fillStyle = COLORS[g.color2].hex;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.arc(-tl * (0.3 + r() * 0.6), (r() - 0.5) * th * 1.4, 2 + r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// --- pictures for the game and the cards ---
const textureKey = (g) => `fish_${g.species}_${g.color}_${g.color2}_${g.pattern}_${g.fins}_${g.glow ? 1 : 0}_${g.seed}`;

export function drawFishCanvases(g) {
  const s = SHAPES[g.species];
  const body = document.createElement('canvas');
  body.width = BODY_W;
  body.height = BODY_H;
  const bctx = body.getContext('2d');
  bctx.translate(BODY_CX, BODY_CY);
  drawBody(bctx, g, s);
  const tail = document.createElement('canvas');
  tail.width = TAIL_W;
  tail.height = TAIL_H;
  const tctx = tail.getContext('2d');
  tctx.translate(TAIL_JX, TAIL_H / 2);
  drawTail(tctx, g, s);
  return { body, tail };
}

// Phaser texture keys for a fish's body and tail (made the first time).
export function fishTextures(scene, g) {
  const key = textureKey(g);
  if (!scene.textures.exists(key + '_b')) {
    const { body, tail } = drawFishCanvases(g);
    scene.textures.addCanvas(key + '_b', body);
    scene.textures.addCanvas(key + '_t', tail);
  }
  return { body: key + '_b', tail: key + '_t' };
}

// Where the tail goes relative to the body's centre.
export const tailOffset = (species) => -SHAPES[species].L / 2 + 5;

// A finished picture (tail + body) for cards and the Fish Book.
const thumbs = new Map();
export function fishThumb(g) {
  const key = textureKey(g);
  if (thumbs.has(key)) return thumbs.get(key);
  const { body, tail } = drawFishCanvases(g);
  const c = document.createElement('canvas');
  const joint = BODY_CX + tailOffset(g.species);
  const off = Math.max(0, TAIL_JX - joint); // room on the left for the tail
  const tx = joint - TAIL_JX + off;
  c.width = BODY_W + off;
  c.height = BODY_H;
  const ctx = c.getContext('2d');
  ctx.drawImage(tail, tx, BODY_CY - TAIL_H / 2);
  ctx.drawImage(body, off, 0);
  const url = cropped(c).toDataURL();
  thumbs.set(key, url);
  return url;
}

// The picture trimmed to the fish, with a little margin.
function cropped(c) {
  const { data, width, height } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  let x0 = width, y0 = height, x1 = 0, y1 = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 10) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 <= x0) return c;
  const m = 6;
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m);
  x1 = Math.min(width - 1, x1 + m); y1 = Math.min(height - 1, y1 + m);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(c, -x0, -y0);
  return out;
}
